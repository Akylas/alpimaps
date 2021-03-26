import { getString, setString } from '@nativescript/core/application-settings';
import { iOSNativeHelper } from '@nativescript/core/utils';
import Theme from '@nativescript-community/css-theme';
import { Application, ApplicationSettings } from '@nativescript/core';
import { prefs } from '~/services/preferences';
import { updateThemeColors } from '~/variables';
import { showBottomSheet } from '~/components/bottomsheet';
import OptionSelect from '~/components/OptionSelect.svelte';
import { lc } from '@nativescript-community/l';
import { writable } from 'svelte/store';

export type Themes = 'auto' | 'light' | 'dark';
const onThemeChangedCallbacks = [];
export function onThemeChanged(callback) {
    onThemeChangedCallbacks.push(callback);
}
export let theme: Themes;
export const currentTheme = writable('auto');
export const sTheme = writable('auto');

Application.on(Application.systemAppearanceChangedEvent, (event) => {
    if (theme === 'auto') {
        currentTheme.set(event.newValue);
        updateThemeColors(event.newValue);
        onThemeChangedCallbacks.forEach((c) => c(event.newValue));
    }
});

export function getThemeDisplayName(toDisplay = theme) {
    switch (toDisplay) {
        case 'auto':
            return lc('auto');
        case 'dark':
            return lc('dark');
        case 'light':
            return lc('light');
    }
}

export async function selectTheme() {
    try {
        const actions: Themes[] = ['auto', 'light', 'dark'];
        const result = await showBottomSheet<any>({
            view: OptionSelect,
            props: {
                title: lc('select_language'),
                options: actions.map((k) => ({ name: getThemeDisplayName(k), data: k }))
            },
            trackingScrollView: 'collectionView'
        });
        if (result && actions.indexOf(result.data) !== -1) {
            ApplicationSettings.setString('theme', result.data);
        }
    } catch (err) {
        this.showError(err);
    }
}

export function applyTheme(theme: Themes) {
    const AppCompatDelegate = global.isAndroid ? androidx.appcompat.app.AppCompatDelegate : undefined;
    switch (theme) {
        case 'auto':
            Theme.setMode(Theme.Auto);
            if (global.isAndroid) {
                AppCompatDelegate.setDefaultNightMode(AppCompatDelegate.MODE_NIGHT_FOLLOW_SYSTEM);
            } else {
                if (Application.ios.window) {
                    (Application.ios.window as UIWindow).overrideUserInterfaceStyle = UIUserInterfaceStyle.Unspecified;
                }
            }
            break;
        case 'light':
            Theme.setMode(Theme.Light);
            if (global.isAndroid) {
                AppCompatDelegate.setDefaultNightMode(AppCompatDelegate.MODE_NIGHT_NO);
            } else {
                if (Application.ios.window) {
                    (Application.ios.window as UIWindow).overrideUserInterfaceStyle = UIUserInterfaceStyle.Light;
                }
            }
            break;
        case 'dark':
            Theme.setMode(Theme.Dark);
            if (global.isAndroid) {
                AppCompatDelegate.setDefaultNightMode(AppCompatDelegate.MODE_NIGHT_YES);
            } else {
                if (Application.ios.window) {
                    (Application.ios.window as UIWindow).overrideUserInterfaceStyle = UIUserInterfaceStyle.Dark;
                }
            }
            break;
    }
}

export function toggleTheme(autoDark = false) {
    const newTheme = theme === 'dark' ? (autoDark ? 'auto' : 'light') : 'dark';
    setString('theme', newTheme);
}
export function isDark() {
    return theme === 'dark';
}

export function start() {
    if (global.isIOS && iOSNativeHelper.MajorVersion < 13) {
        theme = 'light';
    } else {
        theme = (getString('theme', 'auto') || 'auto') as Themes;
    }
    // console.log('theme', theme);

    prefs.on('key:theme', () => {
        let newTheme = getString('theme') as Themes;
        if (global.isIOS && iOSNativeHelper.MajorVersion < 13) {
            newTheme = 'light';
        }
        // on pref change we are updating
        if (newTheme === theme) {
            return;
        }

        theme = newTheme;
        sTheme.set(newTheme);
        applyTheme(newTheme);
        updateThemeColors(newTheme, newTheme !== 'auto');
        onThemeChangedCallbacks.forEach((c) => c(theme));
    });
    const force = theme !== 'auto';
    if (global.isAndroid) {
        applyTheme(theme);
        if (Application.android && Application.android.context) {
            updateThemeColors(theme, force);
        } else {
            Application.on(Application.launchEvent, () => {
                updateThemeColors(theme, force);
            });
        }
    } else {
        if (Application.ios && Application.ios.window) {
            applyTheme(theme);
            updateThemeColors(theme, force);
        } else {
            Application.on(Application.displayedEvent, () => {
                applyTheme(theme);
                updateThemeColors(theme, force);
            });
        }
    }
}
