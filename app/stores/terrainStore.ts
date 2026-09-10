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
// meant to reproduce. Where the demo and the SDK disagree the demo wins — its mesh resolution of 64
// is tangram's own, and 128 measured 8.5 fps against 15.2 on a Crosscall.
export const terrainExaggeration = settingsStore('terrainExaggeration', 1);
export const terrainMeshResolution = settingsStore('terrainMeshResolution', 64);
/** How far the ground goes on, as a multiple of the camera-to-focus distance. */
export const terrainViewDistanceFactor = settingsStore('terrainViewDistanceFactor', 1);
/** Metres the camera is held above the ground. 0 disables the clamp, as the demo does. */
export const terrainCameraClearance = settingsStore('terrainCameraClearance', 0);
/** Seconds the 2D/3D switch takes — the camera flight and the ground's rise share this one number. */
export const terrainSwitchDuration = settingsStore('terrainSwitchDuration', 0.7);
/**
 * FULL: a flat map decodes and culls as a plain 2D one, at the cost of a re-decode per switch.
 * RENDER: only the terrain passes stop, so switching is free but flat still carries 3D's triangles.
 *
 * OFF, which is the demo's `TERRAIN_FULL_SWITCH`. FULL makes every switch wait on a full re-decode.
 */
export const terrainFlattenModeFull = settingsStore('terrainFlattenModeFull', false);
export const terrainAutoFlattenByTilt = settingsStore('terrainAutoFlattenByTilt', false);
/** In this SDK tilt 90 is straight down, so a landscape view is a LOW tilt. */
export const terrain3dTilt = settingsStore('terrain3dTilt', 20);
export const terrainSky = settingsStore('terrainSky', true);
/** `FOG_ENABLED` is false in the demo: the fog values stay configured while the switch is off. */
export const terrainFog = settingsStore('terrainFog', false);
/**
 * Terrain lighting, and with it the sun's shadows on the ground.
 *
 * OFF, as `TERRAIN_LIGHTING` is in the demo. It is a real cost and a real change of look — shading
 * the mesh is not what makes a map read as 3D — so it is opt-in rather than something the switch
 * turns on behind the user's back.
 */
export const terrainLighting = settingsStore('terrainLighting', false);

/** The tilt the auto rule switches at. Not a setting: it is the rule's definition, not a taste. */
export const TERRAIN_AUTO_FLATTEN_TILT = 88;
/** Style layers kept OUT of the drape bake and drawn live (`TERRAIN_NO_DRAPE_FILTER`).
 *  Contours MUST be in here: baked into a drape texture they survive in the tiles already cached, so
 *  they stay on screen below the zoom the style stops drawing them at. */
export const TERRAIN_NO_DRAPE_FILTER = '^contour|maneuver.*';
/** Per-tile drape texture resolution. 0 follows the screen and gets clamped to 512. */
export const TERRAIN_DRAPE_RESOLUTION = 1024;
/** How many zoom levels below the camera a tile may coarsen to (`TERRAIN_MAX_TILE_ZOOM_COARSENING`). */
export const TERRAIN_MAX_TILE_ZOOM_COARSENING = 8;
/**
 * How long the switch waits for terrain-decoded tiles before ramping anyway, ms.
 *
 * There has to be a timeout: when every visible tile is ALREADY decoded for the terrain — switching
 * back and forth — the wait never ends on its own, and the switch hangs. Same value and same reason
 * as the demo's `TERRAIN_ANIM_TILE_TIMEOUT_MS`.
 */
export const TERRAIN_TILE_WAIT_TIMEOUT_MS = 2500;

// --- peak finder: the view --------------------------------------------------------------------
//
// `DemoConfig.PEAK_FINDER_*`, except the flight duration.
export const peakFinderTilt = settingsStore('peakFinderTilt', 25);
export const peakFinderFlyElevation = settingsStore('peakFinderFlyElevation', 1000);
export const peakFinderFlyZoom = settingsStore('peakFinderFlyZoom', 13.6);
/** Seconds. The demo's 3.5 is a demo: it shows the flight off. 1.2 gets out of the way. */
export const peakFinderFlyDuration = settingsStore('peakFinderFlyDuration', 1.2);
/** Extra height at the middle of the fly-in: the viewpoint climbs over the way there like a plane. */
export const peakFinderFlyClimb = settingsStore('peakFinderFlyClimb', 1500);
/**
 * How far behind the terrain a label anchor may sit and still be labelled, as a fraction of its
 * distance. 0.02 is the SDK default; a summit sitting right ON a ridge is exactly what this view is
 * for, so the mode is deliberately generous.
 */
export const peakFinderOcclusion = settingsStore('peakFinderOcclusion', 0.15);
/** A panorama is the case tangram's view-distance rule answers badly, hence well above 1. */
export const peakFinderViewDistance = settingsStore('peakFinderViewDistance', 3);
/** false = ink on paper, true = paper on ink (and what AR wants). */
export const peakFinderDark = settingsStore('peakFinderDark', false);

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
export const peakFinderCreaseStrength = settingsStore('peakFinderCreaseStrength', 0.6);
/** How much of the distance washes out towards the paper colour. */
export const peakFinderHaze = settingsStore('peakFinderHaze', 0.7);

// --- peak finder: the summit labels -----------------------------------------------------------
//
// Every one of these is style TEXT, so changing one needs a NEW decoder — see rebuildPeaksLayer in
// features/peakFinder.ts.
export const peakFinderLabelPinTop = settingsStore('peakFinderLabelPinTop', true);
export const peakFinderLabelBand = settingsStore('peakFinderLabelBand', 0.25);
export const peakFinderLabelAngle = settingsStore('peakFinderLabelAngle', 55);
export const peakFinderLabelRows = settingsStore('peakFinderLabelRows', 1);
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
/** Metres the viewpoint is currently lifted above the ground. */
export const peakFinderElevation = writable(0);

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
export const mapTiltRange = derived(
    [pitchEnabled, terrain3dActive, peakFinderActive, peakFinderArActive],
    ([$pitchEnabled, $terrain3dActive, $peakFinderActive, $peakFinderArActive]): [number, number] => {
        // A NEGATIVE tilt is how the SDK looks UP, which is the whole point of holding the phone at the
        // sky in AR.
        if ($peakFinderArActive) {
            return [-90, 90];
        }
        if ($peakFinderActive || $terrain3dActive) {
            return [5, 90];
        }
        return [$pitchEnabled ? 30 : 90, 90];
    }
);
