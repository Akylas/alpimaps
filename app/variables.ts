import { locals } from './variables.scss';
import { screen } from '@nativescript/core/platform';
import { ad } from '@nativescript/core/utils/utils';

export const primaryColor: string = locals.primaryColor;
export const accentColor: string = locals.accentColor;
export const darkColor: string = locals.darkColor;
export const backgroundColor: string = locals.backgroundColor;
export const actionBarHeight: number = parseFloat(locals.actionBarHeight);
export const actionBarButtonHeight: number = parseFloat(locals.actionBarButtonHeight);
export let navigationBarHeight: number = parseFloat(locals.navigationBarHeight);
export const statusBarHeight: number = parseFloat(locals.statusBarHeight);
export const screenHeightDips = screen.mainScreen.heightDIPs;
export const screenWidthDips = screen.mainScreen.widthDIPs;

if (gVars.isAndroid) {
    const context: android.content.Context = ad.getApplicationContext();
    const hasPermanentMenuKey = android.view.ViewConfiguration.get(context).hasPermanentMenuKey();
    if (hasPermanentMenuKey) {
        navigationBarHeight = 0;
    }
} else {
    navigationBarHeight = 0;
}
