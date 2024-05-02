declare namespace com {
    export namespace tns {
        export class NativeScriptException {
            static getStackTraceAsString(ex): String;
        }
    }
}

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
            export class WorkersContext {
                public static getValue(key): any;
                public static setValue(key: string, value);
            }
        }
    }
}
