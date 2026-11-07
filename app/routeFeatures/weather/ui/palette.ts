/** The colours of the weather lens: rain in blue, darker the harder it rains. Pure: nothing here may import NativeScript. */
import { RAIN_PALETTE_KEYS } from '~/routeFeatures/weather/data/rain';
import { shadeGrey } from '~/routeFeatures/lens/shades';
import type { LensPaletteContribution } from '~/routeFeatures/registry';

const LIGHT = ['#8D96A3', '#90CAF9', '#42A5F5', '#1565C0'];
// every step lifted: the light ones read as a hole on a dark map
const DARK = ['#5C6570', '#A9D4FA', '#64B5F6', '#3F8FE0'];

// on e-ink the harder it rains, the darker: from nearly none
const EINK = [25, 70, 120, 175].map(shadeGrey);

export const rainPalette: LensPaletteContribution = (variant) =>
    Object.fromEntries(RAIN_PALETTE_KEYS.map((key, level) => [key, variant === 'eink' ? EINK[level] : (variant === 'dark' ? DARK : LIGHT)[level]]));
