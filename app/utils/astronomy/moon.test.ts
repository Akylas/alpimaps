import { describe, expect, it } from 'vitest';
import { MOON_GLYPHS, isNight, moonIllumination, moonPhaseGlyph, nightMoon } from './moon';

const LAT = 45;
const LON = 6;
const NEW_MOON = Date.UTC(2026, 5, 15, 3);
const FULL_MOON = Date.UTC(2026, 5, 30, 0);
const MINUTE = 60000;
const HOUR = 60 * MINUTE;

describe('moonPhaseGlyph', () => {
    it('is the new moon at the new moon and the full one at the full moon', () => {
        expect(moonPhaseGlyph(new Date(NEW_MOON))).toBe(MOON_GLYPHS[0]);
        expect(moonPhaseGlyph(new Date(FULL_MOON))).toBe(MOON_GLYPHS[4]);
    });

    it('goes through eight phases: a waxing one, then a waning one', () => {
        expect(MOON_GLYPHS).toHaveLength(8);
        expect(new Set(MOON_GLYPHS).size).toBe(8);
        // a week after the new moon it is at its first quarter, a week after the full one at its last
        expect(moonPhaseGlyph(new Date(NEW_MOON + 7.4 * 24 * HOUR))).toBe(MOON_GLYPHS[2]);
        expect(moonPhaseGlyph(new Date(FULL_MOON + 7.4 * 24 * HOUR))).toBe(MOON_GLYPHS[6]);
    });
});

describe('moonIllumination', () => {
    it('is the lit part of the moon in whole percents', () => {
        expect(moonIllumination(new Date(NEW_MOON))).toBe(0);
        expect(moonIllumination(new Date(FULL_MOON))).toBe(100);
        expect(moonIllumination(new Date(NEW_MOON + 7.4 * 24 * HOUR))).toBeGreaterThan(40);
        expect(moonIllumination(new Date(NEW_MOON + 7.4 * 24 * HOUR))).toBeLessThan(60);
    });
});

describe('isNight', () => {
    it('is the sun under the horizon', () => {
        expect(isNight(Date.UTC(2026, 5, 15, 12), LAT, LON)).toBe(false);
        expect(isNight(Date.UTC(2026, 5, 15, 23), LAT, LON)).toBe(true);
    });
});

describe('nightMoon', () => {
    // 21:00 to 01:00 UTC at 45N 6E: the sun sets before 20:00 UTC in June, and rises after 03:00
    const start = (day: number, month = 5) => Date.UTC(2026, month, day, 21);

    it('says how long the moon is up in the dark part of a ride: a lot at the full moon, hardly at the new one', () => {
        const full = nightMoon(start(30), start(30) + 4 * HOUR, LAT, LON);
        const fresh = nightMoon(start(15), start(15) + 4 * HOUR, LAT, LON);
        expect(full.moonlitMinutes).toBeGreaterThan(150);
        expect(fresh.moonlitMinutes).toBeLessThan(60);
    });

    it('says the phase and the lit part at the middle of the ride', () => {
        const full = nightMoon(start(29), start(29) + 6 * HOUR, LAT, LON);
        expect(full.glyph).toBe(MOON_GLYPHS[4]);
        expect(full.illumination).toBeGreaterThan(95);
    });

    it('counts only the dark: a ride in daylight has no moonlit minutes, whatever the moon', () => {
        const day = Date.UTC(2026, 5, 30, 9);
        expect(nightMoon(day, day + 2 * HOUR, LAT, LON).moonlitMinutes).toBe(0);
    });

    it('is nothing for a ride that does not go anywhere in time', () => {
        expect(nightMoon(start(30), start(30), LAT, LON).moonlitMinutes).toBe(0);
    });
});
