import type { MapPos } from '~/utils/geo';
import { maxAgeMonth, networkService } from '~/services/NetworkService';
import { addSncfRealtime } from '~/features/trains/SncfRealtimeService';

const STATION_RADIUS_DEGREES = 0.003;

// How long a response is served from the disk cache, in seconds. The stops and the names do not move, the times do:
// a minute is short enough for a board and spares the service when sheets and pages are opened one after the other
const CACHE_STOPS = maxAgeMonth;
const CACHE_GEOCODE = 24 * 60 * 60;
const CACHE_TRIP = 60;
const CACHE_PLAN = 60;
const CACHE_TIMES = 30;
// a timetable asked for a given time does not change while it is read
const CACHE_TIMES_AT = 120;

// Transitous (MOTIS) is a volunteer-run, open-source-only service: identify the app and keep the attribution visible
export const TRANSITOUS_URL = 'https://api.transitous.org/api';
const HEADERS = { 'User-Agent': `${__APP_ID__}/${__APP_VERSION__} (https://github.com/Akylas/alpimaps)` };

const ARRIVALS_LOOKAHEAD = 90 * 60 * 1000;
const GONE_TOLERANCE = 2 * 60 * 1000;
const RAIL_MODES = ['NIGHT_RAIL', 'HIGHSPEED_RAIL', 'LONG_DISTANCE', 'REGIONAL_RAIL', 'SUBURBAN'];
// what a station board lists: trains, long distance coaches (FlixBus...) and on-demand services (Flexibus...), not the local trams and buses
const STATION_MODES = [...RAIL_MODES, 'COACH', 'ODM'];

export interface TransitousPlace {
    name: string;
    stopId?: string;
    lat: number;
    lon: number;
    /** ISO, UTC. Already includes the real-time delay when there is one */
    arrival?: string;
    departure?: string;
    scheduledArrival?: string;
    scheduledDeparture?: string;
    track?: string;
    cancelled?: boolean;
    modes?: string[];
    /** `NOT_ALLOWED`: nobody gets on / off here */
    pickupType?: 'NORMAL' | 'NOT_ALLOWED';
    dropoffType?: 'NORMAL' | 'NOT_ALLOWED';
}

export interface TransitousStopTime {
    place: TransitousPlace;
    mode: string;
    realTime: boolean;
    headsign: string;
    displayName?: string;
    /** the commercial train number, as text */
    tripShortName?: string;
    routeId?: string;
    directionId?: number;
    routeShortName?: string;
    routeLongName?: string;
    routeColor?: string;
    routeTextColor?: string;
    agencyName?: string;
    tripId: string;
    tripFrom?: TransitousPlace;
    tripTo?: TransitousPlace;
    cancelled?: boolean;
}

export interface TransitousStop {
    id: string;
    name: string;
    lat: number;
    lon: number;
    modes?: string[];
}

export interface TransitousLeg {
    mode: string;
    from: TransitousPlace;
    to: TransitousPlace;
    startTime: string;
    endTime: string;
    duration: number;
    realTime: boolean;
    headsign?: string;
    displayName?: string;
    routeId?: string;
    directionId?: number;
    routeShortName?: string;
    routeLongName?: string;
    routeColor?: string;
    routeTextColor?: string;
    agencyName?: string;
    agencyUrl?: string;
    /** where to buy tickets, when the operator publishes it */
    agencyFareUrl?: string;
    tripId?: string;
    tripFrom?: TransitousPlace;
    tripTo?: TransitousPlace;
    distance?: number;
    /** encoded polyline, precision in `legGeometry.precision` */
    legGeometry?: { points: string; length: number; precision?: number };
    intermediateStops?: TransitousPlace[];
    cancelled?: boolean;
    /** the commercial train number, as text */
    tripShortName?: string;
    wheelchairAccessible?: 'ACCESSIBLE' | 'NOT_ACCESSIBLE';
    bikesAllowed?: boolean;
    /** `COMPULSORY`: it must be booked */
    reservation?: 'NONE' | 'COMPULSORY';
}

export interface TransitousItinerary {
    startTime: string;
    endTime: string;
    duration: number;
    transfers: number;
    legs: TransitousLeg[];
}

export interface TransitousPlan {
    itineraries: TransitousItinerary[];
    nextPageCursor?: string;
    previousPageCursor?: string;
}

const SNCF_CONNECT_URL = 'https://www.sncf-connect.com/';

/** The operator's own ticket page when the feed has one, SNCF Connect for SNCF trains (their feeds carry no link). */
export function itineraryTicketUrl(itinerary: TransitousItinerary) {
    const transitLegs = itinerary.legs.filter((leg) => leg.mode !== 'WALK' && leg.mode !== 'BIKE' && leg.mode !== 'CAR');
    return (
        transitLegs.find((leg) => leg.agencyFareUrl)?.agencyFareUrl ||
        (transitLegs.some((leg) => /sncf/i.test(leg.agencyName ?? '')) ? SNCF_CONNECT_URL : undefined) ||
        transitLegs.find((leg) => leg.agencyUrl)?.agencyUrl
    );
}

export function isRailMode(mode: string) {
    return RAIL_MODES.includes(mode);
}

const MODE_ICONS: Record<string, string> = {
    WALK: 'mdi-walk',
    BIKE: 'mdi-bike',
    CAR: 'mdi-car',
    BUS: 'mdi-bus',
    COACH: 'mdi-bus-side',
    TRAM: 'mdi-tram',
    SUBWAY: 'mdi-subway-variant',
    FERRY: 'mdi-ferry',
    AIRPLANE: 'mdi-airplane',
    FUNICULAR: 'mdi-gondola',
    AERIAL_LIFT: 'mdi-gondola'
};

