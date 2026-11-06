/** The hourly series of a weather layer, and what it says at a time and place. Pure: nothing here may import NativeScript. */
import { bearingBetween } from '~/utils/geo';
import type { WeatherData } from '~/utils/routeAnalysis/types';
import type { WeatherSample } from '~/routeFeatures/weather/data/samples';

export type WeatherVar = keyof WeatherData['v'];

/** An hour the provider had no value for. */
export const MISSING = -32768;

const HOUR_SECONDS = 3600;
/** The stored int is the value times this: a tenth for what has decimals worth keeping. */
const SCALES: Record<WeatherVar, number> = { temp: 10, precip: 10, precipProb: 1, wind: 10, gust: 10, dir: 1, cloud: 1, code: 1, fl: 1, dni: 1 };

export function quantise(variable: WeatherVar, values: (number | null | undefined)[]): number[] {
    const scale = SCALES[variable];
    return values.map((value) => (typeof value === 'number' && Number.isFinite(value) ? Math.round(value * scale) : MISSING));
}

/** Real units: °C, mm/h, km/h, degrees, %, WMO code, m, W/m2. A variable the provider did not give is absent. */
export type WeatherReading = Partial<Record<WeatherVar, number>>;

/**
 * What the layer says of a sample at a time, epoch ms: undefined outside the fetched hours. Values between two hours are
 * interpolated, a direction the short way round, the code taken from the nearest hour. The rain of an hour is stamped at
 * its end, so a time reads the hour it is in.
 */
export function readSample(data: WeatherData, sample: number, epochMs: number): WeatherReading | undefined {
    const position = (epochMs / 1000 - data.t0) / HOUR_SECONDS;
    if (!data.samples[sample] || !(position >= 0 && position <= data.n - 1)) {
        return undefined;
    }
    const lower = Math.floor(position);
    const upper = Math.ceil(position);
    const fraction = position - lower;
    const reading: WeatherReading = {};
    (Object.keys(data.v) as WeatherVar[]).forEach((variable) => {
        const hours = data.v[variable]?.[sample];
        if (!hours) {
            return;
        }
        const scale = SCALES[variable];
        const at = (hour: number) => (hours[hour] === undefined || hours[hour] === MISSING ? undefined : hours[hour] / scale);
        let value: number | undefined;
        if (variable === 'precip') {
            value = at(upper);
        } else if (variable === 'code') {
            value = at(Math.round(position));
        } else {
            const from = at(lower);
            const to = at(upper);
            if (from === undefined || to === undefined || lower === upper) {
                value = lower === upper ? from : (from ?? to);
            } else if (variable === 'dir') {
                const turn = ((to - from + 540) % 360) - 180;
                value = (from + turn * fraction + 360) % 360;
            } else {
                value = from + (to - from) * fraction;
            }
        }
        if (value !== undefined) {
            reading[variable] = value;
        }
    });
    return reading;
}

/** `from` is where the wind comes from, as providers say it. Above 0 `head` is a headwind and `cross` a wind from the right. */
export function windRelative(wind: number, from: number, bearing: number): { head: number; cross: number } {
    const delta = (((from - bearing + 540) % 360) - 180) * (Math.PI / 180);
    return { head: wind * Math.cos(delta), cross: wind * Math.sin(delta) };
}

/** 0 dry (under 0.1 mm/h), 1 light, 2 steady (from 1), 3 heavy (from 4). */
export function rainClass(mmPerHour: number): 0 | 1 | 2 | 3 {
    return mmPerHour < 0.1 ? 0 : mmPerHour < 1 ? 1 : mmPerHour < 4 ? 2 : 3;
}

/**
 * The way the route goes at a vertex: from where it was `span` meters before to where it is `span` after, not
 * to the next vertex, which can zig-zag. Degrees clockwise from north; none when the route does not go anywhere.
 */
export function bearingAt(coordinates: number[][], distances: ArrayLike<number>, index: number, span = 300): number | undefined {
    const last = coordinates.length - 1;
    if (last < 1 || index < 0 || index > last) {
        return undefined;
    }
    const distance = distances[index];
    let before = index;
    while (before > 0 && distances[before] > distance - span) {
        before--;
    }
    let after = index;
    while (after < last && distances[after] < distance + span) {
        after++;
    }
    const [fromLon, fromLat] = coordinates[before];
    const [toLon, toLat] = coordinates[after];
    return fromLon === toLon && fromLat === toLat ? undefined : bearingBetween({ lat: fromLat, lon: fromLon }, { lat: toLat, lon: toLon });
}

export interface RideReading {
    sample: WeatherSample;
    /** epoch ms the ride is at the sample */
    at: number;
    reading?: WeatherReading;
    /** km/h, above 0 a headwind */
    head?: number;
    /** km/h, above 0 from the right */
    cross?: number;
}

/** What each sample says at the time the ride gets there, with the wind against the way the ride goes. */
export function readRide(data: WeatherData, { at, coordinates, distances }: { at: (index: number) => number; coordinates: number[][]; distances: ArrayLike<number> }): RideReading[] {
    return data.samples.map((sample, position) => {
        const time = at(sample.i);
        const reading = readSample(data, position, time);
        const result: RideReading = { sample, at: time, reading };
        const bearing = bearingAt(coordinates, distances, sample.i);
        if (reading?.wind !== undefined && reading.dir !== undefined && bearing !== undefined) {
            Object.assign(result, windRelative(reading.wind, reading.dir, bearing));
        }
        return result;
    });
}

/** The layer's series: [sample][hour] for each variable. A variable the source did not give is all missing. */
export function quantiseSeries(series: Partial<Record<WeatherVar, (number | null)[]>>[], hours: number): WeatherData['v'] {
    const column = (variable: WeatherVar) => series.map((sample) => quantise(variable, sample[variable] ?? Array(hours).fill(null)));
    return {
        temp: column('temp'),
        precip: column('precip'),
        precipProb: column('precipProb'),
        wind: column('wind'),
        gust: column('gust'),
        dir: column('dir'),
        cloud: column('cloud'),
        code: column('code'),
        fl: column('fl'),
        dni: column('dni')
    };
}
