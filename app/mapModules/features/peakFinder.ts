import * as api from '@nativescript-community/ui-massifmaps/api';
import type { MassifLayer, MassifSource } from '@nativescript-community/ui-massifmaps/api';
import { showBottomSheet } from '@nativescript-community/ui-material-bottomsheet/svelte';
import { Color } from '@nativescript/core';
import { showError } from '@shared/utils/showError';
import { showToast, tryCatchFunction } from '@shared/utils/ui';
import { get } from 'svelte/store';
import { lc } from '~/helpers/locale';
import { type FeatureClickData, getMapContext } from '~/mapModules/MapModule';
import { ensureTerrain, is3D, setTerrain3DImmediate } from '~/mapModules/features/terrain3d';
import type { AddedLayer } from '~/mapModules/layerStack';
import { registerMapFeature } from '~/mapModules/mapFeatures';
import { registerMapModule } from '~/mapModules/registry';
import { RELIEF_DEFAULTS, RELIEF_OUTLINE_SHADER, RELIEF_SURFACE_SHADER, reliefPalette } from '~/mapModules/terrain/reliefShaders';
import { peaksStyle } from '~/mapModules/terrain/peaksStyle';
import type { IItem } from '~/models/Item';
import { packageService } from '~/services/PackageService';
import {
    peakFinderActive,
    peakFinderArActive,
    peakFinderCreaseStrength,
    peakFinderDark,
    peakFinderDistanceFade,
    peakFinderElevation,
    peakFinderEnabled,
    peakFinderFlyClimb,
    peakFinderFlyDuration,
    peakFinderFlyElevation,
    peakFinderFlyZoom,
    peakFinderHaze,
    peakFinderHeadingFollowing,
    peakFinderHorizonBoost,
    peakFinderLabelAngle,
    peakFinderLabelBand,
    peakFinderLabelMaxDistance,
    peakFinderLabelPinTop,
    peakFinderLabelRows,
    peakFinderOcclusion,
    peakFinderOutlineWidth,
    peakFinderScreenOrientation,
    peakFinderSelectedPeak,
    peakFinderShadeStrength,
    peakFinderTilt,
    peakFinderViewDistance
} from '~/stores/terrainStore';
import { type MapPos, TO_RAD, bearingBetween, computeDistanceBetween, fromPosition, toPosition } from '~/utils/geo';
import { lockOrientation } from '~/utils/orientation';

/**
 * The peak finder, as a MODE of the live map rather than a screen of its own.
 *
 * It is not one SDK feature but a combination, and each piece on its own looks like nothing happens:
 *
 *  - the terrain SURFACE only shows where NO tile layer paints, so the mode takes the map layers off;
 *  - the ridge lines are a POST-PROCESS effect reading the packed terrain depth — without it the
 *    surface is a flat wash, which is what makes it look like the mode did not work;
 *  - summit names need a view that HAS summits in it, so the camera is put near the ground looking at
 *    the horizon (tilt 90 is straight down in this SDK, so a panorama is a LOW tilt) and lifted a few
 *    hundred metres above it;
 *  - and a panorama wants the far ranges, which is what viewDistanceFactor buys.
 *
 * Entering is ONE flight: the camera flies to the item at the panorama's zoom and tilt while the
 * viewpoint climbs, and the terrain, the relief and the names come up on the same clock.
 *
 * Modelled on the android demo (`DemoMap.flyToPeakFinder` / `setPeakFinderMode` / `setArMode`) down to
 * its defaults, and the shaders are that demo's verbatim — the mode is meant to look exactly like it.
 * See `terrain/reliefShaders.ts` and `stores/terrainStore.ts`.
 */

const PEAKS_LAYER_ID = 'layer.peaks';
const PEAKS_DECODER_ID = 'decoder.peaks';
const EFFECT_ID = 'relief_outline';
/** Straight down, which is where a 2D map's camera is. */
const TILT_2D = 90;

/** What entering the mode changed, so leaving it can put everything back. */
interface SavedState {
    /** The tile layers we took off the map, with the layer type each was added under. */
    layers: AddedLayer[];
    tilt: number;
    was3D: boolean;
    viewDistanceFactor: number;
    occlusionEnabled: boolean;
    occlusionTolerance: number;
    skyEnabled: boolean;
    mapSkyColor: number;
    clearColor: number;
}

