import { View } from '@nativescript/core/ui/core/view';
import { Frame, NavigationEntry } from '@nativescript/core/ui/frame';
import { Label } from '@nativescript/core/ui/label/label';
import { StackLayout } from '@nativescript/core/ui/layouts/stack-layout';
import { Page } from '@nativescript/core/ui/page';
import { ActivityIndicator } from 'nativescript-material-activityindicator';
import { AlertDialog } from 'nativescript-material-dialogs';
import Vue, { NativeScriptVue } from 'nativescript-vue';
import { VueConstructor } from 'vue';
import { Prop } from 'vue-property-decorator';
import { clog } from '~/utils/logging';
import { accentColor, actionBarHeight, darkColor, mdiFontFamily, navigationBarHeight, primaryColor, statusBarHeight } from '../variables';

export interface BaseVueComponentRefs {
    [key: string]: any;
    page: NativeScriptVue<Page>;
}

export default class BaseVueComponent extends Vue {
    protected loadingIndicator: AlertDialog & { label?: Label };
    $refs: BaseVueComponentRefs;
    @Prop({ type: String, default: primaryColor })
    public themeColor;
    @Prop({ type: String, default: darkColor })
    public darkColor;
    @Prop({ type: String, default: accentColor })
    public accentColor;
    @Prop({ type: Number, default: actionBarHeight })
    public actionBarHeight;
    needsRoundedWatchesHandle = false;
    debug = false;

    navigationBarHeight = navigationBarHeight;
    statusBarHeight = statusBarHeight;
    public mdiFontFamily = mdiFontFamily;
    // isAndroid = gVars.isAndroid;
    // isIOS = gVars.isIOS;
    getRef(key: string) {
        if (this.$refs[key]) {
            return this.$refs[key].nativeView as View;
        }
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
                cancelable: false
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
        // if (gVars.isAndroid) {
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

    navigateTo(component: VueConstructor, options?: NavigationEntry & { props?: any }, cb?: () => Page) {
        options = options || {};
        (options as any).frame = options['frame'] || Frame.topmost().id;
        return this.$navigateTo(component, options, cb);
    }
    showError(err: Error | string) {
        const delta = this.showLoadingStartTime ? Date.now() - this.showLoadingStartTime : -1;
        if (delta >= 0 && delta < 1000) {
            setTimeout(() => this.showError(err), 1000 - delta);
            return;
        }
        this.hideLoading();
        this.$showError(err);
    }

    log(...args) {
        clog(`[${this.constructor.name}]`, ...args);
    }

    goBack() {
        this.$getAppComponent().goBack();
    }
}
