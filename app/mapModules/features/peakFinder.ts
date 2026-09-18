import * as api from '@nativescript-community/ui-massifmaps/api';
import type { FreeRoamMode, MassifLayer, MassifSource, Position } from '@nativescript-community/ui-massifmaps/api';
import { showBottomSheet } from '@nativescript-community/ui-material-bottomsheet/svelte';
import { Color } from '@nativescript/core';
import { showError } from '@shared/utils/showError';
import { showToast, tryCatchFunction } from '@shared/utils/ui';
import { get } from 'svelte/store';
import { lc } from '~/helpers/locale';
import { isEInk } from '~/helpers/theme';
import { type FeatureClickData, getMapContext } from '~/mapModules/MapModule';
import { beginTiltTransition, endTiltTransition, ensureTerrain, is3D, refreshAtmosphere, refreshTouchMode, refreshViewDistance, setTerrain3DImmediate } from '~/mapModules/features/terrain3d';
import type { AddedLayer } from '~/mapModules/layerStack';
import { registerMapFeature } from '~/mapModules/mapFeatures';
import { registerMapModule } from '~/mapModules/registry';
import { RELIEF_DEFAULTS, RELIEF_OUTLINE_SHADER, RELIEF_SURFACE_SHADER, reliefPalette } from '~/mapModules/terrain/reliefShaders';
import { peaksStyle } from '~/mapModules/terrain/peaksStyle';
import type { IItem } from '~/models/Item';
import { packageService } from '~/services/PackageService';
import { nutiProps } from '~/stores/mapStore';
import {
    peakFinderActive,
    peakFinderArActive,
    peakFinderCreaseFade,
    peakFinderCreaseStrength,
    peakFinderCreaseThreshold,
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
    peakFinderLabelMinDistance,
    peakFinderLabelPinTop,
    peakFinderLabelRows,
    peakFinderMeshResolution,
    peakFinderOcclusion,
    peakFinderOutlineWidth,
    peakFinderScreenOrientation,
    peakFinderSelectedPeak,
    peakFinderShadeStrength,
    peakFinderSlopeBias,
    peakFinderSlopeMultiplier,
    peakFinderSlopeStrength,
    peakFinderTilt,
    peakFinderViewDistance,
    peakFinderViewDistanceMetres
} from '~/stores/terrainStore';
import { type MapPos, bearingBetween, computeDistanceBetween, toPosition } from '~/utils/geo';
import { lockOrientation } from '~/utils/orientation';
import { clearTimeout, setTimeout } from '~/utils/utils';

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
/** How often the fly-in's lift ramp samples the flight, ms — one frame, as `terrain3d` does. */
const LIFT_RAMP_TICK_MS = 16;
/** A transparent sky colour is how the legacy sky BITMAP is turned off — see `applyAtmosphere`. */
const NO_SKY_BITMAP = 0;

/** See where it is applied in `enterPeakFinder`: it is the package's peak zoom range, not a budget. */
const PEAKS_MAX_TILE_ZOOM_COARSENING = 4;

/** What entering the mode changed, so leaving it can put everything back. */
interface SavedState {
    /** The tile layers we took off the map, with the layer type each was added under. */
    layers: AddedLayer[];
    /** The whole camera, so leaving the mode gives the map back exactly as it was handed over. */
    position: Position;
    zoom: number;
    rotation: number;
    tilt: number;
    was3D: boolean;
    viewDistanceFactor: number;
    viewDistance: number;
    viewDistanceMax: number;
    meshResolution: number;
    occlusionEnabled: boolean;
    occlusionTolerance: number;
    maxTileZoomCoarsening: number;
    skyEnabled: boolean;
    mapSkyColor: number;
    clearColor: number;
    labelViewDistance: number;
    drapeFills: boolean;
    drapeLines: boolean;
    /** The map's background bitmap, held so putting it back does not need a handle we cannot read. */
    backgroundBitmap: api.MassifObject<'massif::Bitmap'>;
}

