import Observable from '@nativescript-community/observable';
import { Application, ApplicationEventData } from '@nativescript/core';
import { get } from 'svelte/store';
import { type GeoHandler, type GeoLocation, UserLocationdEvent } from '~/handlers/GeoHandler';
import { getMapContext } from '~/mapModules/MapModule';
import type { ValhallaProfile } from '~/utils/routing';
import { IItem, Item, type RouteInstruction, RoutingAction } from '~/models/Item';
import { NavigationDetour, NavigationRoute, positionsToGeoJSONLine } from '~/services/navigation/NavigationRoute';
import { packageService } from '~/services/PackageService';
import {
    NavigationState,
    NavigationStats,
    navigationAutoPause,
    navigationAutoPauseDelay,
    navigationAutoPauseSpeed,
    navigationAutoReroute,
    navigationAutoRerouteMaxDistance,
    navigationAutoZoom,
    navigationBackgroundUpdateInterval,
    navigationBearingRefreshAngle,
    navigationDetour,
    navigationGpsUpdateDistance,
    navigationItem,
    navigationLocation,
    navigationManeuverRefreshDistance,
    navigationManeuverWakeDistance,
    navigationOffRouteDistance,
    navigationOffRouteFixes,
    navigationOriginalItem,
    navigationProgress,
    navigationRecordStats,
    navigationRejoinTarget,
    navigationRerouting,
    navigationScreenRefreshInterval,
    navigationSpeedDropWake,
    navigationSpeedDropWakeRatio,
    navigationState,
    navigationStats,
    navigationTurnRefreshAngle,
    navigationTurnRefreshDelay,
    navigationZoomDenseManeuverDistance,
    navigationZoomFactor,
    navigationZoomLookAhead,
    navigationZoomManeuverFrameRatio,
    navigationZoomManeuverVisibleDistance,
    navigationZoomMax,
    navigationZoomMaxLookAhead,
    navigationZoomMin,
    navigationZoomMinLookAhead
} from '~/stores/navigationStore';
import { watchingLocation } from '~/stores/mapStore';
import { getRhumbLineBearing } from '~/helpers/geolib';
import { computeDistanceBetween, fromPosition } from '~/utils/geo';
import {
    NavigationProfileTuning,
    OffRouteDetector,
    RouteProgress,
    angleDifference,
    chooseRejoinTarget,
    computeNavigationLookAhead,
    isNavigableRoute,
    navigationProfileTuning
} from '~/utils/navigation';
import { instructionsFromResult } from '~/utils/routing';
import { requestScreenRefresh } from '~/utils/screen';

const TAG = '[NavigationService]';

export const NavigationStateEvent = 'navigationState';
export const NavigationProgressEvent = 'navigationProgress';
export const NavigationArrivedEvent = 'navigationArrived';
/** fired on the transitions only, with the progress of the fix that decided it */
export const NavigationOffRouteEvent = 'navigationOffRoute';
/** a detour or a whole new route was applied, `data.auto` telling whether the user asked for it */
export const NavigationReroutedEvent = 'navigationRerouted';

/** fraction of the screen height that lies ahead of the user, given the navigation focus offset */
const AHEAD_SCREEN_FRACTION = 0.75;
/**
 * fraction of the *full* screen width a point has to stay within to count as visible, ie 80% of the
 * half width the user's dot sits in the middle of. The rest is the margin that keeps a maneuver off
 * the very edge of the screen.
 */
const LATERAL_SCREEN_FRACTION = 0.4;
/** vertices of the current leg the framing looks at, so its cost does not follow the route's density */
const LEG_FRAME_SAMPLES = 20;
/** ignore zoom changes smaller than this so the camera does not hunt */
const ZOOM_MIN_DELTA = 0.25;
/** zooming out must hold for this many fixes: otherwise the view pops out the instant a turn completes */
const ZOOM_OUT_HOLD_FIXES = 3;
/** how many recent fixes feed the speed median/average */
const SPEED_WINDOW = 5;
/** m/s: below this average a speed drop means nothing, we are already crawling */
const SPEED_DROP_MIN_AVERAGE = 2;
/** ms between two speed-drop wakes */
const SPEED_DROP_MIN_INTERVAL = 20000;
/**
 * meters: closer than this to a maneuver there is no time to read the screen before being on it, so
 * waking only shows the middle of the turn. Reached when the instruction index advances to one we are
 * already on top of, which is what clustered maneuvers do — a roundabout's enter and exit especially.
 */
const MIN_WAKE_LEAD = 30;
/** ms: gps rate while navigation is auto-paused, just enough to notice we started moving again */
const PAUSED_UPDATE_INTERVAL = 10000;
/** ms: nothing reads the speed of a pause the user asked for, so the dot only has to stay roughly live */
const MANUAL_PAUSED_UPDATE_INTERVAL = 60000;
/** seconds to the next maneuver past which the background gps rate can be slowed down */
const FAR_FROM_MANEUVER_TIME = 60;
/** how much the background rate is slowed down out there */
const FAR_FROM_MANEUVER_INTERVAL_FACTOR = 4;
/** ms: however far the next maneuver is, the map still has to be roughly current */
const MAX_BACKGROUND_UPDATE_INTERVAL = 20000;
/** meters from the end at which we consider the route done */
const ARRIVAL_DISTANCE = 30;
/** ms between two automatic reroute attempts, so a failing one does not run on every fix */
const REROUTE_RETRY_INTERVAL = 30000;
/** ms off route before the first automatic reroute: stepping aside for a moment must cost nothing */
const AUTO_REROUTE_MIN_OFF_ROUTE_TIME = 20000;
/** meters travelled since leaving the route that earn an attempt before that delay is up */
const AUTO_REROUTE_MIN_OFF_ROUTE_DISTANCE = 100;

export class NavigationService extends Observable {
    geoHandler: GeoHandler;

