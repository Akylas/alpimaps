import { Utils } from '@nativescript/core';
import { BgService as AndroidBgService } from '~/services/android/BgService';
import { BgServiceBinder, IBgServiceBinder } from '~/services/android/BgServiceBinder';
import { BgServiceCommon, BgServiceLoadedEvent } from '~/services/BgService.common';

export { BgServiceLoadedEvent };

const Intent = android.content.Intent;

export class BgService extends BgServiceCommon {
    private serviceConnection: android.content.ServiceConnection;
    bgService: WeakRef<AndroidBgService>;
    context: android.content.Context;
    constructor() {
        super();
        this.serviceConnection = new android.content.ServiceConnection({
            onServiceDisconnected: (name: android.content.ComponentName) => {
                this.unbindService();
            },
            onServiceConnected: (name: android.content.ComponentName, binder: android.os.IBinder) => {
                this.handleBinder(binder);
            },
            onNullBinding(param0: globalAndroid.content.ComponentName) {},
            onBindingDied(param0: globalAndroid.content.ComponentName) {}
        });
        this.context = Utils.android.getApplicationContext();
    }

    bindService(context: android.content.Context, intent) {
        const result = context.bindService(intent, this.serviceConnection, android.content.Context.BIND_AUTO_CREATE);
        if (!result) {
            console.error('could not bind service');
        }
    }
    unbindService() {
        this.bgService = null;
        this._loaded = false;
    }

    async start() {
        const intent = new Intent(this.context, akylas.alpi.maps.BgService.class);
        this.bindService(this.context, intent);
    }

    async stop() {
        await super.stop();
        if (this.bgService) {
            (this.bgService as any).get().removeForeground();
            const intent = new Intent(this.context, akylas.alpi.maps.BgService.class);
            this.context.stopService(intent);
            this.context.unbindService(this.serviceConnection);
            this._loaded = false;
        }
    }
    handleBinder(binder: android.os.IBinder) {
        const bgBinder = binder as IBgServiceBinder;
        const localservice = bgBinder.getService();
        bgBinder.setService(null);
        this.bgService = new WeakRef(localservice);
        localservice.onBounded(this);
        this._handlerLoaded();
        super.start();
    }

    get geoHandler() {
        const bgService = this.bgService && (this.bgService as any).get();
        if (bgService) {
            return bgService.geoHandler;
        }
    }
}

// export class BgService extends BgServiceCommon {
//     readonly geoHandler: GeoHandler;
//     constructor() {
//         super();
//         this.geoHandler = new GeoHandler();
//         this.geoHandler.bgService = new WeakRef(this as any);
//         this._handlerLoaded();
//     }
//     // updateNotifText(text: string) {}
//     stop() {}
//     start() {}
// }
