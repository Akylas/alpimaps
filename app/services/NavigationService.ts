import Observable from '@nativescript-community/observable';
import { Application, ApplicationEventData } from '@nativescript/core';
import { get } from 'svelte/store';
import type { GeoHandler, GeoLocation } from '~/handlers/GeoHandler';
import { getMapContext } from '~/mapModules/MapModule';
import type { ValhallaProfile } from '@nativescript-community/ui-carto/routing';
import { IItem, Item, RoutingAction } from '~/models/Item';
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
    navigationZoomLookAhead,
    navigationZoomManeuverVisibleDistance,
    navigationZoomMax,
    navigationZoomMaxLookAhead,
    navigationZoomMin,
    navigationZoomMinLookAhead
} from '~/stores/navigationStore';
import { watchingLocation } from '~/stores/mapStore';
import { computeDistanceBetween } from '~/utils/geo';
import { OffRouteDetector, RouteProgress, angleDifference, chooseRejoinTarget, computeNavigationLookAhead, isNavigableRoute } from '~/utils/navigation';
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
/** ms: gps rate while navigation is paused, just enough to notice we started moving again */
const PAUSED_UPDATE_INTERVAL = 10000;
/** meters from the end at which we consider the route done */
const ARRIVAL_DISTANCE = 30;
/** ms between two automatic reroute attempts, so a failing one does not run on every fix */
const REROUTE_RETRY_INTERVAL = 30000;

const mapContext = getMapContext();

export class NavigationService extends Observable {
    geoHandler: GeoHandler;

    /**
     * The route being followed — never the selected item itself, so a reroute cannot rewrite the
     * user's own route. Its positions are cached for the whole navigation: rebuilding the native
     * vector on every fix would be wasteful.
     */
    private route: NavigationRoute = null;
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
    /** one reroute at a time, and never one per fix while the last one is still failing */
    private rerouting = false;
    private lastRerouteAttempt = 0;
    private lastScreenRefresh = 0;
    /** heading of the last fix, and the heading the map was last drawn at */
    private lastBearing = -1;
    private lastRefreshBearing = -1;
    private delayedRefreshTimer;
    /** a sharp maneuver we already announced, still owed a second refresh once it is behind us */
    private pendingTurnRefreshIndex = -1;
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
        return mapContext.mapModule('userLocation');
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

        this.geoHandler.keepWatchingInBackground = true;
        // options first, so the single start below already uses the navigation cadence. Starting and
        // then restarting used to register two watches, and startSession a third. Told explicitly that
        // we are navigating: the state only flips to RUNNING at the end of this method
        await userLocationModule.startWatchLocation({ force: true });
        userLocationModule.navigationMode = true;

        // has to happen now, while the app is still in the foreground: android 14 refuses to start a
        // location foreground service from the background, so waiting for onAppPause is too late
        this.geoHandler.showForegroundNotification();

        if (get(navigationRecordStats) && !this.geoHandler.isSessionRunning()) {
            await this.geoHandler.startSession();
        }

        this.listen();
        navigationItem.set(item);
        this.setState(NavigationState.RUNNING);
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
            this.geoHandler.keepWatchingInBackground = false;
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

    restartWatch() {
        return this.geoHandler?.restartWatch();
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
        navigationRejoinTarget.set(null);
        navigationRerouting.set(false);
        this.lastScreenRefresh = Date.now();
        this.pendingTurnRefreshIndex = -1;
        this.lastBearing = -1;
        this.lastRefreshBearing = -1;
        if (this.delayedRefreshTimer) {
            clearTimeout(this.delayedRefreshTimer);
            this.delayedRefreshTimer = null;
        }
    }

