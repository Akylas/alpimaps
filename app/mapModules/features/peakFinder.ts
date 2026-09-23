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
import { RELIEF_DEFAULTS, RELIEF_SURFACE_SHADER, reliefOutlineShader, reliefPalette } from '~/mapModules/terrain/reliefShaders';
import { PANORAMA_PEAKS_LAYER, collectPanoramaPeaks, peaksToGeoJSON } from '~/mapModules/terrain/panoramaPeaks';
import { peaksStyle } from '~/mapModules/terrain/peaksStyle';
import type { IItem } from '~/models/Item';
import { packageService } from '~/services/PackageService';
import { nutiProps } from '~/stores/mapStore';
import {
    PANORAMA_RANGE,
    peakFinderActive,
    peakFinderArActive,
    peakFinderCreaseStrength,
    peakFinderCreaseThreshold,
    peakFinderDark,
    peakFinderDebugView,
    peakFinderDetailFeatures,
    peakFinderDetailLevels,
    peakFinderDetailSource,
    peakFinderElevation,
    peakFinderElevationCacheSize,
    peakFinderEnabled,
    peakFinderFlyElevation,
    peakFinderFlyZoom,
    peakFinderHaze,
    peakFinderHeading,
    peakFinderHeadingFollowing,
    peakFinderHorizonBoost,
    peakFinderInkDistance,
    peakFinderInkShadeCap,
    peakFinderLabelAngle,
    peakFinderLabelBand,
    peakFinderLabelFollowSkyline,
    peakFinderLabelMaxDistance,
    peakFinderLabelMinDistance,
    peakFinderLabelPadding,
    peakFinderLabelPersist,
    peakFinderLabelPinTop,
    peakFinderLabelRows,
    peakFinderLensCorrection,
    peakFinderMaxFieldOfView,
    peakFinderMeshCacheSize,
    peakFinderMeshResolution,
    peakFinderMinElevation,
    peakFinderNodeResolution,
    peakFinderNormalEdges,
    peakFinderNormalEdgesAvailable,
    peakFinderNormalSampleDistance,
    peakFinderOcclusion,
    peakFinderOutlineWidth,
    peakFinderPeakCount,
    peakFinderPeakMinElevation,
    peakFinderPeakZoom,
    peakFinderRidgeGroundSpan,
    peakFinderRidgeStrength,
    peakFinderRidgeThreshold,
    peakFinderScreenOrientation,
    peakFinderSelectedPeak,
    peakFinderShadeStrength,
    peakFinderSilhouetteGate,
    peakFinderSlopeShade,
    peakFinderStaticPeaks,
    peakFinderTerrainMaxZoom,
    peakFinderTileCoarsening,
    peakFinderTilt,
    peakFinderViewDistance,
    peakFinderViewDistanceMetres,
    terrainCameraClearance,
    terrainExaggeration
} from '~/stores/terrainStore';
import { type CameraFieldOfView, type CameraPreviewInfo, type LensDistortion, type PreviewGeometrySource, cameraFieldOfView } from '~/utils/cameraFov';
import { type MapPos, bearingBetween, computeDistanceBetween, fromPosition, toPosition } from '~/utils/geo';
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
/** Fixed, not generation-stamped: there is one summit set per panorama and the map owns it. */
const STATIC_PEAKS_SOURCE_ID = 'source.peaks.static';
/** The engine-side one. Fixed too: one per panorama, released with the map that built it. */
const DETAIL_PEAKS_SOURCE_ID = 'source.peaks.detail';
const DETAIL_PEAKS_CACHE_ID = 'source.peaks.detail.cache';
/**
 * Bytes the rebuilt summit tiles are held in, in front of `PointDetailTileDataSource`.
 *
 * Rebuilding one coarse tile READS 4^levels finer ones — 64 at the default — so a tile that falls
 * out and is asked for again is not a cache miss, it is sixty-four of them plus a decode and a
 * rebuild. Measured without it: the label map was rebuilt 3-6 times a SECOND while looking around
 * (`RenderStats` tileSets/labelMaps), allocating up to 992 labels and throwing up to 1397
 * placements away each time — which is the remaining reason names appear and vanish, now that
 * placement itself settles to visFlips=0.
 *
 * The SDK's own default is 6 MB, sized for raster tiles. These are a few hundred points each.
 */
const DETAIL_PEAKS_CACHE_BYTES = 32 * 1024 * 1024;
const EFFECT_ID = 'relief_outline';
/** A transparent sky colour is how the legacy sky BITMAP is turned off — see `applyAtmosphere`. */
const NO_SKY_BITMAP = 0;

/** The panorama's own map, from the moment its view is ready until the mode is left. */
let panorama: MassifMap = null;
/** Its view, for the two things the surface API has no verb for: the effect and the surface shader. */
let panoramaView: MassifMapView = null;
/** The live map's sources, held by handle while the panorama draws from them. */
let demSource: MassifSource = null;
let peaksSource: MassifSource = null;
/** The summit set collected for this viewpoint, once it has landed. See `loadStaticPeaks`. */
let staticPeaksSource: MassifSource = null;
/** The engine-side detail source, once it has been built and found to work. */
let detailPeaksSource: MassifSource = null;
/** The memory cache wrapping it — what the layer actually reads. See DETAIL_PEAKS_CACHE_BYTES. */
let detailPeaksCache: MassifSource = null;
/** Memoised: whether this build's SDK carries `PointDetailTileDataSource` at all. */
let detailSourceAvailable: boolean | undefined;
let peaksLayer: MassifLayer = null;
let peaksDecoder: api.MassifObject<'massif::MBVectorTileDecoder'> = null;
/** Bumped per rebuild, so a new layer/decoder pair never collides with the one still on the map. */
let peaksGeneration = 0;
let effect = null;
/**
 * Where the eye stands, in lon/lat — what every distance and bearing in this mode is measured from.
 *
 * LIVE, not the entry position. It used to be written once from the item the mode was opened on and
 * again by `flyToSelectedPeak`, which was wrong the moment the camera moved on its own — and it
 * does: a two-finger drag in this mode is a MOVE, not a pinch (`TouchHandler`, `DUAL_POINTER_MOVE`
 * under `FREE_ROAM_MODE_FIRST_PERSON`). Walk a few kilometres and every summit in the chip was
 * still measured from where you started.
 *
 * It is the EYE and not the camera's focus. The two are kilometres apart at a panorama's tilt,
 * which is the whole subject of `flyToSelectedPeak`, and the one a peak finder means by "from here"
 * is the eye. `entryPosition` keeps what the mode was opened ON, because the camera placement wants
 * that and nothing else does.
 */