let saved: SavedState = null;
/** Bumped per rebuild, so a new layer/decoder pair never collides with the one still on the map. */
let peaksGeneration = 0;
let peaksLayer: MassifLayer = null;
let peaksDecoder: api.MassifObject<'massif::MBVectorTileDecoder'> = null;
let effect = null;
/** Where the panorama is looking FROM, in lon/lat — the flight's target, kept for distances. */
let viewpoint: MapPos = null;

function mapContext() {
    return getMapContext();
}

function terrain() {
    return mapContext().getMap()?.terrain();
}

function camera() {
    return mapContext().getMap()?.camera();
}

function palette() {
    return reliefPalette(get(peakFinderDark));
}

function argb(color: string) {
    return new Color(color).argb;
}

export function isPeakFinderActive() {
    return get(peakFinderActive);
}

// --- the summit label layer -------------------------------------------------------------------

/**
 * A vector source with the app's own tiles in it.
 *
 * The offline package first, because that is what the mode is for; otherwise the first vector layer
 * the user has switched on. The peaks layer draws from the SAME source the map is showing rather than
 * fetching its own, so the labels agree with the map and cost nothing extra.
 */
function vectorSource(): MassifSource {
    const local = packageService.localVectorTileLayer;
    if (local?.valid) {
        return local.source();
    }
    let found: MassifSource = null;
    mapContext()
        .mapModule('customLayers')
        ?.customSources.some((source) => {
            if (source.layer?.is('massif::CompositeVectorTileLayer') || source.layer?.is('massif::VectorTileLayer')) {
                found = source.layer.source();
                return true;
            }
            return false;
        });
    return found;
}

function currentPeaksStyle() {
    return peaksStyle({
        dark: get(peakFinderDark),
        pinTop: get(peakFinderLabelPinTop),
        band: get(peakFinderLabelBand),
        textAngle: get(peakFinderLabelAngle),
        maxRows: get(peakFinderLabelRows),
        maxDistance: get(peakFinderLabelMaxDistance)
    });
}

/**
 * Builds the layer and the decoder that styles it, under ids nobody else holds.
 *
 * The ids carry a GENERATION rather than being fixed: a rebuild has to stand its new layer up while
 * the old one is still on the map, and building an id that is already registered with a different
 * spec is refused. Counting means the two never collide, and the old pair is released afterwards.
 */
function createPeaks(): { layer: MassifLayer; decoder: api.MassifObject<'massif::MBVectorTileDecoder'> } {
    const source = vectorSource();
    if (!source) {
        DEV_LOG && console.log('peakFinder: no vector source, so no summit labels');
        return null;
    }
    peaksGeneration += 1;
    // No cast: `create` infers the class from the spec's `type`.
    const decoder = api.create('style', `${PEAKS_DECODER_ID}.${peaksGeneration}`, {
        type: 'mbvt',
        cartocss: { type: 'cartocss', css: currentPeaksStyle() }
    });
    const layer = mapContext().getMap().buildLayer(`${PEAKS_LAYER_ID}.${peaksGeneration}`, {
        type: 'vector',
        source: source.handle,
        style: decoder.id,
        preloading: true,
        // The labels are the only thing drawn over the relief, so they go last.
        labelRenderOrder: 'VECTOR_TILE_RENDER_ORDER_LAST',
        tileSubstitutionPolicy: 'TILE_SUBSTITUTION_POLICY_VISIBLE'
    });
    layer.onFeatureClick((e) => {
        e.consumed = onPeakClicked(mapContext().featureClickData(e));
    });
    return { layer, decoder };
}

function buildPeaksLayer() {
    const built = createPeaks();
    if (!built) {
        return;
    }
    peaksLayer = built.layer;
    peaksDecoder = built.decoder;
    mapContext().addLayer(peaksLayer, 'peaks');
}

function destroyPeaksLayer() {
    if (peaksLayer) {
        mapContext().removeLayer(peaksLayer);
        peaksLayer.destroy();
        peaksLayer = null;
    }
    peaksDecoder?.destroy();
    peaksDecoder = null;
}

