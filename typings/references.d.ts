/// <reference path="../node_modules/@nativescript/core/global-types.d.ts" />
/// <reference path="../node_modules/@nativescript/types-android/lib/android-32.d.ts" />
/// <reference path="../node_modules/@nativescript/types-ios/lib/ios/objc-x86_64/objc!Foundation.d.ts" />
/// <reference path="../node_modules/@nativescript/types-ios/lib/ios/objc-x86_64/objc!ObjectiveC.d.ts" />
/// <reference path="../node_modules/@nativescript/types-ios/lib/ios/objc-x86_64/objc!UIKit.d.ts" />
/// <reference path="../node_modules/@nativescript/types-ios/lib/ios/objc-x86_64/objc!CoreLocation.d.ts" />
/// <reference path="../node_modules/@nativescript/types-ios/lib/ios/objc-x86_64/objc!LinkPresentation.d.ts" />
/// <reference path="../node_modules/@nativescript/types-ios/lib/ios/interop.d.ts" />
/// <reference path="../node_modules/@nativescript-community/ui-carto/typings/carto.android.d.ts" />

declare const gVars: {
    platform: string;
    CARTO_TOKEN: string;
    // FACEBOOK_TOKEN: string;
    IGN_TOKEN: string;
    AMERICANA_OSM_URL: string;
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

declare const CARTO_TOKEN: string;
// FACEBOOK_TOKEN: string;
declare const IGN_TOKEN: string;
declare const AMERICANA_OSM_URL: string;
declare const THUNDERFOREST_TOKEN: string;
declare const MAPBOX_TOKEN: string;
declare const MAPTILER_TOKEN: string;
declare const MAPQUEST_TOKEN: string;
declare const HER_APP_ID: string;
declare const HER_APP_CODE: string;
declare const BUGNSAG: string;
declare const GOOGLE_TOKEN: string;
declare const AVWX_API_KEY: string;

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
declare const SUPPORTED_VALHALLA_LOCALES: string[];
declare const FALLBACK_LOCALE: string;
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

interface LatLonKeys {
    lat: number;
    lon: number;
    altitude?: number;
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
