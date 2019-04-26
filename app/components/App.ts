import * as app from 'application';
import * as EInfo from 'nativescript-extendedinfo';
import Vue, { NativeScriptVue } from 'nativescript-vue';
import { GridLayout } from 'tns-core-modules/ui/layouts/grid-layout';
import { StackLayout } from 'tns-core-modules/ui/layouts/stack-layout';
import { isIOS } from 'tns-core-modules/platform';
import { GC } from 'tns-core-modules/utils/utils';
import { Frame, topmost } from 'ui/frame/frame';
import { Component } from 'vue-property-decorator';
import Map from '~/components/Map';
import { GeoHandler } from '~/handlers/GeoHandler';
import { BaseVueComponentRefs } from './BaseVueComponent';
import BgServiceComponent from './BgServiceComponent';
import { clog } from '~/utils/logging';

export interface AppRefs extends BaseVueComponentRefs {
    [key: string]: any;
    innerFrame: NativeScriptVue<Frame>;
    menu: NativeScriptVue<StackLayout>;
    // drawer: NativeScriptVue<RadSideDrawer>;
}

const routes = {
    map: {
        component: Map
    }
    // settings: {
    //     component: Settings
    // },
    // history: {
    //     component: History
    // }
};

@Component({
    components: {
        Map
    }
})
export default class App extends BgServiceComponent {
    $refs: AppRefs;

    public activatedUrl = 'map';
    // private _sideDrawerTransition: DrawerTransitionBase;

    public appVersion: string;

    stack: string[] = [];

    // get drawer() {
    //     return this.$refs.drawer && this.$refs.drawer.nativeView;
    // }
    get innerFrame() {
        return this.$refs.innerFrame && this.$refs.innerFrame.nativeView;
    }
    constructor() {
        super();
        this.$setAppComponent(this);
        // this.cartoLicenseRegistered = Vue.prototype.$cartoLicenseRegistered;
        this.stack.push(this.activatedUrl);
        this.appVersion = EInfo.getVersionNameSync() + '.' + EInfo.getBuildNumberSync();
    }

    menuItems = [
        {
            title: 'map',
            icon: 'map',
            url: 'map'
            // },
            // {
            //     title: 'settings',
            //     icon: 'settings',
            //     url: 'settings'
        }
    ];
    onNavigatingTo() {
        clog(this.constructor.name, 'onNavigatingTo');
        GC();
    }

    onServiceLoaded(geoHandler: GeoHandler) {}
    destroyed() {
        super.destroyed();
    }
    mounted(): void {
        super.mounted();
        // this.page.actionBarHidden = true;
        // setDrawerInstance(this.drawer);

        if (isIOS && app.ios.window.safeAreaInsets) {
            const bottomSafeArea: number = app.ios.window.safeAreaInsets.bottom;
            if (bottomSafeArea > 0) {
                app.addCss(`
                  Button.button-bottom-nav { padding-bottom: ${bottomSafeArea} !important }
              `);
            }
        }
        // this.activatedUrl = '/pairing';
        // this._sideDrawerTransition = new SlideInOnTopTransition();

        // this.router.events.subscribe((event: NavigationEnd) => {
        //     if (event instanceof NavigationEnd) {
        //         this.activatedUrl = event.urlAfterRedirects;
        //     }
        // });
    }

    // get sideDrawerTransition(): DrawerTransitionBase {
    //     return this._sideDrawerTransition;
    // }

    // get gesturesEnabled(): boolean {
    //     // clog('gestureEnabled', this.activatedUrl);
    //     // return this.activatedUrl === '/home';
    //     return true;
    // }

    isComponentSelected(url: string) {
        // clog('isComponentSelected', url, this.activatedUrl);
        return this.activatedUrl === url;
    }

    // openDrawer() {
    //     this.drawer.showDrawer();
    // }
    // closeDrawer() {
    //     this.drawer && this.drawer.closeDrawer();
    // }
    // onCloseDrawerTap() {
    //     this.closeDrawer();
    // }

    onNavigatingFrom() {
        // console.log('onNavigatingFrom', this.activatedUrl, this.stack);
        if (this.stack.length === 1) {
            return;
        }
        this.stack.pop();
        const id = this.stack[this.stack.length - 1];
        if (routes[id]) {
            this.setActivatedUrl(id);
        }
    }
    navigateBackToRoot() {
        this.setActivatedUrl(this.stack[0]);
        this.stack = [this.stack[0]];
        const backstackEntryFirstPage = topmost().backStack[0];
        (this.$navigateBack as any)({}, backstackEntryFirstPage);
    }
    _findParentFrame() {
        let frame: any = topmost();
        if (!frame) {
            frame = this.$parent;
            while (frame && frame.$parent && frame.$options.name !== 'Frame') {
                frame = frame.$parent;
            }
            if (frame && frame.$options.name === 'Frame') {
                return frame['nativeView'] as Frame;
            }
            return undefined;
        } else {
            return frame;
        }
    }
    onMenuIcon() {
        const canGoBack = this._findParentFrame().canGoBack();
        // const canGoBack = this.innerFrame && this.innerFrame.canGoBack();

        if (canGoBack) {
            return this.navigateBack();
        } else {
            // this.$emit('tapMenuIcon');
            // const drawer = getDrawerInstance();
            // if (drawer) {
            // this.drawer.toggleDrawerState();
            // }
        }
    }
    canGoBack() {
        return this.stack.length > 1;
    }

    isActiveUrl(id) {
        // clog('isActiveUrl', id, this.activatedUrl);
        return this.activatedUrl === id;
    }
    // @log
    setActivatedUrl(id) {
        this.activatedUrl = id;
        this.$nextTick(() => {
            this.$refs.menu &&
                this.$refs.menu.nativeView.eachChildView((c: GridLayout) => {
                    c.notify({ eventName: 'activeChange', object: c });
                    c.eachChildView(c2 => {
                        if (c2.hasOwnProperty('active')) {
                            c2.notify({ eventName: 'activeChange', object: c });
                            return true;
                        }
                    });
                    return true;
                });
        });
    }
    navigateBack() {
        if (gVars.isIOS) {
            this.innerFrame && this.innerFrame.goBack();
        } else {
            this.$navigateBack();
        }
    }
    navigateInFrameTo(id: string | typeof Vue, props?) {
        let comp: typeof Vue;
        if (typeof id === 'string') {
            comp = routes[id].component;
            this.setActivatedUrl(id);
        } else {
            comp = id as any;
            id = comp.name;
        }
        const params = {
            props
        } as any;
        if (isIOS && this.innerFrame) {
            params.frame = this.innerFrame.id;
        }
        this.$navigateTo(comp, params);
        this.stack.push(id);
        // this.closeDrawer();
    }

    onNavItemTap(url: string, comp?: any): void {
        if (this.isActiveUrl(url)) {
            return;
        }
        const index = this.stack.indexOf(url);
        if (index === -1) {
            this.navigateInFrameTo(url);
        } else {
            this.navigateBack();
        }
    }
    cartoLicenseRegistered = false;
    setCartoLicenseRegistered(result: boolean) {
        this.cartoLicenseRegistered = result;
    }
}
