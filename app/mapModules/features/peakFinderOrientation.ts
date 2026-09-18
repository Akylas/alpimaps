import { estimateMagneticField, startListeningForSensor, stopListeningForSensor } from '@nativescript-community/sensors';
import { get } from 'svelte/store';
import { getMapContext } from '~/mapModules/MapModule';
import { peakFinderHeadingFollowing } from '~/stores/terrainStore';
import { TO_DEG } from '~/utils/geo';

/**
 * Pointing the camera where the device points.
 *
 * Through `@nativescript-community/sensors`, which this app already uses for the compass and the
 * barometer — it runs its own thread and covers both platforms. The MATHS is the native demo's
 * (`DemoOrientation.java`); none of its `SensorManager` plumbing is needed here.
 *
 * TWO sensors, not one, and the reason is a platform difference that is easy to walk into:
 *
 *  - `'heading'` gives the AZIMUTH. It is the one this app's compass already uses, and it is absolute
 *    on both platforms.
 *  - `'rotation'` gives the PITCH, from the fused rotation vector. Its azimuth is NOT usable on iOS:
 *    the plugin starts CoreMotion with `XArbitraryCorrectedZVertical` (`index.ios.js:318`), so the
 *    yaw origin is wherever the device happened to be. Z is vertical in both frames, though, so the
 *    pitch is sound on both.
 *
 * And the quaternion's component order differs by platform — Android's `getQuaternionFromVector` puts
 * w FIRST (`SensorManager.java:657`), CoreMotion puts it LAST (`index.ios.js:132`). Reading it the
 * wrong way round does not fail, it just tilts wrongly, which is why this is spelled out.
 */

/** Smoothing of the fused reading: 1 = raw, smaller = calmer and laggier. */
const SMOOTHING = 0.2;
/** Below this much movement, in degrees, the camera is left alone so a still phone stops redrawing. */
const DEAD_ZONE_DEGREES = 0.3;
/** Highest the view may be aimed, in degrees above the horizon. */
const LOOK_UP_LIMIT = 90;

let headingListener: (data, sensor: string) => void = null;
let rotationListener: (data, sensor: string) => void = null;
let smoothedHeading: number = null;
let smoothedPitch: number = null;
/** Last pose written, so the dead zone has something to compare against. */
let appliedHeading: number = null;
let appliedPitch = 0;
let followTilt = false;

function camera() {
    return getMapContext().getMap()?.camera();
}

/**
 * The map VIEW, which is what can turn the view without moving it.
 *
 * The facade's `camera().rotation(deg)` and `camera().tilt(deg)` are both `moveTo(position(), …)`
 * underneath (`api/index.common.ts`), and `moveTo` writes a FOCUS POSITION — in first person the focus
 * is derived from the camera, so handing it back the focus from the previous reading walked the camera
 * around it. That is the "looking left and right MOVES me" this used to do. The view's own
 * `setMapRotation(value, duration)` and `setTilt(value, duration)` carry no target, and a
 * `CameraRotationEvent` without one turns about the CAMERA in first person
 * (`CameraRotationEvent.cpp`) — the same path a one-finger drag takes.
 */
function mapView() {
    return getMapContext().getMapView();
}

/** The shortest way round from `from` to `to`, in degrees. Without this, crossing north swings the
 *  view through a full turn. */
function shortestDelta(from: number, to: number) {
    return ((to - from + 540) % 360) - 180;
}

/**
 * How far above the horizon the BACK of the device points, in degrees.
 *
 * The phone is held up like a window, so the axis pointing out of its back is what aims the view: that
 * is the device's -Z axis, rotated into the world frame. Only its vertical component is needed, and
 * for a unit quaternion that reduces to the expression below — no matrix, and no dependence on how the
 * device is rolled, which is why this needs no screen-orientation term at all. (The web version does
 * carry one, because it builds a full camera orientation including roll; a map camera has no roll.)
 */
function pitchFromQuaternion(quaternion: number[]): number {
    if (!quaternion || quaternion.length < 4) {
        return null;
    }
    // w first on Android, last on iOS — see the note at the top of this file.
    const x = __ANDROID__ ? quaternion[1] : quaternion[0];
    const y = __ANDROID__ ? quaternion[2] : quaternion[1];
    // The world-frame Z of the device's -Z axis: 2(x² + y²) - 1.
    const vertical = 2 * (x * x + y * y) - 1;
    return Math.asin(Math.max(-1, Math.min(1, vertical))) * TO_DEG;
}

