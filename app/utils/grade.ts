/**
 * Route grade (slope) computation and sectioning.
 *
 * Pure TypeScript on purpose — no NativeScript import — so the maths can be exercised outside the
 * app, which is the only way to check it in a repo with no test runner.
 *
 * The whole point of this module is that **every window is expressed in meters, never in vertices**.
 * A route polyline has wildly irregular spacing (1 m in a switchback, 100 m on a straight), so a
 * "5 sample" window means a 5 m baseline in one place and a 500 m one a hundred meters later. We
 * resample the elevation onto a fixed step first, and everything after that is distance based.
 */

export interface GradeOptions {
    /** resample step in meters. Below the DEM resolution there is nothing left to gain */
    step?: number;
    /** centered moving average applied to the resampled elevation, in meters */
    smoothDistance?: number;
    /** distance the centered finite difference spans, in meters. This is what sets "sharpness" */
    baseline?: number;
    /** sections shorter than this get merged into a neighbour, in meters */
    minSectionLength?: number;
    /** how far past a bucket threshold the grade must go to switch bucket, in % */
    hysteresis?: number;
    /** grades beyond this are noise, not terrain, in % */
    maxGrade?: number;
}

export const DEFAULT_GRADE_OPTIONS: Required<GradeOptions> = {
    step: 10,
    smoothDistance: 60,
    baseline: 100,
    minSectionLength: 150,
    hysteresis: 0.5,
    maxGrade: 45
};

/** One stretch of route the profile colours as a single slope. */
export interface GradeSection {
    /** index into `RouteProfile.data` */
    startIndex: number;
    endIndex: number;
    /** meters from the route start */
    startDistance: number;
    endDistance: number;
    /** signed %, averaged over the whole section */
    grade: number;
    color: string;
}

interface ProfilePoint {
    d: number;
    a: number;
    g?: number;
}

/**
 * Signed grade buckets, in the spirit of Garmin's ClimbPro breakdown: 3/6/9/12% steps, and descents
 * on their own scale so a -12% plunge does not read as a wall to climb.
 * `from` is inclusive, the list is ordered from steepest descent to steepest climb.
 */
export const gradeBuckets: { from: number; color: string }[] = [
    { from: -Infinity, color: '#1B4E9B' }, // < -9%, dark blue
    { from: -9, color: '#3B7DD8' }, // -9 .. -6%
    { from: -6, color: '#7FB2E8' }, // -6 .. -3%
    { from: -3, color: '#7BC96F' }, // flat, -3 .. 3%
    { from: 3, color: '#F2D14B' }, // 3 .. 6%
    { from: 6, color: '#F0902B' }, // 6 .. 9%
    { from: 9, color: '#E34A33' }, // 9 .. 12%
    { from: 12, color: '#9E1B18' } // >= 12%, dark red
];

/** Index into `gradeBuckets` for a signed grade. */
export function gradeBucketIndex(grade: number) {
    for (let index = gradeBuckets.length - 1; index > 0; index--) {
        if (grade >= gradeBuckets[index].from) {
            return index;
        }
    }
    return 0;
}

export function gradeColor(grade: number) {
    return gradeBuckets[gradeBucketIndex(grade)].color;
}

/**
 * Resample `elevations` onto a fixed distance step by linear interpolation.
 * `distances` must be non decreasing, both arrays the same length.
 */
function resample(distances: number[], elevations: number[], step: number) {
    const total = distances[distances.length - 1];
    const count = Math.max(Math.floor(total / step) + 1, 2);
    const resampled = new Array<number>(count);
    let source = 0;
    for (let index = 0; index < count; index++) {
        const distance = Math.min(index * step, total);
        while (source < distances.length - 2 && distances[source + 1] < distance) {
            source++;
        }
        const spread = distances[source + 1] - distances[source];
        // duplicated vertices are common on routes stitched from several legs
        const ratio = spread > 0 ? (distance - distances[source]) / spread : 0;
        resampled[index] = elevations[source] + (elevations[source + 1] - elevations[source]) * ratio;
    }
    return resampled;
}

/** Centered moving average, window in samples, shrunk at both ends so the series keeps its length. */
function smooth(values: number[], window: number) {
    if (window <= 1) {
        return values.slice();
    }
    const half = Math.floor(window / 2);
    const count = values.length;
    // prefix sums keep this linear whatever the window is
    const sums = new Array<number>(count + 1);
    sums[0] = 0;
    for (let index = 0; index < count; index++) {
        sums[index + 1] = sums[index] + values[index];
    }
    const smoothed = new Array<number>(count);
    for (let index = 0; index < count; index++) {
        const from = Math.max(index - half, 0);
        const to = Math.min(index + half, count - 1);
        smoothed[index] = (sums[to + 1] - sums[from]) / (to - from + 1);
    }
    return smoothed;
}

/**
 * Signed grade in % at every point of `distances`.
 *
 * Elevations must be the **raw, unrounded** values: rounding them to the meter before differentiating
 * over a short baseline is what makes a profile look like a staircase.
 */
export function computeGrades(distances: number[], elevations: number[], options?: GradeOptions) {
    const { baseline, maxGrade, smoothDistance, step } = { ...DEFAULT_GRADE_OPTIONS, ...options };
    const count = distances.length;
    const grades = new Array<number>(count).fill(0);
    if (count < 2 || distances[count - 1] <= 0) {
        return grades;
    }
    const resampled = resample(distances, elevations, step);
    const smoothed = smooth(resampled, Math.max(Math.round(smoothDistance / step), 1));
    const half = Math.max(Math.round(baseline / 2 / step), 1);
    const resampledCount = smoothed.length;

    const resampledGrades = new Array<number>(resampledCount);
    for (let index = 0; index < resampledCount; index++) {
        const from = Math.max(index - half, 0);
        const to = Math.min(index + half, resampledCount - 1);
        const spread = (to - from) * step;
        const grade = spread > 0 ? ((smoothed[to] - smoothed[from]) / spread) * 100 : 0;
        resampledGrades[index] = Math.max(Math.min(grade, maxGrade), -maxGrade);
    }

    // back onto the original vertices
    for (let index = 0; index < count; index++) {
        const position = distances[index] / step;
        const low = Math.min(Math.floor(position), resampledCount - 1);
        const high = Math.min(low + 1, resampledCount - 1);
        const ratio = position - low;
        grades[index] = resampledGrades[low] + (resampledGrades[high] - resampledGrades[low]) * ratio;
    }
    return grades;
}