/**
 * Rebuilds the layer with a new decoder.
 *
 * Every label knob is style TEXT, so there is no property to write — the decoder has to be built
 * again, exactly as the native demo's `rebuildPeaksLayer` does. Swapped in place so it keeps its
 * position in the stack, and the old pair is released only once the new one is standing.
 */
function rebuildPeaksLayer() {
    if (!peaksLayer || !isPeakFinderActive()) {
        return;
    }
    const previousLayer = peaksLayer;
    const previousDecoder = peaksDecoder;
    const built = createPeaks();
    if (!built) {
        return;
    }
    peaksLayer = built.layer;
    peaksDecoder = built.decoder;
    mapContext().replaceLayer(previousLayer, peaksLayer);
    previousLayer.destroy();
    previousDecoder?.destroy();
}

// --- the relief look -------------------------------------------------------------------------

/**
 * The shaded terrain surface the ink lines are drawn over.
 *
 * The shader SOURCE is a facade property; its parameters are not — the surface API has no method table
 * for `TerrainOptions` — so the uniforms go through the object API on the view. The parameters are
 * written whether or not the shader is attached, exactly as the demo's `applyReliefSurface` does: they
 * are cheap, and it keeps the two calls from having to agree about order.
 */
function applyReliefSurface() {
    const terrainOptions = mapContext().getMapView()?.getTerrainOptions();
    const colors = palette();
    terrain().set('surfaceShaderSource', RELIEF_SURFACE_SHADER);
    if (!terrainOptions) {
        return;
    }
    terrainOptions.setSurfaceColorParameter('uPaperColor', colors.paper);
    terrainOptions.setSurfaceColorParameter('uShadeColor', colors.shade);
    terrainOptions.setSurfaceParameter('uShadeStrength', get(peakFinderShadeStrength));
    terrainOptions.setSurfaceParameter('uAmbient', RELIEF_DEFAULTS.ambient);
    terrainOptions.setSurfaceParameter('uHaze', get(peakFinderHaze));
    terrainOptions.setSurfaceParameter('uHazeDistance', RELIEF_DEFAULTS.hazeDistance);
}

function clearReliefSurface() {
    // An EMPTY shader is how the renderer's own default comes back.
    terrain()?.set('surfaceShaderSource', '');
}

/**
 * The ridge lines.
 *
 * The SDK gives the mechanism — an offscreen frame, the packed terrain depth and named parameters —
 * and the shader is the look. Object API only: the surface API carries no `postProcessEffect`.
 */
function applyReliefOutline() {
    const view = mapContext().getMapView();
    if (!view) {
        return;
    }
    const colors = palette();
    if (!effect) {
        // Required lazily: `renderers` is object-API code that nothing else in the app pulls in.
        const { PostProcessEffect } = require('@nativescript-community/ui-massifmaps/renderers');
        effect = new PostProcessEffect({ name: EFFECT_ID, fragmentShader: RELIEF_OUTLINE_SHADER });
        effect.terrainDepthRequired = true;
    }
    effect.setFloatParameter('uIntensity', 1);
    effect.setFloatParameter('uOutlineWidth', get(peakFinderOutlineWidth));
    effect.setFloatParameter('uHorizonBoost', get(peakFinderHorizonBoost));
    effect.setFloatParameter('uDepthThreshold', RELIEF_DEFAULTS.depthThreshold);
    effect.setFloatParameter('uCreaseStrength', get(peakFinderCreaseStrength));
    effect.setFloatParameter('uHaze', get(peakFinderHaze));
    // The depth texture is half resolution with nearest filtering, so a narrower step than this
    // samples the same texel twice and draws nothing.
    effect.setFloatParameter('uDepthTexelSize', RELIEF_DEFAULTS.depthTexelSize);
    effect.setFloatParameter('uGrazingFloor', RELIEF_DEFAULTS.grazingFloor);
    effect.setFloatParameter('uDistanceFade', get(peakFinderDistanceFade));
    effect.setColorParameter('uInkColor', colors.ink);
    effect.setColorParameter('uPaperColor', colors.paper);
    view.setPostProcessEffect(effect);
}

