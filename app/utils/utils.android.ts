export * from './utils.common';
import { Application, ApplicationSettings, Color, Device, Frame, Utils, View, path } from '@nativescript/core';
import { Dayjs } from 'dayjs';
import { AndroidActivityResultEventData, AndroidApplication, getRootView } from '@nativescript/core/application';
import { lc } from '@nativescript-community/l';
import { clock_24 } from '~/helpers/locale';
import { request } from '@nativescript-community/perms';
import { getDataFolder, permResultCheck, setSavedMBTilesDir } from './utils.common';

export const sdkVersion = parseInt(Device.sdkVersion, 10);
const ANDROID_30 = __ANDROID__ && sdkVersion >= 30;

export function checkManagePermission() {
    return !ANDROID_30 || android.os.Environment.isExternalStorageManager();
}
export async function askForManagePermission() {
    const activity = Application.android.startActivity as androidx.appcompat.app.AppCompatActivity;
    if (checkManagePermission()) {
        return true;
    }
    //If the draw over permission is not available open the settings screen
    //to grant the permission.
    return new Promise<boolean>((resolve, reject) => {
        const REQUEST_CODE = 6646;
        const onActivityResultHandler = (data: AndroidActivityResultEventData) => {
            if (data.requestCode === REQUEST_CODE) {
                Application.android.off(AndroidApplication.activityResultEvent, onActivityResultHandler);
                resolve(android.provider.Settings.canDrawOverlays(activity));
            }
        };
        Application.android.on(AndroidApplication.activityResultEvent, onActivityResultHandler);
        const intent = new android.content.Intent(android.provider.Settings.ACTION_MANAGE_APP_ALL_FILES_ACCESS_PERMISSION, android.net.Uri.parse('package:' + __APP_ID__));
        activity.startActivityForResult(intent, REQUEST_CODE);
    });
}

export async function getDefaultMBTilesDir() {
    // let localMbtilesSource = savedMBTilesDir;
    let localMbtilesSource = null;
    const result = await request('storage');

    if (!permResultCheck(result)) {
        throw new Error('missing_storage_permission');
    }

    if (ANDROID_30) {
        await askForManagePermission();
        if (!checkManagePermission()) {
            throw new Error('missing_manage_permission');
        }
    }
    if (!localMbtilesSource) {
        const resultPath = path.normalize(path.join(getDataFolder(), '../../../../alpimaps_mbtiles'));
        DEV_LOG && console.log('resultPath', resultPath);
        if (resultPath) {
            localMbtilesSource = resultPath;
            setSavedMBTilesDir(localMbtilesSource);
            ApplicationSettings.setString('local_mbtiles_directory', resultPath);
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

export async function pickColor(color: Color, view?: View) {
    return new Promise<Color>((resolve) => {
        const activity = Application.android.startActivity;
        if (!(color instanceof Color)) {
            color = new Color(color as any);
        }
        const builder = new com.skydoves.colorpickerview.ColorPickerDialog.Builder(activity)
            .setTitle(lc('pick_color'))
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
            .attachAlphaSlideBar(true) // the default value is true.
            .attachBrightnessSlideBar(true) // the default value is true.
            .setBottomSpace(12); // set a bottom space between the last slidebar and buttons.

        builder.getColorPickerView().setInitialColor(color.android);
        const popup = builder.create();
        popup.show();
    });
}

export function showToolTip(tooltip: string, view?: View) {
    android.widget.Toast.makeText(Utils.ad.getApplicationContext(), tooltip, android.widget.Toast.LENGTH_SHORT).show();
}
