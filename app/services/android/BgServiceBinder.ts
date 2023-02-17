import { BgService } from '~/services/android/BgService';

export declare class IBgServiceBinder extends android.os.Binder {
    getService(): BgService;
    setService(service: BgService);
}
@NativeClass
@JavaProxy('akylas.alpi.maps.BgServiceBinder')
// export const BgServiceBinder = (android.os.Binder as any).extend('akylas.alpi.maps.BgServiceBinder', {
export class BgServiceBinder extends android.os.Binder {
    service: BgService;
    getService() {
        return this.service;
    }
    setService(service: BgService) {
        this.service = service;
    }
}
