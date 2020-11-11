import { AndroidActivityBackPressedEventData } from '@akylas/nativescript/application/application-interfaces';
import { Drawer } from '@nativescript-community/ui-drawer';
import { AndroidApplication, Application, Frame, GridLayout, NavigationEntry, Page, StackLayout } from '@nativescript/core';
import Vue, { NativeScriptVue, NavigationEntryVue } from 'nativescript-vue';
import { VueConstructor } from 'vue';
import { Component } from 'vue-property-decorator';
import Map from '~/components/Map';
import { GeoHandler } from '~/handlers/GeoHandler';
import { BaseVueComponentRefs } from './BaseVueComponent';
import BgServiceComponent from './BgServiceComponent';
import MapRightMenu from './MapRightMenu';

export interface AppRefs extends BaseVueComponentRefs {
    [key: string]: any;
    innerFrame: NativeScriptVue<Frame>;
    // drawer: NativeScriptVue<RadSideDrawer>;
}

export enum ComponentIds {
    Map = 'map',
}

export const navigateUrlProperty = 'navigateUrl';

@Component({
    components: {
        Map,
    },
})
export default class App extends BgServiceComponent {
    $refs: AppRefs;

    public activatedUrl = '';

    stack: string[] = [];

    protected routes: { [k: string]: { component: typeof Vue } } = {
        [ComponentIds.Map]: {
            component: Map,
        },
    };
    get innerFrame() {
        return this.getRef<Frame>('innerFrame');
    }
    constructor() {
        super();
        this.$setAppComponent(this);

        // this.cartoLicenseRegistered = Vue.prototype.$cartoLicenseRegistered;
        this.stack.push(this.activatedUrl);
        // this.appVersion = EInfo.getVersionNameSync() + '.' + EInfo.getBuildNumberSync();
    }

    // drawerOptions: OptionsType = {
    //     left: {
    //         swipeOpenTriggerWidth: 10
    //     },
    //     right: {
    //         swipeOpenTriggerWidth: 10
    //     }
    // };
    menuItems = [
        {
            title: 'map',
            icon: 'map',
            url: 'map',
            // },
            // {
            //     title: 'settings',
            //     icon: 'settings',
            //     url: 'settings'
        },
    ];
    onLoaded() {
        // GC();
        // if (global.isAndroid) {
        //     // c2c981c1a35d7302
        //     console.log('test ANDROID_ID', android.provider.Settings.Secure.getString(app.android.foregroundActivity.getContentResolver(), android.provider.Settings.Secure.ANDROID_ID));
        // }
    }

    onServiceLoaded(geoHandler: GeoHandler) {}
    onAndroidBackButton(data: AndroidActivityBackPressedEventData) {
        data.cancel = true;
        Application.android.foregroundActivity.moveTaskToBack(true);
    }
    mounted(): void {
        super.mounted();
        if (global.isAndroid) {
            Application.android.on(AndroidApplication.activityBackPressedEvent, this.onAndroidBackButton);
        }
        if (!App.cartoLicenseRegistered) {
            // const startTime = Date.now();
            // const result = registerLicense(gVars.CARTO_TOKEN);
            // this.log('registerLicense done', gVars.CARTO_TOKEN, result, Date.now() - startTime, 'ms');
            // this.$getAppComponent().setCartoLicenseRegistered(result);
        }
        if (global.isIOS && Application.ios.window.safeAreaInsets) {
            const bottomSafeArea: number = Application.ios.window.safeAreaInsets.bottom;
            if (bottomSafeArea > 0) {
                Application.addCss(`
                  Button.button-bottom-nav { padding-bottom: ${bottomSafeArea} !important }
              `);
            }
        }
        this.innerFrame.on(Page.navigatingToEvent, this.onPageNavigation, this);
    }
    destroyed() {
        if (global.isAndroid) {
            Application.android.off(AndroidApplication.activityBackPressedEvent, this.onAndroidBackButton);
        }
        this.innerFrame.off(Page.navigatingToEvent, this.onPageNavigation, this);
        super.destroyed();
    }

