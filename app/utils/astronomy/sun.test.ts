import { describe, expect, it } from 'vitest';
import { type GlareRule, isGlare, sunEvents, sunLevel, sunPositionAt, sunSide } from '~/utils/astronomy/sun';

const GRENOBLE = { lat: 45.19, lon: 5.72 };
const BIKE: GlareRule = { below: 15, window: 25 };

describe('sunPositionAt', () => {
    it('is south and high at the solar noon of midsummer', () => {
        const { altitude, azimuth } = sunPositionAt(Date.UTC(2026, 5, 21, 11, 37), GRENOBLE);
        expect(azimuth).toBeGreaterThan(170);
        expect(azimuth).toBeLessThan(190);
        expect(altitude).toBeGreaterThan(65);
    });

    it('is under the horizon at midnight', () => {
        expect(sunPositionAt(Date.UTC(2026, 5, 21, 23, 0), GRENOBLE).altitude).toBeLessThan(0);
    });
});

describe('sunLevel', () => {
    it('is day from 10 degrees', () => {
        expect(sunLevel(45)).toBe('day');
        expect(sunLevel(10)).toBe('day');
    });

    it('is low between the horizon and 10 degrees', () => {
        expect(sunLevel(9.9)).toBe('low');
        expect(sunLevel(-0.8)).toBe('low');
    });

    it('is twilight from sunset to civil dusk', () => {
        expect(sunLevel(-0.9)).toBe('twilight');
        expect(sunLevel(-6)).toBe('twilight');
    });

    it('is night under civil dusk', () => {
        expect(sunLevel(-6.1)).toBe('night');
    });
});

describe('isGlare', () => {
    it('blinds when the sun is low and ahead', () => {
        expect(isGlare({ azimuth: 270, altitude: 8 }, 270, BIKE)).toBe(true);
        expect(isGlare({ azimuth: 280, altitude: 8 }, 270, BIKE)).toBe(true);
    });

    it('does not when the sun is to the side or behind', () => {
        expect(isGlare({ azimuth: 270, altitude: 8 }, 180, BIKE)).toBe(false);
        expect(isGlare({ azimuth: 270, altitude: 8 }, 90, BIKE)).toBe(false);
    });

    it('does not when the sun is high', () => {
        expect(isGlare({ azimuth: 270, altitude: 30 }, 270, BIKE)).toBe(false);
    });

    it('does not when the sun is down', () => {
        expect(isGlare({ azimuth: 270, altitude: -5 }, 270, BIKE)).toBe(false);
    });

    it('measures the angle across north', () => {
        expect(isGlare({ azimuth: 355, altitude: 5 }, 10, BIKE)).toBe(true);
        expect(isGlare({ azimuth: 355, altitude: 5 }, 25, BIKE)).toBe(false);
    });

    it('includes the edge of the window', () => {
        expect(isGlare({ azimuth: 295, altitude: 5 }, 270, BIKE)).toBe(true);
        expect(isGlare({ azimuth: 295.5, altitude: 5 }, 270, BIKE)).toBe(false);
    });

    it('cannot tell without a heading', () => {
        expect(isGlare({ azimuth: 270, altitude: 5 }, undefined, BIKE)).toBe(false);
    });
});

describe('sunSide', () => {
    it('is on the right when it is clockwise of the heading', () => {
        expect(sunSide(90, 0)).toBe('right');
        expect(sunSide(270, 0)).toBe('left');
    });

    it('is ahead within 45 degrees of the heading', () => {
        expect(sunSide(30, 0)).toBe('ahead');
        expect(sunSide(350, 0)).toBe('ahead');
    });

    it('is behind within 45 degrees of the opposite', () => {
        expect(sunSide(180, 0)).toBe('behind');
        expect(sunSide(200, 10)).toBe('behind');
    });

    it('turns across north', () => {
        expect(sunSide(10, 350)).toBe('ahead');
        expect(sunSide(80, 350)).toBe('right');
        expect(sunSide(280, 350)).toBe('left');
    });
});

describe('sunEvents', () => {
    const MIDSUMMER = Date.UTC(2026, 5, 21, 15, 0);

    it('gives the rise, the set and the end of civil twilight of the day', () => {
        const { dusk, sunrise, sunset } = sunEvents(MIDSUMMER, GRENOBLE, 120);
        // 05:50 and 21:30 in Grenoble, dusk 22:05
        expect(sunrise).toBeGreaterThan(Date.UTC(2026, 5, 21, 3, 30));
        expect(sunrise).toBeLessThan(Date.UTC(2026, 5, 21, 4, 10));
        expect(sunset).toBeGreaterThan(Date.UTC(2026, 5, 21, 19, 15));
        expect(sunset).toBeLessThan(Date.UTC(2026, 5, 21, 19, 45));
        expect(dusk).toBeGreaterThan(sunset);
        expect(dusk - sunset).toBeLessThan(60 * 60000);
    });

    it('is the day of the route zone, not the UTC one', () => {
        // 23:30 on the 21st in Grenoble is 21:30 UTC the same day, 00:30 on the 22nd is 22:30 UTC
        const evening = sunEvents(Date.UTC(2026, 5, 21, 21, 30), GRENOBLE, 120);
        const afterMidnight = sunEvents(Date.UTC(2026, 5, 21, 22, 30), GRENOBLE, 120);
        expect(evening.sunset).toBeLessThan(Date.UTC(2026, 5, 22));
        expect(afterMidnight.sunset).toBeGreaterThan(Date.UTC(2026, 5, 22));
    });

    it('has no set where the sun does not set', () => {
        const north = sunEvents(Date.UTC(2026, 5, 21, 12, 0), { lat: 78.2, lon: 15.6 }, 120);
        expect(north.sunset).toBeNull();
        expect(north.sunrise).toBeNull();
    });
});
