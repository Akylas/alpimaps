import { BgServiceCommon, BgServiceLoadedEvent } from '~/services/BgService.common';
import { GeoHandler } from '~/handlers/GeoHandler';

export { BgServiceLoadedEvent };

export class BgService extends BgServiceCommon {
    readonly geoHandler: GeoHandler;
    constructor() {
        super();
        this.geoHandler = new GeoHandler(this);
        this._handlerLoaded();
    }
}

let bgService: BgService;
export function getBGServiceInstance() {
    if (!bgService) {
        bgService = new BgService();
    }
    return bgService;
}
