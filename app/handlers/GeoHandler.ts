import { GPS, GenericGeoLocation, Options as GeolocationOptions } from '@nativescript-community/gps';
import { check, isPermResultAuthorized, request } from '@nativescript-community/perms';
import { confirm } from '@nativescript-community/ui-material-dialogs';
import { AndroidActivityResultEventData, AndroidApplication, Application, ApplicationEventData, ApplicationSettings, CoreTypes, EventData, Utils } from '@nativescript/core';
import { SDK_VERSION } from '@nativescript/core/utils';
import { bind } from 'helpful-decorators/dist-src/bind';
import { convertDurationSeconds, formatDistance } from '~/helpers/formatter';
import { lc } from '~/helpers/locale';
import type { BgService as AndroidBgService } from '~/services/android/BgService';
import { BgServiceCommon } from '~/services/BgService.common';
import { Handler } from './Handler';

let geolocation: GPS;

export const desiredAccuracy = __ANDROID__ ? CoreTypes.Accuracy.high : kCLLocationAccuracyBestForNavigation;
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

const TAG = '[GeoHandler]';

export class GeoHandler extends Handler {
    watchId;
    currentWatcher: Function;
    _isIOSBackgroundMode = false;
    _deferringUpdates = false;
    onUpdatedSession: Function;
    currentSession: Session;
    sessionState: SessionState = SessionState.STOPPED;
    lastLoc: GeoLocation;
    lastAlt: number;

    sessionsHistory: Session[] = JSON.parse(ApplicationSettings.getString('sessionsHistory', '[]'));
    started = false;

    wasWatchingBeforePause = false;
    get stopGpsBackground() {
        return ApplicationSettings.getBoolean('stop_gps_background', true);
    }
    gpsEnabled = true;

