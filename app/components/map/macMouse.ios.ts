import { toNativeMapPos, toNativeMapVec, toNativeScreenPos } from '@nativescript-community/ui-massifmaps/core';
import type { MassifMap as MassifMapView } from '@nativescript-community/ui-massifmaps/ui';
import type { TerrainTouchMode } from '~/stores/terrainStore';
import type { MapPos } from '~/utils/geo';

// maplibre's mouse handlers, as the SDK's WebMapView uses them: degrees and zoom per point
const ROTATE_SPEED = 0.8;
const PITCH_SPEED = 0.5;
// nearer the centre than this, the angle swept around it is too unstable to steer by
const ROTATE_CENTER_THRESHOLD = 100;
const WHEEL_ZOOM_RATE = 1 / 450;
const MAX_SCALE_PER_WHEEL_EVENT = 2;
// a wheel notch arrives as a few line-based points, a browser sees about this many pixels for it
const WHEEL_NOTCH_DELTA = 100;
// maplibre's clickTolerance: a right press moving less than this is a click
const CLICK_TOLERANCE = 3;

// the SDK's internal units are Web Mercator meters scaled by WORLD_SIZE / EARTH_CIRCUMFERENCE
const MERCATOR_RADIUS = 6378137;
const METERS_TO_INTERNAL = (1 << 20) / (2 * Math.PI * MERCATOR_RADIUS);
const TO_RADIANS = Math.PI / 180;
const TO_DEGREES = 180 / Math.PI;

type SecondaryClickCallback = (point: { x: number; y: number }, position: MapPos) => void;

@NativeClass
class MacMouseHandler extends NSObject implements UIGestureRecognizerDelegate {
    public static ObjCProtocols = [UIGestureRecognizerDelegate];

    private mapView: MassifMapView;
    private onSecondaryClick: SecondaryClickCallback;
    private touchMode: () => TerrainTouchMode;
    public optionPan: UIPanGestureRecognizer;
    public wheel: UIPanGestureRecognizer;
    public scroll: UIPanGestureRecognizer;
    public pinch: UIPinchGestureRecognizer;
    public rotate: UIRotationGestureRecognizer;
    private lastPoint: CGPoint;
    private rightDownPoint: CGPoint;
    private rightDragging: boolean;
    private scrollAnchor: CGPoint;
    private lastPinchScale: number;
    private lastRotation: number;

    public static initWithMapView(mapView: MassifMapView, onSecondaryClick: SecondaryClickCallback, touchMode: () => TerrainTouchMode): MacMouseHandler {
        const handler = MacMouseHandler.new() as MacMouseHandler;
        handler.mapView = mapView;
        handler.onSecondaryClick = onSecondaryClick;
        handler.touchMode = touchMode;
        return handler;
    }

    public detach() {
        this.mapView = null;
        this.optionPan = null;
        this.wheel = null;
        this.scroll = null;
        this.pinch = null;
        this.rotate = null;
    }

    // ⌥-drag rotates and tilts too, as Apple Maps: a left-drag without it stays the SDK's pan
    public gestureRecognizerShouldReceiveEvent(recognizer: UIGestureRecognizer, event: _UIEvent) {
        return recognizer !== this.optionPan || (event.modifierFlags & UIKeyModifierFlags.Alternate) !== 0;
    }

    // scroll events only: a left-drag stays the SDK's pan
    public gestureRecognizerShouldReceiveTouch(recognizer: UIGestureRecognizer, touch: UITouch) {
        return recognizer !== this.wheel && recognizer !== this.scroll;
    }

    // a trackpad pinch usually turns a little too
    public gestureRecognizerShouldRecognizeSimultaneouslyWithGestureRecognizer(recognizer: UIGestureRecognizer, other: UIGestureRecognizer) {
        const pair: UIGestureRecognizer[] = [this.pinch, this.rotate];
        return pair.includes(recognizer) && pair.includes(other);
    }

    // the SDK's screen positions are pixels, UIKit reports points
    private mapPosAt(point: CGPoint, view: UIView) {
        const scale = view.contentScaleFactor;
        return this.mapView.screenToMap({ x: point.x * scale, y: point.y * scale });
    }