    /**
     * The route being followed — never the selected item itself, so a reroute cannot rewrite the
     * user's own route. Its positions are cached for the whole navigation: rebuilding the native
     * vector on every fix would be wasteful.
     */
    private route: NavigationRoute = null;
    /** how the route is travelled decides what counts as far and as slow, see `navigationProfileTuning` */
    private mProfileTuning: NavigationProfileTuning = null;
    private speeds: number[] = [];
    private currentZoom = 0;
    private zoomOutHoldCount = 0;
    private lastWokenInstructionIndex = -1;
    private lastSpeedDropWake = 0;
    private belowPauseSpeedSince = 0;
    private autoPaused = false;
    private arrived = false;
    private listening = false;
    /** owns everything about where the user is relative to the route, and whether they left it */
    private readonly offRouteDetector = new OffRouteDetector(() => ({ distance: get(navigationOffRouteDistance), fixes: get(navigationOffRouteFixes) }));
    private wasOffRoute = false;
    /** where the user left the route, so we can tell going astray from stepping aside */
    private offRouteLocation: GeoLocation = null;
    /** one reroute at a time, and never one per fix while the last one is still failing */
    private rerouting = false;
    private lastRerouteAttempt = 0;
    private lastScreenRefresh = 0;
    /** time of the last fix acted on, so one replayed by a watch restart can be told from a new one */
    private lastFixTime = 0;
    /** background gps rate currently registered, so a restart only happens when it actually changes */
    private currentBackgroundInterval = 0;
    /** heading of the last fix, and the heading the map was last drawn at */
    private lastBearing = -1;
    private lastRefreshBearing = -1;
    /** a maneuver still owed a refresh once it is behind us, -1 when nothing is */
    private pendingTurnRefreshIndex = -1;
    /** where and when that maneuver went behind us, ie what the wait past it is measured from */
    private pendingTurnPassedLocation: GeoLocation = null;
    private pendingTurnPassedTime = 0;
    /** so stopping navigation does not leave the gps running when it was off beforehand */
    private wasWatchingBeforeStart = false;

    get state() {
        return get(navigationState);
    }
    get isNavigating() {
        return this.state !== NavigationState.IDLE;
    }
    get navigatedItem() {
        return this.route?.item;
    }
    get navigationRoute() {
        return this.route;
    }
    private get userLocationModule() {
        return getMapContext().mapModule('userLocation');
    }
    /** valhalla profile the route was computed with, which a reroute has to match */
    private get routeProfile(): ValhallaProfile {
        return this.route?.item?.properties?.route?.type ?? 'pedestrian';
    }
    /** cached: the profile cannot change under a running navigation, and `reset` clears it */
    private get profileTuning() {
        if (!this.mProfileTuning) {
            this.mProfileTuning = navigationProfileTuning(this.routeProfile);
        }
        return this.mProfileTuning;
    }
    private get appInBackground() {
        return this.geoHandler?.appInBackground;
    }

    onServiceLoaded(geoHandler: GeoHandler) {
        this.geoHandler = geoHandler;
    }
    onServiceUnloaded() {
        if (this.isNavigating) {
            this.stop();
        }
        this.geoHandler = null;
    }

    canNavigate(item: Item) {
        return isNavigableRoute(item) && !!item.instructions?.length;
    }

    async start(item: Item) {
        if (!this.canNavigate(item)) {
            throw new Error('not_navigable_route');
        }
        if (this.isNavigating) {
            await this.stop();
        }
        DEV_LOG && console.log(TAG, 'start', item.id);
        this.route = new NavigationRoute(item);
        this.reset();

        const userLocationModule = this.userLocationModule;
        // the user asked to navigate, so getting a location is part of the request. Remember whether
        // they were already watching, so stopping puts the gps back the way we found it
        this.wasWatchingBeforeStart = get(watchingLocation);

        // everything below asks the geo handler questions it answers from the navigation state, so that
        // state has to be true first. Started last, it made `needsBackgroundLocation` false for the
        // whole of this method — and the watch replacement inside startWatch tore down the foreground
        // service one line after we started it. Listening first also means no fix is missed
        this.listen();
        navigationItem.set(item);
        this.setState(NavigationState.RUNNING);

        try {
            // has to happen now, while the app is still in the foreground: android 14 refuses to start a
            // location foreground service from the background, so waiting for onAppPause is too late. And
            // before the watch, so it is registered with the service already holding the location grant
            this.geoHandler.showForegroundNotification();

            // one start, at the navigation cadence: starting and then restarting used to register two
            // watches, and startSession a third
            await userLocationModule.startWatchLocation({ force: true });
            userLocationModule.navigationMode = true;

            if (get(navigationRecordStats) && !this.geoHandler.isSessionRunning()) {
                await this.geoHandler.startSession();
            }
        } catch (error) {
            // the state is already RUNNING, so a half started navigation would look like a running one
            // with no gps behind it. Take it back down before handing the error on
            await this.stop();
            throw error;
        }
    }

    async stop() {
        if (!this.isNavigating) {
            return;
        }
        DEV_LOG && console.log(TAG, 'stop, watching before teardown:', this.geoHandler.isWatching());
        const userLocationModule = this.userLocationModule;
        const keepWatching = this.wasWatchingBeforeStart;
        // everything here is best effort: whatever fails, the gps and the stores must still end up in
        // a sane state. A throw halfway through used to leave the watch running with no way to stop it
        try {
            this.unlisten();
            // stopWatch no longer drops it while navigating, so navigation has to take it down itself
            this.geoHandler.hideForegroundNotification();
            if (this.geoHandler.isSessionRunning()) {
                this.geoHandler.stopSession();
            }
            if (userLocationModule) {
                userLocationModule.navigationZoom = 0;
                userLocationModule.navigationMode = false;
            }
            this.route = null;
            this.reset();
            navigationItem.set(null);
            navigationOriginalItem.set(null);
            navigationDetour.set(null);
            navigationProgress.set(null);
            navigationLocation.set(null);
            navigationStats.set(null);
        } catch (error) {
            console.error(TAG, 'error while stopping navigation', error, error.stack);
        } finally {
            this.setState(NavigationState.IDLE);
            this.wasWatchingBeforeStart = false;
            try {
                // always stop first, then put back only what the user had running before we started.
                // Restarting from a known stopped state is the only way to be sure nothing lingers
                this.geoHandler.stopWatch();
                if (keepWatching) {
                    await this.geoHandler.startWatch();
                }
            } catch (error) {
                console.error(TAG, 'error restoring the watch', error, error.stack);
            }
            userLocationModule?.syncWatchingState();
            DEV_LOG && console.log(TAG, 'stopped, keepWatching:', keepWatching, 'watching now:', this.geoHandler.isWatching());
        }
    }

