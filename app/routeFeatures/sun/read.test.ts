import type { Geometry } from 'geojson';
import { describe, expect, it } from 'vitest';
import { SUN_PALETTE_KEYS, type SunItem, readSun } from '~/routeFeatures/sun/read';
import { sunPositionAt } from '~/utils/astronomy/sun';
import { createAnalysis, withDeparture } from '~/utils/routeAnalysis/storage';
import type { RouteAnalysis, WeatherData } from '~/utils/routeAnalysis/types';

const START = { lat: 45.19, lon: 5.72 };
const COUNT = 41;
// 20 km from Grenoble in 41 vertices, toward the way the sun sets in June (295 degrees)
const geometry: Geometry = lineToward(295);

function lineToward(bearing: number): Geometry {
    const radians = (bearing * Math.PI) / 180;
    const kilometers = 20;
    const lonSpan = (kilometers * Math.sin(radians)) / (111.32 * Math.cos((START.lat * Math.PI) / 180));
    const latSpan = (kilometers * Math.cos(radians)) / 111.32;
    return { type: 'LineString', coordinates: Array.from({ length: COUNT }, (_, index) => [START.lon + (lonSpan * index) / (COUNT - 1), START.lat + (latSpan * index) / (COUNT - 1)]) };
}
const HOUR = 3600000;
const NOW = Date.UTC(2026, 5, 1);
const KEY = SUN_PALETTE_KEYS;

function itemLeaving(at: number, type = 'bicycle', weather?: WeatherData, line = geometry, hours = 3): SunItem {
    const base = withDeparture(createAnalysis(line), line, { mode: 'planned', at });
    const analysis: RouteAnalysis = weather ? { ...base, layers: { weather: { prov: { computedAt: NOW, inputsHash: '', provider: 'test', quality: 'ok' }, data: weather } } } : base;
    return { geometry: line, route: { totalTime: hours * 3600 }, properties: { route: { type } }, analysis };
}

/** the classes the line goes through, in order */
const sequence = (item: SunItem) => {
    const keys = readSun(item, NOW).slices.map((slice) => slice.k);
    return keys.filter((key, index) => key !== keys[index - 1]);
};

function weatherOf(from: number, dni: number, cloud = 0): WeatherData {
    const hours = 6;
    const column = (value: number) => [Array(hours).fill(value), Array(hours).fill(value)];
    return {
        samples: [
            { i: 0, d: 0, alt: 300 },
            { i: COUNT - 1, d: 20000, alt: 300 }
        ],
        t0: from / 1000,
        n: hours,
        v: {
            temp: column(0),
            precip: column(0),
            precipProb: column(0),
            wind: column(0),
            gust: column(0),
            dir: column(0),
            cloud: column(cloud),
            code: column(0),
            fl: column(0),
            dni: column(dni)
        },
        request: { decimals: 2, vars: [], models: '' }
    };
}

const coordinatesOf = (line: Geometry) => (line.type === 'LineString' ? line.coordinates : []);

