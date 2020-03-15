import * as app from '@nativescript/core/application';
import { device, isIOS, screen } from '@nativescript/core/platform';
import { NavigationEntry } from '@nativescript/core/ui/frame';
import { Frame } from '@nativescript/core/ui/frame/';
import { GridLayout } from '@nativescript/core/ui/layouts/grid-layout';
import { StackLayout } from '@nativescript/core/ui/layouts/stack-layout';
import { Page } from '@nativescript/core/ui/page';
import { registerLicense } from 'nativescript-carto/ui';
import { setShowDebug, setShowError, setShowInfo, setShowWarn } from 'nativescript-carto/utils';
import { compose } from 'nativescript-email';
import * as EInfo from 'nativescript-extendedinfo';
import { login, prompt } from 'nativescript-material-dialogs';
import { TextField } from 'nativescript-material-textfield';
import Vue, { NativeScriptVue } from 'nativescript-vue';
import { VueConstructor } from 'vue';
import { Component } from 'vue-property-decorator';
import Map from '~/components/Map';
import { GeoHandler } from '~/handlers/GeoHandler';
import { navigationBarHeight, screenHeightDips, screenWidthDips } from '~/variables';
import { BaseVueComponentRefs } from './BaseVueComponent';
import BgServiceComponent from './BgServiceComponent';
import MapRightMenu from './MapRightMenu';
import MultiDrawer, { OptionsType } from './MultiDrawer';

