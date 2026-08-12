import { ApplicationSettings, Utils } from '@nativescript/core';

export const DEFAULT_SCREEN_REFRESH_DELAY = 1600;

/**
 * Asks the launcher/system app of eink devices (A9 and friends) to refresh — and turn on — the screen.
 *
 * There is no standard Android API for this that does not need a WAKE_LOCK; those devices listen for a
 * broadcast instead, which is why this is a fire-and-forget intent rather than a real API call.
 */
export function requestScreenRefresh(delay = ApplicationSettings.getNumber('a9_background_location_screenrefresh_delay', DEFAULT_SCREEN_REFRESH_DELAY)) {
    const action = ApplicationSettings.getString('refreshAlarmBroadcast', 'com.akylas.A9_REFRESH_SCREEN');
    DEV_LOG && console.log('[screen] requestScreenRefresh', action, 'delay', delay);
    const broadcastIntent = new android.content.Intent(action);
    broadcastIntent.putExtra('sleep_delay', delay);
    Utils.android.getApplicationContext().sendBroadcast(broadcastIntent);
}
