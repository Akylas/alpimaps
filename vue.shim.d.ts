import Vue from 'vue';
import { BgService } from '~/services/BgService';
import Map from '~/components/Map';
import App from '~/components/App';
import PackageService from '~/services/PackageService';
import { NativeScriptVueConstructor } from 'nativescript-vue';
import { NetworkService } from '~/services/NetworkService';
import { ToastDuration, ToastPosition } from 'nativescript-toasty';
import { Client } from 'nativescript-bugsnag';

declare module 'vue/types/vue' {
    // 3. Declare augmentation for Vue
    interface Vue {
        $bgService: BgService;
        $packageService: PackageService;
        $networkService: NetworkService;
        $bugsnag: Client;

        isAndroid: boolean;
        isIOS: boolean;
        isSimulator: boolean;
        // $cartoLicenseRegistered: boolean;
        $t: (s: string, ...args) => string;
        $tc: (s: string, ...args) => string;
        $tt: (s: string, ...args) => string;
        $tu: (s: string, ...args) => string;
        $filters: {
            titleclase(s: string): string;
            uppercase(s: string): string;
            L(s: string, ...args): string;
        };
        $showError(err: Error | string);
        $alert(message: string);
        $setAppComponent(comp: App);
        $getAppComponent(): App;
        $setMapComponent(comp: Map);
        $getMapComponent(): Map;
        $showToast(message: string, duration?: ToastDuration, position?: ToastPosition);
    }
}
