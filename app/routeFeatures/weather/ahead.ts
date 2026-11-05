/** What the forecast says of the way left, while following a route. Pure: nothing here may import NativeScript. */
import type { StageItem } from '~/utils/routeAnalysis/pipeline';
import type { RouteAnalysis } from '~/utils/routeAnalysis/types';
import { readWeather } from './read';

const MINUTE_MS = 60000;
/** km/h of headwind that counts, and the code from which it is a thunderstorm */
const HEADWIND = 10;
const THUNDER_CODE = 95;

export interface WeatherAhead {
    /** it rains where the rider is */
    raining: boolean;
    /** the rain the rider is in or comes to next: minutes from now, meters ahead, mm/h at its worst, minutes it lasts from the start of it (or from now when in it) */
    rain?: { inMinutes: number; ahead: number; mmPerHour: number; lastsMinutes: number };
    /** °C here and at the finish, as the ride gets there */
    temp?: { here: number; finish: number };
    /** 0..1, the share of the way left that is against the wind */
    headShare: number;
    /** a thunderstorm on the way left */
    thunder: boolean;
}

/**
 * The way left from the vertex the rider is at, timed from `now`: the forecast is read for the time the rider gets to each
 * part of it. `speedFactor`: the speed ridden over the speed planned, above 1 is faster.
 */
export function weatherAhead(item: StageItem & { analysis?: RouteAnalysis | null }, now: number, { fromIndex, speedFactor }: { fromIndex: number; speedFactor?: number }): WeatherAhead | null {
    const read = readWeather(item, now, { ahead: { fromIndex, speedFactor } });
    if (!read) {
        return null;
    }
    const last = read.rows.length ? read.rows[read.rows.length - 1].i1 : fromIndex;
    const left = read.distanceAt(last) - read.distanceAt(fromIndex);
    const span = read.spans.find((candidate) => candidate.i1 > fromIndex);
    const raining = !!span && span.i0 <= fromIndex;

    let headDistance = 0;
    read.rows.forEach(({ head, i0, i1 }) => {
        const from = Math.max(i0, fromIndex);
        if ((head ?? 0) > HEADWIND && i1 > from) {
            headDistance += read.distanceAt(i1) - read.distanceAt(from);
        }
    });

    const here = read.at(fromIndex)?.temp;
    const finish = read.at(last)?.temp;
    return {
        raining,
        rain: span
            ? {
                  inMinutes: raining ? 0 : Math.max(0, (read.timeAt(span.i0) - now) / MINUTE_MS),
                  ahead: raining ? 0 : Math.max(0, span.from - read.distanceAt(fromIndex)),
                  mmPerHour: span.peak,
                  lastsMinutes: Math.max(0, (read.timeAt(span.i1) - Math.max(read.timeAt(span.i0), now)) / MINUTE_MS)
              }
            : undefined,
        temp: here !== undefined && finish !== undefined ? { here, finish } : undefined,
        headShare: left > 0 ? headDistance / left : 0,
        thunder: read.rows.some(({ code, i1 }) => i1 > fromIndex && (code ?? 0) >= THUNDER_CODE)
    };
}