function clearReliefOutline() {
    mapContext().getMapView()?.setPostProcessEffect(null);
    effect = null;
}

/**
 * In the relief view the sky is part of the palette: a light one over the paper, a night one over the
 * ink. This is the demo's `applySkyOptions` relief branch and nothing more.
 *
 * No FOG, deliberately. The demo's peak finder leaves `FogOptions` alone (`FOG_ENABLED` is false), and
 * the surface shader already pulls the distance back towards the paper through `uHaze` — a long paper
 * fog on top of that was a guess from an older port, and it flattened the far ranges.
 *
 * The sky's own SHADER is cleared: a generated day-cycle shader owns the sky's colours, and while one
 * is attached the palette's sky is not visible at all.
 */
function applyAtmosphere() {
    const map = mapContext().getMap();
    const colors = palette();
    const transparent = get(peakFinderArActive);
    map.sky({ type: 'sky' }).apply({
        enabled: !transparent,
        shaderSource: '',
        skyColor: argb(colors.sky)
    });
    // A fully transparent clear colour turns the frame into a hole, which is what the camera preview
    // behind it shows through.
    map.set('skyColor', transparent ? 0 : argb(colors.sky));
    map.set('clearColor', transparent ? 0 : argb(colors.paper));
}

/** Re-applies everything that the light/dark switch touches. The label palette is style text, so the
 *  decoder is rebuilt with it. */
function applyPalette() {
    if (!isPeakFinderActive()) {
        return;
    }
    applyReliefSurface();
    applyReliefOutline();
    applyAtmosphere();
    rebuildPeaksLayer();
}

// --- the viewpoint ---------------------------------------------------------------------------

/**
 * Where the camera should sit to be `metresAboveGround` above the terrain at `position`.
 *
 * The focus position carries a height and the camera rides on it, so raising the focus raises the eye
 * — which is what a peak finder wants: see over the ridge in front of you. The altitude is in the base
 * projection's units, and one metre is worth more of them the further from the equator (mercator),
 * hence the latitude term.
 */
async function viewpointPos(position: MapPos, metresAboveGround: number): Promise<MapPos> {
    let ground = 0;
    try {
        const sampled = await packageService.getElevation(position);
        if (sampled > -100000) {
            ground = sampled;
        }
    } catch (error) {
        DEV_LOG && console.log('peakFinder: no elevation for the viewpoint', error);
    }
    return {
        lat: position.lat,
        lon: position.lon,
        altitude: (ground + metresAboveGround) / Math.cos(position.lat * TO_RAD)
    };
}

/** Lifts the viewpoint to `metres` above the ground under it, without moving it horizontally. */
export const applyViewpointElevation = tryCatchFunction(async (metres: number) => {
    if (!isPeakFinderActive()) {
        return;
    }
    const here = fromPosition(camera().position());
    const target = await viewpointPos(here, metres);
    viewpoint = target;
    camera().animate(300).moveTo(toPosition(target));
});

// --- entering and leaving ---------------------------------------------------------------------

function itemPosition(item: IItem): MapPos {
    const coordinates = item.geometry['coordinates'];
    return { lat: coordinates[1], lon: coordinates[0] };
}

/**
 * Enters the mode and flies in, as one move.
 */
