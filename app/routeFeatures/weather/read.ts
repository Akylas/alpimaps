/** What a weather layer says of a route, for the lens, the chip and the profile. Pure: nothing here may import NativeScript. */
import { routeCoordinates } from '~/routeFeatures/lens/sections';
import type { LensSlice, LensSymbol, ProfileWeather } from '~/routeFeatures/registry';
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
const MDI_WINDY = glyph(0xf059d);
const MDI_BURST = glyph(0xf059e);
const MDI_ARROW_LEFT = glyph(0xf004d);
const MDI_ARROW_RIGHT = glyph(0xf0054);

/** km/h: the settings' say on what is worth showing of the wind. */
export interface WeatherThresholds {
    /** a wind worth a mark on the profile */
    profileWind: number;
    /** a wind worth a line on the plate; two thirds of it as headwind is */
    plateWind: number;
    /** a burst */
    gust: number;
}

export const DEFAULT_THRESHOLDS: WeatherThresholds = { profileWind: 15, plateWind: 30, gust: 50 };

/**
 * The sky, as a glyph of the icon font. The clear and cloudy codes (0 to 3) only say it roughly: the cloud cover, when there is
 * one, says how much (under 20 %: sun, up to 60 %: sun and cloud, more: cloud). A code of fog, rain, snow or a storm says it.
 */
export function wxGlyph(code: number | undefined, cloud?: number): string {
    if (cloud !== undefined && (code === undefined || (code >= 0 && code <= 3))) {
        return cloud < CLOUD_CLEAR ? MDI_SUNNY : cloud <= CLOUD_PARTLY ? MDI_PARTLY_CLOUDY : MDI_CLOUDY;
    }
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

/** % of cloud cover under which the sky is clear, and up to which it is partly cloudy */
const CLOUD_CLEAR = 20;
const CLOUD_PARTLY = 60;
const THUNDER_CODE = 95;
/** km/h: a wind worth an arrow, and against which a ride is said to be in a headwind */
const WIND_MIN = 10;
/** of the plate's wind threshold, what a headwind has to be to earn the line alone */
const HEAD_SHARE = 2 / 3;
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
    /** %, over the way ridden */
    cloud?: number;
    /** 0..1, the share of the distance ridden against a wind over 10 km/h */
    headShare: number;
    /** 0..1, the share ridden with a wind of over 10 km/h behind */
    tailShare: number;
    thunder: boolean;
}

/** What a sample says, for a row of the page: the time the ride is there and the stretch it speaks for. */
export interface RideRow {
    /** the sample's place in the layer */
    index: number;
    /** its vertex, and the vertexes of the stretch it speaks for */
    i: number;
    i0: number;
    i1: number;
    /** meters from the start */
    distance: number;
    /** epoch ms */
    at: number;
    temp?: number;
    /** mm/h */
    precip: number;
    code?: number;
    /** % */
    cloud?: number;
    /** km/h, a gust, and the part of the wind against (above 0) or behind (below 0) the ride */
    wind?: number;
    gust?: number;
    head?: number;
    rain: 0 | 1 | 2 | 3;
}

export interface WeatherRead {
    ride: RideReading[];
    rows: RideRow[];
    slices: LensSlice[];
    spans: RainSpan[];
    summary: WeatherSummary;
    symbols: LensSymbol[];
    /** What it lays over the profile. */
    profile: ProfileWeather;
    /** What the layer says of a route vertex, at the time the ride is there. */
    at(index: number): (WeatherReading & { head?: number; cross?: number }) | undefined;
}

/** A strong wind on a second line of a plate: its speed, how much of it is against (left arrow) or behind (right) the ride, a burst. */
function windLine(wind: number, gust: number, head: number, thresholds: WeatherThresholds): string | undefined {
    if (wind < thresholds.plateWind && head < Math.round(thresholds.plateWind * HEAD_SHARE) && gust < thresholds.gust) {
        return undefined;
    }
    let line = `\n${MDI_WINDY} ${Math.round(wind)}`;
    if (Math.abs(head) >= WIND_MIN) {
        line += ` ${head > 0 ? MDI_ARROW_LEFT : MDI_ARROW_RIGHT}${Math.round(Math.abs(head))}`;
    }
    if (gust >= thresholds.gust) {
        line += ` ${MDI_BURST}${Math.round(gust)}`;
    }
    return line;
}

