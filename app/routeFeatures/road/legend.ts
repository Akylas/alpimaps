/** What the colours and the sign of the road lens mean. Pure: nothing here may import NativeScript. */
import { legendLine } from '~/routeFeatures/lens/lensLegend';
import type { LensLegendContext, LensLegendSection, ProfileLegendEntry } from '~/routeFeatures/registry';
import { ROAD_COLORS, ROAD_EINK, riskKey } from '~/routeFeatures/road/palette';

/** The two levels of a fast run, then the sign that gives its speed; on e-ink the levels are two greys. */
export function roadLegend({ palette, translate, variant }: Pick<LensLegendContext, 'palette' | 'translate' | 'variant'>): LensLegendSection {
    return {
        id: 'route_lens',
        label: translate('lens_road'),
        items: [
            legendLine('risk_3', translate('legend_road_high'), palette[riskKey(3)], variant),
            legendLine('risk_2', translate('legend_road_medium'), palette[riskKey(2)], variant),
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

/** Under the profile: the levels the route has, then the rest of the road, in the colours of the fill. */
export function roadProfileLegend(levels: { high: boolean; medium: boolean }, translate: (key: string) => string): ProfileLegendEntry[] {
    return [
        ...(levels.high ? [{ label: translate('road_level_high'), color: ROAD_COLORS[3], eink: ROAD_EINK[3] }] : []),
        ...(levels.medium ? [{ label: translate('road_level_medium'), color: ROAD_COLORS[2], eink: ROAD_EINK[2] }] : []),
        { label: translate('road_bar_rest'), color: ROAD_COLORS.core, eink: ROAD_EINK.core }
    ];
}
