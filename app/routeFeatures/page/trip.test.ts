import type { Geometry } from 'geojson';
import { describe, expect, it } from 'vitest';
import { tripTimes } from '~/routeFeatures/page/trip';
import { createAnalysis, withDeparture } from '~/utils/routeAnalysis/storage';

const geometry: Geometry = {
    type: 'LineString',
    coordinates: Array.from({ length: 21 }, (_, index) => [5.72 - 0.0127 * index, 45.19 + 0.0038 * index])
};
const HOUR = 3600000;
// 11:00 on the 21st of June in Grenoble
const NOW = Date.UTC(2026, 5, 21, 9, 0);

function item(departure: Parameters<typeof withDeparture>[2] | null, hours = 3) {
    const analysis = departure ? withDeparture(createAnalysis(geometry), geometry, departure) : createAnalysis(geometry);
    return { geometry, route: { totalTime: hours * 3600 }, analysis };
}

describe('tripTimes', () => {
    it('says nothing of a route with no line', () => {
        expect(tripTimes({ analysis: createAnalysis(geometry) }, NOW)).toBeNull();
    });

    it('has a ride that leaves with the clock start now, and end when it takes', () => {
        const trip = tripTimes(item(null), NOW);
        expect(trip.now).toBe(true);
        expect(trip.start).toBe(NOW);
        expect(trip.end).toBe(NOW + 3 * HOUR);
        expect(trip.startDay).toBe(0);
        expect(trip.endShift).toBe(0);
    });

    it('has a planned ride at its time, today', () => {
        const at = Date.UTC(2026, 5, 21, 15, 0);
        const trip = tripTimes(item({ mode: 'planned', at }), NOW);
        expect(trip.now).toBe(false);
        expect(trip.start).toBe(at);
        expect(trip.startDay).toBe(0);
    });

    it('counts the days to a ride planned for another one, in the zone of the route', () => {
        // 01:00 on the 22nd in Grenoble is 23:00 UTC on the 21st: tomorrow there, today for UTC
        const at = Date.UTC(2026, 5, 21, 23, 0);
        const zone = { mode: 'planned' as const, at, tz: 'Europe/Paris', utcOffset: 120 };
        expect(tripTimes(item(zone), NOW).startDay).toBe(1);
        expect(tripTimes(item(zone), NOW).offset).toBe(120);
    });

    it('counts the days a ride goes on past midnight, in the zone of the route', () => {
        // 22:00 Grenoble to 01:00 the day after
        const at = Date.UTC(2026, 5, 21, 20, 0);
        expect(tripTimes(item({ mode: 'planned', at, tz: 'Europe/Paris', utcOffset: 120 }), NOW).endShift).toBe(1);
        expect(tripTimes(item({ mode: 'planned', at: Date.UTC(2026, 5, 21, 14, 0), tz: 'Europe/Paris', utcOffset: 120 }), NOW).endShift).toBe(0);
    });
});
