import { derived, writable } from 'svelte/store';
import { settingsStore } from '~/stores/settingsStore';
import { pitchEnabled } from '~/stores/mapStore';
import type { MapPos } from '~/utils/geo';

/**
 * Every knob the 3D terrain mode and the peak finder are tuned with, plus the two modes' live state.
 *
 * One store per value, shared between the long-press sheet and the app settings screen, so there is
 * nothing to keep in sync — both screens bind the same store, and the modules subscribe to it.
 * Defaults are the native demo's (`DemoConfig.java:1029-1108`) except where a comment says otherwise.
 */

// --- what the user can switch off -------------------------------------------------------------
//
// Runtime settings rather than build flags: the features are always compiled in, and these hide
// their entry points. A store, not a plain read, so flipping one in settings takes effect at once.
export const terrain3dEnabled = settingsStore('terrain3dEnabled', true);
export const peakFinderEnabled = settingsStore('peakFinderEnabled', true);

// --- 3D terrain mode --------------------------------------------------------------------------
//
// Every default is the android demo's (`DemoConfig.TERRAIN_*`), because that is the render this is
// meant to reproduce.
export const terrainExaggeration = settingsStore('terrainExaggeration', 1);
/**
 * Grid cells per tile edge, for the DRAPED surface — the one carrying the map layers.
 *
 * 128, over the demo's 64 (tangram's own): a ridge drawn at 64 is visibly faceted and its tile edges
 * show, which is what the geo-three webapp avoids by meshing at 320 on mobile and 512 elsewhere. Not
 * free — 128 measured 8.5 fps against 15.2 at 64 on a Crosscall — hence a setting.
 *
 * Two ceilings above it, both in the SDK: `TerrainOptions::setMeshResolution` clamps to 256, and the
 * grid is never finer than the DEM has texels for that tile. And it only reaches this far in the
 * draped path (`TileRenderer`'s regular grid); the bare surface and the depth pre-pass are
 * `TerrainRenderer`'s, which caps at `MAX_MESH_GRID_SIZE` = 96 — see `peakFinderMeshResolution`.
 */
export const terrainMeshResolution = settingsStore('terrainMeshResolution', 128);
/** How far the ground goes on, as a factor on tangram's rule. */
export const terrainViewDistanceFactor = settingsStore('terrainViewDistanceFactor', 1);
/**
 * How far the ground is drawn while 3D is up, in METRES, whatever the zoom and the tilt.
 *
 * The factor above cannot express this: it scales tangram's rule, which is proportional to the
 * camera's height above the ground, so coming down towards the terrain shortens the view — and the
 * range on the horizon is exactly what should not disappear when it does.
 * `TerrainOptions.viewDistance` is the absolute one, and it only ever EXTENDS the factor rule.
 *
 * A MINIMUM, and only that — so it cannot make the view reach less far, and turning it DOWN does
 * nothing (`ViewState::calculateViewDistance` returns `max(rule × factor, metres)`). The ceiling is
 * `terrainViewDistanceMax` below.
 *
 * 0 out of the box: measured from Grenoble, tangram's rule at the 3D mode's tilt already reaches the
 * Mont Blanc (108 km line of sight), so the 150 km this used to ask for bought nothing and spent the
 * far plane's depth precision to do it.
 *
 * Applied only while 3D is ON. On a flat map the same metres would reach the horizon at every zoom,
 * which is a tile walk with nothing to show for it.
 */
export const terrainViewDistanceMetres = settingsStore('terrainViewDistanceMetres', 0);
/**
 * The CEILING on how far the ground is drawn while 3D is up, in metres — `TerrainOptions.viewDistanceMax`.
 *
 * The one knob that makes the map reach LESS far in metres. Tangram's rule is the camera's height
 * over the cosine of the angle to the horizon, so a view along the ground reaches tens of kilometres
 * from a hillside and past a hundred from a summit, and all of it is fetched, meshed, draped and
 * drawn to end as a few pixels of haze. The ceiling caps the cull envelope, the tile walk and the far
 * plane together, so what it saves is work rather than clipped work.
 *
 * NOT derived from the fog. The fog's range says where the ground has gone white; a summit standing
 * above the haze is further than that and is the whole point of the vertical range — so this is a
 * number to pick, and 0 (the default) is no ceiling at all.
 */
export const terrainViewDistanceMax = settingsStore('terrainViewDistanceMax', 0);
/** Metres the camera is held above the ground. 0 disables the clamp, as the demo does. */
export const terrainCameraClearance = settingsStore('terrainCameraClearance', 20);
/**
 * Seconds the 2D/3D switch takes — the camera flight and the ground's rise share this one number.
 *
 * The demo's `TERRAIN_ANIM_MS` is 700, which is a demo showing its animation off. A mode switch the
 * user makes over and over wants to be out of the way, so this is the demo's OTHER terrain number,
 * `AUTO_FLATTEN_MS` (300).
 */
