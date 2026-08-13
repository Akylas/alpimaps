import { tryCatchFunction } from '@shared/utils/ui';
import { derived, get, writable } from 'svelte/store';
import { lc, lt } from '~/helpers/locale';
import { registerMapFeature } from '~/mapModules/mapFeatures';
import { NOTIFICATION_CHANEL_ID_KEEP_AWAKE_CHANNEL, NotificationHelper } from '~/services/android/NotifcationHelper';
import { settingsStore } from '~/stores/settingsStore';
import { disableShowWhenLockedAndTurnScreenOn, enableShowWhenLockedAndTurnScreenOn } from '~/utils/utils';
import { colors } from '~/variables';

const KEEP_AWAKE_NOTIFICATION_ID = 23466578;

/** Read by the map's page element, which is what actually holds the screen on. */
export const keepScreenAwake = settingsStore('_keep_awake', false);
/** Not persisted: full brightness is a per-session choice, reachable by long-pressing the button. */
export const keepScreenAwakeFullBrightness = writable(false);
export const showOnLockscreen = writable(false);

// a screen held on with no visible reason is worth telling the user about, and gives them a way back
keepScreenAwake.subscribe((value) => {
    if (!__ANDROID__) {
        return;
    }
    if (value) {
        NotificationHelper.showNotification({ title: lt('screen_awake_notification'), channel: NOTIFICATION_CHANEL_ID_KEEP_AWAKE_CHANNEL }, KEEP_AWAKE_NOTIFICATION_ID);
    } else {
        NotificationHelper.hideNotification(KEEP_AWAKE_NOTIFICATION_ID);
    }
});

const switchShowOnLockscreen = tryCatchFunction(async () => {
    if (get(showOnLockscreen)) {
        disableShowWhenLockedAndTurnScreenOn();
        showOnLockscreen.set(false);
    } else {
        enableShowWhenLockedAndTurnScreenOn();
        showOnLockscreen.set(true);
    }
});

registerMapFeature({
    id: 'screenAwake',
    sideButtons: derived([keepScreenAwake, showOnLockscreen, colors], ([$keepScreenAwake, $showOnLockscreen, $colors]) =>
        [
            {
                id: 'keepAwake',
                order: 40,
                text: $keepScreenAwake ? 'mdi-sleep' : 'mdi-sleep-off',
                tooltip: lc('keep_screen_awake'),
                isSelected: $keepScreenAwake,
                selectedColor: $colors.colorError,
                onTap: () => keepScreenAwake.set(!$keepScreenAwake),
                onLongPress: () => keepScreenAwakeFullBrightness.update((full) => !full)
            }
        ].concat(
            __ANDROID__
                ? [
                      {
                          id: 'lockscreen',
                          order: 50,
                          text: 'mdi-cellphone-lock',
                          tooltip: lc('show_screen_lock'),
                          isSelected: $showOnLockscreen,
                          selectedColor: undefined,
                          onTap: switchShowOnLockscreen,
                          onLongPress: undefined
                      }
                  ]
                : []
        )
    )
});
