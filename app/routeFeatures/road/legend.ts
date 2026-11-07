/** What the colours and the sign of the road lens mean. Pure: nothing here may import NativeScript. */
import { SEVERITY_TICKS, legendLine } from '~/routeFeatures/lens/lensLegend';
import type { LensLegendContext, LensLegendSection } from '~/routeFeatures/registry';
import { riskKey } from '~/routeFeatures/road/palette';

/** The two levels of a fast run, then the sign that gives its speed; on e-ink the ticks tell the levels apart. */
export function roadLegend({ palette, translate, variant }: Pick<LensLegendContext, 'palette' | 'translate' | 'variant'>): LensLegendSection {
    const eink = variant === 'eink';
    return {
        id: 'route_lens',
        label: translate('lens_road'),
        items: [
            legendLine('risk_3', translate('legend_road_high'), palette[riskKey(3)], eink ? SEVERITY_TICKS[3] : undefined),
            legendLine('risk_2', translate('legend_road_medium'), palette[riskKey(2)], eink ? SEVERITY_TICKS[2] : undefined),
            {
                id: 'speed_sign',
                label: translate('legend_speed_sign'),
                kind: 'shield',
                plate: { color: '#ffffff', radius: 11, border: palette.speed_sign_rim, borderWidth: 3 },
                text: { value: '70', color: '#1b1c1d' }
            }
        ]
    };
}
