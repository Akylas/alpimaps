/** What the sun and the moon say of a ride, for the strip under the tiles. Pure: nothing here may import NativeScript. */
import { aroundRide, daysOf, moonAround } from '~/routeFeatures/sun/around';
import type { SunRead } from '~/routeFeatures/sun/read';
import { nightMoon } from '~/utils/astronomy/moon';
import { sunEvents } from '~/utils/astronomy/sun';

export interface TripEvent {
    id: 'sunrise' | 'sunset' | 'moonrise' | 'moonset';
    at: number;
    relation: 'during' | 'before' | 'after';
    /** m from the start, for an event during the ride */
    distance?: number;
    /** ms before the start or after the end, for an event out of the ride */
    ms?: number;
}

export interface SunTrip {
    events: TripEvent[];
    /** the moon over the dark part of the ride; none for a ride in daylight */
    moon?: { glyph: string; illumination: number };
    darkMs: number;
}

/**
 * The few events worth a chip: the sun's own while the ride is out at them, the day's light for a ride that is all in it, and for a ride in
 * the dark the moon's: when it sets if it lights the way, when it rises if that is on the way.
 */
export function sunTrip(read: SunRead): SunTrip {
    const { darkMs, moonlitMs } = read.summary;
    const days = daysOf(read).map((at) => sunEvents(at, read.place, read.offsetAt(at)));
    const during = (at: number | null) => at !== null && at >= read.start && at <= read.end;
    const eventOf = (id: TripEvent['id'], at: number): TripEvent => {
        if (during(at)) {
            return { id, at, relation: 'during', distance: read.distanceAt(at) };
        }
        return at < read.start ? { id, at, relation: 'before', ms: read.start - at } : { id, at, relation: 'after', ms: at - read.end };
    };

    const rise = aroundRide(
        read,
        days.map((day) => day.sunrise)
    );
    const set = aroundRide(
        read,
        days.map((day) => day.sunset)
    );
    const daylightOnly = darkMs === 0;
    const events: TripEvent[] = [];
    if (rise !== null && (during(rise) || (daylightOnly && !during(set)))) {
        events.push(eventOf('sunrise', rise));
    }
    if (set !== null && (during(set) || (daylightOnly && !during(rise)))) {
        events.push(eventOf('sunset', set));
    }
    if (darkMs <= 0) {
        return { events, darkMs };
    }
    const moon = nightMoon(read.start, read.end, read.place.lat, read.place.lon);
    if (!events.length) {
        const around = moonAround(read);
        if (moonlitMs > 0 && around.set !== null) {
            events.push(eventOf('moonset', around.set));
        } else if (during(around.rise)) {
            events.push(eventOf('moonrise', around.rise));
        }
    }
    return { events, moon: { glyph: moon.glyph, illumination: moon.illumination }, darkMs };
}