describe('readSun', () => {
    it('says nothing of a route without a line', () => {
        expect(readSun({ analysis: createAnalysis(geometry) }, NOW)).toBeNull();
    });

    it('is daylight all along a ride at noon', () => {
        const read = readSun(itemLeaving(Date.UTC(2026, 5, 21, 10, 0)), NOW);
        expect(read.slices).toEqual([{ i0: 0, i1: COUNT - 1, k: KEY.day, s: 0 }]);
        expect(read.summary).toEqual({ darkMs: 0, glareDistance: 0 });
    });

    it('goes from day to night on a ride into the evening, blinded while it rides toward the sun', () => {
        // 19:30 to 22:30 in Grenoble: the sun sets at 21:30 and it is dark by 22:00
        expect(sequence(itemLeaving(Date.UTC(2026, 5, 21, 17, 30)))).toEqual([KEY.day, KEY.glare, KEY.twilight, KEY.night]);
    });

    it('is the low sun, not glare, when the ride turns its back to it', () => {
        const east = lineToward(115);
        expect(sequence(itemLeaving(Date.UTC(2026, 5, 21, 18, 45), 'bicycle', undefined, east, 1))).toEqual([KEY.low, KEY.twilight]);
    });

    it('cuts the line in contiguous slices from the first vertex to the last', () => {
        const { slices } = readSun(itemLeaving(Date.UTC(2026, 5, 21, 17, 30)), NOW);
        expect(slices[0].i0).toBe(0);
        expect(slices[slices.length - 1].i1).toBe(COUNT - 1);
        slices.slice(1).forEach((slice, index) => expect(slice.i0).toBe(slices[index].i1));
    });

    it('gives the slices in metres for the profile, as long as the route', () => {
        const read = readSun(itemLeaving(Date.UTC(2026, 5, 21, 17, 30)), NOW);
        expect(read.runs.map((run) => run.k)).toEqual(read.slices.map((slice) => slice.k));
        expect(read.runs[0].from).toBe(0);
        expect(read.runs[read.runs.length - 1].to).toBeCloseTo(20000, -3);
        read.runs.slice(1).forEach((run, index) => expect(run.from).toBe(read.runs[index].to));
    });

    it('tells where the sun sets, the dark ms and the km into the glare', () => {
        const { summary } = readSun(itemLeaving(Date.UTC(2026, 5, 21, 17, 30)), NOW);
        expect(summary.sunset.at).toBeGreaterThan(Date.UTC(2026, 5, 21, 19, 15));
        expect(summary.sunset.at).toBeLessThan(Date.UTC(2026, 5, 21, 19, 45));
        expect(summary.sunset.distance).toBeGreaterThan(0);
        expect(summary.darkMs).toBeGreaterThan(0);
        expect(summary.glareDistance).toBeGreaterThan(0);
    });

    it('lets a lower glare angle blind for fewer km', () => {
        const item = itemLeaving(Date.UTC(2026, 5, 21, 17, 30));
        const wide = readSun(item, NOW).summary.glareDistance;
        expect(readSun(item, NOW, { glareBelow: 6 }).summary.glareDistance).toBeLessThan(wide);
    });

    it('blinds a walker less than a rider: the sun has to be lower', () => {
        const bike = readSun(itemLeaving(Date.UTC(2026, 5, 21, 17, 30), 'bicycle'), NOW).summary.glareDistance;
        const walk = readSun(itemLeaving(Date.UTC(2026, 5, 21, 17, 30), 'pedestrian'), NOW).summary.glareDistance;
        expect(walk).not.toBe(bike);
    });

    it('is overcast when the forecast lets no direct sun through', () => {
        const at = Date.UTC(2026, 5, 21, 10, 0);
        expect(readSun(itemLeaving(at, 'bicycle', weatherOf(at - HOUR, 0, 100)), NOW).slices).toEqual([{ i0: 0, i1: COUNT - 1, k: KEY.overcast, s: 0 }]);
    });

    it('stays day under a clear forecast', () => {
        const at = Date.UTC(2026, 5, 21, 10, 0);
        expect(readSun(itemLeaving(at, 'bicycle', weatherOf(at - HOUR, 900, 0)), NOW).slices).toEqual([{ i0: 0, i1: COUNT - 1, k: KEY.day, s: 0 }]);
    });

    it('does not say overcast for the night', () => {
        const at = Date.UTC(2026, 5, 21, 22, 30);
        const keys = readSun(itemLeaving(at, 'bicycle', weatherOf(at - HOUR, 0, 100)), NOW).slices.map((slice) => slice.k);
        expect(keys).not.toContain(KEY.overcast);
    });

    it('reads the sun at a vertex as the ride gets there', () => {
        const item = itemLeaving(Date.UTC(2026, 5, 21, 10, 0));
        const read = readSun(item, NOW);
        const point = read.at(20);
        const [lon, lat] = coordinatesOf(geometry)[20];
        // half way of a three hour ride
        expect(point.at).toBeCloseTo(Date.UTC(2026, 5, 21, 11, 30), -4);
        expect(point.altitude).toBeCloseTo(sunPositionAt(point.at, { lat, lon }).altitude, 5);
        // the sun is due south at noon, the route goes north-west: it is on the left
        expect(point.side).toBe('left');
    });
});
