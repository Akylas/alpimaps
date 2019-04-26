import BaseVueComponent from './BaseVueComponent';
import { VueConstructor } from 'vue';
import { NavigationEntry, topmost } from 'tns-core-modules/ui/frame';
import { Page } from 'tns-core-modules/ui/page';

export default class BasePageComponent extends BaseVueComponent {
    loading = false;
    navigateTo(component: VueConstructor, options?: NavigationEntry & { props?: any }, cb?: () => Page) {
        options = options || {};
        (options as any).frame = topmost().id;
        return this.$navigateTo(component, options, cb);
    }
}
