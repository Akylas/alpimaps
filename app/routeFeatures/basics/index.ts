import { convertDurationSeconds, convertElevation, formatDistance } from '~/helpers/formatter';
import { lc } from '~/helpers/locale';
import { type RouteCtx, type RouteTile, registerRouteFeature } from '~/routeFeatures/registry';

function basicsTiles({ item }: RouteCtx): RouteTile[] {
    const route = item?.route;
    if (!route) {
        return [];
    }
    const properties = item.properties;
    const profile = item.profile;
    const hasProfile = !!profile?.max;
    const distance = route.totalDistance || (properties?.distance ? properties.distance * 1000 : 0);
    const ascent = hasProfile ? profile.dplus : properties?.ascent;
    const descent = hasProfile ? -profile.dmin : properties?.descent;
    const tiles: RouteTile[] = [];
    if (distance > 0) {
        tiles.push({ key: 'distance', icon: 'mdi-arrow-left-right', label: lc('distance'), value: formatDistance(distance) });
    }
    if (route.totalTime > 0) {
        tiles.push({ key: 'time', icon: 'mdi-timer-outline', label: lc('duration'), value: convertDurationSeconds(route.totalTime) });
    }
    if (ascent > 0) {
        tiles.push({
            key: 'ascent',
            icon: 'mdi-arrow-top-right',
            label: lc('ascent'),
            value: convertElevation(ascent),
            sub: descent > 0 ? { icon: 'mdi-arrow-bottom-right', text: convertElevation(descent) } : undefined
        });
    }
    return tiles;
}

registerRouteFeature({ id: 'basics', order: 0, tiles: basicsTiles });
