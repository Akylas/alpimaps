/**
 * The sun along a ride: where it is, how high, whether it blinds and on which side. Pure, and nothing of the app in it
 * (suncalc only), like `moon.ts`. Angles are suncalc 2's, in degrees: azimuth clockwise from north, altitude as seen.
 */
import { getPosition } from 'suncalc';

export interface SunPosition {
    azimuth: number;
    altitude: number;
}

/** Where the sun is, degrees: azimuth clockwise from north, altitude as seen (refraction included, so it compares with a skyline). */
export function sunPositionAt(time: number, position: { lat: number; lon: number }): SunPosition {
    const { altitude, azimuth } = getPosition(new Date(time), position.lat, position.lon);
    return { azimuth, altitude };
}

/** `low`: the sun is up but under `LOW_SUN`, `twilight`: set, until civil dusk, `night`: darker than that. */
export type SunLevel = 'day' | 'low' | 'twilight' | 'night';

/** Sunset and sunrise as suncalc says them, and civil dusk. Degrees. */
const SUN_DOWN = -0.833;
const CIVIL_DUSK = -6;
const LOW_SUN = 10;

export function sunLevel(altitude: number): SunLevel {
    if (altitude >= LOW_SUN) {
        return 'day';
    }
    if (altitude >= SUN_DOWN) {
        return 'low';
    }
    return altitude >= CIVIL_DUSK ? 'twilight' : 'night';
}

/** The way from one heading to a direction, the short way round: above 0 clockwise. Degrees, -180 to 180. */
function turnFrom(heading: number, direction: number): number {
    return ((direction - heading + 540) % 360) - 180;
}

export interface GlareRule {
    /** the sun blinds under this altitude, degrees */
    below: number;
    /** and within this many degrees of the way the ride goes */
    window: number;
}

/** The sun blinds a ride that goes toward it while it is low. Not when it is down, and not without a heading to compare. */
export function isGlare(sun: SunPosition, heading: number | undefined, rule: GlareRule): boolean {
    if (heading === undefined || sun.altitude < SUN_DOWN || sun.altitude >= rule.below) {
        return false;
    }
    return Math.abs(turnFrom(heading, sun.azimuth)) <= rule.window;
}

export type SunSide = 'left' | 'right' | 'ahead' | 'behind';

/** Where the sun is against the way the ride goes: ahead and behind are 45 degrees either side, the rest is the sides. */
export function sunSide(azimuth: number, heading: number): SunSide {
    const turn = turnFrom(heading, azimuth);
    if (Math.abs(turn) <= 45) {
        return 'ahead';
    }
    if (Math.abs(turn) >= 135) {
        return 'behind';
    }
    return turn > 0 ? 'right' : 'left';
}
