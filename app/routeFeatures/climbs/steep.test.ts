import { describe, expect, it } from 'vitest';
import type { Activity } from '~/utils/routeAnalysis/types';
import { DEFAULT_CLIMB_OPTIONS, type ProfilePoint, STEEP_PRESETS, type SteepPreset, climbCategory, findClimbs, findSteepSections, presetForActivity } from './steep';

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
        const sections = findSteepSections(profile([500, 0], [300, 10], [500, 0]), options);
        expect(sections).toHaveLength(1);
        const [section] = sections;
        expect(section.direction).toBe('up');
        expect(section.level).toBe(1);
        // a point carries the grade of the leg that ends on it, so the first steep point is 10 m in
        expect(section.startDistance).toBe(510);
        expect(section.endDistance).toBe(800);
        expect(section.length).toBe(290);
        expect(section.avgGrade).toBeCloseTo(10, 5);
        expect(section.maxGrade).toBe(10);
        expect(section.gain).toBeCloseTo(29, 5);
    });

    it('calls a section very steep when its average passes the very steep threshold', () => {
        const [section] = findSteepSections(profile([500, 0], [200, 14], [500, 0]), options);
        expect(section.level).toBe(2);
    });

    it('reports a steep descent with negative figures', () => {
        const [section] = findSteepSections(profile([500, 0], [300, -12], [500, 0]), options);
        expect(section.direction).toBe('down');
        expect(section.avgGrade).toBeCloseTo(-12, 0);
        expect(section.maxGrade).toBe(-12);
        expect(section.gain).toBeLessThan(0);
    });

    it('ignores a run shorter than the minimum length', () => {
        expect(findSteepSections(profile([500, 0], [50, 15], [500, 0]), options)).toEqual([]);
        expect(findSteepSections(profile([500, 0], [50, 15], [500, 0]), { ...options, minLength: 30 })).toHaveLength(1);
    });

    it('keeps one section across a short easing', () => {
        // 40 m at 6 % between two 10 % legs: the mean of the gap stays within 3 % of the threshold
        const sections = findSteepSections(profile([500, 0], [200, 10], [40, 6], [200, 10], [500, 0]), options);
        expect(sections).toHaveLength(1);
    });

    it('splits two sections apart by a real break', () => {
        expect(findSteepSections(profile([500, 0], [200, 10], [300, 0], [200, 10], [500, 0]), options)).toHaveLength(2);
    });

    it('uses the thresholds it is given', () => {
        const data = profile([500, 0], [300, 10], [500, 0]);
        expect(findSteepSections(data, { ...options, thresholds: STEEP_PRESETS.mtb })).toEqual([]);
    });

    it('skips points without a grade', () => {
        const data = profile([500, 0], [300, 10], [500, 0]).map(({ a, d }) => ({ d, a }));
        expect(findSteepSections(data, options)).toEqual([]);
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
