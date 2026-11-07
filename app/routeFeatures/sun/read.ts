/** What the sun does along a route, for the lens, the chip and the profile. Pure: nothing here may import NativeScript. */
import { routeCoordinates } from '~/routeFeatures/lens/sections';
import type { LensSlice } from '~/routeFeatures/registry';
import { bearingAt, readSample } from '~/routeFeatures/weather/data/series';
import { clearness } from '~/utils/astronomy/clearSky';
import { moonIllumination, moonPositionAt } from '~/utils/astronomy/moon';
import { GLARE_RULES, type SunLevel, type SunPosition, type SunSide, isGlare, sunLevel, sunPositionAt, sunSide } from '~/utils/astronomy/sun';
import { activityOf } from '~/utils/routeAnalysis/activity';
import { routeTimeZone } from '~/utils/routeAnalysis/departure';
import type { StageItem } from '~/utils/routeAnalysis/pipeline';
import { createAnalysis } from '~/utils/routeAnalysis/storage';
import { buildTimeline, timelineSource } from '~/utils/routeAnalysis/timeline';
import type { RouteAnalysis, WeatherData } from '~/utils/routeAnalysis/types';

export type SunClass = 'day' | 'overcast' | 'low' | 'glare' | 'twilight' | 'moonlit' | 'night';

/** The classes from the most light to the least: the order of the palette, the legends and the bar. */
export const SUN_CLASS_ORDER: SunClass[] = ['day', 'overcast', 'low', 'glare', 'twilight', 'moonlit', 'night'];

/** What the classes are called in the lens palette. */
export const SUN_PALETTE_KEYS: Record<SunClass, string> = {
    day: 'sun_day',
    overcast: 'sun_overcast',
    low: 'sun_low',
    glare: 'sun_glare',
    twilight: 'sun_twilight',
    moonlit: 'sun_moonlit',
    night: 'sun_night'
};

/** How serious each class is, 0 to 3: the style draws the line a little wider for the darkest. */
const SEVERITY: Record<SunClass, LensSlice['s']> = { day: 0, overcast: 0, low: 1, glare: 2, twilight: 2, moonlit: 2, night: 3 };

/** Under this share of the clear-sky sun a daylight stretch is overcast. */
const OVERCAST = 0.35;
/** The moon lights the night from this share of it lit, % */
const MOON_MIN = 30;
/** metres between two looks at the sun: a rider's sun moves less between two than a walker's shade does */
const STEP = { hike: 50, bike: 100, motor: 250 };

export type SunItem = StageItem & Pick<Parameters<typeof activityOf>[0], 'properties'> & { analysis?: RouteAnalysis | null };

export interface SunPoint extends SunPosition {
    at: number;
    class: SunClass;
    /** where the sun is against the way the ride goes; none when the route does not go anywhere there */
    side?: SunSide;
    /** 0..1: how much of the clear-sky sun gets through, by the forecast; none when there is no forecast for it */
    clearness?: number;
}

export interface SunSummary {
    /** where and when the sun goes down on the ride; none when it does not */
    sunset?: { at: number; distance: number };
    /** ms spent after sunset */
    darkMs: number;
    /** m ridden into the low sun */
    glareDistance: number;
    /** m ridden by day with the sun on each side of the way the ride goes */
    sides: Record<SunSide, number>;
    /** ms of the night with the moon up and bright enough to see by */
    moonlitMs: number;
    /** m ridden by that moon, with it on each side of the way */
    moonSides: Record<SunSide, number>;
}

/** A stretch of one class, in metres from the start: what the profile draws. */
export interface SunRun {
    from: number;
    to: number;
    k: string;
}

export interface SunRead {
    slices: LensSlice[];
    /** the slices in metres */
    runs: SunRun[];
    summary: SunSummary;
    /** minutes east of UTC in the route's zone; none: the phone's */
    offset?: number;
    /** epoch ms the ride starts and ends */
    start: number;
    end: number;
    /** where it starts */
    place: { lat: number; lon: number };
    /** m from the start the ride is at a time */
    distanceAt(at: number): number;
    at(index: number): SunPoint;
}

export interface SunReadOptions {
    /** The sun blinds under this altitude, degrees, in place of the activity's. */
    glareBelow?: number;
    /** The moon lights the night from this share of it lit, %, in place of 30. */
    moonMin?: number;
}

/** The vertexes the sun is looked at, from the first to the last, a `step` apart. */
function sampledVertexes(distances: ArrayLike<number>, step: number): number[] {
    const last = distances.length - 1;
    if (last < 0) {
        return [];
    }
    const vertexes = [0];
    let from = distances[0];
    for (let index = 1; index < last; index++) {
        if (distances[index] - from >= step) {
            vertexes.push(index);
            from = distances[index];
        }
    }
    if (last > 0) {
        vertexes.push(last);
    }
    return vertexes;
}

/** The forecast's say of how much sun gets through at a vertex and a time, from the sample of the layer nearest to it. */
function clearnessAt(data: WeatherData | undefined, vertex: number, at: number, altitude: number): number | undefined {
    if (!data?.samples.length) {
        return undefined;
    }
    let nearest = 0;
    data.samples.forEach((sample, position) => {
        if (Math.abs(sample.i - vertex) < Math.abs(data.samples[nearest].i - vertex)) {
            nearest = position;
        }
    });
    const reading = readSample(data, nearest, at);
    return reading ? clearness({ altitude, dni: reading.dni, cloud: reading.cloud, elevation: data.samples[nearest].alt }) : undefined;
}

