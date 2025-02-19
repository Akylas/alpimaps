import { AppUtilsAndroid } from '@akylas/nativescript-app-utils';
import { themer } from '@nativescript-community/ui-material-core';
import { Application, ApplicationSettings, Color, Frame, InitRootViewEventData, Page, Screen, Utils, View } from '@nativescript/core';
import { getCurrentFontScale } from '@nativescript/core/accessibility/font-scale';
import { get, writable } from 'svelte/store';
import { ColorThemes, Themes, getRealTheme, getRealThemeAndUpdateColors, theme } from './helpers/theme';
import { DEFAULT_COLOR_THEME, SETTINGS_COLOR_THEME } from './utils/constants';
import { start as startThemeHelper, useDynamicColors } from '~/helpers/theme';

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
    colorOnSurfaceDisabled: '',
    colorWidgetBackground: '',
    colorSurfaceTint: '',
    popupMenuBackground: ''
});
export const fonts = writable({
    mdi: '',
    app: ''
});
export const windowInset = writable({ top: 0, left: 0, right: 0, bottom: 0, keyboard: 0 });
export const actionBarButtonHeight = writable(0);
export const actionBarHeight = writable(0);
export const screenHeightDips = Screen.mainScreen.heightDIPs;
export const screenWidthDips = Screen.mainScreen.widthDIPs;
// export const navigationBarHeight = writable(0);

export const fontScale = writable(1);
export const isRTL = writable(false);

function updateSystemFontScale(value) {
    fontScale.set(value);
}

if (__ANDROID__) {
    Application.android.on(Application.android.activityCreateEvent, (event) => {
        DEV_LOG && console.log('activityCreateEvent', useDynamicColors);
        AppUtilsAndroid.prepareActivity(event.activity, useDynamicColors);
    });
    Page.on('shownModally', function (event) {
        AppUtilsAndroid.prepareWindow(event.object['_dialogFragment'].getDialog().getWindow());
    });
    Frame.on('shownModally', function (event) {
        AppUtilsAndroid.prepareWindow(event.object['_dialogFragment'].getDialog().getWindow());
    });
}
function getRootViewStyle(rootView?: View) {
    if (!rootView) {
        rootView = Application.getRootView();
        if (rootView?.parent) {
            rootView = rootView.parent as any;
        }
    }
    return rootView?.style;
}
if (__ANDROID__) {
    Application.android.on('dialogOnCreateView', (event) => {
        AppUtilsAndroid.prepareWindow(event.window);
    });
}
const onInitRootView = function (event: InitRootViewEventData) {
    DEV_LOG && console.log('onInitRootView', event.rootView, Application.getRootView());
    let rootView = event.rootView || Application.getRootView();
    // we need a timeout to read rootView css variable. not 100% sure why yet
    if (__ANDROID__) {
        // setTimeout(() => {
        if (rootView?.parent) {
            rootView = rootView.parent as any;
        }
        if (rootView) {
            // in case the inset was already (android restart activity) set we need to reset it
            windowInset.set({
                top: 0,
                bottom: 0,
                left: 0,
                right: 0,
                keyboard: 0
            });
            AppUtilsAndroid.listenForWindowInsets((inset: [number, number, number, number, number]) => {
                // DEV_LOG && console.log('onApplyWindowInsets', inset[0], inset[1], inset[2], inset[3], inset[4]);
                windowInset.set({
                    top: Utils.layout.toDeviceIndependentPixels(inset[0]),
                    keyboard: Utils.layout.toDeviceIndependentPixels(inset[4]),
                    // bottom: Utils.layout.toDeviceIndependentPixels(Math.max(inset[1], inset[4])),
                    bottom: Utils.layout.toDeviceIndependentPixels(inset[1]),
                    left: Utils.layout.toDeviceIndependentPixels(inset[2]),
                    right: Utils.layout.toDeviceIndependentPixels(inset[3])
                });
            });
        }
        const rootViewStyle = getRootViewStyle(rootView);
        fonts.set({ mdi: rootViewStyle.getCssVariable('--mdiFontFamily'), app: rootViewStyle.getCssVariable('--appFontFamily') });
        actionBarHeight.set(parseFloat(rootViewStyle.getCssVariable('--actionBarHeight')));
        actionBarButtonHeight.set(parseFloat(rootViewStyle.getCssVariable('--actionBarButtonHeight')));
        const context = Utils.android.getApplicationContext();

        const resources = Utils.android.getApplicationContext().getResources();
        updateSystemFontScale(resources.getConfiguration().fontScale);
        isRTL.set(resources.getConfiguration().getLayoutDirection() === 1);

        // ActionBar
        // resourceId = resources.getIdentifier('status_bar_height', 'dimen', 'android');
        let nActionBarHeight = Utils.layout.toDeviceIndependentPixels(AppUtilsAndroid.getDimensionFromInt(context, 16843499 /* actionBarSize */));
        // let nActionBarHeight = 0;
        // if (resourceId > 0) {
        //     nActionBarHeight = Utils.layout.toDeviceIndependentPixels(resources.getDimensionPixelSize(resourceId));
        // }
        if (nActionBarHeight > 0) {
            actionBarHeight.set(nActionBarHeight);
            rootViewStyle?.setUnscopedCssVariable('--actionBarHeight', nActionBarHeight + '');
        } else {
            nActionBarHeight = parseFloat(rootViewStyle.getCssVariable('--actionBarHeight'));
            actionBarHeight.set(nActionBarHeight);
        }
        const nActionBarButtonHeight = nActionBarHeight - 10;
        actionBarButtonHeight.set(nActionBarButtonHeight);
        rootViewStyle?.setUnscopedCssVariable('--actionBarButtonHeight', nActionBarButtonHeight + '');
        DEV_LOG && console.log('actionBarHeight', nActionBarHeight);

        // }, 0);
    }

    if (__IOS__) {
        const rootViewStyle = rootView?.style;
        DEV_LOG && console.log('initRootView', rootView);
        fonts.set({ mdi: rootViewStyle.getCssVariable('--mdiFontFamily'), app: rootViewStyle.getCssVariable('--appFontFamily') });

        const currentColors = get(colors);
        Object.keys(currentColors).forEach((c) => {
            currentColors[c] = rootViewStyle.getCssVariable('--' + c);
        });
        colors.set(currentColors);
        updateSystemFontScale(getCurrentFontScale());
        Application.on(Application.fontScaleChangedEvent, (event) => updateSystemFontScale(event.newValue));
        actionBarHeight.set(parseFloat(rootViewStyle.getCssVariable('--actionBarHeight')));
        actionBarButtonHeight.set(parseFloat(rootViewStyle.getCssVariable('--actionBarButtonHeight')));
        updateIOSWindowInset();
    }
    startThemeHelper();

    // updateThemeColors(getRealTheme(theme));
    // Application.off(Application.initRootViewEvent, onInitRootView);
    getRealThemeAndUpdateColors();
};

