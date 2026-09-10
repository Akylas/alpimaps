import { Application } from '@nativescript/core';

/**
 * Android has the easy half of this: the activity carries a requested orientation, and setting it is
 * the whole of it. See orientation.ios.ts for the other half.
 */

function setRequestedOrientation(orientation: number): boolean {
    const activity = Application.android.startActivity;
    if (!activity) {
        return false;
    }
    activity.setRequestedOrientation(orientation);
    return true;
}

export function lockLandscape(): boolean {
    // SENSOR_LANDSCAPE, not LANDSCAPE: the panorama is held up like a window, and which way round the
    // phone is held is the user's business. A fixed LANDSCAPE puts it upside down for half of them.
    return setRequestedOrientation(android.content.pm.ActivityInfo.SCREEN_ORIENTATION_SENSOR_LANDSCAPE);
}

export function unlockOrientation() {
    // UNSPECIFIED, not the manifest's value read back: it hands the decision to the system, which is
    // what also restores the user's own rotation lock.
    setRequestedOrientation(android.content.pm.ActivityInfo.SCREEN_ORIENTATION_UNSPECIFIED);
}
