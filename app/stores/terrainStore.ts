import { derived, get, writable } from 'svelte/store';
import { settingsStore } from '~/stores/settingsStore';
import { pitchEnabled } from '~/stores/mapStore';
import type { MapPos } from '~/utils/geo';

/** Defaults are the native demo's (`DemoConfig.java`) unless noted. */

export const terrain3dEnabled = settingsStore('terrain3dEnabled', true);
export const peakFinderEnabled = settingsStore('peakFinderEnabled', true);

export const terrainExaggeration = settingsStore('terrainExaggeration', 1);
/**
 * Grid cells per tile edge of the draped surface: multiplies all surface cost (128 vs 64: 8.5 vs 15.2 fps
 * on a Crosscall). SDK clamps to 256; the bare surface and depth pre-pass cap at 96 (`MAX_MESH_GRID_SIZE`).
 */
export const terrainMeshResolution = settingsStore('terrainMeshResolution', 64);
/**
 * Height-field resolution (`surfaceNodeResolution`) per DEM tile edge; 0 follows `terrainMeshResolution`.
 * This, not the mesh, carries relief. 256 is one node per texel of a 512 px DEM tile: more buys nothing.
 */
export const terrainNodeResolution = settingsStore('terrainNodeResolution', 256);
/** How far the ground goes on, as a factor on tangram's rule. */
export const terrainViewDistanceFactor = settingsStore('terrainViewDistanceFactor', 1);
/**
 * Minimum view distance in metres while 3D is on (`TerrainOptions.viewDistance`): the SDK takes
 * `max(rule × factor, metres)`, so it can only extend. The ceiling is `terrainViewDistanceMax`.
 */
export const terrainViewDistanceMetres = settingsStore('terrainViewDistanceMetres', 0);
/**
 * Ceiling on view distance in metres while 3D is on (`viewDistanceMax`): caps cull, tile walk and far
 * plane together. Not derived from the fog: a summit above the haze is further. 0 = no ceiling.
 */
export const terrainViewDistanceMax = settingsStore('terrainViewDistanceMax', 0);
/** Metres the camera is held above the ground. 0 disables the clamp, as the demo does. */
export const terrainCameraClearance = settingsStore('terrainCameraClearance', 20);
/** Seconds for the 2D/3D switch (camera flight and ground rise): the demo's `AUTO_FLATTEN_MS`, not `TERRAIN_ANIM_MS`. */
export const terrainSwitchDuration = settingsStore('terrainSwitchDuration', 0.3);
/**
 * FULL: a flat map decodes and culls as plain 2D, at a re-decode per switch. RENDER: only the terrain
 * passes stop, so switching is free but flat still carries 3D's triangles.
 */
export const terrainFlattenModeFull = settingsStore('terrainFlattenModeFull', false);
export const terrainAutoFlattenByTilt = settingsStore('terrainAutoFlattenByTilt', true);
/** In this SDK tilt 90 is straight down, so a landscape view is a LOW tilt. */
export const terrain3dTilt = settingsStore('terrain3dTilt', 20);
export const terrainSky = settingsStore('terrainSky', true);
/** On, unlike the demo: without fog the ground ends on a hard edge at the view distance. */
export const terrainFog = settingsStore('terrainFog', true);

/**
 * Mapbox's `fog`; range is in camera-to-focus multiples, pushed out from their city-tuned `[0.5, 10]`.
 * Colours are required: `FogOptions` defaults them to transparent and `ResolvedFog::active()` needs alpha.
 */
export const TERRAIN_FOG = {
    /** `range`, [start, full strength] */
    rangeStart: 2,
    rangeEnd: 20,
    /** `color`: what the distance fades to. */
    color: '#ffffff',
    /** `high-color`: the upper atmosphere, which is what tints the sky above the haze. */
    highColor: '#245cdf',
    /** `space-color` at z7 — mapbox ramps it from near-black at z4 as the horizon appears. */
    spaceColor: '#367ab9',
    /** `horizon-blend` at z7: how far up the sky the fog reaches. */
    horizonBlend: 0.1,
    /** `star-intensity` at z6 and above: none. */
    starIntensity: 0
};

