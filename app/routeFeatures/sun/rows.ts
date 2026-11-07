/** The rows of the Sun card of the route page. Pure: nothing here may import NativeScript. */
import type { RoutePageRow } from '~/routeFeatures/registry';
import { SUN_CLASS_ORDER, SUN_PALETTE_KEYS, type SunClass, type SunRead } from '~/routeFeatures/sun/read';
import { moonEvents } from '~/utils/astronomy/moon';
import { sunEvents } from '~/utils/astronomy/sun';

export type SunRowData =
    /** what the route is made of, by class of the sun, in metres */
    | { type: 'bar'; shares: { k: SunClass; meters: number }[] }
    /** epoch ms the ride starts and ends, in the route's zone */
    | { type: 'times'; start: number; end: number; offset?: number }
    /** the sunset or the end of civil twilight of the day, against the ride: during it (the distance), before it starts or after it ends (ms) */
    | { type: 'event'; id: 'sunset' | 'dusk' | 'moonrise' | 'moonset'; at: number; offset?: number; relation: 'during' | 'before' | 'after'; distance?: number; ms?: number }
    | { type: 'dark'; ms: number }
    | { type: 'glare'; meters: number }
    /** the shares of the metres ridden by day, by where the sun is against the way; or by the light of the moon, by where it is */
    | { type: 'side'; body: 'sun' | 'moon'; left: number; right: number; ahead: number; behind: number }
    /** the button that lights the 3D map with the sun of the ride */
    | { type: 'preview' }
    | { type: 'note' };

const DAY = 24 * 3600000;

/** An instant in each civil day the ride touches, the first and the last included. */
function daysOf(read: SunRead): number[] {
    const instants: number[] = [];
    for (let at = read.start; at < read.end; at += DAY) {
        instants.push(at);
    }
    instants.push(read.end);
    return instants;
}

/** The one of a day's events that matters to a ride: the one it is out at, else the last before it, else the first after. */
function aroundRide(read: SunRead, events: (number | null)[]): number | null {
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
function moonAround(read: SunRead): { rise: number | null; set: number | null } {
    const days = [read.start - DAY, ...daysOf(read)].map((at) => moonEvents(at, read.place, read.offset));
    const rises = days.flatMap(({ rise }) => (rise !== null && rise <= read.end ? [rise] : []));
    const sets = days.flatMap(({ set }) => (set !== null && set >= read.start ? [set] : []));
    return { rise: rises.length ? Math.max(...rises) : null, set: sets.length ? Math.min(...sets) : null };
}

/** The bar, the times, what the sun does against the ride, and the note on what the figures leave out. None before the sun is read. */
export function sunRows(read: SunRead | null, { preview = false }: { preview?: boolean } = {}): RoutePageRow[] {
    if (!read) {
        return [];
    }
    // a ride can last past a night: every day it is out on is looked at
    const days = daysOf(read).map((at) => sunEvents(at, read.place, read.offset));
    const { darkMs, glareDistance, moonSides, sides } = read.summary;
    const rows: SunRowData[] = [];
    const meters = new Map<SunClass, number>();
    read.runs.forEach(({ from, k, to }) => {
        const sunClass = SUN_CLASS_ORDER.find((candidate) => SUN_PALETTE_KEYS[candidate] === k);
        meters.set(sunClass, (meters.get(sunClass) ?? 0) + to - from);
    });
    rows.push({ type: 'bar', shares: SUN_CLASS_ORDER.filter((sunClass) => meters.has(sunClass)).map((sunClass) => ({ k: sunClass, meters: meters.get(sunClass) })) });
    rows.push({ type: 'times', start: read.start, end: read.end, offset: read.offset });
    const moon = read.summary.darkMs > 0 ? moonAround(read) : { rise: null, set: null };
    const times = {
        sunset: aroundRide(
            read,
            days.map((day) => day.sunset)
        ),
        dusk: aroundRide(
            read,
            days.map((day) => day.dusk)
        ),
        moonrise: moon.rise,
        moonset: moon.set
    };
    (['sunset', 'dusk', 'moonrise', 'moonset'] as const).forEach((id) => {
        const at = times[id];
        if (at === null) {
            return;
        }
        if (at < read.start) {
            rows.push({ type: 'event', id, at, offset: read.offset, relation: 'before', ms: read.start - at });
        } else if (at > read.end) {
            rows.push({ type: 'event', id, at, offset: read.offset, relation: 'after', ms: at - read.end });
        } else {
            rows.push({ type: 'event', id, at, offset: read.offset, relation: 'during', distance: read.distanceAt(at) });
        }
    });
    if (darkMs > 0) {
        rows.push({ type: 'dark', ms: darkMs });
    }
    if (glareDistance > 0) {
        rows.push({ type: 'glare', meters: glareDistance });
    }
    const daylight = sides.left + sides.right + sides.ahead + sides.behind;
    if (daylight > 0) {
        rows.push({ type: 'side', body: 'sun', left: sides.left / daylight, right: sides.right / daylight, ahead: sides.ahead / daylight, behind: sides.behind / daylight });
    }
    const moonlit = moonSides.left + moonSides.right + moonSides.ahead + moonSides.behind;
    if (moonlit > 0) {
        rows.push({ type: 'side', body: 'moon', left: moonSides.left / moonlit, right: moonSides.right / moonlit, ahead: moonSides.ahead / moonlit, behind: moonSides.behind / moonlit });
    }
    if (preview) {
        rows.push({ type: 'preview' });
    }
    rows.push({ type: 'note' });
    return rows.map((data, index) => ({ key: `${data.type}${data.type === 'event' ? data.id : ''}${index}`, data }));
}