export const enterPeakFinder = tryCatchFunction(async (item: IItem) => {
    if (isPeakFinderActive()) {
        return;
    }
    const map = mapContext().getMap();
    if (!map) {
        return;
    }
    if (!ensureTerrain()) {
        // The item action is gated on `hasElevation`, so this only happens if the DEM went away between
        // the row being built and the tap. Say so rather than doing nothing at all.
        showToast(lc('no_elevation_data'));
        return;
    }
    const position = itemPosition(item);
    const was3D = is3D();

    saved = {
        layers: [...mapContext().getLayers('map'), ...mapContext().getLayers('customLayers')],
        tilt: camera().tilt(),
        was3D,
        viewDistanceFactor: terrain().get('viewDistanceFactor') ?? 1,
        occlusionEnabled: terrain().get('billboardOcclusionEnabled') ?? false,
        occlusionTolerance: terrain().get('billboardOcclusionTolerance') ?? 0.02,
        skyEnabled: map.sky().get('enabled') ?? false,
        mapSkyColor: map.get('skyColor'),
        clearColor: map.get('clearColor')
    };

    // 3D first, and without an animation of its own: the single flight below carries the whole move,
    // and a second animated switch underneath it would fight that.
    setTerrain3DImmediate(true);

    // The surface only shows where no tile layer paints. REMOVED rather than hidden: a removed layer
    // fetches and decodes nothing, so the mode costs what an empty map costs — which is the native
    // demo's reasoning too. LayerStack remembered each one's type, so the exit puts them all back in
    // their original order.
    saved.layers.forEach((added) => mapContext().removeLayer(added.layer));

    terrain().apply({
        // A summit sitting ON a ridge, or a metre behind it, is exactly what this view is for, so the
        // label occlusion is deliberately generous here.
        billboardOcclusionEnabled: true,
        billboardOcclusionTolerance: get(peakFinderOcclusion),
        // A panorama wants the far ranges: tangram's rule stops the ground a few kilometres out, which
        // is most of what the view is about.
        viewDistanceFactor: get(peakFinderViewDistance)
    });

    peakFinderActive.set(true);
    peakFinderSelectedPeak.set(null);
    applyReliefSurface();
    applyReliefOutline();
    applyAtmosphere();
    buildPeaksLayer();
    lockOrientation(get(peakFinderScreenOrientation));

    // The flight. `climbHeight` is what makes the viewpoint rise over the way there like a plane
    // instead of straight to its final elevation.
    const elevation = get(peakFinderFlyElevation);
    const target = await viewpointPos(position, elevation);
    viewpoint = target;
    peakFinderElevation.set(elevation);
    camera().moveTo(toPosition(target), {
        zoom: get(peakFinderFlyZoom),
        rotation: camera().rotation(),
        tilt: get(peakFinderTilt),
        climbHeight: get(peakFinderFlyClimb),
        duration: get(peakFinderFlyDuration) * 1000
    });
});

/**
 * Leaves the mode and puts back everything `enterPeakFinder` changed.
 */
export const exitPeakFinder = tryCatchFunction(async () => {
    if (!isPeakFinderActive() || !saved) {
        return;
    }
    const map = mapContext().getMap();
    stopOrientationFollowing();
    // Before the store, so the surface stops being a hole while the preview is still behind it —
    // the other way round leaves one frame of transparent map over nothing.
    setMapTranslucent(false);
    peakFinderArActive.set(false);
    peakFinderActive.set(false);
    peakFinderSelectedPeak.set(null);

    clearReliefOutline();
    clearReliefSurface();
    destroyPeaksLayer();

    terrain()?.apply({
        billboardOcclusionEnabled: saved.occlusionEnabled,
        billboardOcclusionTolerance: saved.occlusionTolerance,
        viewDistanceFactor: saved.viewDistanceFactor
    });
    map?.sky().set('enabled', saved.skyEnabled);
    map?.set('skyColor', saved.mapSkyColor);
    map?.set('clearColor', saved.clearColor);

    // The layers come back before the camera moves, so the map is not empty during the flight out.
    saved.layers.forEach((added) => mapContext().addLayer(added.layer, added.layerId));

    // Back to the ground, and to a top-down camera unless 3D was already on when we came in. Half the
    // fly-in's duration: coming back is not the part worth watching.
    const here = fromPosition(camera().position());
    camera()
        .animate(get(peakFinderFlyDuration) * 500)
        .moveTo(toPosition({ lat: here.lat, lon: here.lon }), { tilt: saved.was3D ? saved.tilt : TILT_2D });
    if (!saved.was3D) {
        setTerrain3DImmediate(false);
    }

    peakFinderElevation.set(0);
    viewpoint = null;
    lockOrientation('auto');
    saved = null;
});

// --- the selected summit ---------------------------------------------------------------------

/** A tap on a summit label fills the overlay's chip instead of opening the item sheet. */
function onPeakClicked({ featureData, featurePosition }: FeatureClickData): boolean {
    if (!isPeakFinderActive() || !featurePosition) {
        return false;
    }
    const name = featureData?.name;
    if (!name) {
        return false;
    }
    const elevation = featureData.ele !== undefined ? Math.round(Number(featureData.ele)) : undefined;
    peakFinderSelectedPeak.set({
        name,
        elevation,
        position: featurePosition,
        distance: viewpoint ? computeDistanceBetween(viewpoint, featurePosition) : 0
    });
    return true;
}

