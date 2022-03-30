export * from './popover.common';

export interface PopupWindowOptions {
    anchor: View;
    vertPos?: VerticalPosition;
    horizPos?: HorizontalPosition;
    x?: number;
    y?: number;
    fitInScreen?: boolean;
    onDismiss?: Function;
}
export function showPopupWindow(view: View, options: PopupWindowOptions): any;
