import type { Geometry } from 'geojson';
import { resolveStart } from './departure';
import { gradeSpeedKmh } from './speeds';
import type { AnalysisInputs, Departure, Pace, RouteAnalysis } from './types';

export interface RouteTimeline {
    /** epoch ms of vertex 0 */
    startAt: number;
    /** seconds since `startAt` for each vertex, non-decreasing, stops and overnight jumps included */
    t: ArrayLike<number>;
    totalSec: number;
    movingSec: number;
    model: Pace['model'];
    /** epoch ms */
    at(index: number): number;
    /** first vertex at or after that time */
    indexAt(epochMs: number): number;
    /**
     * The remaining route re-timed from the user's position, the whole route being one continuous
     * ride (an overnight stop is scaled with the rest). `speedFactor` is the observed speed over the
     * planned one, so above 1 is faster, the opposite of `Pace.multiplier`; it is clamped to 0.7-1.5.
     * Vertices behind keep their offset before `nowMs`, so indices stay those of the route.
     */
    reanchor(fromIndex: number, nowMs: number, speedFactor?: number): RouteTimeline;
}

/** What a timeline is built from, read off the item by `timelineSource`. */
export interface TimelineSource {
    /** cumulative metres from the start, one per vertex */
    distances: ArrayLike<number>;
    /** metres, one per vertex. Without it the grade-aware model rides on the flat */
    altitudes?: ArrayLike<number>;
    /** seconds, as routed */
    totalTime?: number;
    /** the routed maneuvers: `time` seconds are spent from vertex `index` to the next maneuver's */
    instructions?: { index: number; time: number }[];
    recorded?: RouteAnalysis['recorded'];
}

const METERS_PER_DEGREE = 111320;
const MIN_SPEED_FACTOR = 0.7;
const MAX_SPEED_FACTOR = 1.5;

/** Epoch ms the ride is at a distance from the start, in meters: between the two vertexes it falls between, by the distance. */
export function timeAtDistance(distances: ArrayLike<number>, timeline: Pick<RouteTimeline, 'at'>, meters: number): number {
    const last = distances.length - 1;
    if (last < 1 || meters <= distances[0]) {
        return timeline.at(0);
    }
    if (meters >= distances[last]) {
        return timeline.at(last);
    }
    let low = 1;
    let high = last;
    while (low < high) {
        const middle = (low + high) >> 1;
        if (distances[middle] >= meters) {
            high = middle;
        } else {
            low = middle + 1;
        }
    }
    const span = distances[low] - distances[low - 1];
    const share = span > 0 ? (meters - distances[low - 1]) / span : 0;
    return timeline.at(low - 1) + share * (timeline.at(low) - timeline.at(low - 1));
}

export function cumulativeDistances(coordinates: number[][]): Float64Array {
    const distances = new Float64Array(coordinates.length);
    for (let index = 1; index < coordinates.length; index++) {
        const [lon, lat] = coordinates[index];
        const [previousLon, previousLat] = coordinates[index - 1];
        const dx = (lon - previousLon) * Math.cos((lat * Math.PI) / 180);
        distances[index] = distances[index - 1] + Math.hypot(dx, lat - previousLat) * METERS_PER_DEGREE;
    }
    return distances;
}

export function timelineSource(item: {
    geometry?: Geometry;
    profile?: { data: { d: number; a: number }[] };
    route?: { totalTime?: number };
    instructions?: { index: number; time: number }[];
    analysis?: RouteAnalysis | null;
}): TimelineSource {
    const { geometry, profile } = item;
    let coordinates: number[][] = [];
    if (geometry?.type === 'LineString') {
        coordinates = geometry.coordinates;
    } else if (geometry?.type === 'MultiLineString') {
        coordinates = geometry.coordinates.flat();
    }
    // a profile covers every vertex; a stale one (shorter) is not trusted
    const useProfile = profile?.data?.length > 0 && profile.data.length === coordinates.length;
    return {
        distances: useProfile ? Float64Array.from(profile.data, (sample) => sample.d) : cumulativeDistances(coordinates),
        altitudes: useProfile ? Float64Array.from(profile.data, (sample) => sample.a) : undefined,
        totalTime: item.route?.totalTime,
        instructions: item.instructions,
        recorded: item.analysis?.recorded
    };
}

/**
 * Each maneuver's time, spread by distance over the vertices it covers, then scaled to the routed
 * total. Null when the maneuvers do not describe this route (out of order, out of range, no time).
 */
function maneuverTimes(source: TimelineSource): Float64Array | null {
    const { distances, instructions, totalTime } = source;
    const count = distances.length;
    if (!instructions?.length || count < 2) {
        return null;
    }
    let sum = 0;
    for (let position = 0; position < instructions.length; position++) {
        const { index, time } = instructions[position];
        if (!(time >= 0) || !(index >= 0 && index < count) || (position > 0 && index < instructions[position - 1].index)) {
            return null;
        }
        sum += time;
    }
    if (!(sum > 0)) {
        return null;
    }
    const scale = totalTime / sum;
    const moving = new Float64Array(count);
    let elapsed = 0;
    let filled = 0;
    for (let position = 0; position < instructions.length; position++) {
        const start = instructions[position].index;
        const end = position + 1 < instructions.length ? instructions[position + 1].index : count - 1;
        const duration = instructions[position].time * scale;
        const run = distances[end] - distances[start];
        // vertices up to the first maneuver, and any gap between maneuvers, wait at the elapsed time
        for (; filled <= start; filled++) {
            moving[filled] = elapsed;
        }
        for (let index = start + 1; index <= end; index++) {
            moving[index] = elapsed + (run > 0 ? (duration * (distances[index] - distances[start])) / run : duration);
        }
        filled = Math.max(filled, end + 1);
        elapsed += duration;
    }
    for (; filled < count; filled++) {
        moving[filled] = elapsed;
    }
    return moving;
}