let saved: SavedState = null;
/** Bumped per rebuild, so a new layer/decoder pair never collides with the one still on the map. */
let peaksGeneration = 0;
let peaksLayer: MassifLayer = null;
let peaksDecoder: api.MassifObject<'massif::MBVectorTileDecoder'> = null;
let effect = null;
/** Where the panorama is looking FROM, in lon/lat — the flight's target, kept for distances. */
let viewpoint: MapPos = null;
/** Clears the transition's open tilt range once a fly-in or fly-out has landed. */
let transitionTimer: NodeJS.Timeout = null;
/** Runs the fly-in's climb; see `rampLiftWithFlight`. */
let liftRampTimer: NodeJS.Timeout = null;
/** Whether AR is what started the orientation sensors, so turning it off knows to stop them. */
let arStartedFollowing = false;

function mapContext() {
    return getMapContext();
}

function terrain() {
    return mapContext().getMap()?.terrain();
}

function camera() {
    return mapContext().getMap()?.camera();
}

/**
 * AR always takes the LIGHT-INK palette, whatever the switch says.
 *
 * With the camera behind it the only thing this mode draws is ink, and the light palette's ink is
 * nearly black (#14141a) — which over a photograph of a mountain is the one colour that cannot be
 * seen. The dark palette's is nearly white, and on e-ink `einkDark` is pure white, so the pair that
 * reads over a preview is the same pair either way.
 *
 * The switch therefore does nothing while AR is on. That is deliberate: the paper it picks between is
 * not drawn in AR at all, so the only thing left for it to choose is an unreadable ink.
 */
