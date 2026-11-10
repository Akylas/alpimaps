/** The light of the route sun mode, from the sun along the route, the moon's when the sun is down. Pure at runtime: only a type comes from the store. */
import type { SunRead } from '~/routeFeatures/sun/read';
import type { RouteSunLight } from '~/stores/terrainStore';
import { moonIllumination, moonPositionAt } from '~/utils/astronomy/moon';
import { sunLevel } from '~/utils/astronomy/sun';

/** What the SDK's sun does at a full moon at the zenith, where its own is 1: the moon is a dim light, and a cold one. */
export const MOON_MAX_INTENSITY = 0.6;
export const MOON_LIGHT_COLOR = '#B4C4EE';
/** Under this share of a full moon at the zenith the moon lights nothing worth a direction, and casts no shadow worth the pass that draws it. */
const MIN_MOON_SHARE = 0.03;

/** 0..1: how much of a full moon at the zenith the light is: its lit part (%) times how high it stands (degrees), the way its light is thinned by the air near the horizon. */
export function moonShare(illumination: number, altitude: number): number {
    return altitude <= 0 || illumination <= 0 ? 0 : (Math.min(illumination, 100) / 100) * Math.sin((Math.min(altitude, 90) * Math.PI) / 180);
}

/** What the map's light is set to for a moon of that share: how bright the direct light is, its colour, and the shadows the user's strength gives it. */
export function moonLightLook(share: number, shadowStrength: number): { sunIntensity: number; sunColor: string; shadowStrength: number } {
    return { sunIntensity: MOON_MAX_INTENSITY * share, sunColor: MOON_LIGHT_COLOR, shadowStrength: share < MIN_MOON_SHARE ? 0 : shadowStrength * share };
}

/** The look the ride is at: the nearest sample's place, for the moon is a function of where one stands. */
function placeAt(read: SunRead, vertex: number) {
    const { samples } = read;
    let low = 0;
    let high = samples.length - 1;
    while (low < high) {
        const middle = (low + high) >> 1;
        if (samples[middle].vertex < vertex) {
            low = middle + 1;
        } else {
            high = middle;
        }
    }
    const before = samples[Math.max(0, low - 1)];
    return Math.abs(before.vertex - vertex) < Math.abs(samples[low].vertex - vertex) ? before : samples[low];
}

/**
 * The light at a distance from the start, at the start without one. Degrees to a tenth: a finer move is not worth a new light.
 * With the sun under the horizon the moon is the light, if it is up and lit enough: its place and how much of its light there is.
 */
export function routeSunLightAt(read: SunRead | null, distance: number | undefined): RouteSunLight | null {
    if (!read) {
        return null;
    }
    const vertex = read.indexAtDistance(distance ?? 0);
    const point = read.at(vertex);
    const level = sunLevel(point.altitude);
    if (level === 'twilight' || level === 'night') {
        const place = placeAt(read, vertex);
        const moon = moonPositionAt(point.at, place);
        const share = moonShare(moonIllumination(new Date(point.at)), moon.altitude);
        if (share >= MIN_MOON_SHARE) {
            return { azimuth: Math.round(moon.azimuth * 10) / 10, altitude: Math.round(moon.altitude * 10) / 10, moon: Math.round(share * 100) / 100 };
        }
    }
    return { azimuth: Math.round(point.azimuth * 10) / 10, altitude: Math.round(point.altitude * 10) / 10, clearness: point.clearness };
}

/** No new light for what is the light there is. */
export function sameLight(first: RouteSunLight | null, second: RouteSunLight | null): boolean {
    return !!first && !!second && first.azimuth === second.azimuth && first.altitude === second.altitude && first.clearness === second.clearness && first.moon === second.moon;
}
