import { BgService } from '~/services/android/BgService';

declare global {
    namespace akylas { export namespace alpi { export namespace maps {  class BgServiceBinder extends android.os.Binder {} } } }
}

@JavaProxy('akylas.alpi.maps.BgServiceBinder')
export class BgServiceBinder extends android.os.Binder {
    service: WeakRef<BgService>;
    constructor() {
        super();
    }
    getService() {
        return this.service.get();
    }
    setService(service: BgService) {
        this.service = new WeakRef(service);
    }
}
