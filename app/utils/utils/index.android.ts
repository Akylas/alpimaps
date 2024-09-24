export * from './index.common';
import { Application, ApplicationSettings, Color, Device, File, Folder, Frame, Utils, View, path } from '@nativescript/core';
import { Dayjs } from 'dayjs';
import { AndroidActivityResultEventData, AndroidApplication, getRootView } from '@nativescript/core/application';
import { lc } from '@nativescript-community/l';
import { clock_24 } from '~/helpers/locale';
import { request } from '@nativescript-community/perms';
import { getDataFolder, getSavedMBTilesDir, permResultCheck, setSavedMBTilesDir } from './index.common';

export const sdkVersion = parseInt(Device.sdkVersion, 10);
export const ANDROID_30 = __ANDROID__ && sdkVersion >= 30;

export function checkManagePermission() {
    return !ANDROID_30 || android.os.Environment.isExternalStorageManager();
}
export async function askForManagePermission() {
    const activity = Application.android.startActivity;
    if (checkManagePermission()) {
        return true;
    }
    //If the draw over permission is not available open the settings screen
    //to grant the permission.
    return new Promise<boolean>((resolve, reject) => {
        const REQUEST_CODE = 6646;
        const onActivityResultHandler = (data: AndroidActivityResultEventData) => {
            if (data.requestCode === REQUEST_CODE) {
                Application.android.off(Application.android.activityResultEvent, onActivityResultHandler);
                resolve(android.provider.Settings.canDrawOverlays(activity));
            }
        };
        Application.android.on(Application.android.activityResultEvent, onActivityResultHandler);
        const intent = new android.content.Intent(android.provider.Settings.ACTION_MANAGE_APP_ALL_FILES_ACCESS_PERMISSION, android.net.Uri.parse('package:' + __APP_ID__));
        activity.startActivityForResult(intent, REQUEST_CODE);
    });
}

export async function getDefaultMBTilesDir() {
    let localMbtilesSource = getSavedMBTilesDir();
    if (localMbtilesSource && !File.exists(localMbtilesSource)) {
        localMbtilesSource = null;
        setSavedMBTilesDir(null);
    }
    // let localMbtilesSource = null;
    if (!ANDROID_30) {
        // storage permission is not needed
        // and will report never_ask_again on >= 33
        const result = await request('storage', { read: true, write: true });

        DEV_LOG && console.log('storage', result);
        if (!permResultCheck(result)) {
            throw new Error(lc('missing_storage_permission'));
        }

        // if (__ANDROID__) {
        //     (async function test() {
        //         try {
        //             console.log('localMbtilesSource', localMbtilesSource);
        //             const file = new java.io.File(path.join(localMbtilesSource, '..'));
        //             const document = androidx.documentfile.provider.DocumentFile.fromFile(file);
        //             const result = document.createDirectory('test');
        //             // const testFolder = Folder.fromPath(path.join(getDataFolder(), '..', 'test'));
        //             // const result = file.mkdirs();
        //             console.log('test', result, Folder.exists(file.getAbsolutePath()), file.exists(), file.getAbsolutePath());

        //             if (!file.exists()) {
        //                 const testFolder = Folder.fromPath(path.join(localMbtilesSource, '..', 'test'));
        //                 console.log('testFolder', testFolder, Folder.exists(file.getAbsolutePath()), file.exists());
        //             }
        //         } catch (error) {
        //             console.error(error, error.stack);
        //         }
        //     })();
        // }
    }
    if (ANDROID_30 && !PLAY_STORE_BUILD) {
        await askForManagePermission();
        if (!checkManagePermission()) {
            throw new Error(lc('missing_manage_permission'));
        }
    }
    if (!localMbtilesSource) {
        const resultPath = path.normalize(path.join(getDataFolder(), '../../../../alpimaps_mbtiles'));
        DEV_LOG && console.log('resultPath', resultPath);
        if (resultPath) {
            localMbtilesSource = resultPath;
            setSavedMBTilesDir(localMbtilesSource);
        }
    }

    DEV_LOG && console.log('getDefaultMBTilesDir', localMbtilesSource);
    return localMbtilesSource;
}

export function enableShowWhenLockedAndTurnScreenOn() {
    const activity = Application.android.startActivity as android.app.Activity;
    if (sdkVersion >= 27) {
        activity.setShowWhenLocked(true);
        // this.setTurnScreenOn(true);
    } else {
        activity.getWindow().addFlags(
            524288 // android.view.WindowManager.LayoutParams.FLAG_SHOW_WHEN_LOCKED
        );
    }
}
export function disableShowWhenLockedAndTurnScreenOn() {
    const activity = Application.android.startActivity as android.app.Activity;
    if (sdkVersion >= 27) {
        activity.setShowWhenLocked(false);
        // this.setTurnScreenOn(false);
    } else {
        activity.getWindow().clearFlags(
            524288 //android.view.WindowManager.LayoutParams.FLAG_SHOW_WHEN_LOCKED
        );
    }
}

export async function pickDate(currentDate: Dayjs) {
    return new Promise<number>((resolve, reject) => {
        const datePicker = com.google.android.material.datepicker.MaterialDatePicker.Builder.datePicker().setTitleText(lc('pick_date')).setSelection(new java.lang.Long(currentDate.valueOf())).build();
        datePicker.addOnDismissListener(
            new android.content.DialogInterface.OnDismissListener({
                onDismiss: () => {
                    resolve(datePicker.getSelection().longValue());
                }
            })
        );
        const parentView = Frame.topmost() || getRootView();
        datePicker.show(parentView._getRootFragmentManager(), 'datepicker');
    });
}

