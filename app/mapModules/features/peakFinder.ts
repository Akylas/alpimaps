import * as api from '@nativescript-community/ui-massifmaps/api';
import type { MassifLayer, MassifMap, MassifSource, Position } from '@nativescript-community/ui-massifmaps/api';
import type { MassifMap as MassifMapView } from '@nativescript-community/ui-massifmaps/ui';
import { showBottomSheet } from '@nativescript-community/ui-material-bottomsheet/svelte';
import { Color } from '@nativescript/core';
import { showError } from '@shared/utils/showError';
import { showToast, tryCatchFunction } from '@shared/utils/ui';
import { get } from 'svelte/store';
import { lc } from '~/helpers/locale';
import { type FeatureClickData, featureClickData, getMapContext } from '~/mapModules/MapModule';
import { registerMapFeature } from '~/mapModules/mapFeatures';
import { registerMapModule } from '~/mapModules/registry';
import { RELIEF_DEFAULTS, RELIEF_OUTLINE_SHADER, RELIEF_SURFACE_SHADER, reliefPalette } from '~/mapModules/terrain/reliefShaders';
import { peaksStyle } from '~/mapModules/terrain/peaksStyle';
import type { IItem } from '~/models/Item';
import { packageService } from '~/services/PackageService';
import { nutiProps } from '~/stores/mapStore';
import {
    PANORAMA_RANGE,
    peakFinderActive,
    peakFinderArActive,
    peakFinderCreaseFade,
    peakFinderCreaseStrength,
    peakFinderCreaseThreshold,
    peakFinderDark,
    peakFinderDistanceFade,
    peakFinderElevation,
    peakFinderEnabled,
    peakFinderFlyElevation,
    peakFinderFlyZoom,
    peakFinderHaze,
    peakFinderHeading,
    peakFinderHeadingFollowing,
    peakFinderHorizonBoost,
    peakFinderLabelAngle,
    peakFinderLabelBand,
    peakFinderLabelMaxDistance,
    peakFinderLabelMinDistance,
    peakFinderLabelPinTop,
    peakFinderLabelRows,
    peakFinderLensCorrection,
    peakFinderMaxFieldOfView,
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
    peakFinderViewDistanceMetres,
    terrainCameraClearance,
    terrainExaggeration
} from '~/stores/terrainStore';
import { type CameraFieldOfView, type CameraPreviewInfo, type LensDistortion, type PreviewGeometrySource, cameraFieldOfView } from '~/utils/cameraFov';
import { type MapPos, bearingBetween, computeDistanceBetween, toPosition } from '~/utils/geo';
import { lockOrientation } from '~/utils/orientation';

/**
 * The peak finder, on a MAP OF ITS OWN.
 *
 * It used to be a mode of the live map: the layers were hidden, the camera flown to the viewpoint, the
 * atmosphere and the terrain rewritten, and every one of those changes undone again on the way out. It
 * worked, but it meant the panorama paid for everything the live map is — its layers' decoded tiles,
 * its drape, its label sets — and the way out was a long list of things to put back, each of which was
 * a bug waiting to happen. It also MOVED the map: the user came back to wherever the panorama had
 * wandered to rather than where they left.
 *
 * So the panorama is now a second `massifmap`, mounted over the live one while the mode is up and
 * destroyed with it (`components/peaks/PeakFinderMap.svelte`). What that buys:
 *
 *  - the live map is not touched at all — not its camera, not its layers, not its atmosphere. It is
 *    also not DRAWN: the SDK renders when dirty, so an idle map under an opaque one costs nothing.
 *  - the panorama starts from nothing rather than from a map: one vector layer for the summit names
 *    and the terrain, no base map, no drape, no sky.
 *  - there is nothing to restore, so there is no exit path to get wrong. The map is destroyed, and
 *    every id it built goes with it.
 *  - no animation anywhere: the camera is placed where it belongs before the first frame is drawn.
 *
 * What it does NOT re-fetch is the point of the design: the DEM and the vector tiles are the SAME
 * data sources the live map is drawing, handed over by handle, so the tiles already in their caches
 * are the tiles the panorama meshes and labels from.
 *
 * The look is unchanged — the relief surface shader, the ridge-line post-process effect and the
 * callout summit labels are the android demo's, see `terrain/reliefShaders.ts` and `terrain/peaksStyle.ts`.
 */

/** The registry id the panorama's map takes. Two maps in one app must not share the `map` one. */
export const PANORAMA_MAP_ID = 'map.peakFinder';
const PEAKS_LAYER_ID = 'layer.peaks';
const PEAKS_DECODER_ID = 'decoder.peaks';
const EFFECT_ID = 'relief_outline';
/** A transparent sky colour is how the legacy sky BITMAP is turned off — see `applyAtmosphere`. */
const NO_SKY_BITMAP = 0;
/**
 * How many zoom levels below the camera a far tile may coarsen to.
 *
 * A DATA limit rather than a performance one. The live map lets a distant tile fall to
 * `cameraTileZoom - 8`, which in a panorama is z5 or z6 — and the package carries `mountain_peak`
 * from z6 only, with just the famous summits at that zoom. Past the distance where the cut reached z5
 * there were no peak features left to label, whatever the culler did.
 */
const PEAKS_MAX_TILE_ZOOM_COARSENING = 4;

