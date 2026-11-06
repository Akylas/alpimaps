import { describe, expect, it } from 'vitest';
import type { RiskSection } from './risk';
import { roadRows } from './rows';
import { type RoadWords, buildRoadRead } from './sections';

const data = Array.from({ length: 101 }, (_, index) => ({ d: index * 100 }));
const words: RoadWords = { speed: String, speedNumber: String, distance: String };
const section = (start: number, end: number, level: 2 | 3): RiskSection => ({ level, start, end, startDist: start * 100, length: (end - start) * 100, speed: 80 });

describe('roadRows', () => {
    it('has nothing before the risk is read', () => {
        expect(roadRows(null, 10000)).toEqual([]);
    });

    it('is the bar and the note alone when nothing is fast', () => {
        expect(roadRows(buildRoadRead([], 400, data, words), 10000).map((row) => row.key)).toEqual(['bar', 'note']);
    });

    it('splits the bar in red and amber meters, then lists the sections in route order', () => {
        const rows = roadRows(buildRoadRead([section(10, 15, 3), section(40, 43, 2), section(60, 62, 3)], 0, data, words), 10000);
        expect(rows.map((row) => row.key)).toEqual(['bar', 'section0', 'section1', 'section2', 'note']);
        expect(rows[0].data).toEqual({ type: 'bar', high: 700, medium: 300, total: 10000 });
        expect(rows[4].data).toEqual({ type: 'note', unknown: 0 });
    });
});
