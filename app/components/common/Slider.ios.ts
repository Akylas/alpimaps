import { Slider as MaterialSlider } from '@nativescript-community/ui-material-slider';

// On Mac Catalyst, once a recognizer in the window has taken over a mouse drag (a sheet, a scroll view, a map), UIKit stops
// handing that mouse's touch to plain views until the app is reactivated. MDCThumbTrack reads touches as a view, so the slider
// went dead; a recognizer still gets them. It never recognizes, so it blocks nothing, and the track ignores a touch it already has.
@NativeClass
class SliderTouchRecognizer extends UIGestureRecognizer {
    public track: UIView;

    public static initWithTrack(track: UIView): SliderTouchRecognizer {
        const recognizer = SliderTouchRecognizer.new() as SliderTouchRecognizer;
        recognizer.track = track;
        return recognizer;
    }

    public touchesBeganWithEvent(touches: NSSet<UITouch>, event: _UIEvent) {
        this.track?.touchesBeganWithEvent(touches, event);
    }

    public touchesMovedWithEvent(touches: NSSet<UITouch>, event: _UIEvent) {
        this.track?.touchesMovedWithEvent(touches, event);
    }

    public touchesEndedWithEvent(touches: NSSet<UITouch>, event: _UIEvent) {
        this.track?.touchesEndedWithEvent(touches, event);
    }

    public touchesCancelledWithEvent(touches: NSSet<UITouch>, event: _UIEvent) {
        this.track?.touchesCancelledWithEvent(touches, event);
    }
}

// MDCThumbTrack puts a UIPanGestureRecognizer on the thumb. On Mac Catalyst it takes over the mouse
// drag, so the track stops getting touchesMoved: a click moves the thumb, a drag does not.
export class Slider extends MaterialSlider {
    initNativeView() {
        super.initNativeView();
        if (__CATALYST__) {
            const thumbTrack = this.nativeViewProtected.valueForKey('thumbTrack');
            const dummyPan: UIGestureRecognizer = thumbTrack?.valueForKey('dummyPanRecognizer');
            if (dummyPan) {
                dummyPan.enabled = false;
            }
            // That pan was also what kept ancestor pans (MDCBottomSheet's MDCDraggableView) off the thumb: the
            // sheet only ignores touches whose hit view is a UIControl, and the thumb view is not one. Let the
            // track (a UIControl) be the hit view, it already handles every touch itself.
            const thumbView: UIView = thumbTrack?.valueForKey('thumbView');
            if (thumbView) {
                thumbView.userInteractionEnabled = false;
            }
            if (thumbTrack) {
                this.nativeViewProtected.addGestureRecognizer(SliderTouchRecognizer.initWithTrack(thumbTrack));
            }
        }
    }

    // The native value was found at 0 for a JS value of 20 (range 0..400, step 1) and the discrete grid is
    // computed from min/max/step as they were when each property landed, so state them once the view is laid out
    layoutNativeView(left: number, top: number, right: number, bottom: number) {
        super.layoutNativeView(left, top, right, bottom);
        if (__CATALYST__) {
            const nativeView = this.nativeViewProtected;
            if (this.stepSize > 0) {
                nativeView.numberOfDiscreteValues = Math.round((this.maxValue - this.minValue) / this.stepSize) + 1;
            }
            if (nativeView.value !== this.value) {
                nativeView.value = this.value;
            }
        }
    }
}
