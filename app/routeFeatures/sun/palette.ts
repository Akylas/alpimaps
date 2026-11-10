/** The colours of the sun lens: warm by day, cold after sunset, red where the sun blinds. Pure: nothing here may import NativeScript. */
import { shadeGrey } from '~/routeFeatures/lens/shades';
import type { LensPaletteContribution } from '~/routeFeatures/registry';
import { SUN_COLORS } from '~/routeFeatures/sun/colors';
import { SUN_CLASS_ORDER, SUN_PALETTE_KEYS } from '~/routeFeatures/sun/read';
import { SUN_EVENT_PALETTE_KEYS } from '~/routeFeatures/sun/symbols';

const LIGHT = ['#F2C94C', '#9AA5B1', '#5F7D95', '#F2994A', '#E5484D', '#7E57C2', '#5A7BB5', '#2B3A8C'];
// every step lifted: the dark ones read as a hole on a dark map
const DARK = ['#F5D77A', '#B4BEC9', '#8CA6BC', '#F5AC6E', '#F0686C', '#9B7FD6', '#7F9AD0', '#5566C2'];

// on e-ink the darker the less light: from daylight, the lightest
const EINK = [20, 45, 70, 95, 130, 165, 195, 225].map(shadeGrey);
// the glyph of a sunrise or sunset marker, over the map's light halo: the colours of the chips, a grey on e-ink
const EVENT_RIM = { light: SUN_COLORS, dark: SUN_COLORS, eink: { sunrise: shadeGrey(110), sunset: shadeGrey(180) } };

export const sunPalette: LensPaletteContribution = (variant) => ({
    ...Object.fromEntries(SUN_CLASS_ORDER.map((sunClass, level) => [SUN_PALETTE_KEYS[sunClass], variant === 'eink' ? EINK[level] : (variant === 'dark' ? DARK : LIGHT)[level]])),
    [SUN_EVENT_PALETTE_KEYS.sunrise]: EVENT_RIM[variant].sunrise,
    [SUN_EVENT_PALETTE_KEYS.sunset]: EVENT_RIM[variant].sunset
});
