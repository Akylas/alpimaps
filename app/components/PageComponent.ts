import { Frame, NavigationEntry } from '@nativescript/core/ui/frame';
import { Page } from '@nativescript/core/ui/page';
import { VueConstructor } from 'vue';
import { Component } from 'vue-property-decorator';
import AlpiMapsPage from './AlpiMapsPage';
import BaseVueComponent from './BaseVueComponent';

@Component({})
export default class PageComponent extends BaseVueComponent {
    public navigateUrl = null;
    constructor() {
        super();
        // this.showMenuIcon = true;
    }

    get loading() {
        return this.page && this.page.loading;
    }
    set loading(value: boolean) {
        if (this.page) {
            this.page.loading = value;
        }
    }

    // get page() {
    //     return
    // }
    page: AlpiMapsPage;
    mounted() {
        super.mounted();
        this.page = this.$children[0] as AlpiMapsPage;
        // console.log(this.$children[0].constructor.name, this.navigateUrl);
        this.page.navigateUrl = this.navigateUrl;
    }
    destroyed() {
        super.destroyed();
    }
    showError(err: Error | string) {
        this.log('showError', err);
        this.loading = false;
        super.showError(err);
    }
    close() {
        this.$getAppComponent().navigateBackIfUrl(this.navigateUrl);
    }
    navigateTo(component: VueConstructor, options?: NavigationEntry & { props?: any }, cb?: () => Page) {
        options = options || {};
        (options as any).frame = Frame.topmost().id;
        return this.$navigateTo(component, options, cb);
    }
}
