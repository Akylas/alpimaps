import { Component, Prop } from 'vue-property-decorator';
import BaseVueComponent from './BaseVueComponent';
import { Color, NavigationEntry, Page } from '@nativescript/core';
import { VueConstructor } from 'vue';
import { primaryColor } from '~/variables';

@Component({})
export default class AlpiMapsPage extends BaseVueComponent {
    @Prop({ default: null, type: String })
    public title: string;

    @Prop({ default: null, type: String })
    public subtitle: string;

    @Prop({ default: false, type: Boolean })
    public showMenuIcon: boolean;

    @Prop({ default: false, type: Boolean })
    public modal: boolean;


    @Prop({ default: true, type: Boolean })
    public actionBarShowLogo: boolean;

    @Prop({ default: () => primaryColor, type: Color })
    public actionBarBackroundColor: Color;

    @Prop({ type: Number })
    public actionBarHeight: number;

    @Prop({ type: Number })
    public actionBarElevation: number;

    public navigateUrl = null;

    public loading = false;

    get page() {
        return this.getRef<Page>('page');
    }
    destroyed() {
        super.destroyed();
    }
    mounted() {
        if (this.nativeView && this.navigateUrl) {
            this.nativeView['navigateUrl'] = this.navigateUrl;
        }
        const page = this.page;
        if (page) {
            // page.actionBarHidden = true;
            if (global.isIOS) {
                page.backgroundSpanUnderStatusBar = true;
                //     page.statusBarStyle = 'light';
                //     page.eachChildView(view => {
                //         view.style.paddingTop = 0.00001;
                //         return false;
                //     });
                // } else {
                //     page.androidStatusBarBackground = null;
                //     page.androidStatusBarBackground = new Color(this.darkColor);
            }
            // page.backgroundColor = this.darkColor;
            // page.backgroundColor = this.themeColor;
            // page.on(Page.navigatingToEvent, () => {

            // });

            // page.on(Page.navigatingFromEvent, (data: NavigatedData) => {
            //     if (data.isBackNavigation) {
            //         this.$getAppComponent().onNavigatingFrom();
            //     }
            // });
        }
    }
}
