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
    navigationItem,
    navigationManeuverWakeDistance,
    navigationProgress,
    navigationRecordStats,
    navigationSpeedDropWake,
    navigationSpeedDropWakeRatio,
    navigationState,
    navigationStats,
    navigationZoomDenseManeuverDistance,
    navigationZoomLookAhead,
    navigationZoomMax,
    navigationZoomMaxLookAhead,
    navigationZoomMin,
    navigationZoomMinLookAhead
} from '~/stores/navigationStore';
import { computeDistanceBetween } from '~/utils/geo';
import { RouteProgress, computeNavigationLookAhead, computeRouteProgress, isLocationOnRoute, isNavigableRoute } from '~/utils/navigation';
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
        // the user asked to navigate, so getting a location is part of the request
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
        navigationStats.set(null);
        this.setState(NavigationState.IDLE);
        await this.geoHandler.restartWatch();
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
        if (this.state === NavigationState.PAUSED) {
            this.geoHandler.navigationWatchOptions = { minimumUpdateTime: PAUSED_UPDATE_INTERVAL, updateDistance: 0 };
        } else if (this.appInBackground) {
            this.geoHandler.navigationWatchOptions = { minimumUpdateTime: get(navigationBackgroundUpdateInterval), updateDistance: 0 };
        } else {
            // in foreground the user's own gps settings apply
            this.geoHandler.navigationWatchOptions = null;
        }
    }

    private onLocation(event: any) {
        try {
            const location: GeoLocation = event.data;
            if (!location || !this.isNavigating) {
                return;
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
        const onPathIndex = isLocationOnRoute(location, this.positions);
        if (onPathIndex === -1) {
            return { onPathIndex };
        }
        return computeRouteProgress({
            item: this.item,
            location,
            positions: this.positions,
            onPathIndex,
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
            return;
        }
        const lookAhead = computeNavigationLookAheadFor(progress, this.medianSpeed());
        const zoom = this.zoomForLookAhead(lookAhead);
        if (zoom === null) {
            return;
        }
        const target = Math.min(Math.max(zoom, get(navigationZoomMin)), get(navigationZoomMax));
        const current = this.currentZoom || mapContext.getMap()?.zoom || target;
        const delta = target - current;
        if (Math.abs(delta) < ZOOM_MIN_DELTA) {
            this.zoomOutHoldCount = 0;
            return;
        }
        if (delta < 0 && ++this.zoomOutHoldCount < ZOOM_OUT_HOLD_FIXES) {
            return;
        }
        this.zoomOutHoldCount = 0;
        this.currentZoom = target;
        const userLocationModule = this.userLocationModule;
        if (userLocationModule) {
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

    /**
     * Waking the screen only makes sense when it is off, ie when the app is in background: that is
     * the whole point of the mode, not having to turn the phone on to know what comes next.
     */
    private checkWakeTriggers(progress: RouteProgress, speed: number) {
        if (!__ANDROID__ || !this.appInBackground) {
            return;
        }
        if (progress.instruction && progress.distanceToNextInstruction <= get(navigationManeuverWakeDistance)) {
            // one wake per maneuver, else it fires again on every fix as we close in
            if (progress.instructionIndex !== this.lastWokenInstructionIndex) {
                this.lastWokenInstructionIndex = progress.instructionIndex;
                requestScreenRefresh();
            }
            return;
        }
        if (!get(navigationSpeedDropWake) || this.speeds.length < SPEED_WINDOW) {
            return;
        }
        const average = this.speeds.reduce((total, value) => total + value, 0) / this.speeds.length;
        // slowing down usually means a maneuver is coming, but only when we were actually moving
        if (average <= SPEED_DROP_MIN_AVERAGE || speed >= average * get(navigationSpeedDropWakeRatio)) {
            return;
        }
        const now = Date.now();
        if (now - this.lastSpeedDropWake > SPEED_DROP_MIN_INTERVAL) {
            this.lastSpeedDropWake = now;
            requestScreenRefresh();
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
        minLookAhead: get(navigationZoomMinLookAhead),
        maxLookAhead: get(navigationZoomMaxLookAhead)
    });
}

export const navigationService = new NavigationService();
