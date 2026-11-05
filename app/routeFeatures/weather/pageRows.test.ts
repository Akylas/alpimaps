import { describe, expect, it } from 'vitest';
import type { RideRow } from './read';
import { rainColor, tempColor, weatherRows } from './pageRows';

const attribution = { text: 'Weather data by Open-Meteo.com', url: 'https://open-meteo.com/', license: 'CC BY 4.0' };
const footer = { provider: 'Open-Meteo', attribution, updatedAt: 1, decimals: 2, outdated: false, canUpdate: true };
const fetch = { state: 'absent' as const, points: 12, decimals: 2, provider: 'Open-Meteo' };
const row = (index: number): RideRow => ({ index, i: index * 10, i0: 0, i1: 10, distance: index * 1000, at: 0, precip: 0, rain: 0 });
const read = { summary: { rainTotal: 0, headShare: 0, tailShare: 0, thunder: false }, rows: [row(0), row(1)] };

describe('weatherRows', () => {
    it('is the way to ask for a forecast when there is none', () => {
        expect(weatherRows({ read: null, footer, fetch, detailsOpen: false })).toEqual([{ key: 'fetch', data: { type: 'fetch', ...fetch } }]);
    });

    it('lists the summary and a header for the details, closed: the samples are a click away, as the steep sections are', () => {
        const rows = weatherRows({ read, footer, fetch, detailsOpen: false });
        expect(rows.map(({ key }) => key)).toEqual(['summary', 'details', 'footer']);
        expect(rows[1].data).toEqual({ type: 'details', open: false, count: 2 });
    });

    it('lists a row for each sample in the order of the ride under the header when it is open', () => {
        expect(weatherRows({ read, footer, fetch, detailsOpen: true }).map(({ key }) => key)).toEqual(['summary', 'details', 'ride0', 'ride1', 'footer']);
    });

    it('gives each row its own data', () => {
        const rows = weatherRows({ read, footer, fetch, detailsOpen: true });
        expect(rows[2].data).toEqual({ type: 'ride', row: read.rows[0] });
        expect(rows[4].data).toMatchObject({ type: 'footer', provider: 'Open-Meteo', decimals: 2 });
    });
});

describe('tempColor', () => {
    it('says only the cold and the heat: the rest is neutral', () => {
        expect(tempColor(-5)).toBeDefined();
        expect(tempColor(0)).toBeDefined();
        expect(tempColor(12)).toBeUndefined();
        expect(tempColor(24)).toBeUndefined();
        expect(tempColor(27)).toBeDefined();
        expect(tempColor(35)).not.toBe(tempColor(27));
    });

    it('is blue under freezing and warm over', () => {
        expect(tempColor(-3)).toBe('#3F8FE0');
        expect(tempColor(30)).toBe('#F29D38');
        expect(tempColor(36)).toBe('#D7263D');
    });
});

describe('rainColor', () => {
    it('is the blue of the profile, darker the harder it rains', () => {
        expect(rainColor(0)).toBeUndefined();
        expect(rainColor(0.5)).toBe('#4A90D9');
        expect(rainColor(5)).not.toBe(rainColor(0.5));
    });
});
