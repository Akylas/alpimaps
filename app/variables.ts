import { isSimulator } from '@nativescript-community/extendedinfo';
import { Application, Color, Screen, Utils } from '@nativescript/core';
import { get, writable } from 'svelte/store';
import { themer } from '@nativescript-community/ui-material-core';
import { getRealTheme, theme } from './helpers/theme';

export const colors = writable({
    colorPrimary: '',
    colorOnPrimary: '',
    colorPrimaryContainer: '',
    colorOnPrimaryContainer: '',
    colorSecondary: '',
    colorOnSecondary: '',
    colorSecondaryContainer: '',
    colorOnSecondaryContainer: '',
    colorTertiary: '',
    colorOnTertiary: '',
    colorTertiaryContainer: '',
    colorOnTertiaryContainer: '',
    colorError: '',
    colorOnError: '',
    colorErrorContainer: '',
    colorOnErrorContainer: '',
    colorOutline: '',
    colorOutlineVariant: '',
    colorBackground: '',
    colorOnBackground: '',
    colorSurface: '',
    colorOnSurface: '',
    colorSurfaceVariant: '',
    colorOnSurfaceVariant: '',
    colorOnSurfaceVariant2: '',
    colorSurfaceInverse: '',
    colorOnSurfaceInverse: '',
    colorPrimaryInverse: '',
    colorSurfaceContainer: '',
    colorSurfaceBright: '',
    colorSurfaceDim: '',
    colorSurfaceContainerLow: '',
    colorSurfaceContainerLowest: '',
    colorSurfaceContainerHigh: '',
    colorSurfaceContainerHighest: '',
    colorWidgetBackground: '',
    colorOnSurfaceDisabled: '',
    popupMenuBackground: ''
});
export const fonts = writable({
    mdi: '',
    app: ''
});
let innerStatusBarHeight = 20;
export const statusBarHeight = writable(innerStatusBarHeight);
export const actionBarButtonHeight = writable(0);
export const actionBarHeight = writable(0);
export const screenHeightDips = Screen.mainScreen.heightDIPs;
export const screenWidthDips = Screen.mainScreen.widthDIPs;
export const navigationBarHeight = writable(0);

export let globalMarginTop = 0;
export const systemFontScale = writable(1);

const onInitRootView = function () {
    // we need a timeout to read rootView css variable. not 100% sure why yet
    if (__ANDROID__) {
        // setTimeout(() => {
        const rootView = Application.getRootView();

        const rootViewStyle = rootView?.style;
        fonts.set({ mdi: rootViewStyle.getCssVariable('--mdiFontFamily'), app: rootViewStyle.getCssVariable('--appFontFamily') });
        actionBarHeight.set(parseFloat(rootViewStyle.getCssVariable('--actionBarHeight')));
        actionBarButtonHeight.set(parseFloat(rootViewStyle.getCssVariable('--actionBarButtonHeight')));
        DEV_LOG && console.log('initRootView', get(actionBarButtonHeight));
        const activity = Application.android.startActivity;
        const nUtils = akylas.alpi.maps.Utils;
        const nActionBarHeight = nUtils.getDimensionFromInt(activity, 16843499);
        if (nActionBarHeight > 0) {
            DEV_LOG && console.log('nActionBarHeight', nActionBarHeight);
            actionBarHeight.set(Utils.layout.toDeviceIndependentPixels(nActionBarHeight));
        }
        const resources = Utils.android.getApplicationContext().getResources();
        systemFontScale.set(resources.getConfiguration().fontScale);
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
        // }, 0);
    }

    if (__IOS__) {
        const rootView = Application.getRootView();
        const rootViewStyle = rootView?.style;
        DEV_LOG && console.log('initRootView', rootView);
        fonts.set({ mdi: rootViewStyle.getCssVariable('--mdiFontFamily'), app: rootViewStyle.getCssVariable('--appFontFamily') });
        // DEV_LOG && console.log('fonts', get(fonts));
        actionBarHeight.set(parseFloat(rootViewStyle.getCssVariable('--actionBarHeight')));
        actionBarButtonHeight.set(parseFloat(rootViewStyle.getCssVariable('--actionBarButtonHeight')));
        navigationBarHeight.set(Application.ios.window.safeAreaInsets.bottom);
    }
    updateThemeColors(getRealTheme(theme));
    // DEV_LOG && console.log('initRootView', get(navigationBarHeight), get(statusBarHeight), get(actionBarHeight), get(actionBarButtonHeight), get(fonts));
    Application.off('initRootView', onInitRootView);
    // getRealThemeAndUpdateColors();
};
Application.on('initRootView', onInitRootView);

