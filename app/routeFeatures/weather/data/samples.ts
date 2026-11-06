/** Where along a route the weather is asked for. Pure: nothing here may import NativeScript. */
import type { WeatherData } from '~/utils/routeAnalysis/types';

export type WeatherSample = WeatherData['samples'][number];

/**
 * A weather system is 10 to 30 km wide: closer samples read the same weather over again, and the finest model grids (1.5 km) are no
 * reason to ask for each of them. What changes the weather over a short way is the height: 400 m is 2.6 degrees (the lapse rate), a
 * freezing level, a snow line.
 */
const REGULAR_STEP = 10000;
const MAX_SAMPLES = 40;
const STEP_GROWTH = 1.25;
/** meters of height from the sample before that earn a sample of their own */
const ELEVATION_BAND = 400;
const MERGE_DISTANCE = 2000;
const MERGE_ALTITUDE = 150;

function firstAtOrAfter(distances: ArrayLike<number>, target: number) {
    let low = 0;
    let high = distances.length - 1;
    while (low < high) {
        const middle = (low + high) >> 1;
        if (distances[middle] >= target) {
            high = middle;
        } else {
            low = middle + 1;
        }
    }
    return low;
}

/**
 * A sample every 10 km, the start and the finish always, and one each time the route has climbed or gone down 400 m since the sample
 * before; 40 at most. The altitude is NaN when the route has none.
 */
export function sampleRoute({ altitudes, distances }: { distances: ArrayLike<number>; altitudes?: ArrayLike<number> }): WeatherSample[] {
    const count = distances.length;
    if (!count) {
        return [];
    }
    const last = count - 1;
    const total = distances[last];
    const make = (index: number): WeatherSample => ({ i: index, d: distances[index], alt: altitudes ? Math.round(altitudes[index]) : NaN });

    function build(step: number) {
        const indexes = new Set<number>();
        for (let target = 0; target < total; target += step) {
            indexes.add(firstAtOrAfter(distances, target));
        }
        indexes.add(last);
        const regular = [...indexes].map(make);
        const samples = [...regular];
        if (altitudes) {
            regular.slice(1).forEach((next, position) => {
                let reference = regular[position].alt;
                for (let index = regular[position].i + 1; index < next.i; index++) {
                    if (Math.abs(altitudes[index] - reference) >= ELEVATION_BAND) {
                        samples.push(make(index));
                        reference = Math.round(altitudes[index]);
                    }
                }
            });
        }
        return samples.sort((first, second) => first.i - second.i);
    }

    // a sample next to another at the same height says the same: the later one goes, but the finish stays
    function merge(samples: WeatherSample[]) {
        const merged: WeatherSample[] = [];
        samples.forEach((sample, position) => {
            const previous = merged[merged.length - 1];
            const close = previous && sample.d - previous.d < MERGE_DISTANCE && !(Math.abs(sample.alt - previous.alt) >= MERGE_ALTITUDE);
            if (!close) {
                merged.push(sample);
            } else if (position === samples.length - 1 && merged.length > 1) {
                merged[merged.length - 1] = sample;
            } else if (position === samples.length - 1) {
                merged.push(sample);
            }
        });
        return merged;
    }

    let step = REGULAR_STEP;
    for (;;) {
        const samples = merge(build(step));
        if (samples.length <= MAX_SAMPLES || step >= total) {
            return samples;
        }
        step *= STEP_GROWTH;
    }
}
