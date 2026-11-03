/** Steep sections and climbs, read off a route profile. Pure: nothing here may import NativeScript. */
import type { Activity } from '~/utils/routeAnalysis/types';

export type SteepPreset = 'road' | 'gravel' | 'mtb' | 'hiking';

/** Grades in %, positive numbers: a descent is steep from `steepDown` downhill. */
export interface SteepThresholds {
    steepUp: number;
    veryUp: number;
    steepDown: number;
    veryDown: number;
}

export interface SteepOptions {
    thresholds: SteepThresholds;
    /** meters; shorter runs are noise */
    minLength: number;
}

export interface ProfilePoint {
    /** meters from the start */
    d: number;
    /** elevation, m */
    a: number;
    /** grade, % */
    g?: number;
}

export interface SteepSection {
    /** indexes into the profile data */
    startIndex: number;
    endIndex: number;
    startDistance: number;
    endDistance: number;
    length: number;
    direction: 'up' | 'down';
    /** 2: past the very steep threshold on average */
    level: 1 | 2;
    /** signed %, negative on a descent */
    avgGrade: number;
    /** signed %, the steepest point */
    maxGrade: number;
    /** signed meters */
    gain: number;
}

export type ClimbCategory = 4 | 3 | 2 | 1 | 'hc';

export interface ClimbOptions {
    /** meters of elevation a climb has to gain */
    minGain: number;
    /** meters a climb may lose and still go on */
    dipTolerance: number;
    /** % */
    minAvgGrade: number;
}

export interface Climb {
    startIndex: number;
    endIndex: number;
    startDistance: number;
    endDistance: number;
    length: number;
    gain: number;
    avgGrade: number;
    maxGrade: number;
    /** absent when the climb is too small to rank */
    category?: ClimbCategory;
}

export const STEEP_PRESETS: Record<SteepPreset, SteepThresholds> = {
    road: { steepUp: 8, veryUp: 12, steepDown: 10, veryDown: 14 },
    gravel: { steepUp: 9, veryUp: 13, steepDown: 11, veryDown: 15 },
    mtb: { steepUp: 12, veryUp: 18, steepDown: 14, veryDown: 20 },
    hiking: { steepUp: 15, veryUp: 25, steepDown: 20, veryDown: 30 }
};

export const DEFAULT_STEEP_MIN_LENGTH = 100;

/** % a run may fall under the threshold that started it and still go on: larger absorbs the flanks of a wall */
const STEEP_EXIT = 1;
/** two runs closer than this (m) are one section, if the ground between them stays within `STEEP_MERGE_DROP` of the threshold */
const STEEP_MERGE_GAP = 100;
const STEEP_MERGE_DROP = 3;

/** length (m) x average grade (%) a climb needs for each category, the way Strava ranks them */
const CLIMB_CATEGORY_SCORES: [number, ClimbCategory][] = [
    [80000, 'hc'],
    [64000, 1],
    [32000, 2],
    [16000, 3],
    [8000, 4]
];

export const DEFAULT_CLIMB_OPTIONS: ClimbOptions = { minGain: 40, dipTolerance: 15, minAvgGrade: 3 };

export function presetForActivity(activity: Activity | undefined): SteepPreset {
    switch (activity?.kind) {
        case 'bike':
            if (activity.subtype === 'road') {
                return 'road';
            }
            return activity.subtype === 'mountain' || activity.subtype === 'enduro' ? 'mtb' : 'gravel';
        case 'motor':
            return 'road';
        default:
            return 'hiking';
    }
}

interface Run {
    start: number;
    end: number;
}

/** The runs of points steeper than `threshold` in the direction of `sign` (1 up, -1 down). */
function steepRuns(data: ProfilePoint[], sign: number, threshold: number): Run[] {
    const runs: Run[] = [];
    let index = 0;
    while (index < data.length) {
        if (sign * (data[index].g ?? 0) < threshold) {
            index++;
            continue;
        }
        let end = index;
        while (end + 1 < data.length && sign * (data[end + 1].g ?? 0) >= threshold - STEEP_EXIT) {
            end++;
        }
        runs.push({ start: index, end });
        index = end + 1;
    }
    return runs;
}

