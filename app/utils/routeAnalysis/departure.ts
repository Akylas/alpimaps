import type { Departure, LayerId } from './types';

/** A stamped `now` older than this is offered a refresh. */
export const SNAPSHOT_OLD_MS = 15 * 60_000;
/** Layers computed together stamp within this and share the stamp: it is part of what their data is hashed with. */
export const STAMP_REUSE_MS = 10_000;
/** The layers whose data is read at the time of the ride: computing one of them stamps a `now`. */
export const TIME_LAYERS: LayerId[] = ['weather', 'sun'];

/** A `now` the user pressed or a layer was read in: it keeps its time, as the data it has is from then. Else it floats with the clock. */
export function isSnapshot(departure: Departure): boolean {
    return departure.mode === 'now' && departure.at !== undefined;
}

/** A `now` never refreshed: the ride leaves with the clock, so its start is not a time to say. */
export function floatsWithClock(departure: Departure): boolean {
    return departure.mode === 'now' && departure.at === undefined;
}

/** The start the user or the snapshot holds, for the clock times that say it. None: it floats with the clock, or is recorded. */
export function fixedStart(departure: Departure): number | undefined {
    return departure.mode === 'planned' || isSnapshot(departure) ? departure.at : undefined;
}

/** Stamps a `now` with the time. A recent stamp stays, so what is computed together is hashed with the same one. */
export function stampNow(departure: Departure, now: number): Departure {
    if (departure.mode !== 'now' || (departure.at !== undefined && now - departure.at >= 0 && now - departure.at < STAMP_REUSE_MS)) {
        return departure;
    }
    return { ...departure, at: now };
}

/** A snapshot whose data has aged: the Route page offers to move it to the clock. */
export function snapshotOutdated(departure: Departure, now: number): boolean {
    return isSnapshot(departure) && now - departure.at >= SNAPSHOT_OLD_MS;
}

/** Epoch ms the ride starts. A planned departure that is already past reads as now, unless the user kept it; a stamped now stays where it was stamped. */
export function resolveStart(departure: Departure, now: number): number {
    switch (departure.mode) {
        case 'planned':
            return departure.keepPast ? (departure.at ?? now) : Math.max(departure.at ?? now, now);
        case 'recorded':
            return departure.at ?? now;
        default:
            return departure.at ?? now;
    }
}

/** A plan whose time went by: the Route page offers to shift it to now. */
export function departurePassed(departure: Departure, now: number): boolean {
    return departure.mode === 'planned' && departure.at !== undefined && departure.at < now && !departure.keepPast;
}

/** The zone the ride's clock times are shown in: the route's own once known with its offset, else the phone's clock, flagged. */
export function routeTimeZone(departure: Departure): { tz?: string; offset?: number; fromPhone: boolean } {
    return departure.tz && departure.utcOffset !== undefined ? { tz: departure.tz, offset: departure.utcOffset, fromPhone: false } : { fromPhone: true };
}

/** Record the zone a weather response reported for the route start, and its offset then, in minutes east of UTC. */
export function withRouteTimeZone(departure: Departure, tz: string, utcOffset: number): Departure {
    return { ...departure, tz, utcOffset, tzFromPhone: false };
}

/** The offset of the route's zone at an instant, minutes east of UTC; none: the phone's clock. */
export type OffsetAt = (at: number) => number | undefined;

/**
 * The route's zone offset at each instant, which is not one number for a ride over a change of the clocks. `zoneOffset` is the platform's
 * zone database (the runtime has no `Intl`); without it, or when it cannot say, the offset the route was given at its start holds.
 */
export function offsetAtFor(departure: Departure, zoneOffset?: (tz: string, at: number) => number | undefined): OffsetAt {
    const { offset } = routeTimeZone(departure);
    const { tz } = departure;
    return (at) => (tz && zoneOffset ? (zoneOffset(tz, at) ?? offset) : offset);
}
