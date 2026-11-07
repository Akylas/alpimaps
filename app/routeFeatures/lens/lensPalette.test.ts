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

    it('is black on e-ink for what no feature owns, with white writing on a black plate, and leaves the features their own greys', () => {
        const grey = () => ({ rain_light: '#969696' });
        const { plate, plate_text: plateText, alert_fast: alert, rain_light: rainLight } = lensPalette('eink', [grey]);
        expect([plate, alert]).toEqual(['#000000', '#000000']);
        expect(plateText).toBe('#ffffff');
        expect(rainLight).toBe('#969696');
    });
});

describe('lensCase', () => {
    it('is white, dark on a dark map, black on e-ink', () => {
        expect(lensCase('light')).toBe('#ffffff');
        expect(lensCase('dark')).toBe('#101316');
        expect(lensCase('eink')).toBe('#000000');
    });
});
