import { Application, Color, Device, FileSystemEntity, Folder, View } from '@nativescript/core';
import * as app from '@nativescript/core/application';
import { android as androidApp } from '@nativescript/core/application';
import * as appSettings from '@nativescript/core/application-settings';
import { knownFolders, path } from '@nativescript/core/file-system';
import { lc } from '~/helpers/locale';
import { pickFolder } from '@nativescript-community/ui-document-picker';
import lazy from '@nativescript/core/utils/lazy';

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
    if (__ANDROID__) {
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
            const count = nArray.length;
            if (nArray.length > 1) {
                for (let i = count - 1; i >= 0; i--) {
                    dataFolder = nArray[i]?.getAbsolutePath();
                    if (dataFolder) {
                        break;
                    }
                }
            }
        }
    }
    if (!dataFolder) {
        dataFolder = knownFolders.temp().path;
        // } else {
        //     if (__ANDROID__ && Folder.exists(path.join(dataFolder, '../../../..', 'alpimaps_mbtiles'))) {
        //         dataFolder = path.join(dataFolder, '../../../..', 'alpimaps_mbtiles');
        //     }
    }
    // if (TNS_ENV !== 'production') {
    //     dataFolder = path.join(dataFolder, 'dev');
    // }
    return dataFolder;
}

function getTreeUri(context, uri) {
    let documentId = android.provider.DocumentsContract.getTreeDocumentId(uri);
    if (android.provider.DocumentsContract.isDocumentUri(context, uri)) {
        documentId = android.provider.DocumentsContract.getDocumentId(uri);
    }

    return android.provider.DocumentsContract.buildDocumentUriUsingTree(uri, documentId);
}

export function listFolder(folderPath: string): (Partial<FileSystemEntity> & { isFolder: boolean })[] {
    if (__ANDROID__ && sdkVersion() >= 30) {
        const uri = android.net.Uri.parse(folderPath);
        const context: android.app.Activity = androidApp.foregroundActivity || androidApp.startActivity;
        const result = [];
        const treeDocumentUri = getTreeUri(context, uri);
        const childrenUri = android.provider.DocumentsContract.buildChildDocumentsUriUsingTree(treeDocumentUri, android.provider.DocumentsContract.getTreeDocumentId(treeDocumentUri));
        const cursor = context.getContentResolver().query(childrenUri, null, null, null, null);

        const idIndex = cursor.getColumnIndex(android.provider.DocumentsContract.Document.COLUMN_DOCUMENT_ID);
        const nameIndex = cursor.getColumnIndex(android.provider.OpenableColumns.DISPLAY_NAME);
        const mimeIndex = cursor.getColumnIndex('mime_type');
        while (cursor?.moveToNext()) {
            const name = cursor.getString(nameIndex);
            const mimeType = cursor.getString(mimeIndex);
            // const childUri = android.provider.DocumentsContract.buildChildDocumentsUriUsingTree(uri, docId);
            // console.log('childUri', name, docId, childUri);

            const documentUri = android.provider.DocumentsContract.buildDocumentUriUsingTree(treeDocumentUri, cursor.getString(idIndex));
            result.push({
                name,
                mimeType,
                isFolder: mimeType === 'vnd.android.document/directory', //android.provider.DocumentsContract.Document.MIME_TYPE_DIR
                path: getTreeUri(context, documentUri).toString()
            } as any);
        }
        return result;
    } else {
        const docFolder = Folder.fromPath(folderPath);
        return docFolder.getEntitiesSync().map((f) => {
            f['isFolder'] = Folder.exists(f.path);
            return f as any;
        });
    }
}

let savedMBTilesDir = appSettings.getString('local_mbtiles_directory');

export function getSavedMBTilesDir() {
    return savedMBTilesDir;
}
export const sdkVersion = lazy(() => parseInt(Device.sdkVersion, 10));

