import { showBottomSheet } from '@nativescript-community/ui-material-bottomsheet/svelte';
import { showError } from '@shared/utils/showError';
import { tryCatchFunction } from '@shared/utils/ui';
import type { FreeRoamMode, Position } from '@nativescript-community/ui-massifmaps/api';
import { Color } from '@nativescript/core';
import { derived, get } from 'svelte/store';
import { lc } from '~/helpers/locale';
import { isEInk } from '~/helpers/theme';
import { getMapContext } from '~/mapModules/MapModule';
import { mapCapabilities } from '~/mapModules/CustomLayersModule';
import { registerMapFeature } from '~/mapModules/mapFeatures';
import { registerMapModule } from '~/mapModules/registry';
import { packageService } from '~/services/PackageService';
import {
    TERRAIN_AUTO_FLATTEN_TILT,
    TERRAIN_FOG,
    TERRAIN_FOG_EINK,
    TERRAIN_MAX_TILE_ZOOM_COARSENING,
    TERRAIN_NO_DRAPE_FILTER,
    TERRAIN_TILE_WAIT_TIMEOUT_MS,
    TILTED_RANGE,
    type TerrainTouchMode,
    mapTiltRange,
    mapTiltTransition,
    resolveDrapeCacheSize,
    terrain3dActive,
    terrain3dEnabled,
    terrain3dTilt,
    terrainAutoFlattenByTilt,
    terrainCameraClearance,
    terrainDrapeCacheSize,
    terrainDrapeResolution,
    terrainExaggeration,
    terrainFlattenModeFull,
    terrainFog,
    terrainFogVerticalEnd,
    terrainFogVerticalStart,
    terrainLighting,
    terrainMeshResolution,
    terrainShadowCascades,
    terrainShadowCasterMargin,
    terrainShadowDistance,
    terrainShadowMapSize,
    terrainShadowSoftness,
    terrainShadowStrength,
    terrainShadows,
    terrainSky,
    terrainSunAltitude,
    terrainSunAzimuth,
    terrainSwitchDuration,
    terrainTouchMode,
    terrainViewDistanceFactor,
    terrainViewDistanceMax,
    terrainViewDistanceMetres
} from '~/stores/terrainStore';
import { clearTimeout, setTimeout } from '~/utils/utils';

/**
 * 3D terrain as a MODE of the map, and the terrain plumbing the peak finder borrows.
 *
 * This is the only file that writes the terrain's STRUCTURAL properties — its source, whether it is
 * enabled at all, and how a flat map is paid for. The peak finder calls into it rather than attaching
 * a second terrain of its own, because there is only one `terrainOptions` on the map.
 *
 * The switch itself is the interesting part, and it is the SDK demo's `Switch2D3DExample.matched()`:
 * the ground's rise is driven off the CAMERA FLIGHT's own progress rather than a second timer of the
 * same length, so a dropped frame or an interrupted flight cannot leave the two out of step.
 */

/** How often the matched ramp samples the flight, ms — one frame, since the switch is short. */
const TICK_MS = 16;
/** 2D is straight down in this SDK's convention. */
const TILT_2D = 90;
/** E-ink has no greys to spend on a gradient, so the sky is paper. */
const EINK_SKY = new Color('#ffffff').argb;
/**
 * A transparent sky colour is not a colour, it is a SWITCH.
 *
 * `Options::getSkyBitmap` and `VectorTileLayer::getSkyBitmap` both read it to generate the legacy sky
 * band as a GRADIENT from the style's background colour up to it, and a transparent one is the only
 * value that means "no band at all". Writing white therefore did not give a white sky — it gave a
 * gradient that ENDED white, which on e-ink is dithered noise.
 */
const NO_SKY_BITMAP = 0;
/** The setting's values as the SDK's own. */
const FREE_ROAM_MODES: Record<TerrainTouchMode, FreeRoamMode> = {
    classic: 'FREE_ROAM_MODE_OFF',
    look: 'FREE_ROAM_MODE_LOOK',
    fps: 'FREE_ROAM_MODE_FIRST_PERSON'
};

