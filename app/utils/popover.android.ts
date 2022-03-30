import { createNativeArray } from '@nativescript-community/ui-canvas';
import { View } from '@nativescript/core';
import { HorizontalPosition, PopupWindowOptions, VerticalPosition } from './popover';

export * from './popover.common';

export function showPopupWindow(view: View, { anchor, vertPos = VerticalPosition.BELOW, horizPos = HorizontalPosition.CENTER, x = 0, y = 0, fitInScreen = true, onDismiss }: PopupWindowOptions) {
    const context = anchor._context;
    const size = -2; //android.view.ViewGroup.LayoutParams.WRAP_CONTENT
    view._setupAsRootView(context);
    view._isAddedToNativeVisualTree = true;
    view.callLoaded();
    const window = new (com as any).nativescript.popover.RelativePopupWindow(view.nativeViewProtected, size, size, true);
    window.setOutsideTouchable(true);
    window.setBackgroundDrawable(null);
    window.setOnDismissListener(
        new android.widget.PopupWindow.OnDismissListener({
            onDismiss() {
                if (onDismiss) {
                    onDismiss();
                }
                if (view && view.isLoaded) {
                    view.callUnloaded();
                }
                view._isAddedToNativeVisualTree = false;
                view._tearDownUI();
            }
        })
    );
    window.showOnAnchor(anchor.nativeViewProtected, vertPos, horizPos, x, y, fitInScreen);
    return window;
}