/** E-ink: all three fog colours are paper, mapbox's blue atmosphere dithers into noise there. */
export const TERRAIN_FOG_EINK = '#ffffff';

/**
 * Altitudes (m ASL) the fog fades out between, mapbox's `vertical-range`: full fog below start, none above
 * end, so summits stand out of the valley haze. Mapbox's `[0, 0]` fogs every altitude the same.
 */
export const terrainFogVerticalStart = settingsStore('terrainFogVerticalStart', 1000);
export const terrainFogVerticalEnd = settingsStore('terrainFogVerticalEnd', 2500);
/** Terrain lighting and the sun's shadows; off as in the demo: a real cost and a change of look. */
export const terrainLighting = settingsStore('terrainLighting', false);

/**
 * Sun position, degrees clockwise from north / above the horizon (SDK defaults). Only written while
 * `terrainLighting` is on: a style's own sun lights the flat map, so an override would change 2D.
 */
export const terrainSunAzimuth = settingsStore('terrainSunAzimuth', 315);
export const terrainSunAltitude = settingsStore('terrainSunAltitude', 45);

/**
 * Subordinate to `terrainLighting`: the shadow scales the direct light. `LightOptions` has no
 * `shadowsEnabled`, so off is `shadowStrength` 0.
 */
export const terrainShadows = settingsStore('terrainShadows', false);
/**
 * Fraction of the direct light a shadow takes; 1 is physical (mapbox's default), above exaggerates.
 * Scaled by the sun's share of the light, so raising it does not add shadows at dusk.
 */
export const terrainShadowStrength = settingsStore('terrainShadowStrength', 1);
/**
 * Shadow reach in multiples of the camera-to-focus distance; 0 takes the SDK's 4.5. Further costs texel
 * size, the shadow map resolution being fixed.
 */
export const terrainShadowDistance = settingsStore('terrainShadowDistance', 0);
/** Shadow map px PER CASCADE (size² × 4 bytes each). SDK clamps to 4096 / cascades: they share one texture. */
export const terrainShadowMapSize = settingsStore('terrainShadowMapSize', 2048);
/** Shadow maps the view distance is split across (1..4); each costs another caster pass. */
export const terrainShadowCascades = settingsStore('terrainShadowCascades', 2);
/**
 * The shadow edge's softness, as a blur radius in shadow-map texels. Also what hides the
 * stair-stepping of a coarse map, so it goes with a low `terrainShadowMapSize`.
 */
export const terrainShadowSoftness = settingsStore('terrainShadowSoftness', 1);
/**
 * Ring of extra shadow casters around the visible tiles, in tiles: sets the ring's resolution, not its
 * reach. 0 removes it, and a shadow vanishes as the summit throwing it leaves the screen.
 */
export const terrainShadowCasterMargin = settingsStore('terrainShadowCasterMargin', 3);

/**
 * One-finger drag in 3D mode (`FreeRoamMode`). `look`: turns the view about the focus, panning moves to
 * two fingers. `fps`: turns about the camera, two fingers walk/strafe, pinch and rotation are off.
 */
export type TerrainTouchMode = 'classic' | 'look' | 'fps';
export const terrainTouchMode = settingsStore<TerrainTouchMode>('terrainTouchMode', 'classic');

export const TERRAIN_AUTO_FLATTEN_TILT = 88;
/** Style layers kept out of the drape bake and drawn live. Contours must be: baked, they survive in
 *  cached tiles below the zoom the style stops drawing them at. */
export const TERRAIN_NO_DRAPE_FILTER = '^contour|maneuver.*';
/**
 * Per-tile drape texture px (res² × 4 bytes/tile, SDK-clamped to [128, 2048]); 0 derives it from the screen.
 * A fixed value is not sized against the cache (2048 thrashed it on an S22), so the cache follows this.
 */
export const terrainDrapeResolution = settingsStore('terrainDrapeResolution', 1024);
/**
 * Drape cache budget, MB. 0 (default) follows the resolution via `resolveDrapeCacheSize`: the cache must
 * hold two covers, and a fixed budget carried across resolutions is what thrashed.
 */