/** The part of the route a sample speaks for: half way to its neighbours each side. Vertex indexes. */
interface Stretch {
    entry: RideReading;
    lo: number;
    hi: number;
}

/** A stretch's hour, as the ride goes through it: the rain is read at its middle. */
interface Chunk {
    lo: number;
    hi: number;
    precip: number;
    /** 0..1 */
    probability: number;
    rain: 0 | 1 | 2 | 3;
    /** the hours the ride takes through it */
    hours: number;
}

/**
 * The layer read for this route as the ride is timed now: moving the departure or the pace reads the same hours at other
 * times, with no new data. `stale`: the plates say they are out of date.
 */
export function readWeather(
    item: StageItem & { analysis?: RouteAnalysis | null },
    now: number,
    { stale = false, thresholds: custom }: { stale?: boolean; thresholds?: Partial<WeatherThresholds> } = {}
): WeatherRead | null {
    const layer = item.analysis?.layers.weather;
    if (!layer) {
        return null;
    }
    const { data } = layer;
    const thresholds = { ...DEFAULT_THRESHOLDS, ...custom };
    const coordinates = routeCoordinates(item.geometry);
    const { distances } = timelineSource(item);
    const timeline = buildTimeline(timelineSource(item), item.analysis.inputs, now);
    const ride = readRide(data, { at: timeline.at, coordinates, distances });
    const last = coordinates.length - 1;

    const stretches: Stretch[] = ride.map((entry, position) => ({
        entry,
        lo: position === 0 ? 0 : Math.round((ride[position - 1].sample.i + entry.sample.i) / 2),
        hi: position === ride.length - 1 ? last : Math.round((entry.sample.i + ride[position + 1].sample.i) / 2)
    }));

    // a sample's stretch can take hours: the rain is read for each of them, at the time the ride is there
    const chunks: Chunk[] = stretches.flatMap(({ hi, lo }, position) => {
        const from = timeline.at(lo);
        const to = timeline.at(hi);
        const count = Math.max(1, Math.ceil((to - from) / HOUR_MS));
        return Array.from({ length: count }, (_, chunk) => {
            const start = from + ((to - from) * chunk) / count;
            const end = from + ((to - from) * (chunk + 1)) / count;
            const reading = readSample(data, position, (start + end) / 2);
            const vertex = (time: number) => Math.max(lo, Math.min(hi, timeline.indexAt(time)));
            const precip = reading?.precip ?? 0;
            return {
                lo: chunk === 0 ? lo : vertex(start),
                hi: chunk === count - 1 ? hi : vertex(end),
                precip,
                probability: reading?.precipProb === undefined ? 1 : reading.precipProb / 100,
                rain: rainClass(precip),
                hours: (end - start) / HOUR_MS
            };
        }).filter((chunk) => chunk.hi > chunk.lo);
    });

    const slices: LensSlice[] = [];
    const spans: RainSpan[] = [];
    chunks.forEach(({ hi, lo, precip, rain }) => {
        const previous = slices[slices.length - 1];
        if (previous?.s === rain) {
            previous.i1 = hi;
        } else {
            slices.push({ i0: lo, i1: hi, k: 'w' + rain, s: rain });
        }
        if (rain > 0) {
            const span = spans[spans.length - 1];
            if (span?.i1 === lo) {
                span.i1 = hi;
                span.to = distances[hi];
                span.peak = Math.max(span.peak, precip);
            } else {
                spans.push({ i0: lo, i1: hi, from: distances[lo], to: distances[hi], peak: precip });
            }
        }
    });

    const temps = ride.flatMap(({ reading }) => (reading?.temp === undefined ? [] : [reading.temp]));
    const total = last >= 0 ? distances[last] : 0;
    let rainTotal = 0;
    let rainPeak: WeatherSummary['rainPeak'];
    chunks.forEach(({ hi, hours, lo, precip }) => {
        rainTotal += precip * hours;
        if (precip >= RAIN_MIN && precip > (rainPeak?.mmPerHour ?? 0)) {
            rainPeak = { mmPerHour: precip, distance: (distances[lo] + distances[hi]) / 2 };
        }
    });
    let headDistance = 0;
    let cloudSum = 0;
    let cloudSpan = 0;
    let tailDistance = 0;
    stretches.forEach(({ entry, hi, lo }) => {
        if (entry.reading?.cloud !== undefined) {
            cloudSum += entry.reading.cloud * (distances[hi] - distances[lo]);
            cloudSpan += distances[hi] - distances[lo];
        }
        if ((entry.head ?? 0) > WIND_MIN) {
            headDistance += distances[hi] - distances[lo];
        }
        if ((entry.head ?? 0) < -WIND_MIN) {
            tailDistance += distances[hi] - distances[lo];
        }
    });

    const symbols: LensSymbol[] = ride.flatMap(({ reading, sample }, position) => {
        if (!reading || reading.temp === undefined) {
            return [];
        }
        const rain = rainClass(reading.precip ?? 0);
        const line = windLine(reading.wind ?? 0, reading.gust ?? 0, ride[position].head ?? 0, thresholds);
        const flag = stale ? { stale: 1 as const } : {};
        const plates: LensSymbol[] = [
            {
                sym: 'wx',
                i: sample.i,
                t: Math.round(reading.temp) + '°',
                t2: (reading.precip ?? 0) >= RAIN_MIN ? reading.precip.toFixed(1) + ' mm' : undefined,
                icon: wxGlyph(reading.code, reading.cloud),
                ...(line ? { t3: line } : {}),
                s: rain,
                p: 20 + rain * 5,
                ...flag
            }
        ];
        return plates;
    });

    const rows: RideRow[] = ride.map(({ at, head, reading, sample }, index) => ({
        index,
        i: sample.i,
        i0: stretches[index].lo,
        i1: stretches[index].hi,
        distance: sample.d,
        at,
        temp: reading?.temp,
        precip: reading?.precip ?? 0,
        code: reading?.code,
        cloud: reading?.cloud,
        wind: reading?.wind,
        gust: reading?.gust,
        head,
        rain: rainClass(reading?.precip ?? 0)
    }));

    return {
        ride,
        rows,
        slices,
        spans,
        symbols,
        profile: {
            rain: chunks.flatMap(({ hi, lo, precip, probability }) => (precip >= RAIN_MIN ? [{ from: distances[lo], to: distances[hi], mmPerHour: precip, probability }] : [])),
            temp: ride.flatMap(({ reading, sample }) => (reading?.temp === undefined ? [] : [{ d: sample.d, value: reading.temp, glyph: wxGlyph(reading.code, reading.cloud) }])),
            wind: ride.flatMap(({ cross, head, reading, sample }) =>
                reading?.wind !== undefined && (reading.wind >= thresholds.profileWind || (reading.gust ?? 0) >= thresholds.gust)
                    ? [{ d: sample.d, speed: reading.wind, gust: reading.gust ?? 0, head: head ?? 0, angle: (Math.atan2(-(cross ?? 0), -(head ?? 0)) * 180) / Math.PI }]
                    : []
            ),
            gustMin: thresholds.gust
        },
        summary: {
            tempMin: temps.length ? Math.min(...temps) : undefined,
            tempMax: temps.length ? Math.max(...temps) : undefined,
            rainTotal,
            rainPeak,
            cloud: cloudSpan > 0 ? cloudSum / cloudSpan : undefined,
            headShare: total > 0 ? headDistance / total : 0,
            tailShare: total > 0 ? tailDistance / total : 0,
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