/** The panorama's own map, from the moment its view is ready until the mode is left. */
let panorama: MassifMap = null;
/** Its view, for the two things the surface API has no verb for: the effect and the surface shader. */
let panoramaView: MassifMapView = null;
/** The live map's sources, held by handle while the panorama draws from them. */
let demSource: MassifSource = null;
let peaksSource: MassifSource = null;
let peaksLayer: MassifLayer = null;
let peaksDecoder: api.MassifObject<'massif::MBVectorTileDecoder'> = null;
/** Bumped per rebuild, so a new layer/decoder pair never collides with the one still on the map. */
let peaksGeneration = 0;
let effect = null;
/** Where the panorama is looking FROM, in lon/lat — what distances are measured against. */
let viewpoint: MapPos = null;
/** The bearing the panorama opens on, taken from the live map so the view starts as the map looked. */
let initialRotation = 0;
/** Whether AR is what started the orientation sensors, so turning it off knows to stop them. */
let arStartedFollowing = false;
/**
 * The AR camera preview, while it is up.
 *
 * Held because the preview's GEOMETRY — the stream's resolution, the quarter turns, how it is fitted
 * into the view and the live zoom — is session state that only the view owning the session can
 * report. The lens's own field of view and distortion come from the device instead, and need no view
 * at all (`~/utils/cameraFov`). The preview lives in `Map.svelte`, one level above the panorama, so
 * it is handed over rather than looked up.
 */
let arPreview: PreviewGeometrySource = null;

function terrain() {
    return panorama?.terrain();
}

function camera() {
    return panorama?.camera();
}

/** The SDK's own vertical field of view, which is the widest this mode ever asks for. */
const DEFAULT_FIELD_OF_VIEW_Y = 70;

/** Degrees ↔ radians, for the field-of-view arithmetic below. */
const TO_RADIANS = Math.PI / 180;
const TO_DEGREES = 180 / Math.PI;

/**
 * The vertical field of view the panorama should draw at, degrees.
 *
 * The SDK only takes the VERTICAL one and derives the horizontal from the viewport
 * (`_tanHalfFOVX = aspect * _tanHalfFOVY`, `ViewState.cpp`), so every horizontal figure here has to
 * be converted: a horizontal half-angle H over an aspect A is a vertical half-angle
 * `atan(tan(H) / A)`.
 *
 * In AR that horizontal figure is the CAMERA's, and it is not a preference — see `arGeometry`.
 * Outside AR it is `peakFinderMaxFieldOfView`, or the camera's own field when that is 0, applied as
 * a ceiling: `min` with the SDK default, so it can only ever narrow the view.
 */
function fieldOfViewY(viewAspect: number): number {
    const matched = arGeometry(viewAspect);
    if (matched) {
        return 2 * Math.atan(matched.renderTan[1]) * TO_DEGREES;
    }
    const preference = get(peakFinderMaxFieldOfView);
    const horizontal = preference > 0 ? Math.max(10, Math.min(170, preference)) : cameraHorizontalField();
    const halfHorizontal = (horizontal / 2) * TO_RADIANS;
    return Math.min(DEFAULT_FIELD_OF_VIEW_Y, 2 * Math.atan(Math.tan(halfHorizontal) / viewAspect) * TO_DEGREES);
}

/** Memoised: reading it enumerates the device's cameras, and a lens does not change. */
let cameraLens: CameraFieldOfView | null | undefined;

/**
 * The back camera's horizontal field, degrees — what the panorama draws at by default.
 *
 * A peak finder is read against the view it is held up to, so the picture should be the size that
 * view is. Falls back to the SDK default's horizontal equivalent where there is no camera to ask.
 */
function cameraHorizontalField(): number {
    if (cameraLens === undefined) {
        cameraLens = cameraFieldOfView();
    }
    return cameraLens?.horizontal > 0 ? cameraLens.horizontal : DEFAULT_FIELD_OF_VIEW_Y;
}

/**
 * What the AR preview is doing with the lens, or null when there is no preview to ask.
 *
 * Everything here is a decision the platform makes when it opens the session — which resolution it
 * picked for the stream, which way round it is, how it is fitted into the view, where the zoom sits —
 * so it is reported rather than computed. Before the plugin exposed it this was assumed: the sensor
 * array's aspect stood in for the stream's, and the zoom was pinned off so that 1 was safe to assume.
 */
function arPreviewInfo(): CameraPreviewInfo | null {
    // Optional on purpose. `getPreviewInfo` is newer than the ui-cameraview release this app resolves,
    // so where it is missing the mode falls back to what it did before: the sensor array's aspect
    // stands in for the stream's, and the zoom is 1 because the preview pins pinch zoom off. Both are
    // right on a phone; see `arGeometry`.
    if (typeof arPreview?.getPreviewInfo !== 'function') {
        return null;
    }
    try {
        return arPreview.getPreviewInfo();
    } catch (error) {
        DEV_LOG && console.log('peakFinder: no preview geometry', error);
        return null;
    }
}

/** What the camera asks the panorama to draw, for a view of this shape. */
interface ArGeometry {
    /** Half-field tangents of what the preview SHOWS, (horizontal, vertical), in view orientation. */
    screenTan: [number, number];
    /** ...and of what has to be RENDERED so the lens warp has something to read at the corners. */
    renderTan: [number, number];
    /** Whether the view is a quarter turn from the camera's landscape frame. */
    rotated: boolean;
    distortion: LensDistortion | null;
}

/**
 * Brown-Conrady, ideal to distorted, exactly as the shader's loop inverts it.
 *
 * The one place the model is written in TypeScript: the render's field is chosen by UNDISTORTING the
 * screen's corner, which needs the same arithmetic the fragment shader runs, and two copies of a
 * distortion model that disagree is a warp that does not cancel.
 */
