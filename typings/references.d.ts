/// <reference path="../node_modules/@nativescript/core/global-types.d.ts" />
/// <reference path="../node_modules/@nativescript/types-android/lib/android-32.d.ts" />
/// <reference path="../node_modules/@nativescript/types-ios/lib/ios/objc-x86_64/objc!Foundation.d.ts" />
/// <reference path="../node_modules/@nativescript/types-ios/lib/ios/objc-x86_64/objc!ObjectiveC.d.ts" />
/// <reference path="../node_modules/@nativescript/types-ios/lib/ios/objc-x86_64/objc!UIKit.d.ts" />
/// <reference path="../node_modules/@nativescript/types-ios/lib/ios/objc-x86_64/objc!CoreLocation.d.ts" />
/// <reference path="../node_modules/@nativescript-community/ui-carto/typings/carto.android.d.ts" />

declare module 'svelte/internal' {
    export function get_current_component();
}

// import type { Color } from '@nativescript/core';
declare module '*.scss' {
    export const locals;
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
declare const SPONSOR_URL: string;
declare const __APP_ID__: string;
declare const __APP_VERSION__: string;
declare const __APP_BUILD_NUMBER__: string;
declare const MATERIAL_MAP_FONT_FAMILY: string;
declare const TEST_ZIP_STYLES: boolean;
declare const PLAY_STORE_BUILD: boolean;
// declare const process: { env: any };

declare namespace akylas {
    export namespace alpi {
        export namespace maps {
            class VectorTileEventListener extends com.akylas.carto.additions.AKVectorTileEventListener {}
            class BgService extends globalAndroid.app.Service {}
            class BgServiceBinder extends globalAndroid.os.Binder {}
            class Utils {
                static applyDayNight(context: android.content.Context, applyDynamicColors: boolean);
                static applyDynamicColors(context: android.content.Context);
                static getDimensionFromInt(context: android.content.Context, intToGet);
                static getColorFromInt(context: android.content.Context, intToGet);
                static getColorFromName(context: android.content.Context, intToGet);
                static restartApp(context: android.content.Context, activity: android.app.Activity);
                static getSystemLocale(): java.util.Locale;
            }
        }
    }
}

interface LatLonKeys {
    lat: number;
    lon: number;
    altitude?: number;
}

// eslint-disable-next-line @typescript-eslint/no-unnecessary-qualifier
declare namespace svelteNative.JSX {
    type Override<What, With> = Omit<What, keyof With> & With;
    type ViewKeys = keyof TViewAttributes;
    type TViewAugmentedAttributes = Override<
        TViewAttributes,
        {
            disableCss?: boolean;
            rippleColor?: string;
            sharedTransitionTag?: string;
            verticalAlignment?: string;
            dynamicElevationOffset?: string | number;
            elevation?: string | number;
        }
    >;
    type ViewAndroidAttributes = {
        [K in keyof TViewAugmentedAttributes as `android:${K}`]: TViewAugmentedAttributes[k];
    };
    type ViewIOSAttributes = {
        [K in keyof TViewAugmentedAttributes as `ios:${K}`]: TViewAugmentedAttributes[k];
    };
    type ViewAttributes = TViewAugmentedAttributes & ViewAndroidAttributes & ViewIOSAttributes;

    interface ButtonAttributes {
        variant?: string;
        shape?: string;
    }
    interface ImageAttributes {
        noCache?: boolean;
        imageRotation?: number;
        colorMatrix?: number[];
        blurRadius?: number;
        fadeDuration?: number;
        'on:rotateAnimated'?: (args: EventData) => void;
    }
    interface SpanAttributes {
        verticalAlignment?: string;
        verticalTextAlignment?: string;
    }
    interface SliderAttributes {
        stepSize?: number;
        trackBackgroundColor?: string;
    }
    interface PageAttributes {
        statusBarColor?: string;
        screenOrientation?: string;
        keepScreenAwake?: boolean;
        screenBrightness?: number;
        'on:closingModally'?: (args: ShownModallyData) => void;
        // "on:shownModally"?: (args: ShownModallyData) => void;
    }
    interface LabelAttributes {
        autoFontSize?: boolean;
        verticalTextAlignment?: string;
        maxLines?: number;
        minFontSize?: number;
        maxFontSize?: number;
        lineBreak?: string;
        html?: string;
        linkColor?: string;
        selectable?: boolean;
        onlinkTap?;
        'on:linkTap'?;
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
