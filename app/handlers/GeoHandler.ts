import { GPS, GenericGeoLocation, Options as GeolocationOptions, LocationMonitor } from '@nativescript-community/gps';
import { check, request } from '@nativescript-community/perms';
import { confirm } from '@nativescript-community/ui-material-dialogs';
import { ApplicationSettings, Enums } from '@nativescript/core';
import { AndroidApplication, ApplicationEventData, android as androidApp, off as applicationOff, on as applicationOn, launchEvent, resumeEvent, suspendEvent } from '@nativescript/core/application';
import { AndroidActivityResultEventData } from '@nativescript/core/application/application-interfaces';
import { EventData, Observable } from '@nativescript/core/data/observable';
import { bind } from 'helpful-decorators';
import { BgService } from '~/services/BgService';
import { l, lc } from '~/helpers/locale';

let geolocation: GPS;

export const desiredAccuracy = global.isAndroid ? Enums.Accuracy.high : kCLLocationAccuracyBestForNavigation;
export const updateDistance = 0;
export const maximumAge = 3000;
export const timeout = 20000;
export const minimumUpdateTime = 0; // Should update every 1 second according ;
export type GeoLocation = GenericGeoLocation<LatLonKeys>;

export interface Session {
    lastLoc: GeoLocation;
    currentSpeed: number;
    averageSpeed: number;
    altitudeGain: number;
    altitudeNegative: number;
    distance: number;
    startTime: Date;
    lastPauseTime: Date;
    endTime: Date;
    pauseDuration: number;
    state: SessionState;
    locs: GeoLocation[];
}

export enum SessionState {
    STOPPED = 'stopped',
    RUNNING = 'running',
    PAUSED = 'paused'
}

// export type GeoLocation = GeoLocation;

export const SessionStateEvent = 'sessionState';
export const SessionChronoEvent = 'sessionChrono';
export const SessionUpdatedEvent = 'sessionUpdated';
export const GPSStatusChangedEvent = 'status';
export const SessionFirstPositionEvent = 'sessionFirstPosition';
export const UserLocationdEvent = 'userLocation';

interface GPSEvent extends EventData {
    data?: any;
}

export interface SessionEventData extends GPSEvent {
    data: Session;
}

export interface UserLocationdEventData extends GPSEvent {
    location?: GeoLocation;
    error?: Error;
}

export interface SessionChronoEventData extends GPSEvent {
    data: number; // chrono
}

export class GeoHandler extends Observable {
    watchId;
    bgService: WeakRef<BgService>;
    currentWatcher: Function;
    _isIOSBackgroundMode = false;
    _deferringUpdates = false;
    onUpdatedSession: Function;
    currentSession: Session;
    sessionState: SessionState = SessionState.STOPPED;
    lastLoc: GeoLocation;
    lastAlt: number;

    sessionsHistory: Session[] = JSON.parse(ApplicationSettings.getString('sessionsHistory', '[]'));
    launched = false;

    wasWatchingBeforePause = false;
    dontWatchWhilePaused = ApplicationSettings.getBoolean('stopGPSWhilePaused', false);
    gpsEnabled = true;

