import type { Geometry } from 'geojson';
import { describe, expect, it } from 'vitest';
import { lensPalette } from '~/routeFeatures/lens/lensPalette';
import { sunPalette } from '~/routeFeatures/sun/palette';
import { type SunItem, readSun } from '~/routeFeatures/sun/read';
import { SUN_EVENT_PALETTE_KEYS, sunSymbols } from '~/routeFeatures/sun/symbols';
import { createAnalysis, withDeparture } from '~/utils/routeAnalysis/storage';

const START = { lat: 45.19, lon: 5.72 };
const COUNT = 41;
// 20 km from Grenoble toward the way the sun sets in June (295 degrees)
const geometry: Geometry = (() => {
    const radians = (295 * Math.PI) / 180;
    const lonSpan = (20 * Math.sin(radians)) / (111.32 * Math.cos((START.lat * Math.PI) / 180));
    const latSpan = (20 * Math.cos(radians)) / 111.32;
    return { type: 'LineString', coordinates: Array.from({ length: COUNT }, (_, index) => [START.lon + (lonSpan * index) / (COUNT - 1), START.lat + (latSpan * index) / (COUNT - 1)]) };
})();
const NOW = Date.UTC(2026, 5, 1);

function readLeaving(at: number, hours = 3) {
    const analysis = withDeparture(createAnalysis(geometry), geometry, { mode: 'planned', at });
    const item: SunItem = { geometry, route: { totalTime: hours * 3600 }, properties: { route: { type: 'bicycle' } }, analysis };
    return readSun(item, NOW);
}
const clock = (at: number) => `t${at}`;

describe('sunSymbols', () => {
    it('puts a marker where the sun goes down, with the time it does in the zone of the route', () => {
        const read = readLeaving(Date.UTC(2026, 5, 21, 17, 30));
        const symbols = sunSymbols(read, clock);
        expect(symbols).toHaveLength(1);
        const [marker] = symbols;
        expect(marker.shape).toBe('marker');
        expect(marker.glyph).toBe('mdi-weather-sunset-down');
        expect(marker.label).toBe(clock(read.summary.sunset.at));
        expect(marker.tint).toBe(SUN_EVENT_PALETTE_KEYS.sunset);
        // at the look the sun went down at, not between two
        const sample = read.samples.find((candidate) => candidate.vertex === marker.vertex);
        expect(sample).toBeDefined();
        expect(read.at(marker.vertex).at).toBe(read.summary.sunset.at);
    });

    it('puts a marker where the sun rises on a ride that starts in the dark', () => {
        const read = readLeaving(Date.UTC(2026, 5, 21, 2, 30));
        const symbols = sunSymbols(read, clock);
        expect(symbols.map(({ glyph }) => glyph)).toEqual(['mdi-weather-sunset-up']);
        expect(symbols[0].label).toBe(clock(read.summary.sunrise.at));
        expect(symbols[0].tint).toBe(SUN_EVENT_PALETTE_KEYS.sunrise);
    });

    it('has none for a ride all in daylight, or all in the dark', () => {
        expect(sunSymbols(readLeaving(Date.UTC(2026, 5, 21, 10, 0)), clock)).toEqual([]);
        expect(sunSymbols(readLeaving(Date.UTC(2026, 5, 21, 22, 30)), clock)).toEqual([]);
    });

    it('has both, in the order of the ride, for a ride from one night to the next evening', () => {
        const read = readLeaving(Date.UTC(2026, 5, 21, 2, 30), 20);
        const symbols = sunSymbols(read, clock);
        expect(symbols.map(({ glyph }) => glyph)).toEqual(['mdi-weather-sunset-up', 'mdi-weather-sunset-down']);
        expect(symbols[0].vertex).toBeLessThan(symbols[1].vertex);
    });
});

describe('the palette of the sun markers', () => {
    it('has a colour for each event in every variant, the lens palette keeps the ones of the classes', () => {
        (['light', 'dark', 'eink'] as const).forEach((variant) => {
            const palette = lensPalette(variant, [sunPalette]);
            Object.values(SUN_EVENT_PALETTE_KEYS).forEach((key) => expect(palette[key]).toMatch(/^#[0-9a-f]{6}$/i));
            expect(palette.sun_day).toMatch(/^#[0-9a-f]{6}$/i);
        });
    });
});
