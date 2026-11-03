import { lc } from '~/helpers/locale';
import { registerRouteFeature } from '~/routeFeatures/registry';
import { routeFeatureStats } from '~/routeFeatures/stats/settings';
import { ROUTE_STATS_HEIGHT } from '~/utils/navigation';

const STATS_HEIGHT = 164;

registerRouteFeature({
    id: 'stats',
    order: 20,
    setting: { title: () => lc('road_stats'), store: routeFeatureStats },
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
