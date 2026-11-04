import type { Departure } from './types';

/** Epoch ms the ride starts. A planned departure that is already past reads as now. */
export function resolveStart(departure: Departure, now: number): number {
    switch (departure.mode) {
        case 'planned':
            return Math.max(departure.at ?? now, now);
        case 'recorded':
            return departure.at ?? now;
        default:
            return now;
    }
}

/** A plan whose time went by: the Route page offers to shift it to now. */
export function departurePassed(departure: Departure, now: number): boolean {
    return departure.mode === 'planned' && departure.at !== undefined && departure.at < now;
}

/** The zone the ride's clock times are shown in: the route's own once known with its offset, else the phone's clock, flagged. */
export function routeTimeZone(departure: Departure): { tz?: string; offset?: number; fromPhone: boolean } {
    return departure.tz && departure.utcOffset !== undefined ? { tz: departure.tz, offset: departure.utcOffset, fromPhone: false } : { fromPhone: true };
}

/** Record the zone a weather response reported for the route start, and its offset then, in minutes east of UTC. */
export function withRouteTimeZone(departure: Departure, tz: string, utcOffset: number): Departure {
    return { ...departure, tz, utcOffset, tzFromPhone: false };
}
