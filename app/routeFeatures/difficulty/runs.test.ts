import { describe, expect, it } from 'vitest';
import { UNKNOWN_LEVEL } from './scale';
import { runsFromEdges, sacRuns } from './runs';

describe('runsFromEdges', () => {
    it('fuses consecutive edges of one level, as the surface segments are', () => {
        expect(
            runsFromEdges([
                { begin: 0, end: 3, level: 2 },
                { begin: 3, end: 5, level: 2 },
                { begin: 5, end: 9, level: 4 }
            ])
        ).toEqual([
            { start: 0, end: 5, level: 2 },
            { start: 5, end: 9, level: 4 }
        ]);
    });

    it('keeps a short harder step apart: runs are not merged', () => {
        expect(
            runsFromEdges([
                { begin: 0, end: 10, level: 2 },
                { begin: 10, end: 11, level: 3 },
                { begin: 11, end: 20, level: 2 }
            ])
        ).toHaveLength(3);
    });

    it('does not fuse two edges of one level that are not next to each other', () => {
        expect(
            runsFromEdges([
                { begin: 0, end: 3, level: 2 },
                { begin: 5, end: 8, level: 2 }
            ])
        ).toEqual([
            { start: 0, end: 3, level: 2 },
            { start: 5, end: 8, level: 2 }
        ]);
    });

    it('skips an edge the match gave no place on the route', () => {
        expect(
            runsFromEdges([
                { begin: undefined, end: undefined, level: 3 },
                { begin: 4, end: 4, level: 3 },
                { begin: 0, end: 2, level: 1 }
            ])
        ).toEqual([{ start: 0, end: 2, level: 1 }]);
    });

    it('keeps the unknown level as a run of its own', () => {
        expect(
            runsFromEdges([
                { begin: 0, end: 2, level: UNKNOWN_LEVEL },
                { begin: 2, end: 4, level: 1 }
            ])
        ).toEqual([
            { start: 0, end: 2, level: UNKNOWN_LEVEL },
            { start: 2, end: 4, level: 1 }
        ]);
    });
});

describe('sacRuns', () => {
    it('reads the level of each edge off its sac_scale, an untagged one being unknown', () => {
        expect(
            sacRuns([
                { sac_scale: 0, begin_shape_index: 0, end_shape_index: 2 },
                { sac_scale: 3, begin_shape_index: 2, end_shape_index: 6 },
                { begin_shape_index: 6, end_shape_index: 8 }
            ])
        ).toEqual([
            { start: 0, end: 2, level: UNKNOWN_LEVEL },
            { start: 2, end: 6, level: 3 },
            { start: 6, end: 8, level: UNKNOWN_LEVEL }
        ]);
    });
});
