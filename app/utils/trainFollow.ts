import type { TransitousItinerary, TransitousLeg, TransitousPlace, TransitousStopTime } from '~/services/TransitousService';

export const MAX_FOLLOWS = 3;

const MINUTE = 60 * 1000;
// Transitous is volunteer-run, and the SNCF feed itself only refreshes every 2 minutes
const MIN_FETCH_INTERVAL = 2 * MINUTE;
const KEEP_AFTER_ARRIVAL = 60 * MINUTE;
const LATE_MINUTES = 2;
const VERY_LATE_MINUTES = 15;
// the same stop can be scheduled a minute apart in two feeds
const STOP_TIME_TOLERANCE = MINUTE;
// some feeds put an internal reference where the train number should be
const SHORT_NUMBER = /^[\w-]{1,8}$/;

export type TrainFollowStatus = 'ok' | 'late' | 'veryLate' | 'cancelled' | 'lost';

/** what is stored: enough to find the train again and to draw its row */
export interface ArrivalFollow {
    id: string;
    kind: 'arrival';
    tripId: string;
    tripShortName?: string;
    stopId: string;
    stopName: string;
    origin?: string;
    /** the kind or line: the first chip */
    trainName: string;
    /** the second, gray chip */
    trainNumber?: string;
    /** `#rrggbb` */
    trainColor?: string;
    trainTextColor?: string;
    scheduledArrivalMillis: number;
    createdAtMillis: number;
}

/** what changes between two fetches: native joins it with the follow to draw the row, and only formats it */
export interface ArrivalModel {
    id: string;
    track?: string;
    timeMillis: number;
    scheduledMillis: number;
    delayMinutes: number;
    status: TrainFollowStatus;
    /** where the train starts: how far along it is is drawn from it */
    departureMillis?: number;
    fetchedAtMillis: number;
    expiresAtMillis: number;
}

export function delayMinutes(actual: string, scheduled: string) {
    return Math.round((Date.parse(actual) - Date.parse(scheduled)) / MINUTE);
}

export function statusOf(delay: number, cancelled: boolean): TrainFollowStatus {
    if (cancelled) {
        return 'cancelled';
    }
    if (delay >= VERY_LATE_MINUTES) {
        return 'veryLate';
    }
    return delay >= LATE_MINUTES ? 'late' : 'ok';
}

/** `TGV 6603` is two chips: the kind, then the number */
export function splitTrainName(name: string): { name: string; number?: string } {
    const match = /^(.*\S)\s+(\d+)$/.exec(name);
    return match ? { name: match[1], number: match[2] } : { name };
}

function hexColor(color?: string) {
    return color ? `#${color}` : undefined;
}

interface TrainChipsSource {
    routeShortName?: string;
    displayName?: string;
    mode: string;
    tripShortName?: string;
    routeColor?: string;
    routeTextColor?: string;
}

/** the kind (or the line) and the number of a train, with the colors of its line */
function trainChips(source: TrainChipsSource) {
    const { name, number } = splitTrainName(source.displayName ?? '');
    return {
        trainName: source.routeShortName || name || source.mode,
        trainNumber: number ?? (SHORT_NUMBER.test(source.tripShortName ?? '') ? source.tripShortName : undefined),
        trainColor: hexColor(source.routeColor),
        trainTextColor: hexColor(source.routeTextColor)
    };
}

/** a stop of a trip: by id, else by its scheduled time */
function matchStop(places: TransitousPlace[], stopId: string, scheduledMillis: number, scheduledOf: (place: TransitousPlace) => string | undefined) {
    return places.find((place) => place.stopId === stopId) ?? places.find((place) => Math.abs(Date.parse(scheduledOf(place)) - scheduledMillis) <= STOP_TIME_TOLERANCE);
}

function placesOf(leg: TransitousLeg) {
    return [leg.from, ...(leg.intermediateStops ?? []), leg.to];
}

export function followIdOf(stopTime: TransitousStopTime) {
    return `${stopTime.tripId}@${stopTime.place.stopId}`;
}

export function buildArrivalFollow(stopTime: TransitousStopTime, stopName: string, now: number): ArrivalFollow {
    const { place } = stopTime;
    return {
        id: followIdOf(stopTime),
        kind: 'arrival',
        tripId: stopTime.tripId,
        tripShortName: stopTime.tripShortName,
        stopId: place.stopId,
        stopName,
        origin: stopTime.tripFrom?.name,
        ...trainChips(stopTime),
        scheduledArrivalMillis: Date.parse(place.scheduledArrival ?? place.arrival),
        createdAtMillis: now
    };
}

