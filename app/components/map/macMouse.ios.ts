import type { MapPos } from '~/utils/geo';
import type { MassifMap as MassifMapView } from '@nativescript-community/ui-massifmaps/ui';

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

type SecondaryClickCallback = (point: { x: number; y: number }, position: MapPos) => void;

@NativeClass
class MacMouseHandler extends NSObject implements UIGestureRecognizerDelegate {
    public static ObjCProtocols = [UIGestureRecognizerDelegate];

    private mapView: MassifMapView;
    private onSecondaryClick: SecondaryClickCallback;
    public optionPan: UIPanGestureRecognizer;
    public wheel: UIPanGestureRecognizer;
    public scroll: UIPanGestureRecognizer;
    public pinch: UIPinchGestureRecognizer;
    public rotate: UIRotationGestureRecognizer;
    private lastPoint: CGPoint;
    private rightDownPoint: CGPoint;
    private rightDragging: boolean;
    private lastPinchScale: number;
    private lastRotation: number;

    public static initWithMapView(mapView: MassifMapView, onSecondaryClick: SecondaryClickCallback): MacMouseHandler {
        const handler = MacMouseHandler.new() as MacMouseHandler;
        handler.mapView = mapView;
        handler.onSecondaryClick = onSecondaryClick;
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

    private zoomBy(delta: number, recognizer: UIGestureRecognizer) {
        this.mapView.setZoom(this.mapView.zoom + delta, this.mapPosAt(recognizer.locationInView(recognizer.view), recognizer.view), 0);
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
            this.onSecondaryClick({ x: this.rightDownPoint.x, y: this.rightDownPoint.y }, { lat: latitude, lon: longitude });
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
        this.zoomBy(Math.log2(scale), recognizer);
    }

    // the translation since the last event, against the content like a browser wheel delta
    private takeScrollDelta(recognizer: UIPanGestureRecognizer) {
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

    public onScroll(recognizer: UIPanGestureRecognizer) {
        const delta = this.takeScrollDelta(recognizer);
        if (delta !== 0) {
            this.zoomByWheelDelta(delta, recognizer);
        }
    }

    // trackpad pinch and rotate never reach the map as touches on Mac
    public onPinch(recognizer: UIPinchGestureRecognizer) {
        if (recognizer.state === UIGestureRecognizerState.Began) {
            this.lastPinchScale = 1;
        } else if (recognizer.state === UIGestureRecognizerState.Changed) {
            this.zoomBy(Math.log2(recognizer.scale / this.lastPinchScale), recognizer);
            this.lastPinchScale = recognizer.scale;
        }
    }

    public onRotate(recognizer: UIRotationGestureRecognizer) {
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

/** Mac Catalyst mouse and trackpad on the map, like the web version. Returns the uninstall. */
export function installMacMouse(mapView: MassifMapView, onSecondaryClick: SecondaryClickCallback) {
    const nativeView: UIView = mapView.nativeViewProtected;
    // gesture recognizers and interactions hold their target weakly: the closure below keeps it alive
    const handler = MacMouseHandler.initWithMapView(mapView, onSecondaryClick);

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
