import { EventData, Observable } from 'tns-core-modules/data/observable';
import * as appSettings from 'tns-core-modules/application-settings';
import { ApplicationEventData, exitEvent, on as applicationOn, resumeEvent, suspendEvent } from 'tns-core-modules/application';
import * as geolocation from 'nativescript-gps';
import { Accuracy } from 'tns-core-modules/ui/enums/enums';
import { isAndroid } from 'platform';
import { confirm } from 'nativescript-material-dialogs';
import { localize } from 'nativescript-localize';
import { clog } from '~/utils/logging';

export let desiredAccuracy = isAndroid ? Accuracy.high : kCLLocationAccuracyBestForNavigation;
export let updateDistance = 1;
export let maximumAge = 60000;
export let timeout = 20000;
export let minimumUpdateTime = 1000; // Should update every 1 second according ;

geolocation.setGPSDebug(true);
geolocation.setMockEnabled(true);

function mean(array) {
    return (
        array.reduce(function(p, c) {
            return p + c;
        }) / array.length
    );
}
export interface Session {
    lastLoc: geolocation.GeoLocation;
    currentSpeed: number;
    averageSpeed: number;
    altitudeGain: number;
    currentDistance: number;
    startTime: Date;
    lastPauseTime: Date;
    endTime: Date;
    pauseDuration: number;
    state: SessionState;
    locs: geolocation.GeoLocation[];
}

export enum SessionState {
    STOPPED,
    RUNNING,
    PAUSED
}

export type GeoLocation = geolocation.GeoLocation;

export const SessionStateEvent = 'sessionState';
export const SessionChronoEvent = 'sessionChrono';
export const SessionUpdatedEvent = 'sessionUpdated';
export const UserLocationdEvent = 'userLocation';
export interface SessionEventData extends EventData {
    data: Session;
}
export interface UserLocationdEventData extends EventData {
    location?: geolocation.GeoLocation;
    error?: Error;
}

export interface SessionChronoEventData extends EventData {
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
    lastLoc: geolocation.GeoLocation;
    lastAlt: number;
    // lastSpeeds: number[];

    sessionsHistory: Session[] = JSON.parse(appSettings.getString('sessionsHistory', '[]'));
    // deltaDistance: number;
    constructor() {
        super();
        applicationOn(suspendEvent, (args: ApplicationEventData) => {
            if (args.ios) {
                this._isIOSBackgroundMode = true;
                // For iOS applications, args.ios is UIApplication.
                clog('UIApplication: suspendEvent');
                if (this.isWatching()) {
                    const watcher = this.currentWatcher;
                    this.stopWatch();
                    this.startWatch(watcher);
                }
            }
        });
        applicationOn(resumeEvent, (args: ApplicationEventData) => {
            if (args.ios) {
                this._isIOSBackgroundMode = false;
                // For iOS applications, args.ios is UIApplication.
                clog('UIApplication: resumeEvent');
                if (this.isWatching()) {
                    const watcher = this.currentWatcher;
                    this.stopWatch();
                    this.startWatch(watcher);
                }
            }
        });

        applicationOn(exitEvent, (args: ApplicationEventData) => {
            this.stopSession();
        });
    }