/** Turns the camera to look at the selected summit, without moving the viewpoint. */
export const focusSelectedPeak = tryCatchFunction(async () => {
    const peak = get(peakFinderSelectedPeak);
    if (!peak || !viewpoint) {
        return;
    }
    camera().animate(600).rotation(bearingBetween(viewpoint, peak.position));
});

/** Moves the viewpoint TO the selected summit, keeping the panorama's camera. */
export const flyToSelectedPeak = tryCatchFunction(async () => {
    const peak = get(peakFinderSelectedPeak);
    if (!peak) {
        return;
    }
    const elevation = get(peakFinderElevation);
    const target = await viewpointPos(peak.position, elevation);
    viewpoint = target;
    camera().moveTo(toPosition(target), {
        zoom: get(peakFinderFlyZoom),
        tilt: get(peakFinderTilt),
        climbHeight: get(peakFinderFlyClimb),
        duration: get(peakFinderFlyDuration) * 1000
    });
    peakFinderSelectedPeak.set(null);
});

// --- orientation following (the compass and AR) ------------------------------------------------

/**
 * The sensor work lives in `peakFinderOrientation.ts` and is loaded on demand: it pulls in the sensors
 * plugin, and `Map.svelte` imports this file at startup.
 */
export const toggleHeadingFollowing = tryCatchFunction(async () => {
    const orientation = await import('~/mapModules/features/peakFinderOrientation');
    if (get(peakFinderHeadingFollowing)) {
        await orientation.stopOrientationFollowing();
    } else {
        // Without AR the compass turns the view but leaves the panorama's tilt alone.
        await orientation.startOrientationFollowing(get(peakFinderArActive));
    }
});

/**
 * AR: the relief view over the camera preview.
 *
 * Every piece is an ordinary SDK feature the app puts together — a transparent clear colour (the frame
 * becomes a hole), a TRANSLUCENT GL surface so the hole shows what is behind it, the sky off, the dark
 * palette, and the device's orientation aiming the camera. What is in FRONT does not change at all;
 * only what is behind it does.
 *
 * `setTranslucent` also raises the surface's z-order (`MapView.setTranslucent` calls
 * `setZOrderMediaOverlay`), which is the part that matters: a `SurfaceView` is composited BELOW the
 * window, so the only thing a translucent map can reveal is another surface under it. `Map.svelte`
 * puts a `<cameraview>` there — CameraX's `PreviewView` is a `SurfaceView` in its default mode.
 */
export const toggleArMode = tryCatchFunction(async () => {
    if (get(peakFinderArActive)) {
        peakFinderArActive.set(false);
        setMapTranslucent(false);
        return;
    }
    const { isPermResultAuthorized, request } = await import('@nativescript-community/perms');
    if (!isPermResultAuthorized(await request('camera'))) {
        // Refused: the panorama itself still works, so this is a snack rather than an error.
        showToast(lc('missing_camera_permission'));
        return;
    }
    // The view is created by the `{#if}` in Map.svelte reacting to this, so the surface has to be made
    // translucent after it — otherwise there is nothing behind the hole yet and the map goes black.
    peakFinderArActive.set(true);
    setMapTranslucent(true);
});

function setMapTranslucent(translucent: boolean) {
    const nativeMapView = mapContext().getMapView()?.mapView;
    // Guarded: `setTranslucent` is on the SDK's own MapView, not on the NativeScript wrapper.
    if (nativeMapView?.setTranslucent) {
        nativeMapView.setTranslucent(translucent);
    }
}

/** Follows the device fully — turning AND aiming up and down, which is what AR is for. */
async function setOrientationTilt(withTilt: boolean) {
    const orientation = await import('~/mapModules/features/peakFinderOrientation');
    if (withTilt && !get(peakFinderHeadingFollowing)) {
        await orientation.startOrientationFollowing(true);
        return;
    }
    await orientation.setFollowTilt(withTilt);
}

