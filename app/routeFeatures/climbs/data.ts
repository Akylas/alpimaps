import { formatDistance } from '~/helpers/formatter';
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
import type { AttentionMark, LensSection, LensSlice, ProfileBracket } from '~/routeFeatures/registry';
import { gradeBucketIndex } from '~/utils/grade';
import { activityOf } from '~/utils/routeAnalysis/activity';

export interface ClimbsRead {
    climbs: Climb[];
    steep: SteepSection[];
    best?: Climb;
    brackets: ProfileBracket[];
    sections: LensSection[];
    /** the ways up past the very steep threshold */
    marks: AttentionMark[];
    /** the profile's grade sections, by grade bucket */
    slices: LensSlice[];
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
        const steep = findSteepSections(data, { thresholds: STEEP_PRESETS[preset], minLength: DEFAULT_STEEP_MIN_LENGTH });
        read = {
            climbs,
            steep,
            best: bestClimb(climbs),
            brackets: climbs.map((climb) => ({ from: climb.startDistance, to: climb.endDistance, top: data[climb.endIndex].a, label: climb.category && categoryLabel(climb.category) })),
            sections: climbs.map((climb, id) => ({
                id,
                i0: climb.startIndex,
                i1: climb.endIndex,
                title: [climb.category && categoryLabel(climb.category), formatDistance(climb.length), climb.avgGrade.toFixed(1) + ' %'].filter(Boolean).join(' · ')
            })),
            marks: steep
                .filter((section) => section.direction === 'up' && section.level === 2)
                .map((section, id) => ({
                    kind: 'steep' as const,
                    lens: 'climbs' as const,
                    section: { id, i0: section.startIndex, i1: section.endIndex, title: [lc('climbs_very_steep', formatDistance(section.length)), section.avgGrade.toFixed(0) + ' %'].join(' · ') }
                })),
            slices: (item.profile.sections ?? []).map(({ endIndex, grade, startIndex }) => {
                const bucket = gradeBucketIndex(grade);
                // from 9 % it is steep, from 12 % very steep
                return { i0: startIndex, i1: endIndex, k: bucket, s: bucket >= 7 ? 3 : bucket === 6 ? 2 : 0 };
            })
        };
    }
    reads.set(data, { preset, read });
    return read;
}
