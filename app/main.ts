import Vue from 'nativescript-vue';
import { knownFolders } from 'tns-core-modules/file-system';

import { getBuildNumber, getVersionName } from 'nativescript-extendedinfo';
import { cerror, clog, cwarn } from '~/utils/logging';
import { Client } from 'nativescript-bugsnag';

// override to get all logs
console.log = clog;
console.error = cerror;
console.warn = cwarn;

/* DEV-START */
const currentApp = knownFolders.currentApp();
require('source-map-support').install({
    environment: 'node',
    handleUncaughtExceptions: false,
    retrieveSourceMap(source) {
        const sourceMapPath = source + '.map';
        const sourceMapRelativePath = sourceMapPath.replace('file://', '').replace(currentApp.path + '/', '');

        return {
            url: sourceMapRelativePath + '/',
            map: currentApp.getFile(sourceMapRelativePath).readTextSync()
        };
    }
});
/* DEV-END */

const bugsnag = (Vue.prototype.$bugsnag = new Client());
Promise.all([getVersionName(), getBuildNumber()])
    .then(result => {
        console.log('did get Versions', result);
        let fullVersion = result[0];
        if (!/[0-9]+\.[0-9]+\.[0-9]+/.test(fullVersion)) {
            fullVersion += '.0';
        }
        fullVersion += ` (${result[1]})`;
        return bugsnag.init({ apiKey: '8867d5b66eda43f1be76e345a36a72df', codeBundleId: result[1].toFixed(), automaticallyCollectBreadcrumbs: false });
    })
    .then(() => {
        bugsnag.enableConsoleBreadcrumbs();
        bugsnag.handleUncaughtErrors();
        console.log('bugsnag did init');
        // bugsnag.notify(new Error('Test error'));
    })
    .catch(err => {
        console.log('bugsnag  init failed', err);
    });


import { primaryColor } from './variables';
import { install, themer } from 'nativescript-material-core';
if (gVars.isIOS) {
    themer.setPrimaryColor(primaryColor);
}
install();

import ViewsPlugin from './vue.views';
Vue.use(ViewsPlugin);

// importing filters
import FiltersPlugin from './vue.filters';
Vue.use(FiltersPlugin);

import { TNSFontIcon } from 'nativescript-akylas-fonticon';
// TNSFontIcon.debug = true;
TNSFontIcon.paths = {
    mdi: './assets/materialdesignicons.min.css',
    maki: './assets/maki.css'
};
TNSFontIcon.loadCss();

// adding to Vue prototype
import PrototypePlugin from './vue.prototype';
Vue.use(PrototypePlugin);

// Prints Vue logs when --env.production is *NOT* set while building
// Vue.config.silent = !DEV_LOG;
// Vue.config['debug'] = DEV_LOG;
Vue.config.silent = false;
Vue.config['debug'] = false;

Vue.config.errorHandler = (e, vm, info) => {
    throw e;
};

Vue.config.warnHandler = function(msg, vm, trace) {
    cwarn(msg, trace);
};

/* DEV-START */
// const VueDevtools = require('nativescript-vue-devtools');
// Vue.use(VueDevtools, { host: '192.168.1.43' });
/* DEV-END */

import App from '~/components/App';
new Vue({
    render: h => {
        return h('frame', [h(App)]);
    }
}).$start();
