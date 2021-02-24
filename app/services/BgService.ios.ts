import { BgServiceCommon, BgServiceLoadedEvent } from '~/services/BgService.common';
import { GeoHandler } from '~/handlers/GeoHandler';

export { BgServiceLoadedEvent };

export class BgService extends BgServiceCommon {
    readonly geoHandler: GeoHandler;
    constructor() {
        super();
        this.geoHandler = new GeoHandler();
        this.geoHandler.bgService = new WeakRef(this as any);
        this._handlerLoaded();
    }
}
