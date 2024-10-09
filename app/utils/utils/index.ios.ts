import { showSnack } from '~/utils/ui';
import { ApplicationSettings, Color, Utils, View, path } from '@nativescript/core';
import { Dayjs } from 'dayjs';
import { getDataFolder, setSavedMBTilesDir } from './index.common';

export * from './index.common';
export function checkManagePermission() {
    return true;
}
export async function askForManagePermission() {
    return true;
}

export async function getDefaultMBTilesDir() {
    // on iOS we cant save the path as the knownFolders path can change upon app upgrade
    // let localMbtilesSource = savedMBTilesDir;
    // let localMbtilesSource = null;

    // if (!localMbtilesSource) {
    const localMbtilesSource = path.normalize(path.join(getDataFolder(), 'alpimaps_mbtiles'));
    // DEV_LOG && console.log('resultPath', resultPath);
    // if (resultPath) {
    // localMbtilesSource = resultPath;
    // setSavedMBTilesDir(localMbtilesSource);
    // ApplicationSettings.setString('local_mbtiles_directory', resultPath);
    // }
    // }
    DEV_LOG && console.log('getDefaultMBTilesDir', localMbtilesSource);
    return localMbtilesSource;
}

export function enableShowWhenLockedAndTurnScreenOn() {
    // NO OP on iOS
}
export function disableShowWhenLockedAndTurnScreenOn() {
    // NO OP on iOS
}

export async function pickDate(currentDate: Dayjs) {
    // return new Promise<number>((resolve, reject) => {
    //     const datePicker = com.google.android.material.datepicker.MaterialDatePicker.Builder.datePicker().setTitleText(lc('pick_date')).setSelection(new java.lang.Long(currentDate.valueOf())).build();
    //     datePicker.addOnDismissListener(
    //         new android.content.DialogInterface.OnDismissListener({
    //             onDismiss: () => {
    //                 resolve(datePicker.getSelection().longValue());
    //             }
    //         })
    //     );
    //     const parentView = Frame.topmost() || getRootView();
    //     datePicker.show(parentView._getRootFragmentManager(), 'datepicker');
    // });
}

export async function pickTime(currentDate: Dayjs) {
    // return new Promise<[number, number]>((resolve, reject) => {
    //     const timePicker = new (com.google.android.material as any).timepicker.MaterialTimePicker.Builder()
    //         .setTimeFormat(clock_24 ? 1 : 0)
    //         .setInputMode(0)
    //         .setTitleText(lc('pick_time'))
    //         .setHour(currentDate.get('h'))
    //         .setMinute(currentDate.get('m'))
    //         .build();
    //     timePicker.addOnDismissListener(
    //         new android.content.DialogInterface.OnDismissListener({
    //             onDismiss: () => {
    //                 resolve([timePicker.getMinute(), timePicker.getHour()]);
    //             }
    //         })
    //     );
    //     const parentView = Frame.topmost() || getRootView();
    //     timePicker.show(parentView._getRootFragmentManager(), 'timepicker');
    // });
}
export async function pickColor(color: Color, view?: View) {}

export function showToolTip(tooltip: string, view?: View) {
    showSnack({ message: tooltip });
}

export function moveFileOrFolder(sourceLocationPath: string, targetLocationPath: string, fileManager: NSFileManager = NSFileManager.defaultManager) {
    if (fileManager.fileExistsAtPathIsDirectory(sourceLocationPath, true)) {
        if (!fileManager.fileExistsAtPathIsDirectory(targetLocationPath, true)) {
            fileManager.createDirectoryAtPathAttributes(targetLocationPath, null);
        }

        const children = fileManager.contentsOfDirectoryAtPathError(sourceLocationPath);
        for (let i = 0; i < children.count; i++) {
            moveFileOrFolder(path.join(sourceLocationPath, children.objectAtIndex(i)), path.join(targetLocationPath, children.objectAtIndex(i)));
        }
    } else {
        if (fileManager.fileExistsAtPathIsDirectory(targetLocationPath, false)) {
            fileManager.removeItemAtPathError(targetLocationPath);
        }
        fileManager.copyItemAtPathToPathError(sourceLocationPath, targetLocationPath);
    }
}

export const setTimeout = global.__ns__setTimeout;
export const setInterval = global.__ns__setInterval;
export const clearTimeout = global.__ns__clearTimeout;
export const clearInterval = global.__ns__clearInterval;