    constructor() {
        super();
        if (DEV_LOG) {
            console.log('creating GPS Handler', !!geolocation, DEV_LOG);
        }
        if (!geolocation) {
            geolocation = new GPS();
        }
        if (global.isAndroid) {
            if (androidApp.nativeApp) {
                this.appOnLaunch();
            } else {
                applicationOn(launchEvent, this.appOnLaunch, this);
            }
        }
        if (global.isIOS) {
            applicationOn(launchEvent, this.appOnLaunch, this);
        }
        applicationOn(suspendEvent, this.onAppPause, this);
        applicationOn(resumeEvent, this.onAppResume, this);
    }
    appOnLaunch() {
        if (this.launched) {
            return;
        }
        this.currentSession = JSON.parse(ApplicationSettings.getString('pausedSession', null));
        if (this.currentSession) {
            this.currentSession.startTime = new Date(this.currentSession.startTime);
            this.currentSession.lastPauseTime = new Date(this.currentSession.lastPauseTime);
            this.sessionState = SessionState.PAUSED;
            this.onUpdateSessionChrono();
        }
        this.launched = true;
        geolocation.on(GPS.gps_status_event, this.onGPSStateChange, this);
    }
    onAppResume(args: ApplicationEventData) {
        if (global.isIOS) {
            this._isIOSBackgroundMode = false;
            // For iOS applications, args.ios is UIApplication.
            if (DEV_LOG) {
                console.log('UIApplication: resumeEvent', this.isWatching());
            }
            if (this.currentSession) {
                // we need to restart
                this.stopWatch();
                this.startWatch();
            }
        }

        if (!this.currentSession) {
            if (this.wasWatchingBeforePause) {
                this.startWatch();
                this.wasWatchingBeforePause = false;
            } else if (this.isWatching()) {
                // if (global.isAndroid) {
                //     this.bgService.get().removeForeground();
                // }
            }
        }
    }
    onAppPause(args: ApplicationEventData) {
        if (global.isIOS) {
            this._isIOSBackgroundMode = true;
            // For iOS applications, args.ios is UIApplication.
            if (DEV_LOG) {
                console.log('UIApplication: suspendEvent', this.isWatching());
            }
            if (this.currentSession) {
                // we need to restart
                this.stopWatch();
                this.startWatch();
            }
        }
        if (!this.currentSession && this.isWatching()) {
            if (this.dontWatchWhilePaused) {
                this.wasWatchingBeforePause = true;
                this.stopWatch();
            } else {
                // if (global.isAndroid) {
                //     this.bgService.get().showForeground();
                // }
            }
        }
    }
    onAppExit(args: ApplicationEventData) {
        if (!this.launched) {
            return;
        }
        if (this.currentSession && this.currentSession.state !== SessionState.STOPPED && this.currentSession.distance > 0) {
            this.pauseSession();
            ApplicationSettings.setString('pausedSession', JSON.stringify(this.currentSession));
            this.currentSession = null; // to prevent storing in history

            // store paused session to start it again after
        }
        this.stopSession();
        this.launched = false;
        geolocation && geolocation.off(GPS.gps_status_event, this.onGPSStateChange, this);
        applicationOff(suspendEvent, this.onAppPause, this);
        applicationOff(resumeEvent, this.onAppResume, this);
    }

    stop() {
        return Promise.resolve().then(() => {
            if (this.currentSession && this.currentSession.state !== SessionState.STOPPED && this.currentSession.distance > 0) {
                this.pauseSession();
                // appSettings.setString('pausedSession', JSON.stringify(this.currentSession));
                this.currentSession = null; // to prevent storing in history
            }
            this.stopSession();
            this.launched = false;
            geolocation.off(GPS.gps_status_event, this.onGPSStateChange, this);
            applicationOff(suspendEvent, this.onAppPause, this);
            applicationOff(resumeEvent, this.onAppResume, this);
            // return this.dbHandler.stop();
        });
    }
    async start() {
        // this.currentSession = JSON.parse(appSettings.getString('pausedSession', null));
        // if (this.currentSession) {
        //     this.currentSession.startTime = new Date(this.currentSession.startTime);
        //     if (this.currentSession.lastPauseTime) {
        //         this.currentSession.lastPauseTime = new Date(this.currentSession.lastPauseTime);
        //     }
        //     this.sessionState = SessionState.PAUSED;
        //     this.onUpdateSessionChrono();
        // }
        this.launched = true;
        geolocation.on(GPS.gps_status_event, this.onGPSStateChange, this);
        applicationOn(suspendEvent, this.onAppPause, this);
        applicationOn(resumeEvent, this.onAppResume, this);

        const permCheck = await check('location');
        // set to true if not allowed yet for the UI
        this.gpsEnabled = permCheck[0] !== 'authorized' || geolocation.isEnabled();
    }

    onGPSStateChange(e: GPSEvent) {
        if (DEV_LOG) {
            console.log('GPS state change', e.data);
        }
        const enabled = (this.gpsEnabled = e.data.enabled);
        if (!enabled) {
            this.stopSession();
        }
        this.notify({
            eventName: GPSStatusChangedEvent,
            object: this,
            data: e.data
        });
    }