    /**
     * Pausing clears the navigation UI and gives the search bar back, and is also what auto-pause
     * triggers. The gps keeps running at a slow rate: an auto-pause must be able to notice we moved
     * again, and the user location dot should stay live either way.
     */
    async pause(auto = false) {
        if (this.state !== NavigationState.RUNNING) {
            return;
        }
        DEV_LOG && console.log(TAG, 'pause', auto);
        this.autoPaused = auto;
        this.belowPauseSpeedSince = 0;
        if (this.geoHandler.isSessionRunning()) {
            this.geoHandler.pauseSession();
        }
        const userLocationModule = this.userLocationModule;
        if (userLocationModule) {
            userLocationModule.navigationZoom = 0;
        }
        this.setState(NavigationState.PAUSED);
        await this.restartWatch();
    }

    /**
     * `startWatch` already replaces whatever is running, and unlike `geoHandler.restartWatch` it does
     * not give up when nothing is: `pauseSession` stops the watch, so going through the latter left a
     * paused navigation with no gps at all — and an auto-pause with no way to notice we set off again.
     */
    restartWatch() {
        return this.geoHandler?.startWatch();
    }

    async resume() {
        if (this.state !== NavigationState.PAUSED) {
            return;
        }
        DEV_LOG && console.log(TAG, 'resume');
        this.autoPaused = false;
        this.belowPauseSpeedSince = 0;
        this.zoomOutHoldCount = 0;
        if (this.geoHandler.isSessionPaused()) {
            this.geoHandler.resumeSession();
        }
        const userLocationModule = this.userLocationModule;
        if (userLocationModule) {
            userLocationModule.navigationMode = true;
        }
        this.setState(NavigationState.RUNNING);
        await this.restartWatch();
    }

    toggle() {
        return this.state === NavigationState.PAUSED ? this.resume() : this.pause();
    }

    private reset() {
        this.mProfileTuning = null;
        this.speeds = [];
        this.currentZoom = 0;
        this.zoomOutHoldCount = 0;
        this.lastWokenInstructionIndex = -1;
        this.lastSpeedDropWake = 0;
        this.belowPauseSpeedSince = 0;
        this.autoPaused = false;
        this.arrived = false;
        this.offRouteDetector.reset();
        this.wasOffRoute = false;
        this.rerouting = false;
        this.lastRerouteAttempt = 0;
        this.offRouteLocation = null;
        navigationRejoinTarget.set(null);
        navigationRerouting.set(false);
        this.lastScreenRefresh = Date.now();
        this.lastFixTime = 0;
        this.currentBackgroundInterval = 0;
        this.armManeuverRefresh(-1);
        this.lastBearing = -1;
        this.lastRefreshBearing = -1;
    }

    private setState(state: NavigationState) {
        DEV_LOG && console.log(TAG, 'setState', state);
        navigationState.set(state);
        this.notify({ eventName: NavigationStateEvent, object: this, data: state });
    }

    private listen() {
        if (this.listening) {
            return;
        }
        this.listening = true;
        // listening on the module rather than the geo handler means we run before it moves the
        // camera, so the zoom we compute here is applied on this fix and not the next one
        this.geoHandler.on(UserLocationdEvent, this.onLocation, this);
        // Application.on(Application.backgroundEvent, this.onAppBackground, this);
        // Application.on(Application.foregroundEvent, this.onAppForeground, this);
    }
    private unlisten() {
        if (!this.listening) {
            return;
        }
        this.listening = false;
        this.geoHandler?.off(UserLocationdEvent, this.onLocation, this);
        // Application.off(Application.backgroundEvent, this.onAppBackground, this);
        // Application.off(Application.foregroundEvent, this.onAppForeground, this);
    }

    // private onAppBackground(args: ApplicationEventData) {
    //     this.restartWatch();
    // }
    // private onAppForeground(args: ApplicationEventData) {
    //     this.restartWatch();
    // }

    /**
     * Navigation raises the gps rate in background instead of lowering it, which is the whole point
     * of the mode: we need to know a maneuver is coming while the screen is off.
     *
     * Everywhere else it lowers it. A paused navigation used to keep the full foreground rate for as
     * long as it stayed paused, which is the most expensive thing the mode can do for the least: the
     * only thing paused mode reads from a fix is whether the user started moving again.
     */
    public getWatchOptions(navigating = this.isNavigating) {
        if (!navigating) {
            return {};
        }
        const updateDistance = get(navigationGpsUpdateDistance);
        if (this.state === NavigationState.PAUSED) {
            // an automatic pause has to notice movement to undo itself; a pause the user asked for is
            // undone by the user, so nothing there reads the speed at all
            return { minimumUpdateTime: this.autoPaused ? PAUSED_UPDATE_INTERVAL : MANUAL_PAUSED_UPDATE_INTERVAL, updateDistance };
        } else if (this.appInBackground) {
            return { minimumUpdateTime: this.backgroundUpdateInterval(), updateDistance };
        } else {
            // in foreground only the distance filter applies, the rate stays the user's own setting
            return updateDistance > 0 ? { updateDistance } : null;
        }
    }

    /**
     * The background rate, slowed down while nothing is about to happen.
     *
     * Fixes are what a navigation costs in battery, and on a long leg most of them tell us something we
     * already knew. Time to the next maneuver is the honest measure of how much we need them: far from
     * it the rate drops, and it is back to the user's setting well before the maneuver is announced.
     */
    private backgroundUpdateInterval() {
        const interval = get(navigationBackgroundUpdateInterval);
        const progress = get(navigationProgress);
        if (!interval || !progress || progress.stale || !(progress.distanceToNextInstruction > 0)) {
            return interval;
        }
        const timeToManeuver = progress.distanceToNextInstruction / Math.max(this.medianSpeed(), 1);
        if (timeToManeuver <= FAR_FROM_MANEUVER_TIME || progress.distanceToNextInstruction <= get(navigationManeuverWakeDistance)) {
            return interval;
        }
        // never faster than what the user asked for: the cap is there to slow us down, not to speed us up
        return Math.max(interval, Math.min(interval * FAR_FROM_MANEUVER_INTERVAL_FACTOR, MAX_BACKGROUND_UPDATE_INTERVAL));
    }

