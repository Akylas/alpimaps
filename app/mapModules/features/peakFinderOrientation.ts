import { estimateMagneticField, isSensorAvailable, startListeningForSensor, stopListeningForSensor } from '@nativescript-community/sensors';
import { Utils } from '@nativescript/core';
import { panoramaInteractionTime, panoramaMapView, panoramaPosition } from '~/mapModules/features/peakFinder';
import { peakFinderCalibrationNeeded, peakFinderHeadingFollowing } from '~/stores/terrainStore';
import { TO_DEG } from '~/utils/geo';

// Complementary filter: the fused `rotation` sensor aims the view (heading and pitch); the laggy raw
// magnetometer `heading` only slowly corrects the north offset, which also absorbs iOS's arbitrary yaw
// origin (XArbitraryCorrectedZVertical). Quaternion order: w FIRST on android, LAST on iOS.

// fused reading smoothing (1 = raw): light, the rotation vector is already smooth
const SMOOTHING = 0.5;
// OFFSET smoothing, very slow on purpose: the magnetometer only says where north is
const OFFSET_SMOOTHING = 0.02;
/** Below this much movement, in degrees, the camera is left alone so a still phone stops redrawing. */
const DEAD_ZONE_DEGREES = 0.2;
/** Highest the view may be aimed, in degrees above the horizon. */
const LOOK_UP_LIMIT = 90;
// below this the look is near vertical and its `atan2` azimuth is noise: the last heading is kept
const MIN_HORIZONTAL = 0.05;

let headingListener: (data, sensor: string) => void = null;
let rotationListener: (data, sensor: string) => void = null;
/**
 * No fused `rotation` on a phone without a gyroscope (the Crosscall has none): the look direction is
 * worked out from gravity and the magnetic field instead, each low-passed first - raw, they shook.
 */
let gravityListener: (data, sensor: string) => void = null;
// Light: only spikes, before the cross products. The real smoothing is the 1€ filter on the angles.
const VECTOR_SMOOTHING = 0.3;
let gravity: number[] = null;
let magnetic: number[] = null;
/** Android's SENSOR_STATUS_ACCURACY_MEDIUM: below it the heading is off until a figure 8. */
const MAGNETIC_ACCURACY_MEDIUM = 2;
const EARTH_FIELD_MIN = 25;
const EARTH_FIELD_MAX = 65;
let calibrationSuspect = false;

/**
 * The 1€ filter (Casiez et al.): heavy smoothing while the phone is still, where magnetometer
 * noise is all there is, and less the faster it turns, so following does not lag. Degrees.
 */
class OneEuroFilter {
    private value: number = null;
    private speed = 0;
    private time = 0;
    constructor(
        private minCutoff: number,
        private beta: number,
        private circular: boolean
    ) {}
    reset() {
        this.value = null;
    }
    filter(sample: number, now: number) {
        if (this.value === null) {
            this.value = sample;
            this.time = now;
            return sample;
        }
        const dt = Math.max(1e-3, (now - this.time) / 1000);
        this.time = now;
        const alpha = (cutoff: number) => 1 / (1 + 1 / (2 * Math.PI * cutoff * dt));
        const delta = this.circular ? shortestDelta(this.value, sample) : sample - this.value;
        this.speed += alpha(1) * (delta / dt - this.speed);
        this.value += alpha(this.minCutoff + this.beta * Math.abs(this.speed)) * delta;
        if (this.circular) {
            this.value = ((this.value % 360) + 360) % 360;
        }
        return this.value;
    }
}
const POSE_INTERVAL_MS = 15;
let lastPoseTime = 0;
const headingFilter = new OneEuroFilter(0.15, 0.01, true);
const pitchFilter = new OneEuroFilter(0.15, 0.01, false);
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
 * What a drag moved the view off the sensors' pose, added to it from then on: the sensors are often
 * off by a few degrees, and the user lines the panorama up with what they see. Kept for the session.
 */
let headingTrim = 0;
let pitchTrim = 0;
/** Sensor writes wait this long after the last touch, so the finger aims the view meanwhile. */
const INTERACTION_HOLD_MS = 300;

// The PANORAMA's view, not the live map's. The view's setters rather than `camera().rotation/tilt`:
// those `moveTo` a focus position, which in first person walks the camera around it.
function mapView() {
    return panoramaMapView();
}

