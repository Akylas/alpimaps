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
 * 64, the demo's and tangram's own. This was 128 for a while — a ridge at 64 is visibly faceted and
 * its tile edges show, which is what the geo-three webapp avoids by meshing at 320 on mobile and 512
 * elsewhere — but it is not a cosmetic knob, it is the multiplier on everything the surface costs.
 * Measured: 8.5 fps against 15.2 on a Crosscall, and with cast shadows on it multiplies the shadow
 * passes too, since the receiver's cost is per surface vertex. Galaxy S22, Grenoble city camera with
 * buildings and shadows, rotating: 78.0 fps at 128 against 93.6 at 64, GPU 7.35 ms against 4.49,
 * `shadowCast` 2.88 against 1.13, `shadowMask` 1.26 against 0.46. Raise it on a device that can pay.
 *
 * Two ceilings above it, both in the SDK: `TerrainOptions::setMeshResolution` clamps to 256, and the
 * grid is never finer than the DEM has texels for that tile. And it only reaches this far in the
 * draped path (`TileRenderer`'s regular grid); the bare surface and the depth pre-pass are
 * `TerrainRenderer`'s, which caps at `MAX_MESH_GRID_SIZE` = 96 — see `peakFinderMeshResolution`.
 */
export const terrainMeshResolution = settingsStore('terrainMeshResolution', 64);
/**
 * The resolution of the HEIGHT FIELD, which is not the resolution of the mesh — `TerrainOptions.
 * surfaceNodeResolution`. 0 follows `terrainMeshResolution`, which is what the SDK did before the
 * two could be asked for separately.
 *
 * They are not the same thing and only this one carries relief. The vertex stage never samples the
 * DEM: it samples the node field, the DEM box-filtered to this many cells per edge of a **DEM** tile.
 * The mesh is a lattice per **render** tile. Once the camera is past the DEM's max zoom the render
 * tile covers a fraction of a DEM tile — at z16 on a z12 source, 32 texels — so even 96 cells is
 * finer than the data, and everything that looked like "the mesh is too coarse" was the field.
 *
 * With the source at z12 and 512-texel tiles, this value against a 6.9 km tile at Grenoble:
 *
 * | value | nodes / DEM tile | spacing | box  |
 * |-------|------------------|---------|------|
 * | 64    | 128              | 54 m    | 108 m|
 * | 96    | 192              | 36 m    | 72 m |
 * | 256   | 512              | 13.5 m  | 27 m | ← one node per texel, the source's own limit
 *
 * 256 with `terrainMeshResolution` at 64-96 is the point: the detail of 256 at the panning cost of
 * 96, because the lattice was never the constraint. What it costs is memory — ~790 KB of node field
 * per cached DEM grid against ~150 KB at 96 — which is what a mesh of 256 was already paying for.
 *
 * Above 256 buys nothing here: the field cannot be finer than one node per DEM texel.
 */
export const terrainNodeResolution = settingsStore('terrainNodeResolution', 256);
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
/**
 * How high the viewpoint opens above the ground it stands on.
 *
 * 0, not 1000: this mode means STAND on the summit, and 1000 m put the eye a kilometre over it,
 * looking down at the range instead of across it. The slider still goes to 6000 for the fly-over.
 */
export const peakFinderFlyElevation = settingsStore('peakFinderFlyElevation', 0);
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
/**
 * The panorama's height field resolution — `terrainNodeResolution` for this mode, and see it for what
 * the field is and why it is not the mesh.
 *
 * Stated rather than inherited, which matters here more than on the map: the field followed
 * `MeshResolution`, and this mode asks for 256 knowing `TerrainRenderer` will clamp the drawn mesh to
 * 96. So the field has always been at the source's own limit — by accident of a number chosen for the
 * mesh. Lowering `peakFinderMeshResolution` to buy frames would have silently taken the relief with
 * it, which is the trade nobody would have meant to make.
 */
export const peakFinderNodeResolution = settingsStore('peakFinderNodeResolution', 256);
/**
 * Ground distance the surface normals are measured over, metres — **the tile-seam fix**.
 *
 * `TerrainOptions::setNormalSampleDistance`. 0 takes the gradient from the mesh, which is what makes
 * the seams: a tile carries the same cell count whatever ground it covers, so the differentiation
 * step halves with every zoom level and two tiles meeting at an LOD boundary smooth the same hillside
 * by different amounts. Their normals then disagree along the whole shared edge. Shading never
 * notices; `ridge_strength` reads `|∇normal|` across a pixel and inks every boundary in the view.
 *
 * At a fixed distance the normal is a property of the DEM instead, so both sides sample the same two
 * points and agree — nothing to draw. It is what peakfinder.com gets for nothing by having no tiles
 * in its geometry at all: one panorama mesh over a DEM texture array, one sampling rate everywhere.
 *
 * Costs four cached elevation lookups per mesh vertex, once per mesh rather than per frame. Planar
 * only — the globe's sample offsets are not the local frame's, so a spherical surface falls back to
 * the mesh gradient and this stops working. The panorama is therefore pinned to the plane; see the
 * globe note further down for the measurements.
 *
 * 60–150 m reads ridges without inking every DEM step.
 *
 * It must not be finer than the DEM: `ensureSurfaceAttribs` cannot differentiate below the texel of
 * the grid a tile stands on, so it clamps `step = max(asked, gridTexel)`, and a tile on a coarse
 * ANCESTOR then samples at that ancestor's rate — the per-tile variation this setting exists to
 * remove. 90 m is well inside the source's own z12 (`DEM source zoom range 0..12`, logged on device),
 * so the clamp only binds while a tile is still standing on an ancestor. Raising this to hide that
 * is the wrong lever: it costs real detail everywhere to paper over tiles that simply have not
 * loaded. The measured 82% clamp rate (1x=23 2x=24 4x=17 8x+=62) is a LOADING result, not a data
 * ceiling — see the prefetch queue in `ElevationManager`.
 */
export const peakFinderNormalSampleDistance = settingsStore('peakFinderNormalSampleDistance', 90);
/**
 * Tile zoom the panorama's terrain mesh is cut at. 0 lets the distance rule and the budget decide.
 *
 * `TerrainOptions::setMaxZoom`, and the answer to three complaints at once, because all three come
 * from the same thing: a ground-level camera subdivides what is in front of it as deep as the data
 * allows, and keeps subdividing as finer elevation tiles arrive, so the height field never settles.
 *
 *  - **names are not constant.** A label is anchored to the ground under its summit, so when that
 *    ground moves the label moves (`vt::Label::updateElevation`) and a placement that had settled is
 *    re-decided. Measured: `elevReanchor` 7-102 per second while tiles stream.
 *  - **the view rises and sinks while tiles load.** The camera is held above the terrain, and the
 *    terrain keeps moving.
 *  - **tile seams.** Mid-refinement, neighbouring tiles resolve to DIFFERENT elevation grids — each
 *    takes the finest one resident for it — so their shared edge is built from two height fields
 *    that disagree.
 *
 * Pinned, the height field resolves once and stays. peakfinder.com does the same thing by loading
 * the DEM for its viewpoint once and never refining it. The price is detail close to the eye.
 *
 * 14, NOT 12 — 12 was paying that price twice over. The cut is what sets the triangle, because
 * `TerrainRenderer` caps the grid at `MAX_MESH_GRID_SIZE` (96) cells per tile whatever
 * `peakFinderMeshResolution` says: at z12 a tile is 6.9 km at Grenoble's latitude, so the mesh is
 * 72 m triangles — the faceting the near ridges showed, against a DEM holding 13.5 m. And the cut
 * also decides the GRID: a z12 tile resolves the z11 DEM (one level for the 512-texel source's zoom
 * bias), so the heights came from 27 m texels rather than the file's own 13.5 m.
 *
 * At 14 a tile is 1.7 km, the triangle is 18 m and the grid is z12 — the source's maximum. 15 halves
 * the triangle again for nothing the DEM can fill, and `calculateVisibleTiles` will not go past
 * `sourceMaxZoom + 3` in any case. What the two extra levels cost is tiles: the budget below is half
 * of `peakFinderMeshCacheSize`, and a cut that overflows it coarsens a level everywhere, which hands
 * the detail straight back.
 */
export const peakFinderTerrainMaxZoom = settingsStore('peakFinderTerrainMaxZoom', 14);
/**
 * The panorama's elevation GRID cache, megabytes. 0 hands the SDK's own rule back.
 *
 * The SDK sizes this by grid COUNT — `ElevationManager::MIN_CACHED_GRIDS`, 192 — which is a map's
 * working set: the ground around one viewpoint at one zoom. A panorama sees a hundred kilometres at
 * once, so 192 grids is a fraction of what it reads. Measured on a Crosscall, mid-session:
 * `bytes=335MB capacity=336MB` (full, permanently), 9–11 grid inserts a second that never stopped,
 * and `distinctEver` past 850 against 192 slots. Every eviction was refetched immediately.
 *
 * The price is paid in CPU, not memory. Each `ElevationManager` runs three decode threads, and a
 * cache that never holds its working set keeps them all busy for as long as the mode is open. Six
 * such threads (two managers' worth) burned ~34,600 CPU ticks against the render thread's 3,094 —
 * eleven times the renderer — which is why looking around hung while the renderer was idle.
 *
 * 768 rather than more: the grids this DEM serves are 1796 KB, so this is ~430 of them against the
 * default 192. Raise it on a device with headroom; a wide view is what this pays for.
 */
/**
 * How many terrain surface MESHES the panorama may cache. 0 keeps the SDK's rule (160).
 *
 * The SDK's number is a map's working set. A panorama's is several times that, and not because it
 * draws more tiles: looking around changes each tile's LOD STITCHING MASK, which is part of the mesh
 * cache key, so panning mints new keys faster than a 160-entry cache holds them. Measured on the
 * Crosscall at 160, while panning: `RenderStats terrainMesh` builds=72 evictions=72 in one second —
 * every build threw one out — and each rebuild re-bakes the surface normals for 4225 vertices, which
 * on the fixed-scale path is four DEM reads apiece. That showed up as `PROF PRELUDE` spikes of
 * 200-290 ms, all of it in `surface`, which is the hang while looking around.
 *
 * Half of this is also the VISIBLE CUT's budget, so it sets the LOD floor: the cut coarsens a whole
 * zoom level whenever it overflows, and a small cache therefore makes the panorama keep dropping and
 * regaining detail — which is the patchwork of differently-shaded tiles.
 */
export const peakFinderMeshCacheSize = settingsStore('peakFinderMeshCacheSize', 640);
export const peakFinderElevationCacheSize = settingsStore('peakFinderElevationCacheSize', 768);
/** false = ink on paper, true = paper on ink (and what AR wants). */
export const peakFinderDark = settingsStore('peakFinderDark', false);

/*
 * THE GLOBE, AND WHY THE PANORAMA DOES NOT USE IT.
 *
 * `peakFinderSpherical` used to live here and is gone. What it was for is real and still open: on the
 * Mercator plane the earth does not curve away, so a summit a hundred kilometres out is drawn at its
 * full height above the eye instead of sunk behind the bulge. The drop is `distance² / (2R)` — some
 * 900 metres at the 108 km Mont Blanc stands from Grenoble — and everything the mode is about is
 * wrong by that: how high a far summit sits, whether a nearer ridge hides it, where its leader line
 * lands.
 *
 * RENDER_PROJECTION_MODE_SPHERICAL was the wrong way to buy it, and the device says so. Panorama on a
 * Crosscall: 3-7x the surface fill draws, 74 ms frames against 27, every reopen worse than the last.
 * And it turned the mode's own mechanism off - `TerrainRenderer::ensureSurfaceAttribs` reads
 *     bool fixedScale = normalSampleDistance > 0 && !spherical;
 * so on a globe the fixed-distance normals are unreachable and the surface falls back to the mesh
 * gradient, which inks every LOD tile boundary. That is exactly what
 * `peakFinderNormalSampleDistance` exists to prevent, so the setting defeated the feature it was
 * meant to sit beside. It also makes `BaseMapView::moveCameraTo` land close rather than exact,
 * because on a sphere a translation is a rotation.
 *
 * The right mechanism is the one peakfinder.com uses, and we already know their constant: their
 * terrain vertex shader drops each vertex by `distance² · 6.54443e-08`, which is `1 / (2R)` for
 * R = 7640 km - the earth's radius times 6/5, the standard atmospheric REFRACTION correction (light
 * bends towards the ground, so a far summit stands about an eighth higher than geometry alone says).
 * A term in the terrain vertex shader costs one multiply-add per vertex, changes no projection, no
 * tile transformer and no tessellation, and keeps the fixed-distance normals. That is the feature
 * worth having; the globe was not.
 *
 * The stored key is deliberately no longer READ. It was persisted true on at least one device, so
 * changing a default here would not have reached it.
 */

/** One tap of an elevation arrow, metres (`DemoConfig.PEAK_FINDER_ELEVATION_STEP`). */
export const PEAK_FINDER_ELEVATION_STEP = 200;
/** Metres per second the viewpoint climbs while an arrow is HELD, at the FLOOR. */
export const PEAK_FINDER_ELEVATION_RATE = 400;
/**
 * How much of the current height is added to that rate, per second.
 *
 * The climb used to ramp with how long the arrow had been HELD, which is the wrong variable: it
 * makes the control's speed depend on history rather than on where the eye is. Standing 40 m up,
 * 400 m/s overshoots the valley in a tenth of a second; at 6 km it takes fifteen seconds to get
 * anywhere. Scaling the rate by the height itself makes it a GEOMETRIC climb — a constant fraction
 * per second, so the same drag covers the same proportion of the way up wherever it starts, and the
 * control has the same feel at 50 m and at 9 km.
 *
 * 0.6 doubles the height about every 1.2 s once clear of the floor.
 */
export const PEAK_FINDER_ELEVATION_GROWTH = 0.6;
/** Metres per second the climb is capped at, however high the eye is. */
export const PEAK_FINDER_ELEVATION_RATE_MAX = 4000;
/**
 * How far above the GROUND the viewpoint sits at its lowest, metres.
 *
 * Not zero, which is where the panorama used to open and what made the arrows read "0 m". Standing
 * exactly on the height field puts the eye inside the surface's own sampling error, so the nearest
 * cell hides everything behind it and half the panorama is the ground a metre in front of the face.
 * peakfinder.com carries the same idea as a setting of its own — `minimalelevation` in their wasm,
 * alongside `elevationoffset` (the arrows' value) and the `elevation_above_ground` label, which is
 * also why their read-out is a height above the ground rather than an absolute one.
 *
 * Their number is compiled in, not a string, so it is not recoverable from the binary; 50 m is a
 * head above the nearest ridge without being a viewpoint nobody could stand at.
 */
export const peakFinderMinElevation = settingsStore('peakFinderMinElevation', 50);
/** As high as the arrows go. Above this the panorama is a map again. */
export const PEAK_FINDER_ELEVATION_MAX = 9000;

// --- peak finder: the render ------------------------------------------------------------------
//
// `DemoConfig.RELIEF_*`, so the mode looks like the android demo out of the box. See
// app/mapModules/terrain/reliefShaders.ts — the shaders themselves are that demo's, verbatim.
/**
 * How much of the shading comes from the SUN, as opposed to from the slope below.
 *
 * Lowered under the slope term deliberately. The sun term is the only part of the picture that
 * depends on which way the camera points — it shades by ASPECT, so turning on the spot swaps a
 * sunlit range for a shaded one — and leaning on it is what made the panorama read completely
 * differently to the left and to the right. The slope term says the same thing from every angle.
 */
export const peakFinderShadeStrength = settingsStore('peakFinderShadeStrength', 0.18);
/**
 * SLOPE SHADING — darkness proportional to how STEEP the ground is, with no sun in it.
 *
 * peakfinder.com's, read off their panorama fragment shader: `length(normal.xz) * P1.z` added into the
 * same darkness the lighting writes. It is what puts relief inside their ridges, and it is not
 * hillshading — nothing here depends on a light direction, so a face keeps its shading on the shadow
 * side and the picture does not change through the day.
 *
 * Worth having on top of `peakFinderShadeStrength` because Lambert alone cannot draw a panorama: with
 * the sun anywhere but across the view, half the ranges are lit flat and read as blank paper. The
 * slope term is the one that always has something to say. 0.35 puts a 45° face a quarter of the way
 * to the shade colour, which is about where their picture sits; 0 is the look before this existed.
 */
export const peakFinderSlopeShade = settingsStore('peakFinderSlopeShade', 0.22);
/** Base ink line width, px. */
export const peakFinderOutlineWidth = settingsStore('peakFinderOutlineWidth', 1.2);
/**
 * How far the ink reaches, IN METRES. peakfinder.com's distance CUTOFF, in absolute units.
 *
 * Metres and not a fraction of the far plane, which is what this was and which made the whole
 * picture change as you turned on the spot: the far plane is recomputed every frame from where the
 * view's rays meet the ground, so it is short looking into a valley and long looking down a range.
 * The same hillside therefore landed at a different normalised depth depending only on the azimuth,
 * and its ink came and went. peakfinder.com can normalise by their far plane because theirs is
 * fixed; ours is not.
 *
 * Theirs is `min(value, 1 - smoothstep(p - 0.05, p + 0.15, depth))` and the shape is what matters.
 * The two linear fades this replaces (`peakFinderDistanceFade`, `peakFinderCreaseFade`) ramped to a
 * floor, so every distance still carried some ink — and out where ridges are a pixel apart, "some
 * ink on every ridge" is a solid black band whatever the floor is. A smoothstep reaches exactly
 * zero, so past this there is shaded surface and nothing else, which is how the reference's far
 * ranges stay pale.
 *
 * The sky silhouette is outside it: the horizon draws at any distance.
 */
export const peakFinderInkDistance = settingsStore('peakFinderInkDistance', 50000);
/**
 * Where a depth gradient starts counting as a SILHOUETTE, in metres of depth change across one tap.
 *
 * peakfinder.com gates theirs at a constant `smoothstep(0.005, 0.020, dLen)` on a depth normalised
 * over a fixed ~173 km far plane — so about 865 m, which is this default. Ours has to be absolute
 * because our far plane is recomputed every frame.
 *
 * Raise it to keep only the big skyline breaks; lower it to ink every small step in the terrain.
 */
export const peakFinderSilhouetteGate = settingsStore('peakFinderSilhouetteGate', 865);
/**
 * How far the ink is capped by how dark the SURFACE under it already is. 0 is uncapped.
 *
 * NOT peakfinder.com's `min(value, lightning)`, though it was written as a port of it and shipped
 * at 1, which removed every ridge line in the panorama. Theirs caps a single greyscale channel that
 * already contains their slope shading; ours has the shading in a separate surface shader, so
 * capping the ink alone by that surface is a different operation — and against a near-white paper
 * the surface darkness is ~0 over most of the frame, so the cap erased everything.
 *
 * Left as a knob because a little of it is a fair way to stop ink stacking on already-dark ground.
 * See `reliefShaders.ts` for the full reasoning.
 */
export const peakFinderInkShadeCap = settingsStore('peakFinderInkShadeCap', 0);
/**
 * Dump one intermediate term of the relief shader as an image, instead of the finished picture.
 *
 * For working out WHICH stage is wrong rather than inferring it from the result — every guess made
 * from a finished screenshot so far has been wrong at least once, because half a dozen terms
 * multiply together and any of them going to zero looks the same in the output.
 *
 *  0 — off, draw normally
 *  1 — SLOPE, `length(n.xy)` off the packed normal. Black = the tile's normals are flat, which kills
 *      the ridge ink and the slope shading together. This is the one to look at first.
 *  2 — the final ink (`edge`), after every gate and fade
 *  3 — HAZE, how far this pixel is pulled to the paper
 *  4 — distance, white at 100 km
 *  5 — raw packed depth × 20
 *  6 — the normal as colour. A seam between tiles shows as a colour break; a flat tile is pure blue.
 *  7 — the SURFACE shader's own slope, off `v_normal` rather than off the packed buffer. Against
 *      view 1 this isolates the normal-packing pass: both black means the mesh attribute is flat,
 *      only 1 black means the packing pass is losing it.
 */
export const peakFinderDebugView = settingsStore('peakFinderDebugView', 0);
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
 * Draw the interior ridges off the terrain's own NORMAL instead of reconstructing folds from depth.
 *
 * The reason the two settings above exist is that the fold test cannot tell a crest from a tile
 * seam, so `peakFinderCreaseStrength` is 0 and the panorama has no interior lines at all — which is
 * the most visible difference between it and peakfinder.com, whose picture is full of them. Theirs
 * is the screen-space gradient of the surface normal, and the normal is data rather than a guess, so
 * an LOD change is not a fold in it.
 *
 * What it costs is a different terrain pre-pass: `PostProcessEffect.terrainNormalsRequired` packs
 * 16-bit depth and the normal into the one buffer instead of 24-bit depth and a coverage bit. The
 * app falls back on its own where the SDK in the build does not have it, so this can be on by
 * default — see `useNormalBuffer` in `features/peakFinder.ts`.
 *
 * Panorama only. The live map's post-processing does not ask for terrain depth at all.
 */
export const peakFinderNormalEdges = settingsStore('peakFinderNormalEdges', true);
/**
 * Whether the map engine in THIS build can actually pack the normals — a fact, not a preference.
 *
 * `undefined` until the panorama has looked. It is published because the alternative was worse than
 * useless: with the buffer missing the effect falls back to the depth-fold shader, where
 * `peakFinderRidgeStrength` names a uniform nothing reads, so the ridge sliders do nothing at all
 * and the only control that still responds is the crease one — which inks tile seams. Silence there
 * reads as "these settings are broken", and it is one rebuild away from being right.
 */
export const peakFinderNormalEdgesAvailable = writable<boolean>(undefined);
/**
 * Strength of those ridge lines — a straight MULTIPLIER on how far the surface turned, now that the
 * term is linear like the reference's (`length(gradN) * params1.x`) instead of a smoothstep.
 *
 * Bigger than it used to be because the smoothstep it replaces was doing most of the gain: it
 * stretched the band [threshold, threshold + 0.35] over the full 0..1. A real crest turns the packed
 * normal by a few tenths, so a multiplier of about 2 puts one at full ink.
 */
export const peakFinderRidgeStrength = settingsStore('peakFinderRidgeStrength', 2);
/**
 * The DEADZONE under the ridge term — where the normal buffer's noise floor is, subtracted from the
 * turn before it becomes ink.
 *
 * Not a contrast control and not the seam control `peakFinderCreaseThreshold` is. The octahedral
 * pair is packed 8 bits a component, so one quantization step is 2/255 = 0.008, and a central
 * difference spans two of them. Those steps trace closed curves across a smooth hillside exactly the
 * way contour lines do, which is what the panorama was drawing instead of ridges. 0.05 clears the
 * floor with margin and is far below what a crest turns through.
 */
export const peakFinderRidgeThreshold = settingsStore('peakFinderRidgeThreshold', 0.05);
/**
 * The GROUND DISTANCE the ridge turn is measured over, in metres — the stroke's physical width.
 *
 * The ridge term is a central difference of the packed normal, and a fixed screen-space step measures
 * it over whatever ground a pixel happens to cover: a few metres underfoot, hundreds at the horizon.
 * That made the ink a function of DISTANCE instead of of how sharp the ridge is — far ranges solid,
 * near ground blank white, because underfoot the turn across one pixel falls under
 * `peakFinderRidgeThreshold` entirely. The shader now widens the tap spacing to cover this much
 * ground, which is what peakfinder.com's varying tap step does across the screen.
 *
 * 90 m to match `peakFinderNormalSampleDistance`: the normals themselves are sampled at that
 * distance, so asking the ink to resolve anything finer only reads their interpolation. Widening
 * only — the far field is already at or past this and keeps the stroke it has.
 */
export const peakFinderRidgeGroundSpan = settingsStore('peakFinderRidgeGroundSpan', 90);

// There is no slope-ink setting any more. It was geo-three's depth gradient
// (`webapp/app.ts`, `CustomOutlineEffect`), and peakfinder.com has no term like it: their pass
// (extracted in `peakfinder-reference-shader.md`) inks the normal gradient (our ridge term), the
// depth gradient as a SILHOUETTE with a fixed smoothstep, and the surface's own tilt —
// `length(centreNormal.xz) * params1.z`, which `RELIEF_SURFACE_SHADER` already draws as
// `uSlopeShade * length(n.xy)`. Measuring slope from depth instead is what greyed out the distance.

/** How much of the distance washes out towards the paper colour. */
export const peakFinderHaze = settingsStore('peakFinderHaze', 0.7);

// --- peak finder: the summit labels -----------------------------------------------------------
//
// Every one of these is style TEXT, so changing one needs a NEW decoder — see rebuildPeaksLayer in
// features/peakFinder.ts.
/**
 * Put each name just above its OWN summit instead of in a band, so they follow the skyline.
 *
 * Why a name can vanish with nothing visible near its peak: with a band, every plate sits in one
 * horizontal row near the top of the screen, and the leader line runs down to the summit. Capacity
 * is then screen width over plate width — about seven a row, twenty-odd over three rows — and every
 * summit in the view competes for those twenty. The plates a name lost to are hundreds of pixels
 * above it, nowhere near the empty sky where you expected it.
 *
 * Off the band the packing is two-dimensional: names spread along the ridges as well as across, so
 * far more of them fit and a name mostly competes with its own neighbours rather than with the
 * whole horizon. This is what peakfinder.com draws.
 *
 * `peakFinderLabelBand` is ignored while this is on; `peakFinderLabelPinTop` still applies.
 *
 * Default OFF, on the reference rather than on capacity. The band does fit fewer names — measured,
 * `sorted=1933 visible=51` over three passes against nineteen hundred candidates, which is the
 * row's own ceiling (screen width over plate width, times `peakFinderLabelRows`) — but skyline mode
 * spends that capacity the wrong way: it stacks a low nearby peak's name UNDERNEATH a distant
 * range's, which is exactly what the reference never does. peakfinder.com pins ONE row at the top
 * of the screen and drops whatever does not fit. Readability first; the capacity argument was mine,
 * not the reference's.
 */
export const peakFinderLabelFollowSkyline = settingsStore('peakFinderLabelFollowSkyline', false);
export const peakFinderLabelPinTop = settingsStore('peakFinderLabelPinTop', true);
export const peakFinderLabelBand = settingsStore('peakFinderLabelBand', 0.25);
/**
 * Rotation of the label text off its leader line, degrees.
 *
 * The capacity knob once `peakFinderLabelFollowSkyline` is on, because it trades the two screen
 * axes against each other: a name of width W laid at angle T spans `W·cos T` horizontally and
 * `W·sin T` vertically. Horizontal is the scarce one — summits crowd along the horizon, not up it —
 * so a steeper angle buys room. At 55 degrees a 100 px name eats 57 px of horizon; at 75 it eats 26.
 */
export const peakFinderLabelAngle = settingsStore('peakFinderLabelAngle', 75);
/**
 * How many rows a colliding label may step into before it is DROPPED.
 *
 * This is the reason a panorama shows fewer summits than it holds: with one row, two names whose
 * anchors land within `peakFinderLabelMinDistance` of each other cannot both be placed, so the
 * lower summit is not drawn at all. More rows is more chances at a slot, and `text-callout-step`
 * stacks them away from the screen edge.
 *
 * Default 1, deliberately. Extra rows are what put a small nearby peak's name BELOW a distant
 * range's, and the reference has no second row at all: a name that does not fit the top row is
 * simply not drawn. `text-rank` then decides which of two contenders that is - see `peaksStyle`.
 */
export const peakFinderLabelRows = settingsStore('peakFinderLabelRows', 1);
/**
 * Shortest gap between two summit labels, px — the other half of how many names appear.
 *
 * 14 px is a plate's own height, so neighbouring summits on the same ridge knocked each other out.
 * 6 px lets them sit next to each other; 0 turns the rule off entirely and lets them overlap.
 */
export const peakFinderLabelMinDistance = settingsStore('peakFinderLabelMinDistance', 6);
/**
 * How many placement passes a name holds its row for once it stops fitting.
 *
 * `text-callout-persist`, and the answer to a name that vanishes as its summit reaches the MIDDLE of
 * the screen. A rectilinear projection puts screen x at `tan` of the view angle, so the same angular
 * gap between two summits is about 1.4x wider at the edge of a 67-degree view than at its centre
 * (`sec²(33.5°)`). Two names that fit on their way in stop fitting as they arrive, and the lower one
 * loses its slot — which is why Mont Blanc never does this: `text-placement-priority: [ele]` places
 * it first and it never has to fight for a row.
 *
 * peakfinder.com does not have the problem at all because its panorama is CYLINDRICAL: screen x is
 * the angle itself, so angular spacing maps to screen spacing evenly and there is no crowded middle.
 * Short of that projection, holding the row is what keeps the band still.
 *
 * A held name may sit closer than `peakFinderLabelMinDistance` while it holds, but it is re-tested
 * against the grid every pass, so it never lands on top of a neighbour. Passes are seconds apart in
 * this mode (`VTLabelPlacementWorker`), so a few of them is a long time on screen.
 */
export const peakFinderLabelPersist = settingsStore('peakFinderLabelPersist', 10);
/** 0 = no limit. */
export const peakFinderLabelMaxDistance = settingsStore('peakFinderLabelMaxDistance', 0);
/**
 * How far outside the screen summit names are placed, px — **why they stop blinking**.
 *
 * `Options::setLabelPadding`, and NOT style text, so it costs no decoder. Placement packs only the
 * labels it can see: one outside the band gets no slot, so it arrives at the screen edge with the
 * row already full and has to knock a neighbour out to appear. That eviction, a few times a second
 * as the view turns, is the flicker — not the summit set, which the detail source already made
 * camera-independent.
 *
 * Padding moves the fight off-screen. A name that enters the band half a screen early has already
 * won or lost its row by the time it is visible, and what is on screen holds still.
 *
 * The SDK's own rule is 100 px scaled by sin(tilt), floored at 20 — which reasons about the GROUND,
 * where 100 px near the horizon are kilometres of map. A panorama is the case it gets wrong: tilt is
 * ~0 so it takes the floor of 20, and the view TURNS rather than panning, over ground already
 * loaded. 0 here hands it back to that rule.
 *
 * It is not free: the band's tiles are fetched as label tiles rather than preloading ones, and every
 * name in it is a placement and a collision test per pass.
 */
export const peakFinderLabelPadding = settingsStore('peakFinderLabelPadding', 200);

/**
 * Rebuild the coarse summit tiles out of the finer ones beneath them, in the map engine.
 *
 * `PointDetailTileDataSource`, which wraps the app's own vector source and re-emits the
 * `mountain_peak` layer of whatever tile is asked for from the tiles at `peakFinderPeakZoom`. It is
 * the same fix as `peakFinderStaticPeaks` and a better shape: the answer is a function of the TILE
 * rather than of the camera, so there is nothing to refresh when the eye moves — and it moves, a
 * two-finger drag in this mode being a walk rather than a pinch.
 *
 * It also works over tiles this app did not generate, which the snapshot does too but the obvious
 * third option (loosening the thinning in the generator) does not.
 *
 * Where the SDK in the build has no such source this falls back on its own, and `peakFinderStaticPeaks`
 * is what covers that case — see `ensureDetailPeaksSource` in `features/peakFinder.ts`.
 */
export const peakFinderDetailSource = settingsStore('peakFinderDetailSource', true);
/**
 * How many levels below a coarse tile that source will reach.
 *
 * `PointDetailTileDataSource::setMaxDetailLevels`, and the number that decides whether it is
 * payable: a level is FOUR times the tile reads for one rebuilt tile, so 3 is 64 and 5 is 1024.
 * Past it the tiles are read from as far down as it allows and the rest of the thinning stands.
 */
export const peakFinderDetailLevels = settingsStore('peakFinderDetailLevels', 3);
/**
 * How many summits a rebuilt tile may carry, highest first. **0 lifts the cap.**
 *
 * The knob that decides whether the names hold still — measured, not reasoned. With this at 2000 the
 * SDK's own `RenderStats` reported, per placement pass:
 *
 *     considered=12732  sorted=10409  visible=23  collided=10386
 *     notFacing=0  occluded=0  distCut=0  styleMaxDistCut=0
 *
 * 99.8% of valid candidates lose, about 450 of them per slot. Nothing is being dropped unfairly:
 * the band is oversubscribed by two and a half orders of magnitude. Placement is greedy — highest
 * `text-placement-priority` first, then whoever does not overlap what is already down — and at that
 * density a pixel of camera movement changes who overlaps whom and the choice cascades through the
 * whole chain. `visFlips` of 7-26 against `visible` of 10-40 is the visible set turning over once a
 * second, which is exactly the flicker. Stability needs HEADROOM, and no placement tuning buys it:
 * `peakFinderLabelPersist` cannot hold a row that a real overlap has taken.
 *
 * It is also the cost: `collectMs` up to 97 and `cullMs` up to 122 per second of wall clock, on a
 * thread the panorama shares. That is why looking around got slower.
 *
 * 32 leaves roughly a hundred names competing for twenty-odd slots. This is what peakfinder.com
 * does with `POIImportance` / `VisiblePOIsDBAdapter` — a small precomputed significant set, not
 * every summit under the view handed to a culler each frame.
 *
 * How many names APPEAR is still `peakFinderLabelRows`, `peakFinderLabelMinDistance` and
 * `peakFinderLabelAngle` — they decide how many fit. This decides how many fight.
 */
export const peakFinderDetailFeatures = settingsStore('peakFinderDetailFeatures', 32);

/**
 * Take the summit set from ONE query at the viewpoint instead of from the live vector tiles.
 *
 * The labels come and go as the view turns because the DATA does: a far tile is allowed to coarsen,
 * and `mountain_peak` thins out with the zoom, so which summits exist depends on which tiles the
 * camera has caused to be loaded. Collecting them once into a `GeoJSONVectorTileDataSource` makes
 * the set a property of the VIEWPOINT, which is what it always was — see
 * `mapModules/terrain/panoramaPeaks.ts`.
 *
 * OFF by default, and measured rather than assumed: `VectorTileSearchService::findFeatures` walks
 * the search bounds tile by tile with no cap of its own, so a 187 km radius at z12 is some 2900
 * tiles LOADED AND DECODED, and then several thousand features marshalled across the bridge one
 * object at a time. On a device that is not a slow start, it is a stall — and `PointDetailTileDataSource`
 * (`peakFinderDetailSource`) does the same job per tile, in the engine, without any of it.
 *
 * It is kept because it needs no native build, which is exactly the case the detail source cannot
 * cover. Turn it on with `peakFinderPeakZoom` low and `peakFinderViewDistanceMetres` short.
 */
export const peakFinderStaticPeaks = settingsStore('peakFinderStaticPeaks', false);
/**
 * The zoom that sweep reads tiles at — the set's completeness against 4^z tiles.
 *
 * 13 is not an arbitrary ceiling: it is `maxzoomForRendering` in the tiles this app ships, and
 * `MountainPeak.postProcess` takes its `zoom == maxzoomForRendering` branch there — every peak is
 * kept, only tagged with a `rank`. Every zoom BELOW it is declustered instead, by a radius that is
 * constant in tile pixels and therefore grows as the zoom drops:
 *
 *     z13  every peak            z12  ~1.1 km      z11  ~2.2 km
 *     z10  ~4.6 km               z9   ~9.2 km
 *
 * (`RADIUS_DISTANCE_PX` 30 with `MAX_RANK` 3, plus `setPointLabelGridSizeAndLimit(13, 100, 5)` and a
 * per-peak `minzoom` of `10 - ele/1000`.) So z9 is why a range on the horizon shows three names.
 *
 * 12 rather than 13 by default because the tile count is 4x and the last level buys the peaks that
 * are within a kilometre of a bigger one — which a panorama cannot label anyway.
 */
export const peakFinderPeakZoom = settingsStore('peakFinderPeakZoom', 12);
/** How many summits it keeps, highest first. */
export const peakFinderPeakCount = settingsStore('peakFinderPeakCount', 2000);
/** ...and the floor under them, metres. Filtering here rather than in the style keeps the cap useful. */
export const peakFinderPeakMinElevation = settingsStore('peakFinderPeakMinElevation', 0);

/**
 * How many zoom levels below the camera the panorama's LIVE tiles may coarsen to.
 *
 * `TerrainOptions.maxTileZoomCoarsening`, which with terrain up is a FLOOR on every vector layer's
 * tile zoom: `TileLayer::calculateVisibleTiles` sets
 * `_terrainMinTileZoom = cameraTileZoom - coarsening`. `TerrainRenderer` does not read it at all, so
 * on this map — which carries one vector layer and no drape — it is the summit tiles' LOD and
 * nothing else's.
 *
 * Which makes it the other half of the label story, and the cheaper half. The camera sits around
 * zoom 13, so the 4 this used to be put the far ranges on z9 tiles — where the peaks have been
 * declustered at a 9.2 km radius before they ever reached the device (see `peakFinderPeakZoom`).
 * 2 puts them on z11 and a 2.2 km radius; 0 asks for z13 everywhere, which is every peak there is
 * and four times the tiles per level below it.
 *
 * It is a trade with the view distance, and both are sliders for that reason: tiles go as the
 * distance SQUARED and as 4^level, so 300 km at 0 is not 150 km at 2 — it is sixteen times it.
 *
 * 4, which is what it was before it became a setting. It was briefly defaulted to 2 on the
 * arithmetic alone and that was wrong of it: sixteen times the tiles is a measurement, not a
 * calculation, and the right way round is to raise it on a device and watch. The setting is the
 * point; the default is only where to start.
 */
export const peakFinderTileCoarsening = settingsStore('peakFinderTileCoarsening', 4);

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
