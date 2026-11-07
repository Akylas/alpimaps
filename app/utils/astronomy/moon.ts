/**
 * The moon along a ride: its phase as a glyph, the lit part, and how long it is up while the sun is not. Pure, and nothing of the app in it
 * (suncalc only): it is the part the weather apps of the family can share. Altitudes are suncalc 2's, in degrees.
 */
import { getMoonIllumination, getMoonPosition, getMoonTimes, getPosition } from 'suncalc';

const glyph = (codePoint: number) => String.fromCodePoint(codePoint);

/** Material Design Icons, in the order of the lunation: new, waxing crescent, first quarter, waxing gibbous, full, waning gibbous, last quarter, waning crescent. */
export const MOON_GLYPHS = [0xf0f64, 0xf0f67, 0xf0f61, 0xf0f68, 0xf0f62, 0xf0f66, 0xf0f63, 0xf0f65].map(glyph);

/** The sun is under the horizon, as sunset and sunrise say it (suncalc's own `-0.833`). Degrees. */
const SUN_DOWN = -0.833;
/** The moon is up when its centre is over the horizon. Degrees. */
const MOON_UP = 0;
/** Minutes between two looks at the sky along a ride. */
const STEP = 5;
const MINUTE = 60000;

/** The phase of the moon at a time: a glyph of the eight. */
export function moonPhaseGlyph(date: Date): string {
    return MOON_GLYPHS[Math.round(getMoonIllumination(date).phase * MOON_GLYPHS.length) % MOON_GLYPHS.length];
}

/** The lit part of the moon in whole percents. */
export function moonIllumination(date: Date): number {
    return Math.round(getMoonIllumination(date).fraction * 100);
}

/** The sun is under the horizon at a time and a place: epoch ms. */
export function isNight(at: number, lat: number, lon: number): boolean {
    return getPosition(new Date(at), lat, lon).altitude < SUN_DOWN;
}

export interface NightMoon {
    /** the phase in the middle of the ride */
    glyph: string;
    /** the lit part in the middle of the ride, in percents */
    illumination: number;
    /** minutes of the ride spent in the dark with the moon over the horizon: the night that is lit */
    moonlitMinutes: number;
}

/** The moon over the dark part of a ride from `start` to `end` (epoch ms) at a place. */
export function nightMoon(start: number, end: number, lat: number, lon: number): NightMoon {
    const middle = new Date((start + end) / 2);
    let moonlit = 0;
    for (let at = start; at < end; at += STEP * MINUTE) {
        const date = new Date(at + (STEP * MINUTE) / 2);
        if (getPosition(date, lat, lon).altitude < SUN_DOWN && getMoonPosition(date, lat, lon).altitude > MOON_UP) {
            moonlit += Math.min(STEP, (end - at) / MINUTE);
        }
    }
    return { glyph: moonPhaseGlyph(middle), illumination: moonIllumination(middle), moonlitMinutes: Math.round(moonlit) };
}

/** Where the moon is, degrees: azimuth clockwise from north, altitude as seen. */
export function moonPositionAt(at: number, place: { lat: number; lon: number }): { azimuth: number; altitude: number } {
    const { altitude, azimuth } = getMoonPosition(new Date(at), place.lat, place.lon);
    return { azimuth, altitude };
}

export interface MoonEvents {
    /** epoch ms, or null on the day the moon does not rise or set */
    rise: number | null;
    set: number | null;
}

/** The moonrise and the moonset of the civil day `at` falls in, in the zone of `utcOffset` (minutes east of UTC) when given. */
export function moonEvents(at: number, place: { lat: number; lon: number }, utcOffset?: number): MoonEvents {
    const { rise, set } = getMoonTimes(new Date(at), place.lat, place.lon, utcOffset);
    return { rise: rise ? rise.getTime() : null, set: set ? set.getTime() : null };
}
