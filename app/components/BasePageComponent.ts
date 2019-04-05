import BaseVueComponent from './BaseVueComponent';
import { VueConstructor } from 'vue';
import { NavigationEntry, Page, topmost } from 'tns-core-modules/ui/frame/frame';

export default class BasePageComponent extends BaseVueComponent {
    loading = false;
    navigateTo(component: VueConstructor, options?: NavigationEntry & { props?: any }, cb?: () => Page) {
        options = options || {};
        (options as any).frame = topmost().id;
        return this.$navigateTo(component, options, cb);
    }
}
