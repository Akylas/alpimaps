import type { Geometry } from 'geojson';
import { describe, expect, it } from 'vitest';
import { routeSunLightAt, sameLight } from '~/routeFeatures/sun/light';
import { type SunItem, readSun } from '~/routeFeatures/sun/read';
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

describe('sameLight', () => {
    const light = { azimuth: 120.5, altitude: 40.1, clearness: 0.5 };

    it('is the same for the same figures, and not when one differs', () => {
        expect(sameLight(light, { ...light })).toBe(true);
        expect(sameLight(light, { ...light, azimuth: 120.6 })).toBe(false);
        expect(sameLight(light, { ...light, altitude: 40.2 })).toBe(false);
        expect(sameLight(light, { ...light, clearness: 0.4 })).toBe(false);
    });

    it('is not the same as no light', () => {
        expect(sameLight(null, light)).toBe(false);
        expect(sameLight(light, null)).toBe(false);
    });
});
