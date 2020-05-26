import { GeoLocation, GPS, Options as GeolocationOptions, setMockEnabled } from 'nativescript-gps';
import {$t} from '~/helpers/locale';
import { confirm } from 'nativescript-material-dialogs';
import Vue from 'nativescript-vue';
import { android as androidApp, ApplicationEventData, launchEvent, off as applicationOff, on as applicationOn, resumeEvent, suspendEvent } from '@nativescript/core/application';
import * as appSettings from '@nativescript/core/application-settings';
import { EventData, Observable } from '@nativescript/core/data/observable';
import { Accuracy } from '@nativescript/core/ui/enums/enums';
import { BgService } from '~/services/BgService';
import { clog, DEV_LOG } from '~/utils/logging';

let geolocation: GPS;

export let desiredAccuracy = gVars.isAndroid ? Accuracy.high : kCLLocationAccuracyBestForNavigation;
export let updateDistance = 1;
export let maximumAge = 3000;
export let timeout = 20000;
export let minimumUpdateTime = 1000; // Should update every 1 second according ;

setMockEnabled(true);

export interface Session {
    lastLoc: GeoLocation;
    currentSpeed: number;
    averageSpeed: number;
    altitudeGain: number;
    altitudeNegative: number;
    currentDistance: number;
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
    currentWatcher: Function;
    _isIOSBackgroundMode = false;
    _deferringUpdates = false;
    onUpdatedSession: Function;
    currentSession: Session;
    // paused = false;
    sessionState: SessionState = SessionState.STOPPED;
    lastLoc: GeoLocation;
    lastAlt: number;
    // lastSpeeds: number[];

    sessionsHistory: Session[] = JSON.parse(appSettings.getString('sessionsHistory', '[]'));
    // deltaDistance: number;
    launched = false;

    constructor() {
        super();
        if (DEV_LOG) {
            this.log('creating GPS Handler', !!geolocation, DEV_LOG);
        }
        if (!geolocation) {
            geolocation = new GPS();
            geolocation.debug = DEV_LOG;
        }
        if (gVars.isAndroid) {
            if (androidApp.nativeApp) {
                this.appOnLaunch();
            } else {
                applicationOn(launchEvent, this.appOnLaunch, this);
            }
        }
        if (gVars.isIOS) {
            // if (androidApp.nativeApp) {
            // this.appOnLaunch();
            // } else {
            applicationOn(launchEvent, this.appOnLaunch, this);
            // }
        }
        applicationOn(suspendEvent, this.onAppPause, this);
        applicationOn(resumeEvent, this.onAppResume, this);
        // applicationOn(exitEvent, this.onAppExit, this);
    }
    appOnLaunch() {
        if (this.launched) {
            return;
        }
        // this.log('appOnLaunch');
        this.currentSession = JSON.parse(appSettings.getString('pausedSession', null));
        if (this.currentSession) {
            // this.log('restore paused session', this.currentSession);
            this.currentSession.startTime = new Date(this.currentSession.startTime);
            this.currentSession.lastPauseTime = new Date(this.currentSession.lastPauseTime);
            this.sessionState = SessionState.PAUSED;
            this.onUpdateSessionChrono();
        }
        this.launched = true;
        geolocation.on(GPS.gps_status_event, this.onGPSStateChange, this);
    }
    log(...args) {
        clog('[GeoHandler]', ...args);
    }
    wasWatchingBeforePause = false;
    watcherBeforePause;
    dontWatchWhilePaused = true;
    onAppResume(args: ApplicationEventData) {
        if (gVars.isIOS) {
            this._isIOSBackgroundMode = false;
            // For iOS applications, args.ios is UIApplication.
            if (DEV_LOG) {
                this.log('UIApplication: resumeEvent', this.isWatching());
            }
            if (this.currentSession) {
                // we need to restart
                const watcher = this.currentWatcher;
                this.stopWatch();
                this.startWatch(watcher);
            }
        }

        if (!this.currentSession) {
            if (this.wasWatchingBeforePause) {
                this.startWatch(this.watcherBeforePause);
                this.watcherBeforePause = null;
                this.wasWatchingBeforePause = false;
            } else if (this.isWatching()) {
                if (gVars.isAndroid) {
                    (Vue.prototype.$bgService as BgService).bgService.get().removeForeground();
                }
            }
        }
    }
    onAppPause(args: ApplicationEventData) {
        if (gVars.isIOS) {
            this._isIOSBackgroundMode = true;
            // For iOS applications, args.ios is UIApplication.
            if (DEV_LOG) {
                this.log('UIApplication: suspendEvent', this.isWatching());
            }
            if (this.currentSession) {
                // we need to restart
                const watcher = this.currentWatcher;
                this.stopWatch();
                this.startWatch(watcher);
            }
        }
        if (!this.currentSession && this.isWatching()) {
            if (this.dontWatchWhilePaused) {
                this.watcherBeforePause = this.currentWatcher;
                this.wasWatchingBeforePause = true;
                this.stopWatch();
            } else {
                if (gVars.isAndroid) {
                    (Vue.prototype.$bgService as BgService).bgService.get().showForeground();
                }
            }
        }
    }
    onAppExit(args: ApplicationEventData) {
        if (!this.launched) {
            return;
        }
        if (this.currentSession && this.currentSession.state !== SessionState.STOPPED && this.currentSession.currentDistance > 0) {
            this.pauseSession();
            appSettings.setString('pausedSession', JSON.stringify(this.currentSession));
            this.currentSession = null; // to prevent storing in history

            // store paused session to start it again after
        }
        this.stopSession();
        this.launched = false;
        geolocation && geolocation.off(GPS.gps_status_event, this.onGPSStateChange, this);
        applicationOff(suspendEvent, this.onAppPause, this);
        applicationOff(resumeEvent, this.onAppResume, this);
    }
    onGPSStateChange(e: GPSEvent) {
        // if (DEV_LOG) {
        this.log('GPS state change', e.data);
        // }
        const enabled = e.data.enabled;
        if (!enabled) {
            this.stopSession();
        }
        this.notify({
            eventName: GPSStatusChangedEvent,
            object: this,
            data: e.data
        });
        // this.log('GPS state change done', enabled);
    }

