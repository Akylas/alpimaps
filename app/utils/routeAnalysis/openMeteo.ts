/** Open-Meteo as a weather provider. Pure: nothing here may import NativeScript. */
import { type WeatherHttp, type WeatherProvider, WeatherProviderError, type WeatherQuery, type WeatherResponse } from './weatherProvider';
import type { WeatherVar } from './weatherSeries';

const FORECAST_URL = 'https://api.open-meteo.com/v1/forecast';
const DAY = 86400;
const HOUR = 3600;
/** the model Open-Meteo picks for the place: AROME, ICON-D2, ICON-CH1... where they cover, a global one elsewhere */
const MODELS = 'best_match';

/** In the order of the request. Ten variables: more count as several calls against the free quota. */
const VARIABLES: [string, WeatherVar][] = [
    ['temperature_2m', 'temp'],
    ['precipitation', 'precip'],
    ['precipitation_probability', 'precipProb'],
    ['weather_code', 'code'],
    ['cloud_cover', 'cloud'],
    ['wind_speed_10m', 'wind'],
    ['wind_direction_10m', 'dir'],
    ['wind_gusts_10m', 'gust'],
    ['freezing_level_height', 'fl'],
    ['direct_normal_irradiance', 'dni']
];

const day = (epochSeconds: number) => new Date(epochSeconds * 1000).toISOString().slice(0, 10);

/**
 * The dates are those of the place, which is not known before the answer: a day more on each side
 * makes sure the window is in, and `parseOpenMeteo` cuts the rest.
 */
export function openMeteoUrl({ from, points, to }: WeatherQuery): string {
    const params = [
        `latitude=${points.map((point) => point.lat).join(',')}`,
        `longitude=${points.map((point) => point.lon).join(',')}`,
        // without an altitude for every point the model uses its own terrain
        ...(points.every((point) => Number.isFinite(point.alt)) ? [`elevation=${points.map((point) => Math.round(point.alt)).join(',')}`] : []),
        `hourly=${VARIABLES.map(([name]) => name).join(',')}`,
        'timezone=auto',
        'timeformat=unixtime',
        'wind_speed_unit=kmh',
        `start_date=${day(from - DAY)}`,
        `end_date=${day(to + DAY)}`
    ];
    return `${FORECAST_URL}?${params.join('&')}`;
}

interface OpenMeteoLocation {
    hourly: { time: number[] } & Record<string, (number | null)[]>;
    timezone?: string;
    utc_offset_seconds?: number;
}

function isLocation(value: unknown): value is OpenMeteoLocation {
    if (!value || typeof value !== 'object' || !('hourly' in value)) {
        return false;
    }
    const { hourly } = value;
    return !!hourly && typeof hourly === 'object' && 'time' in hourly && Array.isArray(hourly.time);
}

/** One object for one point, a list for several. */
export function parseOpenMeteo(json: unknown, { from, points, to }: WeatherQuery): WeatherResponse {
    const answers: unknown[] = Array.isArray(json) ? json : [json];
    if (answers.length !== points.length || !answers.every(isLocation)) {
        throw new WeatherProviderError('error', 'Open-Meteo answered for other points than asked');
    }
    const locations = answers.filter(isLocation);
    const time = locations[0].hourly.time;
    const first = time.findIndex((hour) => hour >= from);
    const last = time.findLastIndex((hour) => hour <= to);
    if (first < 0 || last < first || locations.some((location) => location.hourly.time[0] !== time[0] || location.hourly.time.length !== time.length)) {
        throw new WeatherProviderError('out-of-coverage', 'Open-Meteo has not the hours asked');
    }
    const series = locations.map(({ hourly }) => {
        const result: WeatherResponse['series'][number] = {};
        VARIABLES.forEach(([name, variable]) => {
            if (hourly[name]) {
                result[variable] = hourly[name].slice(first, last + 1);
            }
        });
        return result;
    });
    const [{ timezone, utc_offset_seconds: offset }] = locations;
    return {
        t0: time[first],
        n: last - first + 1,
        series,
        tz: timezone,
        utcOffset: typeof offset === 'number' ? offset / (HOUR / 60) : undefined,
        vars: VARIABLES.map(([name]) => name),
        models: MODELS
    };
}

function statusOf(error: unknown): number | undefined {
    return error && typeof error === 'object' && 'statusCode' in error && typeof error.statusCode === 'number' ? error.statusCode : undefined;
}

/** What it forecasts: about two weeks ahead, three months back. */
const FORECAST_DAYS = 15;
const PAST_DAYS = 90;
const DAY_MS = DAY * 1000;

export const openMeteoProvider: WeatherProvider = {
    id: 'open-meteo',
    name: 'Open-Meteo',
    source: 'open-meteo/forecast',
    attribution: { text: 'Weather data by Open-Meteo.com', url: 'https://open-meteo.com/', license: 'CC BY 4.0' },
    maxPoints: 100,
    async fetch(query: WeatherQuery, http: WeatherHttp) {
        let json: unknown;
        try {
            json = await http(openMeteoUrl(query));
        } catch (error) {
            const message = error instanceof Error ? error.message : undefined;
            // the free quota is shared by everyone behind the same address. A 400 is the dates further than it forecasts, only when they are:
            // the body, which says why, does not reach us, and a 400 for anything else is a mistake of ours to see as it is
            const beyond = query.to * 1000 > Date.now() + FORECAST_DAYS * DAY_MS || query.from * 1000 < Date.now() - PAST_DAYS * DAY_MS;
            if (statusOf(error) === 429) {
                throw new WeatherProviderError('rate-limited', message);
            }
            if (statusOf(error) === 400 && beyond) {
                throw new WeatherProviderError('out-of-coverage', message);
            }
            throw error;
        }
        return parseOpenMeteo(json, query);
    }
};
