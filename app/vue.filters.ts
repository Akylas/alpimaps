import { fonticon } from 'nativescript-akylas-fonticon';
import { localize } from 'nativescript-localize';
import VueStringFilter from 'vue-string-filter';
import { GeoLocation } from 'nativescript-gps';
import { convertValueToUnit } from './helpers/formatter';
const Plugin = {
    install(Vue) {
        Vue.filter('fonticon', fonticon);

        Vue.use(VueStringFilter);

        Vue.filter('L', localize);

        Vue.filter('unit', function(value, unit) {
            return convertValueToUnit(value, unit).join(' ');
        });
        Vue.filter('capitalize', function(value) {
            value = value.toString();
            return value.charAt(0).toUpperCase() + value.slice(1);
        });
    }
};

export default Plugin;
