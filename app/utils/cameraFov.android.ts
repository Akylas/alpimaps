import { Utils } from '@nativescript/core';
import type { CameraFieldOfView, LensDistortion } from '~/utils/cameraFov';

const CHARACTERISTICS = android.hardware.camera2.CameraCharacteristics;

/**
 * `CameraCharacteristics.get` is declared as returning the key's type, but a boxed `java.lang.Integer`
 * arrives as a proxy rather than a JS number, so both have to be accepted.
 */
function asNumber(value): number | null {
    if (typeof value === 'number') {
        return value;
    }
    const unboxed = value?.intValue?.();
    return typeof unboxed === 'number' ? unboxed : null;
}

/**
 * Whether the camera might be correcting its own distortion, in which case ours must not be applied
 * on top.
 *
 * `DISTORTION_CORRECTION_MODE` is a per-request control that neither this app nor CameraX sets, so
 * whatever the HAL defaults to is what happens — and the spec leaves that to the HAL. A device that
 * advertises no mode but OFF cannot be correcting anything; anything else is treated as "might be",
 * and the frame is left rectilinear rather than risk correcting it twice.
 */
function mayCorrectItsOwnDistortion(characteristics): boolean {
    const modes = characteristics.get(CHARACTERISTICS.DISTORTION_CORRECTION_AVAILABLE_MODES);
    if (!modes || modes.length === 0) {
        return false;
    }
    for (let index = 0; index < modes.length; index++) {
        if (modes[index] !== 0 /* DISTORTION_CORRECTION_MODE_OFF */) {
            return true;
        }
    }
    return false;
}

/**
 * The lens's distortion, and where it is centred, in tangent units.
 *
 * `LENS_DISTORTION` is stated against the PRE-CORRECTION active array, which is also the array
 * `LENS_INTRINSIC_CALIBRATION` measures its focal length and principal point in — so both are read
 * from that one, and the centre offset is the principal point's distance from the array's middle
 * divided by the focal length, which is exactly the tangent units the coefficients use.
 */
function readDistortion(characteristics): LensDistortion | null {
    if (mayCorrectItsOwnDistortion(characteristics)) {
        return null;
    }
    const coefficients = characteristics.get(CHARACTERISTICS.LENS_DISTORTION);
    const intrinsics = characteristics.get(CHARACTERISTICS.LENS_INTRINSIC_CALIBRATION);
    const preCorrection = characteristics.get(CHARACTERISTICS.SENSOR_INFO_PRE_CORRECTION_ACTIVE_ARRAY_SIZE);
    if (!coefficients || coefficients.length < 5 || !intrinsics || intrinsics.length < 4 || !preCorrection) {
        return null;
    }
    const [focalX, focalY, principalX, principalY] = [intrinsics[0], intrinsics[1], intrinsics[2], intrinsics[3]];
    if (!(focalX > 0) || !(focalY > 0)) {
        return null;
    }
    // Every coefficient zero is a device stating "rectilinear", which is not worth a shader pass.
    const distortion: LensDistortion = {
        k1: coefficients[0],
        k2: coefficients[1],
        k3: coefficients[2],
        p1: coefficients[3],
        p2: coefficients[4],
        centerX: (principalX - preCorrection.width() / 2) / focalX,
        centerY: (principalY - preCorrection.height() / 2) / focalY
    };
    const radial = Math.abs(distortion.k1) + Math.abs(distortion.k2) + Math.abs(distortion.k3);
    const tangential = Math.abs(distortion.p1) + Math.abs(distortion.p2);
    return radial + tangential > 0 ? distortion : null;
}