function undistort(point: [number, number], distortion: LensDistortion): [number, number] {
    const target: [number, number] = [point[0] - distortion.centerX, point[1] - distortion.centerY];
    let ideal: [number, number] = [target[0], target[1]];
    for (let iteration = 0; iteration < 3; iteration++) {
        const radiusSquared = ideal[0] * ideal[0] + ideal[1] * ideal[1];
        const radial = 1 + radiusSquared * (distortion.k1 + radiusSquared * (distortion.k2 + radiusSquared * distortion.k3));
        const tangentialX = 2 * distortion.p1 * ideal[0] * ideal[1] + distortion.p2 * (radiusSquared + 2 * ideal[0] * ideal[0]);
        const tangentialY = distortion.p1 * (radiusSquared + 2 * ideal[1] * ideal[1]) + 2 * distortion.p2 * ideal[0] * ideal[1];
        ideal = [(target[0] - tangentialX) / Math.max(radial, 0.1), (target[1] - tangentialY) / Math.max(radial, 0.1)];
    }
    return [ideal[0] + distortion.centerX, ideal[1] + distortion.centerY];
}

/**
 * The field of view that makes a summit the same size on the terrain as in the camera preview.
 *
 * Matching the camera is NOT "use the camera's field of view": what has to match is the field of the
 * picture actually VISIBLE ON SCREEN, and the preview frame is transformed twice before it gets
 * there.
 *
 *  1. It is ROTATED into the view's orientation, by the quarter turns the platform reports.
 *  2. It is SCALED to cover the view (or to fit inside it) and whatever overflows is cropped,
 *     symmetrically about the optical axis.
 *
 * The visible fraction of the frame per axis is `view / (frame * s)` where `s` is the fit scale —
 * `max` of the two ratios for a cover fit, `min` for a contain fit. Both preserve the aspect, so one
 * axis comes out at exactly 1 and the other is the crop. Multiply the frame's half-field tangent by
 * that fraction and the vertical field is settled; the SDK derives the horizontal from the view's
 * aspect, which is consistent because a rectilinear frame satisfies
 * `tan(hfov/2)/tan(vfov/2) = aspect` and a centre crop to the view's shape makes that ratio the
 * VIEW's aspect. So one number matches both axes.
 *
 * NONE of that is assumed: the stream's own resolution, the quarter turns, the fit and the live zoom
 * all come from `CameraView.getPreviewInfo()`, because they are decisions the platform makes at
 * session time and an application cannot compute them. Only the LENS — the field of view and the
 * distortion — is read from the device characteristics.
 *
 * Then the lens itself. A photograph is not a rectilinear projection and the render is: the camera's
 * barrel distortion is several percent at the frame corners, far more than anything else left in the
 * match. It is corrected by warping the render (`distortUv` in `reliefShaders.ts`), and that only
 * works if the render covers MORE than the screen — barrel pulls the periphery inwards, so the ideal
 * direction for a screen corner lies outside the screen's own field, and a render stopping at the
 * screen's field would have nothing there to read. Hence two fields: what the screen shows, and the
 * wider one actually rendered, scaled by exactly the corners' undistortion.
 *
 * Deliberately NOT capped by `peakFinderMaxFieldOfView`: in AR the field is a measurement, and
 * narrowing it is precisely the mismatch this exists to remove.
 */
function arGeometry(viewAspect: number): ArGeometry | null {
    if (!get(peakFinderArActive)) {
        return null;
    }
    const lens = cameraFieldOfView();
    if (!lens) {
        return null;
    }
    const preview = arPreviewInfo();
    // The lens's field is the UNZOOMED one; a zoom of Z narrows the tangent by Z.
    const zoom = preview?.zoomRatio > 0 ? preview.zoomRatio : 1;
    const tanHalfWide = Math.tan((lens.horizontal / 2) * TO_RADIANS) / zoom;
    // The stream's aspect, not the sensor array's: a 16:9 preview is a vertical crop of a 4:3 sensor,
    // keeping its width, so the same horizontal field over a taller aspect.
    const frameAspect = preview && preview.width > 0 && preview.height > 0 ? Math.max(preview.width, preview.height) / Math.min(preview.width, preview.height) : lens.aspect;
    const tanHalfNarrow = tanHalfWide / frameAspect;
    // The turns the platform says it applies, rather than guessed from the view being portrait.
    const rotated = preview ? preview.rotation === 90 || preview.rotation === 270 : viewAspect < 1;
    const streamTan: [number, number] = rotated ? [tanHalfNarrow, tanHalfWide] : [tanHalfWide, tanHalfNarrow];
    const streamAspect = streamTan[0] / streamTan[1];
    // Cover or contain. Both keep the aspect, so this one expression covers the two: `fit` leaves the
    // whole stream on screen with the view seeing PAST it, which is a fraction above 1 — and drawing
    // terrain where the preview shows letterbox is right, not a bug to guard.
    const covers = !preview || (preview.stretch !== 'aspectFit' && preview.stretch !== 'fitCenter' && preview.stretch !== 'fitStart' && preview.stretch !== 'fitEnd');
    const fitScale = covers ? Math.max(viewAspect / streamAspect, 1) : Math.min(viewAspect / streamAspect, 1);
    const screenTan: [number, number] = [(streamTan[0] * viewAspect) / (streamAspect * fitScale), streamTan[1] / fitScale];

    const distortion = get(peakFinderLensCorrection) ? lens.distortion : null;
    if (!distortion) {
        return { screenTan, renderTan: screenTan, rotated, distortion: null };
    }
    // A corner is the largest radius on screen, so undistorting one is what bounds the surplus the
    // render needs — and ALL FOUR of them, because the principal point is not exactly the frame's
    // centre and the distortion is measured about the principal point, so the four are not the same
    // distance out. Never below 1: a pincushion lens asks for a narrower render than the screen, and
    // there the screen's own field is already enough.
    let scale = 1;
    for (const signX of [-1, 1]) {
        for (const signY of [-1, 1]) {
            const cornerView: [number, number] = [signX * screenTan[0], signY * screenTan[1]];
            const ideal = undistort(rotated ? [cornerView[1], -cornerView[0]] : cornerView, distortion);
            const idealView: [number, number] = rotated ? [-ideal[1], ideal[0]] : ideal;
            scale = Math.max(scale, Math.abs(idealView[0]) / screenTan[0], Math.abs(idealView[1]) / screenTan[1]);
        }
    }
    // ...and a hair more, so the outermost pixel reads inside the render rather than off its clamped
    // edge. Half a percent of field costs nothing and the inverse above is itself only accurate to
    // about that.
    scale *= 1.005;
    return { screenTan, renderTan: [screenTan[0] * scale, screenTan[1] * scale], rotated, distortion };
}

