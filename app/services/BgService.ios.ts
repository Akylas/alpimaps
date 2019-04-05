import { BgServiceCommon, BgServiceLoadedEvent } from '~/services/BgService.common';
import { GeoHandler } from '~/handlers/GeoHandler';

export { BgServiceLoadedEvent };

export class BgService extends BgServiceCommon {
    readonly geoHandler: GeoHandler;
    constructor() {
        super();
        this.geoHandler = new GeoHandler();
    }
    start() {
        this._handlerLoaded();
    }
    updateNotifText(text: string) {}
}
