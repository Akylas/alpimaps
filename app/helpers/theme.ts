import Theme from '@nativescript-community/css-theme';
import { closePopover } from '@nativescript-community/ui-popover/svelte';
import { Application, ApplicationSettings, SystemAppearanceChangedEventData, Utils } from '@nativescript/core';
import { getBoolean, getString, setString } from '@nativescript/core/application-settings';
import { SDK_VERSION } from '@nativescript/core/utils';
import { get, writable } from 'svelte/store';
import { lc } from '~/helpers/locale';
import { prefs } from '~/services/preferences';
import { ALERT_OPTION_MAX_HEIGHT } from '~/utils/constants';
import { showError } from '~/utils/error';
import { createGlobalEventListener, globalObservable } from '~/utils/svelte/ui';
import { showAlertOptionSelect } from '~/utils/ui';
import { updateThemeColors } from '~/variables';

export type Themes = 'auto' | 'light' | 'dark' | 'black' | 'eink';

export const onThemeChanged = createGlobalEventListener<Themes>('theme');
export let theme: Themes;
export const sTheme = writable('auto');
export const currentTheme = writable('auto');

let started = false;
let autoDarkToBlack = getBoolean('auto_black', false);
export const forceDarkMode = writable(false);
const ThemeBlack = 'ns-black';

Application.on(Application.systemAppearanceChangedEvent, (event: SystemAppearanceChangedEventData) => {
    DEV_LOG && console.log('systemAppearanceChangedEvent', theme, event.newValue, autoDarkToBlack);
    if (theme === 'auto') {
        event.cancel = true;
        let realTheme = event.newValue as Themes;
        if (autoDarkToBlack && realTheme === 'dark') {
            realTheme = 'black';
        }
        if (__ANDROID__) {
            akylas.alpi.maps.Utils.applyDayNight(Application.android.startActivity, true);
        }
        Theme.setMode(Theme.Auto, undefined, realTheme, false);
        updateThemeColors(realTheme);
        //close any popover as they are not updating with theme yet
        closePopover();
        globalObservable.notify({ eventName: 'theme', data: realTheme });
    }
});

export function getThemeDisplayName(toDisplay = theme) {
    switch (toDisplay) {
        case 'auto':
            return lc('theme.auto');
        case 'dark':
            return lc('theme.dark');
        case 'black':
            return lc('theme.black');
        case 'light':
            return lc('theme.light');
        case 'eink':
            return lc('theme.eink');
    }
}

export function toggleTheme(autoDark = false) {
    const newTheme = theme === 'dark' ? (autoDark ? 'auto' : 'light') : 'dark';
    setString('theme', newTheme);
}
export async function selectTheme() {
    try {
        const actions: Themes[] = ['auto', 'light', 'dark', 'black', 'eink'];
        const component = (await import('~/components/common/OptionSelect.svelte')).default;
        const result = await showAlertOptionSelect(
            component,
            {
                height: Math.min(actions.length * 56, ALERT_OPTION_MAX_HEIGHT),
                rowHeight: 56,
                options: actions
                    .map((k) => ({ name: getThemeDisplayName(k), data: k }))
                    .map((d) => ({
                        ...d,
                        boxType: 'circle',
                        type: 'checkbox',
                        value: theme === d.data
                    }))
            },
            {
                title: lc('select_theme')
            }
        );
        if (result && actions.indexOf(result.data) !== -1) {
            setString('theme', result.data);
        }
    } catch (err) {
        showError(err);
    }
}

const AppCompatDelegate = __ANDROID__ ? androidx.appcompat.app.AppCompatDelegate : undefined;
export function applyTheme(theme: Themes) {
    try {
        DEV_LOG && console.log('applyTheme', theme);
        if (__ANDROID__) {
            if (theme === 'eink') {
                const context = Utils.android.getApplicationContext();
                const themeId = context.getResources().getIdentifier('AppThemeEInk', 'style', context.getPackageName());
                DEV_LOG && console.log('SET_THEME_ON_LAUNCH', themeId);
                ApplicationSettings.setNumber('SET_THEME_ON_LAUNCH', themeId);
            } else {
                ApplicationSettings.remove('SET_THEME_ON_LAUNCH');
            }
        }
        Theme.setMode(theme);
        switch (theme) {
            case 'auto':
                if (__ANDROID__) {
                    AppCompatDelegate.setDefaultNightMode(AppCompatDelegate.MODE_NIGHT_FOLLOW_SYSTEM);
                } else {
                    if (Application.ios.window) {
                        Application.ios.window.overrideUserInterfaceStyle = UIUserInterfaceStyle.Unspecified;
                    }
                }
                break;
            case 'light':
            case 'eink':
                if (__ANDROID__) {
                    AppCompatDelegate.setDefaultNightMode(AppCompatDelegate.MODE_NIGHT_NO);
                } else {
                    if (Application.ios.window) {
                        Application.ios.window.overrideUserInterfaceStyle = UIUserInterfaceStyle.Light;
                    }
                }
                break;
            case 'dark':
                if (__ANDROID__) {
                    AppCompatDelegate.setDefaultNightMode(AppCompatDelegate.MODE_NIGHT_YES);
                } else {
                    if (Application.ios.window) {
                        Application.ios.window.overrideUserInterfaceStyle = UIUserInterfaceStyle.Dark;
                    }
                }
                break;
            case 'black':
                if (__ANDROID__) {
                    AppCompatDelegate.setDefaultNightMode(AppCompatDelegate.MODE_NIGHT_YES);
                } else {
                    if (Application.ios.window) {
                        Application.ios.window.overrideUserInterfaceStyle = UIUserInterfaceStyle.Dark;
                    }
                }
                break;
        }
    } catch (error) {
        console.error('applyTheme', error, error.stack);
    }
}