    constructor(service: BgServiceCommon) {
        super(service);
        if (!geolocation) {
            geolocation = new GPS();
        }
    }
    onAppResume(args: ApplicationEventData) {
        if (__IOS__) {
            this._isIOSBackgroundMode = false;
            // For iOS applications, args.ios is UIApplication.

            DEV_LOG && console.log('UIApplication: foregroundEvent', this.isWatching());
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
                if (__ANDROID__) {
                    const backgroundUpdateTime = ApplicationSettings.getNumber('gps_background_update_minTime', minimumUpdateTime);
                    const updateTime = ApplicationSettings.getNumber('gps_update_minTime', minimumUpdateTime);
                    if (backgroundUpdateTime !== updateTime) {
                        this.stopWatch();
                        this.startWatch();
                    }
                    (this.service.bgService as WeakRef<AndroidBgService>).get().removeForeground();
                }
            }
        }
    }
    onAppPause(args: ApplicationEventData) {
        if (__IOS__) {
            this._isIOSBackgroundMode = true;
            // For iOS applications, args.ios is UIApplication.
            DEV_LOG && console.log('UIApplication: backgroundEvent', this.isWatching());
            if (this.currentSession) {
                // we need to restart
                this.stopWatch();
                this.startWatch();
            }
        }
        if (!this.currentSession && this.isWatching()) {
            if (this.stopGpsBackground) {
                this.wasWatchingBeforePause = true;
                this.stopWatch();
            } else {
                if (__ANDROID__) {
                    const backgroundUpdateTime = ApplicationSettings.getNumber('gps_background_update_minTime', minimumUpdateTime);
                    const updateTime = ApplicationSettings.getNumber('gps_update_minTime', minimumUpdateTime);
                    if (backgroundUpdateTime !== updateTime) {
                        this.stopWatch();
                        this.startWatch({
                            minimumUpdateTime: backgroundUpdateTime
                        })
                    }
                    (this.service.bgService as WeakRef<AndroidBgService>).get().showForeground(true);
                }
            }
        }
    }

    async stop() {
        if (!this.started) {
            return;
        }
        this.started = false;
        geolocation.off(GPS.gps_status_event, this.onGPSStateChange, this);
        Application.off(Application.backgroundEvent, this.onAppPause, this);
        Application.off(Application.foregroundEvent, this.onAppResume, this);

        if (this.currentSession && this.currentSession.state !== SessionState.STOPPED && this.currentSession.distance > 0) {
            this.pauseSession();
            ApplicationSettings.setString('pausedSession', JSON.stringify(this.currentSession));
            this.currentSession = null; // to prevent storing in history
        }
        this.stopSession();
    }
    async start() {
        if (this.started) {
            return;
        }
        this.currentSession = JSON.parse(ApplicationSettings.getString('pausedSession', null));
        if (this.currentSession) {
            this.currentSession.startTime = new Date(this.currentSession.startTime);
            this.currentSession.lastPauseTime = new Date(this.currentSession.lastPauseTime);
            this.sessionState = SessionState.PAUSED;
            this.onUpdateSessionChrono();
        }
        DEV_LOG && console.log(TAG, 'start');
        this.started = true;
        geolocation.on(GPS.gps_status_event, this.onGPSStateChange, this);
        Application.on(Application.backgroundEvent, this.onAppPause, this);
        Application.on(Application.foregroundEvent, this.onAppResume, this);

        const permCheck = await check('location');
        // set to true if not allowed yet for the UI
        this.gpsEnabled = permCheck[0] !== 'authorized' || geolocation.isEnabled();
    }

    onGPSStateChange(e: GPSEvent) {
        TEST_LOG && console.log('GPS state change', e.data);
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
        if (!isPermResultAuthorized(result)) {
            throw new Error(lc('missing_location_permission'));
        }
        this.gpsEnabled = geolocation.isEnabled();
        return result;
    }
    async checkEnabledAndAuthorized(always = false) {
        try {
            await this.authorizeLocation();
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
        if (SDK_VERSION >= 23) {
            return !pwrm.isIgnoringBatteryOptimizations(name);
        }
        return false;
    }
    checkBattery() {
        if (__IOS__) {
            return Promise.resolve();
        }
        const activity = Application.android.startActivity;
        if (this.isBatteryOptimized(activity) && android.os.Build.VERSION.SDK_INT >= 22) {
            return new Promise<void>((resolve, reject) => {
                const REQUEST_CODE = 6645;
                const onActivityResultHandler = (data: AndroidActivityResultEventData) => {
                    if (data.requestCode === REQUEST_CODE) {
                        Application.android.off(AndroidApplication.activityResultEvent, onActivityResultHandler);
                        resolve();
                    }
                };
                Application.android.on(AndroidApplication.activityResultEvent, onActivityResultHandler);
                const intent = new android.content.Intent(android.provider.Settings.ACTION_REQUEST_IGNORE_BATTERY_OPTIMIZATIONS);
                intent.setData(android.net.Uri.parse('package:' + activity.getPackageName()));
                activity.startActivityForResult(intent, REQUEST_CODE);
            });
        }
        return Promise.resolve();
    }
    getLastKnownLocation(): GeoLocation {
        return geolocation.getLastKnownLocation<LatLonKeys>();
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
        // if (DEV_LOG) {
        //     console.log('onLocation', loc);
        // }
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
        TEST_LOG && console.log(' location error: ', err);
        this.currentWatcher && this.currentWatcher(err);
    }
    async startWatch(opts?: Partial<GeolocationOptions>) {
        const options: GeolocationOptions = {
            // provider: 'gps',
            updateDistance: ApplicationSettings.getNumber('gps_update_distance', updateDistance),
            minimumUpdateTime: ApplicationSettings.getNumber('gps_update_minTime', minimumUpdateTime),
            desiredAccuracy: ApplicationSettings.getNumber('gps_desired_accuracy', desiredAccuracy),
            onDeferred: this.onDeferred,
            nmeaAltitude: true,
            skipPermissionCheck: true,
            ...opts
        };
        TEST_LOG && console.log('startWatch', JSON.stringify(options));

        if (__IOS__) {
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

        this.watchId = await geolocation.watchLocation(this.onLocation, this.onLocationError, options);
    }
    IOS_ACCURACIES = __IOS__
        ? {
              [kCLLocationAccuracyBestForNavigation]: lc('best_for_navigation'),
              [kCLLocationAccuracyBest]: lc('best'),
              [kCLLocationAccuracyNearestTenMeters]: '10m',
              [kCLLocationAccuracyHundredMeters]: '100m',
              [kCLLocationAccuracyKilometer]: '1km',
              [kCLLocationAccuracyThreeKilometers]: '3km',
              [kCLLocationAccuracyReduced]: lc('reduced')
          }
        : undefined;
    getWatchSettings() {
        const options = {
            stop_gps_background: {
                title: lc('stop_gps_background'),
                description: lc('stop_gps_background_desc'),
                value: this.stopGpsBackground,
                type: 'switch'
            },
            gps_update_distance: {
                title: lc('gps_update_distance'),
                description: lc('gps_update_distance_desc'),
                value: () => ApplicationSettings.getNumber('gps_update_distance', updateDistance),
                default: updateDistance,
                type: 'prompt',
                formatter: formatDistance
            },
            gps_desired_accuracy: {
                title: lc('gps_desired_accuracy'),
                description: lc('gps_desired_accuracy_desc'),
                default: desiredAccuracy,
                value: () => ApplicationSettings.getNumber('gps_desired_accuracy', desiredAccuracy),
                formatter: __ANDROID__
                    ? formatDistance
                    : (k) => {
                          return this.IOS_ACCURACIES[k];
                      },
                type: __ANDROID__ ? 'prompt' : undefined,
                values: __IOS__
                    ? Object.keys(this.IOS_ACCURACIES)
                          .map((k) => ({
                              value: parseFloat(k),
                              title: this.IOS_ACCURACIES[k]
                          }))
                          .sort((a, b) => a.value - b.value)
                    : undefined
            }
        };
        if (__IOS__) {
        } else {
            Object.assign(options, {
                gps_update_minTime: {
                    title: lc('gps_update_minTime'),
                    description: lc('gps_update_minTime_desc'),
                    default: minimumUpdateTime,
                    value: () => ApplicationSettings.getNumber('gps_update_minTime', minimumUpdateTime),
                    formatter: (n) => convertDurationSeconds(n / 1000, 's[s]'),
                    type: 'prompt'
                },
                gps_background_update_minTime: {
                    title: lc('gps_background_update_minTime'),
                    description: lc('gps_background_update_minTime_desc'),
                    default: minimumUpdateTime,
                    value: () => ApplicationSettings.getNumber('gps_background_update_minTime', minimumUpdateTime),
                    formatter: (n) => convertDurationSeconds(n / 1000, 's[s]'),
                    type: 'prompt'
                }
            });
        }
        return options;
    }

    stopWatch() {
        TEST_LOG && console.log('stopWatch', this.watchId);
        if (this.watchId) {
            if (__ANDROID__) {
                (this.service.bgService as WeakRef<AndroidBgService>).get().removeForeground();
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

    async askForSessionPerms() {
        await this.enableLocation();
        await this.checkBattery();
    }
    waitingForLocation() {
        return this.currentSession && this.currentSession.lastLoc === null;
    }
    startSession(onUpdate?: Function) {
        // remove('pausedSession');
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
            // remove('pausedSession');
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

let androidLocationManager: android.location.LocationManager;

declare class IGPSStatusCallback extends android.location.GnssStatus.Callback {
    constructor(listener);
}
let GPSStatusCallback: typeof IGPSStatusCallback;

function getAndroidLocationManager(): android.location.LocationManager {
    if (!androidLocationManager) {
        androidLocationManager = Utils.android.getApplicationContext().getSystemService(android.content.Context.LOCATION_SERVICE) as android.location.LocationManager;
    }
    return androidLocationManager;
}

function initGPSStatusCallback() {
    if (!GPSStatusCallback) {
        @NativeClass
        class GPSStatusCallbackImpl extends android.location.GnssStatus.Callback {
            constructor(private listener: (sats) => void) {
                super();
                return global.__native(this);
            }
            onSatelliteStatusChanged(status: android.location.GnssStatus) {
                const count = status.getSatelliteCount();
                const sats = [];
                for (let index = 0; index < count; index++) {
                    const cid = status.getConstellationType(index);
                    let svid = status.getSvid(index);
                    // console.log('cid', cid, svid);
                    if (cid === 3) svid += 65;
                    if (cid === 5) svid += 200;
                    if (cid === 6) svid += 300;
                    sats.push({
                        constellationType: status.getConstellationType(index),
                        azimuth: status.getAzimuthDegrees(index),
                        elevation: status.getElevationDegrees(index),
                        snr: status.getCn0DbHz(index),
                        usedInFix: status.usedInFix(index),
                        nmeaID: svid
                    });
                }
                this.listener(sats);
            }
        }
        GPSStatusCallback = GPSStatusCallbackImpl as any;
    }
    return GPSStatusCallback;
}

let satlistener;
export function listenForGpsStatus(listener) {
    const locationManager = getAndroidLocationManager();
    if (SDK_VERSION > 24) {
        initGPSStatusCallback();
        satlistener = new GPSStatusCallback(listener);
        locationManager.registerGnssStatusCallback(satlistener);
    } else {
        satlistener = new android.location.GpsStatus.Listener({
            onGpsStatusChanged(s) {
                const status = locationManager.getGpsStatus(null);
                const sats = status.getSatellites();
                const res = [];
                const it = sats.iterator();
                while (it.hasNext()) {
                    const sat = it.next();
                    const nmeaID = sat.getPrn();
                    let constellationType = 0;
                    if (nmeaID <= 32) {
                        constellationType = 1; // GPS
                    } else if (nmeaID <= 54) {
                        constellationType = 2; // SBAS
                    } else if (nmeaID <= 64) {
                        // most likely an extended SBAS range, display the lower range, too
                        constellationType = 2; // SBAS
                    } else if (nmeaID <= 96) {
                        constellationType = 3; // GLONASS
                    } else if (nmeaID <= 192) {
                    } else if (nmeaID <= 200) {
                        constellationType = 4; // QZSS
                    } else if (nmeaID <= 235) {
                        constellationType = 5; // Beidou
                    } else if (nmeaID <= 300) {
                    } else if (nmeaID <= 336) {
                        constellationType = 6; // Galileo
                    }
                    res.push({
                        azimuth: sat.getAzimuth(),
                        elevation: sat.getElevation(),
                        snr: sat.getSnr(),
                        nmeaID,
                        constellationType,
                        usedInFix: sat.usedInFix()
                    });
                }
                listener(res);
            }
        });
        locationManager.addGpsStatusListener(satlistener);
    }
}
export function stopListenForGpsStatus() {
    if (satlistener) {
        const locationManager = getAndroidLocationManager();
        if (SDK_VERSION > 24) {
            locationManager.unregisterGnssStatusCallback(satlistener);
        } else {
            locationManager.removeGpsStatusListener(satlistener);
        }
        satlistener = null;
    }
}
