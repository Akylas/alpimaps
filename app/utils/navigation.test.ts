import { describe, expect, it, vi } from 'vitest';

// a webpack DefinePlugin global
vi.stubGlobal('DEV_LOG', false);
vi.mock('@nativescript/core', () => ({ ApplicationSettings: { getNumber: (key: string, fallback: number) => fallback, getBoolean: (key: string, fallback: boolean) => fallback } }));
vi.mock('~/helpers/formatter', () => ({ UNITS: {}, convertDurationSeconds: () => '', convertValueToUnit: () => [0, ''], formatDuration: () => '', formatValue: () => '' }));
vi.mock('~/helpers/geolib', () => ({ getRhumbLineBearing: (from: { lat: number; lon: number }, to: { lat: number; lon: number }) => (Math.atan2(to.lon - from.lon, to.lat - from.lat) * 180) / Math.PI }));
vi.mock('~/models/Item', () => ({ RoutingAction: {} }));

import { OffRouteDetector, findClosestOnRoute } from './navigation';

const TEN_METERS = 0.00009;
const SECOND_MS = 1000;
// a road going north: a vertex every 10 m, a straight 200 m with none, then a vertex every 10 m again
const positions: { lat: number; lon: number }[] = [];
for (let index = 0; index <= 10; index++) {
    positions.push({ lat: 45 + index * TEN_METERS, lon: 5 });
}
const longStart = positions.length - 1;
const longEnd = longStart + 1;
positions.push({ lat: positions[longStart].lat + 20 * TEN_METERS, lon: 5 });
for (let index = 1; index <= 10; index++) {
    positions.push({ lat: positions[longEnd].lat + index * TEN_METERS, lon: 5 });
}

describe('findClosestOnRoute', () => {
    it('reaches a long segment from the vertex before it, whatever the room ahead', () => {
        const middle = { lat: positions[longStart].lat + 10 * TEN_METERS, lon: 5 };
        const best = findClosestOnRoute(middle, positions, { fromIndex: longStart, maxAhead: 115 });
        expect(best?.index).toBe(longEnd);
        expect(best?.distanceFromRoute).toBeLessThan(1);
    });

    it('still keeps the later parts of the route out of reach', () => {
        // a fix past the long segment is not matched to the stretch after it: that starts further than the room ahead
        const beyond = { lat: positions[longEnd + 5].lat, lon: 5 };
        const best = findClosestOnRoute(beyond, positions, { fromIndex: 2, maxAhead: 115 });
        expect(best?.index).toBeLessThanOrEqual(longEnd);
    });
});

describe('OffRouteDetector', () => {
    it('keeps a user walking a long segment on the route', () => {
        const detector = new OffRouteDetector(() => ({}));
        let now = 1_000_000;
        const feed = (lat: number) => {
            now += SECOND_MS;
            return detector.update({ lat, lon: 5, horizontalAccuracy: 5, speed: 5, bearing: 0 }, positions, now);
        };
        // 5 m a second from the start to past the long segment
        const end = positions[longEnd + 3].lat;
        const offRouteAt: number[] = [];
        for (let lat = 45; lat < end; lat += TEN_METERS / 2) {
            if (feed(lat).offRoute) {
                offRouteAt.push(lat);
            }
        }
        expect(offRouteAt).toEqual([]);
    });
});
