import { describe, expect, it } from 'vitest';
import { RAIN_BLUE, SUN_COLOR } from '~/routeFeatures/weather/ui/colors';
import type { RideRow } from '~/routeFeatures/weather/data/read';
import { SKY_MARKS, heroGlyph, isClearSky, skyId, weatherRows, windLabel } from '~/routeFeatures/weather/ui/pageRows';

const attribution = { text: 'Weather data by Open-Meteo.com', url: 'https://open-meteo.com/', license: 'CC BY 4.0' };
const footer = { attribution, updatedAt: 1, outdated: false, canUpdate: true };
const fetch = { state: 'absent' as const, points: 12, decimals: 2, provider: 'Open-Meteo' };
const row = (index: number): RideRow => ({ index, i: index * 10, i0: 0, i1: 10, distance: index * 1000, at: 0, precip: 0, rain: 0 });
const read = { summary: { rainTotal: 0, headShare: 0, tailShare: 0, thunder: false }, rows: [row(0), row(1)] };

describe('weatherRows', () => {
    it('is the way to ask for a forecast when there is none', () => {
        expect(weatherRows({ read: null, footer, fetch })).toEqual([{ key: 'fetch', data: { type: 'fetch', ...fetch } }]);
    });

    it('lists the summary, the samples as one strip in the order of the ride, then where the forecast comes from', () => {
        const rows = weatherRows({ read, footer, fetch });
        expect(rows.map(({ key }) => key)).toEqual(['summary', 'strip', 'footer']);
        expect(rows[1].data).toEqual({ type: 'strip', rows: read.rows });
        expect(rows[2].data).toMatchObject({ type: 'footer', updatedAt: 1, canUpdate: true });
    });
});

describe('heroGlyph', () => {
    const summary = { rainTotal: 0, headShare: 0, tailShare: 0, thunder: false };

    it('is the storm when there is thunder, whatever else', () => {
        expect(heroGlyph({ ...summary, thunder: true, rainTotal: 3, rainPeak: { mmPerHour: 3, distance: 0 } })).toBe('mdi-weather-lightning-rainy');
    });

    it('is rain when it rains, heavy from 4 mm/h', () => {
        expect(heroGlyph({ ...summary, rainTotal: 1, rainPeak: { mmPerHour: 1, distance: 0 } })).toBe('mdi-weather-rainy');
        expect(heroGlyph({ ...summary, rainTotal: 6, rainPeak: { mmPerHour: 5, distance: 0 } })).toBe('mdi-weather-pouring');
    });

    it('is the sky when it is dry: sun under 40 % of cloud, cloud from 70', () => {
        expect(heroGlyph({ ...summary, cloud: 10 })).toBe('mdi-weather-sunny');
        expect(heroGlyph({ ...summary, cloud: 50 })).toBe('mdi-weather-partly-cloudy');
        expect(heroGlyph({ ...summary, cloud: 90 })).toBe('mdi-weather-cloudy');
        expect(heroGlyph(summary)).toBe('mdi-weather-sunny');
    });
});

describe('windLabel', () => {
    it('says a headwind with how much of the wind is against the ride', () => {
        expect(windLabel(25, 18, 5)).toEqual({ kind: 'head', value: 18 });
    });

    it('says a tailwind with how much is behind', () => {
        expect(windLabel(25, -18, 5)).toEqual({ kind: 'tail', value: 18 });
    });

    it('says a crosswind when more of the wind is across than along', () => {
        expect(windLabel(25, 5, -20)).toMatchObject({ kind: 'cross', value: 20 });
        expect(windLabel(25, 5, 20)).toMatchObject({ kind: 'cross', value: 20 });
    });

    it('says calm for a wind of less than 3 km/h, and nothing without a wind', () => {
        expect(windLabel(2, 2, 0)).toEqual({ kind: 'calm', value: 0 });
        expect(windLabel(undefined, undefined, undefined)).toBeUndefined();
    });

    it('says which side a crosswind blows to: it comes from the right when across is above 0', () => {
        expect(windLabel(25, 0, 20)?.side).toBe('left');
        expect(windLabel(25, 0, -20)?.side).toBe('right');
        expect(windLabel(25, 20, 0)?.side).toBeUndefined();
    });
});

describe('skyId', () => {
    const summary = { rainTotal: 0, headShare: 0, tailShare: 0, thunder: false };

    it('is the sky of the ride in one word: the storm, the rain, or the sky of a dry one', () => {
        expect(skyId({ ...summary, cloud: 10 })).toBe('sunny');
        expect(skyId({ ...summary, cloud: 50 })).toBe('partly');
        expect(skyId({ ...summary, cloud: 90 })).toBe('cloudy');
        expect(skyId({ ...summary, rainTotal: 1, rainPeak: { mmPerHour: 1, distance: 0 } })).toBe('rainy');
        expect(skyId({ ...summary, rainTotal: 6, rainPeak: { mmPerHour: 5, distance: 0 } })).toBe('pouring');
        expect(skyId({ ...summary, thunder: true })).toBe('storm');
    });

    it('has a glyph and a colour for each sky: the sun is as plain as the rain and the cloud', () => {
        expect(Object.keys(SKY_MARKS).sort()).toEqual(['cloudy', 'partly', 'pouring', 'rainy', 'storm', 'sunny']);
        expect(SKY_MARKS.sunny).toEqual({ icon: 'mdi-weather-sunny', color: SUN_COLOR });
        expect(SKY_MARKS.rainy.color).toBe(RAIN_BLUE);
        expect(SKY_MARKS.storm.color).toBe(RAIN_BLUE);
        expect(SKY_MARKS.cloudy.color).not.toBe(SUN_COLOR);
    });
});

describe('isClearSky', () => {
    it('is the sun by day: a clear sky and no rain', () => {
        expect(isClearSky({ cloud: 10, precip: 0 })).toBe(true);
        expect(isClearSky({ code: 0, precip: 0 })).toBe(true);
        expect(isClearSky({ cloud: 60, precip: 0 })).toBe(false);
        expect(isClearSky({ cloud: 10, precip: 1 })).toBe(false);
    });

    it('is not the moon by night', () => {
        expect(isClearSky({ cloud: 10, precip: 0, moon: 'x' })).toBe(false);
    });
});
