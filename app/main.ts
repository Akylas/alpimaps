import Vue from 'nativescript-vue';
import { knownFolders } from 'tns-core-modules/file-system';

import { getBuildNumber, getVersionName } from 'nativescript-extendedinfo';
import { cerror, clog, cwarn, DEV_LOG } from '~/utils/logging';
import { Client as BugsnagClient } from 'nativescript-bugsnag';
import { setMapPosKeys } from 'nativescript-carto/core/core';
import * as application from 'tns-core-modules/application';

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

// import { Client as FlipperClient } from 'nativescript-flipper';
/* DEV-START */
// const currentApp = knownFolders.currentApp();
// process.cwd = function() {
//     return '';
// }
// require('source-map-support').install({
//     environment: 'node',
//     handleUncaughtExceptions: false,
//     retrieveSourceMap(source) {
//         const sourceMapPath = source + '.map';
//         const appPath = currentApp.path;
//         let sourceMapRelativePath = sourceMapPath
//             // .replace('file:///', '')
//             .replace('file://', '')
//             .replace(appPath + '/', '')
//             .replace(appPath + '/', '');
//         if (sourceMapRelativePath.startsWith('app/')) {
//             sourceMapRelativePath = sourceMapRelativePath.slice(4);
//         }
//         // console.log('retrieveSourceMap', source, appPath, sourceMapRelativePath, currentApp.getFile(sourceMapRelativePath).readTextSync());
//         return {
//             url: sourceMapRelativePath,
//             map: currentApp.getFile(sourceMapRelativePath).readTextSync()
//         };
//     }
// });
/* DEV-END */

// Error.prepareStackTrace = function() {
//     console.log('test', 'prepareStackTrace', new Error().stack);
// };
// const flipper = new FlipperClient();
// flipper.start({
//     plugins: ['network', 'inspector', 'database', 'prefs', 'crash']
// });

if (TNS_ENV === 'production' || TEST_LOGS) {
    const bugsnag = (Vue.prototype.$bugsnag = new BugsnagClient());
    Promise.all([getVersionName(), getBuildNumber()])
        .then(result => {
            // console.log('did get Versions', result);
            let fullVersion = result[0];
            if (!/[0-9]+\.[0-9]+\.[0-9]+/.test(fullVersion)) {
                fullVersion += '.0';
            }
            fullVersion += ` (${result[1]})`;
            return bugsnag.init({ appVersion: result[0], apiKey: gVars.BUGNSAG, automaticallyCollectBreadcrumbs: false, detectAnrs: false });
        })
        .then(() => {
            bugsnag.enableConsoleBreadcrumbs();
            bugsnag.handleUncaughtErrors();
            // console.log('bugsnag did init');
        })
        .catch(err => {
            console.log('bugsnag  init failed', err);
        });
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
    mdi: './assets/materialdesignicons.min.css',
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
    console.log('[Vue]', `[${info}]`, e);
    setTimeout(() => throwVueError(e), 0);
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
