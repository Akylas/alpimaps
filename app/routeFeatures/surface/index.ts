import { lc } from '~/helpers/locale';
import { registerRouteFeature } from '~/routeFeatures/registry';

registerRouteFeature({
    id: 'surface',
    order: 15,
    navPages: [
        {
            id: 'surface',
            label: () => lc('navigation_page_surface'),
            component: () => import('~/routeFeatures/surface/SurfacePage.svelte'),
            available: ({ detour, item }) => !detour && (item?.stats?.surfaceSegments?.length > 0 || item?.stats?.surfaces?.length > 0)
        }
    ]
});
