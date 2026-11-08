/** The light of the route sun mode, from the sun along the route. Pure at runtime: only a type comes from the store. */
import type { SunRead } from '~/routeFeatures/sun/read';
import type { RouteSunLight } from '~/stores/terrainStore';

/** The light at a distance from the start, at the start without one. Degrees to a tenth: a finer move is not worth a new light. */
export function routeSunLightAt(read: SunRead | null, distance: number | undefined): RouteSunLight | null {
    if (!read) {
        return null;
    }
    const point = read.at(read.indexAtDistance(distance ?? 0));
    return { azimuth: Math.round(point.azimuth * 10) / 10, altitude: Math.round(point.altitude * 10) / 10, clearness: point.clearness };
}

/** No new light for what is the light there is. */
export function sameLight(first: RouteSunLight | null, second: RouteSunLight | null): boolean {
    return !!first && !!second && first.azimuth === second.azimuth && first.altitude === second.altitude && first.clearness === second.clearness;
}