/** the followed stop inside a trip: by id, else by its scheduled time */
export function findStop(leg: TransitousLeg, follow: ArrivalFollow): TransitousPlace | undefined {
    return matchStop(placesOf(leg), follow.stopId, follow.scheduledArrivalMillis, (place) => place.scheduledArrival);
}

/** the trip is gone from Transitous, or no longer stops there */
export function buildLostModel(follow: ArrivalFollow, now: number): ArrivalModel {
    return {
        id: follow.id,
        timeMillis: follow.scheduledArrivalMillis,
        scheduledMillis: follow.scheduledArrivalMillis,
        delayMinutes: 0,
        status: 'lost',
        fetchedAtMillis: now,
        expiresAtMillis: follow.scheduledArrivalMillis + KEEP_AFTER_ARRIVAL
    };
}

export function buildArrivalModel(follow: ArrivalFollow, leg: TransitousLeg, now: number, stop = findStop(leg, follow)): ArrivalModel {
    const base = { id: follow.id, fetchedAtMillis: now };
    if (!stop) {
        return buildLostModel(follow, now);
    }
    const actual = stop.arrival ?? stop.scheduledArrival;
    const scheduled = stop.scheduledArrival ?? actual;
    const delay = delayMinutes(actual, scheduled);
    const timeMillis = Date.parse(actual);
    const scheduledMillis = Date.parse(scheduled);
    return {
        ...base,
        track: stop.track,
        departureMillis: Date.parse(leg.from.departure ?? leg.from.scheduledDeparture ?? leg.startTime),
        timeMillis,
        scheduledMillis,
        delayMinutes: delay,
        status: statusOf(delay, !!(leg.cancelled || stop.cancelled)),
        expiresAtMillis: Math.max(timeMillis, scheduledMillis) + KEEP_AFTER_ARRIVAL
    };
}

/** `force`: the user asked, so the minimum interval does not apply */
export function shouldFetch(fetchedAt: number | undefined, now: number, force: boolean) {
    return force || fetchedAt === undefined || now - fetchedAt >= MIN_FETCH_INTERVAL;
}

/** when to wake up next: often when the train is close, never after the row is due to go. `undefined`: already gone */
export function nextRefreshAt(now: number, arrivalMillis: number, expiresAtMillis: number) {
    if (now >= expiresAtMillis) {
        return undefined;
    }
    if (now >= arrivalMillis) {
        return expiresAtMillis;
    }
    const remaining = arrivalMillis - now;
    const interval = remaining > 180 * MINUTE ? 30 * MINUTE : remaining > 45 * MINUTE ? 10 * MINUTE : 3 * MINUTE;
    return Math.min(now + interval, expiresAtMillis);
}

/** before the first fetch there is no model: the follow's own schedule stands in */
export function arrivalMillisOf(follow: ArrivalFollow, model?: ArrivalModel) {
    return model?.timeMillis ?? follow.scheduledArrivalMillis;
}

export function expiresAtOf(follow: TrainFollow, model?: TrainModel) {
    return model?.expiresAtMillis ?? follow.scheduledArrivalMillis + KEEP_AFTER_ARRIVAL;
}

/** one train of a followed trip */
export interface ItineraryLegFollow {
    trainName: string;
    trainNumber?: string;
    trainColor?: string;
    trainTextColor?: string;
    from: string;
    to: string;
    tripId: string;
    fromStopId: string;
    toStopId: string;
    scheduledDepartureMillis: number;
    scheduledArrivalMillis: number;
}

/** a trip with changes: the trains, in order, and the stops where we get on and off */
export interface ItineraryFollow {
    id: string;
    kind: 'itinerary';
    title: string;
    legs: ItineraryLegFollow[];
    /** of the last train */
    scheduledArrivalMillis: number;
    createdAtMillis: number;
}

export interface ItineraryLegModel {
    departureMillis: number;
    arrivalMillis: number;
    scheduledDepartureMillis: number;
    scheduledArrivalMillis: number;
    track?: string;
    cancelled?: boolean;
}

/** the time between getting off one train and the next one leaving, walking included */
export interface ItineraryConnection {
    minutes: number;
    scheduledMinutes: number;
}

export interface ItineraryModel {
    id: string;
    legs: ItineraryLegModel[];
    connections: ItineraryConnection[];
    fetchedAtMillis: number;
    expiresAtMillis: number;
}

export type TrainFollow = ArrivalFollow | ItineraryFollow;
export type TrainModel = ArrivalModel | ItineraryModel;

