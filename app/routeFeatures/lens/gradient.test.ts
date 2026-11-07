import { describe, expect, it } from 'vitest';
import type { LensSlice } from '~/routeFeatures/registry';
import { gradientRamp, lineProgress } from './gradient';

const palette = { low: '#112233', mid: '#445566', high: '#778899' };

function stops(ramp: string) {
    return ramp.split(',').map((stop) => {
        const [position, color] = stop.split(':');
        return { position: Number(position), color };
    });
}

describe('lineProgress', () => {
    it('is 0 at the start and 1 at the end, in step with the length covered', () => {
        const coordinates = [
            [0, 0],
            [1, 0],
            [3, 0],
            [4, 0]
        ];
        const progress = lineProgress(coordinates);
        expect(progress[0]).toBe(0);
        expect(progress[1]).toBeCloseTo(0.25, 6);
        expect(progress[2]).toBeCloseTo(0.75, 6);
        expect(progress[3]).toBe(1);
    });

    it('measures in Web Mercator, as the tiles do: a degree of latitude is longer further north', () => {
        const south = lineProgress([
            [0, 0],
            [0, 1],
            [0, 60],
            [0, 61]
        ]);
        expect(south[1]).toBeLessThan(1 / 61);
    });

    it('is all 0 for a route that goes nowhere', () => {
        expect(
            lineProgress([
                [6, 45],
                [6, 45]
            ])
        ).toEqual([0, 0]);
    });
});

describe('gradientRamp', () => {
    // 11 vertices, one progress step of 0.1 each
    const progress = Array.from({ length: 11 }, (_, index) => index / 10);
    const slices: LensSlice[] = [
        { i0: 0, i1: 2, k: 'low', s: 0 },
        { i0: 2, i1: 6, k: 'mid', s: 0 },
        { i0: 6, i1: 10, k: 'high', s: 0 }
    ];

    it('starts at 0, ends at 1 and never goes back', () => {
        const parsed = stops(gradientRamp(progress, slices, { palette }));
        expect(parsed[0].position).toBe(0);
        expect(parsed[parsed.length - 1].position).toBe(1);
        parsed.forEach((stop, index) => index && expect(stop.position).toBeGreaterThanOrEqual(parsed[index - 1].position));
    });

    it('makes a hard edge at each section boundary when it does not blend', () => {
        const parsed = stops(gradientRamp(progress, slices, { palette, blend: 0 }));
        expect(parsed).toEqual([
            { position: 0, color: '#112233' },
            { position: 0.2, color: '#112233' },
            { position: 0.2, color: '#445566' },
            { position: 0.6, color: '#445566' },
            { position: 0.6, color: '#778899' },
            { position: 1, color: '#778899' }
        ]);
    });

    it('blends across a boundary without reaching into a neighbour, however short it is', () => {
        const parsed = stops(gradientRamp(progress, slices, { palette, blend: 0.5 }));
        // 0.2 is the boundary of a 0.2 long and a 0.4 long section: the blend spans 0.1 each side at most
        const around = parsed.filter((stop) => stop.position > 0.09 && stop.position < 0.31);
        expect(around.map((stop) => stop.color)).toEqual(['#112233', '#445566']);
        expect(around[0].position).toBeCloseTo(0.1, 6);
        expect(around[1].position).toBeCloseTo(0.3, 6);
    });

    it('dims the sections the focus does not touch, with an alpha byte', () => {
        const parsed = stops(gradientRamp(progress, slices, { palette, blend: 0, focus: { i0: 3, i1: 4 }, dimmedAlpha: 0.5 }));
        expect(parsed.map((stop) => stop.color)).toEqual(['#11223380', '#11223380', '#445566', '#445566', '#77889980', '#77889980']);
    });

    it('draws a key the palette has not in the fallback colour', () => {
        const parsed = stops(gradientRamp(progress, [{ i0: 0, i1: 10, k: 'nope', s: 0 }], { palette, fallback: '#abcdef' }));
        expect(parsed.map((stop) => stop.color)).toEqual(['#abcdef', '#abcdef']);
    });

    it('keeps to the stop cap by folding the shortest sections into their neighbour', () => {
        const count = 400;
        const fine = Array.from({ length: count + 1 }, (_, index) => index / count);
        const many: LensSlice[] = Array.from({ length: count }, (_, index) => ({ i0: index, i1: index + 1, k: index % 2 ? 'low' : 'high', s: 0 as const }));
        const parsed = stops(gradientRamp(fine, many, { palette, maxStops: 100 }));
        expect(parsed.length).toBeLessThanOrEqual(100);
        expect(parsed[0].position).toBe(0);
        expect(parsed[parsed.length - 1].position).toBe(1);
    });

    it('blends over a short stretch by default, a tenth of the shorter section each side of a boundary', () => {
        const equal: LensSlice[] = [
            { i0: 0, i1: 5, k: 'low', s: 0 },
            { i0: 5, i1: 10, k: 'high', s: 0 }
        ];
        expect(stops(gradientRamp(progress, equal, { palette }))).toEqual([
            { position: 0, color: '#112233' },
            { position: 0.45, color: '#112233' },
            { position: 0.55, color: '#778899' },
            { position: 1, color: '#778899' }
        ]);
    });

    it('draws a stretch no slice covers in the fallback colour, a hard edge each side, so no colour is blended into it', () => {
        const gapped: LensSlice[] = [
            { i0: 0, i1: 3, k: 'low', s: 0 },
            { i0: 6, i1: 10, k: 'high', s: 0 }
        ];
        const parsed = stops(gradientRamp(progress, gapped, { palette, fallback: '#abcdef' }));
        expect(parsed.filter((stop) => stop.color === '#abcdef').map((stop) => stop.position)).toEqual([0.3, 0.6]);
        expect(parsed.find((stop) => stop.color === '#112233' && stop.position === 0.3)).toBeDefined();
        expect(parsed.find((stop) => stop.color === '#778899' && stop.position === 0.6)).toBeDefined();
    });

    it('is empty without a section to colour', () => {
        expect(gradientRamp(progress, [], { palette })).toBe('');
    });
});
