import { lc } from '~/helpers/locale';
import { registerRouteFeature } from '~/routeFeatures/registry';
import { routeFeatureStats } from '~/routeFeatures/stats/settings';

const STATS_HEIGHT = 164;

registerRouteFeature({
    id: 'stats',
    order: 20,
    setting: { title: () => lc('road_stats'), store: routeFeatureStats },
    sheetCard: {
        component: () => import('~/routeFeatures/stats/RouteStatsView.svelte'),
        height: ({ item }) => (item?.route && item.stats ? STATS_HEIGHT : 0)
    }
});
