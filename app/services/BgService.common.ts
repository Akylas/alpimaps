import { GeoHandler } from '~/handlers/GeoHandler';
import { Observable } from '@nativescript/core/data/observable';
import {
    ApplicationEventData,
    off as applicationOff,
    on as applicationOn,
    exitEvent,
    launchEvent
} from '@nativescript/core/application';

export const BgServiceLoadedEvent = 'BgServiceLoadedEvent';

let _sharedInstance: BgServiceCommon;
let onServiceLoadedListeners = [];
export function onServiceLoaded(callback: (geoHandler: GeoHandler) => void) {
    if (_sharedInstance) {
        callback(_sharedInstance.geoHandler);
    } else {
        onServiceLoadedListeners.push(callback);
    }
}
const onServiceUnloadedListeners = [];
export function onServiceUnloaded(callback: (geoHandler: GeoHandler) => void) {
    onServiceUnloadedListeners.push(callback);
}

export const BgServiceStartedEvent = 'BgServiceStartedEvent';
export const BgServiceErrorEvent = 'BgServiceErrorEvent';
export abstract class BgServiceCommon extends Observable {
    abstract get geoHandler(): GeoHandler;
    protected _loaded = false;
    protected _started = false;

    constructor() {
        super();
        applicationOn(exitEvent, this.onAppExit, this);
        applicationOn(launchEvent, this.onAppLaunch, this);
    }
    get loaded() {
        return this._loaded;
    }
    get started() {
        return this._started;
    }
    protected _handlerLoaded() {
        if (!this._loaded) {
            this._loaded = true;
            _sharedInstance = this;
            onServiceLoadedListeners.forEach((l) => l(this.geoHandler));
            onServiceLoadedListeners = [];
            this.notify({
                eventName: BgServiceLoadedEvent,
                object: this
            });
        }
    }

    async stop() {
        this._started = false;
        return Promise.all([this.geoHandler.stop()]) as Promise<any>;
    }
    start() {
        return Promise.all([this.geoHandler.start()]).then(() => {
            this._started = true;
            this.notify({
                eventName: BgServiceStartedEvent,
                object: this
            });
        });
    }
    onAppLaunch(args: ApplicationEventData) {
        this.start().catch((error) => {
            this.notify({
                eventName: BgServiceErrorEvent,
                object: this,
                error
            });
        });
    }
    onAppExit(args: ApplicationEventData) {
        onServiceUnloadedListeners.forEach((l) => l(this.geoHandler));
        this.stop().catch((error) => {
            this.notify({
                eventName: BgServiceErrorEvent,
                object: this,
                error
            });
        });
    }
    // updateNotifText(text: string) {}
}
