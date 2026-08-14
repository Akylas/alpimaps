import { GeoHandler } from '~/handlers/GeoHandler';

export const DEFAULT_SCREEN_REFRESH_DELAY: number;

/**
 * Turns on / refreshes the screen on eink devices. No-op on iOS.
 *
 * @returns whether the refresh was actually asked for, ie not dropped by the throttle.
 */
export function requestScreenRefresh(geoHandler: GeoHandler, delay?: number): boolean;
