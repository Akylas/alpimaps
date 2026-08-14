import { GeoHandler } from '~/handlers/GeoHandler';

export const DEFAULT_SCREEN_REFRESH_DELAY = 100;

/** iOS gives apps no way to turn the screen on, so this is a no-op. See screen.android.ts. */
export function requestScreenRefresh(geoHandler: GeoHandler, delay?: number): boolean {
    return false;
}
