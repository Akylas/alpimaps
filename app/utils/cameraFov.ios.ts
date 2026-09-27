import type { CameraFieldOfView } from '~/utils/cameraFov';

// Only the AVFoundation/CoreMedia members this needs, declared here rather than by pulling the
// framework's 351 kB of typings into a program that is otherwise typechecked as Android
// (typings/references.d.ts references the ANDROID massifmaps declarations).
declare const AVMediaTypeVideo: string;
declare const AVCaptureDevice: {
    defaultDeviceWithMediaType(mediaType: string): { activeFormat?: { videoFieldOfView: number; formatDescription?: unknown } } | null;
};
declare function CMVideoFormatDescriptionGetDimensions(description: unknown): { width: number; height: number };

/** What a 16:9 preview would be, if the format's own dimensions cannot be read. */
const FALLBACK_ASPECT = 16 / 9;

/**
 * AVFoundation states the field of view outright: `AVCaptureDeviceFormat.videoFieldOfView` is the
 * format's HORIZONTAL field in degrees, already accounting for whatever crop of the sensor the format
 * is — so unlike Camera2 (see cameraFov.android.ts) there is no lens arithmetic and no assumption
 * about which crop the preview picked.
 *
 * `AVCaptureDevice` is a singleton per physical device, so the default video device's `activeFormat`
 * is the format the running preview session selected, whoever opened it. The live zoom is not read
 * here: `CameraView.getPreviewInfo()` reports it off the view that owns the session.
 *
 * NO DISTORTION. AVFoundation only delivers `AVCameraCalibrationData` — the lookup table that would
 * describe it — alongside a PHOTO capture, with `isCameraCalibrationDataDeliveryEnabled` set on a
 * photo output. There is no equivalent for a preview session, so an iOS AR overlay stays rectilinear
 * and the residual is the lens's own barrel distortion at the frame corners.
 */
export function cameraFieldOfView(): CameraFieldOfView | null {
    const format = AVCaptureDevice.defaultDeviceWithMediaType(AVMediaTypeVideo)?.activeFormat;
    if (!format || !(format.videoFieldOfView > 0)) {
        return null;
    }
    let aspect = FALLBACK_ASPECT;
    if (format.formatDescription) {
        const dimensions = CMVideoFormatDescriptionGetDimensions(format.formatDescription);
        if (dimensions?.width > 0 && dimensions?.height > 0) {
            aspect = dimensions.width / dimensions.height;
        }
    }
    return { horizontal: format.videoFieldOfView, aspect: Math.max(1, aspect), distortion: null };
}
