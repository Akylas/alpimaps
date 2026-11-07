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
        expect(bar.shares.map((share) => share.k)).toEqual(['day', 'glare', 'twilight', 'night']);
        expect(bar.shares.reduce((sum, share) => sum + share.meters, 0)).toBeCloseTo(20000, -3);
    });

    it('says when the ride starts and ends', () => {
        const [times] = of(rowsFor(Date.UTC(2026, 5, 21, 10, 0)), 'times');
        expect(times.start).toBe(Date.UTC(2026, 5, 21, 10, 0));
        expect(times.end).toBe(Date.UTC(2026, 5, 21, 13, 0));
    });

    it('puts the sunset and the dusk at a distance when the ride is out then', () => {
        const events = of(rowsFor(Date.UTC(2026, 5, 21, 17, 30)), 'event');
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
        expect(of(rowsFor(Date.UTC(2026, 5, 21, 21, 0)), 'side')).toEqual([]);
    });
});
