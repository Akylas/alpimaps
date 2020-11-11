import * as application from '@nativescript/core/application';
import { $t, $tc, $tt, $tu } from '~/helpers/locale';
import { Device, Screen } from '@nativescript/core/platform';
// import App from '~/components/App';
import Map from '~/components/Map';
import PackageService from '~/services/PackageService';
import { BgService } from './services/BgService';
import { NetworkService } from './services/NetworkService';
import * as imageModule from '@nativescript-community/ui-image';

const Plugin = {
    install(Vue) {
        const bgService = new BgService();
        Vue.prototype.$bgService = bgService;
        const packageService = new PackageService();
        Vue.prototype.$packageService = packageService;
        const networkService = new NetworkService();
        Vue.prototype.$networkService = networkService;

        application.on(application.launchEvent, () => {
            console.log('App Launched');
            imageModule.initialize({ isDownsampleEnabled: true });

            if (global.isAndroid) {
                bgService.start();
                networkService.start();
                // const receiverCallback = (androidContext, intent: android.content.Intent) => {
                //     console.log('receiverCallback', intent.getAction(), intent.getAction() === android.content.Intent.ACTION_SCREEN_ON);
                //     // (Vue.prototype.$getAppComponent() as App).$emit('screen', intent.getAction() === android.content.Intent.ACTION_SCREEN_ON);
                // };
                // application.android.registerBroadcastReceiver(android.content.Intent.ACTION_SCREEN_ON, receiverCallback);
                // application.android.registerBroadcastReceiver(android.content.Intent.ACTION_SCREEN_OFF, receiverCallback);
            }
        });
        application.on(application.exitEvent, () => {
            console.log('App Exited');
            imageModule.shutDown();
            networkService.stop();
            // if (global.isAndroid) {
            // application.android.unregisterBroadcastReceiver(android.content.Intent.ACTION_SCREEN_ON);
            // application.android.unregisterBroadcastReceiver(android.content.Intent.ACTION_SCREEN_OFF);
            // }
        });
        if (global.isIOS) {
            bgService.start();
            networkService.start();
        }
        let mapComponent: Map;
        Vue.prototype.$setMapComponent = function (comp: Map) {
            mapComponent = comp;
        };
        Vue.prototype.$getMapComponent = function () {
            return mapComponent;
        };

        const filters = (Vue.prototype.$filters = Vue['options'].filters);
        Vue.prototype.$t = $t;

        Vue.prototype.$tc = $tc;
        Vue.prototype.$tt = $tt;
        Vue.prototype.$tu = $tu;
        Vue.prototype.$showError = function (err: Error) {
            if (!err) {
                return;
            }
            console.log('showError', err, err.toString(), err.stack);
            const message = typeof err === 'string' ? err : err.toString();
            return alert({
                title: Vue.prototype.$tc('error'),
                okButtonText: Vue.prototype.$tc('ok'),
                message,
            });
        };
        Vue.prototype.$alert = function (message) {
            return alert({
                okButtonText: Vue.prototype.$tc('ok'),
                message,
            });
        };

        if (!PRODUCTION) {
            console.log('model', Device.model);
            console.log('os', Device.os);
            console.log('osVersion', Device.osVersion);
            console.log('manufacturer', Device.manufacturer);
            console.log('deviceType', Device.deviceType);
            console.log('widthPixels', Screen.mainScreen.widthPixels);
            console.log('heightPixels', Screen.mainScreen.heightPixels);
            console.log('widthDIPs', Screen.mainScreen.widthDIPs);
            console.log('heightDIPs', Screen.mainScreen.heightDIPs);
            console.log('scale', Screen.mainScreen.scale);
            console.log('ratio', Screen.mainScreen.heightDIPs / Screen.mainScreen.widthDIPs);
        }
    },
};

export default Plugin;
