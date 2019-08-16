import { BgService } from '~/services/android/BgService';

@JavaProxy('akylas.alpi.maps.BgServiceBinder')
export class BgServiceBinder extends android.os.Binder {
    service: BgService;
    constructor() {
        super();
    }
    getService() {
        return this.service;
    }
    setService(service: BgService) {
        this.service = service;
    }
}
