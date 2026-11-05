/** Steep sections and climbs, read off a route profile. Pure: nothing here may import NativeScript. */
import type { LensSymbol, NavAlert } from '~/routeFeatures/registry';
import type { Activity } from '~/utils/routeAnalysis/types';

export type SteepPreset = 'road' | 'gravel' | 'mtb' | 'hiking';

/** Grades in %, positive numbers: a descent is steep from `steepDown` downhill. */
export interface SteepThresholds {
    steepUp: number;
    steepDown: number;
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
    /** how hard it is, grade and length together, see `steepDifficulty` */
    difficulty: number;
    tier: DifficultyTier;
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

/** 1 moderate, 3 hard */
export type DifficultyTier = 1 | 2 | 3;

export const STEEP_PRESETS: Record<SteepPreset, SteepThresholds> = {
    road: { steepUp: 12, steepDown: 10 },
    gravel: { steepUp: 13, steepDown: 11 },
    mtb: { steepUp: 16, steepDown: 14 },
    hiking: { steepUp: 20, steepDown: 20 }
};

export function isSteepPreset(value: string): value is SteepPreset {
    return Object.prototype.hasOwnProperty.call(STEEP_PRESETS, value);
}

/** The preset's thresholds, with the values the user set over them: a value that is not above 0 is not set. */
export function resolveThresholds(preset: SteepPreset, overrides: Partial<SteepThresholds>): SteepThresholds {
    const base = STEEP_PRESETS[preset];
    const pick = (key: keyof SteepThresholds) => (overrides[key] > 0 ? overrides[key] : base[key]);
    return { steepUp: pick('steepUp'), steepDown: pick('steepDown') };
}

/** score from which a section is hard, then moderate; under that it is the easy end of steep */
const TIER_SCORES: [number, DifficultyTier][] = [
    [1.2, 3],
    [0.5, 2]
];

/**
 * The FIETS climb index without its altitude term: gain² / (length × 10), meters. The grade counts twice and
 * the length once, so 800 m at 14 % (1.57) is harder than 150 m at 16 % (0.38).
 */
export function steepDifficulty(length: number, gain: number): number {
    return length > 0 ? (gain * gain) / (length * 10) : 0;
}

export function difficultyTier(difficulty: number): DifficultyTier {
    return TIER_SCORES.find(([minimum]) => difficulty >= minimum)?.[1] ?? 1;
}

/** The ways up hardest first, then the descents hardest first. A new array: the sections stay in route order. */
export function sortByDifficulty(sections: SteepSection[]): SteepSection[] {
    return [...sections].sort((first, second) => (first.direction === second.direction ? second.difficulty - first.difficulty : first.direction === 'up' ? -1 : 1));
}

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

function sectionOf(data: ProfilePoint[], { end, start }: Run, direction: SteepSection['direction']): SteepSection {
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
    const difficulty = steepDifficulty(length, gain);
    return {
        startIndex: start,
        endIndex: end,
        startDistance: data[start].d,
        endDistance: data[end].d,
        length,
        direction,
        difficulty,
        tier: difficultyTier(difficulty),
        avgGrade,
        maxGrade: sign * steepest,
        gain
    };
}

/** Linear in the number of points; derived on read from the stored grade, never persisted. */
export function findSteepSections(data: ProfilePoint[], { minLength, thresholds }: SteepOptions): SteepSection[] {
    const sections: SteepSection[] = [];
    for (const [direction, sign, steep] of [
        ['up', 1, thresholds.steepUp],
        ['down', -1, thresholds.steepDown]
    ] as const) {
        for (const run of mergeRuns(data, steepRuns(data, sign, steep), sign, steep)) {
            const length = data[run.end].d - data[run.start].d;
            if (length > 0 && length >= minLength) {
                sections.push(sectionOf(data, run, direction));
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

const CATEGORY_RANK: (ClimbCategory | undefined)[] = ['hc', 1, 2, 3, 4, undefined];

/** The hardest category, then the biggest gain. */
export function bestClimb(climbs: Climb[]): Climb | undefined {
    return climbs.reduce<Climb | undefined>((best, climb) => {
        if (!best) {
            return climb;
        }
        const rank = CATEGORY_RANK.indexOf(climb.category) - CATEGORY_RANK.indexOf(best.category);
        return rank < 0 || (rank === 0 && climb.gain > best.gain) ? climb : best;
    }, undefined);
}

/** What the map shows of the steep sections while following the route: chevrons on them and their grade at the start. */
export function steepAlerts(steep: SteepSection[]): { alerts: NavAlert[]; plates: LensSymbol[] } {
    const severity = (section: SteepSection) => (section.tier === 3 ? 3 : 2);
    return {
        alerts: steep.map((section) => ({ kind: 'steep' as const, i0: section.startIndex, i1: section.endIndex, s: severity(section) })),
        plates: steep.map((section) => ({ sym: 'grade' as const, i: section.startIndex, t: Math.abs(section.avgGrade).toFixed(0) + ' %', s: severity(section), p: 50 }))
    };
}

// Material Design Icons `menu-down`, a triangle: the app's icon font is the one the map labels have for sure
const MDI_MENU_DOWN = String.fromCodePoint(0xf035d);

// a plate of a harder ranking wins the place; high, so a label next to it does not take it
const CATEGORY_PRIORITY: Record<ClimbCategory, number> = { hc: 100, 1: 90, 2: 80, 3: 70, 4: 60 };

/**
 * A plate in the middle of each ranked climb, `describe` wording it, with a tip under it pointing at the route:
 * the plate is a label and has no tail of its own.
 */
export function climbPlates(climbs: Climb[], describe: (climb: Climb) => { t: string; t2?: string }): LensSymbol[] {
    return climbs
        .filter((climb) => climb.category !== undefined)
        .flatMap((climb) => {
            const vertex = Math.round((climb.startIndex + climb.endIndex) / 2);
            const priority = CATEGORY_PRIORITY[climb.category];
            return [
                { sym: 'climb' as const, i: vertex, ...describe(climb), s: 0 as const, p: priority },
                { sym: 'climbtip' as const, i: vertex, t: MDI_MENU_DOWN, s: 0 as const, p: priority }
            ];
        });
}
