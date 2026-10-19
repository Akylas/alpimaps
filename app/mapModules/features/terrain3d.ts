import { showBottomSheet } from '@nativescript-community/ui-bottomsheet/svelte';
import { showError } from '@shared/utils/showError';
import { tryCatchFunction } from '@shared/utils/ui';
import { destroy as unregisterObject } from '@nativescript-community/ui-massifmaps/api';
import type { FreeRoamMode, MassifMap, Position } from '@nativescript-community/ui-massifmaps/api';
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
    terrainMaxZoom,
    terrainMeshResolution,
    terrainNodeResolution,
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

// Sole writer of the terrain's structural properties: the map has one `terrainOptions`, which the peak
// finder borrows. The ground's rise is driven off the camera flight's progress rather than a second
// timer, so a dropped frame or interrupted flight can't leave them out of step.

/** ms: one frame */
const TICK_MS = 16;
/** 2D is straight down in this SDK's convention. */
const TILT_2D = 90;
/** E-ink has no greys to spend on a gradient, so the sky is paper. */
const EINK_SKY = new Color('#ffffff').argb;
/**
 * Transparent is the only sky colour meaning "no legacy sky band": any other value is the top of a
 * gradient from the style background, which is dithered noise on e-ink.
 */
const NO_SKY_BITMAP = 0;
/** Fractions of the view distance, not the orbit multiples of `TERRAIN_FOG`: fully fogged just short of the far clip. */
const FIRST_PERSON_FOG_RANGE = { start: 0.15, end: 0.9 };
const FREE_ROAM_MODES: Record<TerrainTouchMode, FreeRoamMode> = {
    classic: 'FREE_ROAM_MODE_OFF',
    look: 'FREE_ROAM_MODE_LOOK',
    fps: 'FREE_ROAM_MODE_FIRST_PERSON'
};

let terrainAttached = false;
// the DEM layer's handle, not its source's: `layer.source()` registers a NEW handle on every call, so two reads never compare equal
let attachedSourceId: ReturnType<typeof demLayerHandle> = null;
let rampTimer: NodeJS.Timeout = null;
/** True while `toggle3D` owns the terrain, so the store subscriptions below do not fight the ramp. */
let switching = false;
/** The map's own sky and clear colours, kept while the e-ink switch is overriding them. */
let savedSkyColor: number = null;
let savedClearColor: number = null;

function terrain() {
    return getMapContext().getMap()?.terrain();
}

/**
 * Height field resolution, NOT the mesh's. Read when a DEM grid is DECODED, so a late value only applies
 * to grids decoded afterwards.
 */
function applyNodeResolution() {
    terrain()?.set('surfaceNodeResolution', get(terrainNodeResolution));
}

function argb(color: string) {
    return new Color(color).argb;
}

function camera() {
    return getMapContext().getMap()?.camera();
}

/**
 * The hillshade DEM: its `metaData.dem_encoding` lets the elevation decoder resolve itself, and the mesh,
 * the hillshade and elevation queries read the same tiles.
 */
function demSource() {
    return packageService.hillshadeLayer?.source();
}

/** Stable while the DEM stays the same, unlike a handle of `demSource()`. */
function demLayerHandle() {
    return packageService.hillshadeLayer?.handle;
}

/**
 * Attaches once, FLAT: with `flattened` and `flattenMode` FULL the map decodes and culls as if no terrain
 * were attached, so it costs nothing until 3D is asked for.
 */
