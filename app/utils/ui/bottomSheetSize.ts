import type { BottomSheetOptions } from '@nativescript-community/ui-material-bottomsheet';
import { Screen, View } from '@nativescript/core';
import { get } from 'svelte/store';
import { windowSize } from '~/variables';

/** Sheets are at least this share of the window height on big screens. */
export const BOTTOM_SHEET_MIN_HEIGHT_RATIO = 0.4;
// a fixed height above this is lowered so the sheet fits and its list can scroll
const BOTTOM_SHEET_MAX_HEIGHT_RATIO = 0.9;
// smallest window side (dip) from which a screen counts as big (tablets); Catalyst always does
const LARGE_SCREEN_MIN_SIDE = 600;

function getWindowSize() {
    return __CATALYST__ ? get(windowSize) : { width: Screen.mainScreen.widthDIPs, height: Screen.mainScreen.heightDIPs };
}

function getFixedHeight(view: View) {
    const { height } = view;
    if (typeof height === 'number') {
        return height;
    }
    if (typeof height === 'object' && height.unit === 'dip') {
        return height.value;
    }
    return undefined;
}

function applyMinHeight(options: BottomSheetOptions) {
    const { view } = options;
    // peek sheets and transparent overlays have their own sizing
    if (!(view instanceof View) || options.peekHeight || options.transparent) {
        return;
    }
    const { height: windowHeight, width } = getWindowSize();
    if (!__CATALYST__ && Math.min(width, windowHeight) < LARGE_SCREEN_MIN_SIDE) {
        return;
    }
    const minHeight = Math.round(windowHeight * BOTTOM_SHEET_MIN_HEIGHT_RATIO);
    const fixedHeight = getFixedHeight(view);
    if (fixedHeight !== undefined) {
        // minHeight does not grow a fixed height
        view.height = Math.min(Math.max(fixedHeight, minHeight), Math.round(windowHeight * BOTTOM_SHEET_MAX_HEIGHT_RATIO));
    } else if (view.height === 'auto' || view.height === undefined) {
        view.minHeight = minHeight;
    }
}

/** Gives every `showBottomSheet` a minimum height on big screens. Call after the bottomsheet `install()`. */
export function installBottomSheetMinHeight() {
    const showBottomSheet = View.prototype.showBottomSheet;
    View.prototype.showBottomSheet = function (this: View, options: BottomSheetOptions) {
        applyMinHeight(options);
        return showBottomSheet.call(this, options);
    };
}
