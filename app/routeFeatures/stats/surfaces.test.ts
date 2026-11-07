import { describe, expect, it } from 'vitest';
import { pavedShare, statsCardHeight, surfaceShade, surfaceStops, topSurfaces } from './surfaces';

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

    it('starts a stop at each segment, in order, with its colour and shade', () => {
        const segments = [
            { id: 'path', start: 40, end: 99 },
            { id: 'gravel', start: 0, end: 39 }
        ];
        expect(surfaceStops(segments, colors, '#z')).toEqual([
            { d: 0, color: '#a', shade: surfaceShade('gravel') },
            { d: 40, color: '#b', shade: surfaceShade('path') }
        ]);
    });

    it('falls back for a surface without a colour, and gives an unknown one a middle shade', () => {
        expect(surfaceStops([{ id: 'mud', start: 0, end: 9 }], colors, '#z')).toEqual([{ d: 0, color: '#z', shade: 120 }]);
    });

    it('is darker the rougher the surface', () => {
        expect(surfaceShade('paved')).toBeLessThan(surfaceShade('gravel'));
        expect(surfaceShade('gravel')).toBeLessThan(surfaceShade('path'));
    });
});

describe('statsCardHeight', () => {
    it('is the legend of the longest view, two lines to a row', () => {
        expect(statsCardHeight([1, 2])).toBe(58 + 20 + 12);
        expect(statsCardHeight([4, 1])).toBe(58 + 40 + 12);
        expect(statsCardHeight([5, 1])).toBe(58 + 60 + 12);
    });

    it('keeps a row for a route with no lines, and stops at six rows', () => {
        expect(statsCardHeight([])).toBe(58 + 20 + 12);
        expect(statsCardHeight([0, 0])).toBe(58 + 20 + 12);
        expect(statsCardHeight([40])).toBe(58 + 120 + 12);
    });
});
