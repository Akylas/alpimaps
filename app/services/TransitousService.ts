import type { MapPos } from '~/utils/geo';
import { networkService } from './NetworkService';
import { addSncfRealtime } from './SncfRealtimeService';

const STATION_RADIUS_DEGREES = 0.003;

// Transitous (MOTIS) is a volunteer-run, open-source-only service: identify the app and keep the attribution visible
export const TRANSITOUS_URL = 'https://api.transitous.org/api';
const HEADERS = { 'User-Agent': `${__APP_ID__}/${__APP_VERSION__} (https://github.com/Akylas/alpimaps)` };

const ARRIVALS_LOOKAHEAD = 90 * 60 * 1000;
const GONE_TOLERANCE = 2 * 60 * 1000;
const RAIL_MODES = ['NIGHT_RAIL', 'HIGHSPEED_RAIL', 'LONG_DISTANCE', 'REGIONAL_RAIL', 'SUBURBAN'];

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
}

export interface TransitousStopTime {
    place: TransitousPlace;
    mode: string;
    realTime: boolean;
    headsign: string;
    displayName?: string;
    /** the commercial train number, as text */
    tripShortName?: string;
    routeShortName?: string;
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
    routeShortName?: string;
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
    private get<T>(path: string, queryParams: Record<string, string | number | boolean>) {
        return networkService.request<T>({
            url: `${TRANSITOUS_URL}/${path}`,
            method: 'GET',
            queryParams,
            headers: HEADERS
        });
    }

    /** the stops a train can be taken from around `position`, nearest first */
    async findRailStops(position: MapPos, maxStops = 3): Promise<TransitousStop[]> {
        const stops = await this.get<TransitousPlace[]>('v6/map/stops', {
            min: formatPosition({ lat: position.lat - STATION_RADIUS_DEGREES, lon: position.lon - STATION_RADIUS_DEGREES }),
            max: formatPosition({ lat: position.lat + STATION_RADIUS_DEGREES, lon: position.lon + STATION_RADIUS_DEGREES }),
            grouped: false,
            modes: RAIL_MODES.join(',')
        });
        const squaredDistance = (stop: TransitousPlace) => (stop.lat - position.lat) ** 2 + (stop.lon - position.lon) ** 2;
        return stops
            .filter((stop) => stop.stopId && stop.modes?.some(isRailMode))
            .sort((first, second) => squaredDistance(first) - squaredDistance(second))
            .slice(0, maxStops)
            .map((stop) => ({ id: stop.stopId, name: stop.name, lat: stop.lat, lon: stop.lon, modes: stop.modes }));
    }

    async geocode(text: string, language: string): Promise<TransitousStop[]> {
        return this.get<TransitousStop[]>('v1/geocode', { text, type: 'STOP', language });
    }

    /** `arrivals`: the trains reaching the stop instead of leaving it */
    async getStopTimes(stopId: string, { arrivals = false, count = 30, time }: { arrivals?: boolean; count?: number; time?: Date } = {}) {
        const { stopTimes } = await this.get<{ stopTimes: TransitousStopTime[] }>('v6/stoptimes', {
            stopId,
            n: count,
            arriveBy: arrivals,
            ...(time ? { time: time.toISOString() } : {})
        });
        return stopTimes;
    }

    /** several stops of one station (SNCF and the regional operators) merged, next one first */
    async getStationTimes(stops: TransitousStop[], { arrivals = false, count = 30 } = {}) {
        // arrivals can only be paged backwards: ask for the ones before a time in the future, then drop the gone ones
        const now = Date.now();
        const time = arrivals ? new Date(now + ARRIVALS_LOOKAHEAD) : undefined;
        const lists = await Promise.all(stops.map((stop) => this.getStopTimes(stop.id, { arrivals, count, time }).then((stopTimes) => addSncfRealtime(stopTimes, arrivals))));
        const timeOf = (stopTime: TransitousStopTime) => Date.parse((arrivals ? stopTime.place.arrival : stopTime.place.departure) ?? stopTime.place.arrival ?? stopTime.place.departure);
        return lists
            .flat()
            .filter((stopTime) => timeOf(stopTime) >= now - GONE_TOLERANCE)
            .sort((first, second) => timeOf(first) - timeOf(second));
    }

    /** a running train with its whole path, one leg */
    async getTrip(tripId: string) {
        const { legs } = await this.get<TransitousItinerary>('v6/trip', { tripId });
        return legs[0];
    }

    async plan({ arriveBy = false, from, numItineraries = 5, pageCursor, time, to }: { arriveBy?: boolean; from: MapPos; numItineraries?: number; pageCursor?: string; time?: Date; to: MapPos }) {
        return this.get<TransitousPlan>('v6/plan', {
            fromPlace: formatPosition(from),
            toPlace: formatPosition(to),
            arriveBy,
            numItineraries,
            ...(time ? { time: time.toISOString() } : {}),
            ...(pageCursor ? { pageCursor } : {})
        });
    }
}

export const transitousService = new TransitousService();
