const WebpackTemplate = require('nativescript-akylas-webpack-template');
const { resolve, join } = require('path');
const { readFileSync } = require('fs');
const { BugsnagBuildReporterPlugin, BugsnagSourceMapUploaderPlugin } = require('webpack-bugsnag-plugins');
const webpack = require('webpack');
// returns a new object with the values at each key mapped using mapFn(value)

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
        sourceMap, // --env.sourceMap
        devlog, // --env.loglevel
        adhoc // --env.adhoc
    } = env;
    if (adhoc) {
        env = Object.assign({}, env, {
            production: true,
            sourceMap: true,
            uglify: true
        });
        // env.production = production = true;
        // env.sourceMap = sourceMap = true;
        // env.uglify = uglify = true;
    }
    const BUGSNAG_KEY = '8867d5b66eda43f1be76e345a36a72df';
    const defines = {
        LOG_LEVEL: !!devlog ? '"full"' : '""',
        TEST_LOGS: adhoc || !production,
        'gVars.BUGNSAG': `"${BUGSNAG_KEY}"`
    };
    const keys = require(resolve(__dirname, 'API_KEYS')).keys;
    Object.keys(keys).forEach(s => {
        if (s === 'ios' || s === 'android') {
            if (s === platform) {
                Object.keys(keys[s]).forEach(s2 => {
                    defines[`gVars.${s2}`] = `'${keys[s][s2]}'`;
                });
            }
        } else {
            defines[`gVars.${s}`] = `'${keys[s]}'`;
        }
    });

    console.log('running webpack with env', env, resolve(__dirname, 'node_modules/@mdi/font/fonts/materialdesignicons-webfont.ttf'));
    const config = WebpackTemplate(env, {
        projectRoot: __dirname,
        appComponents: appComponents,
        snapshotPlugin: {
            useLibs: true,
            androidNdkPath: '/Volumes/data/dev/androidNDK/r19c',
            // targetArchs: ['arm', 'arm64', 'ia32']
        },
        alias: {
            'nativescript-vue': 'nativescript-akylas-vue',
            vue: 'nativescript-vue'
        },
        copyPlugin: [
            { from: resolve(__dirname, 'node_modules/@mdi/font/fonts/materialdesignicons-webfont.ttf'), to: 'fonts' },
            { from: resolve(__dirname, 'node_modules/@mdi/font/css/materialdesignicons.min.css'), to: 'assets' }
        ],
        definePlugin: defines
        // terserOptions: {
        // terserOptions: {
        // keep_fnames: false,
        // keep_classnames: false,
        // mangle: { toplevel: true, keep_fnames: false, keep_classnames: false }
        // }
        // }
    });

    // config.module.rules.push({
    //     test: /\.mss$/,
    //     use: './mss-hot-loader'
    // });
    if (!!production) {
        let appVersion;
        let buildNumber;
        if (platform === 'android') {
            appVersion = readFileSync('app/App_Resources/Android/src/main/AndroidManifest.xml', 'utf8').match(/android:versionName="(.*?)"/)[1];
            buildNumber = readFileSync('app/App_Resources/Android/src/main/AndroidManifest.xml', 'utf8').match(/android:versionCode="([0-9]*)"/)[1];
        } else if (platform === 'ios') {
            appVersion = readFileSync('app/App_Resources/iOS/Info.plist', 'utf8').match(/<key>CFBundleShortVersionString<\/key>[\s\n]*<string>(.*?)<\/string>/)[1];
            buildNumber = readFileSync('app/App_Resources/iOS/Info.plist', 'utf8').match(/<key>CFBundleVersion<\/key>[\s\n]*<string>([0-9]*)<\/string>/)[1];
        }
        // if (buildNumber) {
        //     appVersion += ` (${buildNumber})`
        // }
        // if (!/[0-9]+\.[0-9]+\.[0-9]+/.test(appVersion)) {
        //     appVersion += '.0';
        // }
        console.log('appVersion', appVersion, buildNumber);
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
                apiKey: BUGSNAG_KEY,
                appVersion,
                // codeBundleId: buildNumber,
                overwrite: true,
                publicPath: '.'
            })
        );
    }
    
    return config;
};