function classOf(level: SunLevel, glare: boolean, clear: number | undefined, moonlit: boolean): SunClass {
    if (level === 'night') {
        return moonlit ? 'moonlit' : level;
    }
    if (level === 'twilight') {
        return level;
    }
    if (clear !== undefined && clear < OVERCAST) {
        return 'overcast';
    }
    return glare ? 'glare' : level;
}

/** The sun along the route as the ride is timed now: a new departure or pace reads the same sky at other times. */
export function readSun(item: SunItem, now: number, options: SunReadOptions = {}): SunRead | null {
    const coordinates = routeCoordinates(item.geometry);
    if (coordinates.length < 2) {
        return null;
    }
    const analysis = item.analysis ?? createAnalysis(item.geometry, activityOf(item, null));
    const source = timelineSource(item);
    const { distances } = source;
    const timeline = buildTimeline(source, analysis.inputs, now);
    const kind = activityOf(item, item.analysis)?.kind ?? 'hike';
    const rule = { ...GLARE_RULES[kind], ...(options.glareBelow ? { below: options.glareBelow } : {}) };
    const weather = item.analysis?.layers.weather?.data;
    const last = coordinates.length - 1;

    const moonMin = options.moonMin ?? MOON_MIN;
    const pointAt = (vertex: number): SunPoint & { glare: boolean; level: SunLevel; moonSide?: SunSide } => {
        const at = timeline.at(vertex);
        const [lon, lat] = coordinates[vertex];
        const position = sunPositionAt(at, { lat, lon });
        const heading = bearingAt(coordinates, distances, vertex);
        const glare = isGlare(position, heading, rule);
        const level = sunLevel(position.altitude);
        const side = heading === undefined ? undefined : sunSide(position.azimuth, heading);
        const clear = clearnessAt(weather, vertex, at, position.altitude);
        // the moon is only looked for in the dark: it is the one light there is
        const moon = level === 'night' ? moonPositionAt(at, { lat, lon }) : undefined;
        const moonlit = !!moon && moon.altitude > 0 && moonIllumination(new Date(at)) >= Math.max(1, moonMin);
        const moonSide = moonlit && heading !== undefined ? sunSide(moon.azimuth, heading) : undefined;
        return { ...position, at, class: classOf(level, glare, clear, moonlit), clearness: clear, glare, level, side, moonSide };
    };

    const vertexes = sampledVertexes(distances, STEP[kind]);
    const slices: LensSlice[] = [];
    const summary: SunSummary = { darkMs: 0, glareDistance: 0, sides: { left: 0, right: 0, ahead: 0, behind: 0 }, moonlitMs: 0, moonSides: { left: 0, right: 0, ahead: 0, behind: 0 } };
    let previousLevel: SunLevel | undefined;
    vertexes.forEach((vertex, position) => {
        const point = pointAt(vertex);
        // the part of the route a look speaks for: half way to its neighbours each side
        const lo = position === 0 ? 0 : Math.round((vertexes[position - 1] + vertex) / 2);
        const hi = position === vertexes.length - 1 ? last : Math.round((vertex + vertexes[position + 1]) / 2);
        if (hi > lo) {
            const before = slices[slices.length - 1];
            if (before?.k === SUN_PALETTE_KEYS[point.class] && before.i1 === lo) {
                before.i1 = hi;
            } else {
                slices.push({ i0: lo, i1: hi, k: SUN_PALETTE_KEYS[point.class], s: SEVERITY[point.class] });
            }
            if (point.level === 'twilight' || point.level === 'night') {
                summary.darkMs += timeline.at(hi) - timeline.at(lo);
            }
            if (point.class === 'moonlit') {
                summary.moonlitMs += timeline.at(hi) - timeline.at(lo);
                if (point.moonSide) {
                    summary.moonSides[point.moonSide] += distances[hi] - distances[lo];
                }
            }
            if (point.side && (point.level === 'day' || point.level === 'low')) {
                summary.sides[point.side] += distances[hi] - distances[lo];
            }
            if (point.glare && point.class === 'glare') {
                summary.glareDistance += distances[hi] - distances[lo];
            }
        }
        if (!summary.sunset && (previousLevel === 'day' || previousLevel === 'low') && (point.level === 'twilight' || point.level === 'night')) {
            summary.sunset = { at: point.at, distance: distances[vertex] };
        }
        previousLevel = point.level;
    });

    return {
        slices,
        runs: slices.map((slice) => ({ from: distances[slice.i0], to: distances[slice.i1], k: String(slice.k) })),
        summary,
        offset: routeTimeZone(analysis.inputs.departure).offset,
        start: timeline.at(0),
        end: timeline.at(last),
        place: { lat: coordinates[0][1], lon: coordinates[0][0] },
        distanceAt: (at) => distances[Math.min(last, timeline.indexAt(at))],
        at: (index) => {
            const { altitude, at, azimuth, class: sunClass, clearness: clear, side } = pointAt(Math.max(0, Math.min(last, index)));
            return { altitude, at, azimuth, class: sunClass, clearness: clear, side };
        }
    };
}
