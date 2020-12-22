import { isSimulator } from '@nativescript-community/extendedinfo';
import { Application, Color, Screen, Utils } from '@akylas/nativescript';
import { ad } from '@nativescript/core/utils/utils';
import CSSModule from '~/variables.module.scss';
const locals = CSSModule.locals;

export const primaryColor = new Color(locals.primaryColor);
export const accentColor = new Color(locals.accentColor);
export const darkColor = new Color(locals.darkColor);
export const backgroundColor = new Color(locals.backgroundColor);
export const textColor = new Color(locals.textColor);
export const mdiFontFamily: string = locals.mdiFontFamily;
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
