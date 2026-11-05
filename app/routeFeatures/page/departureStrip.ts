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
/** points for a millimeter of rain on the ride, and for the whole way against the wind */
const RAIN_POINTS_PER_MM = 3;
const HEADWIND_POINTS = 2;

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

/** What the forecast says of a ride leaving at a time. `covered`: the hours it was fetched for include the whole ride. */
export interface WeatherFactors {
    /** mm over the whole ride */
    rainMm: number;
    /** 0..1, the share of the way ridden against the wind */
    headShare: number;
    /** %, over the way ridden */
    cloud?: number;
    covered: boolean;
}

/** What a ride is worth a mark for, in the order they are drawn. `unknown`: the forecast does not reach it. */
export type StripIndicator = 'rain' | 'wind' | 'sun' | 'dark' | 'unknown';

/** mm of rain, share of the way against the wind and cloud cover from which a ride is marked rainy, windy and not sunny */
const RAINY_MM = 0.1;
const WINDY_SHARE = 0.25;
const SUNNY_CLOUD = 40;

/** What weighs most on a departure. */
export type StripFactor = 'rain' | 'wind' | 'dark';

export interface StripCell {
    /** epoch ms of the departure */
    at: number;
    /** minutes from the chosen departure */
    offset: number;
    arrival: number;
    darkMinutes: number;
    /** lower is better */
    score: number;
    /** the heaviest part of the score, when it is anything */
    worst?: StripFactor;
    /** what the ride is worth a mark for */
    indicators: StripIndicator[];
    /** what the forecast says of the ride, when it covers it */
    rainMm?: number;
    headShare?: number;
    /** there is a forecast, but not for the hours of this ride: it counts for its darkness only */
    uncovered?: boolean;
    /** thirds of the scores' range; when they are all alike, good without dark minutes, poor with */
    level: 'good' | 'fair' | 'poor';
    /** already gone */
    past: boolean;
    chosen: boolean;
    /** the lowest score still to come, the nearest the chosen one on a tie */
    best: boolean;
}

/**
 * The departures from 3 h before the anchor to 3 h after, each with how its ride would go. The anchor is the chosen
 * departure when none is given: the strip stays where it was when another one is chosen, so the choice moves along it.
 * `weather`: what the forecast says of a ride leaving at a time, when there is one.
 */
export function departureStrip({
    anchorAt,
    chosenAt,
    inputs,
    lat,
    lon,
    now,
    source,
    weather
}: {
    chosenAt: number;
    anchorAt?: number;
    now: number;
    source: TimelineSource;
    inputs: AnalysisInputs;
    lat: number;
    lon: number;
    weather?: (at: number) => WeatherFactors | undefined;
}): StripCell[] {
    const last = source.distances.length - 1;
    const cells: StripCell[] = [];
    for (let position = -SIDE; position <= SIDE; position++) {
        const at = (anchorAt ?? chosenAt) + position * STEP * MINUTE;
        const offset = Math.round((at - chosenAt) / MINUTE);
        // a departure in the past is timed from itself, not from now
        const timeline = buildTimeline(source, { ...inputs, departure: { ...inputs.departure, mode: 'planned', at } }, Math.min(now, at));
        const arrival = last >= 0 ? timeline.at(last) : at;
        const dark = darkMinutes(at, arrival, lat, lon);
        const factors = weather?.(at);
        const counted = factors?.covered ? factors : undefined;
        const points: Record<StripFactor, number> = { rain: (counted?.rainMm ?? 0) * RAIN_POINTS_PER_MM, wind: (counted?.headShare ?? 0) * HEADWIND_POINTS, dark: dark / DARK_MINUTES_PER_POINT };
        const score = points.rain + points.wind + points.dark;
        const worst = (Object.keys(points) as StripFactor[]).reduce<StripFactor | undefined>((heaviest, factor) => (points[factor] > (heaviest ? points[heaviest] : 0) ? factor : heaviest), undefined);
        const indicators: StripIndicator[] = [
            ...(factors && !factors.covered ? (['unknown'] as const) : []),
            ...(counted && counted.rainMm >= RAINY_MM ? (['rain'] as const) : []),
            ...(counted && counted.headShare >= WINDY_SHARE ? (['wind'] as const) : []),
            ...(counted && counted.rainMm < RAINY_MM && counted.cloud !== undefined && counted.cloud < SUNNY_CLOUD ? (['sun'] as const) : []),
            ...(dark > 0 ? (['dark'] as const) : [])
        ];
        cells.push({
            indicators,
            at,
            offset,
            arrival,
            darkMinutes: dark,
            score,
            level: 'good',
            past: at < now,
            chosen: at === chosenAt,
            best: false,
            ...(worst ? { worst } : {}),
            ...(factors ? { uncovered: !factors.covered } : {}),
            ...(counted ? { rainMm: counted.rainMm, headShare: counted.headShare } : {})
        });
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
