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
export const terrainExaggeration = settingsStore('terrainExaggeration', 1);
export const terrainMeshResolution = settingsStore('terrainMeshResolution', 128);
/** How far the ground goes on, as a multiple of the camera-to-focus distance. Pair with fog. */
export const terrainViewDistanceFactor = settingsStore('terrainViewDistanceFactor', 1.6);
/** Metres the camera is held above the ground. The SDK's 200 swings a close view into a hillside. */
export const terrainCameraClearance = settingsStore('terrainCameraClearance', 40);
/** Seconds the 2D/3D switch takes — the camera flight and the ground's rise share this one number. */
export const terrainSwitchDuration = settingsStore('terrainSwitchDuration', 2.5);
/** FULL: a flat map costs nothing but re-decodes on each switch. RENDER: free switch, 3D's cost. */
export const terrainFlattenModeFull = settingsStore('terrainFlattenModeFull', true);
export const terrainAutoFlattenByTilt = settingsStore('terrainAutoFlattenByTilt', false);
/** In this SDK tilt 90 is straight down, so a landscape view is a LOW tilt. */
export const terrain3dTilt = settingsStore('terrain3dTilt', 20);
export const terrainSky = settingsStore('terrainSky', true);
export const terrainFog = settingsStore('terrainFog', true);

/** The tilt the auto rule switches at. Not a setting: it is the rule's definition, not a taste. */
export const TERRAIN_AUTO_FLATTEN_TILT = 88;

// --- peak finder: the view --------------------------------------------------------------------
export const peakFinderTilt = settingsStore('peakFinderTilt', 25);
export const peakFinderFlyElevation = settingsStore('peakFinderFlyElevation', 1000);
export const peakFinderFlyZoom = settingsStore('peakFinderFlyZoom', 13.6);
export const peakFinderFlyDuration = settingsStore('peakFinderFlyDuration', 3.5);
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
// See app/mapModules/terrain/reliefShaders.ts. The defaults here are the WEB peak finder's look, not
// the native demo's: the web draws no shaded surface at all and inks both sides of every depth break
// with a gamma-lifted difference, which is why linesOnly starts true and the demo's three
// distance/horizon/crease terms start neutral.
export const peakFinderLinesOnly = settingsStore('peakFinderLinesOnly', true);
/** Only used when linesOnly is off: how far slopes go from paper towards the shade colour. */
export const peakFinderShadeStrength = settingsStore('peakFinderShadeStrength', 0.55);
export const peakFinderOutlineWidth = settingsStore('peakFinderOutlineWidth', 1.2);
/** The web's `depthMultiplier`: how hard a depth difference counts before the gamma below. */
export const peakFinderDepthGain = settingsStore('peakFinderDepthGain', 11);
/** The web's `depthBiais`. BELOW 1 on purpose — it lifts weak differences, which is what keeps the
 *  far ranges drawing continuous hairlines instead of dropping out. */
export const peakFinderDepthBias = settingsStore('peakFinderDepthBias', 0.23);
/** Ink both sides of a break (the web) rather than only the nearer one (the demo). */
export const peakFinderOutlineSymmetric = settingsStore('peakFinderOutlineSymmetric', true);
/** 1 = no fade, the web behaviour. Below 1 fades far lines so the horizon reads as the boldest. */
export const peakFinderDistanceFade = settingsStore('peakFinderDistanceFade', 1);
/** Extra width for the sky silhouette. 0 = the web, which gives it none. */
export const peakFinderHorizonBoost = settingsStore('peakFinderHorizonBoost', 0);
/** Ridge/valley folds. 0 = the web, which has no crease term. */
export const peakFinderCreaseStrength = settingsStore('peakFinderCreaseStrength', 0);
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
