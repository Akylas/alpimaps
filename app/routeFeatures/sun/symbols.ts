/** The plates of the sun lens on the map. Pure: nothing here may import NativeScript. */
import type { LensSymbol } from '~/routeFeatures/registry';
import type { SunRead } from '~/routeFeatures/sun/read';

/** What the plates are tinted with in the lens palette: the rim says which of the two it is. */
export const SUN_EVENT_PALETTE_KEYS = { sunrise: 'sun_sunrise', sunset: 'sun_sunset' };

const EVENT_GLYPHS = { sunrise: 'mdi-weather-sunset-up', sunset: 'mdi-weather-sunset-down' };
/** above the plates of the weather, which share the map line when the lens is the sun's: nothing else is on it */
const PLATE_PRIORITY = 30;

/**
 * A plate where the sun goes down and where it rises on the ride, with the time it does, said by `clock` in the zone of the route.
 * The ride's own vertex: the one the sun was looked at when it crossed the horizon.
 */
export function sunSymbols(read: SunRead, clock: (at: number) => string): LensSymbol[] {
    return (['sunrise', 'sunset'] as const)
        .flatMap((id) => {
            const event = read.summary[id];
            return event ? [{ id, event }] : [];
        })
        .map(
            ({ event, id }): LensSymbol => ({
                shape: 'plate',
                vertex: read.indexAtDistance(event.distance),
                label: clock(event.at),
                glyph: EVENT_GLYPHS[id],
                severity: 0,
                tint: SUN_EVENT_PALETTE_KEYS[id],
                priority: PLATE_PRIORITY
            })
        )
        .sort((first, second) => first.vertex - second.vertex);
}
