import { Application } from '@nativescript/core';
import type { ScreenOrientation } from '~/utils/orientation';

export function lockOrientation(orientation: ScreenOrientation): boolean {
    const activity = Application.android.startActivity;
    if (!activity) {
        return false;
    }
    const ActivityInfo = android.content.pm.ActivityInfo;
    let requested: number;
    switch (orientation) {
        case 'landscape':
            // SENSOR_LANDSCAPE, not LANDSCAPE: a fixed one is upside down for half the users
            requested = ActivityInfo.SCREEN_ORIENTATION_SENSOR_LANDSCAPE;
            break;
        case 'portrait':
            requested = ActivityInfo.SCREEN_ORIENTATION_SENSOR_PORTRAIT;
            break;
        case 'sensor':
            // Ignores the user's rotation lock, which UNSPECIFIED respects.
            requested = ActivityInfo.SCREEN_ORIENTATION_SENSOR;
            break;
        default:
            // hands the decision back to the system, which also restores the user's rotation lock
            requested = ActivityInfo.SCREEN_ORIENTATION_UNSPECIFIED;
            break;
    }
    activity.setRequestedOrientation(requested);
    return true;
}