export function isTransitLeg(leg: TransitousLeg) {
    return leg.mode !== 'WALK' && leg.mode !== 'BIKE' && leg.mode !== 'CAR';
}

/** `undefined` when no train is in it, or one has no trip to look up: it cannot be followed */
export function itineraryFollowId(itinerary: TransitousItinerary) {
    const transitLegs = itinerary.legs.filter(isTransitLeg);
    return transitLegs.length && transitLegs.every((leg) => leg.tripId) ? transitLegs.map((leg) => leg.tripId).join('+') : undefined;
}

export function buildItineraryFollow(itinerary: TransitousItinerary, title: string, now: number): ItineraryFollow | undefined {
    const id = itineraryFollowId(itinerary);
    if (!id) {
        return undefined;
    }
    const transitLegs = itinerary.legs.filter(isTransitLeg);
    const legs = transitLegs.map((leg) => ({
        ...trainChips(leg),
        from: leg.from.name,
        to: leg.to.name,
        tripId: leg.tripId,
        fromStopId: leg.from.stopId,
        toStopId: leg.to.stopId,
        scheduledDepartureMillis: Date.parse(leg.from.scheduledDeparture ?? leg.startTime),
        scheduledArrivalMillis: Date.parse(leg.to.scheduledArrival ?? leg.endTime)
    }));
    return {
        id,
        kind: 'itinerary',
        title,
        legs,
        scheduledArrivalMillis: legs[legs.length - 1].scheduledArrivalMillis,
        createdAtMillis: now
    };
}

/** where a train is got on and off, from its trip */
export function findLegStops(trip: TransitousLeg, leg: ItineraryLegFollow) {
    const places = placesOf(trip);
    return {
        departure: matchStop(places, leg.fromStopId, leg.scheduledDepartureMillis, (place) => place.scheduledDeparture),
        arrival: matchStop(places, leg.toStopId, leg.scheduledArrivalMillis, (place) => place.scheduledArrival),
        cancelled: trip.cancelled
    };
}

export interface ResolvedLeg {
    departure?: TransitousPlace;
    arrival?: TransitousPlace;
    cancelled?: boolean;
}

/** `resolved`: one entry per train, `undefined` when its trip could not be read: the schedule stands in */
export function buildItineraryModel(follow: ItineraryFollow, resolved: (ResolvedLeg | undefined)[], now: number): ItineraryModel {
    const legs = follow.legs.map((leg, index): ItineraryLegModel => {
        const { arrival, cancelled, departure } = resolved[index] ?? {};
        return {
            departureMillis: Date.parse(departure?.departure ?? departure?.scheduledDeparture) || leg.scheduledDepartureMillis,
            arrivalMillis: Date.parse(arrival?.arrival ?? arrival?.scheduledArrival) || leg.scheduledArrivalMillis,
            scheduledDepartureMillis: leg.scheduledDepartureMillis,
            scheduledArrivalMillis: leg.scheduledArrivalMillis,
            track: departure?.track,
            ...(cancelled || departure?.cancelled || arrival?.cancelled ? { cancelled: true } : {})
        };
    });
    const connections = legs.slice(1).map((next, index) => ({
        minutes: Math.round((next.departureMillis - legs[index].arrivalMillis) / MINUTE),
        scheduledMinutes: Math.round((next.scheduledDepartureMillis - legs[index].scheduledArrivalMillis) / MINUTE)
    }));
    const last = legs[legs.length - 1];
    return {
        id: follow.id,
        legs,
        connections,
        fetchedAtMillis: now,
        expiresAtMillis: Math.max(last.arrivalMillis, last.scheduledArrivalMillis) + KEEP_AFTER_ARRIVAL
    };
}

// a long train ride can change a connection: look at least this often once on board
const ON_BOARD_INTERVAL = 10 * MINUTE;

/** like `nextRefreshAt`, for the next departure or arrival of the trip */
export function nextItineraryRefreshAt(now: number, model: ItineraryModel) {
    const events = model.legs.flatMap((leg) => [leg.departureMillis, leg.arrivalMillis]).filter((millis) => millis > now);
    const lastArrival = model.legs[model.legs.length - 1].arrivalMillis;
    const next = nextRefreshAt(now, events.length ? Math.min(...events) : lastArrival, model.expiresAtMillis);
    const onBoard = model.legs.some((leg) => leg.departureMillis <= now && now < leg.arrivalMillis);
    return next !== undefined && onBoard ? Math.min(next, now + ON_BOARD_INTERVAL) : next;
}
