import { lc } from '~/helpers/locale';
import type { IItem } from '~/models/Item';
import {
    type Climb,
    type ClimbCategory,
    DEFAULT_STEEP_MIN_LENGTH,
    STEEP_PRESETS,
    type SteepPreset,
    type SteepSection,
    bestClimb,
    findClimbs,
    findSteepSections,
    presetForActivity
} from '~/routeFeatures/climbs/steep';
import type { ProfileBracket } from '~/routeFeatures/registry';
import { activityOf } from '~/utils/routeAnalysis/activity';

export interface ClimbsRead {
    climbs: Climb[];
    steep: SteepSection[];
    best?: Climb;
    /** % */
    maxGrade: number;
    brackets: ProfileBracket[];
}

export function categoryLabel(category: ClimbCategory) {
    return category === 'hc' ? 'HC' : lc('climb_category', category);
}

// the profile is replaced, never edited, so it keys what was read off it
const reads = new WeakMap<object, { preset: SteepPreset; read: ClimbsRead | null }>();

/** The climbs and steep sections of the route, `null` when its profile has no grades. Derived on read, never stored. */
export function readClimbs(item: IItem): ClimbsRead | null {
    const data = item?.profile?.data;
    if (!data?.length) {
        return null;
    }
    const preset = presetForActivity(activityOf(item, item.analysis));
    const cached = reads.get(data);
    if (cached?.preset === preset) {
        return cached.read;
    }
    let read: ClimbsRead | null = null;
    if (data.some((point) => point.g !== undefined)) {
        const climbs = findClimbs(data);
        read = {
            climbs,
            steep: findSteepSections(data, { thresholds: STEEP_PRESETS[preset], minLength: DEFAULT_STEEP_MIN_LENGTH }),
            best: bestClimb(climbs),
            maxGrade: data.reduce((max, point) => Math.max(max, point.g ?? 0), 0),
            brackets: climbs.map((climb) => ({ from: climb.startDistance, to: climb.endDistance, label: climb.category && categoryLabel(climb.category) }))
        };
    }
    reads.set(data, { preset, read });
    return read;
}
