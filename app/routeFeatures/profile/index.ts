import { lc } from '~/helpers/locale';
import { routeFeatureProfile } from '~/routeFeatures/profile/settings';
import { registerRouteFeature } from '~/routeFeatures/registry';

// the chart's height includes the band its selected point strip lives in
const PROFILE_HEIGHT = 215;

registerRouteFeature({
    id: 'profile',
    order: 10,
    setting: { title: () => lc('elevation_profile'), store: routeFeatureProfile },
    sheetCard: {
        component: () => import('~/routeFeatures/profile/SheetCard.svelte'),
        height: ({ item }) => (item?.route && item.profile?.data?.length > 0 ? PROFILE_HEIGHT : 0),
        followsPosition: true
    }
});