    /**
     * Applies a change of background rate, and only a change: restarting the watch on every fix would
     * cost more than the fixes it saves.
     */
    private updateBackgroundInterval() {
        if (this.state !== NavigationState.RUNNING) {
            return;
        }
        if (!this.appInBackground) {
            // back in the user's hands: the rate is theirs again. Nothing else restarts the watch on a
            // foreground/background change while navigating, so this is where the two rates swap over
            if (this.currentBackgroundInterval) {
                DEV_LOG && console.log(TAG, 'back in foreground, restoring the foreground gps rate');
                this.currentBackgroundInterval = 0;
                this.restartWatch();
            }
            return;
        }
        const interval = this.backgroundUpdateInterval();
        if (interval === this.currentBackgroundInterval) {
            return;
        }
        DEV_LOG && console.log(TAG, 'background gps rate', this.currentBackgroundInterval, '->', interval);
        this.currentBackgroundInterval = interval;
        this.restartWatch();
    }

    private onLocation(event: any) {
        try {
            const location: GeoLocation = event.location;
            if (!location || !this.isNavigating) {
                return;
            }
            // a fresh watch replays the last known fix at once. Acting on one we already acted on counts
            // it twice in the off route detector and can wake the screen — which turns the screen on,
            // pauses and resumes the app, restarts the watch and replays it again. A fix from the gap
            // between the two watches is genuinely newer, and stays news
            const fixTime = location.elapsedBoot ?? location.timestamp;
            if (this.geoHandler.watchJustRestarted) {
                this.geoHandler.watchJustRestarted = false;
                if (fixTime <= this.lastFixTime) {
                    DEV_LOG && console.log(TAG, 'ignoring the fix a watch restart replayed');
                    return;
                }
            }
            this.lastFixTime = fixTime;
            navigationLocation.set(location);
            if (location.bearing >= 0) {
                this.lastBearing = location.bearing;
            }
            const speed = location.speed >= 0 ? location.speed : 0;
            this.speeds.push(speed);
            if (this.speeds.length > SPEED_WINDOW) {
                this.speeds.shift();
            }

            if (this.state === NavigationState.PAUSED) {
                // only thing left to do while paused is notice that we started moving again
                if (this.autoPaused && speed > get(navigationAutoPauseSpeed)) {
                    this.resume();
                }
                return;
            }

            const progress = this.computeProgress(location);
            navigationProgress.set(progress);
            this.notify({ eventName: NavigationProgressEvent, object: this, data: progress });

            if (get(navigationRecordStats)) {
                this.geoHandler.updateSessionWithLoc(location);
                this.publishStats();
            }

            this.checkOffRoute(progress, location);
            this.updateZoom(progress);
            this.checkArrival(progress);
            this.checkWakeTriggers(progress, speed, location);
            this.checkAutoPause(speed);
            this.updateBackgroundInterval();
        } catch (error) {
            console.error(TAG, 'onLocation', error, error.stack);
        }
    }

    private computeProgress(location: GeoLocation): RouteProgress {
        const route = this.route;
        let state = this.offRouteDetector.update(location, route.activePositions);
        if (route.hasDetour) {
            const done = route.shouldDropDetour(state, location, this.offRouteDetector.toleranceFor(location));
            // leaving the detour too: the user is not taking it, so stop measuring against it and go
            // back to the plain off-route handling, which can offer them another one
            if (done || state.offRoute) {
                DEV_LOG && console.log(TAG, done ? 'detour done' : 'detour left', 'resuming the route at', route.detour.rejoinIndex);
                this.setDetour(null, route.detour.rejoinIndex);
                state = this.offRouteDetector.update(location, route.activePositions);
            }
        }
        // while off route the figures keep coming from where the user left the route: blanking the whole
        // bar is worse than showing what is left from a point they can see on the map
        return route.progressFrom(state, location);
    }

    /**
     * Swapping the detour in or out changes the polyline everything is projected against, so the
     * detector has to be told: its indices refer to the old one and mean nothing on the new one.
     */
    private setDetour(detour: NavigationDetour, resumeIndex = -1) {
        if (detour) {
            this.route.setDetour(detour);
            this.offRouteDetector.reset();
        } else {
            this.route.clearDetour();
            this.offRouteDetector.resetTo(resumeIndex);
        }
        navigationDetour.set(detour);
    }

    /** The transitions are what the ui and the reroute care about, not the per-fix state. */
    private checkOffRoute(progress: RouteProgress, location: GeoLocation) {
        const offRoute = !!progress.offRoute;
        // the way back is worth keeping current while off route: it is both drawn on the map and what
        // a reroute is computed to, and it moves as the user does
        navigationRejoinTarget.set(offRoute ? this.rejoinTargetFor(progress) : null);
        if (offRoute !== this.wasOffRoute) {
            this.wasOffRoute = offRoute;
            // both are what the automatic reroute measures its own patience against
            this.offRouteLocation = offRoute ? location : null;
            if (!offRoute) {
                this.lastRerouteAttempt = 0;
            }
            DEV_LOG && console.log(TAG, offRoute ? 'off route by' : 'back on route, was', Math.round(progress.distanceFromRoute ?? 0), 'm near index', progress.onPathIndex);
            this.notify({ eventName: NavigationOffRouteEvent, object: this, data: progress });
            if (__ANDROID__ && this.appInBackground) {
                // leaving the route is exactly the moment the user needs to see the screen without asking
                this.refreshScreen(offRoute ? 'went off route' : 'back on route');
            }
        }
        if (offRoute) {
            this.checkAutoReroute(location);
        }
    }

    /** Where an off-route user is being sent back to, on the base route rather than on any detour. */
    private rejoinTargetFor(progress: RouteProgress) {
        const route = this.route;
        if (!route || route.hasDetour) {
            return null;
        }
        return chooseRejoinTarget({
            positions: route.positions,
            instructions: route.item.instructions,
            fromIndex: progress.onPathIndex,
            closestIndex: progress.closestIndex
        });
    }

