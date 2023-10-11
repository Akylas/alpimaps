import { isSimulator } from '@nativescript-community/extendedinfo';
import { Application, Color, Observable, Screen, Utils } from '@nativescript/core';
import { writable } from 'svelte/store';
import CSSModule from '~/variables.module.scss';
import { onDestroy } from 'svelte';
const locals = CSSModule.locals;

export const globalObservable = new Observable();

const callbacks = {};
export function createGlobalEventListener(eventName: string) {
    return function (callback: Function, once = false) {
        callbacks[eventName] = callbacks[eventName] || {};
        let cleaned = false;

        function clean() {
            if (cleaned) {
                cleaned = true;
                delete callbacks[eventName][callback];
                globalObservable.off(eventName, eventCallack);
            }
        }
        const eventCallack = (event) => {
            if (once) {
                clean();
            }
            if (Array.isArray(event.data)) {
                event.result = callback(...event.data);
            } else {
                event.result = callback(event.data);
            }
        };
        callbacks[eventName][callback] = eventCallack;
        globalObservable.on(eventName, eventCallack);


        onDestroy(() => {
            clean();
        });
        return clean;
    };
}
export function createUnregisterGlobalEventListener(eventName: string) {
    return function (callback: Function) {
        if (callbacks[eventName] && callbacks[eventName][callback]) {
            globalObservable.off(eventName, callbacks[eventName][callback]);
            delete callbacks[eventName][callback];
        }
    };
}

export const primaryColor = new Color(locals.primaryColor);
export const accentColor = new Color(locals.accentColor);
export const colorSecondary = new Color(locals.colorSecondary);
export const darkColor = new Color(locals.darkColor);
export const textColorDark = locals.textColorDark;
export const textColorLight = locals.textColorLight;
// export const backgroundColor = new Color(locals.backgroundColor);
export const mdiFontFamily: string = locals.mdiFontFamily;
export const alpimapsFontFamily: string = locals.alpimapsFontFamily;
export const actionBarHeight: number = parseFloat(locals.actionBarHeight);

let innerStatusBarHeight = 20;
export const statusBarHeight = writable(innerStatusBarHeight);
export const actionBarButtonHeight: number = parseFloat(locals.actionBarButtonHeight);
export const screenHeightDips = Screen.mainScreen.heightDIPs;
export const screenWidthDips = Screen.mainScreen.widthDIPs;
export const navigationBarHeight = writable(0);

export let globalMarginTop = 0;

if (__ANDROID__) {
    const resources = Utils.android.getApplicationContext().getResources();
    const id = resources.getIdentifier('config_showNavigationBar', 'bool', 'android');
    let resourceId = resources.getIdentifier('navigation_bar_height', 'dimen', 'android');
    if (id > 0 && resourceId > 0 && (resources.getBoolean(id) || (!PRODUCTION && isSimulator()))) {
        navigationBarHeight.set(Utils.layout.toDeviceIndependentPixels(resources.getDimensionPixelSize(resourceId)));
    }
    resourceId = resources.getIdentifier('status_bar_height', 'dimen', 'android');
    if (id > 0 && resourceId > 0) {
        innerStatusBarHeight = Utils.layout.toDeviceIndependentPixels(resources.getDimensionPixelSize(resourceId));
        statusBarHeight.set(innerStatusBarHeight);
    }
    globalMarginTop = innerStatusBarHeight;
} else {
    const onAppLaunch = function () {
        navigationBarHeight.set(Application.ios.window.safeAreaInsets.bottom);
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
export const backgroundColor = writable('');
export const lightBackgroundColor = writable('');

export function updateThemeColors(theme: string) {
    // try {
    //     if (!force) {
    //         theme = Application.systemAppearance();
    //         // console.log('systemAppearance', theme);
    //     }
    // } catch (err) {
    //     console.error('updateThemeColors', err);
    // }
    // currentTheme.set(theme);
    if (theme === 'dark') {
        textColor.set(textColorDark);
        textLightColor.set('#aaaaaa');
        borderColor.set('#cccccc55');
        subtitleColor.set('#aaaaaa');
        iconColor.set('#aaaaaa');
        widgetBackgroundColor.set('#000000bb');
        backgroundColor.set('#1c1c1e');
        lightBackgroundColor.set('#666666');
    } else {
        textColor.set(textColorLight);
        textLightColor.set('#444444');
        borderColor.set('#cccccc55');
        subtitleColor.set('#888888');
        iconColor.set('#444444');
        widgetBackgroundColor.set('#ffffff');
        backgroundColor.set(textColorDark);
        lightBackgroundColor.set('#e3e3e3');
    }
}