    askToEnableIfNotEnabled() {
        if (geolocation.isEnabled()) {
            return Promise.resolve(true);
        } else {
            return confirm({
                // title: localize('stop_session'),
                message: $t('gps_not_enabled'),
                okButtonText: $t('settings'),
                cancelButtonText: $t('cancel')
            }).then(result => {
                if (DEV_LOG) {
                    this.log('askToEnableIfNotEnabled, confirmed', result);
                }
                if (!!result) {
                    return geolocation.openGPSSettings();
                }
                return Promise.reject();
            });
        }
    }
    checkEnabledAndAuthorized(always = true) {
        return Promise.resolve()
            .then(() =>
                geolocation.isAuthorized().then(r => {
                    if (!r) {
                        return geolocation.authorize(always);
                    } else {
                        return r;
                    }
                })
            )
            .then(() => {
                return this.askToEnableIfNotEnabled();
            })
            .catch(err => {
                if (err && /denied/i.test(err.message)) {
                    confirm({
                        // title: localize('stop_session'),
                        message: $t('gps_not_authorized'),
                        okButtonText: $t('settings'),
                        cancelButtonText: $t('cancel')
                    }).then(result => {
                        // this.log('stop_session, confirmed', result);
                        if (result) {
                            geolocation.openGPSSettings().catch(() => {});
                        }
                    });
                    return Promise.reject(undefined);
                } else {
                    return Promise.reject(err);
                }
            });
    }

    enableLocation() {
        // if (!geolocation.isEnabled()) {
        return this.checkEnabledAndAuthorized();
        // }
        // return Promise.resolve();
        // geolocation.isEnabled().then(
        //     function(isEnabled) {
        //         if (!isEnabled) {
        //             geolocation.enableLocationRequest().then(
        //                 function() {},
        //                 function(e) {
        //                     clog('Error: ' + (e.message || e));
        //                 }
        //             );
        //         }
        //     },
        //     function(e) {
        //         clog('Error: ' + (e.message || e));
        //     }
        // );
    }

    getLocation(options?) {
        return geolocation
            .getCurrentLocation(options || { desiredAccuracy, minimumUpdateTime, timeout, onDeferred: this.onDeferred })
            .then(r => {
                this.log('getLocation result', r);
                this.notify({
                    eventName: UserLocationdEvent,
                    object: this,
                    location: r
                } as UserLocationdEventData);
                return r;
            })
            .catch(err => {
                this.notify({
                    eventName: UserLocationdEvent,
                    object: this,
                    error: err
                } as UserLocationdEventData);
                return Promise.reject(err);
            });
    }

    onDeferred = () => {
        this._deferringUpdates = false;
    };
    onLocation = (loc: GeoLocation, manager?: any) => {
        this.log('Received location: ', loc);
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
    };
    onLocationError = (err: Error) => {
        if (DEV_LOG) {
            this.log(' location error: ', err);
        }
        this.currentWatcher && this.currentWatcher(err);
    };
    startWatch(onLoc?: Function) {
        this.currentWatcher = onLoc;
        const options: GeolocationOptions = { desiredAccuracy, minimumUpdateTime, onDeferred: this.onDeferred };
        // if (DEV_LOG) {
        // this.log('startWatch', options);
        // }
        if (gVars.isIOS) {
            if (this._isIOSBackgroundMode) {
                options.pausesLocationUpdatesAutomatically = false;
                options.allowsBackgroundLocationUpdates = true;
            } else {
                options.pausesLocationUpdatesAutomatically = true;
                options.allowsBackgroundLocationUpdates = true;
            }
        }

        geolocation.watchLocation(this.onLocation, this.onLocationError, options).then(r => (this.watchId = r));
    }

