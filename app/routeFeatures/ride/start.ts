// starting a navigation: whether it records the ride is the user's setting, a long press, or an answer
import { confirm } from '@nativescript-community/ui-dialogs';
import { get } from 'svelte/store';
import { lc } from '~/helpers/locale';
import type { Item } from '~/models/Item';
import { type RecordChoice, answerRecordChoice, startPlan } from '~/routeFeatures/ride/mode';
import { navigationService } from '~/services/NavigationService';
import { navigationRecordMode } from '~/stores/navigationStore';
import { showToast } from '~/utils/ui';

// not cancelable: a ride that starts without an answer is a ride that is not recorded, which nobody can take back
async function askRecordChoice(): Promise<RecordChoice> {
    const result = await confirm({
        title: lc('record_ride_title'),
        message: lc('record_ride_message'),
        okButtonText: lc('record'),
        neutralButtonText: lc('always'),
        cancelButtonText: lc('never'),
        cancelable: false
    });
    // the neutral button answers nothing
    return result === true ? 'record' : result === false ? 'never' : 'always';
}

/** @param longPress the start button was long pressed: record this ride, whatever the setting */
export async function beginNavigation(item: Item, longPress = false) {
    const plan = startPlan(get(navigationRecordMode), longPress);
    let record = plan.record;
    if (plan.prompt) {
        const answer = answerRecordChoice(await askRecordChoice());
        record = answer.record;
        if (answer.mode) {
            navigationRecordMode.set(answer.mode);
        }
    }
    await navigationService.start(item, { record });
    if (plan.toast) {
        showToast(lc('navigation_recording_started'));
    }
}
