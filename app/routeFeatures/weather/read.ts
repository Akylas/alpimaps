/** What a weather layer says of a route, for the lens, the chip and the profile. Pure: nothing here may import NativeScript. */
import { routeCoordinates } from '~/routeFeatures/lens/sections';
import type { LensSlice, LensSymbol } from '~/routeFeatures/registry';
import type { StageItem } from '~/utils/routeAnalysis/pipeline';
import { buildTimeline, timelineSource } from '~/utils/routeAnalysis/timeline';
import type { RouteAnalysis } from '~/utils/routeAnalysis/types';
import { type RideReading, type WeatherReading, bearingAt, rainClass, readRide, readSample, windRelative } from '~/utils/routeAnalysis/weatherSeries';

/** Material Design Icons, which the map labels have for sure. */
const glyph = (codePoint: number) => String.fromCodePoint(codePoint);
const MDI_SUNNY = glyph(0xf0599);
const MDI_PARTLY_CLOUDY = glyph(0xf0595);
const MDI_CLOUDY = glyph(0xf0590);
const MDI_FOG = glyph(0xf0591);
const MDI_RAINY = glyph(0xf0597);
const MDI_POURING = glyph(0xf0596);
const MDI_SNOWY = glyph(0xf0598);
const MDI_SNOWY_RAINY = glyph(0xf067f);
const MDI_LIGHTNING_RAINY = glyph(0xf067e);
const MDI_ARROW_UP = glyph(0xf005d);

/** The sky of a WMO weather code, as a glyph of the icon font. */
export function wxGlyph(code: number | undefined): string {
    switch (code) {
        case 0:
            return MDI_SUNNY;
        case 1:
        case 2:
            return MDI_PARTLY_CLOUDY;
        case 45:
        case 48:
            return MDI_FOG;
        case 51:
        case 53:
        case 55:
        case 61:
        case 63:
        case 80:
        case 81:
            return MDI_RAINY;
        case 65:
        case 82:
            return MDI_POURING;
        case 56:
        case 57:
        case 66:
        case 67:
            return MDI_SNOWY_RAINY;
        case 71:
        case 73:
        case 75:
        case 77:
        case 85:
        case 86:
            return MDI_SNOWY;
        case 95:
        case 96:
        case 99:
            return MDI_LIGHTNING_RAINY;
        default:
            return MDI_CLOUDY;
    }
}

const THUNDER_CODE = 95;
/** km/h: a wind worth an arrow, and against which a ride is said to be in a headwind */
const WIND_MIN = 10;
const GUST_MIN = 50;
/** mm/h under which it does not rain */
const RAIN_MIN = 0.1;
const HOUR_MS = 3600000;

/** A stretch of the route where it rains: vertex indexes, meters from the start, mm/h at the worst of it. */
export interface RainSpan {
    i0: number;
    i1: number;
    from: number;
    to: number;
    peak: number;
}

export interface WeatherSummary {
    tempMin?: number;
    tempMax?: number;
    /** mm over the whole ride */
    rainTotal: number;
    /** the heaviest rain: mm/h, and meters from the start */
    rainPeak?: { mmPerHour: number; distance: number };
    /** 0..1, the share of the distance ridden against a wind over 10 km/h */
    headShare: number;
    thunder: boolean;
}

export interface WeatherRead {
    ride: RideReading[];
    slices: LensSlice[];
    spans: RainSpan[];
    summary: WeatherSummary;
    symbols: LensSymbol[];
    /** What the layer says of a route vertex, at the time the ride is there. */
    at(index: number): (WeatherReading & { head?: number; cross?: number }) | undefined;
}

/** The part of the route a sample speaks for: half way to its neighbours each side. Vertex indexes. */
interface Stretch {
    entry: RideReading;
    lo: number;
    hi: number;
    rain: 0 | 1 | 2 | 3;
}

/**
 * The layer read for this route as the ride is timed now: moving the departure or the pace reads the same hours at other
 * times, with no new data. `stale`: the plates say they are out of date.
 */
