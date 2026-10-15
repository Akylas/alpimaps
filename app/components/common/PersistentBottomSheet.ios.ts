import { PersistentBottomSheet as BaseBottomSheet } from '@nativescript-community/ui-persistent-bottomsheet';

// The sheet's pan cancels the touches of whatever it takes over: a drag that starts on a slider must stay the slider's
export class PersistentBottomSheet extends BaseBottomSheet {
    protected shouldStartGesture(data) {
        return !this.isOnSlider(data.x, data.y) && super.shouldStartGesture(data);
    }

    private isOnSlider(x: number, y: number) {
        const sheetView: UIView = this.nativeViewProtected;
        const sliderClass = NSClassFromString('MDCSlider');
        let view = sheetView?.hitTestWithEvent({ x, y }, null);
        while (view && view !== sheetView) {
            if (view.isKindOfClass(sliderClass)) {
                return true;
            }
            view = view.superview;
        }
        return false;
    }
}
