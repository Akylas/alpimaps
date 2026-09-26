import { estimateMagneticField, startListeningForSensor, stopListeningForSensor } from '@nativescript-community/sensors';
import { get } from 'svelte/store';
import { panoramaMapView, panoramaPosition } from '~/mapModules/features/peakFinder';
import { peakFinderHeadingFollowing } from '~/stores/terrainStore';
import { TO_DEG } from '~/utils/geo';

/**
 * Pointing the camera where the device points.
 *
 * Through `@nativescript-community/sensors`, which this app already uses for the compass and the
 * barometer — it runs its own thread and covers both platforms. The MATHS is the native demo's
 * (`DemoOrientation.java`); none of its `SensorManager` plumbing is needed here.
 *
 * TWO sensors, with the work split the way an AR view needs it — which is NOT the way it was.
 *
 *  - `'rotation'` is the FUSED orientation, and it drives BOTH the heading and the pitch. On android
 *    it is `TYPE_ROTATION_VECTOR` (`SensorManager.java:652`): gyroscope, accelerometer and
 *    magnetometer fused by the platform, so it is fast and smooth and the magnetometer only trims its
 *    slow drift. On iOS it is CoreMotion device motion, which is the same thing.
 *  - `'heading'` gives the ABSOLUTE azimuth, and is used ONLY to pin the offset of the above. On
 *    android the plugin computes it from the RAW magnetometer and RAW accelerometer with no gyroscope
 *    at all (`calculateBearing(field, gravity)`, `SensorManager.java:852`) — which is exactly why it
 *    cannot drive an AR view: it lags, it jitters, and it arrives at whatever rate the magnetometer
 *    manages. Turning the phone used to move the view through this one sensor, smoothed again on top,
 *    and the result was the "dead slow" look-around.
 *
 * So: the rotation vector gives a heading that MOVES correctly, and the magnetometer says where north
 * is. A complementary filter — fast relative yaw plus a slowly corrected offset — which is what every
 * AR view does and what the geo-three webapp does.
 *
 * The offset also absorbs the one platform difference that used to rule the rotation vector's yaw
 * out: iOS starts CoreMotion with `XArbitraryCorrectedZVertical` (`index.ios.js:318`), so its yaw
 * origin is wherever the device happened to be. On android the yaw is already absolute against
 * MAGNETIC north, so the offset converges to the declination. Same code, both platforms, and neither
 * needs to know which it is.
 *
 * The quaternion's component order differs by platform — android's `getQuaternionFromVector` puts w
 * FIRST (`SensorManager.java:657`), CoreMotion puts it LAST (`index.ios.js:132`). Reading it the wrong
 * way round does not fail, it just aims wrongly, which is why this is spelled out.
 */

/**
 * Smoothing of the FUSED reading: 1 = raw, smaller = calmer and laggier.
 *
 * Light, because the rotation vector is already fused and smooth — the platform's own filter has done
 * the work, and a second one here only adds lag. This used to be 0.2 applied at the magnetometer
 * heading's ~10 Hz, a time constant near half a second on top of a sensor that was itself slow.
 */
const SMOOTHING = 0.5;
/**
 * Smoothing of the OFFSET between the fused yaw and magnetic north: very slow on purpose.
 *
 * The magnetometer's job here is to say where north is, not to move the view. At this rate a bad
 * reading moves the picture by a fraction of a degree and a steady bias is still absorbed within a
 * couple of seconds.
 */
const OFFSET_SMOOTHING = 0.02;
/** Below this much movement, in degrees, the camera is left alone so a still phone stops redrawing. */
const DEAD_ZONE_DEGREES = 0.2;
/** Highest the view may be aimed, in degrees above the horizon. */
const LOOK_UP_LIMIT = 90;
/**
 * Below this, the look direction is too close to straight up or down for its own azimuth to mean
 * anything — the horizontal part of the axis vanishes and `atan2` returns noise. The last heading is
 * kept instead, which is what a phone pointed at the sky should do.
 */
