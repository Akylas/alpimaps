import { Color } from '@nativescript/core';
import { type TransitousPlace, type TransitousStopTime, transitousService } from '~/features/trains/TransitousService';
import type { MapPos } from '~/utils/geo';

/** Stops this close to the tapped one are its platforms and directions. */
const STOP_RADIUS = 100;
const STOP_TIMES_COUNT = 60;
const TIMESHEET_TIMES_COUNT = 40;
/** The departures a line shows per direction. */
const NEXT_DEPARTURES = 3;
/** The trips a timesheet page lists, one column each. */
export const TIMESHEET_TRIPS = 4;

export interface LineDeparture {
    /** with the real-time delay, when the feed has one */
    time: Date;
    scheduled: Date;
    realTime: boolean;
}

export interface LineDirection {
    directionId: number;
    headsign: string;
    /** the next trip going this way: its path is the line's */
    tripId: string;
    departures: LineDeparture[];
}

/** A line serving a stop, as the stop's next departures tell it. */
export interface StopLine {
    id: string;
    shortName: string;
    longName?: string;
    mode: string;
    /** `#rrggbb`, null when the feed has none */
    color: string | null;
    textColor: string | null;
    /** the stops of the line around the one asked for, a line may leave from several */
    stopIds: string[];
    position: MapPos;
    directions: LineDirection[];
}

function feedColor(color?: string) {
    return color ? `#${color}` : null;
}

/** Shortest code first, then alphabetically: line numbers read as a list that way. */
export function compareLines(first: StopLine, second: StopLine) {
    const firstName = first.shortName || first.longName || '';
    const secondName = second.shortName || second.longName || '';
    return firstName.length === secondName.length ? firstName.localeCompare(secondName) : firstName.length - secondName.length;
}

function stopTimeDate(stopTime: TransitousStopTime, scheduled = false) {
    const { place } = stopTime;
    return new Date((scheduled ? (place.scheduledDeparture ?? place.scheduledArrival) : null) ?? place.departure ?? place.arrival);
}

/** The departures of one or several stops, one line per route. */
export function groupStopLines(stopTimes: TransitousStopTime[]): StopLine[] {
    const lines = new Map<string, StopLine>();
    for (const stopTime of stopTimes) {
        if (!stopTime.routeId || stopTime.cancelled) {
            continue;
        }
        let line = lines.get(stopTime.routeId);
        if (!line) {
            line = {
                id: stopTime.routeId,
                shortName: stopTime.routeShortName || stopTime.displayName,
                longName: stopTime.routeLongName,
                mode: stopTime.mode,
                color: feedColor(stopTime.routeColor),
                textColor: feedColor(stopTime.routeTextColor),
                stopIds: [],
                position: { lat: stopTime.place.lat, lon: stopTime.place.lon },
                directions: []
            };
            lines.set(stopTime.routeId, line);
        }
        if (stopTime.place.stopId && !line.stopIds.includes(stopTime.place.stopId)) {
            line.stopIds.push(stopTime.place.stopId);
        }
        const directionId = stopTime.directionId ?? 0;
        let direction = line.directions.find((candidate) => candidate.directionId === directionId);
        if (!direction) {
            direction = { directionId, headsign: stopTime.headsign, tripId: stopTime.tripId, departures: [] };
            line.directions.push(direction);
        }
        if (direction.departures.length < NEXT_DEPARTURES) {
            direction.departures.push({ time: stopTimeDate(stopTime), scheduled: stopTimeDate(stopTime, true), realTime: stopTime.realTime });
        }
    }
    const result = [...lines.values()].sort(compareLines);
    result.forEach((line) => line.directions.sort((first, second) => first.directionId - second.directionId));
    return result;
}

/** The lines leaving the stops around `position`, with their next departures: one request. */
export async function getStopLines(position: MapPos) {
    return groupStopLines(await transitousService.getStopTimesAround(position, { radius: STOP_RADIUS, count: STOP_TIMES_COUNT }));
}

export interface TimesheetTrip {
    tripId: string;
    /** where it is headed */
    headsign: string;
}

export interface TimesheetCell {
    time: Date;
    /** minutes behind the schedule */
    delay: number;
}

export interface TimesheetStop {
    stopId: string;
    name: string;
    /** one per trip, null where it does not stop */
    times: (TimesheetCell | null)[];
}

export interface TimesheetPage {
    trips: TimesheetTrip[];
    stops: TimesheetStop[];
    /** where the next page starts */
    nextTime?: Date;
}

/** The stops of several trips as one list: a stop a trip skips keeps its place, one only a trip serves goes after its previous stop. */
export function mergeStopSequences(sequences: TransitousPlace[][]): TransitousPlace[] {
    const merged: TransitousPlace[] = [];
    for (const sequence of sequences) {
        let insertAt = 0;
        for (const place of sequence) {
            const index = merged.findIndex((candidate) => candidate.stopId === place.stopId);
            if (index >= 0) {
                insertAt = index + 1;
            } else {
                merged.splice(insertAt, 0, place);
                insertAt += 1;
            }
        }
    }
    return merged;
}

function placeCell(place: TransitousPlace): TimesheetCell | null {
    const time = place.departure ?? place.arrival;
    if (!time) {
        return null;
    }
    const scheduled = place.scheduledDeparture ?? place.scheduledArrival ?? time;
    return { time: new Date(time), delay: Math.round((Date.parse(time) - Date.parse(scheduled)) / 60000) };
}

/** The next trips of `line` going `directionId` from `time` on, with the time they reach each of their stops. */
export async function getLineTimesheet(line: StopLine, directionId: number, time: Date): Promise<TimesheetPage> {
    // one stop is enough: Transitous answers for the stops around it that carry the same name
    const stopTimes = await transitousService.getStopTimes(line.stopIds[0], { count: TIMESHEET_TIMES_COUNT, time });
    const departures = stopTimes
        .filter((stopTime) => stopTime.routeId === line.id && (stopTime.directionId ?? 0) === directionId && !stopTime.cancelled)
        .sort((first, second) => Date.parse(first.place.departure ?? first.place.arrival) - Date.parse(second.place.departure ?? second.place.arrival))
        .slice(0, TIMESHEET_TRIPS);
    if (!departures.length) {
        return { trips: [], stops: [] };
    }
    const legs = await Promise.all(departures.map((departure) => transitousService.getTrip(departure.tripId)));
    const tripPlaces = legs.map((leg) => [leg.from, ...(leg.intermediateStops ?? []), leg.to]);
    const stops = mergeStopSequences(tripPlaces).map<TimesheetStop>((place) => ({
        stopId: place.stopId,
        name: place.name,
        times: tripPlaces.map((places) => {
            const found = places.find((candidate) => candidate.stopId === place.stopId);
            return found ? placeCell(found) : null;
        })
    }));
    const last = departures[departures.length - 1];
    const lastTime = Date.parse(last.place.departure ?? last.place.arrival);
    return {
        trips: departures.map((departure) => ({ tripId: departure.tripId, headsign: departure.headsign })),
        stops,
        nextTime: new Date(lastTime + 60 * 1000)
    };
}
