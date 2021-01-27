import { knownFolders, path } from '@nativescript/core/file-system';
import * as app from '@nativescript/core/application';
import * as appSettings from '@nativescript/core/application-settings';
import { Application, Color, View } from '@nativescript/core';
import { l, lc, lt } from '~/helpers/locale';

// export function throttle(fn, limit) {
//     let waiting = false;
//     return (...args) => {
//         if (!waiting) {
//             waiting = true;
//             setTimeout(() => {
//                 waiting = false;
//             }, limit);
//             return fn.apply(this, args);
//         }
//         return Promise.reject(undefined);
//     };
// }

export function getDataFolder() {
    let dataFolder;
    if (global.isAndroid) {
        const checkExternalMedia = function () {
            let mExternalStorageAvailable = false;
            let mExternalStorageWriteable = false;
            const state = android.os.Environment.getExternalStorageState();

            if (android.os.Environment.MEDIA_MOUNTED === state) {
                // Can read and write the media
                mExternalStorageAvailable = mExternalStorageWriteable = true;
            } else if (android.os.Environment.MEDIA_MOUNTED_READ_ONLY === state) {
                // Can only read the media
                mExternalStorageAvailable = true;
                mExternalStorageWriteable = false;
            } else {
                // Can't read or write
                mExternalStorageAvailable = mExternalStorageWriteable = false;
            }
            return mExternalStorageWriteable;
        };
        if (checkExternalMedia()) {
            const nArray = (app.android.startActivity as android.app.Activity).getExternalFilesDirs(null);
            const result = [];
            for (let index = 0; index < nArray.length; index++) {
                const element = nArray[index];
                if (element) {
                    result.push(element);
                }
            }
            if (result.length > 1) {
                dataFolder = result[result.length - 1].getAbsolutePath();
            } else {
                dataFolder = knownFolders.documents().path;
            }
        } else {
            dataFolder = knownFolders.documents().path;
        }
    } else {
        dataFolder = knownFolders.documents().path;
    }
    if (TNS_ENV !== 'production') {
        dataFolder = path.join(dataFolder, 'dev');
    }
    return dataFolder;
}

export function getDefaultMBTilesDir() {
    let localMbtilesSource = appSettings.getString('local_mbtiles_directory');
    if (!localMbtilesSource) {
        let defaultPath = path.join(getDataFolder(), 'alpimaps_mbtiles');
        if (global.isAndroid) {
            const nArray = (app.android.startActivity as android.app.Activity).getExternalFilesDirs(null);
            const result = [];
            for (let index = 0; index < nArray.length; index++) {
                const element = nArray[index];
                if (element) {
                    result.push(element);
                }
            }
            if (result.length > 1) {
                const sdcardFolder = result[result.length - 1].getAbsolutePath();
                defaultPath = path.join(sdcardFolder, '../../../..', 'alpimaps_mbtiles');
            }
        }
        localMbtilesSource = appSettings.getString('local_mbtiles_directory', defaultPath);
    }
    return localMbtilesSource;
}

// type Many<T> = T | T[];
export function pick<T extends object, U extends keyof T>(object: T, ...props: U[]): Pick<T, U> {
    return props.reduce((o, k) => ((o[k] = object[k]), o), {} as any);
}
export function omit<T extends object, U extends keyof T>(object: T, ...props: U[]): Omit<T, U> {
    return Object.keys(object)
        .filter((key) => (props as string[]).indexOf(key) < 0)
        .reduce((newObj, key) => Object.assign(newObj, { [key]: object[key] }), {} as any);
}

declare const top: any;
let ColorPickerObserver;
export async function pickColor(color: Color, view?: View) {
    return new Promise<Color>((resolve) => {
        if (global.isAndroid) {
            const activity = Application.android.startActivity;
            const nView = view ? view.nativeView : activity.getWindow().getDecorView().getRootView();
            if (!(color instanceof Color)) {
                color = new Color(color as any);
            }
            if (!ColorPickerObserver) {
                ColorPickerObserver = top.defaults.colorpicker.ColorPickerPopup.ColorPickerObserver.extend({
                    onColorPicked(color) {
                        // console.log('onColorPicked', color, new Color(color));
                        this.resolve(new Color(color));
                        this.resolve = null;
                        popup.observer = null;
                    },
                    onColor(color, fromUser) {
                        // console.log('onColor', color, fromUser);
                    }
                });
            }
            const observer = new ColorPickerObserver();
            observer.resolve = resolve;
            // console.log(
            //     'pickColor',
            //     color,
            //     color instanceof Color,
            //     color.android,
            //     typeof color.android,
            //     activity,
            //     nView,
            //     observer
            // );
            const builder = new top.defaults.colorpicker.ColorPickerPopup.Builder(activity)
                .initialColor(color.android) // Set initial color
                .enableBrightness(true) // Enable brightness slider or not
                .enableAlpha(true) // Enable alpha slider or not
                .okTitle(lc('choose'))
                .cancelTitle(lc('cancel'))
                .showIndicator(true)
                .showValue(true);
            const popup = builder.build();
            popup.observer = observer;
            popup.show(nView, observer);
        }
    });
}