    stopWatch() {
        // if (DEV_LOG) {
        // this.log('stopWatch', this.watchId);
        // }
        if (this.watchId) {
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
        // clog('notifying session update', JSON.stringify(this.currentSession.lastLoc));
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
        // clog(
        //     'onNewLoc test',
        //     `${loc.speed && loc.speed.toFixed(1)}, loc:${loc.latitude.toFixed(2)},${loc.longitude.toFixed(2)}, ${loc.timestamp.toLocaleTimeString()}, ${loc.horizontalAccuracy}, ${
        //         loc.verticalAccuracy
        //     }`
        // );

        // ignore if we haven't moved or if same timestamp
        if (
            err ||
            loc.horizontalAccuracy >= 40 ||
            (this.lastLoc && ((this.lastLoc.latitude === loc.latitude && this.lastLoc.longitude === loc.longitude) || this.lastLoc.timestamp === loc.timestamp))
        ) {
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
                    // this.log('deltaAlt', deltaAlt, this.lastAlt, newAlt);
                }
                // we only look for positive altitude gain
                // we ignore little variations as it might induce wrong readings
                if (deltaAlt > 0) {
                    // clog('new loc based on altitude', deltaAlt, newAlt);
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
                    this.log('new speed based on points', newSpeed, deltaDistance, deltaTime);
                }
                loc.speed = newSpeed;
            }

            // newSpeed defined means we are still moving, should be taken into account then
            if (newSpeed !== this.currentSession.currentSpeed) {
                if (DEV_LOG) {
                    this.log('new loc based on speed', newSpeed, loc.speed);
                }
                // we also round the speed to 3 digits to prevent too small values
                this.currentSession.currentSpeed = Math.round(newSpeed * 1000) / 1000;
                shouldNotif = true;
            }

            if (deltaDistance > 2 || shouldNotif) {
                if (DEV_LOG) {
                    this.log('deltaDistance', deltaDistance, this.currentSession.currentDistance);
                }
                this.currentSession.currentDistance = this.currentSession.currentDistance + deltaDistance;
                shouldNotif = true;
            }

            // wait to have a little more data to compugte / show average speed
            const sessionDuration = loc.timestamp.valueOf() - this.currentSession.startTime.valueOf() - this.currentSession.pauseDuration;
            if (DEV_LOG) {
                this.log('sessionDuration', sessionDuration);
            }
            if (DEV_LOG) {
                this.log('currentDistance', this.currentSession.currentDistance);
            }
            if (sessionDuration > 3000 && this.currentSession.currentDistance > 10 && shouldNotif) {
                const newAvg = Math.round((this.currentSession.currentDistance / sessionDuration) * 3600); // 1m/s === 3.6 km/h => 1m/ms === 1000m/s === 3600 km/h
                if (DEV_LOG) {
                    this.log('average Speed', newAvg);
                }
                if (newAvg !== this.currentSession.averageSpeed) {
                    this.currentSession.averageSpeed = newAvg;
                    // clog('new loc based on avg', newAvg);
                    // shouldNotif = true;
                }
            }
            if (DEV_LOG) {
                this.log(
                    'onNewLoc',
                    `speed: ${loc.speed && loc.speed.toFixed(1)}, loc:${loc.latitude.toFixed(2)},${loc.longitude.toFixed(2)}, ${new Date(loc.timestamp).toLocaleTimeString()}, ${shouldNotif}, ${this
                        .currentSession.currentSpeed && this.currentSession.currentSpeed.toFixed(1)}, ${deltaDistance}, ${deltaTime}, ${deltaAlt}`
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

    waitingForLocation() {
        return this.currentSession && this.currentSession.lastLoc === null;
    }
    startSession(onUpdate?: Function) {
        appSettings.remove('pausedSession');
        if (this.currentSession) {
            return Promise.reject('already_running');
        }
        return this.enableLocation().then(r => {
            this.currentSession = {
                lastLoc: null,
                state: SessionState.RUNNING,
                averageSpeed: 0,
                currentSpeed: 0,
                currentDistance: 0,
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
            // this.currentSession.currentDistance = 978;
            // this.currentSession.averageSpeed = 13.43;
            // this.currentSession.altitudeGain = 1345;
            /* DEV-END */

            // this.lastSpeeds = [];
            this.onUpdatedSession = onUpdate;
            this.startWatch(this.onNewLoc);
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
        session.averageSpeed = Math.round((session.currentDistance / (session.endTime.valueOf() - session.startTime.valueOf() - session.pauseDuration)) * 3600);
    }
    stopSession() {
        if (this.currentSession) {
            appSettings.remove('pausedSession');
            this.stopWatch();

            if (this.currentSession.currentDistance > 0) {
                this.prepareSessionForStoring(this.currentSession);
                this.sessionsHistory.push(this.currentSession);
                appSettings.setString('sessionsHistory', JSON.stringify(this.sessionsHistory));
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
            this.startWatch(this.onNewLoc);
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