    askToEnableIfNotEnabled() {
        if (geolocation.isEnabled()) {
            return true;
        } else {
            confirm({
                // title: localize('stop_session'),
                message: localize('gps_not_enabled'),
                okButtonText: localize('settings'),
                cancelButtonText: localize('cancel')
            }).then(result => {
                // clog('stop_session, confirmed', result );
                if (result) {
                    geolocation.openGPSSettings();
                }
            });
            return false;
        }
    }
    checkEnabledAndAuthorized(always = true) {
        return Promise.resolve()
            .then(() => {
                if (!geolocation.isAuthorized()) {
                    clog('calling authorize', always);
                    return geolocation.authorize(always);
                }
            })
            .then(() => {
                const result = this.askToEnableIfNotEnabled();
                if (!result) {
                    return Promise.reject(undefined); // reject without error not to alert as it is normal (we are asking the user to enable gps)
                }
            })
            .catch(err => {
                if (err && /denied/i.test(err.message)) {
                    confirm({
                        // title: localize('stop_session'),
                        message: localize('gps_not_authorized'),
                        okButtonText: localize('settings'),
                        cancelButtonText: localize('cancel')
                    }).then(result => {
                        // clog('stop_session, confirmed', result );
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

    getLocation() {
        return this.getCurrentLocation();
    }

    onDeferred = () => {
        this._deferringUpdates = false;
    }
    onLocation = (loc: geolocation.GeoLocation, manager?: any) => {
        if (loc) {
            // clog('Received location: ', loc);
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
    onLocationError = (err: Error) => {
        this.currentWatcher(err);
        this.notify({
            eventName: UserLocationdEvent,
            object: this,
            error: err
        } as UserLocationdEventData);
    }
    startWatch(onLoc?: Function) {
        // clog('startWatch');
        this.currentWatcher = onLoc;
        if (this.watchId) {
            return;
        }
        const options: geolocation.Options = { desiredAccuracy, maximumAge, timeout, onDeferred: this.onDeferred };
        if (this._isIOSBackgroundMode) {
            options.pausesLocationUpdatesAutomatically = false;
            options.allowsBackgroundLocationUpdates = true;
        } else {
            options.pausesLocationUpdatesAutomatically = true;
            options.allowsBackgroundLocationUpdates = true;
        }
        this.watchId = geolocation.watchLocation(this.onLocation, this.onLocationError, options);
    }

    stopWatch() {
        // clog('stopWatch', this.watchId);
        if (this.watchId) {
            geolocation.clearWatch(this.watchId);
            this.watchId = null;
            this.currentWatcher = null;
        }
    }

    isWatching() {
        return !!this.watchId;
    }

    getCurrentLocation(options?) {
        return geolocation
            .getCurrentLocation(options || { desiredAccuracy, minimumUpdateTime, timeout, onDeferred: this.onDeferred })
            .then(r => {
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

    getDistance(loc1, loc2) {
        const result = geolocation.distance(loc1, loc2);
        return result;
    }
    updateSessionWithLoc(loc: geolocation.GeoLocation) {
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
    onNewLoc = (err, loc: geolocation.GeoLocation) => {
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
                // clog('deltaAlt', deltaAlt, this.lastAlt, newAlt);
                // we only look for positive altitude gain
                if (deltaAlt >= 3) {
                    // clog('new loc based on altitude', deltaAlt, newAlt);
                    // filter not to constantly increase
                    this.currentSession.altitudeGain = Math.round(this.currentSession.altitudeGain + Math.max(deltaAlt, 0));
                    this.lastAlt = newAlt;
                    shouldNotif = true;
                }
            }

            // check for new speed
            let newSpeed;
            if (loc.speed >= 0) {
                newSpeed = Math.round(loc.speed * 3.6); //  1m/s === 3.6 km/h
            } else {
                newSpeed = Math.round((deltaDistance / deltaTime) * 3600); // 1m/s === 3.6 km/h => 1m/ms === 1000m/s === 3600 km/h
                loc.speed = newSpeed;
            }

            // newSpeed defined means we are still moving, should be taken into account then
            if (newSpeed !== this.currentSession.currentSpeed) {
                // clog('new loc based on speed', newSpeed, loc.speed);
                this.currentSession.currentSpeed = newSpeed;
                shouldNotif = true;
            }

            if (deltaDistance > 2 || shouldNotif) {
                // clog('deltaDistance', deltaDistance, this.currentSession.currentDistance);
                this.currentSession.currentDistance = this.currentSession.currentDistance + deltaDistance;
                shouldNotif = true;
            }

            // m/ms
            const newAvg = Math.round((this.currentSession.currentDistance / (loc.timestamp.valueOf() - this.currentSession.startTime.valueOf() - this.currentSession.pauseDuration)) * 3600); // 1m/s === 3.6 km/h => 1m/ms === 1000m/s === 3600 km/h
            if (newAvg !== this.currentSession.averageSpeed) {
                this.currentSession.averageSpeed = newAvg;
                // clog('new loc based on avg', newAvg);
                shouldNotif = true;
            }

            clog(
                'onNewLoc',
                `speed: ${loc.speed && loc.speed.toFixed(1)}, loc:${loc.latitude.toFixed(2)},${loc.longitude.toFixed(2)}, ${loc.timestamp.toLocaleTimeString()}, ${shouldNotif}, ${this.currentSession
                    .currentSpeed && this.currentSession.currentSpeed.toFixed(1)}, ${deltaDistance}, ${deltaTime}, ${deltaAlt}`
            );
            if (shouldNotif) {
                this.updateSessionWithLoc(loc);
            }
        } else {
            this.updateSessionWithLoc(loc);
        }
    }
    startSession(onUpdate?: Function) {
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
                startTime: new Date(),
                lastPauseTime: null,
                endTime: null,
                pauseDuration: 0,
                locs: []
            };
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
    stopSession() {
        if (this.currentSession) {
            this.stopWatch();

            if (this.currentSession.currentDistance > 0) {
                delete this.currentSession.lastLoc;
                if (this.currentSession.lastPauseTime) {
                    this.currentSession.pauseDuration += Date.now() - this.currentSession.lastPauseTime.valueOf();
                    this.currentSession.lastPauseTime = null;
                }
                this.currentSession.endTime = new Date();
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
    onUpdateSessionChrono() {
        this.notify({
            eventName: SessionChronoEvent,
            object: this,
            data: Date.now() - this.currentSession.startTime.valueOf() - this.currentSession.pauseDuration
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