    /**
     * Takes the user back to the route without being asked, when the way back is short enough that
     * asking would be noise. Anything further is a decision — which way to go, or whether to go back at
     * all — and is left to the two buttons in the navigation bar.
     */
    private checkAutoReroute(location: GeoLocation) {
        if (!get(navigationAutoReroute)) {
            DEV_LOG && console.log(TAG, 'auto reroute skipped, disabled');
            return;
        }
        if (this.rerouting) {
            DEV_LOG && console.log(TAG, 'auto reroute skipped, one is already running');
            return;
        }
        if (this.route?.hasDetour) {
            DEV_LOG && console.log(TAG, 'auto reroute skipped, already on a detour');
            return;
        }
        const now = Date.now();
        if (now - this.lastRerouteAttempt < REROUTE_RETRY_INTERVAL) {
            DEV_LOG && console.log(TAG, 'auto reroute skipped, last attempt was', Math.round((now - this.lastRerouteAttempt) / 1000), 's ago');
            return;
        }
        // leaving the route for a moment — a photo, a shortcut across a bend, a bad fix — is not being
        // lost, and routing it costs the same battery as routing something the user needs
        if (!this.lastRerouteAttempt) {
            const offRouteFor = this.offRouteDetector.offRouteSince ? now - this.offRouteDetector.offRouteSince : 0;
            const travelled = this.offRouteLocation ? computeDistanceBetween(this.offRouteLocation, location) : 0;
            if (offRouteFor < AUTO_REROUTE_MIN_OFF_ROUTE_TIME && travelled < AUTO_REROUTE_MIN_OFF_ROUTE_DISTANCE) {
                DEV_LOG && console.log(TAG, 'auto reroute skipped, off route for only', Math.round(offRouteFor / 1000), 's and', Math.round(travelled), 'm');
                return;
            }
        }
        const target = get(navigationRejoinTarget);
        if (!target) {
            DEV_LOG && console.log(TAG, 'auto reroute skipped, no rejoin target');
            return;
        }
        // straight line, on purpose: it is what we know before routing, and routing is what we are
        // deciding whether to pay for
        const distance = computeDistanceBetween(location, target.position);
        if (distance > get(navigationAutoRerouteMaxDistance)) {
            DEV_LOG && console.log(TAG, 'auto reroute skipped, rejoin point is', Math.round(distance), 'm away');
            return;
        }
        if (!packageService.offlineRoutingSearchService()) {
            // online routing off route is exactly where there is no network: never wait on it silently
            DEV_LOG && console.log(TAG, 'auto reroute skipped, no offline routing');
            return;
        }
        this.lastRerouteAttempt = now;
        this.backToRoute(true).catch((error) => console.error(TAG, 'auto reroute failed', error, error.stack));
    }

    /** valhalla profile and costing options of the route being followed, so a reroute matches it */
    private routingOptionsForCurrentRoute() {
        return { profile: this.routeProfile, costingOptions: this.route?.item?.route?.costing_options };
    }

    /**
     * Routes from where the user is back onto the route, as a detour: the route itself is left alone,
     * and the detour is dropped by itself once they are back on it.
     */
    async backToRoute(auto = false) {
        const route = this.route;
        const location = get(navigationLocation);
        const target = get(navigationRejoinTarget);
        if (!route || !location || !target || this.rerouting) {
            return false;
        }
        const { costingOptions, profile } = this.routingOptionsForCurrentRoute();
        this.rerouting = true;
        navigationRerouting.set(true);
        try {
            DEV_LOG && console.log(TAG, 'back to route', auto ? '(auto)' : '(asked)', 'to index', target.index);
            const { positions, result, totalDistance, totalTime } = await packageService.computeRoute({
                points: [{ lat: location.lat, lon: location.lon }, target.position],
                profile,
                costingOptions
            });
            // the user walks while we compute: an automatic reroute they no longer need must not apply
            if (!this.isNavigating || this.route !== route || (auto && !this.offRouteDetector.offRoute)) {
                DEV_LOG && console.log(TAG, 'back to route dropped, no longer needed');
                return false;
            }
            this.setDetour({ positions, instructions: instructionsFromResult(result), rejoinIndex: target.index, totalDistance, totalTime });
            this.notify({ eventName: NavigationReroutedEvent, object: this, data: { auto, kind: 'detour' } });
            if (__ANDROID__ && this.appInBackground) {
                this.refreshScreen('rerouted back to the route');
            }
            return true;
        } finally {
            this.rerouting = false;
            navigationRerouting.set(false);
        }
    }

    /**
     * Recomputes the whole route from here to the destination. The user's own route is kept aside,
     * still drawn, and put back by `undoReroute`.
     */
    async rerouteToDestination() {
        const route = this.route;
        const location = get(navigationLocation);
        const destination = route?.destination;
        if (!route || !location || !destination || this.rerouting) {
            return false;
        }
        const { costingOptions, profile } = this.routingOptionsForCurrentRoute();
        this.rerouting = true;
        navigationRerouting.set(true);
        try {
            DEV_LOG && console.log(TAG, 'rerouting to the destination');
            const { positions, result, totalDistance, totalTime } = await packageService.computeRoute({
                points: [{ lat: location.lat, lon: location.lon }, destination],
                profile,
                costingOptions
            });
            if (!this.isNavigating || this.route !== route) {
                return false;
            }
            const item: IItem = {
                type: 'Feature',
                properties: {
                    ...route.item.properties,
                    // an id would make it look like a saved item to everything that keys on one
                    id: undefined,
                    name: route.item.properties?.name,
                    route: { ...route.item.properties?.route, totalTime, totalDistance }
                },
                geometry: positionsToGeoJSONLine(positions),
                route: { ...route.item.route, totalTime, totalDistance, waypoints: undefined, steps: undefined },
                instructions: instructionsFromResult(result)
            };
            route.replaceBase(item, positions);
            this.offRouteDetector.reset();
            navigationDetour.set(null);
            navigationOriginalItem.set(route.originalItem);
            navigationItem.set(item);
            this.notify({ eventName: NavigationReroutedEvent, object: this, data: { auto: false, kind: 'route' } });
            if (__ANDROID__ && this.appInBackground) {
                this.refreshScreen('rerouted to the destination');
            }
            return true;
        } finally {
            this.rerouting = false;
            navigationRerouting.set(false);
        }
    }

