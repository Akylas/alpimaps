/** The markers of the sun lens on the map. Pure: nothing here may import NativeScript. */
import type { LensSymbol } from '~/routeFeatures/registry';
import { moonAround } from '~/routeFeatures/sun/around';
import { SUN_EVENTS } from '~/routeFeatures/sun/colors';
import type { SunRead } from '~/routeFeatures/sun/read';
import { sunLevel } from '~/utils/astronomy/sun';

/** What the markers are tinted with in the lens palette: the glyph's colour says which of them it is. */
export const SUN_EVENT_PALETTE_KEYS = { sunrise: 'sun_sunrise', sunset: 'sun_sunset', moonrise: 'sun_moonrise', moonset: 'sun_moonset' };

type EventId = keyof typeof SUN_EVENT_PALETTE_KEYS;

/** over the map's own labels, which a small marker must not lose its place to */
const MARKER_PRIORITY = 30;

/** The moon is a light only with the sun down: its rising and setting are worth a mark in the twilight and the night. */
function darkAt(read: SunRead, vertex: number): boolean {
    const level = sunLevel(read.at(vertex).altitude);
    return level === 'twilight' || level === 'night';
}

export interface RideMoonEvent {
    id: 'moonrise' | 'moonset';
    at: number;
    /** m from the start */
    distance: number;
    vertex: number;
}

/** Where the moon rises and sets on the ride, with the sun down: the ones before it starts or after it ends have no place on it. */
export function rideMoonEvents(read: SunRead): RideMoonEvent[] {
    const moon = moonAround(read);
    return (['moonrise', 'moonset'] as const).flatMap((id) => {
        const at = id === 'moonrise' ? moon.rise : moon.set;
        if (at === null || at < read.start || at > read.end) {
            return [];
        }
        const distance = read.distanceAt(at);
        const vertex = read.indexAtDistance(distance);
        return darkAt(read, vertex) ? [{ id, at, distance, vertex }] : [];
    });
}

/**
 * A marker, a glyph and a time like a point of interest, where the sun goes down and where it rises on the ride, and where the moon
 * does in the dark, the time said by `clock` in the zone of the route. At the vertex the sun was looked at when it crossed the horizon.
 */
export function sunSymbols(read: SunRead, clock: (at: number) => string): LensSymbol[] {
    const { sunrise, sunset } = read.summary;
    const events: { id: EventId; at: number; vertex: number }[] = rideMoonEvents(read);
    if (sunrise) {
        events.push({ id: 'sunrise', at: sunrise.at, vertex: read.indexAtDistance(sunrise.distance) });
    }
    if (sunset) {
        events.push({ id: 'sunset', at: sunset.at, vertex: read.indexAtDistance(sunset.distance) });
    }
    return events
        .map(
            ({ at, id, vertex }): LensSymbol => ({
                shape: 'marker',
                vertex,
                label: clock(at),
                glyph: SUN_EVENTS[id].icon,
                severity: 0,
                tint: SUN_EVENT_PALETTE_KEYS[id],
                priority: MARKER_PRIORITY
            })
        )
        .sort((first, second) => first.vertex - second.vertex);
}