    static cartoLicenseRegistered = false;
    cartoLicenseRegistered = App.cartoLicenseRegistered;
    setCartoLicenseRegistered(result: boolean) {
        if (App.cartoLicenseRegistered !== result) {
            this.log('setCartoLicenseRegistered', result);
            App.cartoLicenseRegistered = result;
            this.cartoLicenseRegistered = result;
        }
    }
    mapMounted = false;
    setMapMounted(result: boolean) {
        this.mapMounted = result;
    }
    onNavigatingTo() {
        // this.$navigateTo(Login, {
        //         animated: false
        //     })
        // setTimeout(() =>
        //     this.$navigateBack(), 5000)
    }
    onPageNavigation(event) {
        // const page = event.entry.resolvedPage;
        // if (page) {
        //     const device = global.isAndroid ? 'android android' : 'ios ios';
        //     page.className = `${page.className || ''} ${device}`;
        // }
        // this.log('onPageNavigation', event.entry.resolvedPage, event.entry.resolvedPage[navigateUrlProperty]);
        this.closeDrawer();
        this.setActivatedUrl(event.entry.resolvedPage[navigateUrlProperty]);
    }

    isComponentSelected(url: string) {
        // this.log('isComponentSelected', url, this.activatedUrl);
        return this.activatedUrl === url;
    }
    drawer: Drawer;
    openDrawer() {
        this.drawer.open();
    }
    closeDrawer() {
        this.drawer && this.drawer.close();
    }
    onMenuIcon() {
        const canGoBack = this.canGoBack();
        // const canGoBack = this.innerFrame && this.innerFrame.canGoBack();

        if (canGoBack) {
            return this.navigateBack();
        } else {
            this.$emit('tapMenuIcon');
            this.drawer.toggle();
        }
    }
    canGoBack() {
        return this.innerFrame && this.innerFrame.canGoBack();
    }

    isActiveUrl(id) {
        // this.log('isActiveUrl', id, this.activatedUrl);
        return this.activatedUrl === id;
    }

    handleSetActivatedUrl(id) {
        this.$nextTick(() => {
            this.$refs.menu &&
                this.$refs.menu.nativeView.eachChildView((c: GridLayout) => {
                    c.notify({ eventName: 'activeChange', object: c });
                    c.eachChildView((c2) => {
                        if (c2.hasOwnProperty('active')) {
                            c2.notify({ eventName: 'activeChange', object: c });
                            return true;
                        }
                    });
                    return true;
                });
        });
    }
    // @log
    setActivatedUrl(id) {
        if (!id) {
            return;
        }
        this.activatedUrl = id;
        // this.log('setActivatedUrl', id);
        this.handleSetActivatedUrl(id);
    }
    navigateBack(backEntry?) {
        this.innerFrame && this.innerFrame.goBack(backEntry);
    }

    navigateBackIfUrl(url) {
        if (this.isActiveUrl(url)) {
            this.navigateBack();
        }
    }
    findNavigationUrlIndex(url) {
        return this.innerFrame.backStack.findIndex((b) => b.resolvedPage[navigateUrlProperty] === url);
    }
    navigateBackToUrl(url) {
        const index = this.findNavigationUrlIndex(url);
        // console.log('navigateBackToUrl', url, index);
        if (index === -1) {
            // console.log(url, 'not in backstack');
            return;
        }
        this.navigateBack(this.innerFrame.backStack[index]);
    }
    navigateBackToRoot() {
        const stack = this.innerFrame.backStack;
        if (stack.length > 0) {
            this.innerFrame && this.innerFrame.goBack(stack[0]);
        }
    }
    onNavItemTap(url: string, comp?: any): void {
        // this.log('onNavItemTap', url);
        this.navigateToUrl(url as any);
        // });
    }

    navigateTo(component: VueConstructor, options?: NavigationEntryVue, cb?: () => Page) {
        options = options || {};
        // options.transition = options.transition || {
        //     name: 'fade',
        //     duration: 200,
        //     curve: 'easeIn'
        // },
        (options as any).frame = options['frame'] || this.innerFrame.id;
        return super.navigateTo(component, options, cb);
    }
    navigateToUrl(url: ComponentIds, options?: NavigationEntry & { props?: any }, cb?: () => Page) {
        if (this.isActiveUrl(url) || !this.routes[url]) {
            return;
        }
        // options = options || {};
        // options.props = options.props || {};
        // options.props[navigateUrlProperty] = url;

        this.closeDrawer();
        // console.log('navigateToUrl', url);
        const index = this.findNavigationUrlIndex(url);
        if (index === -1) {
            this.navigateTo(this.routes[url].component, options);
        } else {
            this.navigateBackToUrl(url);
        }
    }
}