    askToEnableIfNotEnabled() {
        if (geolocation.isEnabled()) {
            return Promise.resolve(true);
        } else {
            return confirm({
                message: lc('gps_not_enabled'),
                okButtonText: lc('settings'),
                cancelButtonText: lc('cancel')
            }).then((result) => {
                if (!!result) {
                    return geolocation.openGPSSettings();
                }
                return Promise.reject();
            });
        }
    }
    async authorizeLocation() {
        const result = await request('location');
        if ((Array.isArray(result) && result[0] !== 'authorized') || Object.keys(result).some((s) => result[s] !== 'authorized')) {
            throw new Error('gps_denied');
        }
        this.gpsEnabled = geolocation.isEnabled();
        return result;
    }
    async checkEnabledAndAuthorized(always = false) {
        try {
            await check('location').then((r) => {
                if (r[0] !== 'authorized') {
                    return this.authorizeLocation();
                }
            });
            await this.askToEnableIfNotEnabled();
        } catch (err) {
            if (err && /denied/i.test(err.message)) {
                confirm({
                    message: lc('gps_not_authorized'),
                    okButtonText: lc('settings'),
                    cancelButtonText: lc('cancel')
                }).then((result) => {
                    if (result) {
                        geolocation.openGPSSettings().catch(() => {});
                    }
                });
                return Promise.reject();
            } else {
                return Promise.reject(err);
            }
        }
    }

    enableLocation() {
        return this.checkEnabledAndAuthorized();
    }

    isBatteryOptimized(context: android.content.Context) {
        const pwrm = context.getSystemService(android.content.Context.POWER_SERVICE) as android.os.PowerManager;
        const name = context.getPackageName();
        if (android.os.Build.VERSION.SDK_INT >= 23) {
            return !pwrm.isIgnoringBatteryOptimizations(name);
        }
        return false;
    }
    checkBattery() {
        if (global.isIOS) {
            return Promise.resolve();
        }
        const activity = androidApp.foregroundActivity || androidApp.startActivity;
        if (this.isBatteryOptimized(activity) && android.os.Build.VERSION.SDK_INT >= 22) {
            return new Promise<void>((resolve, reject) => {
                const REQUEST_CODE = 6645;
                const onActivityResultHandler = (data: AndroidActivityResultEventData) => {
                    if (data.requestCode === REQUEST_CODE) {
                        androidApp.off(AndroidApplication.activityResultEvent, onActivityResultHandler);
                        resolve();
                    }
                };
                androidApp.on(AndroidApplication.activityResultEvent, onActivityResultHandler);
                const intent = new android.content.Intent(android.provider.Settings.ACTION_REQUEST_IGNORE_BATTERY_OPTIMIZATIONS);
                intent.setData(android.net.Uri.parse('package:' + activity.getPackageName()));
                activity.startActivityForResult(intent, REQUEST_CODE);
            });
        }
        return Promise.resolve();
    }
    getLastKnownLocation(): GeoLocation {
        return LocationMonitor.getLastKnownLocation<LatLonKeys>();
    }

    async getLocation(options?) {
        try {
            const r = await geolocation.getCurrentLocation<LatLonKeys>({
                // provider: 'gps',
                minimumUpdateTime,
                desiredAccuracy,
                timeout,
                skipPermissionCheck: true,
                onDeferred: this.onDeferred,
                ...options
            });
            console.log('getLocation result', r);
            this.notify({
                eventName: UserLocationdEvent,
                object: this,
                location: r
            } as UserLocationdEventData);
            return r;
        } catch (err) {
            this.notify({
                eventName: UserLocationdEvent,
                object: this,
                error: err
            } as UserLocationdEventData);
            return Promise.reject(err);
        }
    }

    @bind
    onDeferred() {
        this._deferringUpdates = false;
    }
    @bind
    onLocation(loc: GeoLocation, manager?: any) {
        if (loc) {
            this.currentWatcher && this.currentWatcher(null, loc);
            this.notify({
                eventName: UserLocationdEvent,
                object: this,
                location: loc
            } as UserLocationdEventData);
        }
        if (manager && this._isIOSBackgroundMode && !this._deferringUpdates) {
            this._deferringUpdates = true;
            manager.allowDeferredLocationUpdatesUntilTraveledTimeout(0, 10);
        }
    }
    @bind
    onLocationError(err: Error) {
        if (DEV_LOG) {
            console.log(' location error: ', err);
        }
        this.currentWatcher && this.currentWatcher(err);
    }
    async startWatch(opts?: Partial<GeolocationOptions>) {
        const updateDistance = ApplicationSettings.getNumber('gps_update_distance', 0);
        const minimumUpdateTime = ApplicationSettings.getNumber('gps_update_minTime', 0);
        const desiredAccuracy = ApplicationSettings.getNumber('gps_desired_accuracy', global.isAndroid ? Enums.Accuracy.high : kCLLocationAccuracyBestForNavigation);
        const options: GeolocationOptions = {
            updateDistance,
            minimumUpdateTime,
            desiredAccuracy,
            onDeferred: this.onDeferred,
            nmeaAltitude: true,
            skipPermissionCheck: true,
            ...opts
        };
        if (DEV_LOG) {
            console.log('startWatch', options);
        }

        if (global.isIOS) {
            geolocation.iosChangeLocManager.showsBackgroundLocationIndicator = true;
            if (this._isIOSBackgroundMode) {
                options.pausesLocationUpdatesAutomatically = false;
                options.allowsBackgroundLocationUpdates = ApplicationSettings.getBoolean('gps_ios_allow_background', true);
            } else {
                options.pausesLocationUpdatesAutomatically = ApplicationSettings.getBoolean('gps_ios_auto_pause_updates', true);
                options.allowsBackgroundLocationUpdates = ApplicationSettings.getBoolean('gps_ios_allow_background', true);
            }
            options.activityType = ApplicationSettings.getNumber('gps_ios_activitytype', CLActivityType.Other);
        }
        if (global.isAndroid) {
            try {
                (this.bgService as any).get().showForeground(true);
            } catch (err) {
                console.error('showForeground', err, err['stack']);
            }
        }
        this.watchId = await geolocation.watchLocation(this.onLocation, this.onLocationError, options);
    }

