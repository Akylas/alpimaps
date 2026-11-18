/** What a ride's own clock gives: the time of each fix of a recording or of a GPX with `<time>`. Pure: nothing here may import NativeScript. */
import { timelineSource } from './timeline';
import type { RouteAnalysis } from './types';

export type Recorded = NonNullable<RouteAnalysis['recorded']>;

/** Share of the vertexes that must carry a time for the rest to be read off their neighbours: below it the track is not a recording. */
const MIN_TIMED = 0.9;
/** m/s: slower than this the rider is stopped, as the recording session counts it. */
const STOPPED_SPEED = 0.3;
/** seconds: a gap between two fixes longer than this is a pause or a lost signal, not riding, whatever the distance across it. */
const MAX_GAP = 120;

/**
 * Per-vertex seconds from the first fix, from the epoch ms of each vertex (NaN where it has none). Fixes with no time are read
 * between their neighbours, the clock never goes back. None when it does not tell a ride: too few times, no duration, a start in the future.
 */
export function buildRecorded(times: ArrayLike<number>, now: number): Recorded | null {
    const count = times.length;
    const first = Array.from(times).findIndex((time) => Number.isFinite(time));
    const timed = Array.from(times).filter((time) => Number.isFinite(time)).length;
    if (count < 2 || first < 0 || timed / count < MIN_TIMED) {
        return null;
    }
    const startedAt = times[first];
    if (startedAt > now) {
        return null;
    }
    const seconds = new Float64Array(count);
    let previous = first;
    for (let index = 0; index < count; index++) {
        if (index <= first) {
            seconds[index] = 0;
        } else if (Number.isFinite(times[index])) {
            // fills the fixes with no time since the last one that had
            const from = seconds[previous];
            const to = Math.max(from, (times[index] - startedAt) / 1000);
            for (let gap = previous + 1; gap < index; gap++) {
                seconds[gap] = from + ((to - from) * (gap - previous)) / (index - previous);
            }
            seconds[index] = to;
            previous = index;
        }
    }
    for (let index = previous + 1; index < count; index++) {
        seconds[index] = seconds[previous];
    }
    const offsets = Array.from(seconds, (value) => Math.round(value * 10) / 10);
    return offsets[count - 1] > 0 ? { t: offsets, startedAt } : null;
}

/** The fixes of a recording session. */
export function recordedFromLocations(locations: { timestamp: number }[], now: number): Recorded | null {
    return buildRecorded(
        locations.map((location) => location.timestamp),
        now
    );
}

/**
 * The times `@tmcw/togeojson` puts on a GPX track (`coordinateProperties.times`, one list per segment). It leaves out the points that have
 * none, so a list that does not line up with the vertexes cannot be trusted: no recording.
 */
export function recordedFromGpx(properties: unknown, vertexCount: number, now: number): Recorded | null {
    const coordinateProperties = properties && typeof properties === 'object' && 'coordinateProperties' in properties ? properties.coordinateProperties : undefined;
    const raw = coordinateProperties && typeof coordinateProperties === 'object' && 'times' in coordinateProperties ? coordinateProperties.times : undefined;
    if (!Array.isArray(raw)) {
        return null;
    }
    const flat: unknown[] = raw.flat();
    if (flat.length !== vertexCount) {
        return null;
    }
    return buildRecorded(
        flat.map((value) => (typeof value === 'string' ? Date.parse(value) : NaN)),
        now
    );
}

export interface RideFigures {
    elapsedSec: number;
    /** the time spent moving: the stops are left out */
    movingSec: number;
    /** km/h over the moving time */
    avgSpeed: number;
}

/** The figures of a ride: `offsets` the seconds of each vertex, `distances` the metres from the start. */
export function rideFigures(offsets: ArrayLike<number>, distances: ArrayLike<number>): RideFigures {
    const count = Math.min(offsets.length, distances.length);
    if (count < 2) {
        return { elapsedSec: 0, movingSec: 0, avgSpeed: 0 };
    }
    let movingSec = 0;
    let movingMeters = 0;
    for (let index = 1; index < count; index++) {
        const seconds = offsets[index] - offsets[index - 1];
        const meters = distances[index] - distances[index - 1];
        if (seconds > 0 && seconds <= MAX_GAP && meters / seconds > STOPPED_SPEED) {
            movingSec += seconds;
            movingMeters += meters;
        }
    }
    return { elapsedSec: offsets[count - 1] - offsets[0], movingSec, avgSpeed: movingSec > 0 ? (movingMeters / movingSec) * 3.6 : 0 };
}

export interface DoneRide extends RideFigures {
    /** epoch ms */
    startedAt: number;
    endAt: number;
}

/** What a ride that was done tells of itself, from its recording. None for a route that was planned, or whose recording is not of its geometry. */
export function doneRide(item: Parameters<typeof timelineSource>[0]): DoneRide | undefined {
    const recorded = item.analysis?.recorded;
    if (item.analysis?.inputs.departure.mode !== 'recorded' || !recorded) {
        return undefined;
    }
    const { distances } = timelineSource(item);
    if (recorded.t.length < 2 || recorded.t.length !== distances.length) {
        return undefined;
    }
    const figures = rideFigures(recorded.t, distances);
    return { ...figures, startedAt: recorded.startedAt, endAt: recorded.startedAt + recorded.t[recorded.t.length - 1] * 1000 };
}
