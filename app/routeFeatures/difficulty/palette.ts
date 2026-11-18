/** The colours of the difficulty lens: a ramp from easy to hard, and a neutral for what is not rated. Pure: nothing here may import NativeScript. */
import { shadeGrey } from '~/routeFeatures/lens/shades';
import type { LensPaletteContribution } from '~/routeFeatures/registry';
import { SCALE_RANGE, UNKNOWN_LEVEL } from '~/routeFeatures/difficulty/scale';

/** The key of a level's slice in the lens palette. The two scales share it: T1 and S1 are the same step of the ramp. */
export function difficultyKey(level: number) {
    return level === UNKNOWN_LEVEL ? 'difficulty_unknown' : 'difficulty_' + level;
}

const LEVELS = Array.from({ length: SCALE_RANGE.mtb.max + 1 }, (_, level) => level);

/** Green to deep purple by level, one lightness step apart where they can be told. */
export const DIFFICULTY_COLORS = ['#8FD19E', '#C5DB6A', '#F2D45C', '#F4A24A', '#EE6A52', '#C4344A', '#7A1F5C'];
/** What is not rated: not on the ramp, so never read as an easy trail. */
export const DIFFICULTY_UNKNOWN_COLOR = '#B9C2C8';

/** How dark each level is on e-ink, where colour is lost, 0 to 255: the harder, the darker. What is not rated is the lightest. */
export function difficultyShade(level: number) {
    return level === UNKNOWN_LEVEL ? 12 : 40 + level * 30;
}

export const difficultyColor = (level: number) => (level === UNKNOWN_LEVEL ? DIFFICULTY_UNKNOWN_COLOR : DIFFICULTY_COLORS[level]);

export const difficultyPalette: LensPaletteContribution = (variant) =>
    Object.fromEntries([...LEVELS, UNKNOWN_LEVEL].map((level) => [difficultyKey(level), variant === 'eink' ? shadeGrey(difficultyShade(level)) : difficultyColor(level)]));
