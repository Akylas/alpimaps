import { describe, expect, it } from 'vitest';
import { lensCase, lensPalette } from './lensPalette';

const rain = (variant: string) => ({ rain_light: variant === 'dark' ? '#A9D4FA' : '#90CAF9' });

describe('lensPalette', () => {
    it('has what no feature owns, and what each feature adds', () => {
        const palette = lensPalette('light', [rain]);
        expect(palette.plate).toBe('#2B2F33');
        expect(palette.rain_light).toBe('#90CAF9');
    });

    it('has the same keys whichever the theme', () => {
        const keys = Object.keys(lensPalette('light', [rain])).sort();
        expect(Object.keys(lensPalette('dark', [rain])).sort()).toEqual(keys);
        expect(Object.keys(lensPalette('eink', [rain])).sort()).toEqual(keys);
    });

    it('asks each feature for the theme', () => {
        expect(lensPalette('dark', [rain]).rain_light).toBe('#A9D4FA');
    });

    it('lifts the dark palette: a light-theme step on a dark map reads as a hole', () => {
        expect(lensPalette('dark').plate).not.toBe(lensPalette('light').plate);
    });

    it('is black on e-ink, where a colour means nothing, and writes white on a black plate', () => {
        const { plate_text: plateText, ...colours } = lensPalette('eink', [rain]);
        Object.values(colours).forEach((color) => expect(color).toBe('#000000'));
        expect(plateText).toBe('#ffffff');
    });
});

describe('lensCase', () => {
    it('is white, dark on a dark map, white on e-ink', () => {
        expect(lensCase('light')).toBe('#ffffff');
        expect(lensCase('dark')).toBe('#101316');
        expect(lensCase('eink')).toBe('#ffffff');
    });
});