    // the SDK's wheel zoom holds the ground under the cursor still when tilted or over terrain, setZoom with a target does not
    private zoomBy(delta: number, view: UIView, location: CGPoint) {
        const nativeMapView = this.mapView.mapView;
        if (nativeMapView.onWheelZoomXY) {
            const scale = view.contentScaleFactor;
            nativeMapView.onWheelZoomXY(delta, location.x * scale, location.y * scale);
        } else {
            this.mapView.setZoom(this.mapView.zoom + delta, this.mapPosAt(location, view), 0);
        }
    }

    // a right-drag rotates and tilts, a right-click is the place's menu, as on the web
    public onRightMouse(phase: MacRightMousePhase, location: CGPoint, view: UIView) {
        if (phase === MacRightMousePhase.Down) {
            this.rightDownPoint = location;
            this.lastPoint = location;
            this.rightDragging = false;
        } else if (phase === MacRightMousePhase.Dragged) {
            if (this.rightDragging || Math.hypot(location.x - this.rightDownPoint.x, location.y - this.rightDownPoint.y) >= CLICK_TOLERANCE) {
                this.rightDragging = true;
                this.dragRotate(location, view.bounds.size);
            }
        } else if (!this.rightDragging) {
            const { latitude, longitude } = this.mapPosAt(this.rightDownPoint, view);
            this.onSecondaryClick?.({ x: this.rightDownPoint.x, y: this.rightDownPoint.y }, { lat: latitude, lon: longitude });
        }
    }

    public onOptionPan(recognizer: UIPanGestureRecognizer) {
        const point = recognizer.locationInView(recognizer.view);
        if (recognizer.state === UIGestureRecognizerState.Began) {
            this.lastPoint = point;
        } else if (recognizer.state === UIGestureRecognizerState.Changed) {
            this.dragRotate(point, recognizer.view.bounds.size);
        }
    }

    // rotates around the centre and tilts, as WebMapView.applyDragRotate
    private dragRotate(point: CGPoint, bounds: CGSize) {
        const centerX = bounds.width / 2;
        const centerY = bounds.height / 2;
        let rotation: number;
        if (Math.abs(centerY - this.lastPoint.y) > ROTATE_CENTER_THRESHOLD) {
            // the angle swept around the centre, so the ground under the cursor stays under it
            const prevX = this.lastPoint.x - centerX;
            const prevY = point.y - centerY;
            const vecX = point.x - centerX;
            const vecY = point.y - centerY;
            rotation = (Math.atan2(prevX * vecY - prevY * vecX, prevX * vecX + prevY * vecY) * 180) / Math.PI;
        } else {
            rotation = (point.x - this.lastPoint.x) * ROTATE_SPEED * (point.y < centerY ? 1 : -1);
        }
        const nativeMapView = this.mapView.mapView;
        nativeMapView.rotateDurationSeconds(rotation, 0);
        nativeMapView.tiltDurationSeconds((point.y - this.lastPoint.y) * PITCH_SPEED, 0);
        this.lastPoint = point;
    }

    // WebMapView.OnWheel: delta is a browser wheel delta, positive zooms out
    private zoomByWheelDelta(delta: number, recognizer: UIGestureRecognizer) {
        let scale = MAX_SCALE_PER_WHEEL_EVENT / (1 + Math.exp(-Math.abs(delta * WHEEL_ZOOM_RATE)));
        if (delta > 0) {
            scale = 1 / scale;
        }
        this.zoomBy(Math.log2(scale), recognizer.view, this.scrollAnchor);
    }

    // the translation since the last event, against the content like a browser wheel delta
    private takeScrollDelta(recognizer: UIPanGestureRecognizer) {
        // a scroll pan's location moves with its translation: only where it began is the cursor
        if (recognizer.state === UIGestureRecognizerState.Began) {
            this.scrollAnchor = recognizer.locationInView(recognizer.view);
        }
        const delta = -recognizer.translationInView(recognizer.view).y;
        recognizer.setTranslationInView({ x: 0, y: 0 }, recognizer.view);
        return recognizer.state === UIGestureRecognizerState.Changed ? delta : 0;
    }