export const terrainSwitchDuration = settingsStore('terrainSwitchDuration', 0.3);
/**
 * FULL: a flat map decodes and culls as a plain 2D one, at the cost of a re-decode per switch.
 * RENDER: only the terrain passes stop, so switching is free but flat still carries 3D's triangles.
 *
 * OFF, which is the demo's `TERRAIN_FULL_SWITCH`. FULL makes every switch wait on a full re-decode.
 */
export const terrainFlattenModeFull = settingsStore('terrainFlattenModeFull', false);
export const terrainAutoFlattenByTilt = settingsStore('terrainAutoFlattenByTilt', true);
/** In this SDK tilt 90 is straight down, so a landscape view is a LOW tilt. */
export const terrain3dTilt = settingsStore('terrain3dTilt', 20);
export const terrainSky = settingsStore('terrainSky', true);
/**
 * Distance fog, ON — see `TERRAIN_FOG` for what it is set to.
 *
 * The demo ships it off (`FOG_ENABLED`), but the demo has no fog COLOUR either, and this is the
 * setting that decides whether a 3D map has an atmosphere at all: without it the ground ends on a
 * hard edge at the view distance, and the sky meets it on a seam.
 */
export const terrainFog = settingsStore('terrainFog', true);

/**
 * The fog itself: mapbox's `fog`, with its RANGE pushed out.
 *
 * The colours and the curve are mapbox's — the SDK implements their model, ramp for ramp
 * (`FogShader::fogOpacity` is their `fog_opacity`, the horizon term and the
 * `smoothstep(45, 65, pitch)` fade are theirs too). The range unit is theirs as well: multiples of
 * the CAMERA-TO-FOCUS distance, so one setting holds at every zoom.
 *
 * Which is exactly why their `[0.5, 10]` is wrong here. That reference length halves with every zoom
 * level, and mapbox tunes it for a city at z15-16, where the camera is about a kilometre out and the
 * far end of the frame is the next few blocks. At a hiking zoom in the mountains the same numbers put
 * the start under a kilometre and full strength inside ten, so the ridge across the valley — the
 * subject of the picture — came out washed. `[2, 20]` moves the whole ramp out by that reasoning and
 * keeps mapbox's shape.
 *
 * The range does NOT limit what is drawn. It is a shader ramp and costs nothing by itself, and the
 * ground behind it still has to be drawn: a summit standing above the haze is the whole point of the
 * vertical range below, and it can be tens of kilometres past where the valleys have gone white.
 *
 * The COLOUR is not optional. `FogOptions` defaults every colour to transparent and
 * `ResolvedFog::active()` needs an alpha to draw anything, so a fog that is merely `enabled` is
 * still no fog — which is why these are set on the same call that enables it.
 */
