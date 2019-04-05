import { GeoHandler } from '~/handlers/GeoHandler';
import { Observable } from 'tns-core-modules/data/observable';

export const BgServiceLoadedEvent = 'BgServiceLoadedEvent';
export abstract class BgServiceCommon extends Observable {
    readonly geoHandler: GeoHandler;
    protected _loaded = false;
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
    abstract start();
    updateNotifText(text: string) {}
}
