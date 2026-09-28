import { ApplicationSettings, Utils } from '@nativescript/core';
import { GeoHandler } from '~/handlers/GeoHandler';

export const DEFAULT_SCREEN_REFRESH_DELAY = 1200;

/** ms on top of the sleep delay: the screen must be back off before a second refresh means anything. */
const SCREEN_REFRESH_SETTLE = 1000;

let lastRefreshRequest = 0;

/**
 * Eink devices (A9 and friends) refresh and turn on the screen on a broadcast: there is no standard API
 * without a WAKE_LOCK. Returns false when throttled.
 */
export function requestScreenRefresh(geoHandler: GeoHandler, delay = ApplicationSettings.getNumber('a9_background_location_screenrefresh_delay', DEFAULT_SCREEN_REFRESH_DELAY)): boolean {
    const now = Date.now();
    // waking the screen produces a resume, a pause and a fresh fix, each of which can ask for another
    // refresh: without this the three of them feed each other for as long as navigation runs
    const quietTime = delay + SCREEN_REFRESH_SETTLE;
    if (now - lastRefreshRequest < quietTime) {
        DEV_LOG && console.log('[screen]  requestScreenRefresh throttled', now - lastRefreshRequest, 'of', quietTime);
        return false;
    }
    lastRefreshRequest = now;
    const action = ApplicationSettings.getString('refreshAlarmBroadcast', 'com.akylas.A9_REFRESH_SCREEN');
    DEV_LOG && console.log('[screen]  requestScreenRefresh', action, 'delay', delay);
    const broadcastIntent = new android.content.Intent(action);
    broadcastIntent.putExtra('sleep_delay', delay);
    geoHandler.ignoreNextResumePause();
    Utils.android.getApplicationContext().sendBroadcast(broadcastIntent);
    return true;
}
