import { showSnack } from '~/utils/ui';
import { ApplicationSettings, Color, Utils, View, path } from '@nativescript/core';
import { Dayjs } from 'dayjs';
import { getDataFolder, getSavedMBTilesDir as getSavedMBTilesPath, setSavedMBTilesDir } from './index.common';

export * from './index.common';
export function checkManagePermission() {
    return true;
}
export async function askForManagePermission() {
    return true;
}
export async function askForScheduleAlarmPermission() {
    return true;
}

const MBTILES_BOOKMARK_KEY = 'local_mbtiles_bookmark';
let mbtilesBookmarkResolved = false;

// the Mac sandbox only grants a picked folder until quit, a security-scoped bookmark keeps it
export function setMBTilesFolder(folderUrl: NSURL) {
    folderUrl.startAccessingSecurityScopedResource();
    const bookmark = folderUrl.bookmarkDataWithOptionsIncludingResourceValuesForKeysRelativeToURLError(NSURLBookmarkCreationOptions.WithSecurityScope, null, null);
    NSUserDefaults.standardUserDefaults.setObjectForKey(bookmark, MBTILES_BOOKMARK_KEY);
    mbtilesBookmarkResolved = true;
    setSavedMBTilesDir(folderUrl.path);
}

function resolveMBTilesBookmark() {
    const bookmark = NSUserDefaults.standardUserDefaults.dataForKey(MBTILES_BOOKMARK_KEY);
    if (!bookmark) {
        return;
    }
    try {
        const isStale = new interop.Reference(interop.types.bool, false);
        const folderUrl = NSURL.URLByResolvingBookmarkDataOptionsRelativeToURLBookmarkDataIsStaleError(bookmark, NSURLBookmarkResolutionOptions.WithSecurityScope, null, isStale);
        if (isStale.value) {
            setMBTilesFolder(folderUrl);
        } else {
            folderUrl.startAccessingSecurityScopedResource();
            setSavedMBTilesDir(folderUrl.path);
        }
    } catch (error) {
        console.error('resolveMBTilesBookmark', error, error.stack);
        NSUserDefaults.standardUserDefaults.removeObjectForKey(MBTILES_BOOKMARK_KEY);
        setSavedMBTilesDir(null);
    }
}

export function getSavedMBTilesDir() {
    if (__CATALYST__ && !mbtilesBookmarkResolved) {
        mbtilesBookmarkResolved = true;
        resolveMBTilesBookmark();
    }
    return getSavedMBTilesPath();
}

export async function getDefaultMBTilesDir() {
    if (__CATALYST__) {
        const pickedFolder = getSavedMBTilesDir();
        if (pickedFolder) {
            return pickedFolder;
        }
    }
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
    if (fileManager.fileExistsAtPathIsDirectory(sourceLocationPath, true as any)) {
        if (!fileManager.fileExistsAtPathIsDirectory(targetLocationPath, true as any)) {
            fileManager.createDirectoryAtPathAttributes(targetLocationPath, null);
        }

        const children = fileManager.contentsOfDirectoryAtPathError(sourceLocationPath);
        for (let i = 0; i < children.count; i++) {
            moveFileOrFolder(path.join(sourceLocationPath, children.objectAtIndex(i)), path.join(targetLocationPath, children.objectAtIndex(i)));
        }
    } else {
        if (fileManager.fileExistsAtPathIsDirectory(targetLocationPath, false as any)) {
            fileManager.removeItemAtPathError(targetLocationPath);
        }
        fileManager.copyItemAtPathToPathError(sourceLocationPath, targetLocationPath);
    }
}

export function startRefreshAlarm() {
}
export function stopRefreshAlarm() {
}
export function scheduleRefreshAlarm(){
}

export const setTimeout = global.__ns__setTimeout;
export const setInterval = global.__ns__setInterval;
export const clearTimeout = global.__ns__clearTimeout;
export const clearInterval = global.__ns__clearInterval;