const MIN_HORIZONTAL = 0.05;

let headingListener: (data, sensor: string) => void = null;
let rotationListener: (data, sensor: string) => void = null;
/** The fused yaw, as the rotation vector reports it — absolute on android, arbitrary on iOS. */
let fusedYaw: number = null;
/** ...plus this, which is what makes it absolute on both. See the note at the top of this file. */
let northOffset: number = null;
let smoothedHeading: number = null;
let smoothedPitch: number = null;
/** Last pose written, so the dead zone has something to compare against. */
let appliedHeading: number = null;
let appliedPitch = 0;
let followTilt = false;

/**
 * The map VIEW the sensors aim, which is the PANORAMA's — not the live map's.
 *
 * The peak finder runs on a map of its own (`features/peakFinder.ts`), so following the device has to
 * reach that one; turning the live map underneath would move the user's map behind their back.
 *
 * The view rather than the camera, and that is the second half of it: the facade's
 * `camera().rotation(deg)` and `camera().tilt(deg)` are both `moveTo(position(), …)` underneath, and
 * `moveTo` writes a FOCUS POSITION — in first person the focus is derived from the camera, so handing
 * it back the focus from the previous reading walked the camera around it. That is the "looking left
 * and right MOVES me" this used to do. The view's own `setMapRotation(value, duration)` and
 * `setTilt(value, duration)` carry no target, and a `CameraRotationEvent` without one turns about the
 * CAMERA in first person (`CameraRotationEvent.cpp`) — the same path a one-finger drag takes.
 */
function mapView() {
    return panoramaMapView();
}

/** The shortest way round from `from` to `to`, in degrees. Without this, crossing north swings the
 *  view through a full turn. */
function shortestDelta(from: number, to: number) {
    return ((to - from + 540) % 360) - 180;
}

/**
 * Where the BACK of the device points, in the world frame.
 *
 * The phone is held up like a window, so the axis out of its back is what aims the view: the device's
 * -Z axis, rotated into the world. For a unit quaternion that is minus the rotation matrix's third
 * column, which is the expression below — no matrix built, and all three components come out of the
 * one calculation that the heading and the pitch then read.
 */
function lookDirection(quaternion: number[]): { east: number; north: number; vertical: number } {
    if (!quaternion || quaternion.length < 4) {
        return null;
    }
    // w first on Android, last on iOS — see the note at the top of this file.
    const w = __ANDROID__ ? quaternion[0] : quaternion[3];
    const x = __ANDROID__ ? quaternion[1] : quaternion[0];
    const y = __ANDROID__ ? quaternion[2] : quaternion[1];
    const z = __ANDROID__ ? quaternion[3] : quaternion[2];
    // Minus the third column of the rotation matrix, which for a unit quaternion is this. The world
    // frame is X east, Y north, Z up on both platforms.
    return { east: -2 * (x * z + w * y), north: 2 * (w * x - y * z), vertical: 2 * (x * x + y * y) - 1 };
}

/**
 * How far above the horizon the back of the device points, in degrees.
 *
 * Only the vertical component is needed, and it does not depend on how the device is ROLLED — which is
 * why this needs no screen-orientation term at all. (The web version does carry one, because it builds
 * a full camera orientation including roll; a map camera has no roll.)
 */
function pitchFromLook(look: { vertical: number }): number {
    return Math.asin(Math.max(-1, Math.min(1, look.vertical))) * TO_DEG;
}

/**
 * Which way the back of the device points, in degrees clockwise from the frame's own north.
 *
 * ABSOLUTE on android (the rotation vector is referenced to magnetic north) and arbitrary on iOS; both
 * are turned into a true-north heading by `northOffset`. null when the device is aimed so close to
 * straight up or down that the azimuth is meaningless.
 */