export const TERRAIN_FOG = {
    /** `range`, [start, full strength]. Mapbox's `[0.5, 10]` pushed out; see above. */
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

/**
 * E-ink: one colour for all three, and it is paper.
 *
 * A screen with no greys renders mapbox's blue atmosphere as dithered noise, and the fog's whole job
 * here is the opposite — to take the far ground quietly out of the picture.
 */
export const TERRAIN_FOG_EINK = '#ffffff';

/**
 * The altitudes the fog fades out between, metres above sea level — mapbox's `vertical-range`.
 *
 * This is what puts the summits ABOVE the haze: below `start` the fog is at full strength, above
 * `end` the ground escapes it entirely (`FogShader::fogVertical`, a smoothstep on the fragment's own
 * altitude). So a range filling the valleys reads as a sea of fog with the peaks standing out of it,
 * which is both what a mountain morning looks like and what makes a distant summit findable — the
 * haze takes the clutter under it and leaves the skyline.
 *
 * 1000 → 2500 m for the Alps: valley floors and the forest below the haze, the ridges and everything
 * above them clear. Mapbox's default is `[0, 0]`, which is the switch for "fog every altitude the
 * same" — and that is what made a far summit vanish into the same white as the valley it stands over.
 */
export const terrainFogVerticalStart = settingsStore('terrainFogVerticalStart', 1000);
export const terrainFogVerticalEnd = settingsStore('terrainFogVerticalEnd', 2500);
/**
 * Terrain lighting, and with it the sun's shadows on the ground.
 *
 * OFF, as `TERRAIN_LIGHTING` is in the demo. It is a real cost and a real change of look — shading
 * the mesh is not what makes a map read as 3D — so it is opt-in rather than something the switch
 * turns on behind the user's back.
 */
export const terrainLighting = settingsStore('terrainLighting', false);

/**
 * Where the sun stands, in degrees — clockwise from north, and above the horizon.
 *
 * The SDK's own defaults (315 / 45): the classic cartographic light, from the north-west and half way
 * up. They are what the SHADOWS are cast from, so they are the lighting's two most visible knobs —
 * a low sun is what puts a ridge's shadow across the valley next to it.
 *
 * Written only while `terrainLighting` is on, and with `sunOverridingStyle` moving with it: a style
 * states its own sun (a converted mapbox one does, per light preset) and that is what lights the flat
 * map, so an override left standing would change the 2D map for a setting that belongs to 3D.
 */
export const terrainSunAzimuth = settingsStore('terrainSunAzimuth', 315);
export const terrainSunAltitude = settingsStore('terrainSunAltitude', 45);

/**
 * The sun's shadows of the terrain ON the terrain — ridges shading valleys at a low sun.
 *
 * SUBORDINATE to `terrainLighting`: the shadow is a factor on the DIRECT light, so with the terrain
 * unlit there is nothing for it to take away and the whole shadow pass is skipped. Both switches are
 * shown because they are separate costs — lighting is a slope term in the surface shader, shadows are
 * one extra caster pass per cascade plus a shadow map to sample.
 *
 * `LightOptions` has no `shadowsEnabled`, so OFF is `shadowStrength` 0 and this switch is what picks
 * between 0 and the strength below.
 */
export const terrainShadows = settingsStore('terrainShadows', false);
/**
 * How much of the direct light a shadow takes, 1 being the physical shadow (mapbox's
 * `shadow-intensity` default) rather than a maximum — above it the shadow is exaggerated.
 *
 * Not a depth: it is multiplied by the sun's share of the scene light, which is 0 with the sun under
 * the horizon, so raising it does not make shadows appear at dusk.
 */
export const terrainShadowStrength = settingsStore('terrainShadowStrength', 1);
/**
 * How far shadows reach from the camera, in multiples of the camera-to-focus distance — the unit
 * `TERRAIN_FOG`'s range uses, and mapbox's shadow model. 0 takes the SDK's built-in 4.5.
 *
 * Relative on purpose: the reference distance follows the zoom, so one value holds from a street to a
 * massif. Further is not better — the shadow map has a fixed resolution, so reach is paid for in
 * texel size, and the ground past the distance simply has no shadows.
 */
export const terrainShadowDistance = settingsStore('terrainShadowDistance', 0);
/**
 * The shadow map's resolution in pixels, PER CASCADE — the memory knob (size² × 4 bytes each) and the
 * sharpness one. Clamped by the SDK to 4096 / cascades, since the cascades share one texture: at the
 * default 2 cascades anything above 2048 is thrown away.
 */
export const terrainShadowMapSize = settingsStore('terrainShadowMapSize', 2048);
/**
 * How many shadow maps the view distance is split across (1..4), 2 as mapbox uses.
 *
 * One map has to cover everything visible, so at a tilt its texels are metres of ground and the edges
 * become staircases. A second map covers the near ground with the same texel count, where it matters.
 * Each cascade costs another caster pass.
 */
export const terrainShadowCascades = settingsStore('terrainShadowCascades', 2);
/**
 * The shadow edge's softness, as a blur radius in shadow-map texels. Also what hides the
 * stair-stepping of a coarse map, so it goes with a low `terrainShadowMapSize`.
 */
export const terrainShadowSoftness = settingsStore('terrainShadowSoftness', 1);
/**
 * The ring of extra shadow CASTERS around the visible tiles, in tiles — what keeps a mountain just
 * off screen casting its shadow into the view.
 *
 * Not the ring's reach (that is the relief over the tangent of the sun altitude, computed): its
 * RESOLUTION. The ring is generated at the coarsest zoom that still spans the throw in this many
 * tiles, so raising it makes the distant casters finer at one caster draw per tile. 0 removes it, and
 * then a shadow disappears as the summit that throws it leaves the screen.
 */
export const terrainShadowCasterMargin = settingsStore('terrainShadowCasterMargin', 3);

/**
 * What a one-finger drag does while the 3D mode is up (the SDK's `FreeRoamMode`).
 *
 *  - `classic`: the map's own gesture — the finger drags the GROUND and the camera orbits its focus.
 *  - `look`: the drag turns the view about that focus instead, sideways the heading and up/down the
 *    tilt; panning moves to two fingers, pinch and rotation are unchanged.
 *  - `fps`: the camera stops orbiting anything. One finger turns the view about the CAMERA on both
 *    axes and the position never changes; two fingers walk forward/back and strafe. Pinch zoom and
 *    two-finger rotation are OFF, since neither belongs to that control scheme.
 *
 * `classic` by default: it is what every other gesture in the app does, and `fps` costs the pinch.
 * The peak finder is not a setting — a panorama is first person by definition — so this is the 3D
 * mode's alone.
 */
export type TerrainTouchMode = 'classic' | 'look' | 'fps';
export const terrainTouchMode = settingsStore<TerrainTouchMode>('terrainTouchMode', 'classic');

/** The tilt the auto rule switches at. Not a setting: it is the rule's definition, not a taste. */
export const TERRAIN_AUTO_FLATTEN_TILT = 88;
/** Style layers kept OUT of the drape bake and drawn live (`TERRAIN_NO_DRAPE_FILTER`).
 *  Contours MUST be in here: baked into a drape texture they survive in the tiles already cached, so
 *  they stay on screen below the zoom the style stops drawing them at. */
export const TERRAIN_NO_DRAPE_FILTER = '^contour|maneuver.*';
/**
 * Per-tile drape texture resolution, in pixels — how sharp the map layers are ON the ground.
 *
 * Draped content is rasterized into a texture of this size per tile and resampled onto the mesh, so
 * it trades the sharpness of thin content (lines, outlines, labels) against video memory, at
 * `resolution² × 4` bytes per visible tile. The SDK clamps it to [128, 2048].
 *
 * 0 takes it from the SCREEN instead, which is what the drape cache budget is sized for: the LOD
 * refines a tile until it covers at most a 2×2 block, so `2 × tileDrawSize × pixelScale` texels is
 * one texel per screen pixel.
 *
 * 1024, not the automatic rule: the rule is right about how many texels a tile needs at the LOD's own
 * bound, and wrong about this map — the contours and the road casings are hairlines, and a tile the
 * LOD leaves a level coarser than that bound (which is most of them, most of the time) halves their
 * resolution again.
 *
 * It was 2048 — the ceiling — and that is not payable, because a fixed value is the one case the SDK
 * does not size against the cache: `TileRenderer::resolveDrapeResolution` returns any non-zero
 * setting as asked, and only the automatic rule is fitted to `drapeCacheSize`. Worse, the cache's own
 * floor then raises the BUDGET to match: `TerrainDrapeCache::endFrame` takes
 * `max(drapeCacheSize, MIN_ENTRIES x resolution²x4)`, which at 2048 is `max(96 MB, 384 MB)`. Measured
 * on a Galaxy S22, rotating: `drapeCache colour=28/24 bytes=458752/393216 res=2048` — 448 MB of drape
 * textures against a 384 MB ceiling, over the count cap, evicting every frame. At 1024 with the
 * budget below it lands `colour=48/48 bytes=196608/196608`, exactly at budget and stable.
 *
 * That eviction IS the stutter when the camera turns fast, because it is what a rotation renames
 * most: same camera and the same interleaved runs, 65.6 fps median at 2048 against 75.7 at 1024, and
 * the worst frame per second-window fell from 74-91 ms to 43-48.
 *
 * 2048 remains selectable, and `terrainDrapeCacheSize` follows it on its own so that it stays
 * payable — picking a resolution is picking a memory cost, and the two must not be set apart.
 */
export const terrainDrapeResolution = settingsStore('terrainDrapeResolution', 1024);
/**
 * What the drape cache may hold, in MEGABYTES — `TerrainOptions.drapeCacheSize`, the other end of the
 * trade `terrainDrapeResolution` sets up. **0 follows the resolution**, which is the default.
 *
 * The cache keeps a generation of tiles alive past the visible cover, because a pan or a zoom walks
 * the cover back and forth over the same tiles and re-acquiring one means re-baking every layer of
 * it. So it has to hold TWO covers, not one: the live leaves plus the generation the stand-ins are
 * drawn from. A cover here is twenty-odd leaves, so 192 MB at 4 MB a tile (1024² x RGBA) is 48
 * entries — two covers with room to spare, and the measured `colour=48/48`.
 *
 * Which is exactly why it should not be a number the user carries from one resolution to the next:
 * the same 192 MB is two covers at 1024 and twelve tiles at 2048, so a budget left behind by an
 * earlier choice is the thrash this was written to stop. `resolveDrapeCacheSize` derives it instead,
 * and a non-zero value here overrides that for anyone who wants to spend differently.
 */
export const terrainDrapeCacheSize = settingsStore('terrainDrapeCacheSize', 0);
/** Drape tiles the cache should hold: the live cover, twenty-odd leaves, plus the generation behind it. */
const DRAPE_CACHE_TILES = 48;
/** Never below the SDK's own default (`TerrainDrapeCache::MAX_BYTES`), MB. */
const DRAPE_CACHE_MIN_MB = 96;
/**
 * ...and never above this, MB.
 *
 * `TerrainDrapeCache` has a floor of its own — `endFrame` takes
 * `max(drapeCacheSize, MIN_ENTRIES x resolution² x 4)`, MIN_ENTRIES being 24 — so at 2048 it will
 * allocate 384 MB whatever is asked for here. Asking for the 768 MB that 48 tiles would actually need
 * there buys nothing the floor does not already give, and no phone has it to spare.
 */
const DRAPE_CACHE_MAX_MB = 384;

/**
 * The cache budget that goes with a drape resolution, in MB.
 *
 * Free of the map and of NativeScript so it can be reasoned about on its own: this is the whole rule.
 *
 * @param resolution `terrainDrapeResolution`; 0 is the SDK's automatic rule, which sizes ITSELF
 *   against the budget, so handing it a derived budget would be circular — it gets 0 back and the two
 *   automatic ends meet at the SDK's own default.
 * @param setting `terrainDrapeCacheSize`; anything above 0 is the user's and is returned untouched.
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
/**
 * How long the switch waits for terrain-decoded tiles before ramping anyway, ms.
 *
 * There has to be a timeout: when every visible tile is ALREADY decoded for the terrain — switching
 * back and forth — the wait never ends on its own, and the switch hangs. Same value and same reason
 * as the demo's `TERRAIN_ANIM_TILE_TIMEOUT_MS`.
 */
export const TERRAIN_TILE_WAIT_TIMEOUT_MS = 500;

// --- peak finder: the view --------------------------------------------------------------------
//
// `DemoConfig.PEAK_FINDER_*`. No flight settings: the panorama has a map of its own now, so the
// camera is PLACED rather than flown to — there is nothing to animate and nothing to time.
/**
 * 0 is the HORIZON in this SDK's convention (90 is straight down), which is where a panorama looks:
 * anything above it spends screen on the ground in front instead of the ranges behind it. The demo's
 * `PEAK_FINDER_TILT` is 25, which still shows the valley you are standing over.
 */
export const peakFinderTilt = settingsStore('peakFinderTilt', 0);
/** How high the viewpoint opens above the ground it stands on. */
export const peakFinderFlyElevation = settingsStore('peakFinderFlyElevation', 1000);
/** The zoom the panorama opens at, which is what one screen width of horizon covers. */
export const peakFinderFlyZoom = settingsStore('peakFinderFlyZoom', 13.6);
/**
 * The widest the panorama may be HORIZONTALLY, degrees — and the answer to why the mode was several
 * times slower in landscape.
 *
 * The SDK's field of view is the VERTICAL one (`Options.fieldOfViewY`, default 70) and the
 * horizontal one is derived from the viewport: `_tanHalfFOVX = aspect * _tanHalfFOVY`
 * (`ViewState.cpp`). A phone turned on its side goes from an aspect of about 0.46 to about 2.17, so
 * with fovY held at 70 the horizontal field opens from ~36° to ~113°. Nothing is WRONG in landscape;
 * the mode is simply asking for the ground inside a frustum nearly five times wider, 150 km deep,
 * and almost every cost here — tiles walked, meshes built, summit labels placed — is proportional to
 * exactly that.
 *
 * So this is a CEILING on the horizontal field, applied by lowering `fieldOfViewY`. It can only ever
 * narrow the view, never widen it: in portrait the derived limit is well over 100°, so the ceiling
 * does not bind and portrait is untouched. In landscape it holds the picture to this many degrees
 * across — still wider than portrait, at a fraction of the work.
 *
 * 0 means the BACK CAMERA's own field, which is the default: a peak finder is read against the view
 * it is held up to, so a summit should be the size it is through the phone. That lands around 65°,
 * inside the range that measured smooth in landscape, and it is the same figure AR matches exactly.
 *
 * It is a CROP and nothing more: the camera is left exactly where the uncapped field put it (see
 * `zoomForFieldOfView`), so narrowing this does not change how far the ground is drawn, which tiles
 * are loaded or how big a label is.
 *
 * A panorama is the right place for such a cap: its horizontal reach is what the picture IS, and a
 * 113° frustum on a phone is a fisheye of it. peakfinder.org pans a fixed horizontal field for the
 * same reason.
 *
 * IGNORED IN AR. There the field of view is not a preference but a measurement of the camera behind
 * the frame — it is what makes a summit the same size in the terrain as in the preview — so
 * `arGeometry` in `features/peakFinder.ts` takes over.
 */
export const peakFinderMaxFieldOfView = settingsStore('peakFinderMaxFieldOfView', 0);
/**
 * Warp the AR terrain by the camera's own lens distortion.
 *
 * A photograph is not a rectilinear projection and the terrain is: a phone's wide lens barrels by
 * several percent at the frame corners, which once the field of view matches is by far the largest
 * thing left between the outline and the ridge it is meant to sit on. The correction is a resampling
 * of the whole rendered frame (`distortUv` in `mapModules/terrain/reliefShaders.ts`) by the
 * coefficients the platform reports.
 *
 * ANDROID ONLY, and only on devices that report them: `LENS_DISTORTION` is a Camera2 characteristic,
 * whereas AVFoundation delivers a lens model only alongside a PHOTO capture, never for a preview
 * session. Where there are no coefficients the warp is exactly the identity, so this switch is there
 * for the case it makes things worse rather than better — a device whose reported coefficients do
 * not describe the stream the preview is actually showing.
 */
export const peakFinderLensCorrection = settingsStore('peakFinderLensCorrection', true);
/**
 * How far behind the terrain a label anchor may sit and still be labelled, as a fraction of its
 * distance. 0.02 is the SDK default; a summit sitting right ON a ridge is exactly what this view is
 * for, so the mode is deliberately generous.
 */
export const peakFinderOcclusion = settingsStore('peakFinderOcclusion', 0.15);
/** A panorama is the case tangram's view-distance rule answers badly, hence well above 1. */
export const peakFinderViewDistance = settingsStore('peakFinderViewDistance', 3);
/**
 * How far the ground is drawn, in METRES, whatever the zoom, the tilt or the viewpoint's height.
 *
 * The factor above cannot answer this. It scales tangram's rule, which is proportional to the
 * camera's height above the ground — so descending towards the terrain shortens the view, which is
 * right for a map seen from above and exactly wrong for a panorama: the range on the horizon should
 * not disappear because the viewpoint came down to the ridge. `TerrainOptions.viewDistance` is the
 * absolute one, and it only ever EXTENDS the factor rule.
 *
 * 150 km, because the point of reference is Mont Blanc seen from Grenoble — 108 km line of sight —
 * and the geo-three webapp draws to 173 km (`settings.far`). It is the mode's most expensive number:
 * the ground reaches that far at any tilt, and every kilometre of it is tiles walked and meshed
 * (`maxTileZoomCoarsening` is what keeps the count sane out there).
 */
export const peakFinderViewDistanceMetres = settingsStore('peakFinderViewDistanceMetres', 150000);
/**
 * Grid cells per tile edge while the panorama is up, over the 3D mode's own.
 *
 * A panorama is read by its RIDGE LINES and the outline effect draws them off the terrain depth, so
 * a coarse mesh does not merely look faceted — it puts a kink in every skyline. Affordable here in a
 * way it is not on the live map: the mode carries no tile layers, no labels but the summits, no drape.
 *
 * 96 and not more, because 96 is the ceiling: this mode has no draped layers, so the surface it draws
 * is `TerrainRenderer`'s, and that renderer clamps every mesh to its own `MAX_MESH_GRID_SIZE` of 96
 * (`renderers/TerrainRenderer.h`) — asking for 256 gets 96, silently. The geo-three webapp meshes at
 * 320/512, so this is where the two cannot be made to match without raising that constant.
 */
export const peakFinderMeshResolution = settingsStore('peakFinderMeshResolution', 256);
/** false = ink on paper, true = paper on ink (and what AR wants). */
export const peakFinderDark = settingsStore('peakFinderDark', false);

/** One tap of an elevation arrow, metres (`DemoConfig.PEAK_FINDER_ELEVATION_STEP`). */
export const PEAK_FINDER_ELEVATION_STEP = 200;
/** Metres per second the viewpoint climbs while an arrow is HELD, and what that ramps up to. */
export const PEAK_FINDER_ELEVATION_RATE = 400;
export const PEAK_FINDER_ELEVATION_RATE_MAX = 4000;
/** Seconds of holding after which the rate has reached its maximum. */
export const PEAK_FINDER_ELEVATION_RAMP = 2.5;
/** As high as the arrows go. Above this the panorama is a map again. */
export const PEAK_FINDER_ELEVATION_MAX = 9000;

// --- peak finder: the render ------------------------------------------------------------------
//
// `DemoConfig.RELIEF_*`, so the mode looks like the android demo out of the box. See
// app/mapModules/terrain/reliefShaders.ts — the shaders themselves are that demo's, verbatim.
/** How far the slopes go from the paper colour towards the shade colour. */
export const peakFinderShadeStrength = settingsStore('peakFinderShadeStrength', 0.55);
/** Base ink line width, px. */
export const peakFinderOutlineWidth = settingsStore('peakFinderOutlineWidth', 1.2);
/** How much terrain-against-terrain lines fade with distance, so the horizon stays the boldest. */
export const peakFinderDistanceFade = settingsStore('peakFinderDistanceFade', 0.45);
/** Extra width for the sky silhouette — the horizon line, the one drawn wide. */
export const peakFinderHorizonBoost = settingsStore('peakFinderHorizonBoost', 2.5);
/** Strength of the ridge/valley fold lines. */
export const peakFinderCreaseStrength = settingsStore('peakFinderCreaseStrength', 0);
/**
 * How sharp a fold has to be before it is drawn as a crease — and with it, the TILE SEAM control.
 *
 * A seam and a ridge are the same thing to the outline shader: a place where the surface changes
 * slope. What tells them apart is HOW MUCH. A crest folds hard; a tile edge between two different
 * mesh levels is a slight kink, because the coarse side chords straight across ground the fine side
 * curves over — and the surface the peak finder draws has no cross-LOD stitching (that is
 * `TileRenderer`'s, for draped layers), so those kinks are real geometry, not a shader artefact.
 *
 * Raising this therefore fades the seams out and keeps the ridges: it is the fold SIZE below which
 * nothing is drawn. The shader's own floor was 0.05, which drew almost any kink. 0.12 is above the
 * LOD kinks measured on a panorama and well below a crest.
 */
export const peakFinderCreaseThreshold = settingsStore('peakFinderCreaseThreshold', 0.12);
/**
 * How much the CREASES fade with distance, apart from the silhouettes.
 *
 * The other half of the seam story: tiles coarsen with distance, so the kinks are worst exactly where
 * the folds matter least — the far ranges are read by their skyline, not by their gullies. This fades
 * the fold lines out faster than `peakFinderDistanceFade` does the terrain-against-terrain ones,
 * while the sky silhouette (which fades not at all) keeps the horizon.
 */
export const peakFinderCreaseFade = settingsStore('peakFinderCreaseFade', 0.15);

/**
 * SLOPE ink — the term that draws the relief between the ridges, and geo-three's whole outline
 * effect (`webapp/app.ts`, `CustomOutlineEffect`).
 *
 * Our silhouette test is one-sided and the crease test is damped by how square-on the surface is, so
 * between them they drew the skyline and the crests and left every slope blank — the panorama read as
 * a set of outlines with nothing inside them. This is the other technique: ink proportional to how
 * fast the DEPTH changes across a pixel, symmetric, with no regard for which side is nearer.
 *
 * 1 is the webapp's look at full strength; 0 turns it off and leaves the outlines alone.
 */
export const peakFinderSlopeStrength = settingsStore('peakFinderSlopeStrength', 1);
/**
 * How much the depth difference is amplified before the curve below — their `depthMultiplier`, 11.
 *
 * Their depth is normalised over the whole view (`far` 173 km), so this number is tied to how far the
 * view reaches: a shorter view spreads the same relief over a larger share of the depth range and
 * inks harder. Hence a setting rather than a constant.
 */
export const peakFinderSlopeMultiplier = settingsStore('peakFinderSlopeMultiplier', 50);
/**
 * The exponent the amplified difference is raised to — their `depthBiais`, 0.23.
 *
 * BELOW one, which is the point: it lifts the small differences that a gentle slope produces (a
 * thousandth of the depth range comes out at a third of full ink) while leaving the large ones
 * saturated. Above 1 it does the opposite and only the steepest faces draw.
 */
export const peakFinderSlopeBias = settingsStore('peakFinderSlopeBias', 0.8);
/** How much of the distance washes out towards the paper colour. */
export const peakFinderHaze = settingsStore('peakFinderHaze', 0.7);

// --- peak finder: the summit labels -----------------------------------------------------------
//
// Every one of these is style TEXT, so changing one needs a NEW decoder — see rebuildPeaksLayer in
// features/peakFinder.ts.
export const peakFinderLabelPinTop = settingsStore('peakFinderLabelPinTop', true);
export const peakFinderLabelBand = settingsStore('peakFinderLabelBand', 0.25);
export const peakFinderLabelAngle = settingsStore('peakFinderLabelAngle', 55);
/**
 * How many rows a colliding label may step into before it is DROPPED.
 *
 * This is the reason a panorama shows fewer summits than it holds: with one row, two names whose
 * anchors land within `peakFinderLabelMinDistance` of each other cannot both be placed, so the
 * lower summit is not drawn at all. 3 rows is three chances at a slot, and `text-callout-step`
 * stacks them away from the screen edge.
 */
export const peakFinderLabelRows = settingsStore('peakFinderLabelRows', 3);
/**
 * Shortest gap between two summit labels, px — the other half of how many names appear.
 *
 * 14 px is a plate's own height, so neighbouring summits on the same ridge knocked each other out.
 * 6 px lets them sit next to each other; 0 turns the rule off entirely and lets them overlap.
 */
export const peakFinderLabelMinDistance = settingsStore('peakFinderLabelMinDistance', 6);
/** 0 = no limit. */
export const peakFinderLabelMaxDistance = settingsStore('peakFinderLabelMaxDistance', 0);

/**
 * Which way up the panorama is held.
 *
 * `auto` leaves the orientation alone — the device decides, and the user's own rotation lock is
 * respected. A panorama is a wide picture so landscape suits it, but forcing it is the kind of thing
 * that annoys people holding a phone one-handed, hence `auto` rather than `landscape` by default.
 */
export type PeakFinderOrientation = 'auto' | 'landscape' | 'portrait';
export const peakFinderScreenOrientation = settingsStore<PeakFinderOrientation>('peakFinderScreenOrientation', 'auto');

// --- live state, deliberately NOT persisted ---------------------------------------------------
//
// A mode the app came back up in would leave the user in a landscape panorama with no idea why.
export const terrain3dActive = writable(false);
export const peakFinderActive = writable(false);
export const peakFinderArActive = writable(false);
export const peakFinderHeadingFollowing = writable(false);
/**
 * Where the panorama is LOOKING, degrees clockwise from north.
 *
 * Published by the mode from the panorama's own camera (the map's rotation is the opposite of the
 * heading), so the overlay's compass reads the view rather than the device — they are the same thing
 * only while the compass or AR is following.
 */
export const peakFinderHeading = writable(0);
/** Metres the viewpoint is currently lifted above the ground. */
export const peakFinderElevation = writable(0);
/**
 * True while a mode switch's camera flight is running.
 *
 * The tilt range has to stay open for it: `CameraTiltEvent::calculate` clamps the tilt to the range
 * on EVERY frame, so narrowing it while a flight is still tilting snaps the camera to the new bound
 * instead of animating to the target. Flipping `terrain3dActive` / `peakFinderActive` is the first
 * thing a switch does, so without this the way OUT of either mode is a pop, not a move.
 */
export const mapTiltTransition = writable(false);

/** The summit the user last tapped, as the overlay's chip needs it. */
export interface SelectedPeak {
    name: string;
    elevation?: number;
    position: MapPos;
    /** Metres from the viewpoint, at the moment it was picked. */
    distance: number;
}
export const peakFinderSelectedPeak = writable<SelectedPeak>(null);

/**
 * The map's allowed tilt range, which three things now have an opinion about.
 *
 * Derived rather than written by whoever changed last: the modes come and go independently, and the
 * one line in Map.svelte that used to own this could only see `pitchEnabled` — so entering a mode
 * and then toggling that setting put the range back and broke the mode.
 */
/**
 * The range every tilted mode — and every flight on its way in or out of one — needs.
 *
 * Down to 0, the horizon: that is the panorama's own tilt, and a floor above it would clamp the
 * fly-in short of it on every frame.
 */
export const TILTED_RANGE: [number, number] = [1, 90];

/**
 * The panorama's own range, which reaches UP past the horizon (a negative tilt is a look up).
 *
 * The peak finder drives the map in FIRST PERSON — a one-finger drag turns the view about the camera
 * rather than dragging the ground — and every frame of that drag is clamped to this range. A floor at
 * the horizon would stop the drag dead there, so a summit standing above the viewpoint could not be
 * looked at. Short of AR's full `[-90, 90]`: without a device to aim, straight up is only the sky.
 */
export const PANORAMA_RANGE: [number, number] = [-45, 90];

export const mapTiltRange = derived([pitchEnabled, terrain3dActive, mapTiltTransition], ([$pitchEnabled, $terrain3dActive, $mapTiltTransition]): [number, number] => {
    // The peak finder has no say here any more: it runs on a map of its OWN, which sets
    // `PANORAMA_RANGE` on itself. This is the live map's range, and the live map keeps it.
    if ($terrain3dActive || $mapTiltTransition) {
        return TILTED_RANGE;
    }
    return [$pitchEnabled ? 30 : 90, 90];
});
