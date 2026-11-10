import type { Geometry } from 'geojson';
import { describe, expect, it } from 'vitest';
import { MOON_LIGHT_COLOR, MOON_MAX_INTENSITY, moonLightLook, moonShare, routeSunLightAt, sameLight } from '~/routeFeatures/sun/light';
import { type SunItem, readSun } from '~/routeFeatures/sun/read';
import { moonPositionAt } from '~/utils/astronomy/moon';
import { createAnalysis, withDeparture } from '~/utils/routeAnalysis/storage';

const COUNT = 41;
const geometry: Geometry = {
    type: 'LineString',
    coordinates: Array.from({ length: COUNT }, (_, index) => [5.72 - (0.2304 * index) / (COUNT - 1), 45.19 + (0.0759 * index) / (COUNT - 1)])
};
const NOW = Date.UTC(2026, 5, 1);

function read(at: number) {
    const analysis = withDeparture(createAnalysis(geometry), geometry, { mode: 'planned', at });
    const item: SunItem = { geometry, route: { totalTime: 3 * 3600 }, properties: { route: { type: 'bicycle' } }, analysis };
    return readSun(item, NOW);
}

describe('routeSunLightAt', () => {
    it('has the sun where the ride is at a distance, to a tenth of a degree', () => {
        const light = routeSunLightAt(read(Date.UTC(2026, 5, 21, 10, 0)), 10000);
        expect(Math.round(light.altitude * 10)).toBe(light.altitude * 10);
        expect(Math.round(light.azimuth * 10)).toBe(light.azimuth * 10);
        expect(light.altitude).toBeGreaterThan(50);
    });

    it('moves with the ride: the sun is lower at the end of an evening ride than at its start', () => {
        const evening = read(Date.UTC(2026, 5, 21, 15, 0));
        expect(routeSunLightAt(evening, 20000).altitude).toBeLessThan(routeSunLightAt(evening, 0).altitude);
    });

    it('is at the start while there is no distance', () => {
        const noon = read(Date.UTC(2026, 5, 21, 10, 0));
        expect(routeSunLightAt(noon, undefined)).toEqual(routeSunLightAt(noon, 0));
    });

    it('says how much sun gets through where the forecast says', () => {
        expect(routeSunLightAt(read(Date.UTC(2026, 5, 21, 10, 0)), 0).clearness).toBeUndefined();
    });

    it('has none for a sun that is not read', () => {
        expect(routeSunLightAt(null, 0)).toBeNull();
    });
});

describe('moonShare', () => {
    it('is how much of a full moon at the zenith the light is: the lit part, and how high it stands', () => {
        expect(moonShare(100, 90)).toBeCloseTo(1);
        expect(moonShare(50, 90)).toBeCloseTo(0.5);
        expect(moonShare(100, 30)).toBeCloseTo(0.5);
        expect(moonShare(100, 10)).toBeLessThan(moonShare(100, 30));
    });

    it('is none for a moon under the horizon or a new one', () => {
        expect(moonShare(100, 0)).toBe(0);
        expect(moonShare(100, -5)).toBe(0);
        expect(moonShare(0, 60)).toBe(0);
    });
});

describe('moonLightLook', () => {
    it('lights as much as the moon does, in a cold light, with the shadows the user chose scaled by it', () => {
        const full = moonLightLook(1, 0.3);
        expect(full.sunIntensity).toBeCloseTo(MOON_MAX_INTENSITY);
        expect(full.sunColor).toBe(MOON_LIGHT_COLOR);
        expect(full.shadowStrength).toBeCloseTo(0.3);
        const half = moonLightLook(0.5, 0.3);
        expect(half.sunIntensity).toBeCloseTo(MOON_MAX_INTENSITY / 2);
        expect(half.shadowStrength).toBeCloseTo(0.15);
    });

    it('draws no shadow of a moon too faint to be worth the pass', () => {
        expect(moonLightLook(0.02, 0.3).shadowStrength).toBe(0);
    });
});

describe('routeSunLightAt by night', () => {
    // 23:00 to 02:00 in Grenoble: the sun is down all along, a full moon is up
    const fullMoon = () => read(Date.UTC(2026, 5, 29, 21, 0));
    const place = { lat: 45.19, lon: 5.72 };

    it('lights the ride with the moon where it stands, in place of a sun that is under the horizon', () => {
        const light = routeSunLightAt(fullMoon(), 0);
        const moon = moonPositionAt(Date.UTC(2026, 5, 29, 21, 0), place);
        expect(light.altitude).toBeGreaterThan(0);
        expect(light.altitude).toBeCloseTo(moon.altitude, 0);
        expect(light.azimuth).toBeCloseTo(moon.azimuth, 0);
        // full: how high it stands is all that is left of the share
        expect(light.moon).toBeCloseTo(Math.sin((moon.altitude * Math.PI) / 180), 1);
        expect(light.clearness).toBeUndefined();
    });

    it('moves with the moon along the ride', () => {
        const night = fullMoon();
        expect(routeSunLightAt(night, 20000).altitude).toBeGreaterThan(routeSunLightAt(night, 0).altitude);
    });

    it('is the sun below the horizon, as before, for a new moon', () => {
        const light = routeSunLightAt(read(Date.UTC(2026, 5, 15, 21, 0)), 0);
        expect(light.moon).toBeUndefined();
        expect(light.altitude).toBeLessThan(0);
    });

    it('goes back to the sun below the horizon when the moon sets on the ride', () => {
        const night = read(Date.UTC(2026, 5, 22, 21, 0));
        expect(routeSunLightAt(night, 0).moon).toBeGreaterThan(0);
        const end = routeSunLightAt(night, 20000);
        expect(end.moon).toBeUndefined();
        expect(end.altitude).toBeLessThan(0);
    });

    it('keeps the sun by day, whatever the moon', () => {
        expect(routeSunLightAt(read(Date.UTC(2026, 5, 29, 10, 0)), 0).moon).toBeUndefined();
    });
});

describe('sameLight', () => {
    const light = { azimuth: 120.5, altitude: 40.1, clearness: 0.5 };

    it('is the same for the same figures, and not when one differs', () => {
        expect(sameLight(light, { ...light })).toBe(true);
        expect(sameLight(light, { ...light, azimuth: 120.6 })).toBe(false);
        expect(sameLight(light, { ...light, altitude: 40.2 })).toBe(false);
        expect(sameLight(light, { ...light, clearness: 0.4 })).toBe(false);
        expect(sameLight(light, { ...light, moon: 0.4 })).toBe(false);
        expect(sameLight({ ...light, moon: 0.4 }, { ...light, moon: 0.4 })).toBe(true);
    });

    it('is not the same as no light', () => {
        expect(sameLight(null, light)).toBe(false);
        expect(sameLight(light, null)).toBe(false);
    });
});
