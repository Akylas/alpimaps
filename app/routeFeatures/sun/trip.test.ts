import type { Geometry } from 'geojson';
import { describe, expect, it } from 'vitest';
import { type SunItem, readSun } from '~/routeFeatures/sun/read';
import { sunTrip } from '~/routeFeatures/sun/trip';
import { createAnalysis, withDeparture } from '~/utils/routeAnalysis/storage';

const COUNT = 41;
// 20 km north-west of Grenoble
const geometry: Geometry = {
    type: 'LineString',
    coordinates: Array.from({ length: COUNT }, (_, index) => [5.72 - (0.2304 * index) / (COUNT - 1), 45.19 + (0.0759 * index) / (COUNT - 1)])
};
const NOW = Date.UTC(2026, 5, 1);

function tripOf(at: number, hours = 3) {
    const analysis = withDeparture(createAnalysis(geometry), geometry, { mode: 'planned', at });
    const item: SunItem = { geometry, route: { totalTime: hours * 3600 }, properties: { route: { type: 'bicycle' } }, analysis };
    return sunTrip(readSun(item, NOW));
}

describe('sunTrip', () => {
    it('has the sunset of a ride that is out at it, at a distance, and the moon of its dark', () => {
        // 19:30 to 22:30 in Grenoble, a first quarter moon
        const trip = tripOf(Date.UTC(2026, 5, 21, 17, 30));
        expect(trip.events.map((event) => [event.id, event.relation])).toEqual([['sunset', 'during']]);
        expect(trip.events[0].distance).toBeGreaterThan(0);
        expect(trip.darkMs).toBeGreaterThan(0);
        expect(trip.moon.illumination).toBeGreaterThan(40);
        expect(trip.moon.illumination).toBeLessThan(60);
    });

    it('has the sunrise of a ride that starts in the dark', () => {
        // 04:30 to 07:30 in Grenoble, the sun rises at 05:55
        const trip = tripOf(Date.UTC(2026, 5, 21, 2, 30));
        expect(trip.events.map((event) => [event.id, event.relation])).toEqual([['sunrise', 'during']]);
        expect(trip.moon).toBeDefined();
    });

    it('has the daylight of the day for a ride in it: the sunrise before and the sunset after, and no moon', () => {
        const trip = tripOf(Date.UTC(2026, 5, 21, 10, 0));
        expect(trip.events.map((event) => [event.id, event.relation])).toEqual([
            ['sunrise', 'before'],
            ['sunset', 'after']
        ]);
        expect(trip.darkMs).toBe(0);
        expect(trip.moon).toBeUndefined();
    });

    it('says how long before the start or after the end an event is, in ms', () => {
        // 12:00 to 15:00 in Grenoble: the sunrise at 06:03 is 5.9 h before, the sunset at 21:49 is 6.5 h after
        const [sunrise, sunset] = tripOf(Date.UTC(2026, 5, 21, 10, 0)).events;
        expect(sunrise.ms).toBeGreaterThan(5.5 * 3600000);
        expect(sunrise.ms).toBeLessThan(6.5 * 3600000);
        expect(sunset.ms).toBeGreaterThan(6 * 3600000);
        expect(sunset.ms).toBeLessThan(7 * 3600000);
        expect(tripOf(Date.UTC(2026, 5, 21, 17, 30)).events[0].ms).toBeUndefined();
    });

    it('has the moonset for a ride in the night by the light of the moon, and no sun', () => {
        // 00:00 to 03:00 in Grenoble in the night of the full moon: it sets at 05:46
        const trip = tripOf(Date.UTC(2026, 6, 28, 22));
        expect(trip.events.map((event) => [event.id, event.relation])).toEqual([['moonset', 'after']]);
        expect(trip.moon.illumination).toBeGreaterThan(95);
    });

    it('has no event for a ride in a night with no moon in it', () => {
        const trip = tripOf(Date.UTC(2026, 6, 14, 22));
        expect(trip.events).toEqual([]);
        expect(trip.moon.illumination).toBeLessThan(5);
    });
});
