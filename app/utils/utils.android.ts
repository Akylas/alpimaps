export * from './utils.common';
import { sdkVersion } from './utils.common';
import { Application, Frame } from '@nativescript/core';
import { Dayjs } from 'dayjs';
import { getRootView } from '@nativescript/core/application';
import { lc } from '@nativescript-community/l';

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
            .setTimeFormat(1)
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