function updateIOSWindowInset() {
    if (__IOS__) {
        setTimeout(() => {
            const safeAreaInsets = Application.getRootView().nativeViewProtected.safeAreaInsets;
            windowInset.set({
                left: Utils.layout.round(Utils.layout.toDevicePixels(safeAreaInsets.left)),
                top: Utils.layout.round(Utils.layout.toDevicePixels(safeAreaInsets.top)),
                right: Utils.layout.round(Utils.layout.toDevicePixels(safeAreaInsets.right)),
                bottom: Utils.layout.round(Utils.layout.toDevicePixels(safeAreaInsets.bottom)),
                keyboard: 0
            });
            DEV_LOG && console.log('updateIOSWindowInset', get(windowInset));
        }, 0);
    }
}
function onOrientationChanged() {
    if (__ANDROID__) {
        const rootViewStyle = getRootViewStyle();
        const context = Utils.android.getApplicationContext();

        const nActionBarHeight = Utils.layout.toDeviceIndependentPixels(AppUtilsAndroid.getDimensionFromInt(context, 16843499 /* actionBarSize */));
        if (nActionBarHeight > 0) {
            actionBarHeight.set(nActionBarHeight);
            rootViewStyle?.setUnscopedCssVariable('--actionBarHeight', nActionBarHeight + '');
        }
        const nActionBarButtonHeight = nActionBarHeight - 10;
        actionBarButtonHeight.set(nActionBarButtonHeight);
        rootViewStyle?.setUnscopedCssVariable('--actionBarButtonHeight', nActionBarButtonHeight + '');
        DEV_LOG && console.log('onOrientationChanged actionBarHeight', nActionBarHeight, nActionBarButtonHeight);
    } else {
        updateIOSWindowInset();
    }
}
Application.on(Application.initRootViewEvent, onInitRootView);
Application.on(Application.orientationChangedEvent, onOrientationChanged);
if (__ANDROID__) {
    Application.android.on(Application.android.activityStartedEvent, () => {
        const resources = Utils.android.getApplicationContext().getResources();
        isRTL.set(resources.getConfiguration().getLayoutDirection() === 1);
    });
}

