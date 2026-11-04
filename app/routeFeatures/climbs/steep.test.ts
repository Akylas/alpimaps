import { describe, expect, it } from 'vitest';
import type { Activity } from '~/utils/routeAnalysis/types';
import {
    type Climb,
    DEFAULT_CLIMB_OPTIONS,
    type ProfilePoint,
    STEEP_PRESETS,
    type SteepPreset,
    bestClimb,
    climbCategory,
    difficultyTier,
    findClimbs,
    findSteepSections,
    isSteepPreset,
    presetForActivity,
    resolveThresholds,
    sortByDifficulty,
    steepDifficulty
} from './steep';

const STEP = 10;

/** A profile of legs `[length m, grade %]`, one point every 10 m, `g` being the leg's grade. */
function profile(...legs: [number, number][]): ProfilePoint[] {
    const data: ProfilePoint[] = [{ d: 0, a: 100, g: legs[0][1] }];
    for (const [length, grade] of legs) {
        for (let covered = STEP; covered <= length; covered += STEP) {
            const previous = data[data.length - 1];
            data.push({ d: previous.d + STEP, a: previous.a + (grade * STEP) / 100, g: grade });
        }
    }
    return data;
}

const options = { thresholds: STEEP_PRESETS.road, minLength: 100 };

describe('findSteepSections', () => {
    it('finds nothing on a gentle route', () => {
        expect(findSteepSections(profile([2000, 3], [500, -4]), options)).toEqual([]);
    });

    it('finds a steep climb between flat parts, with its figures', () => {
        const sections = findSteepSections(profile([500, 0], [300, 14], [500, 0]), options);
        expect(sections).toHaveLength(1);
        const [section] = sections;
        expect(section.direction).toBe('up');
        // a point carries the grade of the leg that ends on it, so the first steep point is 10 m in
        expect(section.startDistance).toBe(510);
        expect(section.endDistance).toBe(800);
        expect(section.length).toBe(290);
        expect(section.avgGrade).toBeCloseTo(14, 5);
        expect(section.maxGrade).toBe(14);
        expect(section.gain).toBeCloseTo(40.6, 5);
        expect(section.difficulty).toBeCloseTo(steepDifficulty(290, 40.6), 5);
        expect(section.tier).toBe(difficultyTier(section.difficulty));
    });

    it('leaves out a climb that is not steep for a road bike', () => {
        // 9 % is a hard road climb, not a steep section
        expect(findSteepSections(profile([500, 0], [300, 9], [500, 0]), options)).toEqual([]);
    });

    it('reports a steep descent with negative figures', () => {
        const [section] = findSteepSections(profile([500, 0], [300, -12], [500, 0]), options);
        expect(section.direction).toBe('down');
        expect(section.avgGrade).toBeCloseTo(-12, 0);
        expect(section.maxGrade).toBe(-12);
        expect(section.gain).toBeLessThan(0);
    });

    it('ignores a run shorter than the minimum length', () => {
        expect(findSteepSections(profile([500, 0], [50, 16], [500, 0]), options)).toEqual([]);
        expect(findSteepSections(profile([500, 0], [50, 16], [500, 0]), { ...options, minLength: 30 })).toHaveLength(1);
    });

    it('keeps one section across a short easing', () => {
        // 40 m at 10 % between two 14 % legs: the mean of the gap stays within 3 % of the threshold
        const sections = findSteepSections(profile([500, 0], [200, 14], [40, 10], [200, 14], [500, 0]), options);
        expect(sections).toHaveLength(1);
    });

    it('splits two sections apart by a real break', () => {
        expect(findSteepSections(profile([500, 0], [200, 14], [300, 0], [200, 14], [500, 0]), options)).toHaveLength(2);
    });

    it('uses the thresholds it is given', () => {
        const data = profile([500, 0], [300, 14], [500, 0]);
        expect(findSteepSections(data, { ...options, thresholds: STEEP_PRESETS.mtb })).toEqual([]);
    });

    it('skips points without a grade', () => {
        const data = profile([500, 0], [300, 14], [500, 0]).map(({ a, d }) => ({ d, a }));
        expect(findSteepSections(data, options)).toEqual([]);
    });
});

describe('presets', () => {
    it('starts steep where it is really steep for the activity', () => {
        expect([STEEP_PRESETS.road.steepUp, STEEP_PRESETS.gravel.steepUp, STEEP_PRESETS.mtb.steepUp, STEEP_PRESETS.hiking.steepUp]).toEqual([12, 13, 16, 20]);
    });
});

describe('steep difficulty', () => {
    it('rates a long section harder than a short steeper one', () => {
        const long = steepDifficulty(800, 112);
        const short = steepDifficulty(150, 24);
        expect(long).toBeGreaterThan(short);
        expect(difficultyTier(long)).toBe(3);
        expect(difficultyTier(short)).toBe(1);
    });

    it('weighs the grade more than the length', () => {
        // the same gain over half the length is harder
        expect(steepDifficulty(200, 30)).toBeGreaterThan(steepDifficulty(400, 30));
    });

    it('cuts the score into three tiers', () => {
        expect([0.2, 0.5, 1.19, 1.2, 4].map(difficultyTier)).toEqual([1, 2, 2, 3, 3]);
    });

    it('rates a descent by its drop', () => {
        expect(steepDifficulty(300, -45)).toBeCloseTo(steepDifficulty(300, 45), 5);
    });
});

