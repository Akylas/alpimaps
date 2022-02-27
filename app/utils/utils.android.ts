export * from './utils.common';
import { sdkVersion } from './utils.common';
import { Application } from '@nativescript/core';

export function enableShowWhenLockedAndTurnScreenOn() {
    const activity = Application.android.startActivity as android.app.Activity;
    if (sdkVersion() >= 27) {
        activity.setShowWhenLocked(true);
        // this.setTurnScreenOn(true);
    } else {
        activity.getWindow().addFlags(
            android.view.WindowManager.LayoutParams.FLAG_SHOW_WHEN_LOCKED
            // || android.view.WindowManager.LayoutParams.FLAG_TURN_SCREEN_ON
        );
    }
}
export function disableShowWhenLockedAndTurnScreenOn() {
    const activity = Application.android.startActivity as android.app.Activity;
    if (sdkVersion() >= 27) {
        activity.setShowWhenLocked(false);
        // this.setTurnScreenOn(false);
    } else {
        activity.getWindow().clearFlags(
            android.view.WindowManager.LayoutParams.FLAG_SHOW_WHEN_LOCKED
            // || android.view.WindowManager.LayoutParams.FLAG_TURN_SCREEN_ON
        );
    }
}