/** Seconds of moving time at each vertex, before the pace and the stops. */
function movingTimes(source: TimelineSource, inputs: AnalysisInputs): { moving: Float64Array; model: Pace['model'] } {
    const { altitudes, distances, totalTime } = source;
    const count = distances.length;
    const moving = new Float64Array(count);
    const total = count > 0 ? distances[count - 1] : 0;
    if (inputs.pace.model === 'valhalla' && totalTime > 0) {
        const byManeuver = maneuverTimes(source);
        if (byManeuver) {
            return { model: 'valhalla', moving: byManeuver };
        }
    }
    // decision 05.3: the routed time spread by distance, unless the pace asks for the grade or nothing was routed
    if (totalTime > 0 && inputs.pace.model !== 'gradeAware') {
        for (let index = 0; index < count; index++) {
            moving[index] = total > 0 ? (totalTime * distances[index]) / total : 0;
        }
        return { moving, model: 'proportional' };
    }
    for (let index = 1; index < count; index++) {
        const run = distances[index] - distances[index - 1];
        const slope = altitudes && run > 0 ? (altitudes[index] - altitudes[index - 1]) / run : 0;
        const speed = (gradeSpeedKmh(inputs.activity, slope) * 1000) / 3600;
        moving[index] = moving[index - 1] + run / speed;
    }
    return { moving, model: 'gradeAware' };
}

/** Day k ends after `maxHours` of riding (the last one never), the next one starts at its own `startAt`. */
function spreadOverDays(elapsed: Float64Array, days: NonNullable<Departure['days']>, startAt: number) {
    const result = new Float64Array(elapsed.length);
    let day = 0;
    let dayStartElapsed = 0;
    let dayStartOffset = 0;
    for (let index = 0; index < elapsed.length; index++) {
        while (day < days.length - 1 && days[day].maxHours > 0 && elapsed[index] - dayStartElapsed > days[day].maxHours * 3600) {
            const dayEndElapsed = dayStartElapsed + days[day].maxHours * 3600;
            const dayEndOffset = dayStartOffset + (dayEndElapsed - dayStartElapsed);
            day++;
            dayStartElapsed = dayEndElapsed;
            // a day cannot start before the previous one ended
            dayStartOffset = Math.max(dayEndOffset, (days[day].startAt - startAt) / 1000);
        }
        result[index] = dayStartOffset + (elapsed[index] - dayStartElapsed);
    }
    return result;
}

function makeTimeline(startAt: number, t: Float64Array, movingSec: number, model: Pace['model']): RouteTimeline {
    const last = t.length - 1;
    const timeline: RouteTimeline = {
        startAt,
        t,
        totalSec: last >= 0 ? t[last] : 0,
        movingSec,
        model,
        at(index) {
            return startAt + (last >= 0 ? t[Math.max(0, Math.min(index, last))] : 0) * 1000;
        },
        indexAt(epochMs) {
            const target = (epochMs - startAt) / 1000;
            let low = 0;
            let high = last;
            if (last < 0 || target > t[last]) {
                return Math.max(last, 0);
            }
            while (low < high) {
                const middle = (low + high) >> 1;
                if (t[middle] >= target) {
                    high = middle;
                } else {
                    low = middle + 1;
                }
            }
            return low;
        },
        reanchor(fromIndex, nowMs, speedFactor = 1) {
            if (last < 0) {
                return timeline;
            }
            const from = Math.max(0, Math.min(fromIndex, last));
            const factor = Math.max(MIN_SPEED_FACTOR, Math.min(MAX_SPEED_FACTOR, speedFactor));
            const anchored = new Float64Array(t.length);
            for (let index = 0; index < t.length; index++) {
                const offset = t[index] - t[from];
                anchored[index] = index < from ? offset : offset / factor;
            }
            const remaining = anchored[last];
            return makeTimeline(nowMs, anchored, timeline.totalSec > 0 ? (remaining * movingSec) / timeline.totalSec : 0, model);
        }
    };
    return timeline;
}

/**
 * Order: the recording, then the routed time spread by distance (the default, decision 05.3) or, when
 * the pace asks for it, by maneuver, then a grade-aware speed model for a track nobody routed. The
 * pace and the stops apply on top, and the days of a multi-day ride last.
 */
export function buildTimeline(source: TimelineSource, inputs: AnalysisInputs, now: number): RouteTimeline {
    const { recorded } = source;
    if (recorded && recorded.t.length === source.distances.length) {
        const t = Float64Array.from(recorded.t);
        return makeTimeline(recorded.startedAt, t, t.length ? t[t.length - 1] : 0, 'recorded');
    }
    const { model, moving } = movingTimes(source, inputs);
    const { multiplier, stopsMinPerHour } = inputs.pace;
    const stretch = multiplier * (1 + stopsMinPerHour / 60);
    const elapsed = moving.map((seconds) => seconds * stretch);
    const startAt = resolveStart(inputs.departure, now);
    const t = inputs.departure.days?.length > 1 ? spreadOverDays(elapsed, inputs.departure.days, startAt) : elapsed;
    const movingSec = moving.length ? moving[moving.length - 1] * multiplier : 0;
    return makeTimeline(startAt, t, movingSec, model);
}
