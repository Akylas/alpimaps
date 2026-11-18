/** The track of a ride that was recorded, from the fixes of its session. Pure: nothing here may import NativeScript. */
import { type Recorded, recordedFromLocations } from '~/utils/routeAnalysis/recorded';
import { cumulativeDistances } from '~/utils/routeAnalysis/timeline';

/** A recording shorter than this is not a ride worth keeping: someone started, then stopped at the door. */
export const MIN_RIDE_METERS = 500;
export const MIN_RIDE_MS = 5 * 60_000;
/** metres: a fix closer than this to the last one kept is the position wandering while stopped, not the ride going on. */
const MIN_STEP = 3;
/** metres: a fix the gps is less sure of than this is left out, as the session leaves it out of its distance. */
const MAX_ACCURACY = 30;
/** m/s: at or under this the rider is stopped, whatever the position says. */
const STOPPED_SPEED = 0.3;
const METERS_PER_DEGREE = 111320;

export interface RideFix {
    lat: number;
    lon: number;
    /** epoch ms */
    timestamp: number;
    /** metres; none: not told */
    horizontalAccuracy?: number;
    /** m/s over ground, negative when the gps has none */
    speed?: number;
}

export interface RideTrack {
    /** lon / lat, one per time of `recorded` */
    coordinates: [number, number][];
    recorded: Recorded;
    /** metres */
    distance: number;
}

function metersBetween(from: RideFix, to: RideFix) {
    const dx = (to.lon - from.lon) * Math.cos((to.lat * Math.PI) / 180);
    return Math.hypot(dx, to.lat - from.lat) * METERS_PER_DEGREE;
}

/** A fix worth keeping: it has a place and a time, and the gps is neither unsure of it nor saying the rider is stopped. */
export function isRideFix(fix: RideFix) {
    if (!Number.isFinite(fix.lat) || !Number.isFinite(fix.lon) || !Number.isFinite(fix.timestamp)) {
        return false;
    }
    return !(fix.horizontalAccuracy > MAX_ACCURACY || (fix.speed >= 0 && fix.speed <= STOPPED_SPEED));
}

/** Whether `fix` is further on than the last one kept, not the position wandering. */
export function isRideStep(last: RideFix | undefined, fix: RideFix) {
    return !last || metersBetween(last, fix) >= MIN_STEP;
}

/** why a recording is not kept: nothing moved, it went too short a way, or it did not last */
export type RideRejection = 'no_movement' | 'too_short' | 'too_brief';
export type RideOutcome = { track: RideTrack } | { reason: RideRejection; /** metres */ distance: number; /** seconds */ elapsed: number };

/** The ride a session recorded, or why it is too short to keep. */
export function rideOutcome(fixes: RideFix[], now: number): RideOutcome {
    const kept: RideFix[] = [];
    for (const fix of fixes) {
        if (isRideFix(fix) && isRideStep(kept[kept.length - 1], fix)) {
            kept.push(fix);
        }
    }
    const recorded = kept.length < 2 ? null : recordedFromLocations(kept, now);
    if (!recorded) {
        return { reason: 'no_movement', distance: 0, elapsed: 0 };
    }
    const coordinates = kept.map((fix): [number, number] => [fix.lon, fix.lat]);
    const distance = cumulativeDistances(coordinates)[coordinates.length - 1];
    const elapsed = recorded.t[recorded.t.length - 1];
    if (distance < MIN_RIDE_METERS) {
        return { reason: 'too_short', distance, elapsed };
    }
    if (elapsed * 1000 < MIN_RIDE_MS) {
        return { reason: 'too_brief', distance, elapsed };
    }
    return { track: { coordinates, recorded, distance } };
}

/** The ride a session recorded, or none when it is too short to keep. */
export function rideTrack(fixes: RideFix[], now: number): RideTrack | null {
    const outcome = rideOutcome(fixes, now);
    return 'track' in outcome ? outcome.track : null;
}
