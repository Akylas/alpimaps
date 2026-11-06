import { describe, expect, it } from 'vitest';
import { type RiskSection } from './risk';
import { type RoadWords, buildRoadRead, indexAt } from './sections';

// a point every 100 m, 10 km long
const data = Array.from({ length: 101 }, (_, index) => ({ d: index * 100 }));
const words: RoadWords = { speed: (kmh) => `${kmh} km/h`, speedNumber: (kmh) => String(kmh), distance: (meters) => `${meters} m` };

function section(startDist: number, length: number, attributes: Partial<RiskSection> = {}): RiskSection {
    return { level: 3, start: 0, end: 1, startDist, length, speed: 80, ...attributes };
}

describe('indexAt', () => {
    it('is the first point at or after the distance, the last past the end', () => {
        expect(indexAt(data, 0)).toBe(0);
        expect(indexAt(data, 250)).toBe(3);
        expect(indexAt(data, 300)).toBe(3);
        expect(indexAt(data, 99999)).toBe(100);
    });
});

describe('buildRoadRead', () => {
    it('cuts the route into a neutral core and the risky runs, with their level as severity', () => {
        const { slices } = buildRoadRead([section(1000, 500), section(4000, 300, { level: 2 })], 0, data, words);
        expect(slices).toEqual([
            { i0: 0, i1: 10, k: 'road_core', s: 0 },
            { i0: 10, i1: 15, k: 'risk_3', s: 3 },
            { i0: 15, i1: 40, k: 'road_core', s: 0 },
            { i0: 40, i1: 43, k: 'risk_2', s: 2 },
            { i0: 43, i1: 100, k: 'road_core', s: 0 }
        ]);
    });

    it('leaves a core slice between two runs a step apart', () => {
        const { slices } = buildRoadRead([section(1000, 500), section(1600, 200)], 0, data, words);
        expect(slices[2]).toEqual({ i0: 15, i1: 16, k: 'road_core', s: 0 });
    });

    it('keeps the plain look of a route with nothing fast, a neutral core all along', () => {
        expect(buildRoadRead([], 0, data, words).slices).toEqual([{ i0: 0, i1: 100, k: 'road_core', s: 0 }]);
    });

    it('does not start a run before the one before it ended, and keeps a very short one a step long', () => {
        const { runs } = buildRoadRead([section(1000, 500), section(1400, 400), section(5050, 10)], 0, data, words);
        expect(runs.map(({ i0, i1 }) => [i0, i1])).toEqual([
            [10, 15],
            [15, 18],
            [51, 52]
        ]);
    });

    it('sums what is exposed, and carries what was not evaluated', () => {
        const read = buildRoadRead([section(1000, 500), section(4000, 300)], 1200, data, words);
        expect(read.exposed).toBe(800);
        expect(read.unknown).toBe(1200);
    });

    it('puts a speed sign mid run, and one every 2 km along a long one', () => {
        const short = buildRoadRead([section(1000, 500)], 0, data, words).symbols;
        expect(short).toEqual([{ shape: 'speed_sign', vertex: 13, label: '80', severity: 3, priority: 70 }]);
        const long = buildRoadRead([section(1000, 6000)], 0, data, words).symbols;
        expect(long.map((symbol) => symbol.vertex)).toEqual([20, 40, 60]);
    });

    it('ranks a red sign over an amber one for the place', () => {
        const symbols = buildRoadRead([section(1000, 500), section(4000, 500, { level: 2 })], 0, data, words).symbols;
        expect(symbols[0].priority).toBeGreaterThan(symbols[1].priority);
    });

    it('focuses a run by its speed and length, and marks it by its level', () => {
        const read = buildRoadRead([section(1000, 500, { speed: 90 }), section(4000, 300, { level: 2 })], 0, data, words);
        expect(read.sections[0]).toEqual({ id: 0, i0: 10, i1: 15, title: '90 km/h · 500 m' });
        expect(read.marks.map((mark) => [mark.kind, mark.tier, mark.lens, mark.section.id, mark.color])).toEqual([
            ['fast', 3, 'road', 0, '#D7263D'],
            ['fast', 2, 'road', 1, '#E08A00']
        ]);
    });

    it('fills the profile grey, with a hatch on each run for e-ink', () => {
        const { fill } = buildRoadRead([section(0, 500), section(4000, 300, { level: 2 })], 0, data, words);
        expect(fill.map(({ d, pattern }) => [d, pattern])).toEqual([
            [0, 'cross'],
            [5, 'solid'],
            [40, 'diagonal'],
            [43, 'solid']
        ]);
        expect(fill[1].color).toBe('#9AA3AE');
        expect(fill[0].color).toBe('#D7263D');
    });
});