export function readWeather(item: StageItem & { analysis?: RouteAnalysis | null }, now: number, { stale = false }: { stale?: boolean } = {}): WeatherRead | null {
    const layer = item.analysis?.layers.weather;
    if (!layer) {
        return null;
    }
    const { data } = layer;
    const coordinates = routeCoordinates(item.geometry);
    const { distances } = timelineSource(item);
    const timeline = buildTimeline(timelineSource(item), item.analysis.inputs, now);
    const ride = readRide(data, { at: timeline.at, coordinates, distances });
    const last = coordinates.length - 1;

    const stretches: Stretch[] = ride.map((entry, position) => ({
        entry,
        lo: position === 0 ? 0 : Math.round((ride[position - 1].sample.i + entry.sample.i) / 2),
        hi: position === ride.length - 1 ? last : Math.round((entry.sample.i + ride[position + 1].sample.i) / 2),
        rain: rainClass(entry.reading?.precip ?? 0)
    }));

    const slices: LensSlice[] = [];
    const spans: RainSpan[] = [];
    stretches.forEach(({ entry, hi, lo, rain }) => {
        const previous = slices[slices.length - 1];
        if (previous?.s === rain) {
            previous.i1 = hi;
        } else {
            slices.push({ i0: lo, i1: hi, k: 'w' + rain, s: rain });
        }
        if (rain > 0) {
            const span = spans[spans.length - 1];
            const peak = entry.reading?.precip ?? 0;
            if (span?.i1 === lo) {
                span.i1 = hi;
                span.to = distances[hi];
                span.peak = Math.max(span.peak, peak);
            } else {
                spans.push({ i0: lo, i1: hi, from: distances[lo], to: distances[hi], peak });
            }
        }
    });

    const temps = ride.flatMap(({ reading }) => (reading?.temp === undefined ? [] : [reading.temp]));
    const total = last >= 0 ? distances[last] : 0;
    let rainTotal = 0;
    let headDistance = 0;
    let rainPeak: WeatherSummary['rainPeak'];
    stretches.forEach(({ entry, hi, lo }) => {
        const precip = entry.reading?.precip ?? 0;
        rainTotal += (precip * (timeline.at(hi) - timeline.at(lo))) / HOUR_MS;
        if ((entry.head ?? 0) > WIND_MIN) {
            headDistance += distances[hi] - distances[lo];
        }
        if (precip >= RAIN_MIN && precip > (rainPeak?.mmPerHour ?? 0)) {
            rainPeak = { mmPerHour: precip, distance: entry.sample.d };
        }
    });

    const symbols: LensSymbol[] = ride.flatMap(({ reading, sample }, position) => {
        if (!reading || reading.temp === undefined) {
            return [];
        }
        const rain = stretches[position].rain;
        const flag = stale ? { stale: 1 as const } : {};
        const plates: LensSymbol[] = [
            {
                sym: 'wx',
                i: sample.i,
                t: Math.round(reading.temp) + '°',
                t2: (reading.precip ?? 0) >= RAIN_MIN ? reading.precip.toFixed(1) : undefined,
                icon: wxGlyph(reading.code),
                s: rain,
                p: 20 + rain * 5,
                ...flag
            }
        ];
        if ((reading.wind ?? 0) >= WIND_MIN && reading.dir !== undefined) {
            // where it blows to: the arrow points down wind
            plates.push({
                sym: 'wind',
                i: sample.i,
                t: String(Math.round(reading.wind)),
                icon: MDI_ARROW_UP,
                rot: (reading.dir + 180) % 360,
                s: (reading.gust ?? 0) >= GUST_MIN ? 2 : 0,
                p: 10,
                ...flag
            });
        }
        return plates;
    });

    return {
        ride,
        slices,
        spans,
        symbols,
        summary: {
            tempMin: temps.length ? Math.min(...temps) : undefined,
            tempMax: temps.length ? Math.max(...temps) : undefined,
            rainTotal,
            rainPeak,
            headShare: total > 0 ? headDistance / total : 0,
            thunder: ride.some(({ reading }) => (reading?.code ?? 0) >= THUNDER_CODE)
        },
        at(index) {
            const nearest = ride.reduce((best, entry, position) => (Math.abs(entry.sample.i - index) < Math.abs(ride[best].sample.i - index) ? position : best), 0);
            const reading = readSample(data, nearest, timeline.at(index));
            const bearing = bearingAt(coordinates, distances, index);
            if (reading?.wind === undefined || reading.dir === undefined || bearing === undefined) {
                return reading;
            }
            return { ...reading, ...windRelative(reading.wind, reading.dir, bearing) };
        }
    };
}
