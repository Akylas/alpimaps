import * as application from 'application';
import localize from 'nativescript-localize';
import { device, screen } from 'tns-core-modules/platform';
import App from '~/components/App';
import Map from '~/components/Map';
import PackageService from '~/services/PackageService';
import { BgService } from './services/BgService';
import { clog } from './utils/logging';
import { NetworkService } from './services/NetworkService';
import { ToastDuration, ToastPosition, Toasty } from 'nativescript-toasty';

const Plugin = {
    install(Vue) {
        const bgService = new BgService();
        Vue.prototype.$bgService = bgService;
        const packageService = new PackageService();
        Vue.prototype.$packageService = packageService;
        const networkService = new NetworkService();
        Vue.prototype.$networkService = networkService;

        if (gVars.isAndroid) {
            application.on(application.launchEvent, () => {
                bgService.start();
                networkService.start();
            });
        } else {
            bgService.start();
            networkService.start();
        }
        let appComponent: App;
        Vue.prototype.$setAppComponent = function(comp: App) {
            appComponent = comp;
        };
        Vue.prototype.$getAppComponent = function() {
            return appComponent;
        };
        let mapComponent: Map;
        Vue.prototype.$setMapComponent = function(comp: Map) {
            mapComponent = comp;
            appComponent.setMapMounted(true);
        };
        Vue.prototype.$getMapComponent = function() {
            return mapComponent;
        };

        Vue.prototype.$isSimulator = false;
        Vue.prototype.$isAndroid = gVars.isAndroid;
        Vue.prototype.$isIOS = gVars.isIOS;
        const filters = (Vue.prototype.$filters = Vue['options'].filters);
        Vue.prototype.$t = localize;
        Vue.prototype.$ltc = function(s: string, ...args) {
            return filters.titlecase(localize(s, ...args));
        };
        Vue.prototype.$luc = function(s: string, ...args) {
            return filters.uppercase(localize(s, ...args));
        };
        Vue.prototype.$showError = function(err: Error) {
            clog('showError', err, err.toString(), err['stack']);
            const message = typeof err === 'string' ? err : err.toString();
            return alert({
                title: Vue.prototype.$ltc('error'),
                okButtonText: Vue.prototype.$ltc('ok'),
                message
            });
        };
        Vue.prototype.$showToast = function(message: string, duration?: ToastDuration, position?: ToastPosition) {
            const toasty = new Toasty(message, duration, position);
            toasty.show();
            return toasty;
        };
        Vue.prototype.$alert = function(message) {
            return alert({
                okButtonText: Vue.prototype.$ltc('ok'),
                message
            });
        };

        /* DEV-START */
        clog('model', device.model);
        clog('os', device.os);
        clog('osVersion', device.osVersion);
        clog('manufacturer', device.manufacturer);
        clog('deviceType', device.deviceType);
        clog('widthPixels', screen.mainScreen.widthPixels);
        clog('heightPixels', screen.mainScreen.heightPixels);
        clog('widthDIPs', screen.mainScreen.widthDIPs);
        clog('heightDIPs', screen.mainScreen.heightDIPs);
        clog('scale', screen.mainScreen.scale);
        clog('ratio', screen.mainScreen.heightDIPs / screen.mainScreen.widthDIPs);
        /* DEV-END */
    }
};

export default Plugin;
