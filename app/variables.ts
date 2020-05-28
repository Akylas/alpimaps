import { locals } from '~/variables.module.scss';
import { screen } from '@nativescript/core/platform';
import { ad } from '@nativescript/core/utils/utils';

export const primaryColor: string = locals.primaryColor;
export const accentColor: string = locals.accentColor;
export const darkColor: string = locals.darkColor;
export const backgroundColor: string = locals.backgroundColor;
export const mdiFontFamily: string = locals.mdiFontFamily;
export const actionBarHeight: number = parseFloat(locals.actionBarHeight);
export const statusBarHeight: number = parseFloat(locals.statusBarHeight);
export const actionBarButtonHeight: number = parseFloat(locals.actionBarButtonHeight);
export const screenHeightDips = screen.mainScreen.heightDIPs;
export const screenWidthDips = screen.mainScreen.widthDIPs;
export let navigationBarHeight: number = parseFloat(locals.navigationBarHeight);

if (gVars.isAndroid) {
    const context: android.content.Context = ad.getApplicationContext();
    const id = context.getResources().getIdentifier("config_showNavigationBar", "bool", "android");
    // wont work on emulator though!
    if( id > 0 && context.getResources().getBoolean(id)) {
        navigationBarHeight = 48;
    }
} else {
    navigationBarHeight = 0;
}
