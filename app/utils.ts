import { knownFolders, path } from '@nativescript/core/file-system';
import * as app from '@nativescript/core/application';

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
        // console.log('getDataFolder', checkExternalMedia());
        if (checkExternalMedia()) {
            const dirs = (app.android.startActivity as android.app.Activity).getExternalFilesDirs(null);
            // for (let index = 0; index < dirs.length; index++) {
            //     const element = dirs[index];
            //     // console.log('element', element.getAbsolutePath());
            // }
            dataFolder = dirs[dirs.length - 1].getAbsolutePath();
            // console.log('sdcard data folder', dirs, dataFolder);
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

/**
 * @enumerable decorator that sets the enumerable property of a class field to false.
 * @param value true|false
 */
export function enumerable(value: boolean) {
    return function (target: any, propertyKey: string) {
        const descriptor = Object.getOwnPropertyDescriptor(target, propertyKey) || {};
        if (descriptor.enumerable !== value) {
            descriptor.enumerable = value;
            Object.defineProperty(target, propertyKey, descriptor);
        }
    };
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