/**
 * Camera2 exposes the lens and the sensor rather than a field of view, so it is computed. Two ways,
 * in order of preference:
 *
 *  1. From `LENS_INTRINSIC_CALIBRATION` — the CALIBRATED focal length, in pixels of the
 *     pre-correction active array: `2 * atan(arrayWidth / (2 * fx))`. This is the lens as measured,
 *     and it differs from the nominal figure below by a percent or two.
 *  2. From the sensor's geometry: `2 * atan(sensorWidth / (2 * focalLength))`. `SENSOR_INFO_PHYSICAL_SIZE`
 *     measures the whole PIXEL array while a capture only reads the ACTIVE array inside it, so the
 *     width is scaled by the ratio of the two; and a lens reporting several focal lengths is a zoom,
 *     of which the SHORTEST is the widest field and so where a preview opens.
 *
 * The aspect is the active array's, i.e. the sensor's own — 4:3 on essentially every device. A 16:9
 * preview stream is a vertical crop of it, so this over-states the frame's height; see
 * `arFieldOfViewY` in `mapModules/features/peakFinder.ts` for the one view shape where that matters.
 *
 * Read straight off `CameraManager` rather than through the preview's CameraX camera: what is in here
 * is the LENS, which is a static characteristic — it needs no view attached and no session running.
 * What the preview is actually DOING with it, the stream's own aspect and the live zoom, is session
 * state and comes from `CameraView.getPreviewInfo()` instead.
 */
export function cameraFieldOfView(): CameraFieldOfView | null {
    const context = Utils.android.getApplicationContext();
    if (!context) {
        return null;
    }
    const manager: android.hardware.camera2.CameraManager = context.getSystemService(android.content.Context.CAMERA_SERVICE);
    if (!manager) {
        return null;
    }
    const ids = manager.getCameraIdList();
    for (let index = 0; index < ids.length; index++) {
        const characteristics = manager.getCameraCharacteristics(ids[index]);
        if (asNumber(characteristics.get(CHARACTERISTICS.LENS_FACING)) !== CHARACTERISTICS.LENS_FACING_BACK) {
            continue;
        }
        const activeArray = characteristics.get(CHARACTERISTICS.SENSOR_INFO_ACTIVE_ARRAY_SIZE);
        let aspect = activeArray && activeArray.height() > 0 ? activeArray.width() / activeArray.height() : 0;
        let horizontal = 0;

        const intrinsics = characteristics.get(CHARACTERISTICS.LENS_INTRINSIC_CALIBRATION);
        const preCorrection = characteristics.get(CHARACTERISTICS.SENSOR_INFO_PRE_CORRECTION_ACTIVE_ARRAY_SIZE);
        if (intrinsics && intrinsics.length >= 1 && intrinsics[0] > 0 && preCorrection && preCorrection.width() > 0) {
            horizontal = 2 * Math.atan(preCorrection.width() / (2 * intrinsics[0])) * (180 / Math.PI);
            if (preCorrection.height() > 0) {
                aspect = preCorrection.width() / preCorrection.height();
            }
        }

        if (!(horizontal > 0)) {
            const physicalSize = characteristics.get(CHARACTERISTICS.SENSOR_INFO_PHYSICAL_SIZE);
            const focalLengths = characteristics.get(CHARACTERISTICS.LENS_INFO_AVAILABLE_FOCAL_LENGTHS);
            if (!physicalSize || !focalLengths || focalLengths.length === 0) {
                continue;
            }
            let focalLength = focalLengths[0];
            for (let focalIndex = 1; focalIndex < focalLengths.length; focalIndex++) {
                focalLength = Math.min(focalLength, focalLengths[focalIndex]);
            }
            let sensorWidth = physicalSize.getWidth();
            if (!(aspect >= 1) && physicalSize.getHeight() > 0) {
                aspect = sensorWidth / physicalSize.getHeight();
            }
            const pixelArray = characteristics.get(CHARACTERISTICS.SENSOR_INFO_PIXEL_ARRAY_SIZE);
            if (pixelArray && activeArray && pixelArray.getWidth() > 0) {
                sensorWidth *= activeArray.width() / pixelArray.getWidth();
            }
            if (!(focalLength > 0) || !(sensorWidth > 0)) {
                continue;
            }
            horizontal = 2 * Math.atan(sensorWidth / (2 * focalLength)) * (180 / Math.PI);
        }

        if (!(horizontal > 0) || !(aspect >= 1)) {
            continue;
        }
        return { horizontal, aspect, distortion: readDistortion(characteristics) };
    }
    return null;
}