export function getAndroidRealPath(src) {
    let filePath = '';

    // ExternalStorageProvider
    // const uri  = android.net.Uri.parse(android.net.Uri.decode(src));
    const docId = android.net.Uri.decode(src);
    // console.log('docId', docId);
    const split = docId.split(':');
    const type = split[split.length - 2];

    if ('primary' === type) {
        return android.os.Environment.getExternalStorageDirectory() + '/' + split[split.length - 1];
    } else {
        // if (Build.VERSION.SDK_INT > Build.VERSION_CODES.KITKAT) {
        //getExternalMediaDirs() added in API 21
        const external = androidApp.context.getExternalMediaDirs();
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
    //         if (sdkVersion() >= 21) {
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
export async function getDefaultMBTilesDir() {
    let localMbtilesSource = sdkVersion() >= 30 ? savedMBTilesDir : null;
    if (__ANDROID__ && localMbtilesSource && sdkVersion() >= 30) {
        const context: android.app.Activity = androidApp.foregroundActivity || androidApp.startActivity;
        const granted = context.getContentResolver().getPersistedUriPermissions();
        let found = false;
        for (let index = 0; index < granted.size(); index++) {
            if (localMbtilesSource === granted.get(index).getUri().toString()) {
                // localMbtilesSource = getFileNameThatICanUseInNativeCode(context, granted.get(index).getUri());
                found = true;
                break;
            }
        }
        if (!found) {
            localMbtilesSource = savedMBTilesDir = null;
            appSettings.remove('local_mbtiles_directory');
        }
    }
    if (!localMbtilesSource) {
        let resultPath;
        if (__ANDROID__) {
            if (sdkVersion() >= 30) {
                const result = await pickFolder({
                    permissions: {
                        read: true,
                        persistable: true
                    }
                });
                console.log('result1', result);
                resultPath = result.folders[0];
            } else {
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
                    resultPath = path.join(sdcardFolder, '../../../..', 'alpimaps_mbtiles');
                } else if (result.length > 0) {
                    const sdcardFolder = result[0].getAbsolutePath();
                    resultPath = path.join(sdcardFolder, '../../../..', 'alpimaps_mbtiles');
                }
            }
        } else {
            try {
                const docFolder = knownFolders.documents();
                const folders = docFolder.getEntitiesSync();
                const index = folders.findIndex((e) => e.path.endsWith('alpimaps_mbtiles'));
                if (index !== -1) {
                    resultPath = folders[index].path;
                }
            } catch (error) {
                console.error(error);
            }
        }
        if (resultPath) {
            localMbtilesSource = resultPath;
            savedMBTilesDir = localMbtilesSource;
            appSettings.setString('local_mbtiles_directory', resultPath);
        }
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
        if (__ANDROID__) {
            const activity = Application.android.startActivity;
            const nView = view ? view.nativeView : activity.getWindow().getDecorView().getRootView();
            if (!(color instanceof Color)) {
                color = new Color(color as any);
            }
            const builder = new com.skydoves.colorpickerview.ColorPickerDialog.Builder(activity)
                .setTitle('ColorPicker Dialog')
                .setPreferenceName('MyColorPickerDialog')
                .setPositiveButton(
                    lc('choose'),
                    new com.skydoves.colorpickerview.listeners.ColorListener({
                        onColorSelected(color: number) {
                            console.log('onColorSelected', color, new Color(color));
                            resolve(new Color(color));
                        }
                    })
                )
                .setNegativeButton(
                    lc('cancel'),
                    new android.content.DialogInterface.OnClickListener({
                        onClick(dialogInterface) {
                            dialogInterface.dismiss();
                            console.log('dismiss');
                            resolve(null);
                        }
                    })
                )
                .attachAlphaSlideBar(true) // the default value is true.
                .attachBrightnessSlideBar(true) // the default value is true.
                .setBottomSpace(12); // set a bottom space between the last slidebar and buttons.

            builder.getColorPickerView().setInitialColor(color.android);
            const popup = builder.create();
            popup.show();
        }
    });
}
