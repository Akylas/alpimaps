/** The rows of the Sun card of the route page. Pure: nothing here may import NativeScript. */
import type { RoutePageRow } from '~/routeFeatures/registry';
import { aroundRide, daysOf, moonAround } from '~/routeFeatures/sun/around';
import { SUN_CLASS_ORDER, SUN_PALETTE_KEYS, type SunClass, type SunRead } from '~/routeFeatures/sun/read';
import { sunEvents } from '~/utils/astronomy/sun';

/** An event of the sun or the moon against the ride: during it (the distance), before it starts or after it ends (ms). */
export interface SunEventData {
    id: 'sunrise' | 'sunset' | 'dusk' | 'moonrise' | 'moonset';
    at: number;
    offset?: number;
    relation: 'during' | 'before' | 'after';
    distance?: number;
    ms?: number;
}

export type SunRowData =
    /** what the route is made of, by class of the sun, in metres */
    | { type: 'bar'; shares: { k: SunClass; meters: number }[] }
    /** the figures of the ride as chips in one row: the events of the sun and the moon, and how long the dark, the moonlight, the shade and the glare last */
    | { type: 'chips'; events: SunEventData[]; darkMs: number; moonlitMs: number; shadeMeters: number; glareMeters: number }
    /** the shares of the metres ridden by day, by where the sun is against the way; or by the light of the moon, by where it is */
    | { type: 'side'; body: 'sun' | 'moon'; left: number; right: number; ahead: number; behind: number }
    /** the button that lights the 3D map with the sun of the ride */
    | { type: 'preview' }
    /** what the figures leave out: with the terrain counted, the trees and the buildings; else the terrain too */
    | { type: 'note'; terrain: boolean };

/** The bar, what the sun does against the ride, and the note on what the figures leave out. None before the sun is read. */
export function sunRows(read: SunRead | null, { preview = false }: { preview?: boolean } = {}): RoutePageRow[] {
    if (!read) {
        return [];
    }
    // a ride can last past a night: every day it is out on is looked at
    const days = daysOf(read).map((at) => sunEvents(at, read.place, read.offsetAt(at)));
    const { darkMs, glareDistance, moonSides, sides } = read.summary;
    const rows: SunRowData[] = [];
    const meters = new Map<SunClass, number>();
    read.runs.forEach(({ from, k, to }) => {
        const sunClass = SUN_CLASS_ORDER.find((candidate) => SUN_PALETTE_KEYS[candidate] === k);
        meters.set(sunClass, (meters.get(sunClass) ?? 0) + to - from);
    });
    rows.push({ type: 'bar', shares: SUN_CLASS_ORDER.filter((sunClass) => meters.has(sunClass)).map((sunClass) => ({ k: sunClass, meters: meters.get(sunClass) })) });
    const moon = read.summary.darkMs > 0 ? moonAround(read) : { rise: null, set: null };
    const times = {
        sunrise: aroundRide(
            read,
            days.map((day) => day.sunrise)
        ),
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
    const events: SunEventData[] = [];
    (['sunrise', 'sunset', 'dusk', 'moonrise', 'moonset'] as const).forEach((id) => {
        const at = times[id];
        if (at === null) {
            return;
        }
        const offset = read.offsetAt(at);
        if (at < read.start) {
            events.push({ id, at, offset, relation: 'before', ms: read.start - at });
        } else if (at > read.end) {
            events.push({ id, at, offset, relation: 'after', ms: at - read.end });
        } else {
            events.push({ id, at, offset, relation: 'during', distance: read.distanceAt(at) });
        }
    });
    rows.push({ type: 'chips', events, darkMs, moonlitMs: read.summary.moonlitMs, shadeMeters: read.summary.shadeDistance, glareMeters: glareDistance });
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
    rows.push({ type: 'note', terrain: read.shaded });
    return rows.map((data, index) => ({ key: `${data.type}${index}`, data }));
}