let terrainAttached = false;
let attachedSourceId: string = null;
let rampTimer: NodeJS.Timeout = null;
/** True while `toggle3D` owns the terrain, so the store subscriptions below do not fight the ramp. */
let switching = false;
/** The map's own sky and clear colours, kept while the e-ink switch is overriding them. */
let savedSkyColor: number = null;
let savedClearColor: number = null;

function terrain() {
    return getMapContext().getMap()?.terrain();
}

function argb(color: string) {
    return new Color(color).argb;
}

function camera() {
    return getMapContext().getMap()?.camera();
}

/**
 * The DEM the map is already showing, as the terrain's source.
 *
 * Not a source of our own: `CustomLayersModule` already resolved which DEM holds the hillshade slot,
 * and its `metaData.dem_encoding` is set — so the elevation decoder resolves itself, and the mesh,
 * the hillshade and every elevation query read the same tiles.
 */
function demSource() {
    return packageService.hillshadeLayer?.source();
}

/**
 * Attaches the terrain, once, and leaves it configured and FLAT.
 *
 * Every property is written before the terrain is first un-flattened, which is the point: with
 * `flattened` true and `flattenMode` FULL the map decodes and culls as if no terrain were attached,
 * so nothing here costs anything until a mode actually asks for 3D.
 *
 * @returns whether there is a terrain to work with.
 */
export function ensureTerrain(): boolean {
    // `getMap?.()`, not `getMap()`: this module's store subscriptions run at IMPORT time, and the
    // import happens from Map.svelte - so the first call lands before `setMapContext` has run and
    // the context has no accessors yet. MapContext is assembled untyped, so the interface promising
    // `getMap` is documentation rather than a guarantee (see .claude/CLAUDE.md).
    const map = getMapContext()?.getMap?.();
    const source = demSource();
    if (!map || !source) {
        return false;
    }
    if (terrainAttached && attachedSourceId === source.id) {
        return true;
    }
    if (terrainAttached) {
        // `TerrainOptions` has no `source` property — the DEM is only nameable in the SPEC — so a new
        // one means a new options object. The id is released first, because building the same id with a
        // different spec is refused.
        map.child('terrainOptions')?.destroy();
        terrainAttached = false;
    }
    map.terrain({ type: 'terrain', source: source.handle }).apply({
        enabled: true,
        flattened: true,
        flattenMode: terrainFlattenMode(),
        // Off at attach time: the button is the only thing that switches until the setting says
        // otherwise, and the rule below is applied from its own subscription.
        autoFlattenTilt: get(terrainAutoFlattenByTilt) ? TERRAIN_AUTO_FLATTEN_TILT : 0,
        autoFlattenParallax: 0,
        autoFlattenDuration: get(terrainSwitchDuration),
        autoFlattenRiseDuration: get(terrainSwitchDuration),
        exaggeration: get(terrainExaggeration),
        meshResolution: get(terrainMeshResolution),
        viewDistanceFactor: get(terrainViewDistanceFactor),
        cameraClearance: get(terrainCameraClearance),
        // Which style layers are drawn LIVE instead of being baked into the drape texture. Contours
        // have to be: a baked contour survives in the drape tiles that are already cached, so it stays
        // on screen after a zoom out past the level the style stops drawing it at.
        noDrapeLayerFilter: TERRAIN_NO_DRAPE_FILTER,
        drapeFillsEnabled: true,
        drapeLinesEnabled: true,
        drapeResolution: get(terrainDrapeResolution),
        // Written WITH the resolution, never without it: a fixed resolution is the one case the SDK
        // does not size against the cache, and the cache's own floor then raises the budget to match.
        // See `resolveDrapeCacheSize`.
        drapeCacheSize: resolveDrapeCacheSize(get(terrainDrapeResolution), get(terrainDrapeCacheSize)),
        maxTileZoomCoarsening: TERRAIN_MAX_TILE_ZOOM_COARSENING,
        // Occlusion is on for the whole map, as in the demo; only the TOLERANCE is a mode's business.
        billboardOcclusionEnabled: true,
        billboardOcclusionTolerance: 0.2,
        tileEdgeStitchingEnabled: true,
        seamlessTileEdgesEnabled: true,
        elevationPrefetchEnabled: true
    });
    terrainAttached = true;
    attachedSourceId = source.id;
    DEV_LOG && console.log('terrain3d attached', source.id);
    return true;
}

