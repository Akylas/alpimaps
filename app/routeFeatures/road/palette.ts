/** The colours of the road lens: a neutral core, and the runs that are fast, amber then red. Pure: nothing here may import NativeScript. */
import type { LensPaletteContribution } from '~/routeFeatures/registry';
import type { RiskLevel } from '~/routeFeatures/road/risk';

export const ROAD_CORE_KEY = 'road_core';

/** The key of a risky run's slice: its level. */
export function riskKey(level: RiskLevel) {
    return 'risk_' + level;
}

export const ROAD_COLORS = { core: '#9AA3AE', 2: '#E08A00', 3: '#D7263D' };

export const roadPalette: LensPaletteContribution = () => ({ [ROAD_CORE_KEY]: ROAD_COLORS.core, [riskKey(2)]: ROAD_COLORS[2], [riskKey(3)]: ROAD_COLORS[3] });
