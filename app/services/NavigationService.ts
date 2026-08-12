import Observable from '@nativescript-community/observable';
import { MapPosVector } from '@nativescript-community/ui-carto/core';
import { Application, ApplicationEventData } from '@nativescript/core';
import { get } from 'svelte/store';
import { GeoHandler, GeoLocation } from '~/handlers/GeoHandler';
import { getMapContext } from '~/mapModules/MapModule';
import { Item, RoutingAction } from '~/models/Item';
import { getBGServiceInstance } from '~/services/BgService';
import { packageService } from '~/services/PackageService';
import {
    NavigationState,
    NavigationStats,
    navigationAutoPause,
    navigationAutoPauseDelay,
    navigationAutoPauseSpeed,
    navigationAutoZoom,
    navigationBackgroundUpdateInterval,
    navigationBearingRefreshAngle,
    navigationGpsUpdateDistance,
    navigationItem,
    navigationLocation,
    navigationManeuverWakeDistance,
    navigationProgress,
    navigationRecordStats,
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
import { RouteProgress, computeNavigationLookAhead, computeRouteProgress, isNavigableRoute, projectOnRoute } from '~/utils/navigation';
import { requestScreenRefresh } from '~/utils/screen';

const TAG = '[NavigationService]';

export const NavigationStateEvent = 'navigationState';
export const NavigationProgressEvent = 'navigationProgress';
export const NavigationArrivedEvent = 'navigationArrived';

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

const mapContext = getMapContext();

export class NavigationService extends Observable {
    geoHandler: GeoHandler;

    private item: Item = null;
    /** cached for the whole navigation: rebuilding the native vector on every fix would be wasteful */
    private positions: MapPosVector<LatLonKeys> = null;
    private speeds: number[] = [];
    private currentZoom = 0;
    private zoomOutHoldCount = 0;
    private lastWokenInstructionIndex = -1;
    private lastSpeedDropWake = 0;
    private belowPauseSpeedSince = 0;
    private autoPaused = false;
    private arrived = false;
    private listening = false;
    private lastOnPathIndex = -1;
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
        return this.item;
    }
    private get userLocationModule() {
        return mapContext.mapModule('userLocation');
    }
    private get appInBackground() {
        return getBGServiceInstance().appInBackground;
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
        this.item = item;
        this.positions = packageService.getRouteItemPoses(item);
        this.reset();

        const userLocationModule = this.userLocationModule;
        // the user asked to navigate, so getting a location is part of the request. Remember whether
        // they were already watching, so stopping puts the gps back the way we found it
        this.wasWatchingBeforeStart = get(watchingLocation);
        await userLocationModule.startWatchLocation();
        userLocationModule.navigationMode = true;

        this.geoHandler.keepWatchingInBackground = true;
        this.applyWatchOptions();

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
        DEV_LOG && console.log(TAG, 'stop');
        this.unlisten();
        this.geoHandler.keepWatchingInBackground = false;
        this.geoHandler.navigationWatchOptions = null;
        if (this.geoHandler.isSessionRunning()) {
            this.geoHandler.stopSession();
        }
        const userLocationModule = this.userLocationModule;
        if (userLocationModule) {
            userLocationModule.navigationZoom = 0;
            userLocationModule.navigationMode = false;
        }
        this.item = null;
        this.positions = null;
        this.reset();
        navigationItem.set(null);
        navigationProgress.set(null);
        navigationLocation.set(null);
        navigationStats.set(null);
        this.setState(NavigationState.IDLE);
        if (this.wasWatchingBeforeStart) {
            // they were tracking before, so keep tracking, just back at their own gps settings
            await this.geoHandler.restartWatch();
        } else {
            // navigation turned the gps on, so navigation turns it back off
            DEV_LOG && console.log(TAG, 'stopping the watch, it was off before navigation started');
            userLocationModule?.stopWatchLocation();
        }
        this.wasWatchingBeforeStart = false;
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
        this.applyWatchOptions();
        await this.geoHandler.restartWatch();
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
        this.applyWatchOptions();
        await this.geoHandler.restartWatch();
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
        this.lastOnPathIndex = -1;
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
        Application.on(Application.backgroundEvent, this.onAppBackground, this);
        Application.on(Application.foregroundEvent, this.onAppForeground, this);
    }
    private unlisten() {
        if (!this.listening) {
            return;
        }
        this.listening = false;
        this.userLocationModule?.off('location', this.onLocation, this);
        Application.off(Application.backgroundEvent, this.onAppBackground, this);
        Application.off(Application.foregroundEvent, this.onAppForeground, this);
    }

    private onAppBackground(args: ApplicationEventData) {
        this.applyWatchOptions();
        this.geoHandler?.restartWatch();
    }
    private onAppForeground(args: ApplicationEventData) {
        this.applyWatchOptions();
        this.geoHandler?.restartWatch();
    }

    /**
     * Navigation raises the gps rate in background instead of lowering it, which is the whole point
     * of the mode: we need to know a maneuver is coming while the screen is off.
     */
    private applyWatchOptions() {
        if (!this.geoHandler) {
            return;
        }
        if (!this.isNavigating) {
            this.geoHandler.navigationWatchOptions = null;
            return;
        }
        const updateDistance = get(navigationGpsUpdateDistance);
        if (this.state === NavigationState.PAUSED) {
            this.geoHandler.navigationWatchOptions = { minimumUpdateTime: PAUSED_UPDATE_INTERVAL, updateDistance };
        } else if (this.appInBackground) {
            this.geoHandler.navigationWatchOptions = { minimumUpdateTime: get(navigationBackgroundUpdateInterval), updateDistance };
        } else {
            // in foreground only the distance filter applies, the rate stays the user's own setting
            this.geoHandler.navigationWatchOptions = updateDistance > 0 ? { updateDistance } : null;
        }
        DEV_LOG && console.log(TAG, 'watch options', this.state, this.appInBackground, JSON.stringify(this.geoHandler.navigationWatchOptions));
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

            this.updateZoom(progress);
            this.checkArrival(progress);
            this.checkWakeTriggers(progress, speed);
            this.checkAutoPause(speed);
        } catch (error) {
            console.error(TAG, 'onLocation', error, error.stack);
        }
    }

    private computeProgress(location: GeoLocation): RouteProgress {
        // search a window ahead of where we were: progress along a route is monotonic, and a full scan
        // can match the other leg of a switchback, which makes the distance to the maneuver grow
        let projection = projectOnRoute(location, this.positions, { fromIndex: this.lastOnPathIndex });
        if (!projection && this.lastOnPathIndex !== -1) {
            // nothing in the window: we either left the route or rejoined it elsewhere, so look everywhere
            projection = projectOnRoute(location, this.positions);
            DEV_LOG && console.log(TAG, 'lost the route near', this.lastOnPathIndex, 'rescanned ->', projection?.index ?? 'off route');
        }
        if (!projection) {
            this.lastOnPathIndex = -1;
            return { onPathIndex: -1 };
        }
        this.lastOnPathIndex = projection.index;
        return computeRouteProgress({
            item: this.item,
            location,
            positions: this.positions,
            onPathIndex: projection.index,
            distanceToOnPathIndex: projection.distanceToIndex,
            computeRemaining: true,
            computeInstruction: true
        });
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
        const lookAhead = computeNavigationLookAheadFor(progress, speed);
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
        if (this.arrived || progress.onPathIndex === -1) {
            return;
        }
        const finishing = progress.instruction?.a === RoutingAction.FINISH && progress.distanceToNextInstruction <= ARRIVAL_DISTANCE;
        const atEnd = !progress.instruction && progress.remainingDistance <= ARRIVAL_DISTANCE;
        if (finishing || atEnd) {
            this.arrived = true;
            if (__ANDROID__) {
                requestScreenRefresh();
            }
            this.notify({ eventName: NavigationArrivedEvent, object: this, data: this.item });
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
                requestScreenRefresh();
            }, delaySeconds * 1000);
            return;
        }
        DEV_LOG && console.log(TAG, 'screen refresh:', reason);
        requestScreenRefresh();
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
        if (progress.instruction && progress.distanceToNextInstruction <= wakeDistance) {
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

/** Smallest angle between two headings, so 350° and 10° are 20° apart rather than 340°. */
function angleDifference(a: number, b: number) {
    const diff = Math.abs(a - b) % 360;
    return diff > 180 ? 360 - diff : diff;
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
