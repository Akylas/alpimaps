import { get } from 'svelte/store';
import { convertElevation, formatDistance } from '~/helpers/formatter';
import { lc } from '~/helpers/locale';
import type { IItem } from '~/models/Item';
import { climbsCategories, climbsMinLength, climbsPreset, climbsSettingsKey, climbsSteepDown, climbsSteepUp } from '~/routeFeatures/climbs/settings';
import {
    type Climb,
    type ClimbCategory,
    type SteepSection,
    type SteepThresholds,
    bestClimb,
    climbPlates,
    findClimbs,
    findSteepSections,
    isSteepPreset,
    presetForActivity,
    resolveThresholds,
    sortByDifficulty,
    steepAlerts
} from '~/routeFeatures/climbs/steep';
import { STEEP_MARK_COLOR, gradeKey } from '~/routeFeatures/climbs/palette';
import type { AttentionMark, LensSection, LensSlice, LensSymbol, NavAlert, ProfileBracket } from '~/routeFeatures/registry';
import { buildGradeSections, gradeBucketIndex } from '~/utils/grade';
import { activityOf } from '~/utils/routeAnalysis/activity';

export interface ClimbsRead {
    climbs: Climb[];
    /** in route order */
    steep: SteepSection[];
    thresholds: SteepThresholds;
    best?: Climb;
    brackets: ProfileBracket[];
    sections: LensSection[];
    /** every steep way up, the very list the steep sections show */
    marks: AttentionMark[];
    /** the profile's grade sections, by grade bucket */
    slices: LensSlice[];
    /** the category of each ranked climb, on its summit */
    symbols: LensSymbol[];
    /** while following the route: the steep sections, with their grade at the start */
    alerts: NavAlert[];
    gradePlates: LensSymbol[];
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
    const thresholds = resolveThresholds(preset, { steepUp: get(climbsSteepUp), steepDown: get(climbsSteepDown) });
    const minLength = get(climbsMinLength);
    const categories = get(climbsCategories);
    let read: ClimbsRead | null = null;
    if (data.some((point) => point.g !== undefined)) {
        const found = findClimbs(data);
        // a ranking switched off takes the plates with it
        const climbs = categories ? found : found.map((climb) => ({ ...climb, category: undefined }));
        const steep = findSteepSections(data, { thresholds, minLength });
        const steepFollowing = steepAlerts(steep);
        read = {
            climbs,
            steep,
            thresholds,
            best: bestClimb(climbs),
            brackets: climbs.map((climb) => ({ from: climb.startDistance, to: climb.endDistance, top: data[climb.endIndex].a, label: climb.category && categoryLabel(climb.category) })),
            sections: climbs.map((climb, id) => ({
                id,
                i0: climb.startIndex,
                i1: climb.endIndex,
                title: [climb.category && categoryLabel(climb.category), formatDistance(climb.length), climb.avgGrade.toFixed(1) + ' %'].filter(Boolean).join(' · ')
            })),
            marks: steep
                .filter((section) => section.direction === 'up')
                .map((section, id) => ({
                    kind: 'steep' as const,
                    color: STEEP_MARK_COLOR,
                    lens: 'climbs' as const,
                    section: { id, i0: section.startIndex, i1: section.endIndex, title: steepTitle(section) }
                })),
            // two lines: the category and what the climb gains
            symbols: climbPlates(climbs, (climb) => ({ label: `${categoryLabel(climb.category)}\n+${convertElevation(climb.gain)}` })),
            alerts: steepFollowing.alerts,
            gradePlates: steepFollowing.plates,
            // a profile saved before its grade sections were kept has none: cut it again from its grades
            slices: (
                item.profile.sections ??
                buildGradeSections(
                    data,
                    data.map((point) => point.g ?? 0)
                )
            ).map(({ endIndex, grade, startIndex }) => {
                const bucket = gradeBucketIndex(grade);
                // from 9 % it is steep, from 12 % very steep
                return { i0: startIndex, i1: endIndex, k: gradeKey(bucket), s: bucket >= 7 ? 3 : bucket === 6 ? 2 : 0 };
            })
        };
    }
    reads.set(data, { key, read });
    return read;
}

/** What a focused steep section says, on the profile's mark and in the list. */
export function steepTitle(section: SteepSection) {
    return [lc(section.direction === 'down' ? 'climbs_steep_descent' : 'climbs_steep', formatDistance(section.length)), Math.abs(section.avgGrade).toFixed(0) + ' %'].join(' · ');
}

/** The longest and the biggest gain of the steep sections: every row's ramp is drawn to this one scale. */
export interface SteepScale {
    length: number;
    gain: number;
}

/** A row of the climbs list: a climb, the steep sections' header, a steep section. */
export type ClimbsRowData =
    | { type: 'climb'; climb: Climb; id: number }
    | { type: 'header'; count: number }
    | { type: 'steep'; section: SteepSection; id: number; scale: SteepScale; chevrons: 1 | 2 | 3 };

/** 4 % over the threshold per chevron: how far past steep the section is, whatever the activity. */
const CHEVRON_STEP = 4;

/** The climbs, then the steep sections, hardest first, under their header, listed only while open. */
export function climbsRows(read: ClimbsRead | null, steepOpen: boolean): ClimbsRowData[] {
    const steep = read?.steep ?? [];
    const scale: SteepScale = {
        length: Math.max(1, ...steep.map((section) => section.length)),
        gain: Math.max(1, ...steep.map((section) => Math.abs(section.gain)))
    };
    const chevrons = (section: SteepSection): 1 | 2 | 3 => {
        const over = Math.abs(section.avgGrade) - (section.direction === 'up' ? read.thresholds.steepUp : read.thresholds.steepDown);
        return over >= CHEVRON_STEP * 2 ? 3 : over >= CHEVRON_STEP ? 2 : 1;
    };
    return [
        ...(read?.climbs ?? []).map((climb, id): ClimbsRowData => ({ type: 'climb', climb, id })),
        ...(steep.length ? [{ type: 'header' as const, count: steep.length }] : []),
        ...(steepOpen ? sortByDifficulty(steep).map((section): ClimbsRowData => ({ type: 'steep', section, id: steep.indexOf(section), scale, chevrons: chevrons(section) })) : [])
    ];
}
