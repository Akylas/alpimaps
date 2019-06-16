import Vue, { NativeScriptVue } from 'nativescript-vue';
import { Prop } from 'vue-property-decorator';
import { NavigatedData, Page } from 'tns-core-modules/ui/page/page';
import { View } from 'tns-core-modules/ui/core/view';
import { Color } from 'tns-core-modules/color';

import { actionBarHeight, darkColor, primaryColor } from '../variables';
import { VueConstructor } from 'vue';
import { NavigationEntry, topmost } from 'tns-core-modules/ui/frame/frame';
import { Label } from 'tns-core-modules/ui/label/label';
import { AlertDialog } from 'nativescript-material-dialogs';
import localize from 'nativescript-localize';
import { StackLayout } from 'tns-core-modules/ui/layouts/stack-layout/stack-layout';
import { ActivityIndicator } from 'nativescript-material-activityindicator';
import { clog, log } from '~/utils/logging';

export interface BaseVueComponentRefs {
    [key: string]: any;
    page: NativeScriptVue<Page>;
}

export default class BaseVueComponent extends Vue {
    protected loadingIndicator: AlertDialog & { label?: Label };
    $refs: BaseVueComponentRefs;
    @Prop({ type: String })
    public _themeColor;
    @Prop({ type: String })
    public _darkColor;
    public actionBarHeight = actionBarHeight;
    get page() {
        return this.getRef('page') as Page;
    }
    getRef(key: string) {
        if (this.$refs[key]) {
            return this.$refs[key].nativeView as View;
        }
    }
    getLoadingIndicator() {
        if (!this.loadingIndicator) {
            const stack = new StackLayout();
            stack.padding = 10;
            stack.orientation = 'horizontal';
            const activityIndicator = new ActivityIndicator();
            activityIndicator.className = 'activity-indicator';
            activityIndicator.busy = true;
            stack.addChild(activityIndicator);
            const label = new Label();
            label.paddingLeft = 15;
            label.textWrap = true;
            label.verticalAlignment = 'middle';
            label.fontSize = 16;
            stack.addChild(label);
            this.loadingIndicator = new AlertDialog({
                view: stack
            });
            this.loadingIndicator.label = label;
        }
        return this.loadingIndicator;
    }
    @log
    showLoading(msg: string) {
        const loadingIndicator = this.getLoadingIndicator();
        loadingIndicator.label.text = localize(msg) + '...';
        loadingIndicator.show();
    }
    hideLoading() {
        if (this.loadingIndicator) {
            this.loadingIndicator.hide();
        }
    }
    mounted() {
        const page = this.page;
        if (page) {
            if (gVars.isIOS) {
                page.backgroundSpanUnderStatusBar = true;
                page.statusBarStyle = 'light';
            } else {
                page.androidStatusBarBackground = null;
                page.androidStatusBarBackground = new Color(this.darkColor);
            }
            page.actionBarHidden = true;
            page.backgroundColor = this.darkColor;
            // page.backgroundColor = this.themeColor;
            // page.on(Page.navigatingToEvent, () => {

            // });
            page.on(Page.navigatingFromEvent, (data: NavigatedData) => {
                if (data.isBackNavigation) {
                    this.$getAppComponent().onNavigatingFrom();
                }
            });
        }
    }
    destroyed() {}

    noop() {}

    log(...args) {
        clog(`[${this.constructor.name}]`, ...args);
    }

    navigateTo(component: VueConstructor, options?: NavigationEntry & { props?: any }, cb?: () => Page) {
        options = options || {};
        (options as any).frame = topmost().id;
        return this.$navigateTo(component, options, cb);
    }
    showError(err: Error | string) {
        this.hideLoading();
        this.$showError(err);
    }

    get darkColor() {
        return this._darkColor || darkColor;
    }
    get themeColor() {
        return this._themeColor || primaryColor;
    }
}
