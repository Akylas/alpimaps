import Vue from 'vue';
import { BgService } from '~/services/BgService';
import Map from '~/components/Map';
import App from '~/components/App';
import PackageService from '~/services/PackageService';
import { NativeScriptVueConstructor } from 'nativescript-vue';


declare module 'vue/types/vue' {
    // 3. Declare augmentation for Vue
    interface Vue {
        $bgService: BgService;
        $packageService: PackageService;

        $isAndroid: boolean;
        // $cartoLicenseRegistered: boolean;
        $isIOS: boolean;
        $l: (s: string, ...args) => string;
        $ltc: (s: string, ...args) => string;
        $luc: (s: string, ...args) => string;
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
    }
}