/**
 * Writes the field of view for the view's current shape.
 *
 * Re-applied on every layout: a rotation changes the aspect and nothing else, and the aspect is the
 * whole of what both rules above depend on.
 *
 * Written UNROUNDED. `Options::setFieldOfViewY` takes a float — it used to be an int, which at the
 * narrow vertical field a landscape AR view asks for quantised the tangent by about 3% a degree, so
 * half a degree of rounding was ~1.6% of scale, or some twenty pixels at the frame edge.
 */
function applyFieldOfView() {
    if (!panorama || !panoramaView) {
        return;
    }
    const width = panoramaView.getMeasuredWidth();
    const height = panoramaView.getMeasuredHeight();
    if (!(width > 0) || !(height > 0)) {
        return;
    }
    panorama.set('fieldOfViewY', currentFieldOfViewY());
    // ...and put the camera back where it was. See `zoomForFieldOfView`.
    panoramaView.setZoom(effectiveZoom(), 0);
    applyLensCorrection();
}

/** The field of view the view's current shape asks for, or the SDK's own before it has been measured. */
function currentFieldOfViewY(): number {
    const width = panoramaView?.getMeasuredWidth() ?? 0;
    const height = panoramaView?.getMeasuredHeight() ?? 0;
    if (!(width > 0) || !(height > 0)) {
        return DEFAULT_FIELD_OF_VIEW_Y;
    }
    return Math.max(10, fieldOfViewY(width / height));
}

/**
 * The zoom to place the camera with — `peakFinderFlyZoom`, corrected for the field of view in force.
 *
 * Every camera write in this mode goes through it, so the viewpoint stands in the same place whatever
 * the field of view is. See `zoomForFieldOfView`.
 */
function effectiveZoom(): number {
    return zoomForFieldOfView(currentFieldOfViewY());
}

/**
 * The zoom that keeps the CAMERA where it would be at the SDK's own field of view.
 *
 * The two are coupled, and not obviously: `ZoomConvention::zoom0Distance` is
 * `screenHeight/2 · worldSize / (tilePixels · tan(fovY/2))`, and the camera sits at
 * `zoom0Distance / 2^zoom`. So tan(fovY/2) divides it — narrow the field and the camera moves FURTHER
 * at the same zoom, by the same ratio.
 *
 * That is not what a field-of-view cap is for. Moving the camera changes the camera-to-focus distance,
 * which is tangram's view-distance rule (how far the ground is drawn), the tile LOD's reference, and
 * the denominator a callout label's size is cancelled by — so capping the field quietly changed how
 * far the panorama reaches and how big its summit names are. Adding `log2` of the ratio to the zoom
 * cancels it exactly, leaving the cap as what it claims to be: a crop.
 */
function zoomForFieldOfView(fovY: number): number {
    const base = get(peakFinderFlyZoom);
    const tanDefault = Math.tan((DEFAULT_FIELD_OF_VIEW_Y / 2) * TO_RADIANS);
    const tanActual = Math.tan((fovY / 2) * TO_RADIANS);
    if (!(tanActual > 0) || !(tanDefault > 0)) {
        return base;
    }
    return base + Math.log2(tanDefault / tanActual);
}

/**
 * Hands the lens warp its numbers — the two fields and the coefficients (`distortUv` in
 * `reliefShaders.ts`).
 *
 * Always writes all of them, zeroes included: an effect keeps the parameters it was last given, so a
 * frame that stops being AR has to say so or it keeps warping.
 *
 * Applied alongside the field of view, because the two are one decision: the render is deliberately
 * WIDER than the screen and the warp is what brings it back, so a field written without matching
 * coefficients — or the reverse — is a picture at the wrong scale, not merely an uncorrected one.
 */
function applyLensCorrection() {
    if (!effect) {
        return;
    }
    const width = panoramaView?.getMeasuredWidth() ?? 0;
    const height = panoramaView?.getMeasuredHeight() ?? 0;
    const geometry = width > 0 && height > 0 ? arGeometry(width / height) : null;
    const distortion = geometry?.distortion;
    effect.setFloatParameter('uDistortK1', distortion?.k1 ?? 0);
    effect.setFloatParameter('uDistortK2', distortion?.k2 ?? 0);
    effect.setFloatParameter('uDistortK3', distortion?.k3 ?? 0);
    effect.setFloatParameter('uDistortP1', distortion?.p1 ?? 0);
    effect.setFloatParameter('uDistortP2', distortion?.p2 ?? 0);
    effect.setFloatParameter('uDistortCenterX', distortion?.centerX ?? 0);
    effect.setFloatParameter('uDistortCenterY', distortion?.centerY ?? 0);
    // 1 rather than 0 when there is no warp: these are divisors, and the shader's early return means
    // they are never read in that case anyway.
    effect.setFloatParameter('uDistortScreenTanX', geometry?.screenTan[0] ?? 1);
    effect.setFloatParameter('uDistortScreenTanY', geometry?.screenTan[1] ?? 1);
    effect.setFloatParameter('uDistortRenderTanX', geometry?.renderTan[0] ?? 1);
    effect.setFloatParameter('uDistortRenderTanY', geometry?.renderTan[1] ?? 1);
    effect.setFloatParameter('uDistortRotate', geometry?.rotated ? 1 : 0);
}

