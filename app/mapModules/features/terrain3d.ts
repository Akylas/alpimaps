import { showBottomSheet } from '@nativescript-community/ui-material-bottomsheet/svelte';
import { showError } from '@shared/utils/showError';
import { tryCatchFunction } from '@shared/utils/ui';
import { derived, get } from 'svelte/store';
import { lc } from '~/helpers/locale';
import { getMapContext } from '~/mapModules/MapModule';
import { mapCapabilities } from '~/mapModules/CustomLayersModule';
import { registerMapFeature } from '~/mapModules/mapFeatures';
import { registerMapModule } from '~/mapModules/registry';
import { packageService } from '~/services/PackageService';
import {
    TERRAIN_AUTO_FLATTEN_TILT,
    terrain3dActive,
    terrain3dEnabled,
    terrain3dTilt,
    terrainAutoFlattenByTilt,
    terrainCameraClearance,
    terrainExaggeration,
    terrainFlattenModeFull,
    terrainFog,
    terrainMeshResolution,
    terrainSky,
    terrainSwitchDuration,
    terrainViewDistanceFactor
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

/** How often the matched ramp samples the flight, ms. */
const TICK_MS = 32;
/** 2D is straight down in this SDK's convention. */
const TILT_2D = 90;

let terrainAttached = false;
let attachedSourceId: string = null;
let rampTimer: NodeJS.Timeout = null;
/** True while `toggle3D` owns the terrain, so the store subscriptions below do not fight the ramp. */
let switching = false;

function terrain() {
    return getMapContext().getMap()?.terrain();
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
    const map = getMapContext().getMap();
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
        cameraClearance: get(terrainCameraClearance)
    });
    terrainAttached = true;
    attachedSourceId = source.id;
    DEV_LOG && console.log('terrain3d attached', source.id);
    return true;
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
    terrain3dActive.set(on);
    return true;
}

/**
 * Waits for the terrain to finish loading the tiles 3D needs, then runs `then`.
 *
 * Rising has something to wait for and sinking does not: driving the ratio up before the switch stops
 * holding the ground flat is held anyway, and the animation then starts with a jump.
 */
function whenTilesReady(then: () => void) {
    if (terrain()?.get('switching') !== true) {
        then();
        return;
    }
    rampTimer = setTimeout(() => whenTilesReady(then), TICK_MS);
}

function stopRamp() {
    if (rampTimer) {
        clearTimeout(rampTimer);
        rampTimer = null;
    }
    switching = false;
}

/** The sky, fog and terrain lighting that make 3D read as 3D. A short view distance without fog ends
 *  the ground on a hard edge, which is why they are switched together. */
function applyAtmosphere(on: boolean) {
    const map = getMapContext().getMap();
    if (!map) {
        return;
    }
    map.sky({ type: 'sky' }).set('enabled', on && get(terrainSky));
    map.fog({ type: 'fog' }).apply({ enabled: on && get(terrainFog), rangeStart: 2.2, rangeEnd: 8 });
    map.light({ type: 'light' }).set('terrainLightingEnabled', on);
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
    terrain3dActive.set(!in3D);
    applyAtmosphere(!in3D);

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
 * The camera flight.
 *
 * Entering 3D keeps the FOCUS point — what the user was looking at stays what they are looking at.
 * Leaving it targets where the camera IS instead: at a low tilt the focus is kilometres out in front,
 * so re-centring on it swings the map forward as it flattens.
 */
function fly(leaving3D: boolean) {
    const mapCamera = camera();
    const target = leaving3D ? mapCamera.eyePosition() : mapCamera.position();
    mapCamera.animate(get(terrainSwitchDuration) * 1000).moveTo(target, {
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
    terrain3dActive.set(false);
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
applyLive(terrainViewDistanceFactor, (value) => terrain().set('viewDistanceFactor', value));
applyLive(terrainCameraClearance, (value) => terrain().set('cameraClearance', value));
applyLive(terrainFlattenModeFull, () => terrain().set('flattenMode', terrainFlattenMode()));
applyLive(terrainSwitchDuration, (value) => terrain().apply({ autoFlattenDuration: value, autoFlattenRiseDuration: value }));
applyLive(terrainAutoFlattenByTilt, (value) => terrain().set('autoFlattenTilt', value ? TERRAIN_AUTO_FLATTEN_TILT : 0));
// Only meaningful while 3D is up, and `applyAtmosphere` is what decides that.
applyLive(terrainSky, () => applyAtmosphere(is3D()));
applyLive(terrainFog, () => applyAtmosphere(is3D()));

registerMapModule('terrain3d', { onMapDestroyed, onTerrainSourceChanged });

declare module '~/mapModules/registry' {
    interface MapModules {
        terrain3d: { onMapDestroyed: () => void; onTerrainSourceChanged: () => void };
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