/**
 * Pushes the tilt range the modes agree on onto the map, NOW.
 *
 * `Map.svelte` also writes `mapTiltRange`, but from a reactive statement — which runs on svelte's
 * next flush, i.e. after the camera call the mode makes in the same turn. That is not a cosmetic
 * difference: `CameraTiltEvent::calculate` clamps the tilt to the range on every frame, so a flight
 * started while the range is still the flat map's `[90, 90]` is pinned at 90 for its whole run. This
 * is what every mode switch calls before it moves the camera.
 */
export function applyTiltRange() {
    getMapContext().getMap()?.set('tiltRange', get(mapTiltRange));
}

/** Opens the range for a transition's flight and pushes it, so leaving a mode animates. */
export function beginTiltTransition() {
    mapTiltTransition.set(true);
    getMapContext().getMap()?.set('tiltRange', TILTED_RANGE);
}

/** The flight has landed: back to whatever the modes now in play allow. */
export function endTiltTransition() {
    mapTiltTransition.set(false);
    applyTiltRange();
}

function terrainFlattenMode() {
    return get(terrainFlattenModeFull) ? 'TERRAIN_FLATTEN_MODE_FULL' : 'TERRAIN_FLATTEN_MODE_RENDER';
}

/** Whether the map is showing 3D right now, read from the SDK rather than from a flag of ours. */
export function is3D(): boolean {
    return terrainAttached && terrain()?.get('flattened') === false;
}

/**
 * Puts the terrain into 3D (or back) with no animation and no camera move.
 *
 * What the peak finder needs on the way in: it runs its own single flight, and a second animated
 * switch underneath it would fight that.
 */
export function setTerrain3DImmediate(on: boolean): boolean {
    if (!ensureTerrain()) {
        return false;
    }
    stopRamp();
    terrain().apply({ flattened: !on, flattenRatio: on ? 0 : 1 });
    applyAtmosphere(on);
    applyTouchMode(on);
    applyViewDistance(on);
    terrain3dActive.set(on);
    applyTiltRange();
    return true;
}

/**
 * Waits for the terrain to finish loading the tiles 3D needs, then runs `then` — but never for longer
 * than `TERRAIN_TILE_WAIT_TIMEOUT_MS`.
 *
 * Rising has something to wait for and sinking does not: driving the ratio up before the switch stops
 * holding the ground flat is held anyway, and the animation then starts with a jump.
 *
 * The DEADLINE is not a safety net, it is load-bearing. `switching` does not always come back down —
 * with `flattenMode` FULL a switch re-decodes every visible tile, and when they are already decoded
 * for the terrain (switching back and forth) there is nothing left to finish and the flag can sit
 * true. Waiting on it unconditionally is what made a FULL switch hang. Same value and same reason as
 * the demo's `TERRAIN_ANIM_TILE_TIMEOUT_MS`.
 */
function whenTilesReady(then: () => void, deadline = Date.now() + TERRAIN_TILE_WAIT_TIMEOUT_MS) {
    if (terrain()?.get('switching') !== true || Date.now() >= deadline) {
        then();
        return;
    }
    rampTimer = setTimeout(() => whenTilesReady(then, deadline), TICK_MS);
}

function stopRamp() {
    if (rampTimer) {
        clearTimeout(rampTimer);
        rampTimer = null;
    }
    switching = false;
}

