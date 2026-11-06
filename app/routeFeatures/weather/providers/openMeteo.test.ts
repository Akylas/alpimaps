import { describe, expect, it } from 'vitest';
import { openMeteoProvider, openMeteoUrl, parseOpenMeteo } from '~/routeFeatures/weather/providers/openMeteo';
import { WeatherProviderError, type WeatherQuery } from '~/routeFeatures/weather/providers/provider';

const DAY = 86400;
const HOUR = 3600;
// a UTC midnight
const MIDNIGHT = 1_800_057_600 - (1_800_057_600 % DAY);

const query: WeatherQuery = {
    points: [
        { lat: 45.5, lon: 5.9, alt: 900 },
        { lat: 45.6, lon: 6, alt: 1500 }
    ],
    from: MIDNIGHT + DAY,
    to: MIDNIGHT + 2 * DAY
};

/** What Open-Meteo answers for a location: `hours` hours from `start`, the temperature climbing 1 °C an hour. */
function location(start: number, hours: number, overrides: Record<string, unknown> = {}) {
    const time = Array.from({ length: hours }, (_, index) => start + index * HOUR);
    return {
        utc_offset_seconds: 3600,
        timezone: 'Europe/Paris',
        hourly: {
            time,
            temperature_2m: time.map((_, index) => index),
            precipitation: time.map(() => 0.2),
            precipitation_probability: time.map(() => null),
            weather_code: time.map(() => 3),
            cloud_cover: time.map(() => 50),
            wind_speed_10m: time.map(() => 12),
            wind_direction_10m: time.map(() => 270),
            wind_gusts_10m: time.map(() => 30),
            freezing_level_height: time.map(() => 2500),
            direct_normal_irradiance: time.map(() => 0),
            ...overrides
        }
    };
}

describe('openMeteoUrl', () => {
    const url = new URL(openMeteoUrl(query));
    const param = (name: string) => url.searchParams.get(name);

    it('asks the forecast api for every point in one request', () => {
        expect(url.origin + url.pathname).toBe('https://api.open-meteo.com/v1/forecast');
        expect(param('latitude')).toBe('45.5,45.6');
        expect(param('longitude')).toBe('5.9,6');
        expect(param('elevation')).toBe('900,1500');
    });

    it('asks the ten hourly variables, in the units the layer is stored in', () => {
        expect(param('hourly')?.split(',')).toEqual([
            'temperature_2m',
            'precipitation',
            'precipitation_probability',
            'weather_code',
            'cloud_cover',
            'wind_speed_10m',
            'wind_direction_10m',
            'wind_gusts_10m',
            'freezing_level_height',
            'direct_normal_irradiance'
        ]);
        expect(param('wind_speed_unit')).toBe('kmh');
    });

    it('asks UTC times and the zone of the place', () => {
        expect(param('timeformat')).toBe('unixtime');
        expect(param('timezone')).toBe('auto');
    });

    it('asks a day more on each side: its dates are in the place zone, not UTC', () => {
        const day = (epoch: number) => new Date(epoch * 1000).toISOString().slice(0, 10);
        expect(param('start_date')).toBe(day(query.from - DAY));
        expect(param('end_date')).toBe(day(query.to + DAY));
    });

    it('leaves the elevations to the model when a point has none', () => {
        const noAltitude = new URL(openMeteoUrl({ ...query, points: [query.points[0], { ...query.points[1], alt: NaN }] }));
        expect(noAltitude.searchParams.has('elevation')).toBe(false);
    });
});