function yawFromLook(look: { east: number; north: number }): number {
    if (Math.hypot(look.east, look.north) < MIN_HORIZONTAL) {
        return null;
    }
    return (((Math.atan2(look.east, look.north) * TO_DEG) % 360) + 360) % 360;
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

/**
 * The magnetometer reading, which only ever moves the OFFSET.
 *
 * Nothing here touches the view directly — see the note at the top of this file for why driving an AR
 * view off this sensor is what made the look-around unusable. It answers one question, slowly: how far
 * is the fused frame's north from the real one.
 */
function onHeading(data, sensor: string) {
    if (sensor !== 'heading') {
        return;
    }
    let heading = 'trueHeading' in data ? data.trueHeading : data.heading;
    if (__ANDROID__ && !('trueHeading' in data)) {
        // Android reports MAGNETIC north here; the declination is what turns it into true north, and
        // the plugin can work it out from where we are.
        const position = panoramaPosition();
        if (position) {
            const field = estimateMagneticField(position[1], position[0], position[2] ?? 0);
            if (field) {
                heading = heading + field.getDeclination();
            }
        }
    }
    if (heading === undefined || heading === null || isNaN(heading) || fusedYaw === null) {
        return;
    }
    const offset = shortestDelta(fusedYaw, heading);
    if (northOffset === null) {
        // Taken WHOLE the first time, and the smoothed heading is reset with it. On iOS the fused
        // frame's north is wherever the device happened to be, so the correction can be most of a
        // turn: without the reset the view would SWING round to it on entry.
        northOffset = offset;
        smoothedHeading = null;
        return;
    }
    northOffset += OFFSET_SMOOTHING * shortestDelta(northOffset, offset);
}

/**
 * The fused orientation, which is what actually aims the view — heading and pitch both.
 */
function onRotation(data, sensor: string) {
    if (sensor !== 'rotation') {
        return;
    }
    const look = lookDirection(data?.quaternion);
    if (!look) {
        return;
    }
    const yaw = yawFromLook(look);
    if (yaw !== null && !isNaN(yaw)) {
        fusedYaw = yaw;
        const heading = (((yaw + (northOffset ?? 0)) % 360) + 360) % 360;
        smoothedHeading = smoothedHeading === null ? heading : smoothedHeading + SMOOTHING * shortestDelta(smoothedHeading, heading);
    }
    const pitch = pitchFromLook(look);
    if (!isNaN(pitch)) {
        smoothedPitch = smoothedPitch === null ? pitch : smoothedPitch + SMOOTHING * (pitch - smoothedPitch);
    }
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
        return; // already running; `setFollowTilt` is what adds or drops the pitch
    }
    fusedYaw = null;
    northOffset = null;
    smoothedHeading = null;
    smoothedPitch = null;
    appliedHeading = null;
    appliedPitch = mapView()?.tilt ?? 0;
    headingListener = onHeading;
    // headingFilter 0: every reading, because the offset filter here is what decides how calm it is.
    // Rate is not critical any more — this sensor no longer moves the view, it only trims the offset.
    await startListeningForSensor('heading', headingListener, 100, 0, { headingFilter: 0 });
    rotationListener = onRotation;
    // ALWAYS, and at ~60 Hz: this is the sensor that aims the view now, on both axes, so its rate is
    // the rate the picture follows the phone at. `withTilt` decides whether the PITCH is written, not
    // whether the sensor runs.
    await startListeningForSensor('rotation', rotationListener, 16);
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

/** Whether the pitch is being written, so AR can be turned off without stopping the compass. */
export function isFollowingTilt() {
    return followTilt;
}

/** Adds or drops the tilt half in place. */
export async function setFollowTilt(withTilt: boolean) {
    if (!get(peakFinderHeadingFollowing)) {
        return;
    }
    // A flag and nothing else: the rotation sensor drives the HEADING too, so it keeps running either
    // way. It used to be started and stopped here, which is also why the compass-only mode fell back
    // to the magnetometer.
    followTilt = withTilt;
}
