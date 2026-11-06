/** What the colours and the plate of the weather lens mean. Pure: nothing here may import NativeScript. */
import { SEVERITY_TICKS, legendLine } from '~/routeFeatures/lens/lensLegend';
import { RAIN_PALETTE_KEYS } from '~/routeFeatures/weather/data/rain';
import type { LensLegendContext, LensLegendSection } from '~/routeFeatures/registry';

/** The four rain classes in the colours the map draws them, then the weather plate; on e-ink the ticks of how hard it rains, none for dry. */
export function weatherLegend({ palette, translate, variant }: Pick<LensLegendContext, 'palette' | 'translate' | 'variant'>): LensLegendSection {
    const ticks = (severity: 1 | 2 | 3) => (variant === 'eink' ? SEVERITY_TICKS[severity] : undefined);
    const [dry, light, steady, heavy] = RAIN_PALETTE_KEYS;
    return {
        id: 'route_lens',
        label: translate('lens_weather'),
        items: [
            legendLine('dry', translate('legend_dry'), palette[dry]),
            legendLine('rain_light', translate('legend_rain_light'), palette[light], ticks(1)),
            legendLine('rain', translate('legend_rain'), palette[steady], ticks(2)),
            legendLine('rain_heavy', translate('legend_rain_heavy'), palette[heavy], ticks(3)),
            {
                id: 'weather_plate',
                label: translate('legend_weather_plate'),
                kind: 'shield',
                plate: { color: '#ffffff', border: palette[heavy], borderWidth: 1.5, radius: 9 },
                text: { value: '7°', color: '#1b1c1d' }
            }
        ]
    };
}
