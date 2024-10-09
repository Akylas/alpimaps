import { executeOnMainThread } from '@nativescript/core/utils';
import { Application, ApplicationSettings, CSSUtils, Device, File, FileSystemEntity, Folder, Utils, knownFolders, path } from '@nativescript/core';
export { restartApp } from '@akylas/nativescript-app-utils';

let savedMBTilesDir = ApplicationSettings.getString('local_mbtiles_directory');

export const sdkVersion = parseInt(Device.sdkVersion, 10);

export function arraySortOn(array, key) {
    return array.sort(function (a, b) {
        if (a[key] < b[key]) {
            return -1;
        } else if (a[key] > b[key]) {
            return 1;
        }
        return 0;
    });
}

let dataFolder: string;
export function getDataFolder() {
    if (!dataFolder) {
        dataFolder = knownFolders.externalDocuments().path;
    }
    return dataFolder;
}

let itemsDataFolder: string;
export function getItemsDataFolder() {
    if (!itemsDataFolder) {
        itemsDataFolder = ApplicationSettings.getString('items_data_folder', knownFolders.externalDocuments().path);
    }
    return itemsDataFolder;
}
export function setItemsDataFolder(value: string) {
    itemsDataFolder = value;
    ApplicationSettings.setString('items_data_folder', value);
}
export function resetItemsDataFolder() {
    ApplicationSettings.remove('items_data_folder');
    itemsDataFolder = null;
    return getItemsDataFolder();
}

function getTreeUri(context, uri) {
    let documentId = android.provider.DocumentsContract.getTreeDocumentId(uri);
    if (android.provider.DocumentsContract.isDocumentUri(context, uri)) {
        documentId = android.provider.DocumentsContract.getDocumentId(uri);
    }

    return android.provider.DocumentsContract.buildDocumentUriUsingTree(uri, documentId);
}

export function listFolder(folderPath: string): (Partial<FileSystemEntity> & { isFolder: boolean })[] {
    // if (ANDROID_30) {
    //     const uri = android.net.Uri.parse(folderPath);
    //     const context: android.app.Activity = androidApp.foregroundActivity || androidApp.startActivity;
    //     const result = [];
    //     const treeDocumentUri = getTreeUri(context, uri);
    //     const childrenUri = android.provider.DocumentsContract.buildChildDocumentsUriUsingTree(treeDocumentUri, android.provider.DocumentsContract.getTreeDocumentId(treeDocumentUri));
    //     const cursor = context.getContentResolver().query(childrenUri, null, null, null, null);

    //     const idIndex = cursor.getColumnIndex(android.provider.DocumentsContract.Document.COLUMN_DOCUMENT_ID);
    //     const nameIndex = cursor.getColumnIndex(android.provider.OpenableColumns.DISPLAY_NAME);
    //     const mimeIndex = cursor.getColumnIndex('mime_type');
    //     while (cursor?.moveToNext()) {
    //         const name = cursor.getString(nameIndex);
    //         const mimeType = cursor.getString(mimeIndex);
    //         // const childUri = android.provider.DocumentsContract.buildChildDocumentsUriUsingTree(uri, docId);
    //         // console.log('childUri', name, docId, childUri);

    //         const documentUri = android.provider.DocumentsContract.buildDocumentUriUsingTree(treeDocumentUri, cursor.getString(idIndex));
    //         result.push({
    //             name,
    //             mimeType,
    //             isFolder: mimeType === 'vnd.android.document/directory', //android.provider.DocumentsContract.Document.MIME_TYPE_DIR
    //             path: getTreeUri(context, documentUri).toString()
    //         } as any);
    //     }
    //     return result;
    // } else {
    const docFolder = Folder.fromPath(folderPath);
    return docFolder.getEntitiesSync().map((f) => {
        f['isFolder'] = Folder.exists(f.path);
        return f as any;
    });
    // }
}

export function listFolderFiles(folderPath: string, prefix?: string, currentValues?: string[]): string[] {
    const docFolder = Folder.fromPath(folderPath);
    currentValues = currentValues || [];
    docFolder.getEntitiesSync().forEach((f) => {
        if (Folder.exists(f.path)) {
            f['isFolder'] = true;
            listFolderFiles(f.path, f.name, currentValues);
        } else {
            currentValues.push(prefix ? path.join(prefix, f.name) : f.name);
        }
    });
    return currentValues;
}
export function getSavedMBTilesDir() {
    return savedMBTilesDir;
}
export function setSavedMBTilesDir(value) {
    savedMBTilesDir = value;
    if (value) {
        ApplicationSettings.setString('local_mbtiles_directory', value);
    } else {
        ApplicationSettings.remove('local_mbtiles_directory');
    }
}

