import { request } from '@nativescript-community/perms';
import { Utils } from '@nativescript/core';
import { writable } from 'svelte/store';
import { addSncfRealtime } from './SncfRealtimeService';
import { type TransitousItinerary, type TransitousLeg, type TransitousPlace, type TransitousStopTime, transitousService } from './TransitousService';
import {
    type ArrivalFollow,
    type ItineraryFollow,
    type ItineraryLegFollow,
    type ItineraryModel,
    type ResolvedLeg,
    type TrainFollow,
    type TrainModel,
    arrivalMillisOf,
    buildArrivalFollow,
    buildArrivalModel,
    buildItineraryFollow,
    buildItineraryModel,
    buildLostModel,
    expiresAtOf,
    findLegStops,
    findStop,
    followIdOf,
    nextItineraryRefreshAt,
    nextRefreshAt,
    shouldFetch
} from '~/utils/trainFollow';

export type FollowResult = 'added' | 'exists' | 'full' | 'unavailable';

const RETRY_DELAY = 5 * 60 * 1000;

/** The home screen widget and the notifications of the trains being followed. Android only: the rows are drawn by the `alpimaps-train-widgets` plugin. */
export const trainFollowSupported = __ANDROID__;

function store() {
    return akylas.alpi.maps.transit.TrainFollowStore;
}

function context() {
    return Utils.android.getApplicationContext();
}

class TrainFollowService {
    /** for the bells of the boards and of the itineraries */
    readonly followedIds = writable<string[]>([]);
    private refreshing: Promise<void>;

    constructor() {
        if (trainFollowSupported) {
            this.syncFollowedIds();
        }
    }

    private follows(): TrainFollow[] {
        return JSON.parse(store().getFollowsJson(context()));
    }

    private models(): Record<string, TrainModel> {
        return JSON.parse(store().getModelsJson(context()));
    }

    private syncFollowedIds() {
        this.followedIds.set(this.follows().map((follow) => follow.id));
    }

    followArrival(stopTime: TransitousStopTime, stopName: string) {
        return this.add(buildArrivalFollow(stopTime, stopName, Date.now()));
    }

    followItinerary(itinerary: TransitousItinerary, title: string) {
        return this.add(buildItineraryFollow(itinerary, title, Date.now()));
    }

    private async add(follow?: TrainFollow): Promise<FollowResult> {
        if (!follow) {
            return 'unavailable';
        }
        // the notification is the follow when no widget is placed: ask once, a refusal still keeps the widget
        await request('notification').catch(() => undefined);
        const result = store().addFollow(context(), JSON.stringify(follow));
        this.syncFollowedIds();
        if (result === store().RESULT_FULL) {
            return 'full';
        }
        if (result === store().RESULT_EXISTS) {
            return 'exists';
        }
        // a refresh already running did not see this follow
        await this.refreshing?.catch(() => undefined);
        await this.refreshAll(false);
        return 'added';
    }

    unfollow(id: string) {
        store().removeFollow(context(), id);
        this.syncFollowedIds();
    }

    /** `force`: the user asked, so a fetch happens even when the last one is recent */
    refreshAll(force: boolean) {
        this.refreshing ??= this.doRefreshAll(force).finally(() => (this.refreshing = null));
        return this.refreshing;
    }

    private async fetchArrivalModel(follow: ArrivalFollow, now: number) {
        const leg = await transitousService.getTrip(follow.tripId);
        const stop = leg && findStop(leg, follow);
        if (!stop) {
            return buildLostModel(follow, now);
        }
        // Transitous has no SNCF delays: the same overlay as the boards
        const [withDelay] = await addSncfRealtime(
            [{ place: stop, mode: leg.mode, realTime: leg.realTime, headsign: leg.headsign ?? '', tripId: leg.tripId, tripShortName: follow.tripShortName, cancelled: leg.cancelled }],
            true
        );
        return buildArrivalModel(follow, { ...leg, cancelled: leg.cancelled || withDelay.cancelled }, now, withDelay.place);
    }

    private async resolveLeg(trip: TransitousLeg, leg: ItineraryLegFollow): Promise<ResolvedLeg> {
        const stops = findLegStops(trip, leg);
        const overlay = async (place: TransitousPlace | undefined, arrivals: boolean) => {
            if (!place) {
                return undefined;
            }
            const [withDelay] = await addSncfRealtime(
                [{ place, mode: trip.mode, realTime: trip.realTime, headsign: trip.headsign ?? '', tripId: trip.tripId, tripShortName: trip.tripShortName, cancelled: trip.cancelled }],
                arrivals
            );
            return withDelay;
        };
        const [departure, arrival] = await Promise.all([overlay(stops.departure, false), overlay(stops.arrival, true)]);
        return { departure: departure?.place, arrival: arrival?.place, cancelled: stops.cancelled || departure?.cancelled || arrival?.cancelled };
    }

    private async fetchItineraryModel(follow: ItineraryFollow, now: number) {
        const trips = await Promise.allSettled(follow.legs.map((leg) => transitousService.getTrip(leg.tripId)));
        const failed = trips.find((trip) => trip.status === 'rejected');
        // one train unreadable: the others still say something. Nothing readable: try again later
        if (failed && trips.every((trip) => trip.status === 'rejected')) {
            throw failed.reason;
        }
        const resolved = await Promise.all(trips.map((trip, index) => (trip.status === 'fulfilled' && trip.value ? this.resolveLeg(trip.value, follow.legs[index]) : undefined)));
        return buildItineraryModel(follow, resolved, now);
    }

    private async doRefreshAll(force: boolean) {
        const nativeContext = context();
        const models = this.models();
        const now = Date.now();
        let nextAt: number;
        let failed = false;
        const planNext = (at: number | undefined) => {
            if (at !== undefined) {
                nextAt = Math.min(nextAt ?? at, at);
            }
        };
        for (const follow of this.follows()) {
            let model = models[follow.id];
            if (now >= expiresAtOf(follow, model)) {
                store().removeFollow(nativeContext, follow.id);
                continue;
            }
            if (shouldFetch(model?.fetchedAtMillis, now, force)) {
                try {
                    model = follow.kind === 'itinerary' ? await this.fetchItineraryModel(follow, now) : await this.fetchArrivalModel(follow, now);
                    store().saveModel(nativeContext, follow.id, JSON.stringify(model));
                } catch (error) {
                    failed = true;
                    DEV_LOG && console.error('TrainFollowService.fetchModel', follow.id, error);
                    if (follow.kind === 'itinerary' && !model) {
                        // the widget draws the trip from its schedule until a fetch works
                        model = { ...buildItineraryModel(follow, [], now), fetchedAtMillis: 0 };
                        store().saveModel(nativeContext, follow.id, JSON.stringify(model));
                    }
                }
            }
            if (follow.kind === 'itinerary') {
                planNext(model && 'legs' in model ? nextItineraryRefreshAt(now, model) : undefined);
            } else {
                planNext(nextRefreshAt(now, arrivalMillisOf(follow, model && !('legs' in model) ? model : undefined), expiresAtOf(follow, model)));
            }
        }
        if (failed) {
            nextAt = Math.min(nextAt ?? now + RETRY_DELAY, now + RETRY_DELAY);
        }
        if (nextAt === undefined) {
            akylas.alpi.maps.transit.TrainFollowScheduler.cancel(nativeContext);
        } else {
            akylas.alpi.maps.transit.TrainFollowScheduler.schedule(nativeContext, nextAt);
        }
        this.syncFollowedIds();
    }
}

export const trainFollowService = new TrainFollowService();
