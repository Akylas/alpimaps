import { get } from 'svelte/store';
import { formatDistance } from '~/helpers/formatter';
import { lc } from '~/helpers/locale';
import type { IItem } from '~/models/Item';
import { climbsCategories, climbsMinLength, climbsPreset, climbsSettingsKey, climbsSteepDown, climbsSteepUp, climbsVerySteepDown, climbsVerySteepUp } from '~/routeFeatures/climbs/settings';
import { type Climb, type ClimbCategory, type SteepSection, bestClimb, findClimbs, findSteepSections, isSteepPreset, presetForActivity, resolveThresholds } from '~/routeFeatures/climbs/steep';
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

// the profile is replaced, never edited, so it keys what was read off it, along with the settings it was read with
let settingsKey = '';
climbsSettingsKey.subscribe((key) => (settingsKey = key));
const reads = new WeakMap<object, { key: string; read: ClimbsRead | null }>();

/** The climbs and steep sections of the route, `null` when its profile has no grades. Derived on read, never stored. */
export function readClimbs(item: IItem): ClimbsRead | null {
    const data = item?.profile?.data;
    if (!data?.length) {
        return null;
    }
    // the settings are read once they have changed, not on each of the calls a render makes
    const chosen = get(climbsPreset);
    const preset = isSteepPreset(chosen) ? chosen : presetForActivity(activityOf(item, item.analysis));
    const key = `${settingsKey}|${preset}`;
    const cached = reads.get(data);
    if (cached?.key === key) {
        return cached.read;
    }
    const thresholds = resolveThresholds(preset, {
        steepUp: get(climbsSteepUp),
        veryUp: get(climbsVerySteepUp),
        steepDown: get(climbsSteepDown),
        veryDown: get(climbsVerySteepDown)
    });
    const minLength = get(climbsMinLength);
    const categories = get(climbsCategories);
    let read: ClimbsRead | null = null;
    if (data.some((point) => point.g !== undefined)) {
        const found = findClimbs(data);
        // a ranking switched off takes the plates with it
        const climbs = categories ? found : found.map((climb) => ({ ...climb, category: undefined }));
        const steep = findSteepSections(data, { thresholds, minLength });
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
    reads.set(data, { key, read });
    return read;
}

/** A row of the climbs list: a climb, the steep sections' header, a steep section. */
export type ClimbsRowData = { type: 'climb'; climb: Climb; id: number } | { type: 'header'; count: number } | { type: 'steep'; section: SteepSection; id: number };

/** The climbs, then the steep sections under their header, listed only while open. */
export function climbsRows(read: ClimbsRead | null, steepOpen: boolean): ClimbsRowData[] {
    return [
        ...(read?.climbs ?? []).map((climb, id): ClimbsRowData => ({ type: 'climb', climb, id })),
        ...(read?.steep.length ? [{ type: 'header' as const, count: read.steep.length }] : []),
        ...(steepOpen ? (read?.steep ?? []).map((section, id): ClimbsRowData => ({ type: 'steep', section, id })) : [])
    ];
}
