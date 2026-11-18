/** The track of a ride that was recorded, from the fixes of its session. Pure: nothing here may import NativeScript. */
import { type Recorded, recordedFromLocations } from '~/utils/routeAnalysis/recorded';
import { cumulativeDistances } from '~/utils/routeAnalysis/timeline';

/** A recording shorter than this is not a ride worth keeping: someone started, then stopped at the door. */
export const MIN_RIDE_METERS = 500;
export const MIN_RIDE_MS = 5 * 60_000;
/** metres: a fix closer than this to the last one kept is the position wandering while stopped, not the ride going on. */
const MIN_STEP = 3;
const METERS_PER_DEGREE = 111320;

export interface RideFix {
    lat: number;
    lon: number;
    /** epoch ms */
    timestamp: number;
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

/** The ride a session recorded, or none when it is too short to keep. */
export function rideTrack(fixes: RideFix[], now: number): RideTrack | null {
    const kept: RideFix[] = [];
    for (const fix of fixes) {
        if (!Number.isFinite(fix.lat) || !Number.isFinite(fix.lon) || !Number.isFinite(fix.timestamp)) {
            continue;
        }
        if (!kept.length || metersBetween(kept[kept.length - 1], fix) >= MIN_STEP) {
            kept.push(fix);
        }
    }
    if (kept.length < 2) {
        return null;
    }
    const recorded = recordedFromLocations(kept, now);
    const coordinates = kept.map((fix): [number, number] => [fix.lon, fix.lat]);
    const distance = cumulativeDistances(coordinates)[coordinates.length - 1];
    if (!recorded || distance < MIN_RIDE_METERS || recorded.t[recorded.t.length - 1] * 1000 < MIN_RIDE_MS) {
        return null;
    }
    return { coordinates, recorded, distance };
}
