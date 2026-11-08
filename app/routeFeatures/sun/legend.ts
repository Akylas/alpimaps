/** What the colours of the sun lens mean. Pure: nothing here may import NativeScript. */
import { legendLine } from '~/routeFeatures/lens/lensLegend';
import type { LensLegendContext, LensLegendSection } from '~/routeFeatures/registry';
import { SUN_CLASS_ORDER, SUN_PALETTE_KEYS } from '~/routeFeatures/sun/read';

/** The six classes in the colours the map draws them; on e-ink the greys of how little light there is. */
export function sunLegend({ palette, translate, variant }: Pick<LensLegendContext, 'palette' | 'translate' | 'variant'>): LensLegendSection {
    return {
        id: 'route_lens',
        label: translate('lens_sun'),
        items: SUN_CLASS_ORDER.map((sunClass) => legendLine(`sun_${sunClass}`, translate(`legend_sun_${sunClass}`), palette[SUN_PALETTE_KEYS[sunClass]], variant))
    };
}
