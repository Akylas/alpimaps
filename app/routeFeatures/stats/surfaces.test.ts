import { describe, expect, it } from 'vitest';
import { pavedShare, surfaceStops, topSurfaces } from './surfaces';

const surfaces = [
    { id: 'gravel', perc: 0.14 },
    { id: 'paved_smooth', perc: 0.5 },
    { id: 'path', perc: 0.06 },
    { id: 'paved', perc: 0.3 }
];

describe('pavedShare', () => {
    it('adds the paved kinds up', () => {
        expect(pavedShare(surfaces)).toBeCloseTo(0.8);
    });

    it('is 0 without paving or without surfaces', () => {
        expect(pavedShare([{ id: 'dirt', perc: 1 }])).toBe(0);
        expect(pavedShare([])).toBe(0);
    });
});

describe('topSurfaces', () => {
    it('takes the biggest, biggest first', () => {
        expect(topSurfaces(surfaces, 2).map(({ id }) => id)).toEqual(['paved_smooth', 'paved']);
    });

    it('leaves out `unpaved`, which adds the others up', () => {
        expect(topSurfaces([{ id: 'unpaved', perc: 0.9 }, ...surfaces], 2).map(({ id }) => id)).toEqual(['paved_smooth', 'paved']);
    });

    it('leaves out what is under 1 %', () => {
        expect(topSurfaces([...surfaces, { id: 'steps', perc: 0.004 }], 10).map(({ id }) => id)).not.toContain('steps');
    });
});

describe('surfaceStops', () => {
    const colors = { gravel: '#a', path: '#b' };
    const patterns = { gravel: 'coarse_dots', path: 'cross' };

    it('starts a stop at each segment, in order, with its colour and hatch', () => {
        const segments = [
            { id: 'path', start: 40, end: 99 },
            { id: 'gravel', start: 0, end: 39 }
        ];
        expect(surfaceStops(segments, colors, patterns, '#z', 'solid')).toEqual([
            { d: 0, color: '#a', pattern: 'coarse_dots' },
            { d: 40, color: '#b', pattern: 'cross' }
        ]);
    });

    it('falls back for a surface without a colour or a hatch', () => {
        expect(surfaceStops([{ id: 'steps', start: 0, end: 9 }], colors, patterns, '#z', 'solid')).toEqual([{ d: 0, color: '#z', pattern: 'solid' }]);
    });
});
