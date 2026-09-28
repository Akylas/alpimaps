import { GeoHandler } from '~/handlers/GeoHandler';

export const DEFAULT_SCREEN_REFRESH_DELAY: number;

/**
 * Refreshes the screen on eink devices; no-op on iOS.
 * @returns false when dropped by the throttle.
 */
export function requestScreenRefresh(geoHandler: GeoHandler, delay?: number): boolean;