    getWatchSettings() {
        const options = {
            gps_update_distance: {
                id: 'gps_update_distance',
                title: lc('gps_update_distance'),
                description: lc('gps_update_distance_desc'),
                type: 'prompt'
            },
            gps_desired_accuracy: {
                id: 'gps_desired_accuracy',
                title: lc('gps_desired_accuracy'),
                description: lc('gps_desired_accuracy_desc'),
                values: global.isIOS
                    ? [
                          { title: lc('best_for_navigation'), value: kCLLocationAccuracyBestForNavigation },
                          { title: lc('best'), value: kCLLocationAccuracyBest },
                          { title: '10m', value: kCLLocationAccuracyNearestTenMeters },
                          { title: '100m', value: kCLLocationAccuracyHundredMeters },
                          { title: '1km', value: kCLLocationAccuracyKilometer },
                          { title: '3km', value: kCLLocationAccuracyThreeKilometers },
                          { title: lc('reduced'), value: kCLLocationAccuracyReduced }
                      ]
                    : [
                          { title: lc('finer_location_accuracy'), value: Enums.Accuracy.high },
                          { title: lc('approximate_accuracy'), value: Enums.Accuracy.any }
                      ]
            }
        };
        if (global.isIOS) {
        } else {
            Object.assign(options, {
                gps_update_minTime: {
                    id: 'gps_update_minTime',
                    title: lc('gps_update_minTime'),
                    description: lc('gps_update_minTime_desc'),
                    type: 'prompt'
                }
            });
        }
        return {};
    }

    stopWatch() {
        if (DEV_LOG) {
            console.log('stopWatch', this.watchId);
        }
        if (this.watchId) {
            if (global.isAndroid) {
                (this.bgService as any).get().removeForeground();
            }
            geolocation.clearWatch(this.watchId);
            this.watchId = null;
            this.currentWatcher = null;
        }
    }

    isWatching() {
        return !!this.watchId;
    }