describe('sortByDifficulty', () => {
    it('lists the ways up hardest first, then the descents hardest first', () => {
        const sections = findSteepSections(profile([300, 0], [150, 16], [300, 0], [300, -14], [300, 0], [800, 14], [300, 0], [500, -12], [300, 0]), options);
        const sorted = sortByDifficulty(sections);
        expect(sorted.map(({ avgGrade, direction }) => [direction, Math.round(avgGrade)])).toEqual([
            ['up', 14],
            ['up', 16],
            ['down', -12],
            ['down', -14]
        ]);
    });

    it('leaves the sections it is given in route order', () => {
        const sections = findSteepSections(profile([300, 0], [150, 16], [300, 0], [800, 14], [300, 0]), options);
        sortByDifficulty(sections);
        expect(sections[0].startIndex).toBeLessThan(sections[1].startIndex);
    });
});

describe('climbCategory', () => {
    it.each([
        [1000, 5, undefined],
        [2000, 4, 4],
        [4000, 4, 3],
        [8000, 4, 2],
        [8000, 8, 1],
        [10000, 8, 'hc']
    ])('%i m at %f %% is %s', (length, grade, category) => {
        expect(climbCategory(length, grade)).toBe(category);
    });
});

describe('findClimbs', () => {
    it('finds a climb with its figures and category', () => {
        const [climb] = findClimbs(profile([1000, 0], [5000, 6], [1000, -2]));
        expect(climb.startDistance).toBe(1000);
        expect(climb.endDistance).toBe(6000);
        expect(climb.length).toBe(5000);
        expect(climb.gain).toBeCloseTo(300, 0);
        expect(climb.avgGrade).toBeCloseTo(6, 0);
        expect(climb.maxGrade).toBe(6);
        expect(climb.category).toBe(3);
    });

    it('goes on through a dip within the tolerance and splits on a bigger one', () => {
        // the descent of 10 m is tolerated, the one of 30 m is not
        expect(findClimbs(profile([1000, 6], [200, -5], [1000, 6]))).toHaveLength(1);
        expect(findClimbs(profile([1000, 6], [600, -5], [1000, 6]))).toHaveLength(2);
    });

    it('ignores a hill too small or too gentle', () => {
        expect(findClimbs(profile([500, 5], [500, -5]))).toEqual([]);
        expect(findClimbs(profile([5000, 2]))).toEqual([]);
    });

    it('takes the options it is given', () => {
        expect(findClimbs(profile([500, 5], [500, -5]), { ...DEFAULT_CLIMB_OPTIONS, minGain: 20 })).toHaveLength(1);
    });
});

describe('presetForActivity', () => {
    const cases: [Partial<Activity> | undefined, SteepPreset][] = [
        [{ kind: 'bike', subtype: 'road' }, 'road'],
        [{ kind: 'bike', subtype: 'gravel' }, 'gravel'],
        [{ kind: 'bike', subtype: 'normal' }, 'gravel'],
        [{ kind: 'bike', subtype: 'mountain' }, 'mtb'],
        [{ kind: 'bike', subtype: 'enduro' }, 'mtb'],
        [{ kind: 'bike' }, 'gravel'],
        [{ kind: 'hike', subtype: 'walk' }, 'hiking'],
        [{ kind: 'motor' }, 'road'],
        [undefined, 'hiking']
    ];
    it.each(cases)('%j is %s', (activity, preset) => {
        expect(presetForActivity(activity && { kind: 'hike', ...activity, origin: 'route' })).toBe(preset);
    });
});

describe('bestClimb', () => {
    const climb = (gain: number, category?: Climb['category']): Climb => ({
        startIndex: 0,
        endIndex: 1,
        startDistance: 0,
        endDistance: 1000,
        length: 1000,
        gain,
        avgGrade: gain / 10,
        maxGrade: 0,
        category
    });

    it('has none without climbs', () => {
        expect(bestClimb([])).toBeUndefined();
    });

    it('takes the hardest category over the biggest gain', () => {
        const hard = climb(100, 1);
        expect(bestClimb([climb(500, 3), hard, climb(900)])).toBe(hard);
        expect(bestClimb([climb(100, 4), climb(100, 'hc')])?.category).toBe('hc');
    });

    it('takes the biggest gain within a category, ranked or not', () => {
        const big = climb(300, 2);
        expect(bestClimb([climb(200, 2), big, climb(250, 2)])).toBe(big);
        const bigUnranked = climb(80);
        expect(bestClimb([climb(50), bigUnranked])).toBe(bigUnranked);
    });
});

describe('resolveThresholds', () => {
    it('is the preset when nothing is set', () => {
        expect(resolveThresholds('road', {})).toEqual(STEEP_PRESETS.road);
        expect(resolveThresholds('mtb', { steepUp: 0, steepDown: 0 })).toEqual(STEEP_PRESETS.mtb);
    });

    it('takes the values that are set over the preset, one by one', () => {
        expect(resolveThresholds('road', { steepUp: 10 })).toEqual({ ...STEEP_PRESETS.road, steepUp: 10 });
        expect(resolveThresholds('road', { steepDown: 18 })).toEqual({ ...STEEP_PRESETS.road, steepDown: 18 });
    });
});

describe('isSteepPreset', () => {
    it('knows the presets and nothing else', () => {
        expect(isSteepPreset('mtb')).toBe(true);
        expect(isSteepPreset('auto')).toBe(false);
        expect(isSteepPreset('toString')).toBe(false);
    });
});
