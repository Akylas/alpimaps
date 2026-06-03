declare namespace com {
    export namespace tns {
        export class NativeScriptException {
            static getStackTraceAsString(ex): string;
        }
    }
}

declare namespace akylas {
    export namespace alpi {
        export namespace maps {
            class VectorTileEventListener extends com.akylas.carto.additions.AKVectorTileEventListener {}
            class BgService extends globalAndroid.app.Service {}
            class BgServiceBinder extends globalAndroid.os.Binder {}
            class RefreshAlarmReceiver extends globalAndroid.content.BroadcastReceiver {}
            export namespace Utils {
                class Companion {
                    static getFileNameSync(arg0: globalAndroid.content.Context, f: string): string;
                }
            }
        }
    }
}
