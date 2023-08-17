import { Application } from '@nativescript/core';
import { ApplicationEventData } from '@nativescript/core/application';
import { Observable } from '@nativescript/core/data/observable';
import { GeoHandler } from '~/handlers/GeoHandler';

export const BgServiceLoadedEvent = 'BgServiceLoadedEvent';

let mSharedInstance: BgServiceCommon;
let onServiceLoadedListeners = [];
export function onServiceLoaded(callback: (geoHandler: GeoHandler) => void) {
    if (mSharedInstance) {
        callback(mSharedInstance.geoHandler);
    } else {
        onServiceLoadedListeners.push(callback);
    }
}
let onServiceStartedListeners = [];
export function onServiceStarted(callback: (geoHandler: GeoHandler) => void) {
    if (mSharedInstance.started) {
        callback(mSharedInstance.geoHandler);
    } else {
        onServiceStartedListeners.push(callback);
    }
}
export function isServiceStarted() {
    return mSharedInstance.started;
}
const onServiceUnloadedListeners = [];
export function onServiceUnloaded(callback: (geoHandler: GeoHandler) => void) {
    onServiceUnloadedListeners.push(callback);
}

export const BgServiceStartedEvent = 'BgServiceStartedEvent';
export const BgServiceErrorEvent = 'BgServiceErrorEvent';

const TAG = '[BgServiceCommon]';
export abstract class BgServiceCommon extends Observable {
    abstract get geoHandler(): GeoHandler;
    protected _loaded = false;
    protected _started = false;
    appInBackground = true;
    bgService?: WeakRef<any>; //android only

    constructor() {
        super();
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
            mSharedInstance = this;
            onServiceLoadedListeners.forEach((l) => l(this.geoHandler));
            onServiceLoadedListeners = [];
            this.notify({
                eventName: BgServiceLoadedEvent,
                object: this
            });
        }
    }

    async stop() {
        if (!this._started) {
            return;
        }
        try {
            this._started = false;

            Application.off(Application.backgroundEvent, this.onAppBackground, this);
            Application.off(Application.foregroundEvent, this.onAppForeground, this);
            DEV_LOG && console.log(TAG, 'stop');
            await this.geoHandler.stop();
        } catch (error) {
            console.error(error);
            this.notify({
                eventName: BgServiceErrorEvent,
                object: this,
                error
            });
        }
    }
    async start() {
        if (this._started) {
            return;
        }
        try {
            this._started = true;
            DEV_LOG && console.log(TAG, 'start');

            Application.on(Application.backgroundEvent, this.onAppBackground, this);
            Application.on(Application.foregroundEvent, this.onAppForeground, this);
            await this.geoHandler.start();
            this.notify({
                eventName: BgServiceStartedEvent,
                object: this
            });

            onServiceStartedListeners.forEach((l) => l(this.geoHandler));
            onServiceStartedListeners = [];
        } catch (error) {
            console.error(error);
            this.notify({
                eventName: BgServiceErrorEvent,
                object: this,
                error
            });
        }
    }
    onAppForeground(args: ApplicationEventData) {
        if (!this.appInBackground) {
            return;
        }
        DEV_LOG && console.log(this.constructor.name, 'onAppForeground');
        this.appInBackground = false;
    }
    onAppBackground(args: ApplicationEventData) {
        if (this.appInBackground) {
            return;
        }
        DEV_LOG && console.log(this.constructor.name, 'onAppBackground');
        this.appInBackground = true;
    }
    // updateNotifText(text: string) {}
}