export function ensureTerrain(): boolean {
    // `getMap?.()`: store subscriptions run at import time, before `setMapContext` has run
    const map = getMapContext()?.getMap?.();
    const layerHandle = demLayerHandle();
    if (!map || !layerHandle) {
        return false;
    }
    if (terrainAttached && attachedSourceId === layerHandle) {
        return true;
    }
    const source = demSource();
    if (!source) {
        return false;
    }
    if (terrainAttached) {
        // the DEM is spec-only, so a new one means a new options object. Release the id first: the same
        // id with a different spec is refused
        map.child('terrainOptions')?.destroy();
        // destroying the handle leaves the id registered, and `map.terrain(spec)` then fails with RESULT_DUPLICATE_ID
        unregisterObject('options', `${map.id}.terrain`);
        terrainAttached = false;
    }
    map.terrain({ type: 'terrain', source: source.handle }).apply({
        enabled: true,
        flattened: true,
        flattenMode: terrainFlattenMode(),
        autoFlattenTilt: get(terrainAutoFlattenByTilt) ? TERRAIN_AUTO_FLATTEN_TILT : 0,
        autoFlattenParallax: 0,
        autoFlattenDuration: get(terrainSwitchDuration),
        autoFlattenRiseDuration: get(terrainSwitchDuration),
        exaggeration: get(terrainExaggeration),
        meshResolution: get(terrainMeshResolution),
        maxZoom: get(terrainMaxZoom),
        viewDistanceFactor: get(terrainViewDistanceFactor),
        cameraClearance: get(terrainCameraClearance),
        // drawn LIVE, not baked: a baked contour survives in cached drape tiles past its zoom range
        noDrapeLayerFilter: TERRAIN_NO_DRAPE_FILTER,
        drapeFillsEnabled: true,
        drapeLinesEnabled: true,
        drapeResolution: get(terrainDrapeResolution),
        // always WITH the resolution: a fixed one isn't sized against the cache (see `resolveDrapeCacheSize`)
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
    attachedSourceId = layerHandle;
    // After the flag: it goes through the native object, which needs the terrain to exist.
    applyNodeResolution();
    DEV_LOG && console.log('terrain3d attached', layerHandle);
    return true;
}

/**
 * Pushes the tilt range NOW: Map.svelte's reactive write lands after the mode's camera call, and tilt is
 * clamped every frame, so a flight started under the flat `[90, 90]` range stays pinned at 90.
 */
export function applyTiltRange(who: string) {
    pushTiltRange(who, get(mapTiltRange));
}

function pushTiltRange(who: string, range: [number, number]) {
    const map = getMapContext().getMap();
    if (!map) {
        return;
    }
    map.set('tiltRange', range);
    DEV_LOG && console.log('terrain3d: tiltRange', who, JSON.stringify(range), 'sdk', JSON.stringify(map.get('tiltRange')), 'active', get(terrain3dActive), 'transition', get(mapTiltTransition));
}

/** Opens the range for a transition's flight and pushes it, so leaving a mode animates. */
export function beginTiltTransition() {
    mapTiltTransition.set(true);
    pushTiltRange('beginTiltTransition', TILTED_RANGE);
}

/** The flight has landed: back to whatever the modes now in play allow. */
export function endTiltTransition() {
    mapTiltTransition.set(false);
    applyTiltRange('endTiltTransition');
}

function terrainFlattenMode() {
    return get(terrainFlattenModeFull) ? 'TERRAIN_FLATTEN_MODE_FULL' : 'TERRAIN_FLATTEN_MODE_RENDER';
}

/** Whether the map is showing 3D right now, read from the SDK rather than from a flag of ours. */
export function is3D(): boolean {
    return terrainAttached && terrain()?.get('flattened') === false;
}

/** No animation or camera move: the peak finder runs its own flight, which a switch would fight. */
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
    applyTiltRange('setTerrain3DImmediate');
    return true;
}

/**
 * The deadline is load-bearing: with `flattenMode` FULL and tiles already decoded, `switching` can stay
 * true forever.
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

export interface SkyAndFog {
    sky: boolean;
    fog: boolean;
    /** Multiples of the camera-to-focus distance, not metres. */
    rangeStart: number;
    rangeEnd: number;
    verticalRangeStart: number;
    verticalRangeEnd: number;
}

