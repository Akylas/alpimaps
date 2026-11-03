import { lc } from '~/helpers/locale';
import { type LensProfile, type RouteLens, registerRouteFeature } from '~/routeFeatures/registry';
import { routeFeatureStats } from '~/routeFeatures/stats/settings';
import { pavedShare, surfaceStops, topSurfaces } from '~/routeFeatures/stats/surfaces';
import { ROUTE_STATS_HEIGHT } from '~/utils/navigation';
import { surfaceColors } from '~/utils/routing';

const STATS_HEIGHT = 164;
// a surface the palette does not know
const UNKNOWN_SURFACE_COLOR = '#B9C2C8';

const percent = (share: number) => Math.round(share * 100) + ' %';

// the stats are replaced, never edited, so they key what the profile fill was built from
const fills = new WeakMap<object, LensProfile>();

const surfaceLens: RouteLens = {
    id: 'surface',
    icon: 'mdi-road-variant',
    label: () => lc('lens_surface'),
    available: ({ item }) => !!item?.route && item.stats?.surfaces?.length > 0,
    chip: ({ item }) => ({ value: `${percent(pavedShare(item.stats.surfaces))} ${lc('paved')}` }),
    headline: ({ item }) => ({
        text: topSurfaces(item.stats.surfaces, 3)
            .map(({ id, perc }) => `${percent(perc)} ${lc(id)}`)
            .join(' · ')
    }),
    profile: ({ item }) => {
        const segments = item.stats.surfaceSegments;
        if (!segments?.length) {
            return {};
        }
        if (!fills.has(segments)) {
            fills.set(segments, { fill: surfaceStops(segments, surfaceColors, UNKNOWN_SURFACE_COLOR) });
        }
        return fills.get(segments);
    }
};

registerRouteFeature({
    id: 'stats',
    order: 20,
    setting: { title: () => lc('road_stats'), store: routeFeatureStats },
    lenses: [surfaceLens],
    sheetCard: {
        component: () => import('~/routeFeatures/stats/RouteStatsView.svelte'),
        height: ({ item }) => (item?.route && item.stats ? STATS_HEIGHT : 0)
    },
    navSections: [
        {
            id: 'stats',
            slot: 'details',
            component: () => import('~/routeFeatures/stats/RouteStatsView.svelte'),
            height: (_scale, { item }) => (item?.stats ? ROUTE_STATS_HEIGHT + 8 : 0)
        }
    ]
});
