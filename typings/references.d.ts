/// <reference path="../node_modules/@nativescript/core/global-types.d.ts" />
/// <reference path="../node_modules/@nativescript/types-android/lib/android-32.d.ts" />
/// <reference path="../node_modules/@nativescript/types-ios/lib/ios/objc-x86_64/objc!Foundation.d.ts" />
/// <reference path="../node_modules/@nativescript-community/ui-carto/typings/carto.android.d.ts" />

// import type { Color } from '@nativescript/core';

// declare module '*.vue' {
//     import Vue from 'nativescript-vue';
//     export default Vue;
// }

declare module '*.svelte' {
    export { SvelteComponent as default };
}

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
            export class WorkersContext {
                public static getValue(key): any;
                public static setValue(key: string, value);
            }
        }
    }
}

declare const gVars: {
    platform: string;
    CARTO_TOKEN: string;
    // FACEBOOK_TOKEN: string;
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
declare const TEST_LOG: boolean;
declare const PRODUCTION: boolean;
declare const __DISABLE_OFFLINE__: boolean;
declare const WITH_BUS_SUPPORT: boolean;
declare const SENTRY_ENABLED: boolean;
declare const SENTRY_DSN: string;
declare const SENTRY_PREFIX: string;
declare const SUPPORTED_LOCALES: string[];
declare const DEFAULT_LOCALE: string;
declare const DEFAULT_THEME: string;
declare const GIT_URL: string;
declare const STORE_LINK: string;
declare const STORE_REVIEW_LINK: string;
declare const __APP_ID__: string;
declare const __APP_VERSION__: string;
declare const __APP_BUILD_NUMBER__: string;
declare const MATERIAL_MAP_FONT_FAMILY: string;
declare const TEST_ZIP_STYLES: boolean;
// declare const process: { env: any };

declare namespace akylas {
    export namespace alpi {
        export namespace maps {
            class VectorTileEventListener extends com.akylas.carto.additions.AKVectorTileEventListener {}
            class BgService extends globalAndroid.app.Service {}
            class BgServiceBinder extends globalAndroid.os.Binder {}
            // export namespace Three {
            //     export class GetElevationMeshesCallback extends java.lang.Object {
            //         /**
            //          * Constructs a new instance of the com.akylas.carto.additions.RoutingServiceRouteCallback interface with the provided implementation. An empty constructor exists calling super() when extending the interface class.
            //          */
            //         public constructor(implementation: { onResult(error, res: string): void });
            //         public constructor();
            //         public onResult(error, res: string): void;
            //     }
            //     function getElevationMeshesAsync(context: android.content.Context, dataSource: com.carto.datasources.TileDataSource, options: string, callback: GetElevationMeshesCallback);
            // }
        }
    }
}

interface LatLonKeys {
    lat: number;
    lon: number;
    altitude?: number;
}

declare namespace svelteNative.JSX {
    interface ViewAttributes {
        disableCss?: boolean;
        // verticalAlignment: 'top' | 'center' | 'middle' | 'bottom';
        rippleColor?: Color | string;
        dynamicElevationOffset?: string | number;
        elevation?: string | number;
        'on:layoutChanged'?: (args: EventData) => void;
        onlayoutChanged?: (args: EventData) => void;
    }
    export interface ButtonAttributes {
        variant?: string;
        shape?: string;
    }
    export interface ImageAttributes {
        noCache?: boolean;
    }
    export interface SpanAttributes {
        verticalAlignment?: string;
        verticalTextAlignment?: string;
    }
    export interface SliderAttributes {
        stepSize?: number;
        trackBackgroundColor?: string;
    }
    export interface PageAttributes {
        keepScreenAwake?: boolean;
        screenBrightness?: number;
    }
    export interface LabelAttributes {
        autoFontSize?: boolean;
        verticalTextAlignment?: string;
        maxLines?: number;
        minFontSize?: number;
        maxFontSize?: number;
        lineBreak?: string;
        html?: string;
    }
}

// interface SunlightTimes {
//     sunrise: Date;
//     sunriseEnd: Date;
//     goldenHourEnd: Date;
//     solarNoon: Date;
//     goldenHour: Date;
//     sunsetStart: Date;
//     sunset: Date;
//     dusk: Date;
//     nauticalDusk: Date;
//     night: Date;
//     nadir: Date;
//     nightEnd: Date;
//     nauticalDawn: Date;
//     dawn: Date;
// }

// interface SunPosition {
//     altitude: number;
//     azimuth: number;
// }

// interface MoonPosition {
//     altitude: number;
//     azimuth: number;
//     distance: number;
//     parallacticAngle: number;
// }

// interface MoonIllumination {
//     fraction: number;
//     phase: number;
//     angle: number;
// }

// interface MoonTimes {
//     rise: Date;
//     set: Date;
//     alwaysUp: boolean;
//     alwaysDown: boolean;
// }

// declare module 'suncalc' {
//     function getTimes(date: Date, latitude: number, longitude: number): SunlightTimes;
//     function getPosition(timeAndDate: Date, latitude: number, longitude: number): SunPosition;
//     function getMoonPosition(timeAndDate: Date, latitude: number, longitude: number): MoonPosition;
//     function getMoonIllumination(timeAndDate: Date): MoonIllumination;
//     function getMoonTimes(date: Date, latitude: number, longitude: number, inUTC?: boolean): MoonTimes;
// }
