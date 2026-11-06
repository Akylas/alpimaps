/** The When panel's departure strip. Pure: nothing here may import NativeScript. */
import { getTimes } from 'suncalc';
import type { DepartureAssessment, DepartureFigure } from '~/routeFeatures/registry';
import { type TimelineSource, buildTimeline } from '~/utils/routeAnalysis/timeline';
import type { AnalysisInputs } from '~/utils/routeAnalysis/types';

const MINUTE = 60000;
const DAY = 24 * 60 * MINUTE;
/** minutes between two departures, and how many each side of the chosen one */
const STEP = 30;
const SIDE = 6;
/** dark minutes worth one point of score: darkness is what the strip weighs of its own */
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

/** What a feature says of a ride leaving at a time, if it knows something of it. */
export type DepartureAssessor = (at: number) => DepartureAssessment | undefined;

export interface StripCell {
    /** epoch ms of the departure */
    at: number;
    /** minutes from the chosen departure */
    offset: number;
    arrival: number;
    darkMinutes: number;
    /** lower is better */
    score: number;
    /** what the ride is worth a mark for: the ids of the features' indicators, `dark` and `unknown` (a feature does not know this ride) */
    indicators: string[];
    /** what a feature says of the ride in a figure, the first one that has one */
    figure?: DepartureFigure;
    /** a feature scores the departures, but knows nothing of this ride: it counts for its darkness only */
    uncovered?: boolean;
    /** thirds of the scores' range; when they are all alike, good without dark minutes, poor with */
    level: 'good' | 'fair' | 'poor' | 'unknown';
    /** already gone */
    past: boolean;
    chosen: boolean;
    /** the lowest score still to come, the nearest the chosen one on a tie */
    best: boolean;
}

/**
 * The departures from 3 h before the anchor to 3 h after, each with how its ride would go. The anchor is the chosen
 * departure when none is given: the strip stays where it was when another one is chosen, so the choice moves along it.
 * `assessors`: what the features say of a ride leaving at a time.
 */
export function departureStrip({
    anchorAt,
    assessors = [],
    chosenAt,
    inputs,
    lat,
    lon,
    now,
    source
}: {
    chosenAt: number;
    anchorAt?: number;
    now: number;
    source: TimelineSource;
    inputs: AnalysisInputs;
    lat: number;
    lon: number;
    assessors?: DepartureAssessor[];
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
        const assessments = assessors.map((assess) => assess(at)).filter((assessment): assessment is DepartureAssessment => !!assessment);
        const known = assessments.filter(({ covered }) => covered);
        const uncovered = assessments.some(({ covered }) => !covered);
        const score = dark / DARK_MINUTES_PER_POINT + known.reduce((total, { points }) => total + Object.values(points).reduce((sum, value) => sum + value, 0), 0);
        const indicators = [...(uncovered ? ['unknown'] : []), ...known.flatMap((assessment) => assessment.indicators), ...(dark > 0 ? ['dark'] : [])];
        const figure = known.find((assessment) => assessment.figure)?.figure;
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
            ...(figure ? { figure } : {}),
            ...(assessments.length ? { uncovered } : {})
        });
    }
    // a ride a feature knows nothing of is scored on its darkness alone: against rides that know more it would win for knowing nothing,
    // so it takes no part in the range and cannot be the best
    const coming = cells.filter(({ past, uncovered }) => !past && !uncovered);
    cells.forEach((cell) => {
        if (cell.uncovered) {
            cell.level = 'unknown';
        }
    });
    if (coming.length) {
        const low = Math.min(...coming.map(({ score }) => score));
        const high = Math.max(...coming.map(({ score }) => score));
        cells
            .filter(({ uncovered }) => !uncovered)
            .forEach((cell) => {
                // all alike: the darkness itself says it, a ride all in daylight good and one in the dark poor
                const share = high > low ? (cell.score - low) / (high - low) : cell.score > 0 ? 1 : 0;
                cell.level = share < 1 / 3 ? 'good' : share < 2 / 3 ? 'fair' : 'poor';
            });
        const best = coming.reduce((current, cell) => (cell.score < current.score || (cell.score === current.score && Math.abs(cell.offset) < Math.abs(current.offset)) ? cell : current));
        best.best = true;
    }
    return cells;
}

/**
 * Where the strip is scrolled to: `now` starts at the first departure to come, the past left out; another departure is put in the
 * middle of the `visible` cells, without going past either end of the strip.
 */
export function stripScrollIndex(cells: StripCell[], mode: string, visible: number): number {
    if (mode === 'now') {
        return Math.max(
            0,
            cells.findIndex((cell) => !cell.past)
        );
    }
    const chosenIndex = Math.max(
        0,
        cells.findIndex((cell) => cell.chosen)
    );
    return Math.max(0, Math.min(chosenIndex - Math.floor(visible / 2), cells.length - visible));
}
