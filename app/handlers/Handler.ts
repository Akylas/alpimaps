import { Observable } from '@nativescript/core';
import type { BgServiceCommon } from '~/services/BgService.common';
import { BgService } from '~/services/BgService';
export abstract class Handler extends Observable {
    constructor(protected service: BgServiceCommon) {
        super();
    }
    get geoHandler() {
        return this.service.geoHandler;
    }
}
