import { BgService } from '~/services/android/BgService';

export declare class IBgServiceBinder extends android.os.Binder {
    getService(): BgService;
    setService(service: BgService);
}
// @NativeClass
// @JavaProxy()
export const BgServiceBinder = (android.os.Binder as any).extend('akylas.alpi.maps.BgServiceBinder', {
    // service: BgService;
    getService() {
        return this.service;
    },
    setService(service: BgService) {
        this.service = service;
    }
}) as typeof IBgServiceBinder;
