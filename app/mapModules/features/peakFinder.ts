import * as api from '@nativescript-community/ui-massifmaps/api';
import type { MassifLayer, MassifMap, MassifSource, Position } from '@nativescript-community/ui-massifmaps/api';
import type { MassifMap as MassifMapView } from '@nativescript-community/ui-massifmaps/ui';
import { showBottomSheet } from '@nativescript-community/ui-material-bottomsheet/svelte';
import { Color, File, Folder, Screen, knownFolders, path } from '@nativescript/core';
import { showError } from '@shared/utils/showError';
import { showToast, tryCatchFunction } from '@shared/utils/ui';
import { get } from 'svelte/store';
import { lc } from '~/helpers/locale';
import { type FeatureClickData, featureClickData, getMapContext } from '~/mapModules/MapModule';
import { registerMapFeature } from '~/mapModules/mapFeatures';
import { registerMapModule } from '~/mapModules/registry';
import { GEO_THREE, PEAKFINDER_LOOK, RELIEF_DEFAULTS, RELIEF_SURFACE_SHADER, reliefPalette, reliefSilhouetteShader } from '~/mapModules/terrain/reliefShaders';
import { PANORAMA_PEAKS_LAYER, collectPanoramaPeaks, peaksToGeoJSON } from '~/mapModules/terrain/panoramaPeaks';
import { peaksStyle } from '~/mapModules/terrain/peaksStyle';
import { type PeakFinderSkyContext, clearSkySelection, raiseSkySelection, setupSkySelection, skyMoment, teardownSkySelection } from '~/mapModules/features/peakFinderCelestial';
import { setupPeakFinderMoon, teardownPeakFinderMoon, updatePeakFinderMoon } from '~/mapModules/features/peakFinderMoon';
import { setupPeakFinderStars, teardownPeakFinderStars, updatePeakFinderStars } from '~/mapModules/features/peakFinderStars';
import { raisePeakFinderSun, setupPeakFinderSun, sunPositionAt, teardownPeakFinderSun, updatePeakFinderSun } from '~/mapModules/features/peakFinderSun';
import type { IItem } from '~/models/Item';
import { packageService } from '~/services/PackageService';
import { nutiProps } from '~/stores/mapStore';
import {
    PANORAMA_RANGE,
    isPeakFinderDark,
    peakFinderActive,
    peakFinderArActive,
    peakFinderArDark,
    peakFinderArHorizonBoost,
    peakFinderArOutlineWidth,
    peakFinderDark,
    peakFinderDetailFeatures,
    peakFinderDetailLevels,
    peakFinderDetailSource,
    peakFinderElevation,
    peakFinderElevationCacheSize,
    peakFinderEnabled,
    peakFinderExaggeration,
    peakFinderFlyElevation,
    peakFinderFlyZoom,
    peakFinderHeading,
    peakFinderHeadingFollowing,
    peakFinderHillshade,
    peakFinderHorizonBoost,
    peakFinderLabelAngle,
    peakFinderLabelLayout,
    peakFinderLabelMaxDistance,
    peakFinderLabelMinDistance,
    peakFinderLabelPadding,
    peakFinderLabelPersist,
    peakFinderLabelRowHeight,
    peakFinderLabelRows,
    peakFinderLabelTextSize,
    peakFinderLabelWrap,
    peakFinderLensCorrection,
    peakFinderMaxFieldOfView,
    peakFinderMeshCacheSize,
    peakFinderMeshResolution,
    peakFinderMinElevation,
    peakFinderOcclusion,
    peakFinderOutlineWidth,
    peakFinderPeakCount,
    peakFinderPeakMinElevation,
    peakFinderPeakZoom,
    peakFinderScreenOrientation,
    peakFinderSelectedPeak,
    peakFinderSkyPanel,
    peakFinderSkyTime,
    peakFinderStars,
    peakFinderStarsLabelsOnSummits,
    peakFinderStaticPeaks,
    peakFinderSun,
    peakFinderTerrainMaxZoom,
    peakFinderTileCoarsening,
    peakFinderTilt,
    peakFinderViewDistance,
    peakFinderViewDistanceMetres,
    terrainCameraClearance,
    terrainSunAltitude,
    terrainSunAzimuth
} from '~/stores/terrainStore';
import { type CameraFieldOfView, type CameraPreviewInfo, type LensDistortion, type PreviewGeometrySource, cameraFieldOfView } from '~/utils/cameraFov';
import { type MapPos, bearingBetween, computeDistanceBetween, fromPosition, toPosition } from '~/utils/geo';
import { lockOrientation } from '~/utils/orientation';

// The panorama is a second map mounted over the live one (`components/peaks/PeakFinderMap.svelte`). It
// shares the live map's DEM and vector sources by handle, so their cached tiles are reused.

/** Two maps in one app must not share the `map` registry id. */
export const PANORAMA_MAP_ID = 'map.peakFinder';
const PEAKS_LAYER_ID = 'layer.peaks';
const PEAKS_DECODER_ID = 'decoder.peaks';
/** Fixed, not generation-stamped: one summit set per panorama. */
const STATIC_PEAKS_SOURCE_ID = 'source.peaks.static';
const DETAIL_PEAKS_SOURCE_ID = 'source.peaks.detail';
const DETAIL_PEAKS_CACHE_ID = 'source.peaks.detail.cache';
const DETAIL_PEAKS_BASE_ID = 'source.peaks.detail.base';
const DETAIL_PEAKS_STORE_ID = 'source.peaks.detail.store';
/** A rebuild reads 64 detail tiles, 1-2 s per coarse tile on a Crosscall. */
const DETAIL_PEAKS_STORE_BYTES = 64 * 1024 * 1024;
const DETAIL_PEAKS_STORE_FOLDER = 'peakfinder_cache';
/**
 * Rebuilding one coarse tile reads 4^levels finer ones (64 by default), so a miss costs 64 reads and a
 * rebuild. The SDK default (6 MB) is sized for raster tiles.
 */
const DETAIL_PEAKS_CACHE_BYTES = 32 * 1024 * 1024;
const EFFECT_ID = 'relief_outline';
/** A transparent sky colour is how the legacy sky BITMAP is turned off — see `applyAtmosphere`. */
const NO_SKY_BITMAP = 0;

