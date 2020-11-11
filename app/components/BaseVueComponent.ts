import { ActivityIndicator } from '@nativescript-community/ui-material-activityindicator';
import { AlertDialog } from '@nativescript-community/ui-material-dialogs';
import { Color, Frame, Label, Page, StackLayout, View } from '@nativescript/core';
import { bind } from 'helpful-decorators';
import Vue, { NativeScriptVue, NavigationEntryVue } from 'nativescript-vue';
import { VueConstructor } from 'vue';
import { Prop } from 'vue-property-decorator';
import {
    accentColor,
    actionBarHeight,
    darkColor,
    mdiFontFamily,
    navigationBarHeight,
    primaryColor,
    statusBarHeight,
} from '../variables';

export interface BaseVueComponentRefs {
    [key: string]: any;
    page: NativeScriptVue<Page>;
}

export default class BaseVueComponent extends Vue {
    protected loadingIndicator: AlertDialog & { label?: Label };
    $refs: BaseVueComponentRefs;
    @Prop({ type: Color, default: () => primaryColor })
    public themeColor: Color;
    @Prop({ type: Color, default: () => darkColor })
    public darkColor: Color;
    @Prop({ type: Color, default: () => accentColor })
    public accentColor: Color;
    @Prop({ type: Number, default: actionBarHeight })
    public actionBarHeight;
    needsRoundedWatchesHandle = false;
    debug = false;
    public navigateUrl = null;

    navigationBarHeight = navigationBarHeight;
    statusBarHeight = statusBarHeight;
    public mdiFontFamily = mdiFontFamily;
    // isAndroid = global.isAndroid;
    // isIOS = global.isIOS;
    getRef<T extends View = View>(key: string) {
        if (this.$refs[key]) {
            return (this.$refs[key] as NativeScriptVue<T>).nativeView;
        }
    }
    get page() {
        return this.getRef<Page>('page');
    }
    noop() {}
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
                view: stack,
                cancelable: false,
            });
            this.loadingIndicator.label = label;
        }
        return this.loadingIndicator;
    }
    showLoadingStartTime: number = null;
    showLoading(msg: string) {
        const loadingIndicator = this.getLoadingIndicator();
        // this.log('showLoading', msg, !!this.loadingIndicator);
        loadingIndicator.label.text = msg + '...';
        this.showLoadingStartTime = Date.now();
        loadingIndicator.show();
    }
    hideLoading() {
        const delta = this.showLoadingStartTime ? Date.now() - this.showLoadingStartTime : -1;
        if (delta >= 0 && delta < 1000) {
            setTimeout(() => this.hideLoading(), 1000 - delta);
            return;
        }
        // this.log('hideLoading', !!this.loadingIndicator);
        if (this.loadingIndicator) {
            this.loadingIndicator.hide();
        }
    }
    mounted() {
        if (global.isIOS) {
            const page = this.page;
            if (page) {
                page.backgroundSpanUnderStatusBar = true;
            }
        }
        // if (global.isAndroid) {
        //     const nativeView = this.nativeView;
        //     this.log('android test', nativeView.isLoaded, !!nativeView.nativeViewProtected);
        //     if (!!nativeView.nativeViewProtected) {
        //         (nativeView.nativeViewProtected as android.view.View).setTag(this.constructor.name);
        //     } else {
        //         nativeView.once(View.loadedEvent, () => {
        //             if (nativeView.nativeViewProtected) {
        //                 (nativeView.nativeViewProtected as android.view.View).setTag(this.constructor.name);
        //             }
        //         });
        //     }
        // }
    }
    destroyed() {}

    navigateTo(component: VueConstructor, options?: NavigationEntryVue, cb?: () => Page) {
        options = options || {};
        (options as any).frame = options['frame'] || Frame.topmost().id;
        return this.$navigateTo(component, options, cb);
    }

    @bind
    showError(err: Error | string) {
        this.showErrorInternal(err);
    }
    showErrorInternal(err: Error | string) {
        const delta = this.showLoadingStartTime ? Date.now() - this.showLoadingStartTime : -1;
        if (delta >= 0 && delta < 1000) {
            setTimeout(() => this.showErrorInternal(err), 1000 - delta);
            return;
        }
        this.hideLoading();
        this.$crashReportService.showError(err);
    }

    log(...args) {
        console.log(`[${this.constructor.name}]`, ...args);
    }

    goBack() {
        this.$navigateBack();
    }
}