    /**
     * Persists extra data computed for the route while navigating — an elevation profile, road stats —
     * and puts the updated item back everywhere it is read from.
     *
     * Only ever called with data that does not touch the geometry, so the cached positions and
     * everything indexed by them stay valid: this is deliberately not `replaceBase`, which is for a
     * route that actually changed.
     */
    async updateNavigatedItem(data: Partial<IItem>) {
        const route = this.route;
        if (!route?.item) {
            return null;
        }
        const item = route.item;
        // an item with no id was never saved — a computed route the user has not kept — so there is
        // nothing to persist it into and the in-memory one is all there is
        const updated = item.id !== undefined ? await getMapContext().mapModule('items').updateItem(item, data) : Object.assign(item, data);
        // navigation may have stopped or rerouted while we were computing
        if (this.route !== route) {
            return null;
        }
        route.item = updated;
        navigationItem.set(updated);
        return updated;
    }

    /** Puts back what was being navigated before the last reroute, detour or full route. */
    undoReroute() {
        const route = this.route;
        if (!route) {
            return false;
        }
        if (route.hasDetour) {
            this.setDetour(null, route.detour.rejoinIndex);
            return true;
        }
        if (route.originalItem) {
            const original = route.originalItem;
            route.replaceBase(original);
            route.originalItem = null;
            this.offRouteDetector.reset();
            navigationOriginalItem.set(null);
            navigationItem.set(original);
            return true;
        }
        return false;
    }

    private publishStats() {
        const session = this.geoHandler.getCurrentSession();
        if (!session) {
            navigationStats.set(null);
            return;
        }
        navigationStats.set({
            duration: this.geoHandler.getCurrentSessionChrono(),
            distance: session.distance,
            currentSpeed: session.currentSpeed,
            averageSpeed: session.averageSpeed,
            altitudeGain: session.altitudeGain,
            altitudeNegative: session.altitudeNegative
        } as NavigationStats);
    }

    private medianSpeed() {
        if (!this.speeds.length) {
            return 0;
        }
        const sorted = [...this.speeds].sort((a, b) => a - b);
        return sorted[Math.floor(sorted.length / 2)];
    }

    private updateZoom(progress: RouteProgress) {
        if (!get(navigationAutoZoom)) {
            DEV_LOG && console.log(TAG, 'zoom: auto zoom disabled');
            return;
        }
        const speed = this.medianSpeed();
        // off route the maneuver distances describe a point the user is walking away from: let the
        // speed alone decide how much road to frame until they are back on it
        const onRoute = progress.stale ? { onPathIndex: progress.onPathIndex } : progress;
        const lookAhead = this.computeLookAhead(onRoute, speed);
        const legFrame = this.legFrameRequirement(onRoute, speed);
        const zoom = this.zoomToFrame(lookAhead, legFrame);
        if (zoom === null) {
            DEV_LOG && console.log(TAG, 'zoom: could not measure the map', lookAhead);
            return;
        }
        const target = Math.min(Math.max(zoom, get(navigationZoomMin)), get(navigationZoomMax));
        const current = this.currentZoom || getMapContext().getMap()?.camera().zoom() || target;
        const delta = target - current;
        DEV_LOG &&
            console.log(
                TAG,
                'zoom',
                JSON.stringify({
                    speed: Math.round(speed * 10) / 10,
                    profile: this.routeProfile,
                    toNext: Math.round(progress.distanceToNextInstruction),
                    toFollowing: Math.round(progress.distanceToFollowingInstruction),
                    lookAhead: Math.round(lookAhead),
                    legForward: legFrame ? Math.round(legFrame.forward) : null,
                    legLateral: legFrame ? Math.round(legFrame.lateral) : null,
                    raw: Math.round(zoom * 100) / 100,
                    target: Math.round(target * 100) / 100,
                    current: Math.round(current * 100) / 100,
                    delta: Math.round(delta * 100) / 100,
                    following: this.userLocationModule?.userFollow
                })
            );
        if (Math.abs(delta) < ZOOM_MIN_DELTA) {
            this.zoomOutHoldCount = 0;
            return;
        }
        if (delta < 0 && ++this.zoomOutHoldCount < ZOOM_OUT_HOLD_FIXES) {
            DEV_LOG && console.log(TAG, 'zoom: holding zoom out', this.zoomOutHoldCount, '/', ZOOM_OUT_HOLD_FIXES);
            return;
        }
        this.zoomOutHoldCount = 0;
        this.currentZoom = target;
        const userLocationModule = this.userLocationModule;
        if (userLocationModule) {
            DEV_LOG && console.log(TAG, 'zoom: applying', target);
            userLocationModule.navigationZoom = target;
        }
    }

    /** The framed distance, with every distance setting scaled to how the route is travelled. */
    private computeLookAhead(progress: RouteProgress, speed: number) {
        const distanceFactor = this.profileTuning.distance;
        return computeNavigationLookAhead({
            speed,
            distanceToNextInstruction: progress.distanceToNextInstruction,
            distanceToFollowingInstruction: progress.distanceToFollowingInstruction,
            lookAheadSeconds: get(navigationZoomLookAhead),
            // a time based look ahead already follows the speed, so the profile only scales distances
            denseManeuverDistance: get(navigationZoomDenseManeuverDistance) * distanceFactor,
            maneuverVisibleDistance: get(navigationZoomManeuverVisibleDistance) * distanceFactor,
            minLookAhead: get(navigationZoomMinLookAhead) * distanceFactor,
            maxLookAhead: get(navigationZoomMaxLookAhead) * distanceFactor,
            maneuverFrameRatio: get(navigationZoomManeuverFrameRatio),
            zoomFactor: get(navigationZoomFactor)
        });
    }

