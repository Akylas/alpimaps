import { describe, expect, it } from 'vitest';
import { gradeBuckets } from '~/utils/grade';
import { gradeKey, lensCase, lensPalette, surfaceKey } from './lensPalette';

const surfaceColors = { paved: '#D7D7D7', gravel: '#A89070' };

describe('lensPalette', () => {
    it('has the same keys whichever the theme', () => {
        const keys = Object.keys(lensPalette('light', surfaceColors)).sort();
        expect(Object.keys(lensPalette('dark', surfaceColors)).sort()).toEqual(keys);
        expect(Object.keys(lensPalette('eink', surfaceColors)).sort()).toEqual(keys);
    });

    it('colours a grade slice with the profile fill bucket it stands for', () => {
        const palette = lensPalette('light', surfaceColors);
        expect(gradeKey(3)).toBe('g3');
        gradeBuckets.forEach(({ color }, bucket) => {
            expect(palette[gradeKey(bucket)]).toBe(color);
        });
    });

    it('keys a surface by its id', () => {
        const palette = lensPalette('light', surfaceColors);
        expect(surfaceKey('gravel')).toBe('f_gravel');
        expect(palette[surfaceKey('gravel')]).toBe('#A89070');
        expect(palette[surfaceKey('paved')]).toBe('#D7D7D7');
    });

    it('lifts the dark palette: a light-theme step on a dark map reads as a hole', () => {
        expect(lensPalette('dark', surfaceColors).r0).not.toBe(lensPalette('light', surfaceColors).r0);
    });

    it('is black on e-ink, where a colour means nothing, and writes white on a black plate', () => {
        const { plate_text: plateText, ...colours } = lensPalette('eink', surfaceColors);
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
