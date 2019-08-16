/// <reference path="./node_modules/tns-platform-declarations/ios.d.ts" />
/// <reference path="./node_modules/tns-platform-declarations/android-26.d.ts" />
/// <reference path="./node_modules/nativescript-carto/typings/carto.android.d.ts" />
/// <reference path="./vue.shim.d.ts" />

// declare module '*.vue' {
//     import Vue from 'nativescript-vue';
//     export default Vue;
// }
declare module '*.scss' {
    // const content: any;

    // export default content;
    // export function toString(): string
    export const locals;
    // export const i
}

declare const gVars: {
    isIOS: boolean;
    isAndroid: boolean;
    CARTO_TOKEN: string;
    IGN_TOKEN: string;
    THUNDERFOREST_TOKEN: string;
    MAPBOX_TOKEN: string;
    MAPQUEST_TOKEN: string;
    HER_APP_ID: string;
    HER_APP_CODE: string;
    BUGNSAG: string;
    GOOGLE_TOKEN: string;
}

declare const TNS_ENV;
declare const LOG_LEVEL: string;
declare const TEST_LOGS: string;
// declare const process: { env: any };



declare namespace akylas {
    export namespace alpi {
        export namespace maps {
            class BgService extends globalAndroid.app.Service {}
            class BgServiceBinder extends globalAndroid.os.Binder {}
        }
    }
}