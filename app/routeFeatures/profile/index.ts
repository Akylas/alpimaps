import { get } from 'svelte/store';
import { lc } from '~/helpers/locale';
import { profileSettingRows, routeFeatureProfile } from '~/routeFeatures/profile/settings';
import { registerRouteFeature } from '~/routeFeatures/registry';
import { navigationShowElevationChart } from '~/stores/navigationStore';
import { NAVIGATION_AHEAD_HEIGHT, ROUTE_LENS_CARD_HEIGHT, ROUTE_PROFILE_HEIGHT } from '~/utils/navigation';

registerRouteFeature({
    id: 'profile',
    order: 10,
    setting: { title: () => lc('elevation_profile'), store: routeFeatureProfile },
    settings: profileSettingRows,
    // the navigation setting for the chart widget
    changes: navigationShowElevationChart,
    sheetCard: {
        component: () => import('~/routeFeatures/lens/RouteLensCard.svelte'),
        height: ({ item }, gap) => (item?.route && item.profile?.data?.length > 0 ? ROUTE_LENS_CARD_HEIGHT + gap : 0),
        followsPosition: true
    },
    navSections: [
        {
            id: 'profile-ahead',
            slot: 'ahead',
            weight: 3,
            component: () => import('~/routeFeatures/profile/NavigationElevationChart.svelte'),
            height: (scale, { item }) => (get(navigationShowElevationChart) && item?.profile?.data?.length > 0 ? Math.round(NAVIGATION_AHEAD_HEIGHT * scale) : 0)
        },
        {
            id: 'profile',
            slot: 'details',
            component: () => import('~/routeFeatures/profile/NavSection.svelte'),
            height: (_scale, { item }) => (item?.profile?.data?.length > 0 ? ROUTE_PROFILE_HEIGHT + 8 : 0)
        }
    ]
});
