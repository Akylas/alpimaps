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
            class VectorTileEventListener extends com.nativescript.massifmaps.additions.AKVectorTileEventListener {}
            class BgService extends globalAndroid.app.Service {}
            class BgServiceBinder extends globalAndroid.os.Binder {}
            class RefreshAlarmReceiver extends globalAndroid.content.BroadcastReceiver {}
            export namespace transit {
                class TrainFollowReceiver extends globalAndroid.content.BroadcastReceiver {}
                class TrainFollowStore {
                    static readonly RESULT_ADDED: number;
                    static readonly RESULT_EXISTS: number;
                    static readonly RESULT_FULL: number;
                    static getFollowsJson(context: globalAndroid.content.Context): string;
                    static getModelsJson(context: globalAndroid.content.Context): string;
                    static addFollow(context: globalAndroid.content.Context, followJson: string): number;
                    static removeFollow(context: globalAndroid.content.Context, id: string): void;
                    static saveModel(context: globalAndroid.content.Context, id: string, modelJson: string): void;
                }
                class TrainFollowScheduler {
                    static readonly ACTION_ALARM: string;
                    static readonly ACTION_REFRESH: string;
                    static schedule(context: globalAndroid.content.Context, atMillis: number): void;
                    static cancel(context: globalAndroid.content.Context): void;
                }
            }
            export namespace Utils {
                class Companion {
                    static getFileNameSync(arg0: globalAndroid.content.Context, f: string): string;
                }
            }
        }
    }
}