    /**
     * How much ground the current leg needs, along the direction of travel and across it.
     *
     * A look-ahead distance alone only ever describes road *straight ahead*: on a leg that turns 90° the
     * end point sits to the side, and no amount of look-ahead brings it into frame. So the leg is
     * sampled and each vertex resolved into a forward and a lateral distance from the user, which the
     * zoom then has to satisfy in both axes.
     *
     * Null when the leg should not decide the zoom: crawling along a very long stretch, where framing
     * the whole leg would zoom out to a map nobody can read.
     */
    private legFrameRequirement(progress: RouteProgress, speed: number) {
        const route = this.route;
        const instruction = progress.instruction;
        const location = get(navigationLocation);
        const bearing = this.lastBearing;
        if (!route || !instruction || progress.stale || !location || bearing < 0) {
            return null;
        }
        const tuning = this.profileTuning;
        if (speed < tuning.slowSpeed && progress.distanceToNextInstruction > tuning.longStretch) {
            return null;
        }
        const positions = route.activePositions;
        const size = positions?.length ?? 0;
        // on a detour the maneuvers and the polyline are the detour's, so the index has to be too
        const fromIndex = progress.onDetour ? progress.detourIndex : progress.onPathIndex;
        const toIndex = Math.min(instruction.index, size - 1);
        if (size < 2 || fromIndex < 0 || toIndex <= fromIndex) {
            return null;
        }
        // every vertex of the leg, but at most LEG_FRAME_SAMPLES of them: a dense track would otherwise
        // cost thousands of distances per fix for an answer a handful of points already gives
        const step = Math.max(1, Math.ceil((toIndex - fromIndex) / LEG_FRAME_SAMPLES));
        let forward = 0;
        let lateral = 0;
        const measure = (index: number) => {
            const vertex = positions[index];
            const distance = computeDistanceBetween(location, vertex);
            if (!(distance > 0)) {
                return;
            }
            // the map is drawn heading up, so "ahead" and "to the side" are relative to where we go
            const angle = (getRhumbLineBearing(location, vertex) - bearing) * Math.PI * (1 / 180);
            forward = Math.max(forward, distance * Math.cos(angle));
            lateral = Math.max(lateral, Math.abs(distance * Math.sin(angle)));
        };
        for (let index = fromIndex + step; index < toIndex; index += step) {
            measure(index);
        }
        // the maneuver itself, always: the step rarely divides the leg evenly, and the end of the leg is
        // the one point this whole computation exists to keep on screen
        measure(toIndex);
        return forward > 0 || lateral > 0 ? { forward, lateral } : null;
    }

    /**
     * Converts the framed distances into a zoom by measuring what the map currently shows, rather
     * than modelling the screen: that keeps us right whatever the device density and tile size.
     *
     * Whichever of the three constraints — the look-ahead, the leg's forward reach, its lateral reach —
     * needs the most ground wins, so the leg can only ever widen the view the speed asked for.
     */
    private zoomToFrame(lookAheadMeters: number, legFrame: { forward: number; lateral: number }) {
        const map = getMapContext().getMap();
        if (!map || !(lookAheadMeters > 0)) {
            return null;
        }
        const { height, width } = map.size();
        if (!width || !height) {
            return null;
        }
        const camera = map.camera();
        const y = height / 2;
        // measured horizontally at mid screen, where the navigation tilt distorts the least
        const left = fromPosition(camera.screenToMap(width * 0.25, y));
        const right = fromPosition(camera.screenToMap(width * 0.75, y));
        const metersPerScreenWidth = computeDistanceBetween(left, right) * 2;
        if (!(metersPerScreenWidth > 0)) {
            return null;
        }
        const currentZoom = camera.zoom();
        const metersAhead = metersPerScreenWidth * (height / width) * AHEAD_SCREEN_FRACTION;
        const metersLateral = metersPerScreenWidth * LATERAL_SCREEN_FRACTION;
        let zoom = currentZoom + Math.log2(metersAhead / lookAheadMeters);
        if (legFrame?.forward > 0) {
            zoom = Math.min(zoom, currentZoom + Math.log2(metersAhead / legFrame.forward));
        }
        if (legFrame?.lateral > 0) {
            zoom = Math.min(zoom, currentZoom + Math.log2(metersLateral / legFrame.lateral));
        }
        return zoom;
    }

    private checkArrival(progress: RouteProgress) {
        // off route the figures are the last on-route ones, and a detour ends at the rejoin point, not
        // at the destination: neither is in a position to say the route is done
        if (this.arrived || progress.onPathIndex === -1 || progress.stale || progress.onDetour) {
            return;
        }
        // both branches check the distance left to the *end of the route*: a route that comes back along
        // itself can put a FINISH maneuver within arm's reach of a point kilometres from the end, and
        // announcing an arrival there is exactly what this rules out
        const nearEnd = progress.remainingDistance <= ARRIVAL_DISTANCE;
        const finishing = progress.instruction?.a === RoutingAction.FINISH && progress.distanceToNextInstruction <= ARRIVAL_DISTANCE && nearEnd;
        const atEnd = !progress.instruction && nearEnd;
        if (finishing || atEnd) {
            this.arrived = true;
            this.notify({ eventName: NavigationArrivedEvent, object: this, data: this.route?.item });
            if (__ANDROID__) {
                requestScreenRefresh(this.geoHandler);
            }
        }
    }

    /** Every screen refresh goes through here so there is one place to see why it did or did not fire. */
    /**
     * `requestScreenRefresh` throttles itself against the time the screen needs to go back off, so a
     * refresh asked for here may not happen. Only a refresh that did counts as one: stamping it either
     * way would also hold off the periodic refresh, which is the one meant to cover exactly this case.
     */
    private refreshScreen(reason: string) {
        DEV_LOG && console.log(TAG, 'screen refresh:', reason);
        if (requestScreenRefresh(this.geoHandler)) {
            this.lastScreenRefresh = Date.now();
            this.lastRefreshBearing = this.lastBearing;
        }
    }

    /** A maneuver is owed a refresh once it is behind the user, so they see the heading they ended on. */
    private armManeuverRefresh(instructionIndex: number) {
        this.pendingTurnRefreshIndex = instructionIndex;
        this.pendingTurnPassedLocation = null;
        this.pendingTurnPassedTime = 0;
    }

