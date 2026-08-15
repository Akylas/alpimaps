import { ApplicationSettings, Utils } from '@nativescript/core';
import { GeoHandler } from '~/handlers/GeoHandler';

export const DEFAULT_SCREEN_REFRESH_DELAY = 1200;

/**
 * ms on top of the sleep delay: the screen has to have gone back off before a second refresh means
 * anything at all. Bounding the throttle by the delay itself rather than by a fixed interval is what
 * keeps a real maneuver wake from being swallowed.
 */
const SCREEN_REFRESH_SETTLE = 1000;

let lastRefreshRequest = 0;

/**
 * Asks the launcher/system app of eink devices (A9 and friends) to refresh — and turn on — the screen.
 *
 * There is no standard Android API for this that does not need a WAKE_LOCK; those devices listen for a
 * broadcast instead, which is why this is a fire-and-forget intent rather than a real API call.
 *
 * @returns whether the refresh was actually asked for, so callers can keep their own bookkeeping in
 * step rather than assuming one happened.
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
