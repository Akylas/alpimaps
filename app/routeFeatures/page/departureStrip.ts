/** The When panel's departure strip. Pure: nothing here may import NativeScript. */
import { getTimes } from 'suncalc';
import { type TimelineSource, buildTimeline } from '~/utils/routeAnalysis/timeline';
import type { AnalysisInputs } from '~/utils/routeAnalysis/types';

const MINUTE = 60000;
const DAY = 24 * 60 * MINUTE;
/** minutes between two departures, and how many each side of the chosen one */
const STEP = 30;
const SIDE = 6;
/** dark minutes worth one point of score: without weather, darkness is all the strip weighs */
const DARK_MINUTES_PER_POINT = 15;

/** Minutes of the ride between sunset and sunrise, at the given place. */
export function darkMinutes(start: number, end: number, lat: number, lon: number): number {
    if (end <= start) {
        return 0;
    }
    let daylight = 0;
    // every day the ride touches, one either side for a ride across midnight UTC
    for (let day = start - DAY; day <= end + DAY; day += DAY) {
        const { sunrise, sunset } = getTimes(new Date(day), lat, lon);
        const from = Math.max(start, sunrise.getTime());
        const to = Math.min(end, sunset.getTime());
        if (to > from) {
            daylight += to - from;
        }
    }
    return Math.max(0, end - start - daylight) / MINUTE;
}

export interface StripCell {
    /** epoch ms of the departure */
    at: number;
    /** minutes from the chosen departure */
    offset: number;
    arrival: number;
    darkMinutes: number;
    /** lower is better */
    score: number;
    /** thirds of the scores' range; when they are all alike, good without dark minutes, poor with */
    level: 'good' | 'fair' | 'poor';
    /** already gone */
    past: boolean;
    chosen: boolean;
    /** the lowest score still to come, the nearest the chosen one on a tie */
    best: boolean;
}

/** The departures from 3 h before the chosen one to 3 h after, each with how its ride would go. */
export function departureStrip({ chosenAt, inputs, lat, lon, now, source }: { chosenAt: number; now: number; source: TimelineSource; inputs: AnalysisInputs; lat: number; lon: number }): StripCell[] {
    const last = source.distances.length - 1;
    const cells: StripCell[] = [];
    for (let position = -SIDE; position <= SIDE; position++) {
        const offset = position * STEP;
        const at = chosenAt + offset * MINUTE;
        // a departure in the past is timed from itself, not from now
        const timeline = buildTimeline(source, { ...inputs, departure: { ...inputs.departure, mode: 'planned', at } }, Math.min(now, at));
        const arrival = last >= 0 ? timeline.at(last) : at;
        const dark = darkMinutes(at, arrival, lat, lon);
        cells.push({ at, offset, arrival, darkMinutes: dark, score: dark / DARK_MINUTES_PER_POINT, level: 'good', past: at < now, chosen: offset === 0, best: false });
    }
    const coming = cells.filter(({ past }) => !past);
    if (coming.length) {
        const low = Math.min(...coming.map(({ score }) => score));
        const high = Math.max(...coming.map(({ score }) => score));
        cells.forEach((cell) => {
            // all alike: the darkness itself says it, a ride all in daylight good and one in the dark poor
            const share = high > low ? (cell.score - low) / (high - low) : cell.score > 0 ? 1 : 0;
            cell.level = share < 1 / 3 ? 'good' : share < 2 / 3 ? 'fair' : 'poor';
        });
        const best = coming.reduce((current, cell) => (cell.score < current.score || (cell.score === current.score && Math.abs(cell.offset) < Math.abs(current.offset)) ? cell : current));
        best.best = true;
    }
    return cells;
}