export function getAndroidRealPath(src: string) {
    if (__ANDROID__) {
        let filePath = '';

        // ExternalStorageProvider
        // const uri  = android.net.Uri.parse(android.net.Uri.decode(src));
        const docId = android.net.Uri.decode(src);
        // console.log('docId', docId);
        const split = docId.split(':');
        const type = split[split.length - 2];

        if ('primary' === type) {
            return android.os.Environment.getExternalStorageDirectory().getPath() + '/' + split[split.length - 1];
        } else {
            // if (Build.VERSION.SDK_INT > Build.VERSION_CODES.KITKAT) {
            //getExternalMediaDirs() added in API 21
            const external = Utils.android.getApplicationContext().getExternalMediaDirs();
            if (external.length > 1) {
                filePath = external[1].getAbsolutePath();
                filePath = filePath.substring(0, filePath.indexOf('Android')) + split[split.length - 1];
            }
            // } else {
            //     filePath = "/storage/" + type + "/" + split[1];
            // }
            return filePath;
        }
    }
    return src;
}
export function getFileNameThatICanUseInNativeCode(context: android.app.Activity, filePath: string) {
    // if (__IOS__) {
    return filePath;
    // }
    // const uri = android.net.Uri.parse(filePath);
    // console.log('getFileNameThatICanUseInNativeCode', filePath, uri);
    // const mParcelFileDescriptor = context.getContentResolver().openFileDescriptor(uri, 'r');
    // console.log('mParcelFileDescriptor', mParcelFileDescriptor);
    // if (mParcelFileDescriptor != null) {
    //     const fd = mParcelFileDescriptor.getFd();
    //     return '/proc/self/fd/' + fd;
    //     const file = new java.io.File('/proc/self/fd/' + fd);
    //     try {
    //         if (sdkVersion >= 21) {
    //             return android.system.Os.readlink(file.getAbsolutePath()).toString();
    //         }
    //     } catch (e) {
    //         console.error(e);
    //     }

    //     return filePath;
    // } else {
    //     return null;
    // }
}

export function permResultCheck(r) {
    if (Array.isArray(r)) {
        return r[0] === 'authorized';
    } else {
        const unauthorized = Object.keys(r).some((s) => r[s] !== 'authorized');
        return !unauthorized;
    }
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

export function groupBy<T>(items: readonly T[], keyGetter: (item: T) => string) {
    const result = {};
    items.forEach((item) => {
        const key = keyGetter(item);
        result[key] = item;
    });
    return result;
}

export async function openApp(appID, storeUrl?) {
    // DEV_LOG && console.log('openApp', appID, await available(appID));
    // if (await available(appID)) {
    if (__ANDROID__) {
        const context = Utils.android.getApplicationContext();
        const intent = context.getPackageManager().getLaunchIntentForPackage(appID);
        if (intent) {
            intent.addFlags(android.content.Intent.FLAG_ACTIVITY_NEW_TASK);
            context.startActivity(intent);
            return true;
        }
    } else {
        return Utils.openUrl(appID);
    }
    // } else {
    //     if (__ANDROID__) {
    //         const Intent = android.content.Intent;
    //         const intent = new Intent(Intent.ACTION_VIEW, android.net.Uri.parse('market://details?id=' + appID));
    //         const activity = Application.android.foregroundActivity || Application.android.startActivity;
    //         activity.startActivity(intent);
    //     } else if (storeUrl) {
    //         DEV_LOG && console.log('openUrl', storeUrl);
    //         Utils.openUrl(storeUrl);
    //     }
    // }
    return false;
}

export async function showApp() {
    return openApp(__APP_ID__);
    // if (__ANDROID__) {
    //     const context = Utils.android.getApplicationContext();
    //     const activityClass = (com as any).tns.NativeScriptActivity.class;
    //     const intent = new android.content.Intent(context, activityClass);
    //     if (intent) {
    //         intent.setAction(android.content.Intent.ACTION_MAIN);
    //         intent.addCategory(android.content.Intent.CATEGORY_LAUNCHER);
    //         context.startActivity(intent);
    //     }
    // }
}

export function iosExecuteOnMainThread(callback) {
    if (__IOS__) {
        executeOnMainThread(callback);
    } else {
        callback();
    }
}

export function compareArrays(a1: any[], a2: any[]) {
    let i = a1?.length;
    if (i !== a2?.length) {
        return false;
    }
    while (i--) {
        if (a1[i] !== a2[i]) return false;
    }
    return true;
}

export async function promiseSeq(tasks, delay = 0) {
    const results = [];
    for (const task of tasks) {
        results.push(await task());
        if (delay) {
            await new Promise((resolve) => setTimeout(resolve, delay));
        }
    }
    return results;
}

export function setCustomCssRootClass(className, oldClassName?) {
    const rootView = Application.getRootView();
    const rootModalViews = rootView._getRootModalViews();
    DEV_LOG && console.log('setCustomCssRootClass', rootView, className, oldClassName);
    function addCssClass(rootView, cssClass) {
        cssClass = `${CSSUtils.CLASS_PREFIX}${cssClass}`;
        CSSUtils.pushToSystemCssClasses(cssClass);
        rootView.cssClasses.add(cssClass);
        rootModalViews.forEach((rootModalView) => {
            rootModalView.cssClasses.add(cssClass);
        });
    }
    function removeCssClass(rootView, cssClass) {
        cssClass = `${CSSUtils.CLASS_PREFIX}${cssClass}`;
        CSSUtils.removeSystemCssClass(cssClass);
        rootView.cssClasses.delete(cssClass);
        rootModalViews.forEach((rootModalView) => {
            rootModalView.cssClasses.delete(cssClass);
        });
    }
    addCssClass(rootView, className);
    if (oldClassName) {
        removeCssClass(rootView, oldClassName);
    }
}