function palette() {
    return reliefPalette(get(peakFinderArActive) || get(peakFinderDark));
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

/** The map's own label size preference, so the summit names match its labels. See `peaksStyle`. */
function mapFontScale(): number {
    const store = nutiProps.getSettingsOptions('_fontscale')?.store;
    return store ? get(store) || 1 : 1;
}

function currentPeaksStyle() {
    return peaksStyle({
        dark: get(peakFinderDark),
        fontScale: mapFontScale(),
        pinTop: get(peakFinderLabelPinTop),
        band: get(peakFinderLabelBand),
        textAngle: get(peakFinderLabelAngle),
        maxRows: get(peakFinderLabelRows),
        minDistance: get(peakFinderLabelMinDistance),
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
    // NO surface shader in AR: the shader's job is to paint the ground, and in AR the ground is the
    // camera preview. The relief still reads, because the ridge lines are drawn by the post-process
    // effect off the packed terrain DEPTH, which is rendered whether or not the surface is painted.
    terrain().set('surfaceShaderSource', get(peakFinderArActive) ? '' : RELIEF_SURFACE_SHADER);
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
    // AR draws the ink alone, over the camera preview — see the shader's own note.
    effect.setFloatParameter('uTransparent', get(peakFinderArActive) ? 1 : 0);
    effect.setFloatParameter('uOutlineWidth', get(peakFinderOutlineWidth));
    effect.setFloatParameter('uHorizonBoost', get(peakFinderHorizonBoost));
    effect.setFloatParameter('uDepthThreshold', RELIEF_DEFAULTS.depthThreshold);
    effect.setFloatParameter('uCreaseStrength', get(peakFinderCreaseStrength));
    effect.setFloatParameter('uCreaseThreshold', get(peakFinderCreaseThreshold));
    effect.setFloatParameter('uCreaseFade', get(peakFinderCreaseFade));
    // NO slope ink in AR, and this is the grey veil over the camera preview. The slope term is a
    // depth GRADIENT lifted by `pow(·, 0.23)`, so it inks every surface that is not square-on to the
    // camera — which is nearly the whole frame. On paper that IS the relief; over a photograph it is
    // a sheet of translucent ink with the picture behind it. AR keeps the terms that draw LINES (the
    // silhouette and the creases) and drops the one that fills.
    effect.setFloatParameter('uSlopeStrength', get(peakFinderArActive) ? 0 : get(peakFinderSlopeStrength));
    effect.setFloatParameter('uSlopeMultiplier', get(peakFinderSlopeMultiplier));
    effect.setFloatParameter('uSlopeBias', get(peakFinderSlopeBias));
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
 * No FOG, and now it has to be said rather than assumed: the 3D mode ships one (mapbox's) and this mode
 * is entered THROUGH the 3D switch, so it arrives already on. The relief has its own distance haze in
 * the surface shader (`uHaze`) and the SDK applies the frame's fog on top of whatever `surfaceColor()`
 * returns, so leaving it on means the distance is washed out twice and the far ranges go flat.
 *
 * The sky's own SHADER is cleared: a generated day-cycle shader owns the sky's colours, and while one
 * is attached the palette's sky is not visible at all.
 *
 * E-ink gets a FLAT white sky, and getting there takes both of the sky colours off:
 *
 *  - the shader sky is off, as it was — a screen with no greys to spend renders its gradient as noise;
 *  - and the map's `skyColor` goes TRANSPARENT, which is not a colour here but a switch. Both
 *    `Options::getSkyBitmap` and `VectorTileLayer::getSkyBitmap` read it to generate the legacy sky
 *    band as a GRADIENT from the style's background colour up to it, and only a transparent one means
 *    "no bitmap at all". Setting it white therefore did not give a white sky, it gave the gradient the
 *    mode was reported with — black (the peaks style has no background colour) up to white.
 *
 * With no sky bitmap and no shader sky, the band above the horizon is the CLEAR colour, so that is
 * what carries the paper white.
 */
function applyAtmosphere() {
    const map = mapContext().getMap();
    const colors = palette();
    const transparent = get(peakFinderArActive);
    // The palette's own paper, e-ink included: `reliefPalette` has a pair for that screen now, so
    // forcing white here is what kept the dark switch from reaching the background.
    const paper = argb(colors.paper);
    // NO SKY, on any screen. Not a gradient, not an atmosphere, not even a colour of its own: above
    // the horizon this mode is paper (or ink), the same flat tone as the ground it is read against.
    // Three separate things have to be off to get that, and each one alone leaves a band:
    //  - the shader sky, which is what draws a gradient;
    //  - the legacy sky BITMAP, whose switch is a TRANSPARENT `skyColor` — `Options::getSkyBitmap`
    //    generates a gradient from the style's background up to that colour, so any real colour
    //    there is a gradient, and white gave a gradient that merely ended white;
    //  - and with both off the band shows the CLEAR colour, so that is what carries the tone.
    map.sky({ type: 'sky' }).apply({ enabled: false, shaderSource: '' });
    map.fog({ type: 'fog' }).set('enabled', false);
    map.set('skyColor', NO_SKY_BITMAP);
    // ...and a FOURTH thing, which is the one that was still painting: the background PLANE.
    // `BackgroundRenderer` draws it before any layer, from the first layer's style background — and
    // when that comes back empty it falls back to the SDK's own default bitmap, which is the block
    // pattern that showed through this mode. It reads `Options.backgroundBitmap` only to decide
    // whether the app has an opinion, so nulling it is what takes the plane off altogether.
    map.set('backgroundBitmap', null);
    // A fully transparent clear colour turns the frame into a hole, which is what the camera preview
    // behind it shows through. The terrain's own background fill has to go with it, or it paints the
    // ground opaque under the relief and the preview never appears.
    map.set('clearColor', transparent ? 0 : paper);
    terrain().set('backgroundColor', transparent ? 0 : paper);
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
 * How high the eye stands above the ground, which is the one thing a peak finder is about.
 *
 * NOT a camera position. With a terrain attached the renderer OWNS the focus height — it sits the
 * focus on the ground, as mapbox does (`transform._centerAltitude`), and recomputes it on every
 * frame and on every camera event (`MapRenderer::constrainCameraToClearance`, and the frame's own
 * `CameraClearance::focusFollow` rule). A focus position written with an altitude in it therefore
 * lasted until the next frame and no longer, which is why the elevation arrows stopped doing
 * anything: they were writing a height the renderer threw away.
 *
 * `TerrainOptions.focusLift` is the lift that survives. It is ADDED on top of whatever the
 * ground-following rule decides, so the clearance shell keeps working underneath it and the value
 * means the same thing at every zoom and tilt: this many metres above the ground the viewpoint
 * stands over. In METRES — the mercator stretch and the display scale are the SDK's business now,
 * which is why the latitude term and the DEM sampling this file used to do are gone.
 *
 * Nothing else can buy that view: at the panorama's tilt the camera looks at the horizon, so its
 * orbit is almost horizontal and zooming out moves the eye sideways rather than up.
 */
function setFocusLift(metres: number) {
    terrain()?.set('focusLift', Math.max(0, metres));
}

/** Lifts the viewpoint to `metres` above the ground under it, without moving it horizontally. */
export const applyViewpointElevation = tryCatchFunction(async (metres: number) => {
    if (!isPeakFinderActive()) {
        return;
    }
    stopLiftRamp();
    setFocusLift(metres);
});

/** The viewpoint's height above the ground, read back from the SDK rather than from our own store. */
export function currentViewpointElevation(): number {
    return terrain()?.get('focusLift') ?? 0;
}

/**
 * The fly-in's climb, as a ramp on the lift driven by the FLIGHT's own progress.
 *
 * The flight cannot carry it: `flyTo` interpolates a focus position, and its height is the one thing
 * the renderer overwrites (see `setFocusLift`) — which is what `climbHeight` was arching, so that
 * argument had no effect either. Same shape all the same: the lift rises to the viewpoint's
 * elevation over the way there, arched by `peakFinderFlyClimb` so it goes over the ridges in between
 * like a plane rather than straight to its final height.
 *
 * Sampling the camera instead of a clock of our own is `terrain3d`'s `rampWithFlight`, for its
 * reason: a dropped frame or an interrupted flight cannot leave the two out of step.
 */
function rampLiftWithFlight(target: number) {
    const mapCamera = camera();
    const progress = mapCamera?.progress() ?? -1;
    if (progress < 0) {
        setFocusLift(target);
        liftRampTimer = null;
        return;
    }
    // sin gives 0 at both ends, so the arch adds nothing to where the flight starts or lands.
    const arch = Math.sin(Math.PI * progress) * get(peakFinderFlyClimb);
    setFocusLift(target * progress + arch);
    liftRampTimer = setTimeout(() => rampLiftWithFlight(target), LIFT_RAMP_TICK_MS);
}

function stopLiftRamp() {
    if (liftRampTimer) {
        clearTimeout(liftRampTimer);
        liftRampTimer = null;
    }
}

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
    // The fly-in tilts from straight down to the panorama's, and every frame of it is clamped to the
    // map's tilt range — which is still the flat map's `[90, 90]` until something says otherwise.
    // That clamp is why the mode used to land at tilt 90 with no panorama at all.
    beginTiltTransition();

    saved = {
        layers: [...mapContext().getLayers('map'), ...mapContext().getLayers('customLayers')],
        position: camera().position(),
        zoom: camera().zoom(),
        rotation: camera().rotation(),
        tilt: camera().tilt(),
        was3D,
        viewDistanceFactor: terrain().get('viewDistanceFactor') ?? 1,
        viewDistance: terrain().get('viewDistance') ?? 0,
        viewDistanceMax: terrain().get('viewDistanceMax') ?? 0,
        meshResolution: terrain().get('meshResolution') ?? 64,
        occlusionEnabled: terrain().get('billboardOcclusionEnabled') ?? false,
        occlusionTolerance: terrain().get('billboardOcclusionTolerance') ?? 0.02,
        maxTileZoomCoarsening: terrain().get('maxTileZoomCoarsening') ?? 8,
        labelViewDistance: map.get('labelViewDistance') ?? 5,
        drapeFills: terrain().get('drapeFillsEnabled') ?? true,
        drapeLines: terrain().get('drapeLinesEnabled') ?? true,
        // `child` hands the bitmap over as an object WE own, which is what keeps it alive while the
        // option below is null — and the only way to get it back, since an object property cannot be
        // read with `get`.
        backgroundBitmap: map.child('backgroundBitmap'),
        skyEnabled: map.sky().get('enabled') ?? false,
        mapSkyColor: map.get('skyColor'),
        clearColor: map.get('clearColor')
    };

    // 3D first, and without an animation of its own: the single flight below carries the whole move,
    // and a second animated switch underneath it would fight that.
    setTerrain3DImmediate(true);

    // The surface only shows where no tile layer paints, so the map layers have to stop painting.
    //
    // HIDDEN, not removed. A hidden layer costs the same as a removed one while the mode is up —
    // `TileLayer::calculateVisibleTiles` returns immediately on `!isVisible()`, so nothing is culled,
    // fetched or decoded — but it KEEPS its decoded tiles. Removing them threw those away, and the
    // map then had to decode the whole screen again on the way out, which is the wait on exit.
    saved.layers.forEach((added) => added.layer.set('visible', false));

    // Labels, however far away they are. The culler drops any label past `labelViewDistance`
    // multiples of the camera-to-focus distance (maplibre's own rule, 5) — and in a panorama the
    // focus sits a couple of kilometres in front of a low camera, so that cut lands around ten and
    // took every summit on the horizon with it. Mont Blanc from Grenoble is 108 km out.
    // 0 = no limit, leaving `text-max-distance` (peakFinderLabelMaxDistance) the only bound.
    map.set('labelViewDistance', 0);

    terrain().apply({
        // A summit sitting ON a ridge, or a metre behind it, is exactly what this view is for, so the
        // label occlusion is deliberately generous here.
        billboardOcclusionEnabled: true,
        billboardOcclusionTolerance: get(peakFinderOcclusion),
        // A panorama wants the far ranges: tangram's rule stops the ground a few kilometres out, which
        // is most of what the view is about.
        viewDistanceFactor: get(peakFinderViewDistance),
        // ...and the factor alone cannot reach them, because that rule shrinks as the viewpoint comes
        // down towards the ground. The metres are what puts Mont Blanc on the horizon from Grenoble.
        viewDistance: get(peakFinderViewDistanceMetres),
        // Whatever ceiling the 3D map is run with, it is not this mode's: a ceiling is a trade against
        // how far the view reaches, and reaching is what a panorama IS.
        viewDistanceMax: 0,
        // No DRAPE. Hiding the layers stops them drawing, but the terrain's drape is baked from them
        // and painted onto the surface by the terrain itself — which is why the roads and the
        // contours came back when the mode stopped removing the layers outright. With draping off
        // the surface shader is the only thing painting the ground, and the layers keep their
        // decoded tiles for the way out.
        drapeFillsEnabled: false,
        drapeLinesEnabled: false,
        // A finer mesh than the live map runs: the outline effect draws the skyline off the terrain
        // depth, so the mesh IS the ridge line here.
        meshResolution: get(peakFinderMeshResolution),
        // How coarse a FAR tile is allowed to get, and here it is a DATA limit rather than a
        // performance one. The live map lets a distant tile fall to `cameraTileZoom - 8`, which in a
        // panorama is z5 or z6 — and the package carries `mountain_peak` from z6 only, with just the
        // famous summits at that zoom. So past the distance where the cut reached z5 there were no
        // peak features at all to label, whatever the culler did. Four levels keeps the far ground on
        // tiles that still carry summits, and it costs almost nothing here because the peaks layer is
        // the only visible one in this mode.
        maxTileZoomCoarsening: PEAKS_MAX_TILE_ZOOM_COARSENING
    });

    peakFinderActive.set(true);
    peakFinderSelectedPeak.set(null);
    applyReliefSurface();
    applyReliefOutline();
    applyAtmosphere();
    buildPeaksLayer();
    lockOrientation(get(peakFinderScreenOrientation));
    // The 3D mode may have left its own touch model on (it is a setting), and the flight below wants
    // the plain one — see `setFreeRoamMode`, which puts first person on once the flight has landed.
    setFreeRoamMode('FREE_ROAM_MODE_OFF');

    // The flight, and the viewpoint's climb ON it. The position carries no height: the eye's height
    // above the ground is the terrain's `focusLift` now, and the ramp raises it over the flight —
    // see `rampLiftWithFlight` for why the flight itself cannot carry it.
    const elevation = get(peakFinderFlyElevation);
    viewpoint = position;
    peakFinderElevation.set(elevation);
    setFocusLift(0);
    const duration = get(peakFinderFlyDuration) * 1000;
    camera().moveTo(toPosition(position), {
        zoom: get(peakFinderFlyZoom),
        rotation: camera().rotation(),
        tilt: get(peakFinderTilt),
        duration
    });
    rampLiftWithFlight(elevation);
    endTransitionAfter(duration, () => setFreeRoamMode('FREE_ROAM_MODE_FIRST_PERSON'));
});

/** The open tilt range lasts exactly as long as the flight it was opened for. */
function endTransitionAfter(durationMs: number, onLanded?: () => void) {
    if (transitionTimer) {
        clearTimeout(transitionTimer);
    }
    transitionTimer = setTimeout(() => {
        transitionTimer = null;
        endTiltTransition();
        onLanded?.();
    }, durationMs);
}

/**
 * The panorama's touch model.
 *
 * FIRST PERSON is what standing on a summit and turning your head is: a one-finger drag turns the view
 * about the CAMERA on both axes and the position never changes, and a two-finger drag walks forward or
 * strafes. The map's own model — dragging the ground under a camera that orbits its focus point — is
 * the wrong one here: at the panorama's tilt one finger sends the focus kilometres away.
 *
 * Turned on only once the fly-in has LANDED. In first person the camera model applies to every source,
 * not just to touch: `setTilt` and `setMapRotation` turn the view in place too, so the flight's own
 * tilt would spin the view where it stands instead of raising the panorama.
 */
function setFreeRoamMode(mode: FreeRoamMode | number) {
    mapContext().getMap()?.set('freeRoamMode', mode);
}

/**
 * Leaves the mode and puts back everything `enterPeakFinder` changed.
 */
export const exitPeakFinder = tryCatchFunction(async () => {
    if (!isPeakFinderActive() || !saved) {
        return;
    }
    const map = mapContext().getMap();
    stopOrientationFollowing();
    // Before the fly-out, for the same reason it was turned on only after the fly-in: in first person
    // the flight's tilt turns the view in place rather than moving the camera. What the map is left
    // with afterwards is the 3D mode's business, and `refreshTouchMode` below asks it once we land.
    setFreeRoamMode('FREE_ROAM_MODE_OFF');
    // Opened before the stores flip: without it the range narrows back to the flat map's the moment
    // `peakFinderActive` goes false, and the fly-out snaps to tilt 90 instead of animating there.
    beginTiltTransition();
    // Before the store, so the surface stops being a hole while the preview is still behind it —
    // the other way round leaves one frame of transparent map over nothing.
    setMapTranslucent(false);
    peakFinderArActive.set(false);
    peakFinderActive.set(false);
    peakFinderSelectedPeak.set(null);

    clearReliefOutline();
    clearReliefSurface();
    destroyPeaksLayer();

    // The lift belongs to this mode alone: left standing, the 3D map underneath would keep the eye
    // hundreds of metres off the ground it is meant to sit on.
    stopLiftRamp();
    terrain()?.apply({
        focusLift: 0,
        billboardOcclusionEnabled: saved.occlusionEnabled,
        billboardOcclusionTolerance: saved.occlusionTolerance,
        viewDistanceFactor: saved.viewDistanceFactor,
        viewDistance: saved.viewDistance,
        viewDistanceMax: saved.viewDistanceMax,
        drapeFillsEnabled: saved.drapeFills,
        drapeLinesEnabled: saved.drapeLines,
        maxTileZoomCoarsening: saved.maxTileZoomCoarsening,
        meshResolution: saved.meshResolution
    });
    // The layers come back before the camera moves, so the map is not empty during the flight out.
    // They were only hidden, so the tiles they had decoded on the way in are still theirs.
    saved.layers.forEach((added) => added.layer.set('visible', true));

    // Back to the ground, and to a top-down camera unless 3D was already on when we came in. Half the
    // fly-in's duration: coming back is not the part worth watching.
    if (!saved.was3D) {
        setTerrain3DImmediate(false);
    }
    // Back to the camera the mode was ENTERED from, not to wherever the panorama ended up. The mode
    // moves the viewpoint — the fly-in alone lands a kilometre or more from the item, and the fly-to
    // and the elevation arrows go on moving it — so leaving with only the tilt put back left the map
    // somewhere the user never navigated to.
    const target: Position = saved.was3D ? saved.position : [saved.position[0], saved.position[1]];
    const duration = get(peakFinderFlyDuration) * 500;
    camera()
        .animate(duration)
        .moveTo(target, {
            zoom: saved.zoom,
            rotation: saved.rotation,
            tilt: saved.was3D ? saved.tilt : TILT_2D
        });
    // Held in locals: `saved` is cleared below, while the callback runs a flight later.
    const { backgroundBitmap, clearColor, labelViewDistance, mapSkyColor, skyEnabled } = saved;
    endTransitionAfter(duration, () => {
        // The atmosphere comes down only once the flight has landed, as the 2D/3D switch does it
        // (`terrain3d.toggle3D`): the fly-out still has a horizon in it, and a sky taken away while
        // the camera is tilted leaves the band above it showing the clear colour — black.
        // These are the colours the map had BEFORE 3D was switched on, so if 3D is still up
        // underneath — the mode was entered from it — its own atmosphere has to be asserted again.
        map?.set('labelViewDistance', labelViewDistance);
        map?.sky().set('enabled', skyEnabled);
        map?.set('skyColor', mapSkyColor);
        map?.set('clearColor', clearColor);
        // The background plane comes back with them — and our own reference to the bitmap is released
        // only AFTER the option holds it again, or the last owner would be gone mid-assignment.
        map?.set('backgroundBitmap', backgroundBitmap?.handle ?? null);
        backgroundBitmap?.destroy();
        refreshAtmosphere();
        refreshTouchMode();
        refreshViewDistance();
    });

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

/**
 * Moves the viewpoint TO the selected summit, keeping the panorama's camera.
 *
 * `moveTo` takes the FOCUS, and at a panorama's tilt the focus is kilometres in front of the camera —
 * so flying the focus to the summit parked the eye short of it, looking at it from the side. That is
 * right for a map and wrong for a peak finder: standing ON the summit is the point.
 *
 * The offset is measured rather than derived from the tilt and the zoom: `eyePosition()` is where the
 * camera actually is, so the focus target is the summit plus the focus-to-eye vector, and the view
 * keeps the heading and tilt it had. Lon/lat arithmetic is fine over the few kilometres involved.
 *
 * The elevation is not touched: `focusLift` is a height above the ground UNDER the viewpoint, so it
 * follows the move on its own and the eye arrives the same distance over the summit as it stood over
 * where it came from.
 */
export const flyToSelectedPeak = tryCatchFunction(async () => {
    const peak = get(peakFinderSelectedPeak);
    if (!peak) {
        return;
    }
    viewpoint = peak.position;
    const mapCamera = camera();
    const summit = toPosition(peak.position);
    const focus = mapCamera.position();
    const eye = mapCamera.eyePosition();
    const target: Position = [summit[0] + (focus[0] - eye[0]), summit[1] + (focus[1] - eye[1])];
    mapCamera.moveTo(target, {
        zoom: get(peakFinderFlyZoom),
        tilt: get(peakFinderTilt),
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
        // The sensors go with it. AR is the only thing that needs the ROTATION sensor, and if AR is
        // also what switched the compass on then the magnetometer was AR's too — leaving either
        // running kept the device polled and the view moving after the mode was off.
        if (arStartedFollowing) {
            arStartedFollowing = false;
            stopOrientationFollowing();
        } else {
            await setOrientationTilt(false);
        }
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
    arStartedFollowing = !get(peakFinderHeadingFollowing);
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
applyLive(peakFinderCreaseThreshold, applyReliefOutline);
applyLive(peakFinderCreaseFade, applyReliefOutline);
applyLive(peakFinderSlopeStrength, applyReliefOutline);
applyLive(peakFinderSlopeMultiplier, applyReliefOutline);
applyLive(peakFinderSlopeBias, applyReliefOutline);
applyLive(peakFinderDistanceFade, applyReliefOutline);
applyLive(peakFinderHaze, () => {
    applyReliefSurface();
    applyReliefOutline();
});
applyLive(peakFinderOcclusion, () => terrain().set('billboardOcclusionTolerance', get(peakFinderOcclusion)));
applyLive(peakFinderViewDistance, () => terrain().set('viewDistanceFactor', get(peakFinderViewDistance)));
applyLive(peakFinderViewDistanceMetres, () => terrain().set('viewDistance', get(peakFinderViewDistanceMetres)));
applyLive(peakFinderMeshResolution, () => terrain().set('meshResolution', get(peakFinderMeshResolution)));
applyLive(peakFinderTilt, () => camera().animate(400).tilt(get(peakFinderTilt)));
applyLive(peakFinderLabelPinTop, rebuildPeaksLayer);
applyLive(peakFinderLabelBand, rebuildPeaksLayer);
applyLive(peakFinderLabelAngle, rebuildPeaksLayer);
applyLive(peakFinderLabelRows, rebuildPeaksLayer);
applyLive(peakFinderLabelMinDistance, rebuildPeaksLayer);
applyLive(peakFinderLabelMaxDistance, rebuildPeaksLayer);
// Changed from the settings sheet while the panorama is up: turn now rather than on the next entry.
applyLive(peakFinderScreenOrientation, () => lockOrientation(get(peakFinderScreenOrientation)));
// AR turns the sky and the clear colour into a hole for the camera preview to show through, and takes
// over the tilt as well as the rotation — a panorama held up at the sky has to be able to look up.
applyLive(peakFinderArActive, () => {
    // EVERYTHING the look is made of, not the atmosphere alone: AR is a hole in the frame, and what
    // paints over a hole is the terrain's surface shader (`applyReliefSurface` clears it in AR) and
    // the effect's own alpha (`uTransparent`). The summit labels go with them, because AR forces the
    // light-ink palette and their colours are style TEXT — see `palette` and `rebuildPeaksLayer`.
    applyPalette();
    setOrientationTilt(get(peakFinderArActive)).catch((error) => showError(error));
});

/**
 * A tap on empty ground clears the chip, the way tapping the map elsewhere deselects.
 *
 * CONSUMED, so the map's own handler does not run. The only selection this mode has is a summit
 * label, and that arrives through the peaks layer's feature click — a bare tap on the panorama would
 * otherwise put the item sheet up behind chrome that is hidden, over a map with no layers on it.
 */
function onMapClicked() {
    if (!isPeakFinderActive()) {
        return false;
    }
    peakFinderSelectedPeak.set(null);
    return true;
}

function onMapDestroyed() {
    stopOrientationFollowing();
    destroyPeaksLayer();
    if (transitionTimer) {
        clearTimeout(transitionTimer);
        transitionTimer = null;
    }
    stopLiftRamp();
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
