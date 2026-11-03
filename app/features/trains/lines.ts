import { Color } from '@nativescript/core';
import { type TransitousPlace, type TransitousStopTime, transitousService } from '~/features/trains/TransitousService';
import type { MapPos } from '~/utils/geo';

/** A feed with no colour for a line. */
const DEFAULT_LINE_COLOR = '#37333A';
/** Stops this close to the tapped one are its platforms and directions. */
const STOP_RADIUS_DEGREES = 0.0015;
const MAX_STOPS = 6;
const LINES_TIMES_COUNT = 40;
/** The trips a timesheet page lists, one column each. */
export const TIMESHEET_TRIPS = 4;

export interface LineDirection {
    directionId: number;
    headsign: string;
    /** the next trip going this way: its path is the line's */
    tripId: string;
}

/** A line serving a stop, as the stop's next departures tell it. */
export interface StopLine {
    id: string;
    shortName: string;
    longName?: string;
    mode: string;
    color: string;
    textColor: string;
    /** the stops of the line around the one asked for, a line may leave from several */
    stopIds: string[];
    position: MapPos;
    directions: LineDirection[];
}

export function lineColor(routeColor?: string) {
    return routeColor ? `#${routeColor}` : DEFAULT_LINE_COLOR;
}

export function lineTextColor(color: string, routeTextColor?: string) {
    return routeTextColor ? `#${routeTextColor}` : new Color(color).getBrightness() >= 170 ? '#000000' : '#ffffff';
}

/** Shortest code first, then alphabetically: line numbers read as a list that way. */
export function compareLines(first: StopLine, second: StopLine) {
    const firstName = first.shortName || first.longName || '';
    const secondName = second.shortName || second.longName || '';
    return firstName.length === secondName.length ? firstName.localeCompare(secondName) : firstName.length - secondName.length;
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
            const color = lineColor(stopTime.routeColor);
            line = {
                id: stopTime.routeId,
                shortName: stopTime.routeShortName || stopTime.displayName,
                longName: stopTime.routeLongName,
                mode: stopTime.mode,
                color,
                textColor: lineTextColor(color, stopTime.routeTextColor),
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
        if (!line.directions.some((direction) => direction.directionId === directionId)) {
            line.directions.push({ directionId, headsign: stopTime.headsign, tripId: stopTime.tripId });
        }
    }
    return [...lines.values()].sort(compareLines);
}

/** The lines leaving the stops around `position`. */
export async function getStopLines(position: MapPos) {
    const stops = await transitousService.findStops(position, { maxStops: MAX_STOPS, radius: STOP_RADIUS_DEGREES });
    const lists = await Promise.all(stops.map((stop) => transitousService.getStopTimes(stop.id, { count: LINES_TIMES_COUNT })));
    return groupStopLines(lists.flat());
}

export interface TimesheetTrip {
    tripId: string;
    /** where it is headed */
    headsign: string;
}

export interface TimesheetStop {
    stopId: string;
    name: string;
    /** one per trip, null where it does not stop */
    times: (Date | null)[];
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

function placeTime(place: TransitousPlace) {
    const time = place.departure ?? place.arrival;
    return time ? new Date(time) : null;
}

/** The next trips of `line` going `directionId` from `time` on, with the time they reach each of their stops. */
export async function getLineTimesheet(line: StopLine, directionId: number, time: Date): Promise<TimesheetPage> {
    const lists = await Promise.all(line.stopIds.map((stopId) => transitousService.getStopTimes(stopId, { count: LINES_TIMES_COUNT, time })));
    const departures = lists
        .flat()
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
            return found ? placeTime(found) : null;
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
