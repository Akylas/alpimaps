import { describe, expect, it } from 'vitest';
import { type RiskSection } from './risk';
import { type RoadWords, buildRoadRead } from './sections';

// a point every 100 m, 10 km long
const data = Array.from({ length: 101 }, (_, index) => ({ d: index * 100 }));
const words: RoadWords = { speed: (kmh) => `${kmh} km/h`, speedNumber: (kmh) => String(kmh), distance: (meters) => `${meters} m` };

/** A section from route vertex `start` to `end`, a vertex being 100 m. */
function section(start: number, end: number, attributes: Partial<RiskSection> = {}): RiskSection {
    return { level: 3, start, end, startDist: start * 100, length: (end - start) * 100, speed: 80, ...attributes };
}

describe('buildRoadRead', () => {
    it('cuts the route into a neutral core and the risky runs, with their level as severity', () => {
        const { slices } = buildRoadRead([section(10, 15), section(40, 43, { level: 2 })], 0, data, words);
        expect(slices).toEqual([
            { i0: 0, i1: 10, k: 'road_core', s: 0 },
            { i0: 10, i1: 15, k: 'risk_3', s: 3 },
            { i0: 15, i1: 40, k: 'road_core', s: 0 },
            { i0: 40, i1: 43, k: 'risk_2', s: 2 },
            { i0: 43, i1: 100, k: 'road_core', s: 0 }
        ]);
    });

    it('places a run by the shape indexes of the match, not by the meters of its edges', () => {
        // the edges add up to more than the route is long: the meters drift, the vertices do not
        const { runs } = buildRoadRead([section(10, 15, { startDist: 1300, length: 620 })], 0, data, words);
        expect(runs.map(({ i0, i1 }) => [i0, i1])).toEqual([[10, 15]]);
    });

    it('orders the runs by their place on the route, whatever the meters say', () => {
        const { runs } = buildRoadRead([section(40, 43), section(10, 15, { startDist: 9000 })], 0, data, words);
        expect(runs.map(({ i0 }) => i0)).toEqual([10, 40]);
    });

    it('leaves a core slice between two runs a step apart', () => {
        const { slices } = buildRoadRead([section(10, 15), section(16, 18)], 0, data, words);
        expect(slices[2]).toEqual({ i0: 15, i1: 16, k: 'road_core', s: 0 });
    });

    it('keeps the plain look of a route with nothing fast, a neutral core all along', () => {
        expect(buildRoadRead([], 0, data, words).slices).toEqual([{ i0: 0, i1: 100, k: 'road_core', s: 0 }]);
    });

    it('does not start a run before the one before it ended, and keeps a very short one a step long', () => {
        const { runs } = buildRoadRead([section(10, 15), section(14, 18), section(51, 51)], 0, data, words);
        expect(runs.map(({ i0, i1 }) => [i0, i1])).toEqual([
            [10, 15],
            [15, 18],
            [51, 52]
        ]);
    });

    it('keeps a run inside the route when the match ran past its end', () => {
        const { runs } = buildRoadRead([section(98, 140)], 0, data, words);
        expect(runs.map(({ i0, i1 }) => [i0, i1])).toEqual([[98, 100]]);
    });

    it('sums what is exposed, and carries what was not evaluated', () => {
        const read = buildRoadRead([section(10, 15), section(40, 43)], 1200, data, words);
        expect(read.exposed).toBe(800);
        expect(read.unknown).toBe(1200);
    });

    it('puts a speed sign mid run, and one every 2 km along a long one', () => {
        const short = buildRoadRead([section(10, 15)], 0, data, words).symbols;
        expect(short).toEqual([{ shape: 'speed_sign', vertex: 13, label: '80', severity: 3, priority: 70 }]);
        const long = buildRoadRead([section(10, 70)], 0, data, words).symbols;
        expect(long.map((symbol) => symbol.vertex)).toEqual([20, 40, 60]);
    });

    it('ranks a red sign over an amber one for the place', () => {
        const symbols = buildRoadRead([section(10, 15), section(40, 45, { level: 2 })], 0, data, words).symbols;
        expect(symbols[0].priority).toBeGreaterThan(symbols[1].priority);
    });

    it('focuses a run by its speed and length, and marks it in its own colour', () => {
        const read = buildRoadRead([section(10, 15, { speed: 90 }), section(40, 43, { level: 2 })], 0, data, words);
        expect(read.sections[0]).toEqual({ id: 0, i0: 10, i1: 15, title: '90 km/h · 500 m' });
        expect(read.marks.map((mark) => [mark.kind, mark.lens, mark.section.id, mark.color])).toEqual([
            ['fast', 'road', 0, '#7E3FD0'],
            ['fast', 'road', 1, '#7E3FD0']
        ]);
    });

    it('alerts on each run with its level, for the map while following the route', () => {
        const { alerts } = buildRoadRead([section(10, 15), section(40, 43, { level: 2 })], 0, data, words);
        expect(alerts).toEqual([
            { kind: 'fast', i0: 10, i1: 15, s: 3 },
            { kind: 'fast', i0: 40, i1: 43, s: 2 }
        ]);
    });

    it('fills the profile grey, with a shade on each run for e-ink', () => {
        const { fill } = buildRoadRead([section(0, 5), section(40, 43, { level: 2 })], 0, data, words);
        expect(fill.map(({ d, shade }) => [d, shade])).toEqual([
            [0, 170],
            [5, 30],
            [40, 100],
            [43, 30]
        ]);
        expect(fill[1].color).toBe('#9AA3AE');
        expect(fill[0].color).toBe('#D7263D');
    });
});
