import { DismissReasons } from '@nativescript-community/ui-material-snackbar';
import { ApplicationSettings } from '@nativescript/core';
import { showError } from '@shared/utils/showError';
import { navigate } from '@shared/utils/svelte/ui';
import { readable } from 'svelte/store';
import { lc } from '~/helpers/locale';
import { registerMapFeature } from '~/mapModules/mapFeatures';
import { showSnack } from '~/utils/ui';

const SETTINGS_GESTURES_OFFERED = 'gestures_tutorial_offered';

export async function showGesturesTutorial() {
    try {
        const component = (await import('~/components/tutorial/GesturesTutorial.svelte')).default;
        navigate({ page: component });
    } catch (error) {
        showError(error);
    }
}

/** Once per install, whatever the answer: the page stays reachable from the menu and the settings. */
export async function offerGesturesTutorial() {
    if (ApplicationSettings.getBoolean(SETTINGS_GESTURES_OFFERED, false)) {
        return;
    }
    ApplicationSettings.setBoolean(SETTINGS_GESTURES_OFFERED, true);
    const result = await showSnack({ message: lc('gestures_offer'), actionText: lc('show'), hideDelay: 15000 });
    if (result?.reason === DismissReasons.ACTION) {
        await showGesturesTutorial();
    }
}

registerMapFeature({
    id: 'gestures',
    menuItems: readable([
        {
            id: 'gestures',
            title: lc('gestures_tips'),
            icon: 'mdi-gesture-tap-hold',
            // after the built-in entries and every other feature
            order: 1000,
            run: showGesturesTutorial
        }
    ])
});
