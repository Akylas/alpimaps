import { ApplicationEventData, exitEvent, off as applicationOff, on as applicationOn } from 'tns-core-modules/application/application';
import * as utils from 'tns-core-modules/utils/utils';
import { GeoHandler } from '~/handlers/GeoHandler';
import { BgService as AndroidBgService } from '~/services/android/BgService';
import { BgServiceBinder } from '~/services/android/BgServiceBinder';
import { BgServiceCommon, BgServiceLoadedEvent } from '~/services/BgService.common';
import { clog } from '~/utils/logging';


export { BgServiceLoadedEvent };

export class BgService extends BgServiceCommon {
    private serviceConnection: android.content.ServiceConnection;
    bgService: WeakRef<AndroidBgService>;
    context;
    readonly _geoHandler: GeoHandler;
    constructor() {
        super();
        this._geoHandler = new GeoHandler();
        // initServiceConnection();
    }

    start() {
        this._handlerLoaded();
    }
    startBackground() {
        this.serviceConnection = new android.content.ServiceConnection({
            onServiceDisconnected: (name: android.content.ComponentName) => {
                clog('android service disconnected');
                this.unbindService();
            },

            onServiceConnected: (name: android.content.ComponentName, binder: android.os.IBinder) => {
                // clog('BgServiceProvider', 'onServiceConnected', name);
                this.handleBinder(binder);
            },
            onBindingDied(param0: globalAndroid.content.ComponentName) {}
        });
        this.context = utils.ad.getApplicationContext();
        const intent = new android.content.Intent(this.context, akylas.alpi.maps.BgService.class);

        // if (android.os.Build.VERSION.SDK_INT >= 26) {
        //     this.context.startForegroundService(intent);
        // } else {
        this.context.startService(intent);
        // }
        this.bindService(this.context, intent);
        applicationOn(exitEvent, this.onAppExit);
    }

    bindService(context, intent) {
        const result = context.bindService(intent, this.serviceConnection, android.content.Context.BIND_AUTO_CREATE);
        if (!result) {
            console.error('could not bind service');
        }
    }
    unbindService() {
        this.bgService = null;
        this._loaded = false;
    }
    onAppExit = (args: ApplicationEventData) => {
        applicationOff(exitEvent, this.onAppExit);
        if (this.bgService) {
            this.bgService.get().removeForeground();
        }
        // if (this.bgService) {
        const intent = new android.content.Intent(this.context, akylas.alpi.maps.BgService.class);
        this.context.stopService(intent);
        // }
    }
    handleBinder(binder: android.os.IBinder) {
        const localservice = (binder as BgServiceBinder).getService();
        if (localservice instanceof AndroidBgService) {
            this.bgService = new WeakRef(localservice);
            localservice.onBounded();
            this._handlerLoaded();
        }
    }

    get geoHandler() {
        if (this.bgService) {
            return this.bgService.get().geoHandler;
        }
        return this._geoHandler;
    }

    updateNotifText(text: string) {
        if (this.bgService) {
            return this.bgService.get().updateNotifText(text);
        }
    }
}
