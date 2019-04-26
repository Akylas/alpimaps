const WebpackTemplate = require('nativescript-akylas-webpack-template');
const { resolve } = require('path');
const { readFileSync } = require('fs');
const { BugsnagBuildReporterPlugin, BugsnagSourceMapUploaderPlugin } = require('webpack-bugsnag-plugins');
const webpack = require('webpack');
// returns a new object with the values at each key mapped using mapFn(value)

const defines = {};
const keys = require(resolve(__dirname, 'API_KEYS')).keys
Object.keys(keys).forEach(s=>{
    defines[`gVars.${s}`] = `'${keys[s]}'`
})

module.exports = env => {
    const platform = env && ((env.android && 'android') || (env.ios && 'ios'));
    let appComponents = [];
    if (platform === 'android') {
        appComponents = [resolve(__dirname, 'app/services/android/BgService.ts'), resolve(__dirname, 'app/services/android/BgServiceBinder.ts')];
    }
    const {
        development = false,
        uglify,
        production, // --env.production
        sourceMap // --env.sourceMap
    } = env;
    console.log('running webpack with env', development, uglify, production, sourceMap, typeof sourceMap);
    const config = WebpackTemplate(env, {
        projectRoot: __dirname,
        appComponents: appComponents,
        alias: {
            'nativescript-vue': 'akylas-nativescript-vue',
            vue: 'nativescript-vue'
        },
        copyPlugin: [{ from: '../node_modules/@mdi/font/fonts/materialdesignicons-webfont.ttf', to: 'fonts' }, { from: '../node_modules/@mdi/font/css/materialdesignicons.min.css', to: 'assets' }],
        definePlugin: defines
    });
    if (!!production) {
        let appVersion = require(resolve(__dirname, 'app', 'package.json')).version;
        let buildNumber;
        if (platform === 'android') {
            buildNumber = readFileSync('app/App_Resources/Android/src/main/AndroidManifest.xml', 'utf8').match(/android:versionCode="([0-9]*)"/)[1];
        } else if (platform === 'ios') {
            buildNumber = readFileSync('app/App_Resources/iOS/Info.plist', 'utf8').match(/<key>CFBundleVersion<\/key>[\s\n]*<string>([0-9]*)<\/string>/)[1];
        }
        // if (buildNumber) {
        //     appVersion += ` (${buildNumber})`
        // }
        console.log('appVersion', appVersion);
        // config.plugins.push(
        //     new BugsnagBuildReporterPlugin(
        //         {
        //             apiKey: '767d861562cf9edbb3a9cb1a54d23fb8',
        //             appVersion: appVersion
        //         },
        //         {
        //             /* opts */
        //         }
        //     )
        // );
        config.plugins.push(
            new BugsnagSourceMapUploaderPlugin({
                apiKey: '8867d5b66eda43f1be76e345a36a72df',
                appVersion: parseInt(buildNumber),
                codeBundleId: buildNumber,
                overwrite: true,
                publicPath: '.'
            })
        );
    }
    return config;
};