/**
 * The sky, the fog and the terrain lighting that go with 3D.
 *
 * The sky and the fog are ON, the terrain lighting is not. Lighting is not something the switch should
 * turn on behind the user's back: it lights and SHADOWS the mesh, which is a real cost and a different
 * picture, and shading the ground is not what makes a map read as 3D. The fog is the opposite — with
 * it off the ground ends on a hard edge at the view distance and the sky meets it on a seam, so it is
 * part of what 3D looks like. Its values are mapbox's, see `TERRAIN_FOG`.
 *
 * E-ink gets NO sky at all, whatever the setting says: a gradient it cannot render is dithered noise
 * above the horizon, and the ridges are what the view is read by. Paper white instead — the shader sky
 * off AND the legacy band off (see `NO_SKY_BITMAP`), which leaves the band above the horizon showing
 * the CLEAR colour, so that is what carries the white.
 */
function applyAtmosphere(on: boolean) {
    const map = getMapContext().getMap();
    if (!map) {
        return;
    }
    map.sky({ type: 'sky' }).set('enabled', on && !isEInk && get(terrainSky));
    if (isEInk) {
        if (on) {
            if (savedSkyColor === null) {
                savedSkyColor = map.get('skyColor');
                savedClearColor = map.get('clearColor');
            }
            map.set('skyColor', NO_SKY_BITMAP);
            map.set('clearColor', EINK_SKY);
        } else if (savedSkyColor !== null) {
            map.set('skyColor', savedSkyColor);
            map.set('clearColor', savedClearColor);
            savedSkyColor = null;
            savedClearColor = null;
        }
    }
    // Every colour on the same call as the switch: `FogOptions` starts them all transparent and a fog
    // with no alpha does not draw (`ResolvedFog::active`), so enabling it on its own does nothing.
    map.fog({ type: 'fog' }).apply({
        enabled: on && get(terrainFog),
        rangeStart: TERRAIN_FOG.rangeStart,
        rangeEnd: TERRAIN_FOG.rangeEnd,
        horizonBlend: TERRAIN_FOG.horizonBlend,
        starIntensity: TERRAIN_FOG.starIntensity,
        // The altitudes the haze fades out between: what leaves a summit standing clear of it.
        verticalRangeStart: get(terrainFogVerticalStart),
        verticalRangeEnd: get(terrainFogVerticalEnd),
        color: argb(TERRAIN_FOG.color),
        highColor: argb(isEInk ? TERRAIN_FOG_EINK : TERRAIN_FOG.highColor),
        spaceColor: argb(isEInk ? TERRAIN_FOG_EINK : TERRAIN_FOG.spaceColor)
    });
    const lit = on && get(terrainLighting);
    // Everything on one call, and the strength is where OFF lives: `LightOptions` has no shadow
    // switch, and a shadow with no strength is the only way to say "lit ground, no shadows". The rest
    // is written whether or not shadows are on, so the switch is the only thing that has to move.
    map.light({ type: 'light' }).apply({
        terrainLightingEnabled: lit,
        // The sun the shadows are cast from. `sunOverridingStyle` moves WITH the lighting switch: a
        // style states its own sun and that is what lights the flat map, so an override left standing
        // would change the 2D map for a setting that belongs to 3D.
        sunOverridingStyle: lit,
        sunAzimuth: get(terrainSunAzimuth),
        sunAltitude: get(terrainSunAltitude),
        shadowStrength: lit && get(terrainShadows) ? get(terrainShadowStrength) : 0,
        shadowDistance: get(terrainShadowDistance),
        shadowMapSize: get(terrainShadowMapSize),
        shadowCascades: get(terrainShadowCascades),
        shadowSoftness: get(terrainShadowSoftness),
        shadowCasterMargin: get(terrainShadowCasterMargin)
    });
}

