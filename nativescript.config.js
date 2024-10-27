const timelineEnabled = !!process.env['NS_TIMELINE'];
const sentryEnabled = !!process.env['NS_SENTRY'];
const loggingEnabled = sentryEnabled || !!process.env['NS_LOGGING'];
const playstoreBuild = !!process.env['PLAY_STORE_BUILD'];
const appId = process.env['APP_ID'] || 'akylas.alpi.maps';
module.exports = {
    ignoredNativeDependencies: ['@nativescript/detox'].concat(sentryEnabled ? [] : ['@nativescript-community/sentry']).concat(playstoreBuild ? ['alpimaps-non-playstore'] : []),
    id: appId,
    appResourcesPath: process.env['APP_RESOURCES'] || 'App_Resources',
    buildPath: process.env['APP_BUILD_PATH'] || 'platforms',
    webpackPackageName: '@akylas/nativescript-webpack',
    webpackConfigPath: 'app.webpack.config.js',
    appPath: 'app',
    forceLog: loggingEnabled,
    profiling: timelineEnabled ? 'timeline' : undefined,
    i18n: {
        defaultLanguage: 'en'
    },
    ios: {
        runtimePackageName: '@akylas/nativescript-ios-runtime'
    },
    android: {
        runtimePackageName: '@akylas/nativescript-android-runtime',
        gradleVersion: '8.10.2',
        markingMode: 'none',
        codeCache: true,
        enableMultithreadedJavascript: false,
        handleTimeZoneChanges: true,
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