    public onWheel(recognizer: UIPanGestureRecognizer) {
        const delta = this.takeScrollDelta(recognizer);
        if (delta !== 0) {
            this.zoomByWheelDelta(Math.sign(delta) * WHEEL_NOTCH_DELTA, recognizer);
        }
    }

    // where the cursor was when the scroll began, and how far the two fingers have moved since the last event
    private takeScrollTranslation(recognizer: UIPanGestureRecognizer) {
        if (recognizer.state === UIGestureRecognizerState.Began) {
            this.scrollAnchor = recognizer.locationInView(recognizer.view);
        }
        const translation = recognizer.translationInView(recognizer.view);
        recognizer.setTranslationInView({ x: 0, y: 0 }, recognizer.view);
        return recognizer.state === UIGestureRecognizerState.Changed ? translation : { x: 0, y: 0 };
    }

    // in the free roam modes the two-finger touch drag moves the camera: a Mac's two-finger scroll does the same
    public onScroll(recognizer: UIPanGestureRecognizer) {
        const mode = this.touchMode();
        if (mode === 'classic') {
            const delta = this.takeScrollDelta(recognizer);
            if (delta !== 0) {
                this.zoomByWheelDelta(delta, recognizer);
            }
            return;
        }
        const translation = this.takeScrollTranslation(recognizer);
        if (translation.x !== 0 || translation.y !== 0) {
            const scale = recognizer.view.contentScaleFactor;
            if (mode === 'fps') {
                this.walkBy(translation.x * scale, translation.y * scale);
            } else {
                this.panBy(this.scrollAnchor.x * scale, this.scrollAnchor.y * scale, translation.x * scale, translation.y * scale);
            }
        }
    }

    // TouchHandler::dualPointerMove: along and across the heading, as far as the focus's distance appears to move
    // on the screen. Worked out in Web Mercator meters, then given to pan in the base projection.
    private walkBy(deltaX: number, deltaY: number) {
        const nativeMapView = this.mapView.mapView;
        const viewState = nativeMapView.getMapRenderer().getViewState();
        const screenHeight = viewState.getHeight();
        if (!(screenHeight > 0)) {
            return;
        }
        const metersPerPixel =
            ((2 * Math.tan((viewState.getFOVY() / 2) * TO_RADIANS) * viewState.calculateCameraDistance()) / METERS_TO_INTERNAL / screenHeight) * nativeMapView.getOptions().getFreeRoamMoveSpeed();
        // the rotation is the opposite of the heading
        const heading = -nativeMapView.getRotation() * TO_RADIANS;
        const forwardX = Math.sin(heading);
        const forwardY = Math.cos(heading);
        const forward = deltaY * metersPerPixel;
        const right = -deltaX * metersPerPixel;
        const projection = nativeMapView.getOptions().getBaseProjection();
        const focus = nativeMapView.getFocusPos();
        const wgs84 = projection.toWgs84(focus);
        const mercatorX = MERCATOR_RADIUS * wgs84.getX() * TO_RADIANS + forwardX * forward + forwardY * right;
        const mercatorY = MERCATOR_RADIUS * Math.log(Math.tan(Math.PI / 4 + (wgs84.getY() * TO_RADIANS) / 2)) + forwardY * forward - forwardX * right;
        const moved = projection.fromWgs84(
            toNativeMapPos({ longitude: (mercatorX / MERCATOR_RADIUS) * TO_DEGREES, latitude: (2 * Math.atan(Math.exp(mercatorY / MERCATOR_RADIUS)) - Math.PI / 2) * TO_DEGREES })
        );
        nativeMapView.panDurationSeconds(toNativeMapVec({ x: moved.getX() - focus.getX(), y: moved.getY() - focus.getY(), z: 0 }), 0);
    }

    // the ground under the cursor follows the fingers, the look mode's two-finger pan
    private panBy(anchorX: number, anchorY: number, deltaX: number, deltaY: number) {
        const nativeMapView = this.mapView.mapView;
        const from = nativeMapView.screenToMap(toNativeScreenPos({ x: anchorX, y: anchorY }));
        const to = nativeMapView.screenToMap(toNativeScreenPos({ x: anchorX + deltaX, y: anchorY + deltaY }));
        nativeMapView.panDurationSeconds(toNativeMapVec({ x: from.getX() - to.getX(), y: from.getY() - to.getY(), z: 0 }), 0);
    }

