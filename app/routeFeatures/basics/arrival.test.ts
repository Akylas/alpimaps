import { describe, expect, it } from 'vitest';
import { DEFAULT_PACE } from '~/utils/routeAnalysis/storage';
import type { Departure, RouteAnalysis } from '~/utils/routeAnalysis/types';
import { arrivalOf, zoneOffsetMinutes } from './arrival';

const NOW = Date.UTC(2026, 5, 1, 12, 0, 0);
const HOUR = 3600;

describe('zoneOffsetMinutes', () => {
    it('follows the zone and its summer time', () => {
        expect(zoneOffsetMinutes('UTC', NOW)).toBe(0);
        expect(zoneOffsetMinutes('Europe/Paris', Date.UTC(2026, 0, 15, 12))).toBe(60);
        expect(zoneOffsetMinutes('Europe/Paris', Date.UTC(2026, 6, 15, 12))).toBe(120);
        expect(zoneOffsetMinutes('America/New_York', Date.UTC(2026, 0, 15, 12))).toBe(-300);
    });
});

describe('arrivalOf', () => {
    // a straight 10 km line east, routed in an hour
    const geometry = {
        type: 'LineString' as const,
        coordinates: [
            [6, 45],
            [6.0635, 45],
            [6.127, 45]
        ]
    };
    const item = (departure: Departure): Parameters<typeof arrivalOf>[0] => {
        const analysis: RouteAnalysis = { v: 1, inputs: { departure, pace: { ...DEFAULT_PACE }, geometryKey: 'k' }, layers: {} };
        return { geometry, route: { totalTime: HOUR }, analysis };
    };

    it('is the departure plus the time of the route', () => {
        const at = NOW + 5 * HOUR * 1000;
        expect(arrivalOf(item({ mode: 'planned', at }), NOW)?.at).toBeCloseTo(at + HOUR * 1000, -3);
    });

    it('starts a plan that has passed now', () => {
        expect(arrivalOf(item({ mode: 'planned', at: NOW - HOUR * 1000 }), NOW)?.at).toBeCloseTo(NOW + HOUR * 1000, -3);
    });

    it('has none when the route leaves now, or has no analysis', () => {
        expect(arrivalOf(item({ mode: 'now' }), NOW)).toBeUndefined();
        expect(arrivalOf({ geometry, route: { totalTime: HOUR } }, NOW)).toBeUndefined();
    });

    it('is in the route zone when it is known, the phone zone else', () => {
        const at = Date.UTC(2026, 6, 15, 8);
        expect(arrivalOf(item({ mode: 'planned', at, tz: 'Europe/Paris', tzFromPhone: false }), NOW)?.offset).toBe(120);
        expect(arrivalOf(item({ mode: 'planned', at, tzFromPhone: true }), NOW)?.offset).toBeUndefined();
    });
});
