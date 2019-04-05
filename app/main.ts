const oldLog = console.log;
import Vue from 'nativescript-vue';
console.log = oldLog;

import * as application from 'tns-core-modules/application';
import * as firebase from 'nativescript-plugin-firebase';
import * as trace from 'tns-core-modules/trace';
import { cerror, clog, cwarn, DEV_LOG } from '~/utils/logging';

// override to get all logs
console.log = clog;
console.error = cerror;
console.warn = cwarn;

function sendCrashLog(err) {
    if (!DEV_LOG) {
        firebase.crashlytics.sendCrashLog(err);
    }
}

firebase
    .init()
    .then(() => {
        console.log('firebase did init');
        // if (!DEV_LOG) {
        application.on(application.uncaughtErrorEvent, args => {
            if (application.android) {
                // For Android applications, args.android is an NativeScriptError.
                cerror(' *** NativeScriptError *** : ' + args.android);
                cerror(' *** StackTrace *** : ' + args.android.stackTrace);
                cerror(' *** nativeException *** : ' + args.android.nativeException);
                sendCrashLog(args.android.nativeException);
                // throw args.android;
            } else if (application.ios) {
                // For iOS applications, args.ios is NativeScriptError.
                cerror(' *** NativeScriptError  *** : ' + args.ios);
                sendCrashLog(args.ios);
                // throw args.ios;
            }
        });

        const errorHandler: trace.ErrorHandler = {
            handlerError(err) {
                cerror(err);
                // if (!DEV_LOG) {
                sendCrashLog(err);
                // }
                // throw err;
                // (development 2)
                // trace.write(err, "unhandlede-error", type.error);
                // (production)
                // reportToAnalytics(err)
            }
        };
        trace.setErrorHandler(errorHandler);
        // }
    })
    .catch(error => clog(`firebase.init error: ${error}`));

// import './app.scss';

const test = require('./app.scss');
console.log(test);
import { isIOS } from 'tns-core-modules/platform';

import { primaryColor } from './variables';
import { install, themer } from 'nativescript-material-core';
if (isIOS) {
    themer.setPrimaryColor(primaryColor);
}
install();

import ViewsPlugin from './vue.views';
Vue.use(ViewsPlugin);

// importing filters
import FiltersPlugin from './vue.filters';
Vue.use(FiltersPlugin);

import { TNSFontIcon } from 'nativescript-fonticon';
TNSFontIcon.paths = {
    mdi: './assets/materialdesignicons.min.css'
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
