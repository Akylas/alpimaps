/** The colours of the surface lens, one for each surface the route is on. */
import type { LensPaletteContribution } from '~/routeFeatures/registry';
import { surfaceKey } from '~/routeFeatures/stats/surfaces';
import { surfaceColors } from '~/utils/routing';

export const surfacePalette: LensPaletteContribution = () => Object.fromEntries(Object.entries(surfaceColors).map(([id, color]) => [surfaceKey(id), color]));
