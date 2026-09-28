/**
 * Brown-Conrady, ideal-to-distorted as Camera2's `LENS_DISTORTION`, in tangent units (x = x_cam / z_cam):
 * x' = x (1 + k1 r² + k2 r⁴ + k3 r⁶) + 2 p1 x y + p2 (r² + 2x²), y' = y (…) + p1 (r² + 2y²) + 2 p2 x y
 */
export interface LensDistortion {
    k1: number;
    k2: number;
    k3: number;
    /** Tangential, Camera2's k4. */
    p1: number;
    /** Tangential, Camera2's k5. */
    p2: number;
    /** Principal point offset from the frame's centre, in tangent units. */
    centerX: number;
    centerY: number;
}

export interface CameraFieldOfView {
    /** Degrees, in the camera's landscape orientation: the width survives both 4:3 and 16:9 preview crops. */
    horizontal: number;
    /** Width/height (>= 1) of the sensor array, not the stream: fallback when `getPreviewInfo()` is unavailable. */
    aspect: number;
    /** null when the device does not state it or corrects it itself: draw rectilinear. */
    distortion: LensDistortion | null;
}

/** null when it cannot be worked out (no rear camera, no reported sensor geometry). */
export function cameraFieldOfView(): CameraFieldOfView | null;

/** Session state of the preview, from `CameraView.getPreviewInfo()`. */
export interface CameraPreviewInfo {
    /** px, in the camera's own orientation. */
    width: number;
    height: number;
    /** Degrees to stand upright in the view: 0, 90, 180 or 270. */
    rotation: number;
    /** The effective `ScaleType`. */
    stretch: string;
    zoomRatio: number;
}

/**
 * Structural and optional: `getPreviewInfo` is newer than the resolved ui-cameraview release.
 * Replace with the plugin's `CameraView` once the app depends on a release that has it.
 */
export interface PreviewGeometrySource {
    getPreviewInfo?(): CameraPreviewInfo | null;
}
