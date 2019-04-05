import { fonticon } from 'nativescript-fonticon';
import { localize } from 'nativescript-localize';
import VueStringFilter from 'vue-string-filter/VueStringFilter';
import { GeoLocation } from 'nativescript-gps';
const Plugin = {
    install(Vue) {
        Vue.filter('fonticon', fonticon);

        Vue.use(VueStringFilter);

        Vue.filter('L', localize);
    }
};

export default Plugin;