function getSystemAppearance() {
    if (typeof Application.systemAppearance === 'function') {
        return Application.systemAppearance();
    }

    return Application.systemAppearance;
}

export function getRealTheme(th = theme) {
    if (get(forceDarkMode)) {
        th = autoDarkToBlack ? 'black' : 'dark';
    } else if (th === 'auto') {
        try {
            th = getSystemAppearance() as any;
            if (autoDarkToBlack && th === 'dark') {
                theme = 'black';
            }
        } catch (err) {
            console.error('getRealTheme', err, err.stack);
        }
    }
    DEV_LOG && console.log('getRealTheme', theme, th);
    return th;
}

export function isDarkTheme(th = getRealTheme(theme)) {
    return th === 'dark' || th === 'black';
}

export function getRealThemeAndUpdateColors() {
    const realTheme = getRealTheme(theme);
    updateThemeColors(realTheme);
}

export function toggleForceDarkMode() {
    forceDarkMode.set(!get(forceDarkMode));
    DEV_LOG && console.log('toggleForceDarkMode', get(forceDarkMode));
    const realTheme = getRealTheme(theme);
    applyTheme(realTheme);
    updateThemeColors(realTheme);
    globalObservable.notify({ eventName: 'theme', data: realTheme });
}

export function start() {
    if (started) {
        return;
    }
    started = true;
    if (__IOS__ && SDK_VERSION < 13) {
        theme = 'light';
    } else {
        theme = getString('theme', DEFAULT_THEME) as Themes;
    }
    if (theme.length === 0) {
        theme = DEFAULT_THEME as Themes;
    }

    prefs.on('key:auto_black', () => {
        autoDarkToBlack = getBoolean('auto_black');
        DEV_LOG && console.log('key:auto_black', theme, autoDarkToBlack);
        if (theme === 'auto') {
            const realTheme = getRealTheme(theme);
            currentTheme.set(realTheme);
            updateThemeColors(realTheme);
            globalObservable.notify({ eventName: 'theme', data: realTheme });
        }
    });

    prefs.on('key:theme', () => {
        let newTheme = getString('theme') as Themes;
        DEV_LOG && console.log('key:theme', theme, newTheme, autoDarkToBlack);
        if (__IOS__ && SDK_VERSION < 13) {
            newTheme = 'light';
        }
        // on pref change we are updating
        if (newTheme === theme) {
            return;
        }

        theme = newTheme;

        const realTheme = getRealTheme(newTheme);
        currentTheme.set(realTheme);

        applyTheme(newTheme);
        updateThemeColors(realTheme);
        sTheme.set(newTheme);
        // if (__ANDROID__) {
        //     akylas.alpi.maps.Utils.applyDayNight(Application.android.startActivity, true);
        // }
        setTimeout(() => {
            globalObservable.notify({ eventName: 'theme', data: realTheme });
        }, 0);

        // TODO: for now we dont restart the activity as it seems to break css
        // setTimeout(() => {
        //     if (__ANDROID__) {
        //         Application.android.startActivity.recreate();
        //     }
        // }, 10);
    });
    const realTheme = getRealTheme(theme);
    currentTheme.set(realTheme);
    if (__ANDROID__) {
        const context = Utils.android.getApplicationContext();
        if (context) {
            applyTheme(theme);
        } else {
            Application.on(Application.launchEvent, () => {
                applyTheme(theme);
                updateThemeColors(realTheme);
            });
        }

        // we need to update the theme on every activity start
        // to get dynamic colors
        Application.on('activity_started', () => {
            DEV_LOG && console.log('activity_started');
            if (Application.getRootView()) {
                getRealThemeAndUpdateColors();
            }
        });
    } else {
        if (Application.ios && Application.ios.window) {
            updateThemeColors(realTheme);
            applyTheme(theme);
        } else {
            updateThemeColors(realTheme);
            Application.on(Application.displayedEvent, () => {
                updateThemeColors(realTheme);
                applyTheme(theme);
            });
        }
    }
}