/**
 * The touch model, which the 3D mode owns while it is up — and only while it is up: a free roam drag
 * on a flat map turns a view that has nothing to turn.
 *
 * With it, how fast a drag moves the ground. The default (`ANCHORED`) is the grab-the-world pan with
 * its scale frozen at the point the gesture STARTED, and on a tilted map that point decides
 * everything: the ray through a finger near the horizon meets the ground kilometres away, so the same
 * centimetre of travel moves the map by tens of kilometres, while a finger at the bottom of the
 * screen barely moves it.
 *
 * Mapbox does not solve this by damping the drag — their pan keeps the grabbed point exactly under
 * the finger too (`setLocationAtPoint`). They BOUND it instead: the pitch is capped at 60 by default
 * and the camera is constrained so the horizon never comes into view (`_horizonShift`), so a ray can
 * never graze the ground. This map is deliberately allowed the low tilts they refuse — that is what a
 * mountain view is — so the other half of their answer is the one available here, and the SDK has it:
 * `PANNING_SPEED_MODE_CONSTANT` measures the scale at the CENTRE of the screen, so a pan moves the
 * ground at one rate wherever the finger is. On a flat map all three modes agree, so this follows the
 * 3D switch rather than being a setting.
 */
function applyTouchMode(on: boolean) {
    getMapContext()
        .getMap()
        ?.apply({
            freeRoamMode: on ? FREE_ROAM_MODES[get(terrainTouchMode)] : 'FREE_ROAM_MODE_OFF',
            panningSpeedMode: on ? 'PANNING_SPEED_MODE_CONSTANT' : 'PANNING_SPEED_MODE_ANCHORED'
        });
}

/**
 * How far the ground is drawn in METRES, which only the 3D mode wants — both ends of it.
 *
 * `viewDistance` is a FLOOR: `ViewState::calculateViewDistance` returns `max(rule × factor, metres)`,
 * so it can only ever extend the view and turning it down does nothing. `viewDistanceMax` is the
 * ceiling, applied last, and the only metric way to make the map reach less far than tangram's rule —
 * which from a hillside is already tens of kilometres and from a summit past a hundred.
 *
 * Both are 0 while 3D is off: on a flat map the same metres reach the horizon at every zoom, which is
 * a tile walk with nothing to show for it, and a ceiling on a map seen from above would end the
 * ground in a disc inside the screen.
 */
function applyViewDistance(on: boolean) {
    terrain()?.apply({
        viewDistance: on ? get(terrainViewDistanceMetres) : 0,
        viewDistanceMax: on ? get(terrainViewDistanceMax) : 0
    });
}

/**
 * The 2D/3D switch: one flight, with the ground riding on its progress.
 */
export const toggle3D = tryCatchFunction(async () => {
    if (!ensureTerrain()) {
        return;
    }
    const mapCamera = camera();
    // Let a flight land rather than queueing a second one on top of it: two overlapping ramps write
    // flattenRatio against each other and the ground visibly stutters.
    if (switching || mapCamera.isMoving()) {
        return;
    }
    // Read the state from the SDK, not from a counter of button presses. With auto-by-tilt on, the
    // RULE owns the state, and a local flag drifts out of step with it — and then the button flies to
    // the tilt the map is already at, the rule never crosses its threshold, and nothing moves.
    const in3D = is3D();
    switching = true;
    // Before the store flip, and before anything touches the camera: the flight passes through every
    // tilt between the two, and the flat map's range would clamp it to 90 the whole way.
    beginTiltTransition();
    terrain3dActive.set(!in3D);
    // Entering, the atmosphere goes up WITH the ground. Leaving, it stays until the flight lands
    // (`rampWithFlight`): the sky is what fills the screen above the horizon, and taking it away at
    // tilt 20 leaves the band showing the CLEAR colour — black — for the length of the animation.
    // At the end of the flight the camera is straight down and there is no horizon left to see.
    if (!in3D) {
        applyAtmosphere(true);
    }
    // Classic for the flight itself, whichever way it goes, and the setting's model once it lands: in
    // first person `setTilt` turns the view about the CAMERA, so the switch's own tilt would spin the
    // view where it stands instead of raising or lowering the ground under it.
    applyTouchMode(false);

    if (in3D) {
        // Sinking has nothing to wait for.
        fly(true);
        rampWithFlight(true);
        return;
    }
    // Ask for 3D so its tiles start loading, and let the flight go only once the switch stops holding
    // the ground flat.
    terrain().set('flattened', false);
    whenTilesReady(() => {
        fly(false);
        rampWithFlight(false);
    });
});

