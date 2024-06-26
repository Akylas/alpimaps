import { themer } from '@nativescript-community/ui-material-core';
import { Application, Color, Screen, Utils } from '@nativescript/core';
import { getCurrentFontScale } from '@nativescript/core/accessibility/font-scale';
import { get, writable } from 'svelte/store';
import { Themes, getRealTheme, theme } from './helpers/theme';
import { SDK_VERSION } from '@nativescript/core/utils';

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
    colorSurfaceTint: '',
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
export const windowInset = writable({ top: 0, left: 0, right: 0, bottom: 0 });
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
function getRootViewStyle() {
    let rootView = Application.getRootView();
    if (rootView?.parent) {
        rootView = rootView.parent as any;
    }
    return rootView?.style;
}
const onInitRootView = function () {
    // we need a timeout to read rootView css variable. not 100% sure why yet
    if (__ANDROID__) {
        // setTimeout(() => {
        let rootView = Application.getRootView();
        if (rootView.parent) {
            rootView = rootView.parent as any;
        }
        if (rootView) {
            // in case the inset was already (android restart activity) set we need to reset it
            windowInset.set({
                top: 0,
                bottom: 0,
                left: 0,
                right: 0
            });
            (rootView.nativeViewProtected as android.view.View).setOnApplyWindowInsetsListener(
                new android.view.View.OnApplyWindowInsetsListener({
                    onApplyWindowInsets(view, insets) {
                        if (SDK_VERSION >= 29) {
                            const inset = insets.getSystemWindowInsets();
                            windowInset.set({
                                top: Utils.layout.toDeviceIndependentPixels(inset.top),
                                bottom: Utils.layout.toDeviceIndependentPixels(inset.bottom),
                                left: Utils.layout.toDeviceIndependentPixels(inset.left),
                                right: Utils.layout.toDeviceIndependentPixels(inset.right)
                            });
                        } else {
                            windowInset.set({
                                top: Utils.layout.toDeviceIndependentPixels(insets.getSystemWindowInsetTop()),
                                bottom: Utils.layout.toDeviceIndependentPixels(insets.getSystemWindowInsetBottom()),
                                left: Utils.layout.toDeviceIndependentPixels(insets.getSystemWindowInsetLeft()),
                                right: Utils.layout.toDeviceIndependentPixels(insets.getSystemWindowInsetRight())
                            });
                        }
                        return insets;
                    }
                })
            );
        }
        const rootViewStyle = getRootViewStyle();
        fonts.set({ mdi: rootViewStyle.getCssVariable('--mdiFontFamily'), app: rootViewStyle.getCssVariable('--appFontFamily') });

        const context = Utils.android.getApplicationContext();
        const nUtils = akylas.alpi.maps.Utils;

        const resources = Utils.android.getApplicationContext().getResources();
        fontScale.set(resources.getConfiguration().fontScale);
        isRTL.set(resources.getConfiguration().getLayoutDirection() === 1);

        // ActionBar
        // resourceId = resources.getIdentifier('status_bar_height', 'dimen', 'android');
        let nActionBarHeight = Utils.layout.toDeviceIndependentPixels(nUtils.getDimensionFromInt(context, 16843499 /* actionBarSize */));
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
        const rootView = Application.getRootView();
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
    }
    updateThemeColors(getRealTheme(theme));
    // Application.off(Application.initRootViewEvent, onInitRootView);
    // getRealThemeAndUpdateColors();
};
function onOrientationChanged() {
    if (__ANDROID__) {
        const rootViewStyle = getRootViewStyle();
        const context = Utils.android.getApplicationContext();
        const nUtils = akylas.alpi.maps.Utils;

        const nActionBarHeight = Utils.layout.toDeviceIndependentPixels(nUtils.getDimensionFromInt(context, 16843499 /* actionBarSize */));
        if (nActionBarHeight > 0) {
            actionBarHeight.set(nActionBarHeight);
            rootViewStyle?.setUnscopedCssVariable('--actionBarHeight', nActionBarHeight + '');
        }
        const nActionBarButtonHeight = nActionBarHeight - 10;
        actionBarButtonHeight.set(nActionBarButtonHeight);
        rootViewStyle?.setUnscopedCssVariable('--actionBarButtonHeight', nActionBarButtonHeight + '');
        DEV_LOG && console.log('onOrientationChanged actionBarHeight', nActionBarHeight, nActionBarButtonHeight);
    }
}
Application.on(Application.initRootViewEvent, onInitRootView);
Application.on(Application.orientationChangedEvent, onOrientationChanged);
Application.on('activity_started', () => {
    if (__ANDROID__) {
        const resources = Utils.android.getApplicationContext().getResources();
        isRTL.set(resources.getConfiguration().getLayoutDirection() === 1);
    }
});

export function updateThemeColors(theme: Themes, force = false) {
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
        const nUtils = akylas.alpi.maps.Utils;
        const activity = Application.android.startActivity;
        // we also update system font scale so that our UI updates correcly
        fontScale.set(Utils.android.getApplicationContext().getResources().getConfiguration().fontScale);
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
            currentColors.colorSurfaceInverse = '#FCFCFF';
            currentColors.colorOnSurfaceInverse = '#191C1E';
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
            currentColors.colorSurfaceInverse = '#191C1E';
            currentColors.colorOnSurfaceInverse = '#E2E2E5';
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

    if (theme === 'eink') {
        currentColors.colorWidgetBackground = currentColors.colorSurface;
    } else {
        currentColors.colorWidgetBackground = new Color(currentColors.colorSurface).setAlpha(230).hex;
    }

    if (theme === 'black') {
        currentColors.colorBackground = '#000000';
    }
    if (theme === 'dark') {
        currentColors.colorSurfaceTint = new Color(currentColors.colorPrimary).lighten(10).hex;
        currentColors.colorSurfaceContainerHigh = new Color(currentColors.colorSurfaceContainer).lighten(10).hex;
        currentColors.colorSurfaceContainerHighest = new Color(currentColors.colorSurfaceContainer).lighten(20).hex;
    } else {
        currentColors.colorSurfaceTint = new Color(currentColors.colorPrimary).darken(10).hex;
        currentColors.colorSurfaceContainerHigh = new Color(currentColors.colorSurfaceContainer).darken(10).hex;
        currentColors.colorSurfaceContainerHighest = new Color(currentColors.colorSurfaceContainer).darken(20).hex;
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
}
