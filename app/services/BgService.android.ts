import { BgServiceCommon, BgServiceLoadedEvent } from '~/services/BgService.common';

import * as utils from '@nativescript/core/utils/utils';
import { BgService as AndroidBgService } from '~/services/android/BgService';
import { BgServiceBinder } from '~/services/android/BgServiceBinder';

export { BgServiceLoadedEvent };
import { GeoHandler } from '~/handlers/GeoHandler';

// export class BgService extends BgServiceCommon {
//     private serviceConnection: android.content.ServiceConnection;
//     bgService: WeakRef<AndroidBgService>;
//     context: android.content.Context;
//     constructor() {
//         super();
//         // initServiceConnection();
//         this.serviceConnection = new android.content.ServiceConnection({
//             onServiceDisconnected: (name: android.content.ComponentName) => {
//                 this.unbindService();
//             },
//             onServiceConnected: (name: android.content.ComponentName, binder: android.os.IBinder) => {
//                 this.handleBinder(binder);
//             },
//             onNullBinding(param0: globalAndroid.content.ComponentName) {
//             },
//             onBindingDied(param0: globalAndroid.content.ComponentName) {
//             }
//         });
//         this.context = utils.ad.getApplicationContext();
//     }

//     bindService(context: android.content.Context, intent) {
//         console.log('bindService');
//         const result = context.bindService(intent, this.serviceConnection, android.content.Context.BIND_AUTO_CREATE);
//         if (!result) {
//             console.error('could not bind service');
//         }
//     }
//     unbindService() {
//         console.log('unbindService');
//         this.bgService = null;
//         this._loaded = false;
//     }

//     start() {
//         const intent = new android.content.Intent(this.context, akylas.alpi.maps.BgService.class);

//         // console.log('BgService start', android.os.Build.VERSION.SDK_INT >= 26); // oreo
//         // if (android.os.Build.VERSION.SDK_INT >= 26) {
//         //     // ... start service in foreground to prevent it being killed on Oreo
//         //     this.context.startForegroundService(intent);
//         // } else {
//         this.context.startService(intent);
//         // }
//         this.bindService(this.context, intent);
//     }

//     stop() {
//         if (this.bgService) {
//             this.bgService.get().dismissNotification();
//             const intent = new android.content.Intent(this.context, akylas.alpi.maps.BgService.class);
//             this.context.stopService(intent);
//             this.context.unbindService(this.serviceConnection);
//             this._loaded = false;
//         }
//     }
//     handleBinder(binder: android.os.IBinder) {
//         const bgBinder = binder as BgServiceBinder;
//         const localservice = bgBinder.getService();
//         bgBinder.setService(null);
//         // console.log('handleBinder', binder, localservice, localservice instanceof AndroidBgService);
//         if (localservice instanceof AndroidBgService) {
//             this.bgService = new WeakRef(localservice);
//             localservice.onBounded();
//             this._handlerLoaded();
//         }
//     }

//     get geoHandler() {
//         if (this.bgService) {
//             return this.bgService.get().geoHandler;
//         }
//     }

//     updateNotifText(text: string) {
//         if (this.bgService) {
//             return this.bgService.get().updateNotifText(text);
//         }
//     }
// }

export class BgService extends BgServiceCommon {
    readonly geoHandler: GeoHandler;
    constructor() {
        super();
        this.geoHandler = new GeoHandler();
        this.geoHandler.bgService = new WeakRef(this as any);
        this._handlerLoaded();
    }
    // updateNotifText(text: string) {}
    stop() {}
    start() {}
}