export function updateThemeColors(theme: string, force = false) {
    // DEV_LOG && console.log('updateThemeColors', theme, force);
    try {
        if (!force) {
            theme = Application.systemAppearance();
            // console.log('systemAppearance', theme);
        }
    } catch (err) {
        console.error('updateThemeColors', err);
    }

    const currentColors = get(colors);
    const rootView = Application.getRootView();
    const rootViewStyle = rootView?.style;
    if (!rootViewStyle) {
        return;
    }
    // rootViewStyle?.setUnscopedCssVariable('--systemFontScale', systemFontScale + '');
    if (__ANDROID__) {
        const nUtils = akylas.alpi.maps.Utils;
        const activity = Application.android.startActivity;
        Utils.android.getApplicationContext().getResources();
        // we also update system font scale so that our UI updates correcly
        systemFontScale.set(Utils.android.getApplicationContext().getResources().getConfiguration().fontScale);
        Object.keys(currentColors).forEach((c) => {
            if (c.endsWith('Disabled')) {
                return;
            }
            if (c === 'colorBackground') {
                currentColors.colorBackground = new Color(nUtils.getColorFromInt(activity, 16842801)).hex;
            } else if (c === 'popupMenuBackground') {
                currentColors.popupMenuBackground = new Color(nUtils.getColorFromInt(activity, 16843126)).hex;
            } else {
                currentColors[c] = new Color(nUtils.getColorFromName(activity, c)).hex;
            }
        });
    } else {
        Object.keys(currentColors).forEach((c) => {
            currentColors[c] = rootViewStyle.getCssVariable('--' + c);
        });
        if (theme === 'dark') {
            currentColors.colorPrimary = '#29B6F6';
            currentColors.colorOnPrimary = '#00344B';
            currentColors.colorPrimaryContainer = '#004C6B';
            currentColors.colorOnPrimaryContainer = '#C6E7FF';
            currentColors.colorSecondary = '#B6C9D8';
            currentColors.colorOnSecondary = '#21333E';
            currentColors.colorSecondaryContainer = '#374955';
            currentColors.colorOnSecondaryContainer = '#D2E5F4';
            currentColors.colorBackground = '#191C1E';
            currentColors.colorOnBackground = '#E2E2E5';
            currentColors.colorSurface = '#191C1E';
            currentColors.colorOnSurface = '#E2E2E5';
            currentColors.colorOutline = '#8B9198';
            currentColors.colorOutlineVariant = '#41484D';
            currentColors.colorSurfaceVariant = '#41484D';
            currentColors.colorOnSurfaceVariant = '#C1C7CE';
            currentColors.colorSurfaceContainer = '#424940';
        } else {
            currentColors.colorPrimary = '#29B6F6';
            currentColors.colorOnPrimary = '#FFFFFF';
            currentColors.colorPrimaryContainer = '#C6E7FF';
            currentColors.colorOnPrimaryContainer = '#001E2D';
            currentColors.colorSecondary = '#526350';
            currentColors.colorOnSecondary = '#FFFFFF';
            currentColors.colorSecondaryContainer = '#D2E5F4';
            currentColors.colorOnSecondaryContainer = '#0A1D28';
            currentColors.colorBackground = '#FCFCFF';
            currentColors.colorOnBackground = '#191C1E';
            currentColors.colorSurface = '#FCFCFF';
            currentColors.colorOnSurface = '#191C1E';
            currentColors.colorOutline = '#71787E';
            currentColors.colorOutlineVariant = '#C1C7CE';
            currentColors.colorSurfaceVariant = '#DDE3EA';
            currentColors.colorOnSurfaceVariant = '#41484D';
            currentColors.colorSurfaceContainer = '#DEE5D9';
        }
        themer.setPrimaryColor(currentColors.colorPrimary);
        themer.setOnPrimaryColor(currentColors.colorOnPrimary);
        themer.setPrimaryColor(currentColors.colorPrimary);
        themer.setSecondaryColor(currentColors.colorSecondary);
        themer.setSurfaceColor(currentColors.colorSurface);
        themer.setOnSurfaceColor(currentColors.colorOnSurface);
    }

    currentColors.colorWidgetBackground = new Color(currentColors.colorSurface).setAlpha(230).hex;
    currentColors.colorOnSurfaceDisabled = new Color(currentColors.colorOnSurface).setAlpha(50).hex;
    if (theme === 'dark') {
        currentColors.colorSurfaceContainerHigh = new Color(currentColors.colorSurfaceContainer).lighten(3).hex;
        currentColors.colorSurfaceContainerHighest = new Color(currentColors.colorSurfaceContainer).lighten(6).hex;
    } else {
        currentColors.colorSurfaceContainerHigh = new Color(currentColors.colorSurfaceContainer).darken(3).hex;
        currentColors.colorSurfaceContainerHighest = new Color(currentColors.colorSurfaceContainer).darken(6).hex;
    }
    currentColors.colorOnSurfaceVariant2 = new Color(currentColors.colorOnSurfaceVariant).setAlpha(170).hex;
    Object.keys(currentColors).forEach((c) => {
        rootViewStyle?.setUnscopedCssVariable('--' + c, currentColors[c]);
    });
    colors.set(currentColors);

    Application.notify({ eventName: 'colorsChange', colors: currentColors });
    DEV_LOG && console.log('changed colors', rootView, JSON.stringify(currentColors));
    rootView?._onCssStateChange();
}