let viewpoint: MapPos = null;
/** The item the mode was opened on — where the camera is AIMED at setup, and only that. */
let entryPosition: MapPos = null;
/**
 * Ground height under the viewpoint, metres. Resolved from the DEM, NOT read off the camera.
 *
 * The skyline rank is an angle from the eye, so it needs the eye's absolute altitude — and
 * `camera().eyePosition()` does not carry one: the facade serialises `cameraPos` without a usable
 * altitude, so `?.altitude` came back undefined and the style was built with `[ele] - 0`, i.e.
 * measured from SEA LEVEL. From a 2000 m viewpoint that systematically over-ranks the distant high
 * summits and under-ranks the near skyline, which is the opposite of the rule.
 * The eye is this plus `peakFinderElevation` (the focus lift).
 */
let eyeGroundElevation = 0;
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

/**
 * How far outside the screen the culler may place a summit name. See `peakFinderLabelPadding`.
 *
 * Written through the NATIVE options rather than `panorama.set`: the bridge resolves a property name
 * against the plugin's GENERATED schema, which is regenerated from the built SDK's typings and so
 * does not know a freshly added option. A build without it keeps the SDK's own tilt rule, which in a
 * panorama is 20 px — the names blink, but nothing breaks.
 */
function applyLabelPadding() {
    // Same trap as `applyNormalSampleDistance`: the bridge's options object is the one the renderer
    // reads, and the view's wrapper is not.
    const native = (panorama as { native?: { getOptions?: () => { setLabelPadding?: (value: number) => void } } })?.native?.getOptions?.() ?? panoramaView?.getOptions?.()?.getNative?.();
    if (typeof native?.setLabelPadding !== 'function') {
        DEV_LOG && console.log('peakFinder: label padding not in this SDK build, names will churn as the view turns');
        return;
    }
    const padding = get(peakFinderLabelPadding);
    native.setLabelPadding(padding > 0 ? padding : -1);
    DEV_LOG && console.log('peakFinder: label padding set to', padding);
}

/**
 * The panorama's native TerrainOptions.
 *
 * Two objects answer to that name and only one of them is read by the renderer: the terrain the
 * bridge created for this map (`map.terrain({...})`), and the wrapper the VIEW keeps. Which one
 * carries the native object differs by build, so both are tried — a zoom cap written to the wrong
 * one type-checks, logs nothing and does nothing, which is exactly how it failed the first time.
 */
function terrainNative(): Record<string, (value: unknown) => void> {
    const fromBridge = (terrain() as { native?: Record<string, (value: unknown) => void> })?.native;
    return fromBridge ?? (panoramaView?.getTerrainOptions?.()?.getNative?.() as Record<string, (value: unknown) => void>);
}

/**
 * The zoom the terrain mesh is cut at. See `peakFinderTerrainMaxZoom` — it is what makes the height
 * field settle, and with it the labels and the camera.
 */
function applyTerrainZoomCap() {
    const native = terrainNative();
    if (typeof native?.setMaxZoom !== 'function') {
        DEV_LOG && console.log('peakFinder: terrain zoom cap not in this SDK build, the height field will keep refining');
        return;
    }
    const zoom = get(peakFinderTerrainMaxZoom);
    native.setMaxZoom(zoom);
    DEV_LOG && console.log('peakFinder: terrain mesh zoom capped at', zoom);
}

/**
 * The height field's resolution, which is NOT the mesh's. See `peakFinderNodeResolution`.
 *
 * Read when a DEM grid is DECODED, so it is written with the rest of the terrain's setup rather than
 * after the first tiles have landed.
 */
function applyNodeResolution() {
    const native = terrainNative();
    if (typeof native?.setSurfaceNodeResolution !== 'function') {
        DEV_LOG && console.log('peakFinder: node resolution not in this SDK build, the height field follows the mesh');
        return;
    }
    const resolution = get(peakFinderNodeResolution);
    native.setSurfaceNodeResolution(resolution);
    DEV_LOG && console.log('peakFinder: height field resolution set to', resolution);
}

/**
 * The ground distance the terrain's surface normals are measured over. See
 * `peakFinderNormalSampleDistance` — it is what keeps `ridge_strength` off the tile boundaries.
 *
 * Native, for the same reason `applyLabelPadding` is: the bridge resolves an option name against the
 * plugin's generated schema, which only learns a new one when the SDK's typings are regenerated.
 */
