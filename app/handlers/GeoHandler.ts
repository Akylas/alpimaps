import { EventData, Observable } from 'tns-core-modules/data/observable';
import * as appSettings from 'tns-core-modules/application-settings';
import { ApplicationEventData, on as applicationOn, resumeEvent, suspendEvent } from 'tns-core-modules/application';
import { Accuracy } from 'tns-core-modules/ui/enums/enums';
import { isAndroid } from 'platform';
import { confirm } from 'nativescript-material-dialogs';
import { localize } from 'nativescript-localize';
import { clog, DEV_LOG } from '~/utils/logging';

import { GeoLocation, GPS, Options as GeolocationOptions, setMockEnabled } from 'nativescript-gps';
let geolocation: GPS;

export let desiredAccuracy = isAndroid ? Accuracy.high : kCLLocationAccuracyBestForNavigation;
export let updateDistance = 1;
export let maximumAge = 3000;
export let timeout = 20000;
export let minimumUpdateTime = 1000; // Should update every 1 second according ;

setMockEnabled(true);

// function mean(array) {
//     return (
//         array.reduce(function(p, c) {
//             return p + c;
//         }) / array.length
//     );
// }
export interface Session {
    lastLoc: GeoLocation;
    currentSpeed: number;
    averageSpeed: number;
    altitudeGain: number;
    currentDistance: number;
    startTime: Date;
    lastPauseTime: Date;
    endTime: Date;
    pauseDuration: number;
    state: SessionState;
    locs: GeoLocation[];
}

export enum SessionState {
    STOPPED,
    RUNNING,
    PAUSED
}

export type GeoLocation = GeoLocation;

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
    constructor() {
        super();
        clog('creating GPS Handler', !!geolocation, DEV_LOG);
        if (!geolocation) {
            geolocation = new GPS();
            geolocation.debug = DEV_LOG;
        }
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

        geolocation.on(GPS.gps_status_event, (e: GPSEvent) => {
            const enabled = e.data.enabled;
            clog('GPS state change', enabled);
            if (!enabled) {
                this.stopSession();
            }
            this.notify({
                eventName: GPSStatusChangedEvent,
                object: this,
                data: e['data']
            });
        });

        // applicationOn(exitEvent, (args: ApplicationEventData) => {
        //     this.stopSession();
        // });
    }

    askToEnableIfNotEnabled() {
        if (geolocation.isEnabled()) {
            return Promise.resolve();
        } else {
            return confirm({
                // title: localize('stop_session'),
                message: localize('gps_not_enabled'),
                okButtonText: localize('settings'),
                cancelButtonText: localize('cancel')
            }).then(result => {
                clog('askToEnableIfNotEnabled, confirmed', result);
                if (!!result) {
                    return geolocation.openGPSSettings();
                }
                return Promise.reject();
            });
        }
    }
    checkEnabledAndAuthorized(always = true) {
        return Promise.resolve()
            .then(() => {
                return geolocation.isAuthorized().then(r => {
                    if (!r) {
                        return geolocation.authorize(always);
                    } else {
                        return r;
                    }
                });
            })
            .then(didAuthorize => {
                return this.askToEnableIfNotEnabled();
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

    getLocation(options?) {
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

    onDeferred = () => {
        this._deferringUpdates = false;
    }
    onLocation = (loc: GeoLocation, manager?: any) => {
        // clog('Received location: ', loc);
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
    onLocationError = (err: Error) => {
        clog(' location error: ', err);
        this.currentWatcher && this.currentWatcher(err);
    }
    startWatch(onLoc?: Function) {
        this.currentWatcher = onLoc;
        const options: GeolocationOptions = { desiredAccuracy, minimumUpdateTime, onDeferred: this.onDeferred };
        clog('startWatch', options);
        if (!isAndroid) {
            if (this._isIOSBackgroundMode) {
                options.pausesLocationUpdatesAutomatically = false;
                options.allowsBackgroundLocationUpdates = true;
            } else {
                options.pausesLocationUpdatesAutomatically = true;
                options.allowsBackgroundLocationUpdates = true;
            }
        }
        geolocation.watchLocation(this.onLocation, this.onLocationError, options).then(id => (this.watchId = id));
    }

    stopWatch() {
        clog('stopWatch', this.watchId);
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
        //     `${loc.speed && loc.speed.toFixed(1)}, loc:${loc.lat.toFixed(2)},${loc.lon.toFixed(2)}, ${loc.timestamp.toLocaleTimeString()}, ${loc.horizontalAccuracy}, ${
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
                clog('deltaAlt', deltaAlt, this.lastAlt, newAlt);
                // we only look for positive altitude gain
                // we ignore little variations as it might induce wrong readings
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
                newSpeed = loc.speed * 3.6; //  1m/s === 3.6 km/h
            } else {
                newSpeed = (deltaDistance / deltaTime) * 3600; // 1m/s === 3.6 km/h => 1m/ms === 1000m/s === 3600 km/h
                clog('new speed based on points', newSpeed, deltaDistance, deltaTime);
                loc.speed = newSpeed;
            }

            // newSpeed defined means we are still moving, should be taken into account then
            if (newSpeed !== this.currentSession.currentSpeed) {
                clog('new loc based on speed', newSpeed, loc.speed);
                // we also round the speed to 3 digits to prevent too small values
                this.currentSession.currentSpeed = Math.round(newSpeed * 1000) / 1000;
                shouldNotif = true;
            }

            if (deltaDistance > 2 || shouldNotif) {
                clog('deltaDistance', deltaDistance, this.currentSession.currentDistance);
                this.currentSession.currentDistance = this.currentSession.currentDistance + deltaDistance;
                shouldNotif = true;
            }

            // wait to have a little more data to compugte / show average speed
            const sessionDuration = loc.timestamp.valueOf() - this.currentSession.startTime.valueOf() - this.currentSession.pauseDuration;
            clog('sessionDuration', sessionDuration);
            clog('currentDistance', this.currentSession.currentDistance);
            if (sessionDuration > 3000 && this.currentSession.currentDistance > 10 && shouldNotif) {
                const newAvg = Math.round((this.currentSession.currentDistance / sessionDuration) * 3600); // 1m/s === 3.6 km/h => 1m/ms === 1000m/s === 3600 km/h
                clog('average Speed', newAvg);
                if (newAvg !== this.currentSession.averageSpeed) {
                    this.currentSession.averageSpeed = newAvg;
                    // clog('new loc based on avg', newAvg);
                    // shouldNotif = true;
                }
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
            const deltaTime = Date.now() - loc.timestamp.valueOf();
            if (deltaTime > maximumAge) {
                // very old last loc, let's make it as if it was the first one
                return;
            }
            this.updateSessionWithLoc(loc);
        }
    }

    waitingForLocation() {
        return this.currentSession && this.currentSession.lastLoc === null;
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
                this.currentSession.endTime = new Date();
                if (this.currentSession.lastPauseTime) {
                    this.currentSession.pauseDuration += this.currentSession.endTime.valueOf() - this.currentSession.lastPauseTime.valueOf();
                    this.currentSession.lastPauseTime = null;
                }
                this.currentSession.averageSpeed = Math.round(
                    (this.currentSession.currentDistance / (this.currentSession.endTime.valueOf() - this.currentSession.startTime.valueOf() - this.currentSession.pauseDuration)) * 3600
                );
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
