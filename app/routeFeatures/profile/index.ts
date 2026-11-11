import { lc } from '~/helpers/locale';
import { profileSettingRows, routeFeatureProfile } from '~/routeFeatures/profile/settings';
import { registerRouteFeature } from '~/routeFeatures/registry';
import { ROUTE_LENS_CARD_HEIGHT, ROUTE_PROFILE_HEIGHT } from '~/utils/navigation';

registerRouteFeature({
    id: 'profile',
    order: 10,
    setting: { title: () => lc('elevation_profile'), store: routeFeatureProfile },
    settings: profileSettingRows,
    sheetCard: {
        component: () => import('~/routeFeatures/lens/RouteLensCard.svelte'),
        height: ({ item }, gap) => (item?.route && item.profile?.data?.length > 0 ? ROUTE_LENS_CARD_HEIGHT + gap : 0),
        followsPosition: true
    },
    navPages: [
        {
            id: 'profile',
            label: () => lc('navigation_page_profile'),
            component: () => import('~/routeFeatures/profile/ProfilePage.svelte'),
            available: ({ item }) => item?.profile?.data?.length > 0
        }
    ],
    navSections: [
        {
            id: 'profile',
            component: () => import('~/routeFeatures/profile/NavSection.svelte'),
            height: (_scale, { item }) => (item?.profile?.data?.length > 0 ? ROUTE_PROFILE_HEIGHT + 8 : 0)
        }
    ]
});