    // trackpad pinch and rotate never reach the map as touches on Mac
    public onPinch(recognizer: UIPinchGestureRecognizer) {
        if (recognizer.state === UIGestureRecognizerState.Began) {
            this.lastPinchScale = 1;
        } else if (recognizer.state === UIGestureRecognizerState.Changed) {
            this.zoomBy(Math.log2(recognizer.scale / this.lastPinchScale), recognizer.view, recognizer.locationInView(recognizer.view));
            this.lastPinchScale = recognizer.scale;
        }
    }

    public onRotate(recognizer: UIRotationGestureRecognizer) {
        if (this.touchMode() === 'fps') {
            return;
        }
        if (recognizer.state === UIGestureRecognizerState.Began) {
            this.lastRotation = 0;
        } else if (recognizer.state === UIGestureRecognizerState.Changed) {
            this.mapView.mapView.rotateDurationSeconds(((recognizer.rotation - this.lastRotation) * 180) / Math.PI, 0);
            this.lastRotation = recognizer.rotation;
        }
    }

    public static ObjCExposedMethods = {
        onOptionPan: { returns: interop.types.void, params: [interop.types.id] },
        onWheel: { returns: interop.types.void, params: [interop.types.id] },
        onScroll: { returns: interop.types.void, params: [interop.types.id] },
        onPinch: { returns: interop.types.void, params: [interop.types.id] },
        onRotate: { returns: interop.types.void, params: [interop.types.id] }
    };
}

/**
 * Mac Catalyst mouse and trackpad on the map, like the web version. Returns the uninstall.
 * `touchMode` is read per event: a left-drag is the SDK's one-finger touch drag whatever the mode. The two-finger drag has
 * no Mac equivalent but a two-finger scroll, which in `look` pans and in `fps` walks instead of zooming; `fps` has no rotate gesture.
 */
export function installMacMouse(mapView: MassifMapView, onSecondaryClick?: SecondaryClickCallback, touchMode: () => TerrainTouchMode = () => 'classic') {
    const nativeView: UIView = mapView.nativeViewProtected;
    // gesture recognizers and interactions hold their target weakly: the closure below keeps it alive
    const handler = MacMouseHandler.initWithMapView(mapView, onSecondaryClick, touchMode);

    const optionPan = UIPanGestureRecognizer.alloc().initWithTargetAction(handler, 'onOptionPan');
    optionPan.delegate = handler;
    handler.optionPan = optionPan;

    const wheel = UIPanGestureRecognizer.alloc().initWithTargetAction(handler, 'onWheel');
    wheel.allowedScrollTypesMask = UIScrollTypeMask.Discrete;
    wheel.delegate = handler;
    handler.wheel = wheel;

    const scroll = UIPanGestureRecognizer.alloc().initWithTargetAction(handler, 'onScroll');
    scroll.allowedScrollTypesMask = UIScrollTypeMask.Continuous;
    scroll.delegate = handler;
    handler.scroll = scroll;

    const pinch = UIPinchGestureRecognizer.alloc().initWithTargetAction(handler, 'onPinch');
    pinch.cancelsTouchesInView = false;
    pinch.delegate = handler;
    handler.pinch = pinch;

    const rotate = UIRotationGestureRecognizer.alloc().initWithTargetAction(handler, 'onRotate');
    rotate.cancelsTouchesInView = false;
    rotate.delegate = handler;
    handler.rotate = rotate;

    const recognizers = [optionPan, wheel, scroll, pinch, rotate];
    recognizers.forEach((recognizer) => nativeView.addGestureRecognizer(recognizer));
    const rightMouse = MacRightMouse.startForViewHandler(nativeView, (phase, location) => handler.onRightMouse(phase, location, nativeView));
    return () => {
        recognizers.forEach((recognizer) => nativeView.removeGestureRecognizer(recognizer));
        rightMouse?.stop();
        handler.detach();
    };
}
