import type { CameraFieldOfView } from '~/utils/cameraFov';

// declared here rather than pulling in 351 kB of iOS typings: the program is typechecked as Android
declare const AVMediaTypeVideo: string;
declare const AVCaptureDevice: {
    defaultDeviceWithMediaType(mediaType: string): { activeFormat?: { videoFieldOfView: number; formatDescription?: unknown } } | null;
};
declare function CMVideoFormatDescriptionGetDimensions(description: unknown): { width: number; height: number };

const FALLBACK_ASPECT = 16 / 9;

/**
 * `videoFieldOfView` is the format's horizontal field, sensor crop included, and `activeFormat` is the running
 * session's. No distortion: calibration data only comes with a photo capture, not a preview.
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
