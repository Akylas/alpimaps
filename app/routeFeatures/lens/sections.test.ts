import { describe, expect, it } from 'vitest';
import type { LensSection } from '~/routeFeatures/registry';
import { alertFeatures, lensFeatures, nearestIndex, paddedRange, routeCoordinates, sectionAt, stepSection, symbolFeatures } from './sections';

const coordinates = Array.from({ length: 10 }, (_, index) => [6 + index * 0.01, 45]);

describe('lensFeatures', () => {
    const slices = [
        { i0: 0, i1: 3, k: 1, s: 0 as const },
        { i0: 3, i1: 6, k: 7, s: 3 as const },
        { i0: 6, i1: 9, k: 2, s: 1 as const }
    ];

    it('cuts the line into one feature per slice, vertices included at both ends', () => {
        const features = lensFeatures(coordinates, 'climbs', slices);
        expect(features).toHaveLength(3);
        expect(features[1].geometry).toEqual({ type: 'LineString', coordinates: coordinates.slice(3, 7) });
        expect(features[1].properties).toEqual({ class: 'lens', lens: 'climbs', k: 7, s: 3, f: 1, id: 1 });
    });

    it('fades what is not in the focused section and adds the focus line', () => {
        const features = lensFeatures(coordinates, 'climbs', slices, { i0: 4, i1: 5 });
        expect(features.filter((feature) => feature.properties.class === 'lens').map((feature) => feature.properties.f)).toEqual([0, 1, 0]);
        const focus = features.find((feature) => feature.properties.class === 'lensfocus');
        expect(focus.geometry).toEqual({ type: 'LineString', coordinates: coordinates.slice(4, 6) });
    });

    it('draws the focus halo first: a feature is drawn after the ones before it, and the halo goes under the slices', () => {
        const features = lensFeatures(coordinates, 'climbs', slices, { i0: 4, i1: 5 });
        expect(features[0].properties.class).toBe('lensfocus');
    });

    it('keeps a slice that touches the focus by its end', () => {
        const features = lensFeatures(coordinates, 'climbs', slices, { i0: 6, i1: 8 });
        expect(features.filter((feature) => feature.properties.class === 'lens').map((feature) => feature.properties.f)).toEqual([0, 1, 1]);
    });

    it('drops a slice with no line', () => {
        expect(lensFeatures(coordinates, 'climbs', [{ i0: 4, i1: 4, k: 0, s: 0 }])).toEqual([]);
    });
});

describe('sections', () => {
    const sections: LensSection[] = [
        { id: 0, i0: 10, i1: 20, title: 'a' },
        { id: 1, i0: 30, i1: 40, title: 'b' },
        { id: 2, i0: 50, i1: 60, title: 'c' }
    ];

    it('steps forward and back by position', () => {
        expect(stepSection(sections, sections[0], 1)?.id).toBe(1);
        expect(stepSection(sections, sections[2], -1)?.id).toBe(1);
    });

    it('wraps round at both ends', () => {
        expect(stepSection(sections, sections[2], 1)?.id).toBe(0);
        expect(stepSection(sections, sections[0], -1)?.id).toBe(2);
    });

    it('starts at the first or the last when nothing is focused', () => {
        expect(stepSection(sections, undefined, 1)?.id).toBe(0);
        expect(stepSection(sections, undefined, -1)?.id).toBe(2);
        expect(stepSection([], undefined, 1)).toBeUndefined();
    });

    it('finds the section a vertex is in', () => {
        expect(sectionAt(sections, 35)?.id).toBe(1);
        expect(sectionAt(sections, 25)).toBeUndefined();
    });
});

describe('paddedRange', () => {
    it('adds a tenth of the length on each side', () => {
        expect(paddedRange({ i0: 100, i1: 200 }, 1000)).toEqual({ fromIndex: 90, toIndex: 210 });
    });

    it('stays inside the route and pads at least one vertex', () => {
        expect(paddedRange({ i0: 2, i1: 12 }, 13)).toEqual({ fromIndex: 1, toIndex: 12 });
        expect(paddedRange({ i0: 5, i1: 6 }, 100)).toEqual({ fromIndex: 4, toIndex: 7 });
    });
});

describe('nearestIndex', () => {
    it('finds the closest vertex', () => {
        expect(nearestIndex(coordinates, 45.0004, 6.0449)).toBe(4);
    });

    it('has none on an empty route', () => {
        expect(nearestIndex([], 45, 6)).toBe(-1);
    });
});

describe('routeCoordinates', () => {
    it('flattens a multi line string the way the profile is', () => {
        expect(
            routeCoordinates({
                type: 'MultiLineString',
                coordinates: [
                    [
                        [0, 0],
                        [1, 1]
                    ],
                    [[2, 2]]
                ]
            })
        ).toEqual([
            [0, 0],
            [1, 1],
            [2, 2]
        ]);
        expect(
            routeCoordinates({
                type: 'LineString',
                coordinates: [
                    [0, 0],
                    [1, 1]
                ]
            })
        ).toEqual([
            [0, 0],
            [1, 1]
        ]);
    });

    it('is empty for anything else', () => {
        expect(routeCoordinates({ type: 'Point', coordinates: [0, 0] })).toEqual([]);
        expect(routeCoordinates(undefined)).toEqual([]);
    });
});

describe('symbolFeatures', () => {
    it('puts a plate on the vertex it stands at, with what the style reads', () => {
        const features = symbolFeatures(coordinates, [{ sym: 'climb', i: 4, t: 'Cat 1', t2: '1180 m', s: 2, p: 90 }]);
        expect(features).toHaveLength(1);
        expect(features[0].geometry).toEqual({ type: 'Point', coordinates: coordinates[4] });
        expect(features[0].properties).toEqual({ class: 'lsym', sym: 'climb', t: 'Cat 1', t2: '1180 m', s: 2, p: 90 });
    });

    it('leaves out a plate whose vertex is not on the route', () => {
        expect(symbolFeatures(coordinates, [{ sym: 'speed', i: 99, t: '80', s: 3, p: 1 }])).toEqual([]);
    });
});

describe('alertFeatures', () => {
    it('cuts the stretch out of the route, vertices included at both ends', () => {
        const features = alertFeatures(coordinates, [{ kind: 'fast', i0: 2, i1: 5, s: 3 }]);
        expect(features).toHaveLength(1);
        expect(features[0].geometry).toEqual({ type: 'LineString', coordinates: coordinates.slice(2, 6) });
        expect(features[0].properties).toEqual({ class: 'navalert', kind: 'fast', s: 3 });
    });

    it('leaves out a stretch of one vertex', () => {
        expect(alertFeatures(coordinates, [{ kind: 'steep', i0: 4, i1: 4, s: 2 }])).toEqual([]);
    });
});
