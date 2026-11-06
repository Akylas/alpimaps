import { describe, expect, it } from 'vitest';
import { rainColor, tempColor, windColor } from './colors';

describe('tempColor', () => {
    it('says only the cold and the heat: the rest is neutral', () => {
        expect(tempColor(-5)).toBeDefined();
        expect(tempColor(0)).toBeDefined();
        expect(tempColor(12)).toBeUndefined();
        expect(tempColor(24)).toBeUndefined();
        expect(tempColor(27)).toBeDefined();
        expect(tempColor(35)).not.toBe(tempColor(27));
    });

    it('is blue under freezing and warm over', () => {
        expect(tempColor(-3)).toBe('#3F8FE0');
        expect(tempColor(30)).toBe('#F29D38');
        expect(tempColor(36)).toBe('#D7263D');
    });
});

describe('rainColor', () => {
    it('is the blue of the profile, darker the harder it rains', () => {
        expect(rainColor(0)).toBeUndefined();
        expect(rainColor(0.5)).toBe('#4A90D9');
        expect(rainColor(5)).not.toBe(rainColor(0.5));
    });
});

describe('windColor', () => {
    it('is orange against the ride from 10 km/h and red from 20', () => {
        expect(windColor(12)).toBe('#F29D38');
        expect(windColor(25)).toBe('#D7263D');
    });

    it('is green with a wind of 10 km/h or more behind', () => {
        expect(windColor(-12)).toBe('#2E9E5B');
    });

    it('has none for what is not worth one', () => {
        expect(windColor(5)).toBeUndefined();
        expect(windColor(-5)).toBeUndefined();
        expect(windColor(undefined)).toBeUndefined();
    });
});
