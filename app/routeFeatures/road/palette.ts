/** The colours of the road lens: a neutral core, and the runs that are fast, amber then red. Pure: nothing here may import NativeScript. */
import type { LensPaletteContribution } from '~/routeFeatures/registry';
import { shadeGrey } from '~/routeFeatures/lens/shades';
import type { RiskLevel } from '~/routeFeatures/road/risk';

export const ROAD_CORE_KEY = 'road_core';

/** The key of a risky run's slice: its level. */
export function riskKey(level: RiskLevel) {
    return 'risk_' + level;
}

/** The marks of fast roads under the profile: a hue of their own, away from the reds of the steep marks. */
export const ROAD_MARK_COLOR = '#7E3FD0';

/** How dark each is on e-ink, where colour is lost, 0 to 255: the more it warns of, the darker. */
export const ROAD_SHADES = { core: 30, 2: 100, 3: 170 };
export const ROAD_EINK = { core: shadeGrey(ROAD_SHADES.core), 2: shadeGrey(ROAD_SHADES[2]), 3: shadeGrey(ROAD_SHADES[3]) };

export const ROAD_COLORS = { core: '#9AA3AE', 2: '#E08A00', 3: '#D7263D' };

export const roadPalette: LensPaletteContribution = (variant) => {
    const colors = variant === 'eink' ? ROAD_EINK : ROAD_COLORS;
    return { [ROAD_CORE_KEY]: colors.core, [riskKey(2)]: colors[2], [riskKey(3)]: colors[3] };
};

/** What a share of the route is drawn in, by `RoadShareId`; on e-ink, black, greys and a light one. */
export const ROAD_SHARE_COLORS = { high: ROAD_COLORS[3], medium: ROAD_COLORS[2], rest: ROAD_COLORS.core, unknown: '#E3E7EA' };
export const ROAD_SHARE_EINK = { high: ROAD_EINK[3], medium: ROAD_EINK[2], rest: ROAD_EINK.core, unknown: shadeGrey(12) };
