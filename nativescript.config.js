module.exports = {
    id: 'akylas.alpi.maps',
    ignoredNativeDependencies: ['@nativescript-community/sentry'],
    appResourcesPath: 'App_Resources',
    webpackConfigPath: 'app.webpack.config.js',
    appPath: 'app',
    android: {
        markingMode: 'none',
        codeCache: true,
        enableMultithreadedJavascript: false
    },
    cssParser: 'rework'
};