/**
 * The camera flight: the TILT, and nothing else.
 *
 * Both directions keep the focus point, the zoom and the rotation, so 2D → 3D → 2D lands back on the
 * camera it started from — which is the whole point of a mode switch. Leaving used to target
 * `eyePosition()` instead, and that is kilometres in front of the focus at a low tilt: every round
 * trip walked the map forward by that much.
 *
 * Leaving drops the focus's ALTITUDE, and entering keeps it. A flat map's focus belongs on the plane,
 * so coming back puts it there — and going up again then keeps whatever the terrain has since made of
 * it, rather than forcing it to sea level with the ground two kilometres above.
 */
function fly(leaving3D: boolean) {
    const mapCamera = camera();
    const position = mapCamera.position();
    const target: Position = leaving3D ? [position[0], position[1]] : position;
    mapCamera.animate(get(terrainSwitchDuration) * 1000).moveTo(target, {
        zoom: mapCamera.zoom(),
        rotation: mapCamera.rotation(),
        tilt: leaving3D ? TILT_2D : get(terrain3dTilt)
    });
}

/**
 * Drives `flattenRatio` off the flight's own progress.
 *
 * Writing the ratio takes the ramp off the SDK's timer and puts it on the flight's, which is what
 * makes the two impossible to desynchronise.
 */
function rampWithFlight(leaving3D: boolean) {
    const mapCamera = camera();
    if (mapCamera?.isMoving()) {
        const progress = mapCamera.progress();
        terrain().set('flattenRatio', leaving3D ? progress : 1 - progress);
        rampTimer = setTimeout(() => rampWithFlight(leaving3D), TICK_MS);
        return;
    }
    terrain()?.apply({
        flattenRatio: leaving3D ? 1 : 0,
        // Hand the ratio back, or the switch stays MANUAL — which also keeps auto-flattening
        // suspended, and a tilt gesture would then do nothing.
        flattened: leaving3D
    });
    stopRamp();
    endTiltTransition();
    // The sky and the fog come down here rather than at the start of the flight, for the same reason
    // the touch model does: the animation still has a horizon in it (see `toggle3D`).
    if (leaving3D) {
        applyAtmosphere(false);
    }
    applyTouchMode(!leaving3D);
    // Once the flight has landed, like the touch model: a hundred kilometres of ground asked for
    // mid-switch is a tile walk against the frames the switch itself needs.
    applyViewDistance(!leaving3D);
}

/**
 * True once the auto rule has moved the mode and the two expensive halves of the switch still owe it.
 */
let autoFlattenPending = false;

/**
 * The 3D state the SDK reached on its OWN, brought back to the app.
 *
 * `autoFlattenTilt` is a rule INSIDE the SDK: past it the terrain un-flattens, under it flattens
 * again, and there is no event to say so. So everything the button's switch does besides raising the
 * ground — the store the side-bar button is drawn from, the sky, the fog, the lighting, the touch
 * model, the view distance and the tilt range — simply never happened, and a map tilted into 3D by
 * hand was 3D geometry under a flat map's atmosphere with an unselected button over it.
 *
 * POLLED from the move events rather than driven by one: the rule writes `flattened` when it fires
 * (the RATIO is what animates), so reading it on a move is as prompt as an event would be.
 *
 * `settled` is the gesture having ended, and two of them wait for it. The touch model, because
 * changing the gesture scheme under a finger that is still dragging is the one thing it must not do;
 * the view distance, because it is a tile walk, and mid-tilt is when the map can least afford one.
 */