/**
 * AR always takes the LIGHT-INK palette, whatever the switch says.
 *
 * With the camera behind it the only thing this mode draws is ink, and the light palette's ink is
 * nearly black (#14141a) — which over a photograph of a mountain is the one colour that cannot be
 * seen. The dark palette's is nearly white, and on e-ink `einkDark` is pure white, so the pair that
 * reads over a preview is the same pair either way.
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

// --- the data the live map already has ---------------------------------------------------------

/**
 * The DEM the live map is shading with, as a source the panorama can mesh from.
 *
 * `CustomLayersModule` already resolved which DEM holds the hillshade slot and set its
 * `metaData.dem_encoding`, so the elevation decoder resolves itself. Sharing the SOURCE rather than
 * opening the file again is what makes the panorama's terrain appear at once: the tiles the live map
 * has read are already in that source's caches.
 */
function findDemSource(): MassifSource {
    return packageService.hillshadeLayer?.source() ?? null;
}

/**
 * A vector source with the app's own tiles in it, for the summit names.
 *
 * The offline package first, because that is what the mode is for; otherwise the first vector layer
 * the user has switched on. Shared with the live map for the same reason the DEM is.
 */
function findPeaksSource(): MassifSource {
    const local = packageService.localVectorTileLayer;
    if (local?.valid) {
        return local.source();
    }
    let found: MassifSource = null;
    getMapContext()
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

// --- the summit label layer -------------------------------------------------------------------

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
 * spec is refused. Both belong to the panorama's map, so its `destroy()` releases them.
 */
function createPeaks(): { layer: MassifLayer; decoder: api.MassifObject<'massif::MBVectorTileDecoder'> } {
    if (!panorama || !peaksSource) {
        return null;
    }
    peaksGeneration += 1;
    const decoder = panorama.style(`${PEAKS_DECODER_ID}.${peaksGeneration}`, {
        type: 'mbvt',
        cartocss: { type: 'cartocss', css: currentPeaksStyle() }
    });
    const layer = panorama.buildLayer(`${PEAKS_LAYER_ID}.${peaksGeneration}`, {
        type: 'vector',
        source: peaksSource.handle,
        style: decoder.id,
        preloading: true,
        // The labels are the only thing drawn over the relief, so they go last.
        labelRenderOrder: 'VECTOR_TILE_RENDER_ORDER_LAST',
        tileSubstitutionPolicy: 'TILE_SUBSTITUTION_POLICY_VISIBLE'
    });
    layer.onFeatureClick((e) => {
        e.consumed = onPeakClicked(featureClickData(e));
    });
    return { layer, decoder };
}

function buildPeaksLayer() {
    const built = createPeaks();
    if (!built) {
        DEV_LOG && console.log('peakFinder: no vector source, so no summit labels');
        return;
    }
    peaksLayer = built.layer;
    peaksDecoder = built.decoder;
    panorama.add(peaksLayer);
}

/**
 * Rebuilds the layer with a new decoder.
 *
 * Every label knob is style TEXT, so there is no property to write. Swapped in place so it keeps its
 * position in the stack, and the old pair is released only once the new one is standing.
 */
function rebuildPeaksLayer() {
    if (!panorama || !peaksLayer) {
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
    panorama.removeLayer(previousLayer);
    panorama.add(peaksLayer);
    previousLayer.destroy();
    previousDecoder?.destroy();
}

// --- the relief look -------------------------------------------------------------------------

/**
 * The shaded terrain surface the ink lines are drawn over.
 *
 * The shader SOURCE is a facade property; its parameters are not — the surface API has no method
 * table for `TerrainOptions` — so the uniforms go through the object API on the view.
 */
function applyReliefSurface() {
    if (!panorama) {
        return;
    }
    const colors = palette();
    // NO surface shader in AR: the shader's job is to paint the ground, and in AR the ground is the
    // camera preview. The relief still reads, because the ridge lines are drawn by the post-process
    // effect off the packed terrain DEPTH, which is rendered whether or not the surface is painted.
    terrain().set('surfaceShaderSource', get(peakFinderArActive) ? '' : RELIEF_SURFACE_SHADER);
    const terrainOptions = panoramaView?.getTerrainOptions();
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

/**
 * The ridge lines.
 *
 * The SDK gives the mechanism — an offscreen frame, the packed terrain depth and named parameters —
 * and the shader is the look. Object API only: the surface API carries no `postProcessEffect`.
 */
function applyReliefOutline() {
    if (!panoramaView) {
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
    // Slope ink in AR TOO, which it was not: the term was blamed for the grey veil over the camera
    // preview and turned off, and the veil was the shader writing a STRAIGHT colour into a
    // premultiplied surface — the ink's rgb at a near-zero alpha, which the system compositor added
    // at full strength over the whole preview. That is fixed where it belongs (see the shader's AR
    // branch), so the relief can be drawn over the photograph as it is on paper. It is a wide ink —
    // a depth gradient lifted by `pow(·, 0.23)` marks every surface not square-on to the camera — so
    // the strength slider is how much of the picture it is allowed to cover.
    effect.setFloatParameter('uSlopeStrength', get(peakFinderSlopeStrength));
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
    applyLensCorrection();
    panoramaView.setPostProcessEffect(effect);
}

/**
 * The sky, which in this mode there is none of.
 *
 * Above the horizon the panorama is paper (or ink), the same flat tone as the ground it is read
 * against. Three separate things have to be off to get that, and each one alone leaves a band:
 *
 *  - the shader sky, which is what draws a gradient;
 *  - the legacy sky BITMAP, whose switch is a TRANSPARENT `skyColor` — `Options::getSkyBitmap`
 *    generates a gradient from the style's background up to that colour, so any real colour there is
 *    a gradient, and white gave a gradient that merely ended white;
 *  - and the background PLANE: `BackgroundRenderer` draws it before any layer from the first layer's
 *    style background, and with no base map to ask it falls back to the SDK's own default bitmap —
 *    the block pattern. It reads `Options.backgroundBitmap` only to decide whether the app has an
 *    opinion, so nulling it is what takes the plane off altogether.
 *
 * With all three off the band above the horizon shows the CLEAR colour, so that is what carries the
 * tone. In AR it is fully TRANSPARENT instead, which turns the frame into a hole for the camera
 * preview — and the terrain's own background fill has to go with it, or it paints the ground opaque
 * under the relief and the preview never appears.
 */
function applyAtmosphere() {
    if (!panorama) {
        return;
    }
    const transparent = get(peakFinderArActive);
    const paper = argb(palette().paper);
    panorama.sky({ type: 'sky' }).apply({ enabled: false, shaderSource: '' });
    panorama.fog({ type: 'fog' }).set('enabled', false);
    panorama.apply({
        skyColor: NO_SKY_BITMAP,
        backgroundBitmap: null,
        clearColor: transparent ? 0 : paper
    });
    terrain().set('backgroundColor', transparent ? 0 : paper);
}

/** Re-applies everything the light/dark switch touches. The label palette is style text, so the
 *  decoder is rebuilt with it. */
function applyPalette() {
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
 * focus on the ground, as mapbox does, and recomputes it on every frame and on every camera event. A
 * focus position written with an altitude in it therefore lasts until the next frame and no longer.
 *
 * `TerrainOptions.focusLift` is the lift that survives. It is ADDED on top of whatever the
 * ground-following rule decides, so the clearance shell keeps working underneath it and the value
 * means the same thing at every zoom and tilt: this many metres above the ground the viewpoint
 * stands over.
 */
function setFocusLift(metres: number) {
    terrain()?.set('focusLift', Math.max(0, metres));
}

/**
 * Publishes where the view is pointed, for the overlay's compass.
 *
 * The map's ROTATION is the opposite of the heading — turning the view right turns the map left — so
 * this is the one place the two are converted into each other. Kept in a store rather than read by
 * the overlay, because the overlay has no map: this one is the panorama's.
 */
function publishHeading() {
    const rotation = camera()?.rotation() ?? 0;
    peakFinderHeading.set(((-rotation % 360) + 360) % 360);
}

/**
 * Re-reads the camera's field of view, for the moment the preview session actually opens.
 *
 * On iOS `AVCaptureDevice.activeFormat` is the format the SESSION chose only once there is a session;
 * before that it is whatever the device was last left on, so the value read when AR was switched on
 * can be the wrong one. On Android it changes nothing — Camera2 characteristics are static — but one
 * read costs nothing either.
 */
export function onArCameraOpen(preview: PreviewGeometrySource) {
    arPreview = preview;
    applyFieldOfView();
}

/** Lifts the viewpoint to `metres` above the ground under it, without moving it horizontally. */
export const applyViewpointElevation = tryCatchFunction(async (metres: number) => {
    setFocusLift(metres);
});

/** The viewpoint's height above the ground, read back from the SDK rather than from our own store. */
export function currentViewpointElevation(): number {
    return terrain()?.get('focusLift') ?? 0;
}

// --- entering and leaving ---------------------------------------------------------------------

function itemPosition(item: IItem): MapPos {
    const coordinates = item.geometry['coordinates'];
    return { lat: coordinates[1], lon: coordinates[0] };
}

/**
 * Enters the mode.
 *
 * Nothing here touches a map. Flipping the store is what mounts `PeakFinderMap.svelte`, and the map
 * it creates calls `setupPanorama` once its view is ready — so this only records what the panorama
 * has to be built FOR.
 */
export const enterPeakFinder = tryCatchFunction(async (item: IItem) => {
    if (isPeakFinderActive()) {
        return;
    }
    if (!packageService.hasElevation()) {
        // The item action is gated on this, so it only happens if the DEM went away between the row
        // being built and the tap. Say so rather than doing nothing at all.
        showToast(lc('no_elevation_data'));
        return;
    }
    viewpoint = itemPosition(item);
    // The live map's bearing, so the panorama opens facing the way the map was read.
    initialRotation = getMapContext().getMap()?.camera().rotation() ?? 0;
    peakFinderSelectedPeak.set(null);
    peakFinderElevation.set(get(peakFinderFlyElevation));
    lockOrientation(get(peakFinderScreenOrientation));
    peakFinderActive.set(true);
});

/**
 * Builds the panorama, on the map the component just created.
 *
 * Everything is written BEFORE the camera is placed and the layer added, so the first frame the view
 * draws is already the panorama — there is no animation anywhere in this mode, and nothing to wait
 * for but the tiles.
 */
export const setupPanorama = tryCatchFunction(async (map: MassifMap, view: MassifMapView) => {
    panorama = map;
    panoramaView = view;
    demSource = findDemSource();
    peaksSource = findPeaksSource();
    // The view is created from the store, so in principle it can arrive after the mode was left again.
    if (!viewpoint) {
        return;
    }
    if (!demSource) {
        showToast(lc('no_elevation_data'));
        exitPeakFinder();
        return;
    }

    // Labels, however far away they are. The culler drops any label past `labelViewDistance`
    // multiples of the camera-to-focus distance (maplibre's own rule, 5) — and in a panorama the
    // focus sits a couple of kilometres in front of a low camera, so that cut lands around ten
    // kilometres and took every summit on the horizon with it. Mont Blanc from Grenoble is 108 km
    // out. 0 = no limit, leaving `text-max-distance` the only bound. Its own call: the option is a
    // property rather than part of the options SPEC, so `apply` does not carry it.
    map.set('labelViewDistance', 0);
    applyFieldOfView();
    // A rotation changes the view's aspect and nothing else, and the aspect is the whole of what the
    // field-of-view cap is about.
    view.on('layoutChanged', applyFieldOfView);
    map.apply({
        // A panorama reaches UP past the horizon (a negative tilt is a look up), and every frame of a
        // drag is clamped to this. A floor at the horizon would stop the drag dead there.
        tiltRange: PANORAMA_RANGE,
        layersLabelsProcessedInReverseOrder: true,
        restrictedPanning: true,
        kineticRotation: false
    });

    // The terrain, from the live map's own DEM. `flattened` false from the start: this map has never
    // been flat, so there is no switch to animate and nothing decodes twice.
    map.terrain({ type: 'terrain', source: demSource.handle }).apply({
        enabled: true,
        flattened: false,
        flattenRatio: 0,
        // The rule belongs to the live map's 2D/3D button; a panorama is never anything but 3D.
        autoFlattenTilt: 0,
        autoFlattenParallax: 0,
        exaggeration: get(terrainExaggeration),
        cameraClearance: get(terrainCameraClearance),
        // A finer mesh than the live map runs: the outline effect draws the skyline off the terrain
        // depth, so the mesh IS the ridge line here.
        meshResolution: get(peakFinderMeshResolution),
        // A panorama wants the far ranges: tangram's rule stops the ground a few kilometres out,
        // which is most of what the view is about...
        viewDistanceFactor: get(peakFinderViewDistance),
        // ...and the factor alone cannot reach them, because that rule shrinks as the viewpoint comes
        // down towards the ground. The metres are what puts Mont Blanc on the horizon from Grenoble.
        viewDistance: get(peakFinderViewDistanceMetres),
        // A ceiling is a trade against how far the view reaches, and reaching is what a panorama IS.
        viewDistanceMax: 0,
        // NO DRAPE, and nothing to drape: this map carries no base layers. The surface shader is the
        // only thing painting the ground.
        drapeFillsEnabled: false,
        drapeLinesEnabled: false,
        // A summit sitting ON a ridge, or a metre behind it, is exactly what this view is for, so the
        // label occlusion is deliberately generous here.
        billboardOcclusionEnabled: true,
        billboardOcclusionTolerance: get(peakFinderOcclusion),
        maxTileZoomCoarsening: PEAKS_MAX_TILE_ZOOM_COARSENING,
        elevationPrefetchEnabled: true
    });

    // The camera, placed rather than flown. Before the touch model below: in first person `setTilt`
    // and `setMapRotation` turn the view in PLACE, so a camera set afterwards would spin the view
    // where it stands instead of pointing it at the panorama.
    camera().moveTo(toPosition(viewpoint), {
        zoom: effectiveZoom(),
        rotation: initialRotation,
        tilt: get(peakFinderTilt)
    });
    setFocusLift(get(peakFinderElevation));
    // FIRST PERSON is what standing on a summit and turning your head is: a one-finger drag turns the
    // view about the CAMERA on both axes and the position never changes. The map's own model — the
    // ground dragged under a camera orbiting its focus — sends that focus kilometres away at this tilt.
    map.set('freeRoamMode', 'FREE_ROAM_MODE_FIRST_PERSON');

    applyReliefSurface();
    applyReliefOutline();
    applyAtmosphere();
    buildPeaksLayer();
    // A tap on empty ground clears the chip, the way tapping the map elsewhere deselects.
    map.onClick(() => peakFinderSelectedPeak.set(null));
    // What the overlay's compass reads. Throttled: the view turns with every frame of a drag, and
    // the readout is a number on screen.
    publishHeading();
    map.onMove(publishHeading, { throttle: 100 });
    // AR survives a rebuild of the view (a rotation, an activity re-create), so the hole has to be
    // re-opened on the new surface.
    if (get(peakFinderArActive)) {
        setMapTranslucent(true);
    }
});

/**
 * Releases the panorama, when its component goes.
 *
 * `map.destroy()` releases the map's registration and every id it built — the layer, the decoder, the
 * terrain options — so the only thing left to hand back is the two SOURCE handles, which belong to
 * the live map's layers and were only borrowed.
 */
export function teardownPanorama() {
    panoramaView?.off('layoutChanged', applyFieldOfView);
    panoramaView?.setPostProcessEffect(null);
    effect = null;
    peaksLayer = null;
    peaksDecoder = null;
    panorama?.destroy();
    panorama = null;
    panoramaView = null;
    demSource?.destroy();
    demSource = null;
    peaksSource?.destroy();
    peaksSource = null;
}

/**
 * Leaves the mode.
 *
 * There is nothing to put back: the live map was never touched, and the panorama's map is destroyed
 * with the component the store below unmounts.
 */
export const exitPeakFinder = tryCatchFunction(async () => {
    if (!isPeakFinderActive()) {
        return;
    }
    stopOrientationFollowing();
    // Before the store, so the surface stops being a hole while the preview is still behind it.
    setMapTranslucent(false);
    peakFinderArActive.set(false);
    peakFinderSelectedPeak.set(null);
    peakFinderElevation.set(0);
    peakFinderActive.set(false);
    viewpoint = null;
    lockOrientation('auto');
});

// --- the selected summit ---------------------------------------------------------------------

/** A tap on a summit label fills the overlay's chip instead of opening the item sheet. */
function onPeakClicked({ featureData, featurePosition }: FeatureClickData): boolean {
    if (!featurePosition) {
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

/**
 * Turns the view to look at the selected summit, without moving the viewpoint.
 *
 * The VIEW's setter, not the camera's: `camera().rotation(deg)` is `moveTo(position(), …)`
 * underneath, and a `moveTo` in first person hands the camera a focus to walk around rather than
 * turning it where it stands.
 */
export const focusSelectedPeak = tryCatchFunction(async () => {
    const peak = get(peakFinderSelectedPeak);
    if (!peak || !viewpoint || !panoramaView) {
        return;
    }
    panoramaView.setMapRotation(bearingBetween(viewpoint, peak.position), 0);
});

/**
 * Moves the viewpoint TO the selected summit, keeping the panorama's camera.
 *
 * `moveTo` takes the FOCUS, and at a panorama's tilt the focus is kilometres in front of the camera —
 * so moving the focus to the summit parks the eye short of it, looking at it from the side. That is
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
    if (!peak || !panorama) {
        return;
    }
    viewpoint = peak.position;
    const mapCamera = camera();
    const summit = toPosition(peak.position);
    const focus = mapCamera.position();
    const eye = mapCamera.eyePosition();
    const target: Position = [summit[0] + (focus[0] - eye[0]), summit[1] + (focus[1] - eye[1])];
    mapCamera.moveTo(target, { zoom: effectiveZoom(), tilt: get(peakFinderTilt) });
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
 * becomes a hole), a TRANSLUCENT GL surface so the hole shows what is behind it, the sky off, the
 * light-ink palette, and the device's orientation aiming the view.
 *
 * `setTranslucent` also raises the surface's z-order (`MapView.setTranslucent` calls
 * `setZOrderMediaOverlay`), which is the part that matters: a `SurfaceView` is composited BELOW the
 * window, so the only thing a translucent map can reveal is another surface under it. `Map.svelte`
 * puts a `<cameraview>` there and takes the LIVE map out of the way while AR is on — three surfaces
 * have no defined order between them, and the one that must be behind the panorama is the preview.
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
    // The preview is created by the `{#if}` in Map.svelte reacting to this, so the surface is made
    // translucent after it — otherwise there is nothing behind the hole yet and the map goes black.
    arStartedFollowing = !get(peakFinderHeadingFollowing);
    peakFinderArActive.set(true);
    setMapTranslucent(true);
});

function setMapTranslucent(translucent: boolean) {
    const nativeMapView = panoramaView?.mapView;
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

/** The panorama's view, for the orientation sensors: they turn the VIEW, not the camera. */
export function panoramaMapView(): MassifMapView {
    return panoramaView;
}

/** Where the panorama stands, `[lon, lat, alt]` — what the magnetic declination is worked out from. */
export function panoramaPosition(): Position {
    return camera()?.position() ?? null;
}

// --- settings, and the entry point ------------------------------------------------------------

export const showPeakFinderSettings = tryCatchFunction(async () => {
    const component = (await import('~/components/peaks/PeakFinderSettings.svelte')).default;
    await showBottomSheet({ view: component, skipCollapsedState: true });
});

/** The look changes that are live property writes. The label ones rebuild the decoder instead. */
function applyLive(store: { subscribe: (run: (value) => void) => unknown }, apply: () => void) {
    store.subscribe(() => {
        if (!panorama) {
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
applyLive(peakFinderTilt, () => panoramaView?.setTilt(get(peakFinderTilt), 0));
applyLive(peakFinderMaxFieldOfView, applyFieldOfView);
applyLive(peakFinderLensCorrection, applyFieldOfView);
applyLive(peakFinderLabelPinTop, rebuildPeaksLayer);
applyLive(peakFinderLabelBand, rebuildPeaksLayer);
applyLive(peakFinderLabelAngle, rebuildPeaksLayer);
applyLive(peakFinderLabelRows, rebuildPeaksLayer);
applyLive(peakFinderLabelMinDistance, rebuildPeaksLayer);
applyLive(peakFinderLabelMaxDistance, rebuildPeaksLayer);
// Changed from the settings sheet while the panorama is up: turn now rather than on the next entry.
applyLive(peakFinderScreenOrientation, () => lockOrientation(get(peakFinderScreenOrientation)));
// AR turns the clear colour into a hole for the camera preview to show through, and takes over the
// tilt as well as the rotation — a panorama held up at the sky has to be able to look up.
applyLive(peakFinderArActive, () => {
    // EVERYTHING the look is made of, not the atmosphere alone: AR is a hole in the frame, and what
    // paints over a hole is the terrain's surface shader (`applyReliefSurface` clears it in AR) and
    // the effect's own alpha (`uTransparent`). The summit labels go with them, because AR forces the
    // light-ink palette and their colours are style TEXT — see `palette` and `rebuildPeaksLayer`.
    applyPalette();
    // In AR the field of view stops being a preference and becomes a MEASUREMENT of the camera
    // behind the frame, which is the only way a summit is the same size in both pictures.
    applyFieldOfView();
    // A panorama held up at the sky has to be able to look straight up, which the panorama's own
    // range stops short of.
    panorama.set('tiltRange', get(peakFinderArActive) ? [-90, 90] : PANORAMA_RANGE);
    setOrientationTilt(get(peakFinderArActive)).catch((error) => showError(error));
});

/** The live map going away takes the panorama with it — the app is shutting down or re-creating. */
function onMapDestroyed() {
    stopOrientationFollowing();
    teardownPanorama();
    viewpoint = null;
    peakFinderActive.set(false);
    peakFinderArActive.set(false);
}

registerMapModule('peakFinder', { onMapDestroyed });

declare module '~/mapModules/registry' {
    interface MapModules {
        peakFinder: { onMapDestroyed: () => void };
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