export const terrainDrapeCacheSize = settingsStore('terrainDrapeCacheSize', 0);
/** Drape tiles the cache should hold: the live cover, twenty-odd leaves, plus the generation behind it. */
const DRAPE_CACHE_TILES = 48;
/** Never below the SDK's own default (`TerrainDrapeCache::MAX_BYTES`), MB. */
const DRAPE_CACHE_MIN_MB = 96;
/**
 * ...and never above this, MB: `TerrainDrapeCache::endFrame` floors at 24 × res² × 4 anyway (384 MB at
 * 2048), so asking for more buys nothing.
 */
const DRAPE_CACHE_MAX_MB = 384;

/**
 * Drape cache budget, MB. `resolution` 0 is the SDK's automatic rule, which sizes itself against the
 * budget, so it gets 0 back; a `setting` above 0 is returned untouched.
 */
export function resolveDrapeCacheSize(resolution: number, setting: number): number {
    if (setting > 0) {
        return setting;
    }
    if (resolution <= 0) {
        return 0;
    }
    const megabytes = (DRAPE_CACHE_TILES * resolution * resolution * 4) / (1024 * 1024);
    return Math.min(DRAPE_CACHE_MAX_MB, Math.max(DRAPE_CACHE_MIN_MB, Math.round(megabytes)));
}
/** How many zoom levels below the camera a tile may coarsen to (`TERRAIN_MAX_TILE_ZOOM_COARSENING`). */
export const TERRAIN_MAX_TILE_ZOOM_COARSENING = 8;
/** ms the switch waits for terrain-decoded tiles: when all are already decoded the wait never ends. */
export const TERRAIN_TILE_WAIT_TIMEOUT_MS = 500;

/** 0 is the horizon in this SDK (90 is straight down), which is where a panorama looks. */
export const peakFinderTilt = settingsStore('peakFinderTilt', 0);
/** Metres above the ground the viewpoint opens at: 0 stands on the summit. */
export const peakFinderFlyElevation = settingsStore('peakFinderFlyElevation', 0);
/** The zoom the panorama opens at, which is what one screen width of horizon covers. */
export const peakFinderFlyZoom = settingsStore('peakFinderFlyZoom', 13.6);
/**
 * Ceiling on the horizontal FOV, degrees, applied by lowering `fieldOfViewY` (the SDK derives X from the
 * aspect: landscape reached ~113° and ~5x the work). A crop only. 0 = the back camera's field. Ignored in AR.
 */
export const peakFinderMaxFieldOfView = settingsStore('peakFinderMaxFieldOfView', 0);
/**
 * Warp the AR terrain by the camera's lens distortion (`distortUv` in reliefShaders.ts). Android only
 * (Camera2 `LENS_DISTORTION`), identity without coefficients; off for devices reporting wrong ones.
 */
export const peakFinderLensCorrection = settingsStore('peakFinderLensCorrection', true);
/**
 * How far behind the terrain a label anchor may sit, as a fraction of its distance. SDK default is 0.02;
 * generous here since summits sit right on ridges.
 */
export const peakFinderOcclusion = settingsStore('peakFinderOcclusion', 0.15);
/** A panorama is the case tangram's view-distance rule answers badly, hence well above 1. */
export const peakFinderViewDistance = settingsStore('peakFinderViewDistance', 3);
/**
 * How far the ground is drawn, metres, whatever the height: also set as `viewDistanceMax`, since
 * `viewDistance` only extends the factor rule. 150 km covers Mont Blanc from Grenoble (108 km). Costly.
 */
export const peakFinderViewDistanceMetres = settingsStore('peakFinderViewDistanceMetres', 150000);
/**
 * Grid cells per tile edge in the panorama: geo-three's `geometrySize` / 3 up to z12, halved per level
 * above, min 16. `setSubdivideDistance` lifts the SDK's cap of 96.
 */
export const peakFinderMeshResolution = settingsStore('peakFinderMeshResolution', 171);
/**
 * Tile zoom the panorama mesh is cut at (`setMaxZoom`, also caps the elevation data); 0 = distance rule.
 * 17 is geo-three's. Never past the source's max + 3 anyway.
 */
