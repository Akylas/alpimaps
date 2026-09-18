const timelineEnabled = !!process.env['NS_TIMELINE'];
const sentryEnabled = !!process.env['NS_SENTRY'];
const loggingEnabled = sentryEnabled || !!process.env['NS_LOGGING'];
const playstoreBuild = !!process.env['PLAY_STORE_BUILD'];
const appId = process.env['APP_ID'] || 'akylas.alpi.maps';
module.exports = {
    ignoredNativeDependencies: ['@nativescript/detox']
        .concat(sentryEnabled ? [] : ['@nativescript-community/sentry'])
        .concat(playstoreBuild ? ['alpimaps-non-playstore'] : ['@akylas/nativescript-inapp-purchase']),
    id: appId,
    appResourcesPath: process.env['APP_RESOURCES'] || 'App_Resources',
    buildPath: process.env['APP_BUILD_PATH'] || 'platforms',
    corePackageName: '@akylas/nativescript',
    webpackPackageName: '@akylas/nativescript-webpack',
    webpackConfigPath: 'app.webpack.config.js',
    appPath: 'app',
    forceLog: loggingEnabled,
    profiling: timelineEnabled ? 'timeline' : undefined,
    i18n: {
        defaultLanguage: 'en'
    },
    ios: {
        // runtimePackageName: '@akylas/nativescript-ios-runtime',
    },
    android: {
        // runtimePackageName: '@nativescript/android-quickjs-ng',
        gradleVersion: '8.14.3',
        markingMode: 'none',
        codeCache: true,
        enableMultithreadedJavascript: false,
        handleTimeZoneChanges: true,
        ignoredNativeDependencies: ['@akylas/nativescript-inapp-purchase'],
        ...(loggingEnabled
            ? {
                  forceLog: true,
                  maxLogcatObjectSize: 40096
              }
            : {})
    },
    cssParser: 'rework',
    hooks: [
        {
            type: 'after-prepareNativeApp',
            script: 'tools/scripts/after-prepareNativeApp.js'
        }
    ]
};
