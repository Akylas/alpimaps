import localize from 'nativescript-localize';
import { clog } from './utils/logging';
import App from '~/components/App';
import Map from '~/components/Map';
import { isAndroid, isIOS } from 'tns-core-modules/platform';
import { device } from 'tns-core-modules/platform/platform';
import { BgService } from './services/BgService';
import PackageService from '~/services/PackageService';
import { registerLicense } from 'nativescript-carto/ui/ui';
import * as application from 'application';
const Plugin = {
    install(Vue) {
        const bgService = new BgService();
        Vue.prototype.$bgService = bgService;
        const packageService = new PackageService();
        Vue.prototype.$packageService = packageService;
        // Vue.prototype.$cartoLicenseRegistered = false;

        if (isAndroid) {
            application.on(application.launchEvent, () => {
                // registerLicense(process.env.CARTO_ANDROID_TOKEN, result => {
                //     clog('registerLicense done', result);
                //     // Vue.prototype.$cartoLicenseRegistered = result;
                //     appComponent && appComponent.setCartoLicenseRegistered(result);
                // });
                bgService.start();
                // packageService.start();
            });
        } else {
            // registerLicense(process.env.CARTO_IOS_TOKEN);
            bgService.start();
            // packageService.start();
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
        };
        Vue.prototype.$getMapComponent = function() {
            return mapComponent;
        };

        Vue.prototype.$isSimulator = false;
        Vue.prototype.$isAndroid = isAndroid;
        Vue.prototype.$isIOS = isIOS;
        const filters = (Vue.prototype.$filters = Vue['options'].filters);
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
        Vue.prototype.$alert = function(message) {
            return alert({
                okButtonText: Vue.prototype.$ltc('ok'),
                message
            });
        };

        /* DEV-START */
        console.log('only shown in dev', device.model, device.os, device.osVersion, device.manufacturer);
        /* DEV-END */
    }
};

export default Plugin;
