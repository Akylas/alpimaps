import Vue from 'nativescript-vue';

import { cwarn } from '~/utils/logging';
import { setMapPosKeys } from 'nativescript-carto/core';
import * as application from '@nativescript/core/application';

// import * as trace from '@nativescript/core/trace';
// trace.addCategories(trace.categories.ViewHierarchy);
// trace.addCategories(trace.categories.Navigation);
// trace.addCategories(trace.categories.Layout);
// trace.addCategories(trace.categories.Animation);
// trace.addCategories(trace.categories.Style);
// trace.addCategories(trace.categories.Style);
// trace.addCategories(trace.categories.VisualTreeEvents);
// trace.enable();

setMapPosKeys('lat', 'lon');
function CustomError(error) {
    this.name = 'CustomError';
    this.message = error.message || '';
    error.name = this.name;
    this.stack = error['stackTrace'];
}
CustomError.prototype = Object.create(Error.prototype);



application.on(application.discardedErrorEvent, args => {
    const error = args.error;
    // const jsError = new Error(error.message);
    error.stack = error.stackTrace;
    console.log(error);
    // console.log('[stackTrace test Value]', error.message, error.stackTrace);
    // console.log('[stack test value]', error.message, error.stack);
    // console.log(jsError);
    // setTimeout(() => {
    // throw new Error('test');
    // }, 0);
});

import { device } from '@nativescript/core/platform';
import { getBuildNumber, getVersionName } from 'nativescript-extendedinfo';
if (PRODUCTION || gVars.sentry) {
    import('nativescript-akylas-sentry').then(Sentry => {
        Vue.prototype.$sentry = Sentry;
        Promise.all([getVersionName(), getBuildNumber()]).then(res => {
            Sentry.init({
                dsn: gVars.SENTRY_DSN,
                appPrefix: gVars.SENTRY_PREFIX,
                release: `${res[0]}`,
                dist: `${res[1]}.${gVars.isAndroid ? 'android' : 'ios'}`
            });
            Sentry.setTag('locale', device.language);
        });
    });
} else {
    Vue.prototype.$sentry = null;
}

import { primaryColor } from './variables';
import { install, themer } from 'nativescript-material-core';
import { install as installBottomSheets } from 'nativescript-material-bottomsheet';
import { install as installGestures } from 'nativescript-gesturehandler';
if (gVars.isIOS) {
    themer.setPrimaryColor(primaryColor);
}
install();
installBottomSheets();
installGestures();

import MixinsPlugin from './vue.mixins';
Vue.use(MixinsPlugin);

import ViewsPlugin from './vue.views';
Vue.use(ViewsPlugin);

// importing filters
import FiltersPlugin from './vue.filters';
Vue.use(FiltersPlugin);

import { TNSFontIcon } from 'nativescript-akylas-fonticon';
// TNSFontIcon.debug = true;
TNSFontIcon.paths = {
    maki: './assets/maki.css',
    osm: './assets/osm.css'
};
TNSFontIcon.loadCssSync();

// adding to Vue prototype
import PrototypePlugin from './vue.prototype';
Vue.use(PrototypePlugin);

// application.on(application.uncaughtErrorEvent, args => {
//     const error = args.error;
//     // const nErrror = args.android as java.lang.Exception;
//     // clog('onNativeError', error, Object.keys(args), Object.keys(error), error.message, error.stackTrace);
//     // clog('nErrror', nErrror);
//     clog('uncaughtErrorEvent', error);
// });
// application.on(application.discardedErrorEvent, args => {
//     const error = args.error;
//     // const nErrror = args.android as java.lang.Exception;
//     // clog('onNativeError', error, Object.keys(args), Object.keys(error), error.message, error.stackTrace);
//     // clog('nErrror', nErrror);
//     clog('discardedErrorEvent', error);
// });

// import './app.scss'

// Prints Vue logs when --env.production is *NOT* set while building
// Vue.config.silent = !DEV_LOG;
// Vue.config['debug'] = DEV_LOG;
Vue.config.silent = !DEV_LOG;
Vue.config['debug'] = DEV_LOG;

function throwVueError(err) {
    Vue.prototype.$showError(err);
    // throw err;
}

Vue.config.errorHandler = (e, vm, info) => {
    if (e) {
        console.log('[Vue]', `[${info}]`, e);
        setTimeout(() => throwVueError(e), 0);
    }
};

Vue.config.warnHandler = function(msg, vm, trace) {
    cwarn(msg, trace);
};

/* DEV-START */
// const VueDevtools = require('nativescript-vue-devtools');
// Vue.use(VueDevtools
// , { host: '192.168.1.43' }
// );
/* DEV-END */

import App from '~/components/App';
new Vue({
    render: h => {
        return h(App);
    }
}).$start();
