import { describe, expect, it } from 'vitest';
import { cumulativeDistances, junctionsFromTrace } from './traceJunctions';

// 0.001 degree of latitude is about 111 m
const points = [0, 1, 2, 3].map((index) => ({ lat: 45 + index * 0.001, lon: 6 }));

describe('cumulativeDistances', () => {
    it('is the meters from the first point to each point', () => {
        const distances = cumulativeDistances(points);
        expect(distances[0]).toBe(0);
        expect(distances[1]).toBeCloseTo(111.2, 0);
        expect(distances[3]).toBeCloseTo(333.6, 0);
    });
});

describe('junctionsFromTrace', () => {
    const edges = [
        {
            end_shape_index: 1,
            end_heading: 0,
            end_node: {
                intersecting_edges: [
                    { begin_heading: 90, cyclability: 'forward' },
                    { begin_heading: 270, cyclability: 'backward' },
                    { begin_heading: 180, cyclability: 'both' }
                ]
            }
        },
        { end_shape_index: 2, end_heading: 0 },
        { end_shape_index: 3, end_heading: 10, end_node: { intersecting_edges: [{ begin_heading: 100, walkability: 'both' }] } }
    ];

    it('lists the side streets at each route node, from the profile access', () => {
        const junctions = junctionsFromTrace(edges, 'bicycle', points);
        expect(junctions).toHaveLength(1);
        expect(junctions[0]).toMatchObject({ lat: 45.001, lon: 6, arrival: 0 });
        expect(junctions[0].distance).toBeCloseTo(111.2, 0);
        expect(junctions[0].exits).toEqual([
            { heading: 90, enterable: true },
            { heading: 270, enterable: false },
            { heading: 180, enterable: true }
        ]);
    });

    it('reads walkability for a walk and skips a street the mode has no access to', () => {
        const junctions = junctionsFromTrace(edges, 'pedestrian', points);
        expect(junctions).toHaveLength(1);
        expect(junctions[0]).toMatchObject({ arrival: 10, exits: [{ heading: 100, enterable: true }] });
    });

    it('is nothing without side streets or a position for the node', () => {
        expect(junctionsFromTrace([{ end_shape_index: 1, end_heading: 0 }], 'bicycle', points)).toEqual([]);
        expect(junctionsFromTrace([{ end_shape_index: 9, end_heading: 0, end_node: { intersecting_edges: [{ begin_heading: 90, cyclability: 'both' }] } }], 'bicycle', points)).toEqual([]);
    });
});