export function updateThemeColors(theme: Themes, colorTheme: ColorThemes = ApplicationSettings.getString(SETTINGS_COLOR_THEME, DEFAULT_COLOR_THEME) as ColorThemes, force = false) {
    try {
        DEV_LOG && console.log('updateThemeColors', theme, colorTheme);
        const currentColors = get(colors);
        let rootView = Application.getRootView();
        if (rootView?.parent) {
            rootView = rootView.parent as any;
        }
        const rootViewStyle = rootView?.style;
        if (!rootViewStyle) {
            return;
        }
        // rootViewStyle?.setUnscopedCssVariable('--fontScale', fontScale + '');
        if (__ANDROID__) {
            const activity = Application.android.startActivity;
            // we also update system font scale so that our UI updates correcly
            fontScale.set(Utils.android.getApplicationContext().getResources().getConfiguration().fontScale);
            Object.keys(currentColors).forEach((c) => {
                if (c.endsWith('Disabled')) {
                    return;
                }
                if (c === 'colorBackground') {
                    currentColors.colorBackground = new Color(AppUtilsAndroid.getColorFromInt(activity, 16842801)).hex;
                } else if (c === 'popupMenuBackground') {
                    currentColors.popupMenuBackground = new Color(AppUtilsAndroid.getColorFromInt(activity, 16843126)).hex;
                } else {
                    currentColors[c] = new Color(AppUtilsAndroid.getColorFromName(activity, c)).hex;
                }
            });
        } else {
            const themeColors = require(`~/themes/${colorTheme}.json`);
            if (theme === 'dark' || theme === 'black') {
                Object.assign(currentColors, themeColors.dark);
            } else {
                Object.assign(currentColors, themeColors.light);
            }
            themer.setPrimaryColor(currentColors.colorPrimary);
            themer.setOnPrimaryColor(currentColors.colorOnPrimary);
            themer.setPrimaryColor(currentColors.colorPrimary);
            themer.setSecondaryColor(currentColors.colorSecondary);
            themer.setSurfaceColor(currentColors.colorSurface);
            themer.setOnSurfaceColor(currentColors.colorOnSurface);
        }

        if (colorTheme === 'eink') {
            currentColors.colorWidgetBackground = currentColors.colorSurface;
            currentColors.colorSurfaceTint = new Color(currentColors.colorPrimary).darken(10).hex;
            currentColors.colorSurfaceContainerHigh = new Color(currentColors.colorSurfaceContainer).darken(10).hex;
            currentColors.colorSurfaceContainerHighest = new Color(currentColors.colorSurfaceContainer).darken(20).hex;
        } else {
            currentColors.colorWidgetBackground = new Color(currentColors.colorSurface).setAlpha(230).hex;
            if (theme === 'black') {
                currentColors.colorBackground = '#000000';
            }
            if (theme === 'dark') {
                currentColors.colorSurfaceTint = new Color(currentColors.colorPrimary).lighten(10).hex;
                currentColors.colorSurfaceContainerHigh = new Color(currentColors.colorSurfaceContainer).lighten(10).hex;
                currentColors.colorSurfaceContainerHighest = new Color(currentColors.colorSurfaceContainer).lighten(20).hex;
            } else {
            }
        }

        currentColors.colorOnSurfaceVariant2 = new Color(currentColors.colorOnSurfaceVariant).setAlpha(170).hex;
        currentColors.colorOnSurfaceDisabled = new Color(currentColors.colorOnSurface).setAlpha(50).hex;
        Object.keys(currentColors).forEach((c) => {
            rootViewStyle?.setUnscopedCssVariable('--' + c, currentColors[c]);
        });
        colors.set(currentColors);
        Application.notify({ eventName: 'colorsChange', colors: currentColors });
        DEV_LOG && console.log('changed colors', rootView, JSON.stringify(currentColors));
        rootView?._onCssStateChange();
        const rootModalViews = rootView?._getRootModalViews();
        rootModalViews.forEach((rootModalView) => rootModalView._onCssStateChange());
    } catch (error) {
        console.error(error, error.stack);
    }
}
