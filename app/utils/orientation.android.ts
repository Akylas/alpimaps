import { Application } from '@nativescript/core';
import type { ScreenOrientation } from '~/utils/orientation';

/**
 * Android has the easy half of this: the activity carries a requested orientation, and setting it is
 * the whole of it. See orientation.ios.ts for the other half.
 */

export function lockOrientation(orientation: ScreenOrientation): boolean {
    const activity = Application.android.startActivity;
    if (!activity) {
        return false;
    }
    const ActivityInfo = android.content.pm.ActivityInfo;
    let requested: number;
    switch (orientation) {
        case 'landscape':
            // SENSOR_LANDSCAPE, not LANDSCAPE: a panorama is held up like a window, and which way round
            // the phone is held is the user's business. A fixed LANDSCAPE puts it upside down for half
            // of them.
            requested = ActivityInfo.SCREEN_ORIENTATION_SENSOR_LANDSCAPE;
            break;
        case 'portrait':
            requested = ActivityInfo.SCREEN_ORIENTATION_SENSOR_PORTRAIT;
            break;
        default:
            // UNSPECIFIED, rather than reading the manifest's value back: it hands the decision to the
            // system, which is what also restores the user's own rotation lock.
            requested = ActivityInfo.SCREEN_ORIENTATION_UNSPECIFIED;
            break;
    }
    activity.setRequestedOrientation(requested);
    return true;
}
