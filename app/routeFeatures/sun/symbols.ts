/** The markers of the sun lens on the map. Pure: nothing here may import NativeScript. */
import type { LensSymbol } from '~/routeFeatures/registry';
import type { SunRead } from '~/routeFeatures/sun/read';

/** What the markers are tinted with in the lens palette: the glyph's colour says which of the two it is. */
export const SUN_EVENT_PALETTE_KEYS = { sunrise: 'sun_sunrise', sunset: 'sun_sunset' };

const EVENT_GLYPHS = { sunrise: 'mdi-weather-sunset-up', sunset: 'mdi-weather-sunset-down' };
/** over the map's own labels, which a small marker must not lose its place to */
const MARKER_PRIORITY = 30;

/**
 * A marker, a glyph and a time like a point of interest, where the sun goes down and where it rises on the ride, the time said by `clock`
 * in the zone of the route. At the vertex the sun was looked at when it crossed the horizon.
 */
export function sunSymbols(read: SunRead, clock: (at: number) => string): LensSymbol[] {
    return (['sunrise', 'sunset'] as const)
        .flatMap((id) => {
            const event = read.summary[id];
            return event ? [{ id, event }] : [];
        })
        .map(
            ({ event, id }): LensSymbol => ({
                shape: 'marker',
                vertex: read.indexAtDistance(event.distance),
                label: clock(event.at),
                glyph: EVENT_GLYPHS[id],
                severity: 0,
                tint: SUN_EVENT_PALETTE_KEYS[id],
                priority: MARKER_PRIORITY
            })
        )
        .sort((first, second) => first.vertex - second.vertex);
}
