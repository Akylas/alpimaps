import { describe, expect, it } from 'vitest';
import { riskAhead } from './ahead';
import type { RoadRun } from './sections';

// a point every 100 m
const data = Array.from({ length: 101 }, (_, index) => ({ d: index * 100 }));
/** A run from vertex `i0` to `i1`, a vertex being 100 m. */
const run = (i0: number, i1: number, speed = 80): RoadRun => ({ section: { level: 3, start: i0, end: i1, startDist: i0 * 100, length: (i1 - i0) * 100, speed }, i0, i1 });
const options = { lead: 500, minLength: 100 };

describe('riskAhead', () => {
    it('is nothing when no section is near', () => {
        expect(riskAhead([run(30, 34)], data, 10, options)).toBeNull();
        expect(riskAhead([], data, 10, options)).toBeNull();
    });

    it('says how far a section is once it is within the lead', () => {
        expect(riskAhead([run(15, 19, 90)], data, 10, options)).toEqual({ key: 15, state: 'ahead', distance: 500, remaining: 900, speed: 90, level: 3 });
        expect(riskAhead([run(16, 20)], data, 10, options)).toBeNull();
    });

    it('is on a section from its start to its end, with the meters left', () => {
        expect(riskAhead([run(10, 14)], data, 10, options)).toMatchObject({ state: 'on', distance: 0, remaining: 400 });
        expect(riskAhead([run(10, 14)], data, 12, options)).toMatchObject({ state: 'on', remaining: 200 });
        expect(riskAhead([run(10, 14)], data, 14, options)).toBeNull();
    });

    it('goes on to the next section once the first is behind', () => {
        expect(riskAhead([run(10, 14), run(18, 21)], data, 15, options)).toMatchObject({ key: 18, state: 'ahead', distance: 300 });
    });

    it('leaves the sections under the banner length to the list', () => {
        const short = { ...options, minLength: 200 };
        expect(riskAhead([run(11, 12), run(13, 16)], data, 10, short)).toMatchObject({ key: 13 });
        expect(riskAhead([run(11, 12)], data, 10, options)).toMatchObject({ key: 11 });
        expect(riskAhead([run(11, 12)], data, 10, { ...options, minLength: 101 })).toBeNull();
    });

    it('is nothing off the route', () => {
        expect(riskAhead([run(0, 4)], data, -1, options)).toBeNull();
        expect(riskAhead([run(0, 4)], data, 500, options)).toBeNull();
    });
});
