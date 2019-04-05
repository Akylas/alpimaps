import { File, Folder, knownFolders, path } from 'tns-core-modules/file-system';
import { isAndroid } from 'tns-core-modules/platform';

export function throttle(fn, limit) {
    let waiting = false;
    return (...args) => {
        if (!waiting) {
            waiting = true;
            setTimeout(() => {
                waiting = false;
            }, limit);
            return fn.apply(this, args);
        }
        return Promise.reject(undefined);
    };
}

export function getDataFolder() {
    let dataFolder;
    // if (isAndroid) {
    //     dataFolder = path.join(android.os.Environment.getExternalStorageDirectory()
    //         .getAbsolutePath()
    //         .toString(), 'akylas.alpi.maps');
    // } else {
    dataFolder = knownFolders.documents().path;
    // }
    return dataFolder;
}
