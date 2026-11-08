/** Which of the days' sun and moon events matter to a ride. Pure: nothing here may import NativeScript. */
import type { SunRead } from '~/routeFeatures/sun/read';
import { moonEvents } from '~/utils/astronomy/moon';

const DAY = 24 * 3600000;

/** An instant in each civil day the ride touches, the first and the last included. */
export function daysOf(read: SunRead): number[] {
    const instants: number[] = [];
    for (let at = read.start; at < read.end; at += DAY) {
        instants.push(at);
    }
    instants.push(read.end);
    return instants;
}

/** The one of a day's events that matters to a ride: the one it is out at, else the last before it, else the first after. */
export function aroundRide(read: SunRead, events: (number | null)[]): number | null {
    const present = events.filter((at) => at !== null);
    const during = present.filter((at) => at >= read.start && at <= read.end);
    const before = present.filter((at) => at < read.start);
    if (during.length) {
        return Math.min(...during);
    }
    if (before.length) {
        return Math.max(...before);
    }
    return present.length ? Math.min(...present) : null;
}

/** The moon that matters to a ride: the last rise before it ends, the first set after it starts. None where the moon does neither around then. */
export function moonAround(read: SunRead): { rise: number | null; set: number | null } {
    const days = [read.start - DAY, ...daysOf(read)].map((at) => moonEvents(at, read.place, read.offset));
    const rises = days.flatMap(({ rise }) => (rise !== null && rise <= read.end ? [rise] : []));
    const sets = days.flatMap(({ set }) => (set !== null && set >= read.start ? [set] : []));
    return { rise: rises.length ? Math.max(...rises) : null, set: sets.length ? Math.min(...sets) : null };
}