function syncAutoFlattenState(settled: boolean) {
    // `switching` is the button's own flight, which applies all of this itself.
    if (switching || !terrainAttached) {
        return;
    }
    const on = is3D();
    if (on !== get(terrain3dActive)) {
        terrain3dActive.set(on);
        applyAtmosphere(on);
        applyTiltRange();
        autoFlattenPending = true;
    }
    if (settled && autoFlattenPending) {
        autoFlattenPending = false;
        applyTouchMode(on);
        applyViewDistance(on);
    }
}

/**
 * `CustomLayersModule` swapped the DEM holding the hillshade slot.
 *
 * The terrain cannot simply be re-pointed — its source is spec-only — so this drops the attachment and
 * lets `ensureTerrain` build a new one. Rebuilt immediately only if 3D is on screen; otherwise the next
 * mode to ask for it pays for it.
 */
function onTerrainSourceChanged() {
    if (!terrainAttached) {
        // `autoFlattenTilt` is a rule INSIDE the terrain object, so a map with nothing attached has
        // no rule at all and the first tilt gesture did nothing - the button had to be pressed once
        // before tilting worked. This hook is what fires when the DEM first lands, and attaching
        // here costs nothing: `ensureTerrain` opens flat and FULL-flattened, which decodes and culls
        // exactly as a map with no terrain does.
        if (get(terrainAutoFlattenByTilt)) {
            ensureTerrain();
        }
        return;
    }
    const source = demSource();
    if (!source) {
        // The DEM went away — there is nothing to build a mesh from, so drop back to a flat map.
        stopRamp();
        terrainAttached = false;
        attachedSourceId = null;
        terrain()?.set('enabled', false);
        terrain3dActive.set(false);
        applyTouchMode(false);
        applyViewDistance(false);
        return;
    }
    if (source.id === attachedSourceId) {
        return;
    }
    const wasIn3D = is3D();
    if (wasIn3D) {
        // ensureTerrain opens flat, so the mode has to be asked for again afterwards.
        setTerrain3DImmediate(true);
    } else {
        terrainAttached = false;
        attachedSourceId = null;
    }
}

function onMapDestroyed() {
    stopRamp();
    terrainAttached = false;
    attachedSourceId = null;
    autoFlattenPending = false;
    savedSkyColor = null;
    savedClearColor = null;
    terrain3dActive.set(false);
    mapTiltTransition.set(false);
}

const show3DSettings = tryCatchFunction(async () => {
    const component = (await import('~/components/map/Terrain3DSettings.svelte')).default;
    await showBottomSheet({ view: component, skipCollapsedState: true });
});

/**
 * Live settings: each knob writes straight through to the terrain.
 *
 * `subscribe` rather than the UI calling a setter, so the long-press sheet and the app settings screen
 * both work with no wiring of their own. Guarded on the terrain existing, because these fire at import
 * time — before there is a map.
 */
function applyLive<T>(store: { subscribe: (run: (value: T) => void) => unknown }, apply: (value: T) => void) {
    store.subscribe((value) => {
        if (!terrainAttached) {
            return;
        }
        try {
            apply(value);
        } catch (error) {
            showError(error);
        }
    });
}

