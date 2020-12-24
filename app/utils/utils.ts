import { knownFolders, path } from '@nativescript/core/file-system';
import * as app from '@nativescript/core/application';
import * as appSettings from '@nativescript/core/application-settings';

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
            const dirs = (app.android.startActivity as android.app.Activity).getExternalFilesDirs(null);
            if (dirs.length > 0) {
                dataFolder = dirs[dirs.length - 1].getAbsolutePath();
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
            const dirs = (app.android.startActivity as android.app.Activity).getExternalFilesDirs(null);
            if (dirs.length > 0) {
                const sdcardFolder = dirs[dirs.length - 1].getAbsolutePath();
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
