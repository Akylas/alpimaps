import { setGeoLocationKeys } from '@nativescript-community/gps';
import { setMapPosKeys } from '@nativescript-community/ui-carto/core';
import { themer } from '@nativescript-community/ui-material-core';
import * as application from '@nativescript/core/application';
import { TNSFontIcon } from 'nativescript-akylas-fonticon';
import Vue from 'nativescript-vue';
import Map from '~/components/Map';
import CrashReportService from './services/CrashReportService';
import { primaryColor } from './variables';
// importing filters
import FiltersPlugin from './vue.filters';
import MixinsPlugin from './vue.mixins';
// adding to Vue prototype
import PrototypePlugin from './vue.prototype';
import ViewsPlugin from './vue.views';
const crashReportService = new CrashReportService();
// start it as soon as possible
crashReportService.start();

Vue.registerElement('GridLayout', function () {
    return require('@nativescript/core').GridLayout;
});
Vue.registerElement('StackLayout', function () {
    return require('@nativescript/core').StackLayout;
});
Vue.registerElement('AbsoluteLayout', function () {
    return require('@nativescript/core').AbsoluteLayout;
});
Vue.registerElement('FlexboxLayout', function () {
    return require('@nativescript/core').FlexboxLayout;
});
Vue.registerElement('ScrollView', function () {
    return require('@nativescript/core').ScrollView;
});
Vue.registerElement(
    'Switch',
    function () {
        return require('@nativescript/core').Switch;
    },
    {
        model: {
            prop: 'checked',
            event: 'checkedChange',
        },
    }
);
Vue.prototype.$crashReportService = crashReportService;

// import {Trace} from '@nativescript/core/trace';
// trace.addCategories(trace.categories.ViewHierarchy);
// trace.addCategories(trace.categories.Navigation);
// trace.addCategories(trace.categories.Layout);
// trace.addCategories(trace.categories.Animation);
// trace.addCategories(trace.categories.Style);
// trace.addCategories(trace.categories.Style);
// Trace.addCategories(Trace.categories.VisualTreeEvents);
// Trace.enable();

setMapPosKeys('lat', 'lon');
setGeoLocationKeys('lat', 'lon');

application.on(application.discardedErrorEvent, (args) => {
    const error = args.error;
    error.stack = error.stackTrace;
    console.log('discardedErrorEvent', error);
});

if (global.isIOS) {
    themer.setPrimaryColor(primaryColor);
}

Vue.use(MixinsPlugin);
Vue.use(ViewsPlugin);
Vue.use(FiltersPlugin);

TNSFontIcon.paths = {
    osm: './assets/osm.css',
};
TNSFontIcon.loadCssSync();

Vue.use(PrototypePlugin);

// application.on(application.uncaughtErrorEvent, args => {
//     const error = args.error;
//     // const nErrror = args.android as java.lang.Exception;
//     // console.log('onNativeError', error, Object.keys(args), Object.keys(error), error.message, error.stackTrace);
//     // console.log('nErrror', nErrror);
//     console.log('uncaughtErrorEvent', error);
// });
// application.on(application.discardedErrorEvent, args => {
//     const error = args.error;
//     // const nErrror = args.android as java.lang.Exception;
//     // console.log('onNativeError', error, Object.keys(args), Object.keys(error), error.message, error.stackTrace);
//     // console.log('nErrror', nErrror);
//     console.log('discardedErrorEvent', error);
// });

// import './app.scss'

// Prints Vue logs when --env.production is *NOT* set while building
// Vue.config.silent = !DEV_LOG;
// Vue.config['debug'] = DEV_LOG;
Vue.config.silent = true;
Vue.config['debug'] = false;

function throwVueError(err) {
    crashReportService.showError(err);
}

Vue.config.errorHandler = (e, vm, info) => {
    if (e) {
        console.log('[Vue]', `[${info}]`, e, info, e.stack);
        setTimeout(() => throwVueError(e), 0);
    }
};

Vue.config.warnHandler = function (msg, vm, trace) {
    console.warn(msg, trace);
};

new Vue({
    render: (h) => h(Map),
}).$start();