applyLive(terrainExaggeration, (value) => terrain().set('exaggeration', value));
applyLive(terrainMeshResolution, (value) => terrain().set('meshResolution', value));
// One call for both, from EITHER store: a resolution is a memory cost, so moving it has to move the
// budget that pays for it. Only a non-zero cache setting escapes that, and then it is the user's.
function applyDrape() {
    terrain().apply({
        drapeResolution: get(terrainDrapeResolution),
        drapeCacheSize: resolveDrapeCacheSize(get(terrainDrapeResolution), get(terrainDrapeCacheSize))
    });
}
applyLive(terrainDrapeResolution, applyDrape);
applyLive(terrainDrapeCacheSize, applyDrape);
applyLive(terrainViewDistanceFactor, (value) => terrain().set('viewDistanceFactor', value));
applyLive(terrainCameraClearance, (value) => terrain().set('cameraClearance', value));
applyLive(terrainFlattenModeFull, () => terrain().set('flattenMode', terrainFlattenMode()));
applyLive(terrainSwitchDuration, (value) => terrain().apply({ autoFlattenDuration: value, autoFlattenRiseDuration: value }));
// Not `applyLive`: this one has to ATTACH, not just write. Turning the setting on while nothing is
// attached has to build the terrain - flat - or there is no rule for the tilt gesture to cross. With
// no map or no DEM yet `ensureTerrain` answers false and `onTerrainSourceChanged` picks it up.
terrainAutoFlattenByTilt.subscribe((value) => {
    try {
        if (value ? !ensureTerrain() : !terrainAttached) {
            return;
        }
        terrain().set('autoFlattenTilt', value ? TERRAIN_AUTO_FLATTEN_TILT : 0);
    } catch (error) {
        showError(error);
    }
});
// Only meaningful while 3D is up, and `applyAtmosphere` is what decides that.
applyLive(terrainSky, () => applyAtmosphere(is3D()));
applyLive(terrainFog, () => applyAtmosphere(is3D()));
applyLive(terrainFogVerticalStart, () => applyAtmosphere(is3D()));
applyLive(terrainFogVerticalEnd, () => applyAtmosphere(is3D()));
applyLive(terrainViewDistanceMetres, () => applyViewDistance(is3D()));
applyLive(terrainViewDistanceMax, () => applyViewDistance(is3D()));
applyLive(terrainLighting, () => applyAtmosphere(is3D()));
// The sun goes through the same rule: it is written on the same call, and only while the ground is lit.
applyLive(terrainSunAzimuth, () => applyAtmosphere(is3D()));
applyLive(terrainSunAltitude, () => applyAtmosphere(is3D()));
// The shadow knobs go through the same rule, since the strength depends on the lighting switch too.
applyLive(terrainShadows, () => applyAtmosphere(is3D()));
applyLive(terrainShadowStrength, () => applyAtmosphere(is3D()));
applyLive(terrainShadowDistance, () => applyAtmosphere(is3D()));
applyLive(terrainShadowMapSize, () => applyAtmosphere(is3D()));
applyLive(terrainShadowCascades, () => applyAtmosphere(is3D()));
applyLive(terrainShadowSoftness, () => applyAtmosphere(is3D()));
applyLive(terrainShadowCasterMargin, () => applyAtmosphere(is3D()));
// Same: the touch model only applies while the 3D mode is the one on screen.
applyLive(terrainTouchMode, () => applyTouchMode(is3D()));

registerMapModule('terrain3d', {
    onMapDestroyed,
    onTerrainSourceChanged,
    onMapMove: () => syncAutoFlattenState(false),
    onMapStable: () => syncAutoFlattenState(true)
});

declare module '~/mapModules/registry' {
    interface MapModules {
        terrain3d: { onMapDestroyed: () => void; onTerrainSourceChanged: () => void; onMapMove: () => void; onMapStable: () => void };
    }
}

registerMapFeature({
    id: 'terrain3d',
    // order 15 slots it between the fullscreen toggle (10) and the two style toggles (20, 30), which
    // puts it above them in the bar — the bar is vertical and sorts low-first from the top.
    sideButtons: derived([terrain3dActive, terrain3dEnabled, mapCapabilities], ([$terrain3dActive, $terrain3dEnabled, $mapCapabilities]) => [
        {
            id: 'terrain3d',
            order: 15,
            text: 'mdi-video-3d',
            tooltip: lc('threed_map'),
            isSelected: $terrain3dActive,
            // No DEM, no mesh: the button would do nothing at all.
            visible: $terrain3dEnabled && $mapCapabilities.hasTerrain,
            onTap: toggle3D,
            onLongPress: show3DSettings
        }
    ])
});
