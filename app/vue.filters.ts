import { fonticon } from 'nativescript-akylas-fonticon';
import { $t } from '~/helpers/locale';
import VueStringFilter from 'vue-string-filter';
import { GeoLocation } from '@nativescript-community/gps';
import { convertValueToUnit } from './helpers/formatter';
import { convertTime } from '~/helpers/formatter';
const Plugin = {
    install(Vue) {
        Vue.filter('fonticon', fonticon);
        Vue.use(VueStringFilter);

        Vue.filter('L', $t);

        Vue.filter('unit', function (value, unit) {
            return convertValueToUnit(value, unit).join(' ');
        });
        Vue.filter('date', function (value, formatStr?: string) {
            return convertTime(value, formatStr || 'LLL');
            // if (value) {
            //     return format(value, formatStr || '[Today is a] dddd', {
            //         locale: frLocale
            //     });
            // }
        });
        Vue.filter('capitalize', function (value) {
            value = value.toString();
            return value.charAt(0).toUpperCase() + value.slice(1);
        });
    },
};

export default Plugin;
