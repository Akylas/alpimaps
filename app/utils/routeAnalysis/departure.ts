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

/** The zone the ride's clock times are shown in: the route's own once known, else the phone's, flagged. */
export function routeTimeZone(departure: Departure, phoneZone = Intl.DateTimeFormat().resolvedOptions().timeZone): { tz: string; fromPhone: boolean } {
    return departure.tz ? { tz: departure.tz, fromPhone: false } : { tz: phoneZone, fromPhone: true };
}

/** Record the zone a weather response reported for the route start. */
export function withRouteTimeZone(departure: Departure, tz: string): Departure {
    return { ...departure, tz, tzFromPhone: false };
}
