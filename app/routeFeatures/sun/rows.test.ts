import type { Geometry } from 'geojson';
import { describe, expect, it } from 'vitest';
import type { RoutePageRow } from '~/routeFeatures/registry';
import { type SunRowData, sunRows } from '~/routeFeatures/sun/rows';
import { type SunItem, readSun } from '~/routeFeatures/sun/read';
import { createAnalysis, withDeparture } from '~/utils/routeAnalysis/storage';

const COUNT = 41;
// 20 km north-west of Grenoble
const geometry: Geometry = {
    type: 'LineString',
    coordinates: Array.from({ length: COUNT }, (_, index) => [5.72 - (0.2304 * index) / (COUNT - 1), 45.19 + (0.0759 * index) / (COUNT - 1)])
};
const NOW = Date.UTC(2026, 5, 1);

function rowsFor(at: number): SunRowData[] {
    const analysis = withDeparture(createAnalysis(geometry), geometry, { mode: 'planned', at });
    const item: SunItem = { geometry, route: { totalTime: 3 * 3600 }, properties: { route: { type: 'bicycle' } }, analysis };
    return sunRows(readSun(item, NOW)).map((row: RoutePageRow) => row.data as SunRowData);
}

const HOUR = 3600000;
const of = <Type extends SunRowData['type']>(rows: SunRowData[], type: Type) => rows.filter((row): row is Extract<SunRowData, { type: Type }> => row.type === type);

describe('sunRows', () => {
    it('has no rows before the sun is read', () => {
        expect(sunRows(null)).toEqual([]);
    });

    it('starts with the bar of what the route is made of, by class, and ends with the note', () => {
        const rows = rowsFor(Date.UTC(2026, 5, 21, 17, 30));
        expect(rows[0].type).toBe('bar');
        expect(rows[rows.length - 1].type).toBe('note');
        const [bar] = of(rows, 'bar');
        expect(bar.shares.map((share) => share.k)).toEqual(['day', 'glare', 'twilight', 'moonlit']);
        expect(bar.shares.reduce((sum, share) => sum + share.meters, 0)).toBeCloseTo(20000, -3);
    });

    it('says when the ride starts and ends', () => {
        const [times] = of(rowsFor(Date.UTC(2026, 5, 21, 10, 0)), 'times');
        expect(times.start).toBe(Date.UTC(2026, 5, 21, 10, 0));
        expect(times.end).toBe(Date.UTC(2026, 5, 21, 13, 0));
    });

    it('puts the sunset and the dusk at a distance when the ride is out then', () => {
        const events = of(rowsFor(Date.UTC(2026, 5, 21, 17, 30)), 'event').filter((row) => row.id === 'sunset' || row.id === 'dusk');
        expect(events.map((row) => [row.id, row.relation])).toEqual([
            ['sunset', 'during'],
            ['dusk', 'during']
        ]);
        expect(events[0].distance).toBeGreaterThan(0);
        expect(events[1].distance).toBeGreaterThan(events[0].distance);
    });

    it('says how long after the ride the sun goes down, when it does after', () => {
        const [sunset] = of(rowsFor(Date.UTC(2026, 5, 21, 10, 0)), 'event');
        expect(sunset.relation).toBe('after');
        // the ride ends at 13:00 UTC, the sun sets at 19:30
        expect(sunset.ms).toBeGreaterThan(5.5 * 3600000);
    });

    it('says how long before the ride the sun went down, for a ride in the night', () => {
        const [sunset] = of(rowsFor(Date.UTC(2026, 5, 21, 21, 0)), 'event');
        expect(sunset.relation).toBe('before');
        expect(sunset.ms).toBeGreaterThan(0);
    });

    it('says the dark and the glare when there are some, and nothing of them when there are none', () => {
        const evening = rowsFor(Date.UTC(2026, 5, 21, 17, 30));
        expect(of(evening, 'dark')[0].ms).toBeGreaterThan(0);
        expect(of(evening, 'glare')[0].meters).toBeGreaterThan(0);
        const noon = rowsFor(Date.UTC(2026, 5, 21, 10, 0));
        expect(of(noon, 'dark')).toEqual([]);
        expect(of(noon, 'glare')).toEqual([]);
    });

    it('gives the shares of the sun on each side of the way, by day only', () => {
        const [side] = of(rowsFor(Date.UTC(2026, 5, 21, 10, 0)), 'side');
        expect(side.left + side.right + side.ahead + side.behind).toBeCloseTo(1, 5);
        expect(of(rowsFor(Date.UTC(2026, 5, 21, 21, 0)), 'side').filter((row) => row.body === 'sun')).toEqual([]);
    });

    it('says nothing of the moon for a ride in daylight', () => {
        const rows = rowsFor(Date.UTC(2026, 5, 21, 10, 0));
        expect(of(rows, 'event').map((row) => row.id)).toEqual(['sunset', 'dusk']);
        expect(of(rows, 'side').map((row) => row.body)).toEqual(['sun']);
    });

    it('puts the moonrise before a ride in the night of the full moon and the moonset after it', () => {
        // 00:00 to 03:00 in Grenoble on the 29th of July 2026: the moon rose at 20:30 the evening before and sets at 05:46
        const events = of(rowsFor(Date.UTC(2026, 6, 28, 22)), 'event');
        const rise = events.find((row) => row.id === 'moonrise');
        const set = events.find((row) => row.id === 'moonset');
        expect(rise.relation).toBe('before');
        expect(rise.ms).toBeGreaterThan(2 * HOUR);
        expect(set.relation).toBe('after');
        expect(set.ms).toBeGreaterThan(2 * HOUR);
        expect(set.ms).toBeLessThan(4 * HOUR);
    });

    it('says where the moon is for the metres it lights, after the sun for the day', () => {
        const sides = of(rowsFor(Date.UTC(2026, 6, 28, 22)), 'side');
        expect(sides.map((row) => row.body)).toEqual(['moon']);
        expect(sides[0].left + sides[0].behind).toBeCloseTo(1, 5);
    });

    it('takes the last moonrise before the ride, not one of the days before', () => {
        // the moon rises an hour later every day after the full moon: on the 31st of July it rose in the evening, 22:00 UTC is after it
        const rise = of(rowsFor(Date.UTC(2026, 6, 31, 22)), 'event').find((row) => row.id === 'moonrise');
        expect(rise.at).toBeGreaterThan(Date.UTC(2026, 6, 31, 12));
        expect(rise.relation).toBe('before');
    });
});
