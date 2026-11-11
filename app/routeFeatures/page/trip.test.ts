import type { Geometry } from 'geojson';
import { describe, expect, it } from 'vitest';
import { dayFormat, daysFrom, tripTimes } from '~/routeFeatures/page/trip';
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

describe('dayFormat', () => {
    it('says nothing of today, the weekday for the week to come, the date for the rest, and for a day gone, which has no week to say it in', () => {
        expect(dayFormat(0)).toBeUndefined();
        expect(dayFormat(1)).toBe('ddd');
        expect(dayFormat(6)).toBe('ddd');
        expect(dayFormat(7)).toBe('ddd D MMM');
        expect(dayFormat(-1)).toBe('ddd D MMM');
        expect(dayFormat(-40)).toBe('ddd D MMM');
    });
});

describe('daysFrom', () => {
    it('counts the civil days between two instants in the zone asked for', () => {
        // 01:00 on the 22nd in Grenoble is 23:00 UTC on the 21st
        const at = Date.UTC(2026, 5, 21, 23, 0);
        expect(daysFrom(at, NOW, () => 120)).toBe(1);
        expect(daysFrom(at, NOW, () => 0)).toBe(0);
        expect(daysFrom(Date.UTC(2026, 5, 20, 8, 0), NOW, () => 120)).toBe(-1);
    });
});

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

    it('keeps a stamped now at its stamp as the clock goes on, and says when it is old', () => {
        const stamp = NOW - 2 * HOUR;
        const trip = tripTimes(item({ mode: 'now', at: stamp }), NOW);
        expect(trip.now).toBe(false);
        expect(trip.start).toBe(stamp);
        expect(trip.end).toBe(stamp + 3 * HOUR);
        expect(trip.outdated).toBe(true);
        expect(tripTimes(item({ mode: 'now', at: NOW - 5 * 60000 }), NOW).outdated).toBe(false);
        expect(tripTimes(item(null), NOW).outdated).toBe(false);
    });

    it('keeps a plan that went by and was kept at its own time, a day before: the strip says which', () => {
        const at = Date.UTC(2026, 5, 20, 8, 0);
        const trip = tripTimes(item({ mode: 'planned', at, keepPast: true }), NOW);
        expect(trip.start).toBe(at);
        expect(trip.startDay).toBe(-1);
        // not kept, it leaves with the clock
        expect(tripTimes(item({ mode: 'planned', at }), NOW).start).toBe(NOW);
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
        expect(tripTimes(item(zone), NOW).offsetAt(at)).toBe(120);
    });

    it('counts the days a ride goes on past midnight, in the zone of the route', () => {
        // 22:00 Grenoble to 01:00 the day after
        const at = Date.UTC(2026, 5, 21, 20, 0);
        expect(tripTimes(item({ mode: 'planned', at, tz: 'Europe/Paris', utcOffset: 120 }), NOW).endShift).toBe(1);
        expect(tripTimes(item({ mode: 'planned', at: Date.UTC(2026, 5, 21, 14, 0), tz: 'Europe/Paris', utcOffset: 120 }), NOW).endShift).toBe(0);
    });

    it('counts the days in the offset of each moment, for a ride over a change of the clocks', () => {
        // 22:00 in Grenoble on the 24th of October 2026 for 26 hours: the clocks go back in the night, it ends at 23:00 on the 25th, not at 00:00 on the 26th
        const zoneOffset = (_tz: string, at: number) => (at < Date.UTC(2026, 9, 25, 1) ? 120 : 60);
        const at = Date.UTC(2026, 9, 24, 20, 0);
        const departure = { mode: 'planned' as const, at, tz: 'Europe/Paris', utcOffset: 120 };
        expect(tripTimes(item(departure, 26), Date.UTC(2026, 9, 24, 9, 0), zoneOffset).endShift).toBe(1);
        expect(tripTimes(item(departure, 26), Date.UTC(2026, 9, 24, 9, 0)).endShift).toBe(2);
    });
});
