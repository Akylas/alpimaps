/// <reference path="./node_modules/@nativescript/types-ios/lib/ios.d.ts" />
/// <reference path="./node_modules/@nativescript/types-android/lib/android-28.d.ts" />
/// <reference path="./node_modules/@nativescript/core/global-types.d.ts" />
/// <reference path="./vue.shim.d.ts" />

/// <reference path="./node_modules/@nativescript-community/ui-carto/typings/ak.carto.android.d.ts" />
/// <reference path="./node_modules/@nativescript-community/ui-carto/typings/carto.android.d.ts" />
/// <reference path="./node_modules/@nativescript-community/ui-carto/typings/carto.ios.d.ts" />
/// <reference path="./node_modules/@danmarshall/deckgl-typings/deck.gl/index.d.ts" />

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

declare namespace akylas {
    export namespace alpi {
        export namespace maps {
            export class NightModeApplication extends android.app.Application {}
            export class WorkersContext {
                public static getValue(key): any;
                public static setValue(key: string, value);
            }
        }
    }
}

declare const gVars: {
    sentry: boolean;
    platform: string;
    CARTO_TOKEN: string;
    IGN_TOKEN: string;
    THUNDERFOREST_TOKEN: string;
    MAPBOX_TOKEN: string;
    MAPTILER_TOKEN: string;
    MAPQUEST_TOKEN: string;
    HER_APP_ID: string;
    HER_APP_CODE: string;
    BUGNSAG: string;
    GOOGLE_TOKEN: string;
    AVWX_API_KEY: string;
};

declare const TNS_ENV: string;
declare const DEV_LOG: boolean;
declare const NO_CONSOLE: boolean;
declare const TEST_LOGS: boolean;
declare const PRODUCTION: boolean;
declare const __CARTO_PACKAGESERVICE__: boolean;
declare const LOCAL_MBTILES: string;
declare const SENTRY_DSN: string;
declare const SENTRY_PREFIX: string;
declare const SUPPORTED_LOCALES: string[];
declare const GIT_URL: string;
declare const STORE_LINK: string;
declare const STORE_REVIEW_LINK: string;
// declare const process: { env: any };

declare namespace akylas {
    export namespace alpi {
        export namespace maps {
            class BgService extends globalAndroid.app.Service {}
            class BgServiceBinder extends globalAndroid.os.Binder {}
            export namespace Three {
                export class GetElevationMeshesCallback extends java.lang.Object {
                    public static class: java.lang.Class<RoutingServiceRouteCallback>;
                    /**
                     * Constructs a new instance of the com.akylas.carto.additions.RoutingServiceRouteCallback interface with the provided implementation. An empty constructor exists calling super() when extending the interface class.
                     */
                    public constructor(implementation: { onResult(error, res: string): void });
                    public constructor();
                    public onResult(error, res: string): void;
                }
                function getElevationMeshesAsync(context: android.content.Context, dataSource: com.carto.datasources.TileDataSource, options: string, callback: GetElevationMeshesCallback);
            }
        }
    }
}

interface LatLonKeys {
    lat: number;
    lon: number;
    altitude?: number;
}

namespace svelteNative.JSX {
    interface ViewAttributes {
        rippleColor?: Color | String;
        verticalAlignment?: String;
    }
    export interface ButtonAttributes {
        variant?: String;
    }
    export interface LabelAttributes {
        autoFontSize?: boolean;
        verticalTextAlignment?: String;
        maxLines?: number;
        minFontSize?: number;
        maxFontSize?: number;
        html?: String;
    }
}
