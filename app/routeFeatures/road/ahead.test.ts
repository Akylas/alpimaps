import { describe, expect, it } from 'vitest';
import { riskAhead } from './ahead';
import type { RoadRun } from './sections';

// a point every 100 m
const data = Array.from({ length: 101 }, (_, index) => ({ d: index * 100 }));
const run = (startDist: number, length: number, speed = 80): RoadRun => ({ section: { level: 3, start: 0, end: 1, startDist, length, speed }, i0: 0, i1: 1 });
const options = { lead: 500, minLength: 100 };

describe('riskAhead', () => {
    it('is nothing when no section is near', () => {
        expect(riskAhead([run(3000, 400)], data, 10, options)).toBeNull();
        expect(riskAhead([], data, 10, options)).toBeNull();
    });

    it('says how far a section is once it is within the lead', () => {
        expect(riskAhead([run(1500, 400, 90)], data, 10, options)).toEqual({ key: 1500, state: 'ahead', distance: 500, remaining: 900, speed: 90, level: 3 });
        expect(riskAhead([run(1501, 400)], data, 10, options)).toBeNull();
    });

    it('is on a section from its start to its end, with the meters left', () => {
        expect(riskAhead([run(1000, 400)], data, 10, options)).toMatchObject({ state: 'on', distance: 0, remaining: 400 });
        expect(riskAhead([run(1000, 400)], data, 12, options)).toMatchObject({ state: 'on', remaining: 200 });
        expect(riskAhead([run(1000, 400)], data, 14, options)).toBeNull();
    });

    it('goes on to the next section once the first is behind', () => {
        expect(riskAhead([run(1000, 400), run(1800, 300)], data, 15, options)).toMatchObject({ key: 1800, state: 'ahead', distance: 300 });
    });

    it('leaves the sections under the banner length to the list', () => {
        expect(riskAhead([run(1100, 50), run(1300, 200)], data, 10, options)).toMatchObject({ key: 1300 });
        expect(riskAhead([run(1100, 99)], data, 10, options)).toBeNull();
        expect(riskAhead([run(1100, 100)], data, 10, options)).toMatchObject({ key: 1100 });
    });

    it('is nothing off the route', () => {
        expect(riskAhead([run(0, 400)], data, -1, options)).toBeNull();
        expect(riskAhead([run(0, 400)], data, 500, options)).toBeNull();
    });
});