export function modeIcon(mode: string) {
    return MODE_ICONS[mode] ?? (isRailMode(mode) ? 'mdi-train' : 'mdi-transit-connection-variant');
}

function formatPosition(position: MapPos) {
    return `${position.lat},${position.lon}`;
}

class TransitousService {
    /** `maxAge`: how long the cached answer to the same request is good for; `fresh`: ask again whatever is cached */
    private get<T>(path: string, queryParams: Record<string, string | number | boolean>, { fresh = false, maxAge = 0 } = {}) {
        return networkService.request<T>({
            url: `${TRANSITOUS_URL}/${path}`,
            method: 'GET',
            queryParams,
            headers: maxAge ? { ...HEADERS, 'Cache-Control': networkService.getCacheControl(maxAge, 0, fresh) } : HEADERS
        });
    }

    /** the stops around `position`, nearest first; `modes`: only those a vehicle of these modes serves */
    async findStops(position: MapPos, { maxStops = 3, modes, radius = STATION_RADIUS_DEGREES }: { maxStops?: number; modes?: string[]; radius?: number } = {}): Promise<TransitousStop[]> {
        const stops = await this.get<TransitousPlace[]>(
            'v6/map/stops',
            {
                min: formatPosition({ lat: position.lat - radius, lon: position.lon - radius }),
                max: formatPosition({ lat: position.lat + radius, lon: position.lon + radius }),
                grouped: false,
                ...(modes ? { modes: modes.join(',') } : {})
            },
            { maxAge: CACHE_STOPS }
        );
        const squaredDistance = (stop: TransitousPlace) => (stop.lat - position.lat) ** 2 + (stop.lon - position.lon) ** 2;
        return stops
            .filter((stop) => stop.stopId && (!modes || stop.modes?.some((mode) => modes.includes(mode))))
            .sort((first, second) => squaredDistance(first) - squaredDistance(second))
            .slice(0, maxStops)
            .map((stop) => ({ id: stop.stopId, name: stop.name, lat: stop.lat, lon: stop.lon, modes: stop.modes }));
    }
    /** the stops a train can be taken from around `position`, nearest first */
    findRailStops(position: MapPos, maxStops = 3) {
        return this.findStops(position, { maxStops, modes: STATION_MODES });
    }
    async geocode(text: string, language: string): Promise<TransitousStop[]> {
        return this.get<TransitousStop[]>('v1/geocode', { text, type: 'STOP', language }, { maxAge: CACHE_GEOCODE });
    }

    /** `arrivals`: the trains reaching the stop instead of leaving it */
    async getStopTimes(stopId: string, { arrivals = false, count = 30, fresh, modes, time }: { arrivals?: boolean; count?: number; fresh?: boolean; modes?: string[]; time?: Date } = {}) {
        const { stopTimes } = await this.get<{ stopTimes: TransitousStopTime[] }>(
            'v6/stoptimes',
            {
                stopId,
                n: count,
                arriveBy: arrivals,
                ...(modes ? { mode: modes.join(',') } : {}),
                ...(time ? { time: time.toISOString() } : {})
            },
            { fresh, maxAge: time ? CACHE_TIMES_AT : CACHE_TIMES }
        );
        return stopTimes;
    }

    /** the next departures of the stops around `position`, in one request */
    async getStopTimesAround(position: MapPos, { count = 30, fresh, radius = 100 }: { count?: number; fresh?: boolean; radius?: number } = {}) {
        const { stopTimes } = await this.get<{ stopTimes: TransitousStopTime[] }>('v6/stoptimes', { center: formatPosition(position), radius, n: count }, { fresh, maxAge: CACHE_TIMES });
        return stopTimes;
    }
    /** several stops of one station (SNCF and the regional operators) merged, next one first */
    async getStationTimes(stops: TransitousStop[], { arrivals = false, count = 30, fresh = false } = {}) {
        // arrivals can only be paged backwards: ask for the ones before a time in the future, then drop the gone ones
        const now = Date.now();
        const time = arrivals ? new Date(now + ARRIVALS_LOOKAHEAD) : undefined;
        const lists = await Promise.all(
            stops.map((stop) => this.getStopTimes(stop.id, { arrivals, count, fresh, modes: STATION_MODES, time }).then((stopTimes) => addSncfRealtime(stopTimes, arrivals)))
        );
        const timeOf = (stopTime: TransitousStopTime) => Date.parse((arrivals ? stopTime.place.arrival : stopTime.place.departure) ?? stopTime.place.arrival ?? stopTime.place.departure);
        return lists
            .flat()
            .filter((stopTime) => timeOf(stopTime) >= now - GONE_TOLERANCE)
            .sort((first, second) => timeOf(first) - timeOf(second));
    }

    /** a running train with its whole path, one leg */
    async getTrip(tripId: string) {
        const { legs } = await this.get<TransitousItinerary>('v6/trip', { tripId }, { maxAge: CACHE_TRIP });
        return legs[0];
    }

    async plan({
        arriveBy = false,
        fresh,
        from,
        numItineraries = 5,
        pageCursor,
        time,
        to
    }: {
        arriveBy?: boolean;
        fresh?: boolean;
        from: MapPos;
        numItineraries?: number;
        pageCursor?: string;
        time?: Date;
        to: MapPos;
    }) {
        return this.get<TransitousPlan>(
            'v6/plan',
            {
                fromPlace: formatPosition(from),
                toPlace: formatPosition(to),
                arriveBy,
                numItineraries,
                ...(time ? { time: time.toISOString() } : {}),
                ...(pageCursor ? { pageCursor } : {})
            },
            { fresh, maxAge: CACHE_PLAN }
        );
    }
}

export const transitousService = new TransitousService();
