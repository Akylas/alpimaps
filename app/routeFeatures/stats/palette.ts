/** The colours of the surface lens, one for each surface the route is on; on e-ink the grey of its shade. */
import { shadeGrey } from '~/routeFeatures/lens/shades';
import type { LensPaletteContribution } from '~/routeFeatures/registry';
import { surfaceKey, surfaceShade } from '~/routeFeatures/stats/surfaces';
import { surfaceColors } from '~/utils/routing';

export const surfacePalette: LensPaletteContribution = (variant) =>
    Object.fromEntries(Object.entries(surfaceColors).map(([id, color]) => [surfaceKey(id), variant === 'eink' ? shadeGrey(surfaceShade(id)) : color]));