export const peakFinderTerrainMaxZoom = settingsStore('peakFinderTerrainMaxZoom', 17);
/**
 * Terrain meshes the panorama may cache; 0 = SDK rule (160). Panning changes LOD stitching masks (part of
 * the key), so 160 evicted on every build. Half is also the visible cut's budget: too small drops LOD.
 */
export const peakFinderMeshCacheSize = settingsStore('peakFinderMeshCacheSize', 640);
/**
 * Elevation grid cache, MB; 0 = SDK rule (192 grids), a fraction of a panorama's working set: it thrashed
 * and kept the decode threads busy (~11x the render thread's CPU). 768 MB is ~430 grids of 1796 KB.
 */
export const peakFinderElevationCacheSize = settingsStore('peakFinderElevationCacheSize', 768);
/** false = ink on paper, true = paper on ink. */
export const peakFinderDark = settingsStore('peakFinderDark', false);
/** The same switch in AR, kept apart: dark by default, as black ink hardly reads over a photo. */
export const peakFinderArDark = settingsStore('peakFinderArDark', true);

/** One tap of an elevation arrow, metres (`DemoConfig.PEAK_FINDER_ELEVATION_STEP`). */
export const PEAK_FINDER_ELEVATION_STEP = 200;
/** Metres per second the viewpoint climbs while an arrow is HELD, at the FLOOR. */
export const PEAK_FINDER_ELEVATION_RATE = 400;
/**
 * Fraction of the current height added to the climb rate per second: a geometric climb, so the arrows
 * feel the same at 50 m and at 9 km. 0.6 doubles the height about every 1.2 s.
 */
export const PEAK_FINDER_ELEVATION_GROWTH = 0.6;
/** Metres per second the climb is capped at, however high the eye is. */
export const PEAK_FINDER_ELEVATION_RATE_MAX = 4000;
/**
 * Lowest the viewpoint sits above the ground, metres. Not 0: an eye on the height field is inside its
 * sampling error and the nearest cell hides everything (peakfinder.com's `minimalelevation`).
 */
export const peakFinderMinElevation = settingsStore('peakFinderMinElevation', 50);
/** As high as the arrows go. Above this the panorama is a map again. */
export const PEAK_FINDER_ELEVATION_MAX = 9000;

// defaults are peakfinder.com's, see `PEAKFINDER_LOOK` in app/mapModules/terrain/reliefShaders.ts
/** Line width, px: thickens the silhouettes and nothing else. */
export const peakFinderOutlineWidth = settingsStore('peakFinderOutlineWidth', 1);
/**
 * Shading of slopes turned away from the sun (`uHillshade`), relative to flat ground. The sun is
 * `terrainSunAzimuth` / `terrainSunAltitude`.
 */
export const peakFinderHillshade = settingsStore('peakFinderHillshade', 0.15);
/** The skyline stroke's width in texels, drawn on the terrain side; 0 leaves the silhouette line alone. */
export const peakFinderHorizonBoost = settingsStore('peakFinderHorizonBoost', 2.5);
/** The relief's vertical scale in the panorama, apart from the 3D mode's: 1 is what the eye sees. */
export const peakFinderExaggeration = settingsStore('peakFinderExaggeration', 1);
/** AR versions of the two above, where a thick line hides the photo. 0 = use the above. */
export const peakFinderArOutlineWidth = settingsStore('peakFinderArOutlineWidth', 0);
export const peakFinderArHorizonBoost = settingsStore('peakFinderArHorizonBoost', 0);

// these are style text: changing one needs a new decoder, see rebuildPeaksLayer in features/peakFinder.ts
/**
 * `top`: one row at `peakFinderLabelRowHeight` from the top. `band` (peakfinder.com's): the row sits just
 * above the highest summit on screen. `skyline`: each name over its own summit.
 */
export type PeakFinderLabelLayout = 'band' | 'top' | 'skyline';
export const peakFinderLabelLayout = settingsStore<PeakFinderLabelLayout>('peakFinderLabelLayout', 'top');
/** Row height from the top, px (a screen fraction dropped names in landscape). 0 = auto, fits a wrapped name. */
export const peakFinderLabelRowHeight = settingsStore('peakFinderLabelRowHeight', 0);
/**
 * Label rotation off its leader line, degrees: the `skyline` capacity knob, since a name of width W at
 * angle T spans `W·cos T` of the scarce horizontal room.
 */