/** The sky shader and the fog of any map: the 3D mode and the panorama share the colours and the e-ink rule (no shader sky). */
export function applySkyAndFog(map: MassifMap, { fog, rangeEnd, rangeStart, sky, verticalRangeEnd, verticalRangeStart }: SkyAndFog) {
    map.sky({ type: 'sky' }).set('enabled', sky && !isEInk);
    // colours on the same call: `FogOptions` starts them transparent, and a fog with no alpha doesn't draw
    map.fog({ type: 'fog' }).apply({
        enabled: fog,
        rangeStart,
        rangeEnd,
        horizonBlend: TERRAIN_FOG.horizonBlend,
        starIntensity: TERRAIN_FOG.starIntensity,
        // The altitudes the haze fades out between: what leaves a summit standing clear of it.
        verticalRangeStart,
        verticalRangeEnd,
        color: argb(TERRAIN_FOG.color),
        highColor: argb(isEInk ? TERRAIN_FOG_EINK : TERRAIN_FOG.highColor),
        spaceColor: argb(isEInk ? TERRAIN_FOG_EINK : TERRAIN_FOG.spaceColor)
    });
}

/**
 * E-ink gets no sky: shader sky and legacy band off
 * (`NO_SKY_BITMAP`), so the CLEAR colour carries the paper white.
 */
function applyAtmosphere(on: boolean) {
    const map = getMapContext().getMap();
    if (!map) {
        return;
    }
    // first person: the SDK ranges the fog from the view distance, since the focus moves with the look
    const firstPerson = get(terrainTouchMode) === 'fps';
    applySkyAndFog(map, {
        sky: on && get(terrainSky),
        fog: on && get(terrainFog),
        rangeStart: firstPerson ? FIRST_PERSON_FOG_RANGE.start : TERRAIN_FOG.rangeStart,
        rangeEnd: firstPerson ? FIRST_PERSON_FOG_RANGE.end : TERRAIN_FOG.rangeEnd,
        verticalRangeStart: get(terrainFogVerticalStart),
        verticalRangeEnd: get(terrainFogVerticalEnd)
    });
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
}

/**
 * Not tied to 3D: the SDK casts building and model shadows on the flat map too, so the lighting choice
 * holds in both. Strength is where shadows OFF lives: `LightOptions` has no shadow switch.
 */