// degrees; without it crossing north swings the view through a full turn
function shortestDelta(from: number, to: number) {
    return ((to - from + 540) % 360) - 180;
}

// where the device's BACK (-Z axis) points in the world frame
function lookDirection(quaternion: number[]): { east: number; north: number; vertical: number } {
    if (!quaternion || quaternion.length < 4) {
        return null;
    }
    // w first on Android, last on iOS — see the note at the top of this file.
    const w = __ANDROID__ ? quaternion[0] : quaternion[3];
    const x = __ANDROID__ ? quaternion[1] : quaternion[0];
    const y = __ANDROID__ ? quaternion[2] : quaternion[1];
    const z = __ANDROID__ ? quaternion[3] : quaternion[2];
    // minus the rotation matrix's third column; world frame is X east, Y north, Z up on both platforms
    return { east: -2 * (x * z + w * y), north: 2 * (w * x - y * z), vertical: 2 * (x * x + y * y) - 1 };
}

// independent of roll, so no screen-orientation term is needed (a map camera has no roll)
function pitchFromLook(look: { vertical: number }): number {
    return Math.asin(Math.max(-1, Math.min(1, look.vertical))) * TO_DEG;
}

// magnetic-referenced on android, arbitrary on iOS (`northOffset` fixes both); null when near vertical
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
    if (Date.now() - panoramaInteractionTime() < INTERACTION_HOLD_MS) {
        headingTrim = shortestDelta(smoothedHeading, -view.bearing);
        if (followTilt && smoothedPitch !== null) {
            pitchTrim = view.tilt + smoothedPitch;
        }
        return;
    }
    const heading = (smoothedHeading + headingTrim + 360) % 360;
    const headingSettled = appliedHeading !== null && Math.abs(shortestDelta(appliedHeading, heading)) < DEAD_ZONE_DEGREES;
    // The map's rotation is the opposite of the heading — turning right turns the view left.
    const rotation = -heading;

    // Compass only: the tilt is NOT ours. Writing it here would drag the view back to whatever it was
    // when following started, every time the user turned, and quietly undo their own tilt gesture.
    if (!followTilt || smoothedPitch === null) {
        if (headingSettled) {
            return;
        }
        appliedHeading = heading;
        view.setMapRotation(rotation, 0);
        return;
    }

    // tilt 90 is straight down in this SDK and 0 is the horizon, so looking UP is a NEGATIVE tilt —
    // the opposite sign to a pitch above the horizon.
    const tilt = Math.max(-LOOK_UP_LIMIT, Math.min(90, -smoothedPitch + pitchTrim));
    if (headingSettled && Math.abs(tilt - appliedPitch) < DEAD_ZONE_DEGREES) {
        return;
    }
    appliedHeading = heading;
    appliedPitch = tilt;
    // the VIEW's setters (see `mapView`); duration 0: already smoothed
    view.setMapRotation(rotation, 0);
    view.setTilt(tilt, 0);
}

// only ever moves the OFFSET, never the view
function onHeading(data, sensor: string) {
    if (sensor !== 'heading') {
        return;
    }
    let heading = 'trueHeading' in data ? data.trueHeading : data.heading;
    if (__ANDROID__ && !('trueHeading' in data)) {
        heading = heading + magneticDeclination();
    }
    if (heading === undefined || heading === null || isNaN(heading)) {
        return;
    }
    if (fusedYaw === null) {
        return;
    }
    const offset = shortestDelta(fusedYaw, heading);
    if (northOffset === null) {
        // taken WHOLE the first time, with the heading reset: on iOS the correction can be most of a
        // turn and the view would SWING round on entry
        northOffset = offset;
        smoothedHeading = null;
        return;
    }
    northOffset += OFFSET_SMOOTHING * shortestDelta(northOffset, offset);
}

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

// android reports MAGNETIC north; 0 without a position
let declination: number = null;
function magneticDeclination(): number {
    if (declination === null) {
        const position = panoramaPosition();
        const field = position ? estimateMagneticField(position[1], position[0], position[2] ?? 0) : null;
        if (!field) {
            return 0;
        }
        declination = field.getDeclination(); // once per session: it changes over hundreds of km
    }
    return declination;
}