export async function pickTime(currentDate: Dayjs) {
    return new Promise<[number, number]>((resolve, reject) => {
        const timePicker = new (com.google.android.material as any).timepicker.MaterialTimePicker.Builder()
            .setTimeFormat(clock_24 ? 1 : 0)
            .setInputMode(0)
            .setTitleText(lc('pick_time'))
            .setHour(currentDate.get('h'))
            .setMinute(currentDate.get('m'))
            .build();

        timePicker.addOnDismissListener(
            new android.content.DialogInterface.OnDismissListener({
                onDismiss: () => {
                    resolve([timePicker.getMinute(), timePicker.getHour()]);
                }
            })
        );
        const parentView = Frame.topmost() || getRootView();
        timePicker.show(parentView._getRootFragmentManager(), 'timepicker');
    });
}

export async function pickColor(color: Color | string, options: { alpha?: boolean } = {}) {
    return new Promise<Color>((resolve) => {
        const activity = Application.android.startActivity;
        if (!(color instanceof Color)) {
            color = new Color(color as any);
        }
        const builder = new com.skydoves.colorpickerview.ColorPickerDialog.Builder(activity)
            .setTitle(lc('pick_color'))
            .attachAlphaSlideBar(options.alpha !== false)
            .setPositiveButton(
                lc('choose'),
                new com.skydoves.colorpickerview.listeners.ColorListener({
                    onColorSelected(color: number) {
                        resolve(new Color(color));
                    }
                })
            )
            .setNegativeButton(
                lc('cancel'),
                new android.content.DialogInterface.OnClickListener({
                    onClick(dialogInterface) {
                        dialogInterface.dismiss();
                        resolve(null);
                    }
                })
            )
            .setBottomSpace(12); // set a bottom space between the last slidebar and buttons.

        builder.getColorPickerView().setInitialColor(color.android);
        const popup = builder.create();
        popup.show();
    });
}

export function showToolTip(tooltip: string, view?: View) {
    android.widget.Toast.makeText(Utils.android.getApplicationContext(), tooltip, android.widget.Toast.LENGTH_SHORT).show();
}

export function moveFileOrFolder(sourceLocationPath: string, targetLocationPath: string, androidTargetLocationPath?: string) {
    const sourceLocation = new java.io.File(sourceLocationPath);
    const targetLocation = new java.io.File(targetLocationPath);
    if (sourceLocation.isDirectory()) {
        if (!targetLocation.exists()) {
            // const index = androidTargetLocationPath.lastIndexOf('/');
            // const parentPath = androidTargetLocationPath.slice(0, index);
            // const folderName = androidTargetLocationPath.slice(index + 1);
            // const document = androidx.documentfile.provider.DocumentFile.fromTreeUri(Utils.android.getApplicationContext(), android.net.Uri.parse(parentPath));
            // const result = document.createDirectory(folderName);
            const result = targetLocation.mkdirs();
            // console.log('creating folder', parentPath, folderName, result, targetLocation.exists());
        }

        const children = sourceLocation.list();
        for (let i = 0; i < sourceLocation.listFiles().length; i++) {
            moveFileOrFolder(path.join(sourceLocationPath, children[i]), path.join(targetLocationPath, children[i]), androidTargetLocationPath + '/' + children[i]);
        }
    } else {
        if (targetLocation.exists()) {
            targetLocation.delete();
        }
        const context = Utils.android.getApplicationContext();
        // const index = androidTargetLocationPath.lastIndexOf('/');
        // const parentPath = androidTargetLocationPath.slice(0, index);
        // const folderName = androidTargetLocationPath.slice(index+1);
        // const outdocument = androidx.documentfile.provider.DocumentFile.fromTreeUri(Utils.android.getApplicationContext(), android.net.Uri.parse(parentPath));

        const file = new java.io.File(sourceLocationPath);
        let uri = null;
        if (file.exists()) {
            const packageName = context.getPackageName();
            const authority = packageName + '.provider';

            uri = android.net.Uri.parse('content://' + authority + '/' + file.getName());
        }
        // const sourcedocument = androidx.documentfile.provider.DocumentFile.fromTreeUri(Utils.android.getApplicationContext(), uri);
        // const outfile = outdocument.createFile('', androidTargetLocationPath.slice(index + 1));
        // const inStream = context.getContentResolver().openInputStream(sourcedocument.getUri());
        // const out = context.getContentResolver().openOutputStream(outfile.getUri());
        const out = new java.io.FileOutputStream(targetLocation);
        const inStream = new java.io.FileInputStream(sourceLocation);

        // Copy the bits from instream to outstream
        const buf = Array.create('byte', 1024);
        let len;
        while ((len = inStream.read(buf)) > 0) {
            out.write(buf, 0, len);
        }
        inStream.close();
        out.close();
    }
}

export function restartApp() {
    akylas.alpi.maps.Utils.restartApp(Utils.android.getApplicationContext(), Application.android.startActivity);
}

const gSetTimeout = setTimeout;
const gSetInterval = setInterval;
const gClearTimeout = clearTimeout;
const gClearInterval = clearInterval;
export { gSetTimeout as setTimeout, gSetInterval as setInterval, gClearTimeout as clearTimeout, gClearInterval as clearInterval };