export const peakFinderLabelAngle = settingsStore('peakFinderLabelAngle', 45);
/**
 * Rows a colliding label may step into before it is dropped. 1 as in the reference: extra rows put a
 * small nearby peak's name below a distant range's. `text-rank` picks the winner, see `peaksStyle`.
 */
export const peakFinderLabelRows = settingsStore('peakFinderLabelRows', 1);
/** Shortest gap between two summit labels, px; 0 disables the rule and lets them overlap. */
export const peakFinderLabelMinDistance = settingsStore('peakFinderLabelMinDistance', 0);
/**
 * Placement passes a name holds its row once it stops fitting (`text-callout-persist`): a rectilinear view
 * crowds the centre (~1.4x at 67°), so names that fit near the edge lose their slot mid-screen.
 */
export const peakFinderLabelPersist = settingsStore('peakFinderLabelPersist', 10);
/** The names' size, before the map's own font scale. */
export const peakFinderLabelTextSize = settingsStore('peakFinderLabelTextSize', 13);
/** A name longer than this many pixels breaks onto a second line; 0 never wraps. */
export const peakFinderLabelWrap = settingsStore('peakFinderLabelWrap', 70);
/** 0 = no limit. */
export const peakFinderLabelMaxDistance = settingsStore('peakFinderLabelMaxDistance', 0);
/**
 * Off-screen label placement margin, px (`setLabelPadding`, not style text): names win or lose their row
 * before they are visible, which stops the blinking. 0 = SDK rule (100 × sin(tilt), min 20).
 */
export const peakFinderLabelPadding = settingsStore('peakFinderLabelPadding', 200);

/**
 * Rebuild coarse summit tiles from the finer ones at `peakFinderPeakZoom` (`PointDetailTileDataSource`):
 * a function of the tile, not the camera. Falls back on `peakFinderStaticPeaks` when the SDK lacks it.
 */
export const peakFinderDetailSource = settingsStore('peakFinderDetailSource', true);
/** Levels below a coarse tile that source reaches (`setMaxDetailLevels`); each is 4x the tile reads. */
export const peakFinderDetailLevels = settingsStore('peakFinderDetailLevels', 3);
/**
 * Summits a rebuilt tile may carry, highest first; 0 lifts the cap. At 2000 the band was oversubscribed
 * ~450:1, so greedy placement flickered and cost ~100 ms/s; 32 leaves ~100 names for ~20 slots.
 */
export const peakFinderDetailFeatures = settingsStore('peakFinderDetailFeatures', 32);

/**
 * Take the summit set from one query at the viewpoint (`panoramaPeaks.ts`). Off: `findFeatures` loads
 * ~2900 tiles for 187 km at z12 and stalls. Kept for builds without `peakFinderDetailSource`.
 */
export const peakFinderStaticPeaks = settingsStore('peakFinderStaticPeaks', false);
/**
 * Zoom the sweep reads tiles at. Shipped tiles keep every peak only at z13 (`maxzoomForRendering`), below
 * they are declustered (~1.1 km at z12, ~9.2 km at z9). 12: z13 is 4x the tiles for little gain.
 */
export const peakFinderPeakZoom = settingsStore('peakFinderPeakZoom', 12);
/** How many summits it keeps, highest first. */
export const peakFinderPeakCount = settingsStore('peakFinderPeakCount', 2000);
/** ...and the floor under them, metres. Filtering here rather than in the style keeps the cap useful. */
export const peakFinderPeakMinElevation = settingsStore('peakFinderPeakMinElevation', 0);

/**
 * Zoom levels below the camera the panorama's live tiles may coarsen to (`maxTileZoomCoarsening`): the
 * summit tiles' LOD. At camera ~z13, 4 puts far ranges on z9 (peaks declustered at 9.2 km); each level
 * lower is 4x the tiles.
 */
export const peakFinderTileCoarsening = settingsStore('peakFinderTileCoarsening', 4);

