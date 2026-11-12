import { describe, expect, it, vi } from 'vitest';

// a webpack DefinePlugin global
vi.stubGlobal('DEV_LOG', false);
vi.mock('@nativescript/core', () => ({ ApplicationSettings: { getNumber: (key: string, fallback: number) => fallback, getBoolean: (key: string, fallback: boolean) => fallback } }));
vi.mock('~/helpers/formatter', () => ({ UNITS: {}, convertDurationSeconds: () => '', convertValueToUnit: () => [0, ''], formatDuration: () => '', formatValue: () => '' }));
vi.mock('~/helpers/geolib', () => ({ getRhumbLineBearing: (from: { lat: number; lon: number }, to: { lat: number; lon: number }) => (Math.atan2(to.lon - from.lon, to.lat - from.lat) * 180) / Math.PI }));
vi.mock('~/models/Item', () => ({ RoutingAction: {} }));

import { OffRouteDetector, dockFigures, findClosestOnRoute } from './navigation';

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

describe('dockFigures', () => {
    const NOW = 1_000_000;
    // 4 points a kilometer apart, the ascent so far 0, 100, 100, 250
    const profile = {
        dplus: 250,
        data: [
            { d: 0, dp: 0 },
            { d: 1000, dp: 100 },
            { d: 2000, dp: 100 },
            { d: 3000, dp: 250 }
        ]
    };
    const stats = { distance: 1234, altitudeGain: 56, duration: 600_000 };
    const base = { stats, profile, done: false, paused: false, now: NOW };

    it('says what is left of the route, and when it ends', () => {
        const figures = dockFigures({ ...base, progress: { onPathIndex: 1, remainingDistance: 2000, remainingTime: 600 } });
        expect(figures).toEqual({ distance: 2000, ascent: 150, third: { kind: 'arrival', at: NOW + 600_000 } });
    });

    it('says what is done along the route when asked', () => {
        const figures = dockFigures({ ...base, done: true, progress: { onPathIndex: 3, remainingDistance: 0, remainingTime: 0 } });
        expect(figures).toEqual({ distance: 3000, ascent: 250, third: { kind: 'moving', seconds: 600 } });
    });

    it('says what was travelled when the position is not on the route', () => {
        const figures = dockFigures({ ...base, done: true, progress: { onPathIndex: -1 } });
        expect(figures.distance).toBe(1234);
        expect(figures.ascent).toBe(56);
    });

    it('says how long it moved while paused', () => {
        const figures = dockFigures({ ...base, paused: true, progress: { onPathIndex: 1, remainingDistance: 2000, remainingTime: 600 } });
        expect(figures.third).toEqual({ kind: 'moving', seconds: 600 });
    });

    it('says how far off the route first, from a meter', () => {
        const progress = { onPathIndex: 1, offRoute: true, remainingDistance: 2000, remainingTime: 600 };
        expect(dockFigures({ ...base, progress: { ...progress, distanceFromRoute: 42 } }).third).toEqual({ kind: 'off_route', distance: 42 });
        expect(dockFigures({ ...base, progress: { ...progress, distanceFromRoute: 0.4 } }).third).toEqual({ kind: 'arrival', at: NOW + 600_000 });
    });

    it('has nothing to say of a route that is not there', () => {
        expect(dockFigures({ stats: null, profile: undefined, done: false, paused: false, now: NOW, progress: null })).toEqual({ distance: null, ascent: null, third: null });
    });
});
