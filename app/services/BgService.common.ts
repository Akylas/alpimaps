import { GeoHandler } from '~/handlers/GeoHandler';
import { Observable } from '@nativescript/core/data/observable';
import { ApplicationEventData, exitEvent, launchEvent, off as applicationOff, on as applicationOn } from '@nativescript/core/application';
import { clog } from '~/utils/logging';

export const BgServiceLoadedEvent = 'BgServiceLoadedEvent';
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
        // clog('_handlerLoaded');
        if (!this._loaded) {
            this._loaded = true;
            this.notify({
                eventName: BgServiceLoadedEvent,
                object: this
            });
        }
    }
    log(...args) {
        clog(`[${this.constructor.name}]`, ...args);
    }

    abstract stop();
    abstract start();
    onAppLaunch(args: ApplicationEventData) {
        this.log('onAppLaunch');
        this.start();
    }
    onAppExit(args: ApplicationEventData) {
        this.log('onAppExit');
        // applicationOff(exitEvent, this.onAppExit, this);
        this.geoHandler.onAppExit(args);

    }
    // updateNotifText(text: string) {}
}