    private setState(state: NavigationState) {
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
        this.userLocationModule.on('location', this.onLocation, this);
        // Application.on(Application.backgroundEvent, this.onAppBackground, this);
        // Application.on(Application.foregroundEvent, this.onAppForeground, this);
    }
    private unlisten() {
        if (!this.listening) {
            return;
        }
        this.listening = false;
        this.userLocationModule?.off('location', this.onLocation, this);
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
     */
    public getWatchOptions(navigating = this.isNavigating) {
        if (!navigating) {
            return {};
        }
        const updateDistance = get(navigationGpsUpdateDistance);
        if (this.state === NavigationState.PAUSED) {
            return {
                /* minimumUpdateTime: PAUSED_UPDATE_INTERVAL, updateDistance */
            };
        } else if (this.appInBackground) {
            return { minimumUpdateTime: get(navigationBackgroundUpdateInterval), updateDistance };
        } else {
            // in foreground only the distance filter applies, the rate stays the user's own setting
            return updateDistance > 0 ? { updateDistance } : null;
        }
    }

    private onLocation(event: any) {
        try {
            const location: GeoLocation = event.data;
            if (!location || !this.isNavigating) {
                return;
            }
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
            this.checkWakeTriggers(progress, speed);
            this.checkAutoPause(speed);
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
        if (!get(navigationAutoReroute) || this.rerouting || this.route?.hasDetour) {
            return;
        }
        const now = Date.now();
        if (now - this.lastRerouteAttempt < REROUTE_RETRY_INTERVAL) {
            return;
        }
        const target = get(navigationRejoinTarget);
        if (!target) {
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
        const item = this.route?.item;
        const profile: ValhallaProfile = item?.properties?.route?.type ?? 'pedestrian';
        return { profile, costingOptions: item?.route?.costing_options };
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
                projection: mapContext.getProjection(),
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
                projection: mapContext.getProjection(),
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
        const lookAhead = computeNavigationLookAheadFor(progress.stale ? { onPathIndex: progress.onPathIndex } : progress, speed);
        const zoom = this.zoomForLookAhead(lookAhead);
        if (zoom === null) {
            DEV_LOG && console.log(TAG, 'zoom: could not measure the map', lookAhead);
            return;
        }
        const target = Math.min(Math.max(zoom, get(navigationZoomMin)), get(navigationZoomMax));
        const current = this.currentZoom || mapContext.getMap()?.zoom || target;
        const delta = target - current;
        DEV_LOG &&
            console.log(
                TAG,
                'zoom',
                JSON.stringify({
                    speed: Math.round(speed * 10) / 10,
                    toNext: Math.round(progress.distanceToNextInstruction),
                    toFollowing: Math.round(progress.distanceToFollowingInstruction),
                    lookAhead: Math.round(lookAhead),
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

    /**
     * Converts a look-ahead distance into a zoom by measuring what the map currently shows, rather
     * than modelling the screen: that keeps us right whatever the device density and tile size.
     */
    private zoomForLookAhead(lookAheadMeters: number) {
        const map = mapContext.getMap();
        if (!map || !(lookAheadMeters > 0)) {
            return null;
        }
        const width = map.getMeasuredWidth();
        const height = map.getMeasuredHeight();
        if (!width || !height) {
            return null;
        }
        const y = height / 2;
        // measured horizontally at mid screen, where the navigation tilt distorts the least
        const left = map.screenToMap({ x: width * 0.25, y });
        const right = map.screenToMap({ x: width * 0.75, y });
        const metersPerScreenWidth = computeDistanceBetween(left, right) * 2;
        if (!(metersPerScreenWidth > 0)) {
            return null;
        }
        const metersAhead = metersPerScreenWidth * (height / width) * AHEAD_SCREEN_FRACTION;
        return map.zoom + Math.log2(metersAhead / lookAheadMeters);
    }

    private checkArrival(progress: RouteProgress) {
        // off route the figures are the last on-route ones, and a detour ends at the rejoin point, not
        // at the destination: neither is in a position to say the route is done
        if (this.arrived || progress.onPathIndex === -1 || progress.stale || progress.onDetour) {
            return;
        }
        const finishing = progress.instruction?.a === RoutingAction.FINISH && progress.distanceToNextInstruction <= ARRIVAL_DISTANCE;
        const atEnd = !progress.instruction && progress.remainingDistance <= ARRIVAL_DISTANCE;
        if (finishing || atEnd) {
            this.arrived = true;
            this.notify({ eventName: NavigationArrivedEvent, object: this, data: this.route?.item });
            if (__ANDROID__) {
                requestScreenRefresh(this.geoHandler);
            }
        }
    }

    /** Every screen refresh goes through here so there is one place to see why it did or did not fire. */
    private refreshScreen(reason: string, delaySeconds = 0) {
        this.lastScreenRefresh = Date.now();
        this.lastRefreshBearing = this.lastBearing;
        if (delaySeconds > 0) {
            DEV_LOG && console.log(TAG, 'screen refresh in', delaySeconds + 's:', reason);
            if (this.delayedRefreshTimer) {
                clearTimeout(this.delayedRefreshTimer);
            }
            this.delayedRefreshTimer = setTimeout(() => {
                this.delayedRefreshTimer = null;
                // the bearing has settled by now, so the map is drawn pointing where we actually go
                this.lastRefreshBearing = this.lastBearing;
                DEV_LOG && console.log(TAG, 'screen refresh (delayed):', reason);
                requestScreenRefresh(this.geoHandler);
            }, delaySeconds * 1000);
            return;
        }
        DEV_LOG && console.log(TAG, 'screen refresh:', reason);
        requestScreenRefresh(this.geoHandler);
    }

    /**
     * Waking the screen only makes sense when it is off, ie when the app is in background: that is
     * the whole point of the mode, not having to turn the phone on to know what comes next.
     */
    private checkWakeTriggers(progress: RouteProgress, speed: number) {
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
                // a sharp turn changes what is ahead, so ask for a second refresh once it is behind us
                this.pendingTurnRefreshIndex = Math.abs(progress.instruction.angle ?? 0) >= get(navigationTurnRefreshAngle) ? progress.instructionIndex : -1;
                this.refreshScreen(`maneuver ${progress.instructionIndex} within ${Math.round(progress.distanceToNextInstruction)}m of ${wakeDistance}m`);
                return;
            }
        } else if (this.pendingTurnRefreshIndex >= 0 && progress.instructionIndex > this.pendingTurnRefreshIndex) {
            // the sharp turn is done, but wait a moment: mid roundabout the heading is still swinging
            const turnIndex = this.pendingTurnRefreshIndex;
            this.pendingTurnRefreshIndex = -1;
            this.refreshScreen(`sharp maneuver ${turnIndex} completed, new heading`, get(navigationTurnRefreshDelay));
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

function computeNavigationLookAheadFor(progress: RouteProgress, speed: number) {
    return computeNavigationLookAhead({
        speed,
        distanceToNextInstruction: progress.distanceToNextInstruction,
        distanceToFollowingInstruction: progress.distanceToFollowingInstruction,
        lookAheadSeconds: get(navigationZoomLookAhead),
        denseManeuverDistance: get(navigationZoomDenseManeuverDistance),
        maneuverVisibleDistance: get(navigationZoomManeuverVisibleDistance),
        minLookAhead: get(navigationZoomMinLookAhead),
        maxLookAhead: get(navigationZoomMaxLookAhead)
    });
}

export const navigationService = new NavigationService();
