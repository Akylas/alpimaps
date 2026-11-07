import { describe, expect, it } from 'vitest';
import type { RiskSection } from './risk';
import { roadRows, roadShares } from './rows';
import { type RoadWords, buildRoadRead } from './sections';

const data = Array.from({ length: 101 }, (_, index) => ({ d: index * 100 }));
const words: RoadWords = { speed: String, speedNumber: String, distance: String };
const section = (start: number, end: number, level: 2 | 3): RiskSection => ({ level, start, end, startDist: start * 100, length: (end - start) * 100, speed: 80 });

describe('roadShares', () => {
    it('splits the route in red and amber meters, the rest, and what was not evaluated', () => {
        const read = buildRoadRead([section(10, 15, 3), section(40, 43, 2), section(60, 62, 3)], 1000, data, words);
        expect(roadShares(read, 10000)).toEqual([
            { id: 'high', meters: 700 },
            { id: 'medium', meters: 300 },
            { id: 'rest', meters: 8000 },
            { id: 'unknown', meters: 1000 }
        ]);
    });

    it('leaves out a kind the route has none of', () => {
        expect(roadShares(buildRoadRead([], 0, data, words), 10000)).toEqual([{ id: 'rest', meters: 10000 }]);
    });
});

describe('roadRows', () => {
    it('has nothing before the risk is read', () => {
        expect(roadRows(null, 10000, true)).toEqual([]);
    });

    it('is the bar and the note alone when nothing is fast', () => {
        expect(roadRows(buildRoadRead([], 400, data, words), 10000, true).map((row) => row.key)).toEqual(['bar', 'note']);
    });

    it('folds the sections away under their header, and lists them in route order when open', () => {
        const read = buildRoadRead([section(10, 15, 3), section(40, 43, 2), section(60, 62, 3)], 0, data, words);
        const closed = roadRows(read, 10000, false);
        expect(closed.map((row) => row.key)).toEqual(['bar', 'header', 'note']);
        expect(closed[1].data).toEqual({ type: 'header', count: 3, open: false });
        const open = roadRows(read, 10000, true);
        expect(open.map((row) => row.key)).toEqual(['bar', 'header', 'section0', 'section1', 'section2', 'note']);
        expect(open[5].data).toEqual({ type: 'note', unknown: 0 });
    });
});