/** Writes the smoothed pose, unless nothing moved enough to be worth a frame. */
function applyPose() {
    const view = mapView();
    if (!view || smoothedHeading === null) {
        return;
    }
    const headingSettled = appliedHeading !== null && Math.abs(shortestDelta(appliedHeading, smoothedHeading)) < DEAD_ZONE_DEGREES;
    // The map's rotation is the opposite of the heading — turning right turns the view left.
    const rotation = -smoothedHeading;

    // Compass only: the tilt is NOT ours. Writing it here would drag the view back to whatever it was
    // when following started, every time the user turned, and quietly undo their own tilt gesture.
    if (!followTilt || smoothedPitch === null) {
        if (headingSettled) {
            return;
        }
        appliedHeading = smoothedHeading;
        view.setMapRotation(rotation, 0);
        return;
    }

    // tilt 90 is straight down in this SDK and 0 is the horizon, so looking UP is a NEGATIVE tilt —
    // the opposite sign to a pitch above the horizon.
    const tilt = Math.max(-LOOK_UP_LIMIT, Math.min(90, -smoothedPitch));
    if (headingSettled && Math.abs(tilt - appliedPitch) < DEAD_ZONE_DEGREES) {
        return;
    }
    appliedHeading = smoothedHeading;
    appliedPitch = tilt;
    // The VIEW's setters, which carry no target position — see `mapView` for why the facade's
    // `camera().rotation()`/`camera().tilt()` cannot be used here. Duration 0: the sensor is already
    // smoothed, and an animation would be overwritten by the next reading anyway.
    view.setMapRotation(rotation, 0);
    view.setTilt(tilt, 0);
}

function onHeading(data, sensor: string) {
    if (sensor !== 'heading') {
        return;
    }
    let heading = 'trueHeading' in data ? data.trueHeading : data.heading;
    if (__ANDROID__ && !('trueHeading' in data)) {
        // Android reports MAGNETIC north here; the declination is what turns it into true north, and
        // the plugin can work it out from where we are.
        const position = camera() ? camera().position() : null;
        if (position) {
            const field = estimateMagneticField(position[1], position[0], position[2] ?? 0);
            if (field) {
                heading = heading + field.getDeclination();
            }
        }
    }
    if (heading === undefined || heading === null || isNaN(heading)) {
        return;
    }
    smoothedHeading = smoothedHeading === null ? heading : smoothedHeading + SMOOTHING * shortestDelta(smoothedHeading, heading);
    applyPose();
}

function onRotation(data, sensor: string) {
    if (sensor !== 'rotation') {
        return;
    }
    const pitch = pitchFromQuaternion(data?.quaternion);
    if (pitch === null || isNaN(pitch)) {
        return;
    }
    smoothedPitch = smoothedPitch === null ? pitch : smoothedPitch + SMOOTHING * (pitch - smoothedPitch);
    applyPose();
}

/**
 * Starts following the device.
 *
 * @param withTilt also aim the view up and down, which is what AR wants. Without it this is the plain
 * compass: the view turns with the phone but keeps the panorama's tilt.
 */
export async function startOrientationFollowing(withTilt: boolean) {
    followTilt = withTilt;
    if (headingListener) {
        // Already running — only the tilt half may need adding.
        if (withTilt && !rotationListener) {
            rotationListener = onRotation;
            await startListeningForSensor('rotation', rotationListener, 40);
        }
        return;
    }
    smoothedHeading = null;
    smoothedPitch = null;
    appliedHeading = null;
    appliedPitch = camera()?.tilt() ?? 0;
    headingListener = onHeading;
    // headingFilter 0: every reading, because the smoothing here is what decides how calm it is.
    await startListeningForSensor('heading', headingListener, 100, 0, { headingFilter: 0 });
    if (withTilt) {
        rotationListener = onRotation;
        // ~25 Hz: the rotation vector is already fused and smooth, so this is about how often the view
        // should move, not how much data is needed.
        await startListeningForSensor('rotation', rotationListener, 40);
    }
    peakFinderHeadingFollowing.set(true);
}

/** Stops following, leaving the camera wherever it was pointed. */
export async function stopOrientationFollowing() {
    if (headingListener) {
        const listener = headingListener;
        headingListener = null;
        await stopListeningForSensor('heading', listener);
    }
    if (rotationListener) {
        const listener = rotationListener;
        rotationListener = null;
        await stopListeningForSensor('rotation', listener);
    }
    followTilt = false;
    peakFinderHeadingFollowing.set(false);
}

/** Whether the tilt half is running, so AR can be turned off without stopping the compass. */
export function isFollowingTilt() {
    return !!rotationListener;
}

/** Adds or drops the tilt half in place. */
export async function setFollowTilt(withTilt: boolean) {
    if (!get(peakFinderHeadingFollowing)) {
        return;
    }
    followTilt = withTilt;
    if (withTilt && !rotationListener) {
        rotationListener = onRotation;
        await startListeningForSensor('rotation', rotationListener, 40);
    } else if (!withTilt && rotationListener) {
        const listener = rotationListener;
        rotationListener = null;
        await stopListeningForSensor('rotation', listener);
        smoothedPitch = null;
    }
}
