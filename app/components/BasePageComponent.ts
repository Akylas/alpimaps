import { Frame, NavigationEntry } from '@nativescript/core/ui/frame';
import { Page } from '@nativescript/core/ui/page';
import { VueConstructor } from 'vue';
import BaseVueComponent from './BaseVueComponent';

export default class BasePageComponent extends BaseVueComponent {
    loading = false;
    navigateTo(component: VueConstructor, options?: NavigationEntry & { props?: any }, cb?: () => Page) {
        options = options || {};
        (options as any).frame = Frame.topmost().id;
        return this.$navigateTo(component, options, cb);
    }
}