    /**
     * Whether a maneuver leaves the user pointing somewhere else, and so is worth a second look once
     * it is done.
     *
     * A roundabout always is, whatever its own angle says: valhalla reports the turn *into* the ring,
     * a handful of degrees, while the heading change the user actually experiences is spread across
     * the entry, the ring and the exit.
     */
    private turnsTheUser(instruction: RouteInstruction) {
        switch (instruction.a) {
            case RoutingAction.ENTER_ROUNDABOUT:
            case RoutingAction.STAY_ON_ROUNDABOUT:
            case RoutingAction.LEAVE_ROUNDABOUT:
            case RoutingAction.UTURN:
                return true;
        }
        return Math.abs(instruction.angle ?? 0) >= get(navigationTurnRefreshAngle);
    }

    /**
     * The refresh owed to a maneuver now behind us, held until the user is far enough past it that the
     * map is worth looking at: mid turn the heading is still swinging and the screen shows the inside
     * of the junction. Distance rather than a timer, so it means the same thing on foot and in a car —
     * with the delay setting as a cap, because stopped just past a turn the distance never comes.
     */
    private checkManeuverRefresh(progress: RouteProgress, location: GeoLocation) {
        if (this.pendingTurnRefreshIndex < 0 || !(progress.instructionIndex > this.pendingTurnRefreshIndex)) {
            return false;
        }
        if (!this.pendingTurnPassedLocation) {
            // the fix the maneuver went behind us on, which is what the distance is measured from
            this.pendingTurnPassedLocation = location;
            this.pendingTurnPassedTime = Date.now();
            return false;
        }
        const travelled = computeDistanceBetween(this.pendingTurnPassedLocation, location);
        const waited = Date.now() - this.pendingTurnPassedTime;
        if (travelled < get(navigationManeuverRefreshDistance) && waited < get(navigationTurnRefreshDelay) * 1000) {
            return false;
        }
        const turnIndex = this.pendingTurnRefreshIndex;
        this.armManeuverRefresh(-1);
        this.refreshScreen(`${Math.round(travelled)}m past maneuver ${turnIndex}, new heading`);
        return true;
    }

    /**
     * Waking the screen only makes sense when it is off, ie when the app is in background: that is
     * the whole point of the mode, not having to turn the phone on to know what comes next.
     */
    private checkWakeTriggers(progress: RouteProgress, speed: number, location: GeoLocation) {
        if (!__ANDROID__) {
            DEV_LOG && console.log(TAG, 'screen refresh skipped: not android');
            return;
        }
        if (!this.appInBackground) {
            DEV_LOG && console.log(TAG, 'screen refresh skipped: app is in foreground, the screen is already on');
            return;
        }
        const wakeDistance = get(navigationManeuverWakeDistance);
        // a stale distance to the next maneuver would announce a turn the user is not walking towards
        if (!progress.stale && progress.instruction && progress.distanceToNextInstruction <= wakeDistance) {
            // one wake per maneuver, else it fires again on every fix as we close in
            if (progress.instructionIndex !== this.lastWokenInstructionIndex) {
                this.lastWokenInstructionIndex = progress.instructionIndex;
                // maneuvers come clustered — a roundabout's enter and exit are metres apart — so the
                // index can advance to one we are already on top of. Waking for that shows the middle
                // of the turn, pointing the wrong way, with nothing of what comes after in frame
                const tooClose = progress.distanceToNextInstruction < MIN_WAKE_LEAD;
                // a maneuver that turns us changes what is ahead, so a refresh is owed once it is
                // behind us. So is one we could not usefully announce: that refresh is all the user gets
                this.armManeuverRefresh(tooClose || this.turnsTheUser(progress.instruction) ? progress.instructionIndex : -1);
                if (!tooClose) {
                    this.refreshScreen(`maneuver ${progress.instructionIndex} within ${Math.round(progress.distanceToNextInstruction)}m of ${wakeDistance}m`);
                    return;
                }
                DEV_LOG && console.log(TAG, `maneuver ${progress.instructionIndex} is already ${Math.round(progress.distanceToNextInstruction)}m away, refreshing past it instead`);
            }
        }
        // deliberately not an else: with clustered maneuvers the next one is still inside wakeDistance,
        // and the refresh owed for the one just completed has to happen all the same
        if (this.checkManeuverRefresh(progress, location)) {
            return;
        }

        const bearingThreshold = get(navigationBearingRefreshAngle);
        if (bearingThreshold > 0 && this.lastRefreshBearing >= 0 && this.lastBearing >= 0) {
            const change = angleDifference(this.lastBearing, this.lastRefreshBearing);
            if (change >= bearingThreshold) {
                this.refreshScreen(`heading changed by ${Math.round(change)}° since the last refresh`);
                return;
            }
        }

        if (get(navigationSpeedDropWake) && this.speeds.length >= SPEED_WINDOW) {
            const average = this.speeds.reduce((total, value) => total + value, 0) / this.speeds.length;
            // slowing down usually means a maneuver is coming, but only when we were actually moving
            if (average > SPEED_DROP_MIN_AVERAGE && speed < average * get(navigationSpeedDropWakeRatio)) {
                const now = Date.now();
                if (now - this.lastSpeedDropWake > SPEED_DROP_MIN_INTERVAL) {
                    this.lastSpeedDropWake = now;
                    this.refreshScreen(`speed dropped from ${average.toFixed(1)} to ${speed.toFixed(1)} m/s`);
                    return;
                }
            }
        }

        // nothing eventful, but a long straight still needs the map to catch up now and then
        const interval = get(navigationScreenRefreshInterval);
        if (interval > 0 && Date.now() - this.lastScreenRefresh >= interval * 1000) {
            this.refreshScreen(`periodic, ${interval}s elapsed`);
        }
    }

    private checkAutoPause(speed: number) {
        if (!get(navigationAutoPause)) {
            this.belowPauseSpeedSince = 0;
            return;
        }
        if (speed > get(navigationAutoPauseSpeed)) {
            this.belowPauseSpeedSince = 0;
            return;
        }
        const now = Date.now();
        if (!this.belowPauseSpeedSince) {
            this.belowPauseSpeedSince = now;
            return;
        }
        if (now - this.belowPauseSpeedSince >= get(navigationAutoPauseDelay) * 1000) {
            this.pause(true);
        }
    }
}

export const navigationService = new NavigationService();
