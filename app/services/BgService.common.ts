import { GeoHandler } from '~/handlers/GeoHandler';
import { Observable } from '@nativescript/core/data/observable';
import { ApplicationEventData, off as applicationOff, on as applicationOn, exitEvent, launchEvent } from '@nativescript/core/application';

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

const TAG = '[BgServiceCommon]';
export abstract class BgServiceCommon extends Observable {
    abstract get geoHandler(): GeoHandler;
    protected _loaded = false;
    protected _started = false;
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
        try {
            DEV_LOG && console.log(TAG, 'stop');
            this._started = false;
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
        try {
            DEV_LOG && console.log(TAG, 'start');
            await this.geoHandler.start();
            this._started = true;
            this.notify({
                eventName: BgServiceStartedEvent,
                object: this
            });
        } catch (error) {
            console.error(error);
            this.notify({
                eventName: BgServiceErrorEvent,
                object: this,
                error
            });
        }
    }
    // updateNotifText(text: string) {}
}
