import { describe, expect, it } from 'vitest';
import { UNKNOWN_LEVEL } from './scale';
import { type TileLine, mtbRuns, tileLines } from './tileMatch';

// ~111 m per 0.001 degree of latitude; a route going east along latitude 45
const route = (count: number): [number, number][] => Array.from({ length: count }, (_, index) => [6 + index * 0.001, 45]);

/** A tile line along the route's latitude, `offset` degrees north of it, between two longitudes. */
function line(from: number, to: number, tags: Partial<TileLine>, offset = 0): TileLine {
    return {
        coordinates: [
            [6 + from * 0.001, 45 + offset],
            [6 + to * 0.001, 45 + offset]
        ],
        ...tags
    };
}

const edges = [
    { begin: 0, end: 2 },
    { begin: 2, end: 4 }
];

describe('mtbRuns', () => {
    it('gives each edge the level of the tile line it runs along, and fuses equal neighbours', () => {
        const runs = mtbRuns(edges, route(5), [line(0, 2, { mtbScale: '1' }), line(2, 4, { mtbScale: '3' })]);
        expect(runs).toEqual([
            { start: 0, end: 2, level: 1 },
            { start: 2, end: 4, level: 3 }
        ]);
        expect(mtbRuns(edges, route(5), [line(0, 4, { mtbScale: '2' })])).toEqual([{ start: 0, end: 4, level: 2 }]);
    });

    it('keeps S0: a tagged easy trail is not an unrated one', () => {
        expect(mtbRuns([edges[0]], route(5), [line(0, 2, { mtbScale: '0' })])).toEqual([{ start: 0, end: 2, level: 0 }]);
    });

    it('takes an edge with no tile line near it for unknown', () => {
        // 0.001 degree north is ~111 m away
        expect(mtbRuns([edges[0]], route(5), [line(0, 2, { mtbScale: '2' }, 0.001)])).toEqual([{ start: 0, end: 2, level: UNKNOWN_LEVEL }]);
    });

    it('reaches a line east of the edge as far as it reaches one north of it: a degree of longitude is shorter', () => {
        // a route going north along longitude 6, with a line ~28 m east of it at latitude 45: inside the 30 m tolerance
        const north: [number, number][] = Array.from({ length: 5 }, (_, index) => [6, 45 + index * 0.001]);
        const east: TileLine = {
            coordinates: [
                [6.000356, 45],
                [6.000356, 45.002]
            ],
            mtbScale: '3'
        };
        expect(mtbRuns([edges[0]], north, [east])).toEqual([{ start: 0, end: 2, level: 3 }]);
    });

    it('takes an edge that a line only crosses for unknown: the line is not its way', () => {
        const crossing: TileLine = {
            coordinates: [
                [6.001, 44.999],
                [6.001, 45.001]
            ],
            mtbScale: '6'
        };
        expect(mtbRuns([edges[0]], route(5), [crossing])).toEqual([{ start: 0, end: 2, level: UNKNOWN_LEVEL }]);
    });

    it('takes the closest of two lines near it', () => {
        const runs = mtbRuns([edges[0]], route(5), [line(0, 2, { mtbScale: '5' }, 0.0002), line(0, 2, { mtbScale: '2' }, 0.00005)]);
        expect(runs).toEqual([{ start: 0, end: 2, level: 2 }]);
    });

    it('reads the tag of the line, not of another that only crosses the edge', () => {
        const crossing: TileLine = {
            coordinates: [
                [6.001, 44.999],
                [6.001, 45.001]
            ],
            mtbScale: '6'
        };
        expect(mtbRuns([edges[0]], route(5), [crossing, line(0, 2, { mtbScale: '1' })])).toEqual([{ start: 0, end: 2, level: 1 }]);
    });

    describe('uphill', () => {
        const tags = { mtbScale: '1', mtbScaleUphill: '3' };
        const climbing = [100, 110, 120, 130, 140];
        const descending = [140, 130, 120, 110, 100];

        it('reads the uphill scale where the route climbs', () => {
            expect(mtbRuns([edges[0]], route(5), [line(0, 2, tags)], { elevations: climbing })).toEqual([{ start: 0, end: 2, level: 3 }]);
        });

        it('reads the scale of the way down where the route descends or is flat', () => {
            expect(mtbRuns([edges[0]], route(5), [line(0, 2, tags)], { elevations: descending })).toEqual([{ start: 0, end: 2, level: 1 }]);
            expect(mtbRuns([edges[0]], route(5), [line(0, 2, tags)], { elevations: [100, 100, 100, 100, 100] })).toEqual([{ start: 0, end: 2, level: 1 }]);
        });

        it('reads the scale of the way down when the route has no elevations', () => {
            expect(mtbRuns([edges[0]], route(5), [line(0, 2, tags)])).toEqual([{ start: 0, end: 2, level: 1 }]);
        });

        it('falls back to the other tag when the one asked for is missing', () => {
            expect(mtbRuns([edges[0]], route(5), [line(0, 2, { mtbScale: '2' })], { elevations: climbing })).toEqual([{ start: 0, end: 2, level: 2 }]);
            expect(mtbRuns([edges[0]], route(5), [line(0, 2, { mtbScaleUphill: '4' })], { elevations: descending })).toEqual([{ start: 0, end: 2, level: 4 }]);
        });
    });
});

describe('tileLines', () => {
    it('keeps the lines that have a scale, a multi line being as many lines', () => {
        const lines = tileLines([
            {
                geometry: {
                    type: 'MultiLineString',
                    coordinates: [
                        [
                            [6, 45],
                            [6.001, 45]
                        ],
                        [
                            [6.002, 45],
                            [6.003, 45]
                        ]
                    ]
                },
                properties: { mtb_scale: '2', mtb_scale_uphill: '4' }
            },
            {
                geometry: {
                    type: 'LineString',
                    coordinates: [
                        [6, 45],
                        [6.001, 45]
                    ]
                },
                properties: { class: 'path' }
            },
            { geometry: { type: 'Point', coordinates: [6, 45] }, properties: { mtb_scale: '1' } }
        ]);
        expect(lines).toHaveLength(2);
        expect(lines[0]).toMatchObject({ mtbScale: '2', mtbScaleUphill: '4' });
        expect(lines[1].coordinates).toEqual([
            [6.002, 45],
            [6.003, 45]
        ]);
    });
});
