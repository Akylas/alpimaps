/** What the colours of the difficulty lens mean. Pure: nothing here may import NativeScript. */
import { legendLine } from '~/routeFeatures/lens/lensLegend';
import { difficultyColor, difficultyKey, difficultyShade } from '~/routeFeatures/difficulty/palette';
import type { DifficultyRead } from '~/routeFeatures/difficulty/read';
import { type DifficultyScale, UNKNOWN_LEVEL, levelLabel, levelName } from '~/routeFeatures/difficulty/scale';
import { shadeGrey } from '~/routeFeatures/lens/shades';
import type { LensLegendContext, LensLegendSection, LensPaletteVariant, ProfileLegendEntry } from '~/routeFeatures/registry';

/** The levels of the route, the hardest first and what is not rated last, in the colour the map draws them. None when the route has none. */
export function difficultyLegend({
    levels,
    palette,
    scale,
    translate,
    variant
}: Pick<LensLegendContext, 'palette' | 'translate'> & { variant?: LensPaletteVariant; scale: DifficultyScale; levels: number[] }): LensLegendSection | null {
    if (!levels.length) {
        return null;
    }
    const ordered = [...new Set(levels)].sort((first, second) => (first === UNKNOWN_LEVEL ? 1 : second === UNKNOWN_LEVEL ? -1 : second - first));
    return {
        id: 'route_lens',
        label: translate('lens_difficulty'),
        items: ordered.map((level) => legendLine(difficultyKey(level), levelName(scale, level, translate), palette[difficultyKey(level)] ?? difficultyColor(UNKNOWN_LEVEL), variant))
    };
}

/** Under the profile: the levels, each with how far the route is on it; on e-ink the greys of the fill. */
export function difficultyProfileLegend(levels: DifficultyRead['byLevel'], scale: DifficultyScale, translate: (key: string) => string, distance: (meters: number) => string): ProfileLegendEntry[] {
    return levels.map(({ level, meters }) => ({
        label: `${level === UNKNOWN_LEVEL ? translate('difficulty_unknown') : levelLabel(scale, level)} · ${distance(meters)}`,
        color: difficultyColor(level),
        eink: shadeGrey(difficultyShade(level))
    }));
}
