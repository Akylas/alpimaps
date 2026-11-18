import { describe, expect, it } from 'vitest';
import { createTrace } from '~/routeFeatures/ride/trace';

const START = Date.UTC(2026, 10, 2, 8, 12);
/** metres of latitude */
const METER = 1 / 111320;

function fix(index: number, extra: Record<string, number> = {}) {
    return { lat: 45 + index * 10 * METER, lon: 6, timestamp: START + index * 1000, ...extra };
}

describe('createTrace', () => {
    it('starts empty', () => {
        const trace = createTrace(5);
        expect(trace.committed()).toEqual([]);
        expect(trace.tail()).toEqual([]);
    });
    it('draws what it is given as lon / lat, in the tail', () => {
        const trace = createTrace(5);
        expect(trace.add(fix(0))).toBe('tail');
        expect(trace.add(fix(1))).toBe('tail');
        expect(trace.tail()).toEqual([
            [6, 45],
            [6, 45 + 10 * METER]
        ]);
        expect(trace.committed()).toEqual([]);
    });
    it('leaves out the fixes a ride leaves out', () => {
        const trace = createTrace(5);
        trace.add(fix(0));
        expect(trace.add(fix(1, { speed: 0 }))).toBeNull();
        expect(trace.add(fix(2, { horizontalAccuracy: 80 }))).toBeNull();
        expect(trace.add({ ...fix(0), timestamp: NaN })).toBeNull();
        // 1 m from the last kept
        expect(trace.add({ ...fix(0), lat: 45 + METER })).toBeNull();
        expect(trace.tail()).toHaveLength(1);
    });
    it('moves the tail to the committed part once it is long enough, and says the committed part changed', () => {
        const trace = createTrace(3);
        const answers = [0, 1, 2, 3].map((index) => trace.add(fix(index)));
        expect(answers).toEqual(['tail', 'tail', 'committed', 'tail']);
        expect(trace.committed()).toHaveLength(3);
        expect(trace.tail()).toHaveLength(2);
    });
    it('keeps the line whole: the tail starts on the last point committed', () => {
        const trace = createTrace(3);
        [0, 1, 2, 3].forEach((index) => trace.add(fix(index)));
        expect(trace.tail()[0]).toEqual(trace.committed()[trace.committed().length - 1]);
        const line = [...trace.committed(), ...trace.tail().slice(1)];
        expect(line).toEqual([0, 1, 2, 3].map((index) => [6, 45 + index * 10 * METER]));
    });
    it('forgets everything on reset', () => {
        const trace = createTrace(3);
        [0, 1, 2, 3].forEach((index) => trace.add(fix(index)));
        trace.reset();
        expect(trace.committed()).toEqual([]);
        expect(trace.tail()).toEqual([]);
        expect(trace.add(fix(9))).toBe('tail');
    });
    it('does not copy the committed part on every fix', () => {
        const trace = createTrace(3);
        [0, 1, 2].forEach((index) => trace.add(fix(index)));
        const committed = trace.committed();
        trace.add(fix(3));
        expect(trace.committed()).toBe(committed);
    });
});
