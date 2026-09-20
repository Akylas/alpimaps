/**
 * Brown-Conrady lens distortion, in the ideal-to-DISTORTED direction, as Camera2's `LENS_DISTORTION`
 * states it: for an ideal normalized point (x, y) at radius r about the principal point,
 *
 *   x' = x (1 + k1 r² + k2 r⁴ + k3 r⁶) + 2 p1 x y + p2 (r² + 2x²)
 *   y' = y (1 + k1 r² + k2 r⁴ + k3 r⁶) + p1 (r² + 2y²) + 2 p2 x y
 *
 * "Normalized" here is TANGENT units — x = x_camera / z_camera — which is the same space a field of
 * view's `tan(fov/2)` lives in, so no pixel conversion is involved anywhere.
 */
export interface LensDistortion {
    k1: number;
    k2: number;
    k3: number;
    /** Tangential, Camera2's k4. */
    p1: number;
    /** Tangential, Camera2's k5. */
    p2: number;
    /**
     * Where the distortion is centred, relative to the frame's geometric centre, in the same tangent
     * units — the principal point's offset. Small (well under a percent of the field on most
     * devices) but free to carry.
     */
    centerX: number;
    centerY: number;
}

/** What the rear camera's preview covers, as an AR overlay has to reproduce it. */
export interface CameraFieldOfView {
    /**
     * The HORIZONTAL field of view of the preview frame, degrees, in the camera's own LANDSCAPE
     * orientation.
     *
     * The horizontal one because it is the figure that survives what the preview does to the frame: a
     * preview stream is a 4:3 or 16:9 read of the sensor and both keep the sensor's full WIDTH,
     * cutting its height. So this holds whichever stream the platform picked.
     */
    horizontal: number;
    /**
     * Aspect of that frame, width over height, in the same landscape orientation — so always >= 1.
     *
     * A FALLBACK. This is the sensor's own array, not the stream the preview is running, and a 16:9
     * stream is a vertical crop of it. `CameraView.getPreviewInfo()` reports the real one; this is
     * what to use when no preview is up to ask.
     */
    aspect: number;
    /**
     * The lens's distortion, when the device states it AND is not correcting it itself. null means
     * "draw rectilinear", which is what every previous release did.
     */
    distortion: LensDistortion | null;
}

/**
 * What the rear camera sees, for matching a rendered view to its preview.
 *
 * null when it cannot be worked out (no rear camera, a device that reports no sensor geometry): the
 * caller then keeps whatever field of view it was using.
 */
export function cameraFieldOfView(): CameraFieldOfView | null;

/**
 * What the PREVIEW is doing with the lens — `CameraView.getPreviewInfo()`.
 *
 * The lens above is a static device characteristic. This is session state: which resolution the
 * platform chose for the stream, which way round it is, how it is fitted into the view, and where the
 * zoom sits. None of it is computable by an application, which is why the plugin reports it.
 */
export interface CameraPreviewInfo {
    /** The stream's size in the CAMERA's own orientation, px. */
    width: number;
    height: number;
    /** Degrees the stream is rotated by to stand upright in the view: 0, 90, 180 or 270. */
    rotation: number;
    /** How that is then fitted into the view — `ScaleType`, the EFFECTIVE value. */
    stretch: string;
    /** The zoom ratio the camera is actually at; 1 when not zoomed. */
    zoomRatio: number;
}

/**
 * Structurally typed rather than imported as `CameraView`, and OPTIONAL, because `getPreviewInfo` is
 * newer than the ui-cameraview release this app resolves: the method is called when it is there and
 * the mode falls back to the sensor array's aspect and a zoom of 1 when it is not. Replace with the
 * plugin's own `CameraView` once the app depends on a release that has it.
 */
export interface PreviewGeometrySource {
    getPreviewInfo?(): CameraPreviewInfo | null;
}