let panorama: MassifMap = null;
/** For what the surface API has no verb for: the effect and the surface shader. */
let panoramaView: MassifMapView = null;
/** The live map's own sources, shared by handle. */
let demSource: MassifSource = null;
let peaksSource: MassifSource = null;
let staticPeaksSource: MassifSource = null;
let detailPeaksSource: MassifSource = null;
/** Wraps the detail source; what the layer actually reads. */
let detailPeaksCache: MassifSource = null;
/** Disk cache between the detail source and the memory cache. */
let detailPeaksStore: MassifSource = null;
/** The base map files the detail source reads, without the contours and routes merged into the map's. */
let detailPeaksBase: MassifSource = null;
let detailSourceAvailable: boolean | undefined;
let peaksLayer: MassifLayer = null;
let peaksDecoder: api.MassifObject<'massif::MBVectorTileDecoder'> = null;
/** Bumped per rebuild, so a new layer/decoder pair never collides with the one still on the map. */
let peaksGeneration = 0;
let effect = null;
let effectVariant = '';
/** The live EYE position, not the camera focus nor the entry point: distances and bearings are measured from it. */
let viewpoint: MapPos = null;
/** Where the camera is aimed at setup, and only that. */
let entryPosition: MapPos = null;
/**
 * Ground height under the eye, metres, from the DEM: `camera().eyePosition()` carries no usable altitude.
 * The eye is this plus `peakFinderElevation`.
 */
let eyeGroundElevation = 0;
/** Taken from the live map, so the view opens as the map looked. */
let initialRotation = 0;
/** Whether AR is what started the orientation sensors, so turning it off knows to stop them. */
let arStartedFollowing = false;
/** Handed over from `Map.svelte`: only the view owning the session can report the preview geometry. */
let arPreview: PreviewGeometrySource = null;

function terrain() {
    return panorama?.terrain();
}

function camera() {
    return panorama?.camera();
}

/** The SDK's own vertical field of view, which is the widest this mode ever asks for. */
const DEFAULT_FIELD_OF_VIEW_Y = 70;

const TO_RADIANS = Math.PI / 180;
const TO_DEGREES = 180 / Math.PI;

/**
 * The SDK takes only the vertical field and derives the horizontal from the aspect (`ViewState.cpp`), so a
 * horizontal half-angle H becomes atan(tan(H) / aspect). Outside AR it is a cap: min with the SDK default.
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

function cameraHorizontalField(): number {
    if (cameraLens === undefined) {
        cameraLens = cameraFieldOfView();
    }
    return cameraLens?.horizontal > 0 ? cameraLens.horizontal : DEFAULT_FIELD_OF_VIEW_Y;
}

function arPreviewInfo(): CameraPreviewInfo | null {
    // `getPreviewInfo` is newer than the resolved ui-cameraview: without it `arGeometry` falls back to the
    // sensor aspect and zoom 1 (the preview pins pinch zoom off).
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

interface ArGeometry {
    /** Half-field tangents of what the preview SHOWS, (horizontal, vertical), in view orientation. */
    screenTan: [number, number];
    /** ...and of what has to be RENDERED so the lens warp has something to read at the corners. */
    renderTan: [number, number];
    /** Whether the view is a quarter turn from the camera's landscape frame. */
    rotated: boolean;
    distortion: LensDistortion | null;
}

/** Brown-Conrady inverse; must match the shader's loop exactly or the warp does not cancel. */
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
 * Matches the field VISIBLE on screen (after the preview's rotation and cover/contain crop, all read from
 * `getPreviewInfo`), plus a wider render field so the lens warp has pixels at the corners.
 * Not capped by `peakFinderMaxFieldOfView`: in AR the field is a measurement.
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
    // the stream's aspect, not the sensor's: 16:9 is a vertical crop of a 4:3 sensor
    const frameAspect = preview && preview.width > 0 && preview.height > 0 ? Math.max(preview.width, preview.height) / Math.min(preview.width, preview.height) : lens.aspect;
    const tanHalfNarrow = tanHalfWide / frameAspect;
    const rotated = preview ? preview.rotation === 90 || preview.rotation === 270 : viewAspect < 1;
    const streamTan: [number, number] = rotated ? [tanHalfNarrow, tanHalfWide] : [tanHalfWide, tanHalfNarrow];
    const streamAspect = streamTan[0] / streamTan[1];
    // a contain fit leaves letterbox, and drawing terrain there is intended
    const covers = !preview || (preview.stretch !== 'aspectFit' && preview.stretch !== 'fitCenter' && preview.stretch !== 'fitStart' && preview.stretch !== 'fitEnd');
    const fitScale = covers ? Math.max(viewAspect / streamAspect, 1) : Math.min(viewAspect / streamAspect, 1);
    const screenTan: [number, number] = [(streamTan[0] * viewAspect) / (streamAspect * fitScale), streamTan[1] / fitScale];

    const distortion = get(peakFinderLensCorrection) ? lens.distortion : null;
    if (!distortion) {
        return { screenTan, renderTan: screenTan, rotated, distortion: null };
    }
    // undistort all four corners (the principal point is off-centre) to bound the render surplus;
    // never below 1, a pincushion lens needs no extra
    let scale = 1;
    for (const signX of [-1, 1]) {
        for (const signY of [-1, 1]) {
            const cornerView: [number, number] = [signX * screenTan[0], signY * screenTan[1]];
            const ideal = undistort(rotated ? [cornerView[1], -cornerView[0]] : cornerView, distortion);
            const idealView: [number, number] = rotated ? [-ideal[1], ideal[0]] : ideal;
            scale = Math.max(scale, Math.abs(idealView[0]) / screenTan[0], Math.abs(idealView[1]) / screenTan[1]);
        }
    }
    // ...plus a hair, so the outermost pixel reads inside the render, not its clamped edge
    scale *= 1.005;
    return { screenTan, renderTan: [screenTan[0] * scale, screenTan[1] * scale], rotated, distortion };
}