function applyNormalSampleDistance() {
    // The BRIDGE's terrain options, not `panoramaView.getTerrainOptions()`. The two are different
    // objects: the panorama's terrain was created by `map.terrain({...})` and lives on the bridge,
    // while the view keeps a wrapper of its own. Writing to the view's answered `typeof === function`
    // and changed nothing the renderer ever read — the option was set on an object no pass looks at.
    const native = terrainNative();
    if (typeof native?.setNormalSampleDistance !== 'function') {
        DEV_LOG && console.log('peakFinder: fixed-scale terrain normals not in this SDK build, LOD boundaries will read as ridges');
        return;
    }
    const distance = get(peakFinderNormalSampleDistance);
    native.setNormalSampleDistance(distance);
    DEV_LOG && console.log('peakFinder: terrain normal sampling set to', distance, 'm');
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
        // The skyline rank is an ANGLE from the eye, so it needs the eye's own altitude. Baked in
        // rather than read per label: CartoCSS has no camera height, and the style is rebuilt
        // whenever the viewpoint changes anyway. See `eyeGroundElevation` for why it is not read
        // off the camera.
        eyeElevation: eyeGroundElevation + get(peakFinderElevation),
        fontScale: mapFontScale(),
        pinTop: get(peakFinderLabelPinTop),
        followSkyline: get(peakFinderLabelFollowSkyline),
        band: get(peakFinderLabelBand),
        textAngle: get(peakFinderLabelAngle),
        maxRows: get(peakFinderLabelRows),
        minDistance: get(peakFinderLabelMinDistance),
        persistPasses: get(peakFinderLabelPersist),
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
    // The collected set once it has landed, the live tiles until then - and the live tiles again if
    // the setting is switched back off, which is why the store is read here rather than the built
    // source simply being dropped. See `loadStaticPeaks`.
    // Three, in order of how well they answer the same question. The engine-side one first: it
    // rebuilds whatever tile is asked for, so it needs no viewpoint and nothing refreshed. Then the
    // collected snapshot, which does the same job for a build with no such source. Then the raw
    // tiles, which is the mode as it was.
    const source = ensureDetailPeaksSource() ?? (get(peakFinderStaticPeaks) ? staticPeaksSource : null) ?? peaksSource;
    if (!panorama || !source) {
        return null;
    }
    peaksGeneration += 1;
    const css = currentPeaksStyle();
    // The style the summits are actually drawn with. Every capacity question about the labels -
    // how many fit, why a dense horizon drops them - is answered by these four lines, and reading
    // them back beats inferring them from the settings.
    DEV_LOG &&
        console.log(
            'peakFinder: label style',
            JSON.stringify(css.split('\n').filter((line) => /callout-screen-anchor|callout-max-rows|callout-align|text-orientation|text-min-distance|callout-step|text-size|text-rank/.test(line)))
        );
    const decoder = panorama.style(`${PEAKS_DECODER_ID}.${peaksGeneration}`, {
        type: 'mbvt',
        cartocss: { type: 'cartocss', css }
    });
    const layer = panorama.buildLayer(`${PEAKS_LAYER_ID}.${peaksGeneration}`, {
        type: 'vector',
        source: source.handle,
        style: decoder.id,
        preloading: true,
        // The labels are the only thing drawn over the relief, so they go last.
        labelRenderOrder: 'VECTOR_TILE_RENDER_ORDER_LAST',
        tileSubstitutionPolicy: 'TILE_SUBSTITUTION_POLICY_VISIBLE'
        // NOT an overlay, for now. `postProcessed: false` takes this layer out of the terrain
        // arrangement, which is worth 8-11 ms of the frame: a label-only layer has no ground in it,
        // yet the shared-ground path walks the whole cover for it every frame (a stand-in elevation
        // search per cover tile, plus an O(n^2) dedup).
        // REVERTED because it also makes this the map's first post-process opt-out, which switches
        // the effect from resolving straight to the screen onto FrameBuffer's SECONDARY colour
        // texture plus a blend blit (MapRenderer::blendAndUnbindScreenFBO) - a path nothing here had
        // exercised before, and the panorama came back visibly darker. The saving is no longer the
        // limiter anyway: the frame is 2-15 ms now and what holds the fps down is elsewhere.
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
 * Where the eye actually IS, which is not `viewpoint`.
 *
 * `viewpoint` is where the mode was ENTERED — `camera().moveTo` takes a focus, and the first-person
 * camera then walks away from it: a two-finger drag is a MOVE in this mode
 * (`TouchHandler::onTouchEvent`, `DUAL_POINTER_MOVE` under `FREE_ROAM_MODE_FIRST_PERSON`), and
 * `flyToSelectedPeak` relocates outright. So the summit set has to follow the camera and not the
 * entry, and `eyePosition` is the one reading that means "where you are standing" at any moment.
 */
/**
 * The source that rebuilds coarse summit tiles out of the finer ones — see `peakFinderDetailSource`.
 *
 * Built once, lazily, and probed by BUILDING it: a spec type the SDK does not know is refused, and
 * there is no cheaper way to ask than to try. A refusal is expected rather than exceptional on a
 * build whose native side predates the source, so it is a log line and a `false` — the snapshot and
 * then the raw tiles stand behind it.
 */
/**
 * The detail source's three knobs, written on the NATIVE object.
 *
 * Not `source.apply(...)`, which is what this was and which wrote nothing: the facade resolves a
 * spec type to a class name through the plugin's GENERATED schema, and a type newer than that
 * schema falls back to `massif::Layer` (`classOfSpec` in `api/index.common.js`). The source itself
 * is real — the spec crosses to native as JSON and native builds the right class — but every
 * property write after it is then looked up in the wrong method table.
 *
 * Which is why the constructor spec carries `detailZoom` and these three do not: a ctor argument
 * travels in the JSON and arrives, a property does not until the plugin is rebuilt.
 */
function applyDetailPeaksOptions() {
    const native = detailPeaksSource?.native;
    if (!native?.setMaxDetailLevels) {
        DEV_LOG && console.log('peakFinder: detail source options not settable, defaults stand');
        return;
    }
    native.setMaxDetailLevels(get(peakFinderDetailLevels));
    native.setMaxFeatures(get(peakFinderDetailFeatures));
    // What the cap ranks by, and the order a panorama is read in.
    native.setRankProperty('ele');
    // All three change what a rebuilt tile CONTAINS, and the cache in front of it is still holding
    // the old answer. Nothing else drops it: the decorator has no tiles of its own to invalidate.
    detailPeaksCache?.native?.clear?.();
}

function ensureDetailPeaksSource(): MassifSource {
    if (!get(peakFinderDetailSource) || !panorama || !peaksSource || detailSourceAvailable === false) {
        return null;
    }
    if (detailPeaksCache) {
        return detailPeaksCache;
    }
    try {
        // Cast because the spec union is GENERATED from the SDK's own modules, and this source is
        // newer than the bindings most installs resolve - which is the same thing the try/catch is
        // here for. It types itself once the plugin is rebuilt.
        const spec = { type: 'point-detail', source: peaksSource.handle, layer: PANORAMA_PEAKS_LAYER, detailZoom: get(peakFinderPeakZoom) } as unknown as Parameters<typeof panorama.source>[1];
        detailPeaksSource = panorama.source(DETAIL_PEAKS_SOURCE_ID, spec);
        applyDetailPeaksOptions();
        // ...and the cache is what the LAYER reads, so a tile the renderer drops and asks for again
        // is not sixty-four reads and a rebuild. See DETAIL_PEAKS_CACHE_BYTES.
        detailPeaksCache = panorama.source(DETAIL_PEAKS_CACHE_ID, {
            type: 'memory-cache',
            source: detailPeaksSource.handle,
            capacity: DETAIL_PEAKS_CACHE_BYTES
        });
        detailSourceAvailable = true;
        DEV_LOG && console.log('peakFinder: summit detail source built, detail zoom', get(peakFinderPeakZoom));
    } catch (error) {
        detailSourceAvailable = false;
        detailPeaksSource = null;
        detailPeaksCache = null;
        DEV_LOG && console.log('peakFinder: no PointDetailTileDataSource in this SDK build', error);
    }
    return detailPeaksCache;
}

function currentEye(): MapPos {
    const position = camera()?.eyePosition();
    return position ? fromPosition(position) : null;
}

/**
 * The ground height under the eye, metres, or 0 when there is no answer.
 *
 * `packageService.getElevation` runs on a worker off the same DEM the terrain is meshing, so by the
 * time the camera is placed the tiles it needs are resident and this is a lookup. 0 on failure is
 * the old behaviour — a rank measured from sea level — rather than no labels at all.
 */
async function resolveEyeGroundElevation(): Promise<number> {
    const eye = currentEye() ?? entryPosition;
    if (!eye || !packageService.hasElevation()) {
        return 0;
    }
    try {
        const metres = await packageService.getElevation(eye);
        return isFinite(metres) ? metres : 0;
    } catch (error) {
        DEV_LOG && console.log('peakFinder: no ground elevation for the viewpoint, ranking from sea level', error);
        return 0;
    }
}

/** Re-reads where the eye is. Called once the camera is placed, and on every move after that. */
function updateViewpoint() {
    const eye = currentEye();
    if (eye) {
        viewpoint = eye;
    }
}

/**
 * How much wider than the view the collected disc is.
 *
 * The margin IS the hysteresis: the set covers `viewDistance x MARGIN`, so it keeps covering the
 * full view distance until the eye has moved `viewDistance x (MARGIN - 1)` from where it was
 * collected — 37 km at the default 150 km, which is a great deal of two-finger dragging. Below that
 * nothing is recollected, so walking about costs nothing at all.
 */
const PEAKS_COLLECT_MARGIN = 1.25;

/** Where the set was collected from, and how far it reaches — the refresh test, and nothing else. */
let staticPeaksCentre: MapPos = null;
let staticPeaksRadius = 0;
/** The declared layer inside `staticPeaksSource`; a refresh replaces its document rather than it. */
let staticPeaksLayerIndex = 0;
/** One sweep at a time. Two would read the same tiles twice and race on the document. */
let staticPeaksLoading = false;
/**
 * A sweep that failed is not tried again for this panorama.
 *
 * `checkStaticPeaks` asks for one whenever there is no collected centre, and a failure leaves no
 * centre — so without this the failure IS the retry condition, and the mode relaunches a search
 * that reads a couple of thousand tiles on every move event. Which is not a slow refresh, it is the
 * view going solid.
 */
let staticPeaksFailed = false;

/**
 * Whether the collected snapshot is the thing answering for the summit labels.
 *
 * The switch is not enough on its own, and that was a real hole: `createPeaks` prefers the
 * engine-side source over the snapshot, so with both available the sweep ran, read a couple of
 * thousand tiles, and produced a source nothing would ever read from. The snapshot is the FALLBACK
 * for a build without `PointDetailTileDataSource` — so what decides whether to collect is the same
 * thing that decides whether to draw from it.
 */
function staticPeaksNeeded(): boolean {
    return get(peakFinderStaticPeaks) && !ensureDetailPeaksSource();
}

/**
 * Collects the summits around where the eye is now, and points the layer at them.
 *
 * Fire and forget: the sweep reads several hundred tiles, and the live layer is already drawing
 * labels from whatever is resident, so the only thing waiting for it would be the user. If it fails
 * or finds nothing the live source stays, which is what the mode did before this existed.
 *
 * A REFRESH is `setGeoJSON` on the source that is already there — the source re-tiles its document
 * in place, so the layer above it never moves and no label blinks through a rebuild. Only the first
 * collection swaps the layer over, because only then does the source it reads from change.
 */
async function loadStaticPeaks() {
    if (!panorama || staticPeaksLoading || staticPeaksFailed || !staticPeaksNeeded()) {
        return;
    }
    const centre = currentEye();
    if (!centre) {
        return;
    }
    const radius = get(peakFinderViewDistanceMetres) * PEAKS_COLLECT_MARGIN;
    staticPeaksLoading = true;
    try {
        const peaks = await collectPanoramaPeaks(centre, {
            radius,
            zoom: get(peakFinderPeakZoom),
            maxCount: get(peakFinderPeakCount),
            minElevation: get(peakFinderPeakMinElevation)
        });
        // The map going away mid-sweep is the one case worth testing: the eye having moved on is
        // not, because the next `checkStaticPeaks` will say so and this set is still better than
        // none.
        if (!peaks.length || !panorama) {
            DEV_LOG && console.log('peakFinder: no static summit set', peaks.length);
            return;
        }
        const first = !staticPeaksSource;
        if (first) {
            // minZoom 0 / maxZoom 24: the set is in memory, so every zoom can serve all of it and
            // the far-tile coarsening that thinned the live layer has nothing left to thin.
            staticPeaksSource = panorama.source(STATIC_PEAKS_SOURCE_ID, { type: 'geojson', defaultLayerBuffer: 0, simplifyTolerance: 0, minZoom: 0, maxZoom: 24 });
            staticPeaksLayerIndex = staticPeaksSource.createLayer(PANORAMA_PEAKS_LAYER);
        }
        staticPeaksSource.setGeoJSON(staticPeaksLayerIndex, peaksToGeoJSON(peaks));
        staticPeaksCentre = centre;
        staticPeaksRadius = radius;
        DEV_LOG && console.log('peakFinder: static summit set', peaks.length, 'peaks', first ? '(first)' : '(refresh)');
        if (first) {
            rebuildPeaksLayer();
        }
    } catch (error) {
        // A missing package or a search that found nothing is not worth a dialog: the live layer is
        // still there and the mode works, with the label set it always had. But it is not worth
        // REPEATING either - see `staticPeaksFailed`.
        staticPeaksFailed = true;
        DEV_LOG && console.log('peakFinder: collecting the summit set failed, not retrying', error);
    } finally {
        staticPeaksLoading = false;
    }
}

/**
 * Recollects when the eye has walked out from under the set it was given.
 *
 * On the move event only because the snapshot is ANCHORED to a position and the eye moves — a
 * two-finger drag in this mode is a walk. The engine-side source has no anchor and needs none of
 * this, which is why the first thing here is to ask whether the snapshot is in play at all; when it
 * is not, and by default it is not, this is a store read and a return.
 *
 * Where it does run, the test is one bridge read and a distance, and it answers no for all but a
 * handful of events: the condition is the invariant the margin buys — the collected disc must still
 * reach the full view distance from where the eye is NOW.
 */
function checkStaticPeaks() {
    if (staticPeaksLoading || staticPeaksFailed || !staticPeaksNeeded()) {
        return;
    }
    if (!staticPeaksCentre) {
        loadStaticPeaks();
        return;
    }
    const centre = currentEye();
    if (centre && computeDistanceBetween(staticPeaksCentre, centre) > staticPeaksRadius - get(peakFinderViewDistanceMetres)) {
        loadStaticPeaks();
    }
}

/** Forgets the collected set, so the next check goes and gets it again. For the knobs that size it. */
function refreshStaticPeaks() {
    staticPeaksCentre = null;
    staticPeaksRadius = 0;
    // The knobs that size the sweep are also the ones that can make a failing one succeed, so
    // changing any of them is what clears the refusal.
    staticPeaksFailed = false;
    loadStaticPeaks();
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
    terrainOptions.setSurfaceParameter('uSlopeShade', get(peakFinderSlopeShade));
    terrainOptions.setSurfaceParameter('uAmbient', RELIEF_DEFAULTS.ambient);
    terrainOptions.setSurfaceParameter('uHaze', get(peakFinderHaze));
    terrainOptions.setSurfaceParameter('uHazeDistance', RELIEF_DEFAULTS.hazeDistance);
    terrainOptions.setSurfaceParameter('uDebugView', get(peakFinderDebugView));
}

/** Which of the two outline shaders the live effect was built with. See `reliefOutlineShader`. */
let effectUsesNormals = false;
/** Memoised: whether this build's plugin knows about the normal buffer at all. */
let normalBufferAvailable: boolean | undefined;

/**
 * Whether the effect should ask for the terrain NORMALS rather than depth alone.
 *
 * Two gates, and both have to pass. The setting is the user's; the other is a build question —
 * `PostProcessEffect.terrainNormalsRequired` is newer than the SDK most installs resolve, and asking
 * for a buffer the renderer will not pack means reading depth out of the wrong channels, which is a
 * black frame rather than a degraded one. The generated accessor map IS the capability: it is
 * rebuilt from the SDK's own headers, so the property is in it exactly when the pass exists.
 */
function useNormalBuffer(): boolean {
    if (!get(peakFinderNormalEdges)) {
        return false;
    }
    if (normalBufferAvailable === undefined) {
        // Asked of the NATIVE object, not of the plugin's generated accessor map. Those two answer
        // differently and the difference is the whole bug: the map is a JS file in node_modules,
        // regenerated only when the PLUGIN is rebuilt, while the capability lives in the native SDK.
        // Rebuild the SDK alone - which is the normal thing to do - and the map still says no while
        // the method is right there, so the effect quietly compiled the old depth shader and the
        // ridge sliders did nothing.
        const { PostProcessEffect } = require('@nativescript-community/ui-massifmaps/renderers');
        const probe = new PostProcessEffect({ name: `${EFFECT_ID}.probe`, fragmentShader: 'void main(){gl_FragColor=vec4(0.0);}' });
        normalBufferAvailable = typeof probe?.getNative?.()?.setTerrainNormalsRequired === 'function';
        probe?.dispose?.();
        peakFinderNormalEdgesAvailable.set(normalBufferAvailable);
        DEV_LOG && console.log('peakFinder: terrain normal buffer', normalBufferAvailable ? 'available' : 'not in this SDK build');
        if (!normalBufferAvailable) {
            // Said out loud, once. Without the buffer the ridge sliders below it are inert and the
            // crease ones draw tile seams, which is indistinguishable from the settings being broken.
            showToast(lc('normal_edges_unavailable'));
        }
    }
    return normalBufferAvailable;
}

/**
 * The ridge lines.
 *
 * The SDK gives the mechanism — an offscreen frame, the packed terrain buffer and named parameters —
 * and the shader is the look. Object API only: the surface API carries no `postProcessEffect`.
 */
function applyReliefOutline() {
    if (!panoramaView) {
        return;
    }
    const colors = palette();
    const wantsNormals = useNormalBuffer();
    // A shader is compiled into the effect, so the two variants cannot be one object: switching the
    // setting swaps the effect, and the old one goes with it.
    if (effect && effectUsesNormals !== wantsNormals) {
        panoramaView.setPostProcessEffect(null);
        effect = null;
    }
    if (!effect) {
        // Required lazily: `renderers` is object-API code that nothing else in the app pulls in.
        const { PostProcessEffect } = require('@nativescript-community/ui-massifmaps/renderers');
        effect = new PostProcessEffect({ name: EFFECT_ID, fragmentShader: reliefOutlineShader(wantsNormals) });
        effect.terrainDepthRequired = true;
        effectUsesNormals = wantsNormals;
        if (wantsNormals) {
            // Natively, for the same reason the probe is native: the generated accessor that would
            // make this a property assignment is only there once the PLUGIN is rebuilt, and an
            // assignment to a property the wrapper does not know sets a field on a JS object and
            // tells nobody.
            effect.getNative().setTerrainNormalsRequired(true);
        }
    }
    effect.setFloatParameter('uIntensity', 1);
    effect.setFloatParameter('uRidgeStrength', get(peakFinderRidgeStrength));
    effect.setFloatParameter('uRidgeThreshold', get(peakFinderRidgeThreshold));
    effect.setFloatParameter('uRidgeGroundSpan', get(peakFinderRidgeGroundSpan));
    // AR draws the ink alone, over the camera preview — see the shader's own note.
    effect.setFloatParameter('uTransparent', get(peakFinderArActive) ? 1 : 0);
    effect.setFloatParameter('uOutlineWidth', get(peakFinderOutlineWidth));
    effect.setFloatParameter('uHorizonBoost', get(peakFinderHorizonBoost));
    effect.setFloatParameter('uDepthThreshold', RELIEF_DEFAULTS.depthThreshold);
    effect.setFloatParameter('uCreaseStrength', get(peakFinderCreaseStrength));
    effect.setFloatParameter('uCreaseThreshold', get(peakFinderCreaseThreshold));
    effect.setFloatParameter('uHaze', get(peakFinderHaze));
    // The depth texture is half resolution with nearest filtering, so a narrower step than this
    // samples the same texel twice and draws nothing.
    effect.setFloatParameter('uDepthTexelSize', RELIEF_DEFAULTS.depthTexelSize);
    effect.setFloatParameter('uGrazingFloor', RELIEF_DEFAULTS.grazingFloor);
    effect.setFloatParameter('uInkDistance', get(peakFinderInkDistance));
    effect.setFloatParameter('uInkShadeCap', get(peakFinderInkShadeCap));
    effect.setFloatParameter('uDebugView', get(peakFinderDebugView));
    // The outline effect's uFar is in INTERNAL units and its fades are in metres.
    effect.setFloatParameter('uMetersPerUnit', RELIEF_DEFAULTS.metersPerUnit);
    effect.setFloatParameter('uSilhouetteGate', get(peakFinderSilhouetteGate));
    effect.setFloatParameter('uHazeDistance', RELIEF_DEFAULTS.hazeDistance);
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
    entryPosition = itemPosition(item);
    // Stands in until the camera is placed and `updateViewpoint` can read the eye for real.
    viewpoint = entryPosition;
    // The live map's bearing, so the panorama opens facing the way the map was read.
    initialRotation = getMapContext().getMap()?.camera().rotation() ?? 0;
    peakFinderSelectedPeak.set(null);
    // Never on the ground: standing exactly on the height field puts the eye inside the surface's
    // own sampling error and the nearest cell hides the panorama — see `peakFinderMinElevation`.
    peakFinderElevation.set(Math.max(get(peakFinderMinElevation), get(peakFinderFlyElevation)));
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
    // `mapReady` can arrive more than once for one mode - an activity re-create, or a second mount
    // of the component - and setting up over a live panorama left the first one's map registered
    // while this one built ids on top of it. The symptom was the second entry failing with
    // "Cannot create 'layer.peaks.2' ... RESULT_BAD_HANDLE", and a blank panorama after it, because
    // the first teardown had already released the facade the second setup was still building on.
    if (panorama && panorama !== map) {
        teardownPanorama();
    }
    panorama = map;
    panoramaView = view;
    demSource = findDemSource();
    peaksSource = findPeaksSource();
    // The view is created from the store, so in principle it can arrive after the mode was left again.
    if (!entryPosition) {
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
    // map.set('debugTileBorders', true);

    applyLabelPadding();
    applyFieldOfView();
    // A rotation changes the view's aspect and nothing else, and the aspect is the whole of what the
    // field-of-view cap is about.
    view.on('layoutChanged', applyFieldOfView);
    map.apply({
        // PLANAR, always. The globe was offered here so the earth would curve away under the far
        // ranges, and it cost far more than it bought - device-measured, panorama on a Crosscall:
        // 3-7x the surface fill draws, 74 ms frames against 27, and every reopen worse than the
        // last. Worse than the cost, it turns the mode's own mechanism OFF:
        // `TerrainRenderer::ensureSurfaceAttribs` reads
        //     bool fixedScale = normalSampleDistance > 0 && !spherical;
        // so on a globe the fixed-distance normals are unreachable and the surface falls back to the
        // mesh gradient - which inks every LOD tile boundary, the one thing
        // `peakFinderNormalSampleDistance` exists to prevent. It also makes `moveCameraTo` land close
        // rather than exact, because there a translation is a rotation.
        //
        // Curvature is still worth having (785 m of drop at 100 km) but not like this: it belongs in
        // the height field, not in the projection the camera, the tile transformer and every mesh are
        // built against. Read from no store on purpose - `peakFinderSpherical` was persisted true on
        // at least one device, so a changed DEFAULT would not have reached it.
        renderProjectionMode: 'RENDER_PROJECTION_MODE_PLANAR',
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
        // NO clearance clamp — and it takes BOTH of these. `cameraClearance` is only the floor; the
        // rule underneath it is a FRACTION of the camera's altitude (a sixteenth), which models an
        // orbiting map camera and is exactly wrong here: on a 4800 m summit it forced 320 m of
        // clearance, so the eye floated a third of a kilometre above the peak it stands on. That is
        // most of "the panorama opens in the sky looking down".
        // A panorama's eye height is chosen outright (`setFocusLift` below), so there is nothing for
        // either rule to protect against, and the ground keeps moving while elevation tiles stream
        // in — a clamp on it is the whole view rising and sinking until it settles.
        cameraClearance: 0,
        cameraClearanceFraction: 0,
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
        // The mesh cache, sized for a panorama instead of a map — see `peakFinderMeshCacheSize`.
        // Half of it is also the visible cut's budget, so this sets the LOD floor too.
        meshCacheSize: get(peakFinderMeshCacheSize),
        // NO EDGE STITCHING. It defaults to TRUE in the SDK, and it is actively harmful here: the
        // stitching mask is part of the mesh cache KEY, and the mask is built from which neighbours
        // are in the visible cut — so turning the camera remints the key for every tile whose
        // neighbour set changed, rebuilding its mesh and dropping it back to the cheap stand-in
        // normals until the worker catches up. Tiles therefore changed appearance purely with the
        // view direction, and changed back when the old key came round again.
        //
        // What it buys is nothing we need: this renderer's surfaces are SKIRTED, so a coarser
        // neighbour leaves no hole to fill (TerrainRenderer::collectTileMeshes says as much — it is
        // "an improvement rather than a fix"). Off, the key is the grid size alone and a tile's mesh
        // no longer depends on where the camera is pointing.
        tileEdgeStitchingEnabled: false,
        // NO SHARED GROUND. With draping off the SDK draws the terrain cover once in a flat colour
        // before any layer, so the layers have a ground to composite onto — but this map's only
        // layer is the summit names, which are billboards, and the relief surface shader has already
        // painted the terrain (with depth) in the same frame. So the ground pass drew the whole mesh
        // a SECOND time for nothing: measured on the Crosscall, `PROF` `drape` was 10.6 ms of a
        // 22.0 ms frame — the largest single item in the panorama — at 94 flat fills a frame,
        // `RenderStats surfaces fill=658` over 7 frames, with `drape bakes=0`.
        //
        // This is also what "am I seeing terrain over terrain?" was: literally yes.
        sharedGroundEnabled: false,
        // A summit sitting ON a ridge, or a metre behind it, is exactly what this view is for, so the
        // label occlusion is deliberately generous here.
        billboardOcclusionEnabled: true,
        billboardOcclusionTolerance: get(peakFinderOcclusion),
        // The LIVE summit tiles' LOD floor, and on this map nothing else's — see
        // `peakFinderTileCoarsening`. The terrain mesh has its own budget and never reads this.
        maxTileZoomCoarsening: get(peakFinderTileCoarsening),
        elevationPrefetchEnabled: true,
        // THE GRID CACHE, sized for a panorama's working set instead of a map's.
        //
        // The SDK's rule is a grid COUNT (`ElevationManager::MIN_CACHED_GRIDS`, 192), which is the
        // ground around one viewpoint at one zoom. This view reaches a hundred kilometres, so its
        // working set is several times that: measured, `RenderStats elevGrid` sat at
        // `bytes=335MB capacity=336MB` - exactly full - with 9-11 inserts a second FOREVER and
        // `distinctEver` climbing past 850. Every grid evicted was immediately asked for again.
        //
        // What that costs is not memory, it is CPU. Each ElevationManager runs three decode threads,
        // and a cache that never holds its working set keeps all of them busy for as long as the
        // mode is open. Per-thread on a Crosscall: six such threads burned ~34,600 ticks against the
        // render thread's 3,094 - eleven times the renderer - which is why the mode felt slow while
        // the renderer was idle, why the settings list scrolled badly, and why cutting the mesh
        // resolution barely moved it.
        elevationCacheSize: get(peakFinderElevationCacheSize)
    });
    // After the terrain exists — it is what carries these.
    applyNormalSampleDistance();
    applyTerrainZoomCap();
    applyNodeResolution();

    // The camera, placed rather than flown. Before the touch model below: in first person `setTilt`
    // and `setMapRotation` turn the view in PLACE, so a camera set afterwards would spin the view
    // where it stands instead of pointing it at the panorama.
    // `moveEyeTo`, not `moveTo`: this mode means STAND on the summit, and `moveTo` takes a FOCUS -
    // at this tilt the eye then sits kilometres behind the chosen point, looking at it, which is
    // not the view the user asked for. See MapCamera.moveEyeTo.
    camera().moveEyeTo(toPosition(entryPosition), {
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
    // BEFORE the layer, because the style bakes the eye's altitude into `text-rank` and a style is
    // text - getting it afterwards would mean rebuilding the decoder and the layer to correct it.
    // After the camera, because the viewpoint is where we now STAND. On a worker, and on DEM tiles
    // the terrain above has already pulled in, so this is a lookup rather than a load.
    eyeGroundElevation = await resolveEyeGroundElevation();
    buildPeaksLayer();
    // Not awaited: the layer above already draws, and this swaps it onto the collected set when it
    // has one. See `loadStaticPeaks`.
    loadStaticPeaks();
    // A tap on empty ground clears the chip, the way tapping the map elsewhere deselects.
    map.onClick(() => peakFinderSelectedPeak.set(null));
    // What the overlay's compass reads. Throttled: the view turns with every frame of a drag, and
    // the readout is a number on screen.
    // The camera is placed by now, so this is the first reading of the eye that means anything.
    updateViewpoint();
    publishHeading();
    // One listener for all three: a first-person two-finger drag MOVES the camera, so the same
    // events that turn the compass are the ones that walk the eye - out from under its summit set,
    // and away from whatever the chip's distances were measured against.
    map.onMove(
        () => {
            updateViewpoint();
            publishHeading();
            checkStaticPeaks();
        },
        { throttle: 100 }
    );
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
 *
 * Releasing the registration is not the same as releasing the OBJECT, though: the view outlives the
 * facade and holds the terrain itself. See the `setTerrainOptions(null)` below.
 */
export function teardownPanorama() {
    // IDEMPOTENT. One mode can produce two `onDestroy` calls (two component instances, or a
    // re-create), and the second ran against a torn-down panorama - every `?.` short-circuited and
    // the terrain detach below reported itself missing rather than doing nothing quietly.
    if (!panorama && !panoramaView) {
        return;
    }
    panoramaView?.off('layoutChanged', applyFieldOfView);
    panoramaView?.setPostProcessEffect(null);
    effect = null;
    effectUsesNormals = false;
    // THE LAYERS OFF THE MAP, before anything else is released. `destroy()` unregisters a facade
    // handle; it does not take the layer out of the view's native `Layers`, which holds a
    // shared_ptr. A layer that stays there keeps its TileRenderer, which keeps the
    // TerrainTileTransformer `TileLayer::resetTileTransformer` built for it, which keeps the
    // ElevationManager - and with it 3 prefetch threads that go on decoding DEM tiles for a
    // panorama nobody is looking at. Measured on a Crosscall: six such threads (two managers' worth)
    // burned ~34,600 CPU ticks against the render thread's 3,094, which is why the mode felt slow
    // while the renderer was not busy, and why the settings list scrolled badly.
    //
    // TileLayer DOES reset the transformer when the terrain goes (it compares `_terrainOptions.lock()`),
    // but that check runs from the layer's own update - and once the panorama stops drawing, it never
    // runs again. So the layer has to go, not just the terrain.
    try {
        panorama?.layers().clear();
    } catch (error) {
        DEV_LOG && console.log('peakFinder: could not clear the panorama layers', error);
    }
    peaksLayer = null;
    peaksDecoder = null;
    // Both are built ON the panorama's map, so `destroy()` below releases them - only the
    // references go here. `detailSourceAvailable` is a fact about the BUILD, so it survives.
    staticPeaksSource = null;
    staticPeaksFailed = false;
    detailPeaksSource = null;
    detailPeaksCache = null;
    // DETACH THE TERRAIN FIRST. `map.destroy()` releases the facade's own registration of the
    // TerrainOptions, but the VIEW keeps working by design ("Not the view: the object API's map
    // keeps working") - and the view's native Options still holds that TerrainOptions, which holds
    // the ElevationManager, which holds 3 prefetch threads and a grid cache sized by count (192
    // grids, 336 MB at the 1796 KB grids this DEM serves). Measured: RenderStats `managers` went
    // 1, 2, 3, 4 across two entries and never fell, so each visit left a gigabyte behind and the
    // prefetch threads of every dead panorama went on competing for the CPU.
    // Options::setTerrainOptions(null) unregisters its listener and drops the pointer.
    // The BRIDGE's options object first, exactly as `applyLabelPadding` does - that is the one that
    // resolves; the view wrapper's `getNative()` is the fallback that does not, which is why this
    // logged "cannot detach" on every exit while label padding written the other way worked.
    const options = ((panorama as { native?: { getOptions?: () => unknown } })?.native?.getOptions?.() ?? panoramaView?.getOptions?.()?.getNative?.()) as {
        setTerrainOptions?: (value: unknown) => void;
    };
    if (typeof options?.setTerrainOptions === 'function') {
        options.setTerrainOptions(null);
    } else {
        DEV_LOG && console.log('peakFinder: cannot detach the terrain, the elevation cache will outlive the panorama');
    }
    panorama?.destroy();
    panorama = null;
    panoramaView = null;
    // BORROWED, NOT OWNED - so dropped, never destroyed. `findDemSource` returns
    // `packageService.hillshadeLayer.source()` and `findPeaksSource` the live map's vector source;
    // destroying them tore down the LIVE map's own sources. The next entry then built its layer on a
    // dead handle ("Cannot create 'layer.peaks.2' of kind 'layer': RESULT_BAD_HANDLE"), the terrain
    // lost the warm caches that make the panorama appear at once, and the mode came up unusably slow.
    // Switching the map style appeared to cure it because that rebuilds the live layers, and their
    // sources with them - which is also why the cure lasted exactly one round and came without labels.
    demSource = null;
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
    peakFinderElevation.set(get(peakFinderMinElevation));
    peakFinderActive.set(false);
    viewpoint = null;
    entryPosition = null;
    eyeGroundElevation = 0;
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
    // The eye is about to land ON the summit, which is what `viewpoint` means. Written here rather
    // than left to the move event so a caller reading it straight after this is not one frame behind.
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
applyLive(peakFinderSlopeShade, applyReliefSurface);
applyLive(peakFinderOutlineWidth, applyReliefOutline);
applyLive(peakFinderHorizonBoost, applyReliefOutline);
applyLive(peakFinderCreaseStrength, applyReliefOutline);
applyLive(peakFinderCreaseThreshold, applyReliefOutline);
applyLive(peakFinderRidgeStrength, applyReliefOutline);
applyLive(peakFinderRidgeThreshold, applyReliefOutline);
applyLive(peakFinderRidgeGroundSpan, applyReliefOutline);
// Rebuilds the effect rather than writing a parameter: the two variants are two shaders.
applyLive(peakFinderNormalEdges, applyReliefOutline);
applyLive(peakFinderInkDistance, applyReliefOutline);
applyLive(peakFinderSilhouetteGate, applyReliefOutline);
applyLive(peakFinderInkShadeCap, applyReliefOutline);
// BOTH passes: view 7 is drawn by the SURFACE shader and the rest by the post-process, so a knob
// that only re-applied the outline left view 7 rendering the normal picture.
applyLive(peakFinderDebugView, () => {
    applyReliefSurface();
    applyReliefOutline();
});
applyLive(peakFinderHaze, () => {
    applyReliefSurface();
    applyReliefOutline();
});
applyLive(peakFinderOcclusion, () => terrain().set('billboardOcclusionTolerance', get(peakFinderOcclusion)));
applyLive(peakFinderViewDistance, () => terrain().set('viewDistanceFactor', get(peakFinderViewDistance)));
applyLive(peakFinderViewDistanceMetres, () => {
    terrain().set('viewDistance', get(peakFinderViewDistanceMetres));
    // It sizes the collected disc as well as the ground, so the set has to be re-cut to match.
    refreshStaticPeaks();
});
// The other three knobs that decide WHAT was collected rather than how it is drawn.
applyLive(peakFinderPeakZoom, () => {
    // Shared with the engine-side source, where it is the zoom the tiles are READ at. Written
    // rather than rebuilt: the source drops its own tiles when it changes.
    detailPeaksSource?.native?.setDetailZoom?.(get(peakFinderPeakZoom));
    detailPeaksCache?.native?.clear?.();
    refreshStaticPeaks();
});
applyLive(peakFinderPeakCount, refreshStaticPeaks);
applyLive(peakFinderPeakMinElevation, refreshStaticPeaks);
applyLive(peakFinderDetailLevels, applyDetailPeaksOptions);
applyLive(peakFinderDetailFeatures, applyDetailPeaksOptions);
// Switching it OFF wants the layer pointed back at whatever is behind it, and ON wants the source
// built - both of which `createPeaks` decides, so both are a rebuild.
applyLive(peakFinderDetailSource, rebuildPeaksLayer);
applyLive(peakFinderMeshResolution, () => terrain().set('meshResolution', get(peakFinderMeshResolution)));
// The height field, which is what the relief actually comes from - the mesh above is only the lattice
// drawn over it. Both re-decode every cached DEM grid.
applyLive(peakFinderNodeResolution, applyNodeResolution);
// Re-bakes the cached meshes' normals rather than re-decoding anything.
applyLive(peakFinderNormalSampleDistance, applyNormalSampleDistance);
applyLive(peakFinderTerrainMaxZoom, applyTerrainZoomCap);
// A re-cull, not a re-decode: `TileLayer` watches this one and drops its cull state when it moves.
applyLive(peakFinderTileCoarsening, () => terrain().set('maxTileZoomCoarsening', get(peakFinderTileCoarsening)));
applyLive(peakFinderTilt, () => panoramaView?.setTilt(get(peakFinderTilt), 0));
applyLive(peakFinderMaxFieldOfView, applyFieldOfView);
applyLive(peakFinderLensCorrection, applyFieldOfView);
applyLive(peakFinderLabelPinTop, rebuildPeaksLayer);
applyLive(peakFinderLabelBand, rebuildPeaksLayer);
applyLive(peakFinderLabelAngle, rebuildPeaksLayer);
applyLive(peakFinderLabelRows, rebuildPeaksLayer);
applyLive(peakFinderLabelMinDistance, rebuildPeaksLayer);
applyLive(peakFinderLabelPersist, rebuildPeaksLayer);
applyLive(peakFinderLabelFollowSkyline, rebuildPeaksLayer);
// An OPTION, not style text — so it is written, not re-decoded.
applyLive(peakFinderLabelPadding, applyLabelPadding);
applyLive(peakFinderLabelMaxDistance, rebuildPeaksLayer);
// Turning it off puts the live tiles back at once; turning it back on is free, because the
// collected source is kept rather than dropped - it belongs to the panorama's map, which has one
// summit set per viewpoint and releases it with everything else.
applyLive(peakFinderStaticPeaks, () => {
    if (get(peakFinderStaticPeaks) && !staticPeaksSource) {
        loadStaticPeaks();
    } else {
        rebuildPeaksLayer();
    }
});
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
    entryPosition = null;
    eyeGroundElevation = 0;
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