const mailRegexp = /(?:[a-z0-9!#$%&'*+/=?^_`{|}~-]+(?:\.[a-z0-9!#$%&'*+/=?^_`{|}~-]+)*|"(?:[\x01-\x08\x0b\x0c\x0e-\x1f\x21\x23-\x5b\x5d-\x7f]|\\[\x01-\x09\x0b\x0c\x0e-\x7f])*")@(?:(?:[a-z0-9](?:[a-z0-9-]*[a-z0-9])?\.)+[a-z0-9](?:[a-z0-9-]*[a-z0-9])?|\[(?:(?:25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)\.){3}(?:25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?|[a-z0-9-]*[a-z0-9]:(?:[\x01-\x08\x0b\x0c\x0e-\x1f\x21-\x5a\x53-\x7f]|\\[\x01-\x09\x0b\x0c\x0e-\x7f])+)\])/;

function base64Encode(value) {
    if (gVars.isIOS) {
        const text = NSString.stringWithString(value);
        const data = text.dataUsingEncoding(NSUTF8StringEncoding);
        return data.base64EncodedStringWithOptions(0);
    }
    if (gVars.isAndroid) {
        const text = new java.lang.String(value);
        const data = text.getBytes('UTF-8');
        return android.util.Base64.encodeToString(data, android.util.Base64.DEFAULT);
    }
}
export interface AppRefs extends BaseVueComponentRefs {
    [key: string]: any;
    innerFrame: NativeScriptVue<Frame>;
    menu: NativeScriptVue<StackLayout>;
    // drawer: NativeScriptVue<RadSideDrawer>;
}

export enum ComponentIds {
    Map = 'map'
}

export const navigateUrlProperty = 'navigateUrl';

@Component({
    components: {
        MultiDrawer,
        MapRightMenu,
        Map
    }
})
export default class App extends BgServiceComponent {
    $refs: AppRefs;

    public activatedUrl = '';
    // private _sideDrawerTransition: DrawerTransitionBase;

    public appVersion: string;

    stack: string[] = [];

    protected routes: { [k: string]: { component: typeof Vue } } = {
        [ComponentIds.Map]: {
            component: Map
        }
    };

    // get drawer() {
    //     return this.$refs.drawer && this.$refs.drawer.nativeView;
    // }
    get innerFrame() {
        return this.$refs.innerFrame && this.$refs.innerFrame.nativeView;
    }
    get drawer() {
        return this.$refs['drawer'] as MultiDrawer;
    }
    constructor() {
        super();
        this.$setAppComponent(this);
        this.log('mounted', 'cartoLicenseRegistered', App.cartoLicenseRegistered);

        // this.cartoLicenseRegistered = Vue.prototype.$cartoLicenseRegistered;
        this.stack.push(this.activatedUrl);
        this.appVersion = EInfo.getVersionNameSync() + '.' + EInfo.getBuildNumberSync();
    }

    get drawerOptions() {
        const result: OptionsType = {
            left: {
                swipeOpenTriggerWidth: 10,
                backgroundColor: '#1E1E24',
                additionalProperties: {
                    paddingBottom: gVars.isAndroid ? `${navigationBarHeight}` : undefined
                }
            }
        };
        if (this.mapMounted) {
            result.right = {
                backgroundColor: '#aa000000',
                showBackDrop: false,
                width: '200' as any,
                swipeOpenTriggerWidth: 10,
                additionalProperties: {
                    paddingBottom: gVars.isAndroid ? `${navigationBarHeight}` : undefined
                }
                //
            };
        }
        return result;
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
            url: 'map'
            // },
            // {
            //     title: 'settings',
            //     icon: 'settings',
            //     url: 'settings'
        }
    ];
    onLoaded() {
        // GC();
        // if (gVars.isAndroid) {
        //     // c2c981c1a35d7302
        //     console.log('test ANDROID_ID', android.provider.Settings.Secure.getString(app.android.foregroundActivity.getContentResolver(), android.provider.Settings.Secure.ANDROID_ID));
        // }
    }

    onServiceLoaded(geoHandler: GeoHandler) {}
    mounted(): void {
        super.mounted();
        if (!App.cartoLicenseRegistered) {
            const startTime = Date.now();
            const result = registerLicense(gVars.CARTO_TOKEN);
            this.log('registerLicense done', result, Date.now() - startTime, 'ms');
            this.$getAppComponent().setCartoLicenseRegistered(result);

            setShowDebug(true);
            setShowInfo(true);
            setShowWarn(true);
            setShowError(true);
        }
        if (isIOS && app.ios.window.safeAreaInsets) {
            const bottomSafeArea: number = app.ios.window.safeAreaInsets.bottom;
            if (bottomSafeArea > 0) {
                app.addCss(`
                  Button.button-bottom-nav { padding-bottom: ${bottomSafeArea} !important }
              `);
            }
        }
        this.innerFrame.on(Page.navigatingToEvent, this.onPageNavigation, this);
    }
    destroyed() {
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
        // console.log('setMapMounted', result);
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
        const page = event.entry.resolvedPage;
        if (page) {
            const device = gVars.isAndroid ? 'android android' : 'ios ios';
            page.className = `${page.className || ''} ${device}`;
        }
        // this.log('onPageNavigation', event.entry.resolvedPage, event.entry.resolvedPage[navigateUrlProperty]);
        this.closeDrawer();
        this.setActivatedUrl(event.entry.resolvedPage[navigateUrlProperty]);
    }

    isComponentSelected(url: string) {
        // this.log('isComponentSelected', url, this.activatedUrl);
        return this.activatedUrl === url;
    }

    openDrawer() {
        this.drawer.open();
    }
    closeDrawer() {
        this.drawer && this.drawer.close();
    }
    onCloseDrawerTap() {
        this.closeDrawer();
    }
    onMenuIcon() {
        const canGoBack = this.canGoBack();
        // const canGoBack = this.innerFrame && this.innerFrame.canGoBack();

        if (canGoBack) {
            return this.navigateBack();
        } else {
            this.$emit('tapMenuIcon');
            // const drawer = getDrawerInstance();
            // if (drawer) {
            if (this.drawer.isSideOpened()) {
                this.drawer.close();
            } else {
                this.drawer.open();
            }
            // }
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
        return this.innerFrame.backStack.findIndex(b => b.resolvedPage[navigateUrlProperty] === url);
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
    onTap(command: string) {
        switch (command) {
            case 'sendFeedback':
                compose({
                    subject: `[${EInfo.getAppNameSync()}(${this.appVersion})] Feedback`,
                    to: ['martin@akylas.fr'],
                    attachments: [
                        {
                            fileName: 'report.json',
                            path: `base64://${base64Encode(
                                JSON.stringify(
                                    {
                                        device: {
                                            model: device.model,
                                            deviceType: device.deviceType,
                                            language: device.language,
                                            manufacturer: device.manufacturer,
                                            os: device.os,
                                            osVersion: device.osVersion,
                                            region: device.region,
                                            sdkVersion: device.sdkVersion,
                                            uuid: device.uuid
                                        },
                                        screen: {
                                            widthDIPs: screenWidthDips,
                                            heightDIPs: screenHeightDips,
                                            widthPixels: screen.mainScreen.widthPixels,
                                            heightPixels: screen.mainScreen.heightPixels,
                                            scale: screen.mainScreen.scale
                                        }
                                    },
                                    null,
                                    4
                                )
                            )}`,
                            mimeType: 'application/json'
                        }
                    ]
                }).catch(err => this.showError(err));
                break;
            case 'sendBugReport':
                login({
                    title: this.$tc('send_bug_report'),
                    message: this.$tc('send_bug_report_desc'),
                    okButtonText: this.$t('send'),
                    cancelButtonText: this.$t('cancel'),
                    autoFocus: true,
                    usernameTextFieldProperties: {
                        marginLeft: 10,
                        marginRight: 10,
                        autocapitalizationType: 'none',
                        keyboardType: 'email',
                        autocorrect: false,
                        error: this.$tc('email_required'),
                        hint: this.$tc('email')
                    },
                    passwordTextFieldProperties: {
                        marginLeft: 10,
                        marginRight: 10,
                        error: this.$tc('please_describe_error'),
                        secure: false,
                        hint: this.$tc('description')
                    },
                    beforeShow: (options, usernameTextField: TextField, passwordTextField: TextField) => {
                        usernameTextField.on('textChange', (e: any) => {
                            const text = e.value;
                            if (!text) {
                                usernameTextField.error = this.$tc('email_required');
                            } else if (!mailRegexp.test(text)) {
                                usernameTextField.error = this.$tc('non_valid_email');
                            } else {
                                usernameTextField.error = null;
                            }
                        });
                        passwordTextField.on('textChange', (e: any) => {
                            const text = e.value;
                            if (!text) {
                                passwordTextField.error = this.$tc('description_required');
                            } else {
                                passwordTextField.error = null;
                            }
                        });
                    }
                }).then(result => {
                    if (result.result && this.$sentry) {
                        if (!result.userName || !mailRegexp.test(result.userName)) {
                            this.showError(new Error(this.$tc('email_required')));
                            return;
                        }
                        if (!result.password || result.password.length === 0) {
                            this.showError(new Error(this.$tc('description_required')));
                            return;
                        }
                        this.$sentry.withScope(scope => {
                            scope.setUser({ email: result.userName });
                            this.$sentry.captureMessage(result.password);
                            this.$alert(this.$t('bug_report_sent'));
                        });
                    }
                });
                break;
        }
    }

    navigateTo(component: VueConstructor, options?: NavigationEntry & { props?: any }, cb?: () => Page) {
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
