import { isSimulator } from '@nativescript-community/extendedinfo';
import { Application, Color, Screen, Utils } from '@nativescript/core';
import { ad } from '@nativescript/core/utils/utils';
import CSSModule from '~/variables.module.scss';
const locals = CSSModule.locals;

export const primaryColor = new Color(locals.primaryColor);
export const accentColor = new Color(locals.accentColor);
export const darkColor = new Color(locals.darkColor);
export const backgroundColor = new Color(locals.backgroundColor);
export const wiFontFamily: string = locals.wiFontFamily;
export const mdiFontFamily: string = locals.mdiFontFamily;
export const actionBarHeight: number = parseFloat(locals.actionBarHeight);
export const statusBarHeight: number = parseFloat(locals.statusBarHeight);
export const actionBarButtonHeight: number = parseFloat(locals.actionBarButtonHeight);
export const screenHeightDips = Screen.mainScreen.heightDIPs;
export const screenWidthDips = Screen.mainScreen.widthDIPs;
export let navigationBarHeight: number = parseFloat(locals.navigationBarHeight);

import { writable } from 'svelte/store';

export const latoFontFamily: string = locals.latoFontFamily;

export const screenScale = Screen.mainScreen.scale;

if (global.isAndroid) {
    const context: android.content.Context = ad.getApplicationContext();
    const hasPermanentMenuKey = android.view.ViewConfiguration.get(context).hasPermanentMenuKey();
    if (hasPermanentMenuKey) {
        navigationBarHeight = 0;
    }
} else {
    navigationBarHeight = 0;
}

export const sunnyColor = '#FFC82F';
export const nightColor = '#845987';
export const scatteredCloudyColor = '#cccccc';
export const cloudyColor = '#929292';
export const rainColor = '#4681C3';
export const snowColor = '#43b4e0';
export const textColor = writable('');
export const borderColor = writable('');
export const textLightColor = writable('');

export const subtitleColor = writable('');
export const iconColor = writable('');

export function updateThemeColors(theme: string, force = false) {
    try {
        if (!force) {
            theme = Application.systemAppearance();
        }
    } catch (err) {
        console.error('updateThemeColors', err);
    }
    console.log('updateThemeColors', theme);
    if (theme === 'dark') {
        textColor.set('#ffffff');
        textLightColor.set('#aaaaaa');
        borderColor.set('#55cccccc');
        subtitleColor.set('#aaaaaa');
        iconColor.set('#aaaaaa');
    } else {
        textColor.set('#000000');
        textLightColor.set('#444444');
        borderColor.set('#55cccccc');
        subtitleColor.set('#444444');
        iconColor.set('#444444');
    }
}

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