/** `auto` leaves it to the device, respecting the user's rotation lock. */
export type PeakFinderOrientation = 'auto' | 'landscape' | 'portrait';
export const peakFinderScreenOrientation = settingsStore<PeakFinderOrientation>('peakFinderScreenOrientation', 'auto');

// not persisted: reopening in a mode would leave the user in a landscape panorama with no idea why
export const terrain3dActive = writable(false);
export const peakFinderActive = writable(false);
export const peakFinderArActive = writable(false);
/** The palette drawn: AR's own switch while it is on. */
export const peakFinderDarkActive = derived([peakFinderArActive, peakFinderDark, peakFinderArDark], ([ar, dark, arDark]) => (ar ? arDark : dark));
/** Read now: a `peakFinderArActive` subscriber can run before the derived store has updated. */
export function isPeakFinderDark() {
    return get(peakFinderArActive) ? get(peakFinderArDark) : get(peakFinderDark);
}
export const peakFinderHeadingFollowing = writable(false);
/** The magnetometer looks uncalibrated while following: the overlay asks for a figure 8. */
export const peakFinderCalibrationNeeded = writable(false);
/** Where the panorama is looking, degrees clockwise from north: the view, not the device. */
export const peakFinderHeading = writable(0);
/** Metres the viewpoint is currently lifted above the ground. */
export const peakFinderElevation = writable(0);
/**
 * True while a mode switch's camera flight runs: `CameraTiltEvent::calculate` clamps the tilt to the
 * range every frame, so narrowing it mid-flight would snap the camera.
 */
export const mapTiltTransition = writable(false);

/** The summit the user last tapped, as the overlay's chip needs it. */
export interface SelectedPeak {
    /** How the summit style recognises it: `name|ele`, the tile's raw values. */
    key: string;
    name: string;
    elevation?: number;
    position: MapPos;
    /** Metres from the viewpoint, at the moment it was picked. */
    distance: number;
}
export const peakFinderSelectedPeak = writable<SelectedPeak>(null);

export const peakFinderSun = settingsStore('peakFinderSun', true);
export const peakFinderMoon = settingsStore('peakFinderMoon', true);
/** A mark and a time on the path on every hour. */
export const peakFinderSunHours = settingsStore('peakFinderSunHours', false);
export const peakFinderStars = settingsStore('peakFinderStars', false);
export const peakFinderConstellations = settingsStore('peakFinderConstellations', true);
export const peakFinderPlanets = settingsStore('peakFinderPlanets', true);
/** With the stars on, forces the `skyline` layout: a row pinned at the top would sit in the sky. */
export const peakFinderStarsLabelsOnSummits = settingsStore('peakFinderStarsLabelsOnSummits', true);
/** ms since the epoch; null follows the clock. Not persisted: a panorama opens on now. */
export const peakFinderSkyTime = writable<number>(null);
export const peakFinderSkyPanel = writable(false);

/** A sky object the user tapped, as the overlay's chip needs it. */
export interface SelectedSky {
    /** The object's metadata id, `star:Sirius`, `planet:mars`, `sun`… */
    id: string;
    kind: 'star' | 'planet' | 'constellation' | 'sun' | 'moon';
    name: string;
    /** A second line: magnitude, or what it is. */
    detail?: string;
    wikidata?: string;
}
export const peakFinderSelectedSky = writable<SelectedSky>(null);
/** The selected object's rise and set around the sky moment, as the chip shows them. */
export const peakFinderSelectedSkyPass = writable<string>(null);

/** The range every tilted mode, and every flight into or out of one, needs. */
export const TILTED_RANGE: [number, number] = [1, 90];

/**
 * The panorama's range, reaching past the horizon (a negative tilt looks up) so a first-person drag can
 * look at a summit above the viewpoint.
 */
export const PANORAMA_RANGE: [number, number] = [-45, 90];

export const mapTiltRange = derived([pitchEnabled, terrain3dActive, mapTiltTransition], ([$pitchEnabled, $terrain3dActive, $mapTiltTransition]): [number, number] => {
    // the peak finder runs on its own map, which sets `PANORAMA_RANGE` on itself
    if ($terrain3dActive || $mapTiltTransition) {
        return TILTED_RANGE;
    }
    return [$pitchEnabled ? 30 : 90, 90];
});