/**
 * Re-applied on every layout: a rotation changes the aspect. Written unrounded: half a degree of rounding
 * is ~1.6% of scale at a landscape AR field.
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

/** Written on the NATIVE options: the plugin's generated schema does not know this option yet. */
function applyLabelPadding() {
    // the bridge's options object is the one the renderer reads, not the view's wrapper
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
 * Either the bridge's terrain or the view's wrapper carries the native object, depending on the build;
 * a write to the wrong one silently does nothing.
 */
function terrainNative(): Record<string, (value: unknown) => void> {
    const fromBridge = (terrain() as { native?: Record<string, (value: unknown) => void> })?.native;
    return fromBridge ?? (panoramaView?.getTerrainOptions?.()?.getNative?.() as Record<string, (value: unknown) => void>);
}

/** Capping the mesh zoom lets the height field settle, and with it the labels and the camera. */
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
 * geo-three's terrain cut, full-resolution depth (half makes the skyline staircase) and the ridge-ink
 * sample span. Native: none of the three is in the plugin's generated schema.
 */
function applyGeoThreeTerrain() {
    const native = terrainNative();
    if (typeof native?.setSubdivideDistance !== 'function') {
        DEV_LOG && console.log('peakFinder: geo-three terrain cut not in this SDK build, the SDK cut is used');
    } else {
        native.setSubdivideDistance(GEO_THREE.subdivideDistance);
    }
    native?.setPostProcessDownscale?.(1);
    native?.setNormalSampleDistance?.(PEAKFINDER_LOOK.normalSampleDistance);
}

function currentFieldOfViewY(): number {
    const width = panoramaView?.getMeasuredWidth() ?? 0;
    const height = panoramaView?.getMeasuredHeight() ?? 0;
    if (!(width > 0) || !(height > 0)) {
        return DEFAULT_FIELD_OF_VIEW_Y;
    }
    return Math.max(10, fieldOfViewY(width / height));
}

/** `peakFinderFlyZoom` corrected for the field of view; every camera write goes through it. */
function effectiveZoom(): number {
    return zoomForFieldOfView(currentFieldOfViewY());
}

/**
 * The camera sits at zoom0Distance / 2^zoom and zoom0Distance scales with 1/tan(fovY/2), so a narrower
 * field moves it further. Adding log2 of the ratio keeps it in place: the cap stays a crop.
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
 * Always writes every parameter, zeroes included: an effect keeps its last values. Applied with the field
 * of view: the render is wider than the screen and the warp brings it back.
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
    // 1 when there is no warp: these are divisors (never read then)
    effect.setFloatParameter('uDistortScreenTanX', geometry?.screenTan[0] ?? 1);
    effect.setFloatParameter('uDistortScreenTanY', geometry?.screenTan[1] ?? 1);
    effect.setFloatParameter('uDistortRenderTanX', geometry?.renderTan[0] ?? 1);
    effect.setFloatParameter('uDistortRenderTanY', geometry?.renderTan[1] ?? 1);
    effect.setFloatParameter('uDistortRotate', geometry?.rotated ? 1 : 0);
}

/** `auto` turns with the device even when the system is locked to portrait: a panorama wants landscape. */
function screenOrientation() {
    const orientation = get(peakFinderScreenOrientation);
    return orientation === 'auto' ? 'sensor' : orientation;
}

function palette() {
    return reliefPalette(isPeakFinderDark());
}

function argb(color: string) {
    return new Color(color).argb;
}

export function isPeakFinderActive() {
    return get(peakFinderActive);
}

/** Shared by handle, not reopened, so the tiles the live map already read are in its caches. */
function findDemSource(): MassifSource {
    return packageService.hillshadeLayer?.source() ?? null;
}

/** Offline package first, else the first enabled vector layer. */
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

/** The map's label size preference, so summit names match its labels. */
function mapFontScale(): number {
    const store = nutiProps.getSettingsOptions('_fontscale')?.store;
    return store ? get(store) || 1 : 1;
}

/** Auto: the height of a name wrapped at `peakFinderLabelWrap` at the label angle, plate included. */
let builtRowFraction = 0;
function labelRowFraction() {
    const height = (panoramaView?.getMeasuredHeight() ?? 0) / Screen.mainScreen.scale;
    let row = get(peakFinderLabelRowHeight);
    if (!(row > 0)) {
        const size = get(peakFinderLabelTextSize) * mapFontScale();
        const width = (get(peakFinderLabelWrap) || 160) + size * 2.5 + 10;
        const angle = get(peakFinderLabelAngle) * TO_RADIANS;
        row = width * Math.sin(angle) + (size * 2.6 + 4) * Math.cos(angle) + 10;
    }
    builtRowFraction = height > 0 ? Math.min(0.9, row / height) : 0.2;
    return builtRowFraction;
}

/** A rotation changes the height, so the fraction: rebuilt when it moved. */
function onPanoramaLayout() {
    applyFieldOfView();
    const previous = builtRowFraction;
    if (Math.abs(labelRowFraction() - previous) > 0.005) {
        rebuildPeaksLayer();
    }
}

/** With stars and labels-on-summits on, follow the skyline to keep the sky clear. */
function labelLayout() {
    return get(peakFinderStars) && get(peakFinderStarsLabelsOnSummits) ? 'skyline' : get(peakFinderLabelLayout);
}

function currentPeaksStyle() {
    return peaksStyle({
        dark: isPeakFinderDark(),
        // baked in: CartoCSS has no camera height, and the style is rebuilt when the viewpoint changes
        eyeElevation: eyeGroundElevation + get(peakFinderElevation),
        fontScale: mapFontScale(),
        pinTop: labelLayout() === 'top',
        followSkyline: labelLayout() === 'skyline',
        band: labelRowFraction(),
        // A row held at a fixed height is held at the band's.
        topOffset: labelRowFraction(),
        textSize: get(peakFinderLabelTextSize),
        wrapWidth: get(peakFinderLabelWrap),
        selectedFill: isPeakFinderDark() ? '#a8c0ff' : '#2f4f9e',
        textAngle: get(peakFinderLabelAngle),
        maxRows: get(peakFinderLabelRows),
        minDistance: get(peakFinderLabelMinDistance),
        persistPasses: get(peakFinderLabelPersist),
        maxDistance: get(peakFinderLabelMaxDistance)
    });
}

/** Ids carry a generation: a rebuild stands its new layer up while the old one is still on the map. */
function createPeaks(): { layer: MassifLayer; decoder: api.MassifObject<'massif::MBVectorTileDecoder'> } {
    // engine-side source first (no viewpoint needed), then the collected snapshot, then the raw tiles.
    // The store is read here so switching the snapshot off falls back to the live tiles.
    const source = ensureDetailPeaksSource() ?? (get(peakFinderStaticPeaks) ? staticPeaksSource : null) ?? peaksSource;
    if (!panorama || !source) {
        return null;
    }
    peaksGeneration += 1;
    const css = currentPeaksStyle();
    DEV_LOG &&
        console.log(
            'peakFinder: label style',
            JSON.stringify(css.split('\n').filter((line) => /callout-screen-anchor|callout-max-rows|callout-align|text-orientation|text-min-distance|callout-step|text-size|text-rank/.test(line)))
        );
    const decoder = panorama.style(`${PEAKS_DECODER_ID}.${peaksGeneration}`, {
        type: 'mbvt',
        cartocss: { type: 'cartocss', css }
    });
    applySelectedPeak(decoder);
    const layer = panorama.buildLayer(`${PEAKS_LAYER_ID}.${peaksGeneration}`, {
        type: 'vector',
        source: source.handle,
        style: decoder.id,
        preloading: true,
        // The labels are the only thing drawn over the relief, so they go last.
        labelRenderOrder: 'VECTOR_TILE_RENDER_ORDER_LAST',
        tileSubstitutionPolicy: 'TILE_SUBSTITUTION_POLICY_VISIBLE'
        // no `postProcessed: false`: first post-process opt-out switches to the blend-blit path
        // and the panorama renders visibly darker
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
 * Written on the NATIVE object: the facade maps a spec type newer than its generated schema to
 * `massif::Layer`, so property writes miss. Constructor spec args (`detailZoom`) do arrive.
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
}

/**
 * The base map alone: the map's source merges contours and routes behind one lock, and summits are only
 * in the base file. Half the time.
 */
function detailPeaksBaseSource(): MassifSource {
    const files = packageService.localBaseMbtiles;
    if (!files?.length) {
        return peaksSource;
    }
    const specs = files.map((file) => ({ type: 'mbtiles' as const, path: file }));
    const spec = specs.reduce((first, second) => ({ type: 'ordered' as const, source: first, source2: second }) as unknown as (typeof specs)[0]);
    detailPeaksBase = panorama.source(DETAIL_PEAKS_BASE_ID, spec);
    return detailPeaksBase;
}

/**
 * The disk cache's file, named for everything that decides what a rebuilt tile holds - so a change
 * opens another file rather than serving stale tiles. Older files are removed.
 */
function detailPeaksStorePath() {
    const folder = Folder.fromPath(path.join(knownFolders.temp().path, DETAIL_PEAKS_STORE_FOLDER));
    const files = packageService.localBaseMbtiles ?? [];
    const signature = files.map((file) => `${file}:${File.exists(file) ? File.fromPath(file).size : 0}`).join('|');
    let hash = 0;
    for (let index = 0; index < signature.length; index++) {
        hash = (hash * 31 + signature.charCodeAt(index)) | 0;
    }
    const name = `peaks.${get(peakFinderPeakZoom)}.${get(peakFinderDetailLevels)}.${get(peakFinderDetailFeatures)}.${(hash >>> 0).toString(16)}.db`;
    folder
        .getEntitiesSync()
        .filter((entity) => entity.name !== name && entity.name.startsWith('peaks.'))
        .forEach((entity) => File.fromPath(entity.path).removeSync());
    return path.join(folder.path, name);
}

function resetDetailPeaksSource() {
    for (const source of [detailPeaksCache, detailPeaksStore, detailPeaksSource, detailPeaksBase]) {
        source?.destroy();
    }
    detailPeaksCache = detailPeaksStore = detailPeaksSource = detailPeaksBase = null;
}

function ensureDetailPeaksSource(): MassifSource {
    if (!get(peakFinderDetailSource) || !panorama || !peaksSource || detailSourceAvailable === false) {
        return null;
    }
    if (detailPeaksCache) {
        return detailPeaksCache;
    }
    try {
        // cast: the generated spec union predates this source (hence the try/catch too)
        const spec = { type: 'point-detail', source: detailPeaksBaseSource().handle, layer: PANORAMA_PEAKS_LAYER, detailZoom: get(peakFinderPeakZoom) } as unknown as Parameters<
            typeof panorama.source
        >[1];
        detailPeaksSource = panorama.source(DETAIL_PEAKS_SOURCE_ID, spec);
        applyDetailPeaksOptions();
        detailPeaksStore = panorama.source(DETAIL_PEAKS_STORE_ID, {
            type: 'persistent-cache',
            source: detailPeaksSource.handle,
            capacity: DETAIL_PEAKS_STORE_BYTES,
            databasePath: detailPeaksStorePath()
        });
        // the layer reads the memory cache, so a dropped tile is not 64 reads and a rebuild
        detailPeaksCache = panorama.source(DETAIL_PEAKS_CACHE_ID, {
            type: 'memory-cache',
            source: detailPeaksStore.handle,
            capacity: DETAIL_PEAKS_CACHE_BYTES
        });
        detailSourceAvailable = true;
        DEV_LOG && console.log('peakFinder: summit detail source built, detail zoom', get(peakFinderPeakZoom));
    } catch (error) {
        detailSourceAvailable = false;
        resetDetailPeaksSource();
        DEV_LOG && console.log('peakFinder: no PointDetailTileDataSource in this SDK build', error);
    }
    return detailPeaksCache;
}

function currentEye(): MapPos {
    const position = camera()?.eyePosition();
    return position ? fromPosition(position) : null;
}

/** 0 on failure: the rank is then measured from sea level rather than showing no labels. */
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

function updateViewpoint() {
    const eye = currentEye();
    if (eye) {
        viewpoint = eye;
    }
}

/** The margin is the hysteresis: no recollection until the eye has moved viewDistance x (MARGIN - 1). */
const PEAKS_COLLECT_MARGIN = 1.25;

let staticPeaksCentre: MapPos = null;
let staticPeaksRadius = 0;
/** The declared layer inside `staticPeaksSource`; a refresh replaces its document rather than it. */
let staticPeaksLayerIndex = 0;
/** One sweep at a time. Two would read the same tiles twice and race on the document. */
let staticPeaksLoading = false;
/**
 * A failed sweep is not retried: no collected centre is the retry condition, and a sweep reads thousands
 * of tiles on every move event.
 */
let staticPeaksFailed = false;

/** The snapshot is only the fallback for a build without `PointDetailTileDataSource`. */
function staticPeaksNeeded(): boolean {
    return get(peakFinderStaticPeaks) && !ensureDetailPeaksSource();
}

/**
 * Fire and forget: the live layer draws until the sweep lands. A refresh is `setGeoJSON` in place so the
 * layer never moves; only the first collection swaps the layer's source.
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
        // only the map going away matters: an outdated set is still better than none
        if (!peaks.length || !panorama) {
            DEV_LOG && console.log('peakFinder: no static summit set', peaks.length);
            return;
        }
        const first = !staticPeaksSource;
        if (first) {
            // minZoom 0 / maxZoom 24: the set is in memory, so every zoom serves all of it
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
        // not worth a dialog (the live layer still works), nor a retry: see `staticPeaksFailed`
        staticPeaksFailed = true;
        DEV_LOG && console.log('peakFinder: collecting the summit set failed, not retrying', error);
    } finally {
        staticPeaksLoading = false;
    }
}

/** Recollects once the collected disc no longer reaches the full view distance from the eye. */
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

function refreshStaticPeaks() {
    staticPeaksCentre = null;
    staticPeaksRadius = 0;
    // The knobs that size the sweep are also the ones that can make a failing one succeed, so
    // changing any of them is what clears the refusal.
    staticPeaksFailed = false;
    loadStaticPeaks();
}

/** Label knobs are style TEXT, hence a new decoder; swapped in place to keep its stack position. */
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
    raisePeakFinderSun();
    raiseSkySelection();
    previousLayer.destroy();
    previousDecoder?.destroy();
}

/** The shader source is a facade property but its uniforms are not, so they go through the view's object API. */
function applyReliefSurface() {
    if (!panorama) {
        return;
    }
    const colors = palette();
    // no surface shader in AR (the ground is the camera preview); the ridge lines still come from the
    // post-process effect off the terrain depth
    terrain().set('surfaceShaderSource', get(peakFinderArActive) ? '' : RELIEF_SURFACE_SHADER);
    const terrainOptions = panoramaView?.getTerrainOptions();
    if (!terrainOptions) {
        return;
    }
    terrainOptions.setSurfaceColorParameter('uPaperColor', colors.paper);
    terrainOptions.setSurfaceColorParameter('uShadeColor', colors.shade);
    terrainOptions.setSurfaceParameter('uRidgeInkStrength', PEAKFINDER_LOOK.ridgeInk);
    terrainOptions.setSurfaceParameter('uSlopeShade', 0);
    terrainOptions.setSurfaceParameter('uShadeStrength', 0);
    terrainOptions.setSurfaceParameter('uAmbient', PEAKFINDER_LOOK.ambient);
    terrainOptions.setSurfaceParameter('uInkCap', PEAKFINDER_LOOK.inkCap);
    terrainOptions.setSurfaceParameter('uHillshade', get(peakFinderHillshade));
}

/** Silhouettes (operator 2) and the skyline stroke. Object API only: the surface API has no `postProcessEffect`. */
function applyReliefOutline() {
    if (!panoramaView) {
        return;
    }
    const colors = palette();
    // The shader is COMPILED for what it draws - see reliefSilhouetteShader - so AR and a line wider
    // than a pixel each want their own.
    const ar = get(peakFinderArActive);
    // AR's own widths when set, 0 falling back to the panorama's.
    const outlineWidth = (ar && get(peakFinderArOutlineWidth)) || get(peakFinderOutlineWidth);
    const rings = Math.min(3, Math.max(0, Math.ceil(outlineWidth) - 1));
    const variant = `${ar ? 'ar' : 'view'}.${rings}`;
    if (!effect || effectVariant !== variant) {
        // Required lazily: `renderers` is object-API code that nothing else in the app pulls in.
        const { PostProcessEffect } = require('@nativescript-community/ui-massifmaps/renderers');
        effect = new PostProcessEffect({ name: `${EFFECT_ID}.${variant}`, fragmentShader: reliefSilhouetteShader({ ar, rings }) });
        effect.terrainDepthRequired = true;
        effectVariant = variant;
    }
    const skylineWidth = (ar && get(peakFinderArHorizonBoost)) || get(peakFinderHorizonBoost);
    effect.setFloatParameter('uOperator', 2);
    effect.setFloatParameter('uIntensity', PEAKFINDER_LOOK.silhouetteInk);
    effect.setFloatParameter('uOutlineWidth', outlineWidth);
    effect.setFloatParameter('uOutlineGain', PEAKFINDER_LOOK.silhouetteGain);
    effect.setFloatParameter('uOutlinePower', 1);
    effect.setFloatParameter('uOutlineFloor', PEAKFINDER_LOOK.silhouetteFloor);
    effect.setFloatParameter('uOutlineCeiling', 1);
    effect.setFloatParameter('uInkSky', 0);
    effect.setFloatParameter('uHorizonBoost', skylineWidth > 0 ? PEAKFINDER_LOOK.skylineInk : 0);
    effect.setFloatParameter('uHorizonWidth', Math.max(skylineWidth, 1));
    // The outline effect's uFar is in INTERNAL units and its depth range is in metres.
    effect.setFloatParameter('uMetersPerUnit', RELIEF_DEFAULTS.metersPerUnit);
    // AR draws the ink alone, over the camera preview — see the shader's own note.
    effect.setFloatParameter('uTransparent', get(peakFinderArActive) ? 1 : 0);
    effect.setColorParameter('uInkColor', colors.ink);
    applyLensCorrection();
    panoramaView.setPostProcessEffect(effect);
}

/**
 * No sky: the sky shader, the legacy sky bitmap (off via transparent `skyColor`) and the background plane
 * (off via null `backgroundBitmap`) must all be off, each leaves a band. Needs no terrain, so it runs first.
 */
function applyBackground() {
    panorama?.apply({
        skyColor: NO_SKY_BITMAP,
        backgroundBitmap: null,
        clearColor: get(peakFinderArActive) ? 0 : argb(palette().paper)
    });
}

function applyAtmosphere() {
    if (!panorama) {
        return;
    }
    panorama.sky({ type: 'sky' }).apply({ enabled: false, shaderSource: '' });
    panorama.fog({ type: 'fog' }).set('enabled', false);
    applyBackground();
    terrain().set('backgroundColor', get(peakFinderArActive) ? 0 : argb(palette().paper));
}

/**
 * The real sun at the chosen moment while it is up, else the 3D mode's. Overrides the style's sun, with no
 * shadows: the surface shader draws all the light.
 */
const LIT_BY_THE_SUN_ABOVE = 2;
function applySun() {
    let sunAzimuth = get(terrainSunAzimuth);
    let sunAltitude = get(terrainSunAltitude);
    const eye = viewpoint ?? entryPosition;
    if (get(peakFinderSun) && eye) {
        const sun = sunPositionAt(skyMoment(), eye);
        if (sun.altitude > LIT_BY_THE_SUN_ABOVE) {
            sunAzimuth = sun.azimuth;
            sunAltitude = sun.altitude;
        }
    }
    panorama?.light({ type: 'light' }).apply({
        sunOverridingStyle: true,
        sunAzimuth,
        sunAltitude,
        shadowStrength: 0
    });
}

/** The label palette is style text, hence the decoder rebuild. */
function applyPalette() {
    updatePeakFinderMoon();
    updatePeakFinderStars();
    applyReliefSurface();
    applyReliefOutline();
    applyAtmosphere();
    rebuildPeaksLayer();
}

/**
 * Not a camera position: with terrain the renderer re-sits the focus on the ground every frame.
 * `focusLift` is added on top of the ground-following rule, so it survives.
 */
function setFocusLift(metres: number) {
    terrain()?.set('focusLift', Math.max(0, metres));
}

/** Rotation is the opposite of the heading. Kept in a store: the overlay has no map of its own. */
function publishHeading() {
    const rotation = camera()?.rotation() ?? 0;
    peakFinderHeading.set(((-rotation % 360) + 360) % 360);
}

/** On iOS `activeFormat` is the session's only once the session opens, so the field is re-read then. */
export function onArCameraOpen(preview: PreviewGeometrySource) {
    arPreview = preview;
    applyFieldOfView();
}

export const applyViewpointElevation = tryCatchFunction(async (metres: number) => {
    setFocusLift(metres);
});

export function currentViewpointElevation(): number {
    return terrain()?.get('focusLift') ?? 0;
}

function itemPosition(item: IItem): MapPos {
    const coordinates = item.geometry['coordinates'];
    return { lat: coordinates[1], lon: coordinates[0] };
}

/** Touches no map: flipping the store mounts `PeakFinderMap.svelte`, whose map calls `setupPanorama`. */
export const enterPeakFinder = tryCatchFunction(async (item: IItem) => {
    if (isPeakFinderActive()) {
        return;
    }
    if (!packageService.hasElevation()) {
        // the item action is gated on this: only a DEM gone between row build and tap gets here
        showToast(lc('no_elevation_data'));
        return;
    }
    entryPosition = itemPosition(item);
    // Stands in until the camera is placed and `updateViewpoint` can read the eye for real.
    viewpoint = entryPosition;
    initialRotation = getMapContext().getMap()?.camera().rotation() ?? 0;
    peakFinderSelectedPeak.set(null);
    // never on the ground: the eye inside the height field's sampling error hides the panorama
    peakFinderElevation.set(Math.max(get(peakFinderMinElevation), get(peakFinderFlyElevation)));
    lockOrientation(screenOrientation());
    peakFinderActive.set(true);
});

/** Everything is written before the camera is placed, so the first frame is already the panorama. */
export const setupPanorama = tryCatchFunction(async (map: MassifMap, view: MassifMapView) => {
    // `mapReady` can fire twice per mode (activity re-create, second mount): tear the old one down or its
    // ids collide (RESULT_BAD_HANDLE) and the panorama goes blank
    if (panorama && panorama !== map) {
        teardownPanorama();
    }
    panorama = map;
    panoramaView = view;
    if (__ANDROID__) {
        // Above the live map's surface from the start - see setMapTranslucent.
        view.mapView?.setZOrderMediaOverlay?.(true);
    }
    applyBackground();
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

    // no label view-distance cut: maplibre's 5x camera-to-focus rule lands ~10 km out in a panorama.
    // Its own call: it is a property, not part of the options spec `apply` carries.
    map.set('labelViewDistance', 0);
    // map.set('debugTileBorders', true);

    applyLabelPadding();
    applyFieldOfView();
    view.on('layoutChanged', onPanoramaLayout);
    view.on('mapInteraction', onPanoramaInteraction);
    map.apply({
        // PLANAR always: the globe cost 3-7x the fill draws and disables fixed-distance normals
        // (`ensureSurfaceAttribs`), inking every LOD tile boundary. Not from a store: a stale persisted true exists.
        renderProjectionMode: 'RENDER_PROJECTION_MODE_PLANAR',
        // a negative tilt looks up past the horizon; every drag is clamped to this
        tiltRange: get(peakFinderStars) ? [-90, 90] : PANORAMA_RANGE,
        layersLabelsProcessedInReverseOrder: true,
        restrictedPanning: true,
        // In first person this is the LOOK's glide (KineticEventHandler::startLook): the view keeps
        // turning about the eye after a flick and slows to a stop.
        kineticRotation: true
    });

    // `flattened` false from the start: nothing to animate, nothing decodes twice
    map.terrain({ type: 'terrain', source: demSource.handle }).apply({
        enabled: true,
        flattened: false,
        flattenRatio: 0,
        // The rule belongs to the live map's 2D/3D button; a panorama is never anything but 3D.
        autoFlattenTilt: 0,
        autoFlattenParallax: 0,
        exaggeration: get(peakFinderExaggeration),
        // no clearance clamp, floor nor fraction: the fraction rule floated the eye 320 m above a 4800 m
        // summit, and the eye height is chosen outright via `setFocusLift`
        cameraClearance: 0,
        cameraClearanceFraction: 0,
        // finer than the live map: the mesh IS the ridge line here
        meshResolution: get(peakFinderMeshResolution),
        // far ranges: tangram's factor rule alone stops the ground a few km out...
        viewDistanceFactor: get(peakFinderViewDistance),
        // ...and shrinks near the ground, hence a floor in metres...
        viewDistance: get(peakFinderViewDistanceMetres),
        // ...and the same ceiling, else the factor rule reaches past a shorter setting
        viewDistanceMax: get(peakFinderViewDistanceMetres),
        // no drape: this map has no base layers; the surface shader paints the ground
        drapeFillsEnabled: false,
        drapeLinesEnabled: false,
        // half of it is also the visible cut's budget, so this sets the LOD floor too
        meshCacheSize: get(peakFinderMeshCacheSize),
        // no edge stitching: its mask is in the mesh cache key and depends on the visible cut, so turning
        // remints meshes. The surfaces are skirted, so it fixes nothing here.
        tileEdgeStitchingEnabled: false,
        // no shared ground: the only layer is billboards and the surface shader already painted the terrain,
        // so the ground pass drew the mesh twice (10.6 ms of a 22 ms frame on a Crosscall)
        sharedGroundEnabled: false,
        // generous: a summit on or just behind a ridge is exactly what this view is for
        billboardOcclusionEnabled: true,
        billboardOcclusionTolerance: get(peakFinderOcclusion),
        // the live summit tiles' LOD floor only; the terrain mesh has its own budget
        maxTileZoomCoarsening: get(peakFinderTileCoarsening),
        elevationPrefetchEnabled: true,
        // sized for a panorama: the SDK's 192-grid default thrashed, keeping three decode threads per
        // ElevationManager busy (11x the render thread on a Crosscall)
        elevationCacheSize: get(peakFinderElevationCacheSize)
    });
    // After the terrain exists — it is what carries these.
    applyTerrainZoomCap();
    applyGeoThreeTerrain();

    // placed before the first-person touch model, or setTilt/setMapRotation would turn it in place.
    // `moveEyeTo`, not `moveTo`: `moveTo` takes a focus, which at this tilt puts the eye km behind the summit.
    camera().moveEyeTo(toPosition(entryPosition), {
        zoom: effectiveZoom(),
        rotation: initialRotation,
        tilt: get(peakFinderTilt)
    });
    setFocusLift(get(peakFinderElevation));
    // first person: a one-finger drag turns the view about the camera; the map's orbit model would send
    // the focus km away at this tilt
    map.set('freeRoamMode', 'FREE_ROAM_MODE_FIRST_PERSON');

    applyReliefSurface();
    applyReliefOutline();
    applyAtmosphere();
    applySun();
    // before the layer: the style bakes the eye altitude into `text-rank`; after the camera: it reads the eye
    eyeGroundElevation = await resolveEyeGroundElevation();
    buildPeaksLayer();
    // After the summit layer, which the sun's top layer has to stay over.
    const skyContext: PeakFinderSkyContext = { map, eye: () => viewpoint, dark: () => isPeakFinderDark() };
    setupSkySelection(skyContext);
    setupPeakFinderSun(skyContext);
    setupPeakFinderMoon(skyContext);
    setupPeakFinderStars(skyContext);
    // not awaited: the layer already draws, and swaps onto the collected set once it lands
    loadStaticPeaks();
    // A tap on empty ground or sky clears the chip, the way tapping the map elsewhere deselects.
    map.onClick(() => {
        peakFinderSelectedPeak.set(null);
        clearSkySelection();
    });
    // the camera is placed by now: the first meaningful eye reading
    updateViewpoint();
    publishHeading();
    // The sun needs the eye, and lights the relief from where it is seen.
    updatePeakFinderSun(true);
    updatePeakFinderMoon();
    updatePeakFinderStars(true);
    applySun();
    // a first-person two-finger drag MOVES the camera, so moves also walk the eye off its summit set
    map.onMove(
        () => {
            updateViewpoint();
            publishHeading();
            checkStaticPeaks();
            updatePeakFinderSun();
            updatePeakFinderMoon();
            updatePeakFinderStars();
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
 * `map.destroy()` releases every id the map built; the two sources are the live map's, only borrowed.
 * The view outlives the facade and holds the terrain itself, hence `setTerrainOptions(null)` below.
 */
export function teardownPanorama() {
    // idempotent: one mode can produce two `onDestroy` calls
    if (!panorama && !panoramaView) {
        return;
    }
    panoramaView?.off('layoutChanged', onPanoramaLayout);
    panoramaView?.off('mapInteraction', onPanoramaInteraction);
    panoramaView?.setPostProcessEffect(null);
    effect = null;
    // layers off the map first: `destroy()` leaves them in the native `Layers`, keeping the ElevationManager
    // and its prefetch threads alive (six threads burned 11x the render thread on a Crosscall)
    teardownPeakFinderSun();
    teardownPeakFinderMoon();
    teardownPeakFinderStars();
    teardownSkySelection();
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
    detailPeaksCache = detailPeaksStore = detailPeaksSource = detailPeaksBase = null;
    // detach the terrain: the view's Options still holds it, with its ElevationManager, threads and grid
    // cache (a GB leaked per visit). The bridge's options object resolves; the view wrapper's does not.
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
    // borrowed, not owned: destroying them tore down the live map's own sources
    demSource = null;
    peaksSource = null;
}

/** Nothing to put back: the live map was never touched, and the panorama's map goes with its component. */
export const exitPeakFinder = tryCatchFunction(async () => {
    if (!isPeakFinderActive()) {
        return;
    }
    stopOrientationFollowing();
    // Before the store, so the surface stops being a hole while the preview is still behind it.
    setMapTranslucent(false);
    peakFinderArActive.set(false);
    peakFinderSelectedPeak.set(null);
    peakFinderSkyPanel.set(false);
    // The next panorama opens on now.
    peakFinderSkyTime.set(null);
    peakFinderElevation.set(get(peakFinderMinElevation));
    peakFinderActive.set(false);
    viewpoint = null;
    entryPosition = null;
    eyeGroundElevation = 0;
    lockOrientation('auto');
});

/** A style parameter, so a write on the live decoder rather than a rebuild. */
function applySelectedPeak(decoder = peaksDecoder) {
    decoder?.set('params.selected_peak', get(peakFinderSelectedPeak)?.key ?? '');
}

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
    clearSkySelection();
    peakFinderSelectedPeak.set({
        // What the style compares with, `[name] + '|' + [ele]` - the raw values, as the tile has them.
        key: `${name}|${featureData.ele ?? ''}`,
        name,
        elevation,
        position: featurePosition,
        distance: viewpoint ? computeDistanceBetween(viewpoint, featurePosition) : 0
    });
    return true;
}

/**
 * `flyTo` takes the FOCUS, km ahead of the eye at this tilt, so the target is the summit plus the
 * focus-to-eye vector.
 */
export const flyToSelectedPeak = tryCatchFunction(async () => {
    const peak = get(peakFinderSelectedPeak);
    const from = currentEye() ?? viewpoint;
    if (!peak || !panorama || !panoramaView || !from) {
        return;
    }
    peakFinderSelectedPeak.set(null);
    const mapCamera = camera();
    const summit = toPosition(peak.position);
    const focus = mapCamera.position();
    const eye = mapCamera.eyePosition();
    const target: Position = [summit[0] + (focus[0] - eye[0]), summit[1] + (focus[1] - eye[1])];
    // The eye is about to land ON the summit, which is what `viewpoint` means.
    viewpoint = peak.position;
    panoramaView.flyTo(
        { longitude: target[0], latitude: target[1] },
        { zoom: effectiveZoom(), tilt: get(peakFinderTilt), climbHeight: Math.min(2000, computeDistanceBetween(from, peak.position) * 0.1) }
    );
});

/** Loaded on demand: it pulls in the sensors plugin, and `Map.svelte` imports this file at startup. */
export const toggleHeadingFollowing = tryCatchFunction(async () => {
    const orientation = await import('~/mapModules/features/peakFinderOrientation');
    // Switched by hand, the sensors are the user's from now on: leaving AR must not stop them, and
    // there is nothing left for it to stop if they are switched off during AR.
    arStartedFollowing = false;
    if (get(peakFinderHeadingFollowing)) {
        await orientation.stopOrientationFollowing();
    } else {
        // The compass is AR without the camera: heading AND pitch.
        await orientation.startOrientationFollowing(true);
    }
});

/**
 * AR: a transparent clear colour and a translucent GL surface over the `<cameraview>`. `setTranslucent` also
 * raises the z-order, which is what matters: a SurfaceView can only reveal another surface under it.
 */
export const toggleArMode = tryCatchFunction(async () => {
    if (get(peakFinderArActive)) {
        peakFinderArActive.set(false);
        setMapTranslucent(false);
        // stop the sensors only if AR started them, or they keep polling after AR is off
        if (arStartedFollowing) {
            arStartedFollowing = false;
            stopOrientationFollowing();
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
        if (__ANDROID__) {
            // Always the media-overlay layer, not only in AR: the live map is a surface too, and the
            // one re-created when AR hands it back landed OVER the panorama - see-through after AR.
            nativeMapView.setZOrderMediaOverlay(true);
        }
    }
}

async function startFollowingForAr() {
    if (get(peakFinderHeadingFollowing)) {
        return;
    }
    const orientation = await import('~/mapModules/features/peakFinderOrientation');
    await orientation.startOrientationFollowing(true);
}

/** A finger-turned panorama keeps its own range and returns to its tilt, not wherever the phone pointed. */
function applyTiltRange() {
    const aimed = get(peakFinderArActive) || get(peakFinderHeadingFollowing);
    applyTiltBounds();
    if (!aimed) {
        panoramaView?.setTilt(get(peakFinderTilt), 0.3);
    }
}

/** The stars are overhead: with them on, the finger may look straight up too. */
function applyTiltBounds() {
    const aimed = get(peakFinderArActive) || get(peakFinderHeadingFollowing);
    panorama.set('tiltRange', aimed || get(peakFinderStars) ? [-90, 90] : PANORAMA_RANGE);
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

/** When the user last touched the panorama, ms: the sensors yield to the finger. */
let lastInteraction = 0;
function onPanoramaInteraction() {
    lastInteraction = Date.now();
}
export function panoramaInteractionTime() {
    return lastInteraction;
}

/** Where the panorama stands, `[lon, lat, alt]` — what the magnetic declination is worked out from. */
export function panoramaPosition(): Position {
    return camera()?.position() ?? null;
}

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

// Each mode's own switch, so entering AR (which re-applies the palette itself) does not do it twice.
applyLive(peakFinderDark, () => !get(peakFinderArActive) && applyPalette());
applyLive(peakFinderArDark, () => get(peakFinderArActive) && applyPalette());
applyLive(peakFinderSelectedPeak, () => applySelectedPeak());
applyLive(peakFinderOutlineWidth, applyReliefOutline);
applyLive(peakFinderHorizonBoost, applyReliefOutline);
applyLive(peakFinderExaggeration, () => terrain().set('exaggeration', get(peakFinderExaggeration)));
applyLive(peakFinderArOutlineWidth, applyReliefOutline);
applyLive(peakFinderArHorizonBoost, applyReliefOutline);
applyLive(peakFinderHillshade, applyReliefSurface);
applyLive(terrainSunAzimuth, applySun);
applyLive(terrainSunAltitude, applySun);
applyLive(peakFinderSun, applySun);
applyLive(peakFinderSkyTime, applySun);
applyLive(peakFinderOcclusion, () => terrain().set('billboardOcclusionTolerance', get(peakFinderOcclusion)));
applyLive(peakFinderViewDistance, () => terrain().set('viewDistanceFactor', get(peakFinderViewDistance)));
applyLive(peakFinderViewDistanceMetres, () => {
    terrain().apply({ viewDistance: get(peakFinderViewDistanceMetres), viewDistanceMax: get(peakFinderViewDistanceMetres) });
    // It sizes the collected disc as well as the ground, so the set has to be re-cut to match.
    refreshStaticPeaks();
});
// The other three knobs that decide WHAT was collected rather than how it is drawn.
applyLive(peakFinderPeakZoom, () => {
    // Shared with the engine-side source, where it is the zoom the tiles are READ at - and part of
    // the disk cache's name, so the chain is rebuilt.
    if (detailPeaksSource) {
        resetDetailPeaksSource();
        rebuildPeaksLayer();
    }
    refreshStaticPeaks();
});
applyLive(peakFinderPeakCount, refreshStaticPeaks);
applyLive(peakFinderPeakMinElevation, refreshStaticPeaks);
// What a rebuilt tile holds, so a new disk cache: see `detailPeaksStorePath`.
function rebuildDetailPeaks() {
    resetDetailPeaksSource();
    rebuildPeaksLayer();
}
applyLive(peakFinderDetailLevels, rebuildDetailPeaks);
applyLive(peakFinderDetailFeatures, rebuildDetailPeaks);
// Switching it OFF wants the layer pointed back at whatever is behind it, and ON wants the source
// built - both of which `createPeaks` decides, so both are a rebuild.
applyLive(peakFinderDetailSource, rebuildPeaksLayer);
applyLive(peakFinderMeshResolution, () => terrain().set('meshResolution', get(peakFinderMeshResolution)));
applyLive(peakFinderTerrainMaxZoom, applyTerrainZoomCap);
// A re-cull, not a re-decode: `TileLayer` watches this one and drops its cull state when it moves.
applyLive(peakFinderTileCoarsening, () => terrain().set('maxTileZoomCoarsening', get(peakFinderTileCoarsening)));
applyLive(peakFinderTilt, () => panoramaView?.setTilt(get(peakFinderTilt), 0));
applyLive(peakFinderMaxFieldOfView, applyFieldOfView);
applyLive(peakFinderLensCorrection, applyFieldOfView);
applyLive(peakFinderLabelLayout, rebuildPeaksLayer);
applyLive(peakFinderStarsLabelsOnSummits, rebuildPeaksLayer);
applyLive(peakFinderLabelRowHeight, rebuildPeaksLayer);
applyLive(peakFinderLabelAngle, rebuildPeaksLayer);
applyLive(peakFinderLabelRows, rebuildPeaksLayer);
applyLive(peakFinderLabelMinDistance, rebuildPeaksLayer);
applyLive(peakFinderLabelPersist, rebuildPeaksLayer);
applyLive(peakFinderLabelTextSize, rebuildPeaksLayer);
applyLive(peakFinderLabelWrap, rebuildPeaksLayer);
// An OPTION, not style text — so it is written, not re-decoded.
applyLive(peakFinderLabelPadding, applyLabelPadding);
applyLive(peakFinderLabelMaxDistance, rebuildPeaksLayer);
// on again is free: the collected source is kept, owned and released by the panorama's map
applyLive(peakFinderStaticPeaks, () => {
    if (get(peakFinderStaticPeaks) && !staticPeaksSource) {
        loadStaticPeaks();
    } else {
        rebuildPeaksLayer();
    }
});
// Changed from the settings sheet while the panorama is up: turn now rather than on the next entry.
applyLive(peakFinderScreenOrientation, () => lockOrientation(screenOrientation()));
// AR turns the clear colour into a hole for the camera preview to show through, and takes over the
// tilt as well as the rotation — a panorama held up at the sky has to be able to look up.
applyLive(peakFinderArActive, () => {
    // the whole look, not the atmosphere alone: surface shader, effect alpha, and label colours (style text)
    applyPalette();
    // in AR the field of view is a measurement of the camera, not a preference
    applyFieldOfView();
    applyTiltRange();
    if (get(peakFinderArActive)) {
        startFollowingForAr().catch((error) => showError(error));
    }
});
applyLive(peakFinderHeadingFollowing, applyTiltRange);
applyLive(peakFinderStars, () => {
    applyTiltBounds();
    if (get(peakFinderStarsLabelsOnSummits) && get(peakFinderLabelLayout) !== 'skyline') {
        rebuildPeaksLayer();
    }
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
                // just after `astronomy`
                order: 115,
                text: 'mdi-summit',
                tooltip: lc('peaks'),
                onTap: () => enterPeakFinder(item)
            }
        ];
    }
});