function applyLight() {
    // the stores below subscribe at module load, when the context has no `getMap` yet
    const map = getMapContext()?.getMap?.();
    if (!map) {
        return;
    }
    const lit = get(terrainLighting);
    map.light({ type: 'light' }).apply({
        terrainLightingEnabled: lit,
        // follows the lighting switch, or the override would change the style's sun
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
 * 3D only. CONSTANT panning measures scale at the screen centre: ANCHORED uses the grab point, which on
 * a tilted map near the horizon moves the ground by kilometres per centimetre.
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
 * `viewDistance` is a FLOOR (`max(rule × factor, metres)`), `viewDistanceMax` the only ceiling. Both 0 in
 * 2D: a flat map would walk tiles to the horizon, or end the ground in a disc inside the screen.
 */
function applyViewDistance(on: boolean) {
    terrain()?.apply({
        viewDistance: on ? get(terrainViewDistanceMetres) : 0,
        viewDistanceMax: on ? get(terrainViewDistanceMax) : 0
    });
}

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
    // from the SDK: with auto-by-tilt on, the rule owns the state and a local flag drifts
    const in3D = is3D();
    switching = true;
    // Before the store flip, and before anything touches the camera: the flight passes through every
    // tilt between the two, and the flat map's range would clamp it to 90 the whole way.
    beginTiltTransition();
    terrain3dActive.set(!in3D);
    // Leaving, the atmosphere stays until the flight lands (`rampWithFlight`): removed mid-flight, the
    // horizon shows the (black) clear colour.
    if (!in3D) {
        applyAtmosphere(true);
    }
    // classic during the flight: in first person `setTilt` turns the view about the CAMERA
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
 * Only the tilt moves, so 2D → 3D → 2D lands where it started. Leaving drops the focus's altitude (a flat
 * map's focus belongs on the plane); entering keeps it.
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

/** Writing `flattenRatio` moves the ramp off the SDK's timer onto the flight's, so they can't desync. */
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
    DEV_LOG && console.log('terrain3d: switch end', leaving3D ? '3D->2D' : '2D->3D', 'is3D', is3D(), 'tilt', mapCamera?.tilt());
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
let lastSyncSkip: string = null;

/**
 * `autoFlattenTilt` flips 3D inside the SDK with no event, so the app side is synced by polling on moves.
 * Touch model and view distance wait for `settled`: not under a dragging finger, no tile walk mid-tilt.
 */
function syncAutoFlattenState(settled: boolean) {
    // `switching` is the button's own flight, which applies all of this itself.
    const skipReason = switching ? 'switching' : !terrainAttached ? 'detached' : null;
    if (DEV_LOG && skipReason !== lastSyncSkip) {
        console.log('terrain3d: auto-flatten sync', skipReason ? `skipped (${skipReason})` : 'resumed');
    }
    lastSyncSkip = skipReason;
    if (skipReason) {
        return;
    }
    const on = is3D();
    if (on !== get(terrain3dActive)) {
        terrain3dActive.set(on);
        DEV_LOG && console.log('terrain3d: auto-flatten followed', on ? '3D' : '2D');
        applyAtmosphere(on);
        applyTiltRange('syncAutoFlattenState');
        autoFlattenPending = true;
    }
    if (settled && autoFlattenPending) {
        autoFlattenPending = false;
        applyTouchMode(on);
        applyViewDistance(on);
    }
}

/** The source is spec-only, so drop the attachment and let `ensureTerrain` rebuild (now only if in 3D). */
function onTerrainSourceChanged() {
    if (!terrainAttached) {
        // the auto-flatten rule lives in the terrain object: attach (flat, free) when the DEM first
        // lands, or the first tilt gesture does nothing
        if (get(terrainAutoFlattenByTilt)) {
            ensureTerrain();
        }
        return;
    }
    const layerHandle = demLayerHandle();
    if (!layerHandle) {
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
    if (layerHandle === attachedSourceId) {
        return;
    }
    const wasIn3D = is3D();
    if (wasIn3D) {
        // ensureTerrain opens flat, so the mode has to be asked for again afterwards.
        setTerrain3DImmediate(true);
    } else if (get(terrainAutoFlattenByTilt)) {
        // Not detached: the old terrain keeps its tilt rule, and a detached one flips 3D with nobody syncing the tilt range.
        ensureTerrain();
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

/** Guarded on attachment: these subscriptions fire at import time, before there is a map. */
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
applyLive(terrainMaxZoom, (value) => terrain().set('maxZoom', value));
// The field, not the lattice: this is the one that moves the relief. Both re-decode every cached DEM
// grid, so neither is free to drag.
applyLive(terrainNodeResolution, applyNodeResolution);
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
// not `applyLive`: turning it on must ATTACH (flat), or there is no rule for the tilt gesture to cross
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
// The light follows the lighting switch whether or not the terrain is attached, so not through `applyLive`.
for (const store of [
    terrainLighting,
    terrainSunAzimuth,
    terrainSunAltitude,
    terrainShadows,
    terrainShadowStrength,
    terrainShadowDistance,
    terrainShadowMapSize,
    terrainShadowCascades,
    terrainShadowSoftness,
    terrainShadowCasterMargin
]) {
    store.subscribe(() => {
        try {
            applyLight();
        } catch (error) {
            showError(error);
        }
    });
}
// Same: the touch model only applies while the 3D mode is the one on screen.
applyLive(terrainTouchMode, () => {
    applyTouchMode(is3D());
    applyAtmosphere(is3D());
});

registerMapModule('terrain3d', {
    onMapReady: applyLight,
    onMapDestroyed,
    onTerrainSourceChanged,
    onMapMove: () => syncAutoFlattenState(false),
    onMapStable: () => syncAutoFlattenState(true)
});

declare module '~/mapModules/registry' {
    interface MapModules {
        terrain3d: { onMapReady: () => void; onMapDestroyed: () => void; onTerrainSourceChanged: () => void; onMapMove: () => void; onMapStable: () => void };
    }
}

registerMapFeature({
    id: 'terrain3d',
    // between fullscreen (10) and the style toggles (20, 30); the bar sorts low-first from the top
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
