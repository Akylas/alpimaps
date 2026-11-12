import { convertDurationSeconds, convertElevation, formatDistance } from '~/helpers/formatter';
import { formatTime, lc } from '~/helpers/locale';
import { arrivalOf } from '~/routeFeatures/basics/arrival';
import { type LensFact, type LensHeadline, type RouteCtx, type RouteLens, type RouteTile, registerRouteFeature } from '~/routeFeatures/registry';

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
        // when it ends, if it leaves at a time that is known
        let arrival: ReturnType<typeof arrivalOf>;
        try {
            arrival = arrivalOf(item, Date.now());
        } catch (error) {
            // the tile only loses its second line: the sheet's header does not depend on it
            DEV_LOG && console.error('arrival', error);
        }
        tiles.push({
            key: 'time',
            opensWhen: true,
            icon: 'mdi-timer-outline',
            label: lc('duration'),
            value: convertDurationSeconds(route.totalTime),
            sub: arrival ? { icon: 'mdi-arrow-right', text: formatTime(arrival.at, 'LT', arrival.offset) } : undefined
        });
    }
    // a pure descent still gets its elevation tile
    if (ascent > 0 || descent > 0) {
        tiles.push({
            key: 'ascent',
            weight: 1.15,
            lens: 'climbs',
            icon: 'mdi-arrow-top-right',
            label: lc('ascent'),
            value: convertElevation(ascent > 0 ? ascent : 0),
            sub: descent > 0 ? { icon: 'mdi-arrow-bottom-right', text: convertElevation(descent) } : undefined
        });
    }
    return tiles;
}

function overviewHeadline({ item }: RouteCtx): LensHeadline {
    const distance = item?.route?.totalDistance || (item?.properties?.distance ? item.properties.distance * 1000 : 0);
    const time = item?.route?.totalTime;
    const facts: LensFact[] = [];
    if (distance > 0) {
        facts.push({ icon: 'mdi-arrow-left-right', text: formatDistance(distance) });
    }
    if (time > 0) {
        facts.push({ icon: 'mdi-timer-outline', text: convertDurationSeconds(time) });
    }
    return { facts };
}

const overview: RouteLens = { id: 'overview', icon: 'mdi-routes', label: () => lc('lens_overview'), available: () => true, chip: () => ({}), headline: overviewHeadline };

registerRouteFeature({
    id: 'basics',
    order: 0,
    tiles: basicsTiles,
    lenses: [overview],
    navPages: [{ id: 'trip', label: () => lc('navigation_page_trip'), component: () => import('~/routeFeatures/basics/TripPage.svelte'), available: () => true }]
});
