/** Where along a route the weather is asked for. Pure: nothing here may import NativeScript. */
import type { WeatherData } from '~/utils/routeAnalysis/types';

export type WeatherSample = WeatherData['samples'][number];

/** Weather systems are 10-30 km wide and the finest model grid 1.5 km: closer than 3 km re-reads one cell, further than 15 km misses a front. */
const MIN_STEP = 3000;
const MAX_STEP = 15000;
const MAX_SAMPLES = 40;
const STEP_GROWTH = 1.25;
/** a pass or a valley floor this far above or below the sample before it is worth its own sample */
const RELIEF = 400;
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
 * About 30 min of travel between samples, a sample at every pass and valley floor the regular ones step over, the
 * start and the finish always, 40 at most. The altitude is NaN when the route has none.
 */
export function sampleRoute({ altitudes, distances, speedKmh }: { distances: ArrayLike<number>; altitudes?: ArrayLike<number>; speedKmh: number }): WeatherSample[] {
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
                const previous = regular[position];
                let highest = previous.i;
                let lowest = previous.i;
                for (let index = previous.i + 1; index < next.i; index++) {
                    highest = altitudes[index] > altitudes[highest] ? index : highest;
                    lowest = altitudes[index] < altitudes[lowest] ? index : lowest;
                }
                const summit = make(highest);
                const floor = make(lowest);
                if (highest > previous.i && summit.alt > Math.max(previous.alt, next.alt) && summit.alt - previous.alt >= RELIEF) {
                    samples.push(summit);
                }
                if (lowest > previous.i && floor.alt < Math.min(previous.alt, next.alt) && previous.alt - floor.alt >= RELIEF) {
                    samples.push(floor);
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

    let step = Math.max(MIN_STEP, Math.min(MAX_STEP, speedKmh * 500));
    for (;;) {
        const samples = merge(build(step));
        if (samples.length <= MAX_SAMPLES || step >= total) {
            return samples;
        }
        step *= STEP_GROWTH;
    }
}
