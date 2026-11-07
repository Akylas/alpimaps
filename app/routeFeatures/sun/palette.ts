/** The colours of the sun lens: warm by day, cold after sunset, red where the sun blinds. Pure: nothing here may import NativeScript. */
import { shadeGrey } from '~/routeFeatures/lens/shades';
import type { LensPaletteContribution } from '~/routeFeatures/registry';
import { SUN_PALETTE_KEYS, type SunClass } from '~/routeFeatures/sun/read';

const ORDER: SunClass[] = ['day', 'overcast', 'low', 'glare', 'twilight', 'moonlit', 'night'];

const LIGHT = ['#F2C94C', '#9AA5B1', '#F2994A', '#E5484D', '#7E57C2', '#5A7BB5', '#2B3A8C'];
// every step lifted: the dark ones read as a hole on a dark map
const DARK = ['#F5D77A', '#B4BEC9', '#F5AC6E', '#F0686C', '#9B7FD6', '#7F9AD0', '#5566C2'];

// on e-ink the darker the less light: from daylight, the lightest
const EINK = [20, 50, 85, 125, 165, 190, 225].map(shadeGrey);

export const sunPalette: LensPaletteContribution = (variant) =>
    Object.fromEntries(ORDER.map((sunClass, level) => [SUN_PALETTE_KEYS[sunClass], variant === 'eink' ? EINK[level] : (variant === 'dark' ? DARK : LIGHT)[level]]));