describe('parseOpenMeteo', () => {
    // a day before and after the window, as asked
    const json = [location(MIDNIGHT, 96), location(MIDNIGHT, 96, { temperature_2m: Array.from({ length: 96 }, (_, index) => 100 + index) })];

    it('gives the series of each point under the layer names', () => {
        const response = parseOpenMeteo(json, query);
        expect(response.series).toHaveLength(2);
        expect(response.series[0].wind).toEqual(Array(response.n).fill(12));
        expect(response.series[0].dir?.[0]).toBe(270);
        expect(response.series[0].fl?.[0]).toBe(2500);
        expect(response.series[0].dni?.[0]).toBe(0);
    });

    it('keeps the hours of the window, both ends included', () => {
        const response = parseOpenMeteo(json, query);
        expect(response.t0).toBe(query.from);
        expect(response.n).toBe(DAY / HOUR + 1);
        expect(response.series[0].temp?.[0]).toBe(24);
        expect(response.series[1].temp?.[0]).toBe(124);
        expect(response.series[0].temp?.[response.n - 1]).toBe(48);
    });

    it('keeps what the model has when its horizon ends inside the window', () => {
        const short = [location(MIDNIGHT, 36)];
        const response = parseOpenMeteo(short, { ...query, points: [query.points[0]] });
        expect(response.t0).toBe(query.from);
        expect(response.n).toBe(36 - 24);
    });

    it('keeps the hours it has no value for as null', () => {
        expect(parseOpenMeteo(json, query).series[0].precipProb?.[0]).toBeNull();
    });

    it('takes the zone of the first point, the offset in minutes', () => {
        const response = parseOpenMeteo(json, query);
        expect(response.tz).toBe('Europe/Paris');
        expect(response.utcOffset).toBe(60);
    });

    it('reads the single object it answers for one point', () => {
        const response = parseOpenMeteo(location(MIDNIGHT, 96), { ...query, points: [query.points[0]] });
        expect(response.series).toHaveLength(1);
    });

    it('says what it was asked', () => {
        const response = parseOpenMeteo(json, query);
        expect(response.models).toBe('best_match');
        expect(response.vars).toContain('temperature_2m');
    });

    it('is an error when it does not answer for every point', () => {
        expect(() => parseOpenMeteo([location(MIDNIGHT, 96)], query)).toThrow(WeatherProviderError);
    });

    it('is an error when the hours are missing', () => {
        expect(() => parseOpenMeteo({ error: true, reason: 'nope' }, { ...query, points: [query.points[0]] })).toThrow(WeatherProviderError);
    });

    it('is an error when the window is not in what it gave', () => {
        expect(() => parseOpenMeteo([location(MIDNIGHT + 10 * DAY, 24), location(MIDNIGHT + 10 * DAY, 24)], query)).toThrow(WeatherProviderError);
    });
});

describe('openMeteoProvider', () => {
    it('is the default provider, attributed as it asks', () => {
        expect(openMeteoProvider.id).toBe('open-meteo');
        expect(openMeteoProvider.source).toBe('open-meteo/forecast');
        expect(openMeteoProvider.attribution.text).toBe('Weather data by Open-Meteo.com');
        expect(openMeteoProvider.attribution.license).toBe('CC BY 4.0');
        expect(openMeteoProvider.attribution.url).toBe('https://open-meteo.com/');
    });

    it('gets the url once and parses the answer', async () => {
        const urls: string[] = [];
        const response = await openMeteoProvider.fetch(query, async (url) => {
            urls.push(url);
            return [location(MIDNIGHT, 96), location(MIDNIGHT, 96)];
        });
        expect(urls).toEqual([openMeteoUrl(query)]);
        expect(response.n).toBe(25);
    });

    it('says the limit was reached on a 429', async () => {
        const http = async () => {
            throw Object.assign(new Error('Too many requests'), { statusCode: 429 });
        };
        await expect(openMeteoProvider.fetch(query, http)).rejects.toMatchObject({ reason: 'rate-limited' });
    });

    it('says the dates are out of its range on a 400', async () => {
        const http = async () => {
            throw Object.assign(new Error('Parameter start_date is out of allowed range'), { statusCode: 400 });
        };
        await expect(openMeteoProvider.fetch(query, http)).rejects.toMatchObject({ reason: 'out-of-coverage' });
    });

    it('lets a 400 through as the failure it is when the dates are ones it forecasts: that is a mistake of ours', async () => {
        const today = Math.floor(Date.now() / 1000 / DAY) * DAY;
        const near = { ...query, from: today, to: today + DAY };
        const failure = Object.assign(new Error('Parameter hourly is wrong'), { statusCode: 400 });
        await expect(
            openMeteoProvider.fetch(near, async () => {
                throw failure;
            })
        ).rejects.toBe(failure);
    });

    it('says the dates are out of its range for a 400 on a day too far behind', async () => {
        const old = Math.floor(Date.now() / 1000 / DAY) * DAY - 200 * DAY;
        const http = async () => {
            throw Object.assign(new Error('out of range'), { statusCode: 400 });
        };
        await expect(openMeteoProvider.fetch({ ...query, from: old, to: old + DAY }, http)).rejects.toMatchObject({ reason: 'out-of-coverage' });
    });

    it('lets any other failure through as it is', async () => {
        const failure = new Error('socket closed');
        await expect(
            openMeteoProvider.fetch(query, async () => {
                throw failure;
            })
        ).rejects.toBe(failure);
    });

    it('does not ask more points than it takes', () => {
        expect(openMeteoProvider.maxPoints).toBeGreaterThanOrEqual(40);
    });
});
