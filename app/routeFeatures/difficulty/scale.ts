/** The difficulty scales of a trail: which one a route is read on, and what a level is. Pure: nothing here may import NativeScript. */
import type { Activity } from '~/utils/routeAnalysis/types';

/** `sac`: OSM `sac_scale`, T1 to T6 (hiking). `mtb`: OSM `mtb:scale`, S0 to S6. */
export type DifficultyScale = 'sac' | 'mtb';

/** An edge with no tag: not rated, which is not the same as easy. */
export const UNKNOWN_LEVEL = -1;

/** The levels each scale has, lowest and highest. */
export const SCALE_RANGE: Record<DifficultyScale, { min: number; max: number }> = {
    sac: { min: 1, max: 6 },
    mtb: { min: 0, max: 6 }
};

/** The comfort level before the user sets one: what is above it is counted as hard. */
export const DEFAULT_COMFORT: Record<DifficultyScale, number> = { sac: 2, mtb: 2 };

/** What a route is read on, from its activity: a hike on the sac scale, any bike on the mtb one. A motor route, or none, has no scale. */
export function scaleForActivity(activity: Activity | undefined): DifficultyScale | undefined {
    return activity?.kind === 'hike' ? 'sac' : activity?.kind === 'bike' ? 'mtb' : undefined;
}

function levelIn(scale: DifficultyScale, level: number) {
    const { max, min } = SCALE_RANGE[scale];
    return Number.isInteger(level) && level >= min && level <= max ? level : UNKNOWN_LEVEL;
}

/** The level of a Valhalla edge's `sac_scale`: 0 is no tag. */
export function sacLevel(value: number | undefined): number {
    return levelIn('sac', value);
}

/** The level of a tile's `mtb_scale`, a string that may carry a suffix (`2+`). */
export function mtbLevel(value: string | number | undefined): number {
    const level = typeof value === 'number' ? value : parseInt(value, 10);
    return levelIn('mtb', level);
}

export function levelLabel(scale: DifficultyScale, level: number): string {
    return (scale === 'sac' ? 'T' : 'S') + level;
}
