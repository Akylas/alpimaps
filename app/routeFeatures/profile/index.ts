import { get } from 'svelte/store';
import { lc } from '~/helpers/locale';
import { profileSettingRows, routeFeatureProfile } from '~/routeFeatures/profile/settings';
import { registerRouteFeature } from '~/routeFeatures/registry';
import { navigationShowElevationChart } from '~/stores/navigationStore';
import { NAVIGATION_AHEAD_HEIGHT, ROUTE_PROFILE_HEIGHT } from '~/utils/navigation';

// the lens card: lens bar 44, insight 40, the chart and its axis, the gap above it
const PROFILE_HEIGHT = 246;

registerRouteFeature({
    id: 'profile',
    order: 10,
    setting: { title: () => lc('elevation_profile'), store: routeFeatureProfile },
    settings: profileSettingRows,
    // the navigation setting for the chart widget
    changes: navigationShowElevationChart,
    sheetCard: {
        component: () => import('~/routeFeatures/lens/RouteLensCard.svelte'),
        height: ({ item }) => (item?.route && item.profile?.data?.length > 0 ? PROFILE_HEIGHT : 0),
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
