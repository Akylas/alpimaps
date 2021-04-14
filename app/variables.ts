import { isSimulator } from '@nativescript-community/extendedinfo';
import { Application, Color, Screen, Utils } from '@nativescript/core';
import { ad } from '@nativescript/core/utils/utils';
import { writable } from 'svelte/store';
import CSSModule from '~/variables.module.scss';
import { currentTheme } from './helpers/theme';
const locals = CSSModule.locals;

export const primaryColor = new Color(locals.primaryColor);
export const accentColor = new Color(locals.accentColor);
export const darkColor = new Color(locals.darkColor);
export const textColorDark = locals.textColorDark;
export const textColorLight = locals.textColorLight;
export const backgroundColor = new Color(locals.backgroundColor);
export const mdiFontFamily: string = locals.mdiFontFamily;
export const alpimapsFontFamily: string = locals.alpimapsFontFamily;
export const actionBarHeight: number = parseFloat(locals.actionBarHeight);
export const statusBarHeight: number = parseFloat(locals.statusBarHeight);
export const actionBarButtonHeight: number = parseFloat(locals.actionBarButtonHeight);
export const screenHeightDips = Screen.mainScreen.heightDIPs;
export const screenWidthDips = Screen.mainScreen.widthDIPs;
export let navigationBarHeight: number = parseFloat(locals.navigationBarHeight);

export let globalMarginTop = 0;

if (global.isAndroid) {
    const resources = (ad.getApplicationContext() as android.content.Context).getResources();
    const id = resources.getIdentifier('config_showNavigationBar', 'bool', 'android');
    const resourceId = resources.getIdentifier('navigation_bar_height', 'dimen', 'android');
    // wont work on emulator though!
    if (id > 0 && resourceId > 0 && (resources.getBoolean(id) || isSimulator())) {
        navigationBarHeight = Utils.layout.toDeviceIndependentPixels(resources.getDimensionPixelSize(resourceId));
        // navigationBarHeight/ = Utils.layout.toDeviceIndependentPixels(48);
    }
    globalMarginTop = statusBarHeight;
} else {
    navigationBarHeight = 0;
    const onAppLaunch = function () {
        navigationBarHeight = Application.ios.window.safeAreaInsets.bottom;
        Application.off(Application.launchEvent, onAppLaunch);
    };
    Application.on(Application.launchEvent, onAppLaunch);
}

export const textColor = writable('');
export const borderColor = writable('');
export const textLightColor = writable('');

export const subtitleColor = writable('');
export const iconColor = writable('');
export const widgetBackgroundColor = writable('');

export function updateThemeColors(theme: string, force = false) {
    try {
        if (!force) {
            theme = Application.systemAppearance();
            // console.log('systemAppearance', theme);
        }
    } catch (err) {
        console.error('updateThemeColors', err);
    }
    currentTheme.set(theme);
    if (theme === 'dark') {
        textColor.set(textColorDark);
        textLightColor.set('#aaaaaa');
        borderColor.set('#cccccc55');
        subtitleColor.set('#aaaaaa');
        iconColor.set('#aaaaaa');
        widgetBackgroundColor.set('#000000aa');
    } else {
        textColor.set(textColorLight);
        textLightColor.set('#444444');
        borderColor.set('#cccccc55');
        subtitleColor.set('#888888');
        iconColor.set('#444444');
        widgetBackgroundColor.set('#ffffff');
    }
}
