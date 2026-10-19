import * as https from '@nativescript-community/https';
import { type GtfsTripUpdate, parseTripUpdates } from '~/utils/gtfsRealtime';
import type { TransitousStopTime } from './TransitousService';

// SNCF TGV, Intercités and TER, for the trains of the next hour. Transitous does not read it: its trips
// never match the SIRI feed it uses, so SNCF rows come back without delays.
const TRIP_UPDATES_URL = 'https://proxy.transport.data.gouv.fr/resource/sncf-gtfs-rt-trip-updates';
// the feed itself refreshes every 2 minutes
const CACHE_DURATION = 2 * 60 * 1000;
// the same train can be scheduled a minute apart in the two sources
const TIME_TOLERANCE = 60;
const HEADERS = { 'User-Agent': `${__APP_ID__}/${__APP_VERSION__} (https://github.com/Akylas/alpimaps)` };

type UpdatesByTrainNumber = Map<number, GtfsTripUpdate[]>;

let cache: { fetchedAt: number; updates: UpdatesByTrainNumber };
let pending: Promise<UpdatesByTrainNumber>;

/** `OCESN9879F1187_F:OUI:…`: the commercial train number follows `OCESN` */
function trainNumberOfTrip(tripId: string) {
    const match = /^OCESN(\d+)/.exec(tripId);
    return match ? parseInt(match[1], 10) : undefined;
}

async function fetchTripUpdates() {
    const response = await https.request({ url: TRIP_UPDATES_URL, method: 'GET', headers: HEADERS, timeout: 20000 });
    if (response.statusCode !== 200) {
        throw new Error(`SNCF real-time feed: HTTP ${response.statusCode}`);
    }
    const updates: UpdatesByTrainNumber = new Map();
    for (const update of parseTripUpdates(await response.content.toArrayBufferAsync())) {
        const number = trainNumberOfTrip(update.tripId);
        if (number !== undefined) {
            const list = updates.get(number);
            if (list) {
                list.push(update);
            } else {
                updates.set(number, [update]);
            }
        }
    }
    return updates;
}

async function getTripUpdates() {
    if (cache && Date.now() - cache.fetchedAt < CACHE_DURATION) {
        return cache.updates;
    }
    pending ??= fetchTripUpdates()
        .then((updates) => {
            cache = { fetchedAt: Date.now(), updates };
            return updates;
        })
        .finally(() => (pending = null));
    return pending;
}

/** Exported as plain data in, data out: no network. */
export function applyTripUpdates(stopTimes: TransitousStopTime[], arrivals: boolean, updates: UpdatesByTrainNumber): TransitousStopTime[] {
    return stopTimes.map((stopTime) => {
        if (stopTime.realTime) {
            return stopTime;
        }
        const number = parseInt(stopTime.tripShortName, 10);
        const scheduled = Date.parse(arrivals ? stopTime.place.scheduledArrival : stopTime.place.scheduledDeparture) / 1000;
        if (isNaN(number) || isNaN(scheduled)) {
            return stopTime;
        }
        for (const tripUpdate of updates.get(number) ?? []) {
            for (const stopUpdate of tripUpdate.stopTimeUpdates) {
                const event = arrivals ? stopUpdate.arrival : stopUpdate.departure;
                // the feed gives the expected time and its delay: their difference is the scheduled time
                if (event?.time && Math.abs(event.time - event.delay - scheduled) <= TIME_TOLERANCE) {
                    const expected = new Date(event.time * 1000).toISOString();
                    return {
                        ...stopTime,
                        realTime: true,
                        cancelled: tripUpdate.cancelled || stopUpdate.skipped,
                        place: arrivals ? { ...stopTime.place, arrival: expected } : { ...stopTime.place, departure: expected }
                    };
                }
            }
        }
        return stopTime;
    });
}

/** Never throws: without the overlay a board is still right, only without the delays. */
export async function addSncfRealtime(stopTimes: TransitousStopTime[], arrivals: boolean) {
    try {
        if (stopTimes.some((stopTime) => stopTime.tripShortName)) {
            return applyTripUpdates(stopTimes, arrivals, await getTripUpdates());
        }
    } catch (error) {
        DEV_LOG && console.error('addSncfRealtime', error);
    }
    return stopTimes;
}
