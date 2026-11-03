import { formatDistance } from '~/helpers/formatter';
import { lc } from '~/helpers/locale';
import { registerRouteFeature } from '~/routeFeatures/registry';
import { navigationShowSurface, navigationSurfaceSpan } from '~/stores/navigationStore';
import { NAVIGATION_AHEAD_HEIGHT } from '~/utils/navigation';

registerRouteFeature({
    id: 'surface',
    order: 15,
    setting: { title: () => lc('navigation_show_surface'), store: navigationShowSurface },
    settings: () => [
        {
            type: 'slider',
            store: navigationSurfaceSpan,
            title: lc('navigation_surface_span'),
            description: lc('navigation_surface_span_desc'),
            min: 500,
            max: 20000,
            step: 500,
            format: formatDistance
        }
    ],
    navSections: [
        {
            id: 'surface',
            slot: 'ahead',
            weight: 2,
            component: () => import('~/routeFeatures/surface/NavigationSurface.svelte'),
            height: (scale, { item }) => (item?.stats?.surfaceSegments?.length > 0 || item?.stats?.surfaces?.length > 0 ? Math.round(NAVIGATION_AHEAD_HEIGHT * scale) : 0)
        }
    ]
});