/**
 * Average grade of `data[from..to]` taken end to end, which is what a rider computes by hand.
 * `elevations` holds the unrounded altitudes when the caller has them: `data[].a` is rounded to the
 * meter for display, and over a short section that rounding is worth a whole percent of grade.
 */
function sectionGrade(data: ProfilePoint[], from: number, to: number, elevations?: number[]) {
    const length = data[to].d - data[from].d;
    if (length <= 0) {
        return 0;
    }
    const start = elevations ? elevations[from] : data[from].a;
    const end = elevations ? elevations[to] : data[to].a;
    return ((end - start) / length) * 100;
}

/**
 * Cut the route into stretches of consistent slope.
 *
 * Two things keep the result readable rather than a confetti of colours: the bucket only changes once
 * the grade has gone `hysteresis` % past the threshold, and anything shorter than `minSectionLength`
 * is merged into whichever neighbour it resembles most.
 */
export function buildGradeSections(data: ProfilePoint[], grades: number[], elevations?: number[], options?: GradeOptions): GradeSection[] {
    const { hysteresis, minSectionLength } = { ...DEFAULT_GRADE_OPTIONS, ...options };
    const count = data.length;
    if (count < 2) {
        return [];
    }

    // 1. runs of identical bucket, with hysteresis on the switch
    const runs: { startIndex: number; endIndex: number; bucket: number }[] = [];
    let bucket = gradeBucketIndex(grades[0]);
    let startIndex = 0;
    for (let index = 1; index < count; index++) {
        const candidate = gradeBucketIndex(grades[index]);
        if (candidate === bucket) {
            continue;
        }
        // going up we must clear the next threshold, going down we must fall below the current one
        const threshold = candidate > bucket ? gradeBuckets[bucket + 1].from + hysteresis : gradeBuckets[bucket].from - hysteresis;
        const confirmed = candidate > bucket ? grades[index] >= threshold : grades[index] < threshold;
        if (!confirmed) {
            continue;
        }
        runs.push({ startIndex, endIndex: index, bucket });
        startIndex = index;
        bucket = candidate;
    }
    runs.push({ startIndex, endIndex: count - 1, bucket });

    // 2. absorb the runs too short to be worth a colour of their own
    let merged = true;
    while (merged && runs.length > 1) {
        merged = false;
        for (let index = 0; index < runs.length; index++) {
            const run = runs[index];
            if (data[run.endIndex].d - data[run.startIndex].d >= minSectionLength) {
                continue;
            }
            const grade = sectionGrade(data, run.startIndex, run.endIndex, elevations);
            const previous = index > 0 ? runs[index - 1] : null;
            const next = index < runs.length - 1 ? runs[index + 1] : null;
            const previousDelta = previous ? Math.abs(sectionGrade(data, previous.startIndex, previous.endIndex, elevations) - grade) : Infinity;
            const nextDelta = next ? Math.abs(sectionGrade(data, next.startIndex, next.endIndex, elevations) - grade) : Infinity;
            if (previous && previousDelta <= nextDelta) {
                previous.endIndex = run.endIndex;
            } else if (next) {
                next.startIndex = run.startIndex;
            } else {
                continue;
            }
            runs.splice(index, 1);
            merged = true;
            break;
        }
    }

    // 3. the colour follows the section's own average, not the bucket it started in
    return runs.map((run) => {
        const grade = sectionGrade(data, run.startIndex, run.endIndex, elevations);
        return {
            startIndex: run.startIndex,
            endIndex: run.endIndex,
            startDistance: data[run.startIndex].d,
            endDistance: data[run.endIndex].d,
            grade: Math.round(grade * 10) / 10,
            color: gradeColor(grade)
        };
    });
}

/**
 * Grade over the next `distance` meters of route, which is what a rider wants to read while moving:
 * the single point value is far too twitchy. Falls back to the stretch behind at the very end.
 *
 * Averages the per point grades weighted by the length they cover, rather than differentiating the
 * stored altitudes again — those are rounded to the meter and would quantise the reading.
 */
export function gradeAhead(data: ProfilePoint[], index: number, distance: number) {
    if (!data?.length || index < 0) {
        return null;
    }
    const from = Math.min(index, data.length - 1);
    // past the end of the route there is nothing ahead left to average, so look back over the same span
    const forward = data[from].d + distance <= data[data.length - 1].d;
    const target = forward ? data[from].d + distance : data[from].d - distance;

    let weighted = 0;
    let covered = 0;
    if (forward) {
        for (let position = from; position < data.length - 1 && data[position].d < target; position++) {
            const span = Math.min(data[position + 1].d, target) - data[position].d;
            weighted += (data[position].g ?? 0) * span;
            covered += span;
        }
    } else {
        for (let position = from; position > 0 && data[position].d > target; position--) {
            const span = data[position].d - Math.max(data[position - 1].d, target);
            weighted += (data[position - 1].g ?? 0) * span;
            covered += span;
        }
    }
    if (covered <= 0) {
        return data[from].g ?? null;
    }
    return weighted / covered;
}