    getDistance(loc1, loc2) {
        return Math.round(geolocation.distance(loc1, loc2) * 1000) / 1000;
    }
    updateSessionWithLoc(loc: GeoLocation) {
        if (this.lastLoc === null && loc) {
            this.notify({
                eventName: SessionFirstPositionEvent,
                object: this,
                data: loc
            } as GPSEvent);
        }
        this.lastLoc = loc;
        if (!this.lastAlt) {
            this.lastAlt = loc.altitude;
        }
        this.currentSession.lastLoc = loc;
        const { android, ios, ...dataToStore } = loc;
        this.currentSession.locs.push(dataToStore);
        this.notify({
            eventName: SessionUpdatedEvent,
            object: this,
            data: this.currentSession
        } as SessionEventData);
        if (this.onUpdatedSession) {
            this.onUpdatedSession(this.currentSession);
        }
    }
    onNewLoc = (err, loc: GeoLocation) => {
        // ignore if we haven't moved or if same timestamp
        if (err || loc.horizontalAccuracy >= 40 || (this.lastLoc && ((this.lastLoc.lat === loc.lat && this.lastLoc.lon === loc.lon) || this.lastLoc.timestamp === loc.timestamp))) {
            return;
        }
        if (this.lastLoc) {
            let shouldNotif = false;
            const deltaDistance = this.getDistance(this.lastLoc, loc);
            const deltaTime = loc.timestamp.valueOf() - this.lastLoc.timestamp.valueOf();
            if (deltaTime < 0) {
                // impossible ... but happens on ios!!!!
                return;
            }
            if (deltaTime > maximumAge) {
                // very old last loc, let's make it as if it was the first one
                this.updateSessionWithLoc(loc);
                return;
            }

            // check for altitude change
            let deltaAlt = 0;
            if (this.lastAlt !== undefined && loc.altitude !== undefined && loc.altitude >= 0) {
                const newAlt = Math.round(loc.altitude);
                deltaAlt = newAlt - this.lastAlt;
                if (DEV_LOG) {
                    console.log('deltaAlt', deltaAlt, this.lastAlt, newAlt);
                }
                // we only look for positive altitude gain
                // we ignore little variations as it might induce wrong readings
                if (deltaAlt > 0) {
                    // filter not to constantly increase
                    this.currentSession.altitudeGain = Math.round(this.currentSession.altitudeGain + deltaAlt);
                    this.lastAlt = newAlt;
                    shouldNotif = true;
                } else if (deltaAlt < 0) {
                    this.currentSession.altitudeNegative = Math.round(this.currentSession.altitudeNegative - deltaAlt);
                    this.lastAlt = newAlt;
                }
            }

            // check for new speed
            let newSpeed;
            if (loc.speed >= 0) {
                newSpeed = loc.speed * 3.6; //  1m/s === 3.6 km/h
            } else {
                newSpeed = (deltaDistance / deltaTime) * 3600; // 1m/s === 3.6 km/h => 1m/ms === 1000m/s === 3600 km/h
                if (DEV_LOG) {
                    console.log('new speed based on points', newSpeed, deltaDistance, deltaTime);
                }
                loc.speed = newSpeed;
            }

            // newSpeed defined means we are still moving, should be taken into account then
            if (newSpeed !== this.currentSession.currentSpeed) {
                if (DEV_LOG) {
                    console.log('new loc based on speed', newSpeed, loc.speed);
                }
                // we also round the speed to 3 digits to prevent too small values
                this.currentSession.currentSpeed = Math.round(newSpeed * 1000) / 1000;
                shouldNotif = true;
            }

            if (deltaDistance > 2 || shouldNotif) {
                if (DEV_LOG) {
                    console.log('deltaDistance', deltaDistance, this.currentSession.distance);
                }
                this.currentSession.distance = this.currentSession.distance + deltaDistance;
                shouldNotif = true;
            }

            // wait to have a little more data to compugte / show average speed
            const sessionDuration = loc.timestamp.valueOf() - this.currentSession.startTime.valueOf() - this.currentSession.pauseDuration;
            if (DEV_LOG) {
                console.log('sessionDuration', sessionDuration);
            }
            if (DEV_LOG) {
                console.log('distance', this.currentSession.distance);
            }
            if (sessionDuration > 3000 && this.currentSession.distance > 10 && shouldNotif) {
                const newAvg = Math.round((this.currentSession.distance / sessionDuration) * 3600); // 1m/s === 3.6 km/h => 1m/ms === 1000m/s === 3600 km/h
                if (DEV_LOG) {
                    console.log('average Speed', newAvg);
                }
                if (newAvg !== this.currentSession.averageSpeed) {
                    this.currentSession.averageSpeed = newAvg;
                    // console.log('new loc based on avg', newAvg);
                    // shouldNotif = true;
                }
            }
            if (DEV_LOG) {
                console.log(
                    'onNewLoc',
                    `speed: ${loc.speed && loc.speed.toFixed(1)}, loc:${loc.lat.toFixed(2)},${loc.lon.toFixed(2)}, ${new Date(loc.timestamp).toLocaleTimeString()}, ${shouldNotif}, ${
                        this.currentSession.currentSpeed && this.currentSession.currentSpeed.toFixed(1)
                    }, ${deltaDistance}, ${deltaTime}, ${deltaAlt}`
                );
            }

            if (shouldNotif) {
                this.updateSessionWithLoc(loc);
            }
        } else {
            const deltaTime = Date.now() - loc.timestamp.valueOf();
            if (deltaTime > maximumAge) {
                // very old last loc, let's make it as if it was the first one
                return;
            }
            this.updateSessionWithLoc(loc);
        }
    };
    async askForSessionPerms() {
        await this.enableLocation();
        await this.checkBattery();
    }
    waitingForLocation() {
        return this.currentSession && this.currentSession.lastLoc === null;
    }
    startSession(onUpdate?: Function) {
        remove('pausedSession');
        if (this.currentSession) {
            return Promise.reject('already_running');
        }
        return this.enableLocation().then((r) => {
            this.currentSession = {
                lastLoc: null,
                state: SessionState.RUNNING,
                averageSpeed: 0,
                currentSpeed: 0,
                distance: 0,
                altitudeGain: 0,
                altitudeNegative: 0,
                startTime: new Date(),
                lastPauseTime: null,
                endTime: null,
                pauseDuration: 0,
                locs: []
            };
            // /* DEV-START */
            // this.currentSession.currentSpeed = 1.1;
            // this.currentSession.distance = 978;
            // this.currentSession.averageSpeed = 13.43;
            // this.currentSession.altitudeGain = 1345;
            /* DEV-END */

            // this.lastSpeeds = [];
            this.onUpdatedSession = onUpdate;
            this.startWatch();
            this.setSessionState(SessionState.RUNNING);
            this.startChronoTimer();
            return this.currentSession;
        });
    }
    isSessionRunning() {
        return !!this.currentSession;
    }
    getCurrentSession() {
        return this.currentSession;
    }
    getSessionsHistory() {
        return this.sessionsHistory;
    }
    setSessionState(state: SessionState) {
        this.sessionState = this.currentSession.state = state;
        this.notify({
            eventName: SessionStateEvent,
            object: this,
            data: this.currentSession
        } as SessionEventData);
    }