function lowPass(previous: number[], data): number[] {
    const sample = [data.x, data.y, data.z];
    if (!previous || sample.some(isNaN)) {
        return sample;
    }
    return previous.map((value, index) => value + VECTOR_SMOOTHING * (sample[index] - value));
}

/**
 * The camera's look direction without a gyroscope: android's getRotationMatrix done here. East is
 * magnetic x gravity, north is gravity x east, and the camera looks down the device's -Z axis.
 */
function onGravityOrMagnetic(data, sensor: string) {
    if (sensor === 'accelerometer') {
        gravity = lowPass(gravity, data);
    } else if (sensor === 'magnetometer') {
        magnetic = lowPass(magnetic, data);
        // Earth's field is 25-65 µT: far outside it the sensor is off, whatever accuracy it claims.
        const field = Math.hypot(data.x, data.y, data.z);
        const suspect = (data.accuracy !== undefined && data.accuracy < MAGNETIC_ACCURACY_MEDIUM) || field < EARTH_FIELD_MIN || field > EARTH_FIELD_MAX;
        if (suspect !== calibrationSuspect) {
            calibrationSuspect = suspect;
            // Sensor events arrive off the main thread; the store drives the UI.
            Utils.executeOnMainThread(() => peakFinderCalibrationNeeded.set(suspect));
        }
    } else {
        return;
    }
    if (!gravity || !magnetic) {
        return;
    }
    const [ax, ay, az] = gravity;
    const [mx, my, mz] = magnetic;
    let [hx, hy, hz] = [my * az - mz * ay, mz * ax - mx * az, mx * ay - my * ax];
    const eastLength = Math.hypot(hx, hy, hz);
    const upLength = Math.hypot(ax, ay, az);
    if (!(eastLength > 0.1) || !(upLength > 0)) {
        return; // free fall, or next to a magnet
    }
    [hx, hy, hz] = [hx / eastLength, hy / eastLength, hz / eastLength];
    const [ux, uy, uz] = [ax / upLength, ay / upLength, az / upLength];
    const look = { east: -hz, north: -(ux * hy - uy * hx), vertical: -uz };
    const now = Date.now();
    const yaw = yawFromLook(look);
    if (yaw !== null && !isNaN(yaw)) {
        smoothedHeading = headingFilter.filter((((yaw + magneticDeclination()) % 360) + 360) % 360, now);
    }
    const pitch = pitchFromLook(look);
    if (!isNaN(pitch)) {
        smoothedPitch = pitchFilter.filter(pitch, now);
    }
    // Both sensors run at up to 100 Hz: one write a frame, not two hundred a second beating against it.
    if (now - lastPoseTime >= POSE_INTERVAL_MS) {
        lastPoseTime = now;
        applyPose();
    }
}

/** @param withTilt also aim the view up and down (AR); without it the view keeps the panorama's tilt */
export async function startOrientationFollowing(withTilt: boolean) {
    followTilt = withTilt;
    if (headingListener || gravityListener) {
        return;
    }
    fusedYaw = null;
    northOffset = null;
    declination = null;
    smoothedHeading = null;
    smoothedPitch = null;
    appliedHeading = null;
    appliedPitch = mapView()?.tilt ?? 0;
    headingListener = onHeading;
    // headingFilter 0: every reading, the offset filter does the calming
    if (!isSensorAvailable('rotation')) {
        headingListener = null;
        gravity = null;
        magnetic = null;
        calibrationSuspect = false;
        headingFilter.reset();
        pitchFilter.reset();
        gravityListener = onGravityOrMagnetic;
        await startListeningForSensor(['accelerometer', 'magnetometer'], gravityListener, 16);
        peakFinderHeadingFollowing.set(true);
        return;
    }
    await startListeningForSensor('heading', headingListener, 100, 0, { headingFilter: 0 });
    rotationListener = onRotation;
    // always, ~60 Hz: it aims the view; `withTilt` only decides whether the pitch is written
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
    if (gravityListener) {
        const listener = gravityListener;
        gravityListener = null;
        await stopListeningForSensor(['accelerometer', 'magnetometer'], listener);
    }
    peakFinderCalibrationNeeded.set(false);
    followTilt = false;
    peakFinderHeadingFollowing.set(false);
}
