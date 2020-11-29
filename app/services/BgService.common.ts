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
const onServiceLoadedListeners = [];
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

export abstract class BgServiceCommon extends Observable {
    readonly geoHandler: GeoHandler;
    protected _loaded = false;

    constructor() {
        super();
        applicationOn(exitEvent, this.onAppExit, this);
        applicationOn(launchEvent, this.onAppLaunch, this);
    }
    get loaded() {
        return this._loaded;
    }
    protected _handlerLoaded() {
        if (!this._loaded) {
            this._loaded = true;
            _sharedInstance = this;
            onServiceLoadedListeners.forEach((l) => l(this.geoHandler));
            this.notify({
                eventName: BgServiceLoadedEvent,
                object: this
            });
        }
    }
    log(...args) {
        console.log(`[${this.constructor.name}]`, ...args);
    }

    abstract stop();
    abstract start();
    onAppLaunch(args: ApplicationEventData) {
        this.start();
    }
    onAppExit(args: ApplicationEventData) {
        // applicationOff(exitEvent, this.onAppExit, this);
        onServiceUnloadedListeners.forEach((l) => l(this.geoHandler));
        this.geoHandler.onAppExit(args);
    }
    // updateNotifText(text: string) {}
}