/** A single noisy point must not split a climb in two. */
function mergeRuns(data: ProfilePoint[], runs: Run[], sign: number, threshold: number): Run[] {
    const merged: Run[] = [];
    for (const run of runs) {
        const previous = merged[merged.length - 1];
        if (previous && data[run.start].d - data[previous.end].d < STEEP_MERGE_GAP) {
            // runs end where the next point falls out of them, so something always lies between
            let sum = 0;
            for (let index = previous.end + 1; index < run.start; index++) {
                sum += sign * (data[index].g ?? 0);
            }
            if (sum / (run.start - previous.end - 1) >= threshold - STEEP_MERGE_DROP) {
                previous.end = run.end;
                continue;
            }
        }
        merged.push({ ...run });
    }
    return merged;
}

function sectionOf(data: ProfilePoint[], { end, start }: Run, direction: SteepSection['direction'], veryThreshold: number): SteepSection {
    const sign = direction === 'up' ? 1 : -1;
    let gain = 0;
    let steepest = 0;
    for (let index = start; index <= end; index++) {
        steepest = Math.max(steepest, sign * (data[index].g ?? 0));
        if (index < end) {
            gain += (((data[index].g ?? 0) + (data[index + 1].g ?? 0)) / 2 / 100) * (data[index + 1].d - data[index].d);
        }
    }
    const length = data[end].d - data[start].d;
    const avgGrade = (gain / length) * 100;
    return {
        startIndex: start,
        endIndex: end,
        startDistance: data[start].d,
        endDistance: data[end].d,
        length,
        direction,
        level: sign * avgGrade >= veryThreshold ? 2 : 1,
        avgGrade,
        maxGrade: sign * steepest,
        gain
    };
}

/** Linear in the number of points; derived on read from the stored grade, never persisted. */
export function findSteepSections(data: ProfilePoint[], { minLength, thresholds }: SteepOptions): SteepSection[] {
    const sections: SteepSection[] = [];
    for (const [direction, sign, steep, very] of [
        ['up', 1, thresholds.steepUp, thresholds.veryUp],
        ['down', -1, thresholds.steepDown, thresholds.veryDown]
    ] as const) {
        for (const run of mergeRuns(data, steepRuns(data, sign, steep), sign, steep)) {
            const length = data[run.end].d - data[run.start].d;
            if (length > 0 && length >= minLength) {
                sections.push(sectionOf(data, run, direction, very));
            }
        }
    }
    return sections.sort((first, second) => first.startIndex - second.startIndex);
}

export function climbCategory(length: number, avgGrade: number): ClimbCategory | undefined {
    const score = length * avgGrade;
    return CLIMB_CATEGORY_SCORES.find(([minimum]) => score >= minimum)?.[1];
}

/** Valley to summit, going on through dips of up to `dipTolerance` m. */
export function findClimbs(data: ProfilePoint[], { dipTolerance, minAvgGrade, minGain }: ClimbOptions = DEFAULT_CLIMB_OPTIONS): Climb[] {
    const climbs: Climb[] = [];
    const close = (start: number, peak: number) => {
        const length = data[peak].d - data[start].d;
        const gain = data[peak].a - data[start].a;
        const avgGrade = (gain / length) * 100;
        if (length > 0 && gain >= minGain && avgGrade >= minAvgGrade) {
            let maxGrade = 0;
            for (let index = start; index <= peak; index++) {
                maxGrade = Math.max(maxGrade, data[index].g ?? 0);
            }
            climbs.push({ startIndex: start, endIndex: peak, startDistance: data[start].d, endDistance: data[peak].d, length, gain, avgGrade, maxGrade, category: climbCategory(length, avgGrade) });
        }
    };
    let start = 0;
    let peak = 0;
    for (let index = 1; index < data.length; index++) {
        if (data[index].a > data[peak].a) {
            peak = index;
        } else if (data[peak].a - data[index].a > dipTolerance) {
            close(start, peak);
            start = peak = index;
        }
        // still on the way down to the foot of the climb
        if (peak === start && data[index].a <= data[start].a) {
            start = peak = index;
        }
    }
    if (data.length > 0) {
        close(start, peak);
    }
    return climbs;
}
