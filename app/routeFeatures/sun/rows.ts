/** The rows of the Sun card of the route page. Pure: nothing here may import NativeScript. */
import type { RoutePageRow } from '~/routeFeatures/registry';
import { SUN_PALETTE_KEYS, type SunClass, type SunRead } from '~/routeFeatures/sun/read';
import { sunEvents } from '~/utils/astronomy/sun';

export type SunRowData =
    /** what the route is made of, by class of the sun, in metres */
    | { type: 'bar'; shares: { k: SunClass; meters: number }[] }
    /** epoch ms the ride starts and ends, in the route's zone */
    | { type: 'times'; start: number; end: number; offset?: number }
    /** the sunset or the end of civil twilight of the day, against the ride: during it (the distance), before it starts or after it ends (ms) */
    | { type: 'event'; id: 'sunset' | 'dusk'; at: number; offset?: number; relation: 'during' | 'before' | 'after'; distance?: number; ms?: number }
    | { type: 'dark'; ms: number }
    | { type: 'glare'; meters: number }
    /** the shares of the metres ridden by day, by where the sun is against the way */
    | { type: 'side'; left: number; right: number; ahead: number; behind: number }
    | { type: 'note' };

const CLASSES = Object.keys(SUN_PALETTE_KEYS) as SunClass[];

/** The bar, the times, what the sun does against the ride, and the note on what the figures leave out. None before the sun is read. */
export function sunRows(read: SunRead | null): RoutePageRow[] {
    if (!read) {
        return [];
    }
    const events = sunEvents(read.start, read.place, read.offset);
    const { darkMs, glareDistance, sides } = read.summary;
    const rows: SunRowData[] = [];
    const meters = new Map<SunClass, number>();
    read.runs.forEach(({ from, k, to }) => {
        const sunClass = CLASSES.find((candidate) => SUN_PALETTE_KEYS[candidate] === k);
        meters.set(sunClass, (meters.get(sunClass) ?? 0) + to - from);
    });
    rows.push({ type: 'bar', shares: CLASSES.filter((sunClass) => meters.has(sunClass)).map((sunClass) => ({ k: sunClass, meters: meters.get(sunClass) })) });
    rows.push({ type: 'times', start: read.start, end: read.end, offset: read.offset });
    (['sunset', 'dusk'] as const).forEach((id) => {
        const at = events[id];
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
        rows.push({ type: 'side', left: sides.left / daylight, right: sides.right / daylight, ahead: sides.ahead / daylight, behind: sides.behind / daylight });
    }
    rows.push({ type: 'note' });
    return rows.map((data, index) => ({ key: `${data.type}${data.type === 'event' ? data.id : ''}${index}`, data }));
}
