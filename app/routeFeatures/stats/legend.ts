/** What the colours of the surface lens mean: the surfaces of the route. Pure: nothing here may import NativeScript. */
import { legendLine } from '~/routeFeatures/lens/lensLegend';
import { surfaceKey } from '~/routeFeatures/stats/surfaces';
import type { LensLegendSection } from '~/routeFeatures/registry';

// what the style draws a surface the palette has no colour for
const UNKNOWN_SURFACE = '#8D96A3';

/** The surfaces of the route, in the colour the map draws them. None when the route has none. */
export function surfaceLegend({ palette, surfaces, translate }: { palette: Record<string, string>; surfaces: string[]; translate: (key: string) => string }): LensLegendSection | null {
    if (!surfaces.length) {
        return null;
    }
    return { id: 'route_lens', label: translate('lens_surface'), items: surfaces.map((id) => legendLine(surfaceKey(id), translate(id), palette[surfaceKey(id)] ?? UNKNOWN_SURFACE)) };
}