    prepareSessionForStoring(session: Session) {
        delete session.lastLoc;
        session.endTime = new Date();
        if (session.lastPauseTime) {
            session.pauseDuration += session.endTime.valueOf() - session.lastPauseTime.valueOf();
            session.lastPauseTime = null;
        }
        session.averageSpeed = Math.round((session.distance / (session.endTime.valueOf() - session.startTime.valueOf() - session.pauseDuration)) * 3600);
    }
    stopSession() {
        if (this.currentSession) {
            remove('pausedSession');
            this.stopWatch();

            if (this.currentSession.distance > 0) {
                this.prepareSessionForStoring(this.currentSession);
                this.sessionsHistory.push(this.currentSession);
                ApplicationSettings.setString('sessionsHistory', JSON.stringify(this.sessionsHistory));
            }
            this.setSessionState(SessionState.STOPPED);

            this.currentSession = null;
            this.onUpdatedSession = null;
        }
        this.stopChronoTimer();
    }
    pauseSession() {
        if (this.currentSession && this.sessionState !== SessionState.PAUSED) {
            this.currentSession.lastPauseTime = new Date();
            this.setSessionState(SessionState.PAUSED);
            this.lastLoc = null;
            this.stopWatch();
        }
        this.stopChronoTimer();
    }
    resumeSession() {
        if (this.currentSession && this.sessionState === SessionState.PAUSED) {
            this.currentSession.pauseDuration += Date.now() - this.currentSession.lastPauseTime.valueOf();
            this.currentSession.lastPauseTime = null;
            this.startWatch();
            this.setSessionState(SessionState.RUNNING);
        }
        this.startChronoTimer();
    }
    isSessionPaused() {
        return this.currentSession && this.sessionState === SessionState.PAUSED;
    }

    getCurrentSessionChrono() {
        if (this.currentSession) {
            if (this.currentSession.state === SessionState.PAUSED) {
                return this.currentSession.lastPauseTime.valueOf() - this.currentSession.startTime.valueOf() - this.currentSession.pauseDuration;
            }
            return Date.now() - this.currentSession.startTime.valueOf() - this.currentSession.pauseDuration;
        }
        return 0;
    }
    onUpdateSessionChrono() {
        this.notify({
            eventName: SessionChronoEvent,
            object: this,
            data: this.getCurrentSessionChrono()
        } as SessionChronoEventData);
    }
    private sessionChronoTimer;
    private startChronoTimer() {
        if (!this.sessionChronoTimer) {
            this.sessionChronoTimer = setInterval(() => {
                this.onUpdateSessionChrono();
            }, 1000);
            this.onUpdateSessionChrono();
        }
    }
    private stopChronoTimer() {
        if (this.sessionChronoTimer) {
            clearInterval(this.sessionChronoTimer);
            this.sessionChronoTimer = null;
        }
    }
}