export function stopOrientationFollowing() {
    if (!get(peakFinderHeadingFollowing)) {
        return;
    }
    import('~/mapModules/features/peakFinderOrientation')
        .then((orientation) => orientation.stopOrientationFollowing())
        .catch((error) => DEV_LOG && console.log('peakFinder: stopping the orientation sensors', error));
}

// --- settings, and the entry point ------------------------------------------------------------

export const showPeakFinderSettings = tryCatchFunction(async () => {
    const component = (await import('~/components/peaks/PeakFinderSettings.svelte')).default;
    await showBottomSheet({ view: component, skipCollapsedState: true });
});

/** The look changes that are live property writes. The label ones rebuild the decoder instead. */
function applyLive(store: { subscribe: (run: (value) => void) => unknown }, apply: () => void) {
    store.subscribe(() => {
        if (!isPeakFinderActive()) {
            return;
        }
        try {
            apply();
        } catch (error) {
            showError(error);
        }
    });
}

applyLive(peakFinderDark, applyPalette);
applyLive(peakFinderShadeStrength, applyReliefSurface);
applyLive(peakFinderOutlineWidth, applyReliefOutline);
applyLive(peakFinderHorizonBoost, applyReliefOutline);
applyLive(peakFinderCreaseStrength, applyReliefOutline);
applyLive(peakFinderDistanceFade, applyReliefOutline);
applyLive(peakFinderHaze, () => {
    applyReliefSurface();
    applyReliefOutline();
});
applyLive(peakFinderOcclusion, () => terrain().set('billboardOcclusionTolerance', get(peakFinderOcclusion)));
applyLive(peakFinderViewDistance, () => terrain().set('viewDistanceFactor', get(peakFinderViewDistance)));
applyLive(peakFinderTilt, () => camera().animate(400).tilt(get(peakFinderTilt)));
applyLive(peakFinderLabelPinTop, rebuildPeaksLayer);
applyLive(peakFinderLabelBand, rebuildPeaksLayer);
applyLive(peakFinderLabelAngle, rebuildPeaksLayer);
applyLive(peakFinderLabelRows, rebuildPeaksLayer);
applyLive(peakFinderLabelMaxDistance, rebuildPeaksLayer);
// Changed from the settings sheet while the panorama is up: turn now rather than on the next entry.
applyLive(peakFinderScreenOrientation, () => lockOrientation(get(peakFinderScreenOrientation)));
// AR turns the sky and the clear colour into a hole for the camera preview to show through, and takes
// over the tilt as well as the rotation — a panorama held up at the sky has to be able to look up.
applyLive(peakFinderArActive, () => {
    applyAtmosphere();
    setOrientationTilt(get(peakFinderArActive)).catch((error) => showError(error));
});

/** A tap on empty ground clears the chip, the way tapping the map elsewhere deselects. */
function onMapClicked() {
    if (!isPeakFinderActive()) {
        return false;
    }
    peakFinderSelectedPeak.set(null);
    // Not consumed: the mode has no other click behaviour, and swallowing it would also swallow the
    // long press the map uses elsewhere.
    return false;
}

function onMapDestroyed() {
    stopOrientationFollowing();
    destroyPeaksLayer();
    effect = null;
    saved = null;
    viewpoint = null;
    peakFinderActive.set(false);
    peakFinderArActive.set(false);
}

registerMapModule('peakFinder', { onMapClicked, onMapDestroyed });

declare module '~/mapModules/registry' {
    interface MapModules {
        peakFinder: { onMapClicked: () => boolean; onMapDestroyed: () => void };
    }
}

registerMapFeature({
    id: 'peakFinder',
    itemActions: (item) => {
        // A route has no single viewpoint to stand at, and without a DEM there is no terrain to look at.
        if (!item || !!item.route || !get(peakFinderEnabled) || !packageService.hasElevation()) {
            return [];
        }
        return [
            {
                id: 'peaks',
                // 115 keeps it where it has always been in the row: just after `astronomy`.
                order: 115,
                text: 'mdi-summit',
                tooltip: lc('peaks'),
                onTap: () => enterPeakFinder(item)
            }
        ];
    }
});
