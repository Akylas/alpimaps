const webpackConfig = require('./webpack.config.js');
const webpack = require('webpack');
const { readFileSync, readdirSync } = require('fs');
const { dirname, join, relative, resolve } = require('path');
const nsWebpack = require('@nativescript/webpack');
const CopyPlugin = require('copy-webpack-plugin');
const ForkTsCheckerWebpackPlugin = require('fork-ts-checker-webpack-plugin');
const SentryCliPlugin = require('@sentry/webpack-plugin');
const TerserPlugin = require('terser-webpack-plugin');
const IgnoreNotFoundExportPlugin = require('./IgnoreNotFoundExportPlugin');
const SpeedMeasurePlugin = require('speed-measure-webpack-plugin');
const Fontmin = require('@akylas/fontmin');
const esbuild = require('esbuild');
const { ESBuildMinifyPlugin } = require('esbuild-loader');

function fixedFromCharCode(codePt) {
    if (codePt > 0xffff) {
        codePt -= 0x10000;
        return String.fromCharCode(0xd800 + (codePt >> 10), 0xdc00 + (codePt & 0x3ff));
    } else {
        return String.fromCharCode(codePt);
    }
}
module.exports = (env, params = {}) => {
    Object.keys(env).forEach((k) => {
        if (env[k] === 'false' || env[k] === '0') {
            env[k] = false;
        } else if (env[k] === 'true' || env[k] === '1') {
            env[k] = true;
        }
    });
    if (env.adhoc) {
        env = Object.assign(
            {},
            {
                production: true,
                sentry: false,
                uploadSentry: false,
                apiKeys: true,
                sourceMap: false,
                uglify: true
            },
            env
        );
    }
    const nconfig = require('./nativescript.config.playstore');
    const {
        appPath = nconfig.appPath,
        appResourcesPath = nconfig.appResourcesPath,
        hmr, // --env.hmr
        production, // --env.production
        sourceMap, // --env.sourceMap
        hiddenSourceMap, // --env.hiddenSourceMap
        inlineSourceMap, // --env.inlineSourceMap
        sentry, // --env.sentry
        uploadSentry,
        verbose, // --env.verbose
        uglify, // --env.uglify
        noconsole, // --env.noconsole
        cartoLicense = false, // --env.cartoLicense
        devlog, // --env.devlog
        fork = true, // --env.fakeall
        apiKeys = true,
        adhoc // --env.adhoc
    } = env;
    env.appPath = appPath;
    env.appResourcesPath = appResourcesPath;
    env.appComponents = env.appComponents || [];
    env.appComponents.push('~/services/android/BgService', '~/services/android/BgServiceBinder');
    const config = webpackConfig(env, params);
    const mode = production ? 'production' : 'development';
    const platform = env && ((env.android && 'android') || (env.ios && 'ios'));
    const projectRoot = params.projectRoot || __dirname;
    const dist = nsWebpack.Utils.platform.getDistPath();
    const appResourcesFullPath = resolve(projectRoot, appResourcesPath);
    config.externals.push('~/licenses.json');
    config.externals.push(function ({ context, request }, cb) {
        if (/i18n$/i.test(context)) {
            return cb(null, './i18n/' + request);
        }
        cb();
    });
    config.externals.push('fs', 'path', 'child_process', 'asciify-image', 'util', 'module');

    // config.stats = {
    //     modulesSpace:Infinity,
    //     optimizationBailout: true

    // }

    // safe as long as we dont use calc in css
    // config.externals.push('reduce-css-calc');
    config.externals.push('~/osm_icons.json');
    config.externals.push(function ({ context, request }, cb) {
        if (/i18n$/i.test(context)) {
            return cb(null, './i18n/' + request);
        }
        cb();
    });
    // console.log('config.externals', config.externals);

    const coreModulesPackageName = fork ? '@akylas/nativescript' : '@nativescript/core';
    config.resolve.modules = [resolve(__dirname, `node_modules/${coreModulesPackageName}`), resolve(__dirname, 'node_modules'), `node_modules/${coreModulesPackageName}`, 'node_modules'];
    Object.assign(config.resolve.alias, {
        '@nativescript/core': `${coreModulesPackageName}`,
        'svelte-native': '@akylas/svelte-native',
        'tns-core-modules': `${coreModulesPackageName}`,
        'get-pixels/node-pixels': '~/helpers/get-pixels',
        '~/get-pixels/node-pixels': '~/helpers/get-pixels',
        './get-pixels/node-pixels': '~/helpers/get-pixels',
        'app/tns_modules/get-pixels/node-pixels': '~/helpers/get-pixels',
        'mjolnir.js': '~/deckgl/EventManager',
        './controller': '~/deckgl/Controller'
    });

    const package = require('./package.json');
    const nsconfig = require('./nativescript.config.playstore.js');
    const isIOS = platform === 'ios';
    const isAndroid = platform === 'android';
    const APP_STORE_ID = process.env.IOS_APP_ID;
    const CUSTOM_URL_SCHEME = 'alpimaps';
    const locales = readdirSync(join(projectRoot, appPath, 'i18n'))
        .filter((s) => s.endsWith('.json'))
        .map((s) => s.replace('.json', ''));
    const defines = {
        PRODUCTION: !!production,
        process: 'global.process',
        // window: 'undefined',
        'global.TNS_WEBPACK': 'true',
        'gVars.platform': `"${platform}"`,
        __UI_USE_EXTERNAL_RENDERER__: true,
        __UI_USE_XML_PARSER__: false,
        'global.__AUTO_REGISTER_UI_MODULES__': false,
        'global.isIOS': isIOS,
        'global.isAndroid': isAndroid,
        'gVars.internalApp': false,
        __CARTO_PACKAGESERVICE__: cartoLicense,
        TNS_ENV: JSON.stringify(mode),
        SUPPORTED_LOCALES: JSON.stringify(locales),
        'gVars.sentry': !!sentry,
        NO_CONSOLE: noconsole,
        SENTRY_DSN: `"${process.env.SENTRY_DSN}"`,
        SENTRY_PREFIX: `"${!!sentry ? process.env.SENTRY_PREFIX : ''}"`,
        GIT_URL: `"${package.repository}"`,
        SUPPORT_URL: `"${package.bugs.url}"`,
        CUSTOM_URL_SCHEME: `"${CUSTOM_URL_SCHEME}"`,
        STORE_LINK: `"${isAndroid ? `https://play.google.com/store/apps/details?id=${nsconfig.id}` : `https://itunes.apple.com/app/id${APP_STORE_ID}`}"`,
        STORE_REVIEW_LINK: `"${
            isIOS
                ? ` itms-apps://itunes.apple.com/WebObjects/MZStore.woa/wa/viewContentsUserReviews?id=${APP_STORE_ID}&onlyLatestVersion=true&pageNumber=0&sortOrdering=1&type=Purple+Software`
                : `market://details?id=${nsconfig.id}`
        }"`,
        DEV_LOG: !!devlog,
        TEST_LOGS: !!adhoc || !production
    };
    const keys = require(resolve(__dirname, 'API_KEYS')).keys;
    Object.keys(keys).forEach((s) => {
        if (s === 'ios' || s === 'android') {
            if (s === platform) {
                Object.keys(keys[s]).forEach((s2) => {
                    defines[`gVars.${s2}`] = apiKeys ? `'${keys[s][s2]}'` : 'undefined';
                });
            }
        } else {
            defines[`gVars.${s}`] = apiKeys ? `'${keys[s]}'` : 'undefined';
        }
    });

    const symbolsParser = require('scss-symbols-parser');
    const mdiSymbols = symbolsParser.parseSymbols(readFileSync(resolve(projectRoot, 'node_modules/@mdi/font/scss/_variables.scss')).toString());
    const mdiIcons = JSON.parse(`{${mdiSymbols.variables[mdiSymbols.variables.length - 1].value.replace(/" (F|0)(.*?)([,\n]|$)/g, '": "$1$2"$3')}}`);
    const appSymbols = symbolsParser.parseSymbols(readFileSync(resolve(projectRoot, 'css/variables.scss')).toString());
    const appIcons = {};
    appSymbols.variables
        .filter((v) => v.name.startsWith('$icon-'))
        .forEach((v) => {
            appIcons[v.name.replace('$icon-', '')] = String.fromCharCode(parseInt(v.value.slice(2), 16));
        });

    const scssPrepend = `$alpimaps-fontFamily: alpimaps;
    $mdi-fontFamily: ${platform === 'android' ? 'materialdesignicons-webfont' : 'Material Design Icons'};
    `;
    const scssLoaderRuleIndex = config.module.rules.findIndex((r) => r.test && r.test.toString().indexOf('scss') !== -1);
    config.module.rules.splice(
        scssLoaderRuleIndex,
        1,
        {
            test: /app\.scss$/,
            use: [
                { loader: 'apply-css-loader' },
                {
                    loader: 'css2json-loader',
                    options: { useForImports: true }
                },
                {
                    loader: 'postcss-loader',
                    options: {
                        postcssOptions: {
                            plugins: [
                                [
                                    'cssnano',
                                    {
                                        preset: 'advanced'
                                    }
                                ],
                                ['postcss-combine-duplicated-selectors', { removeDuplicatedProperties: true }]
                            ]
                        }
                    }
                },
                {
                    loader: 'sass-loader',
                    options: {
                        sourceMap: false,
                        additionalData: scssPrepend
                    }
                }
            ]
        },
        {
            test: /\.module\.scss$/,
            use: [
                { loader: 'css-loader', options: { url: false } },
                {
                    loader: 'sass-loader',
                    options: {
                        sourceMap: false,
                        additionalData: scssPrepend
                    }
                }
            ]
        }
    );

    const usedMDIICons = [];
    config.module.rules.push({
        // rules to replace mdi icons and not use nativescript-font-icon
        test: /\.svelte$/,
        exclude: /node_modules/,
        use: [
            {
                loader: 'string-replace-loader',
                options: {
                    search: 'mdi-([a-z0-9-_]+)',
                    replace: (match, p1, offset, str) => {
                        if (mdiIcons[p1]) {
                            const unicodeHex = mdiIcons[p1];
                            const numericValue = parseInt(unicodeHex, 16);
                            const character = fixedFromCharCode(numericValue);
                            usedMDIICons.push(numericValue);
                            return character;
                        }
                        return match;
                    },
                    flags: 'g'
                }
            },
            {
                loader: 'string-replace-loader',
                options: {
                    search: 'alpimaps-([a-z0-9-_]+)',
                    replace: (match, p1, offset, str) => {
                        if (appIcons[p1]) {
                            return appIcons[p1];
                        }
                        return match;
                    },
                    flags: 'g'
                }
            }
            // {
            //     loader: 'string-replace-loader',
            //     options: {
            //         search: 'osm-([a-zA-Z0-9-_]+)',
            //         replace: (match, p1, offset) => {
            //             if (osmIcons[p1]) {
            //                 return String.fromCharCode(parseInt(osmIcons[p1], 16));
            //             }
            //             return match;
            //         },
            //         flags: 'g'
            //     }
            // }
        ]
    });
    if (!!production) {
        config.module.rules.push({
            // rules to replace mdi icons and not use nativescript-font-icon
            test: /\.(js)$/,
            use: [
                {
                    loader: 'string-replace-loader',
                    options: {
                        search: '__decorate\\(\\[((.|\n)*?)profile,((.|\n)*?)\\],.*?,.*?,.*?\\);?',
                        replace: (match, p1, offset, string) => '',
                        flags: 'g'
                    }
                }
            ]
        });
        // rules to clean up all Trace in production
        // we must run it for all files even node_modules
        config.module.rules.push({
            test: /\.(ts|js)$/,
            use: [
                {
                    loader: 'string-replace-loader',
                    options: {
                        search: 'if\\s*\\(\\s*Trace.isEnabled\\(\\)\\s*\\)',
                        replace: 'if (false)',
                        flags: 'g'
                    }
                }
            ]
        });
    }
    // we remove default rules
    config.plugins = config.plugins.filter((p) => ['CopyPlugin', 'ForkTsCheckerWebpackPlugin'].indexOf(p.constructor.name) === -1);
    // console.log(config.plugins.map((s) => s.constructor.name));

    // console.log('plugins after clean', config.plugins);
    // we add our rules
    const globOptions = { dot: false, ignore: [`**/${relative(appPath, appResourcesFullPath)}/**`] };

    const context = nsWebpack.Utils.platform.getEntryDirPath();
    const copyPatterns = [
        { context, from: 'fonts/!(ios|android)/**/*', to: 'fonts/[name][ext]', noErrorOnMissing: true, globOptions },
        { context, from: 'fonts/*', to: 'fonts/[name][ext]', noErrorOnMissing: true, globOptions },
        { context, from: `fonts/${platform}/**/*`, to: 'fonts/[name][ext]', noErrorOnMissing: true, globOptions },
        { context, from: '**/*.jpg', noErrorOnMissing: true, globOptions },
        { context, from: '**/*.png', noErrorOnMissing: true, globOptions },
        { context, from: 'assets/**/*', noErrorOnMissing: true, globOptions },
        { context, from: 'i18n/**/*', globOptions },
        {
            from: 'node_modules/@mdi/font/fonts/materialdesignicons-webfont.ttf',
            to: 'fonts',
            globOptions,
            transform: {
                transformer(content, path) {
                    return new Promise((resolve, reject) => {
                        new Fontmin()
                            .src(content)
                            .use(Fontmin.glyph({ subset: usedMDIICons }))
                            .run(function (err, files) {
                                if (err) {
                                    reject(err);
                                } else {
                                    resolve(files[0].contents);
                                }
                            });
                    });
                }
            }
        },
        {
            from: 'css/osm.scss',
            to: 'osm_icons.json',
            transform: (manifestBuffer, path) => {
                const osmSymbols = symbolsParser.parseSymbols(manifestBuffer.toString());
                // console.log('osmSymbols', osmSymbols);
                const osmIcons = osmSymbols.variables.reduce(function (acc, value) {
                    if (value.name.startsWith('$osm-')) {
                        acc[value.name.slice(5)] = String.fromCharCode(parseInt(value.value.slice(2, -1), 16));
                    }
                    return acc;
                }, {});
                // console.log('osmIcons', osmIcons);
                return Buffer.from(JSON.stringify(osmIcons));
            },
            globOptions
        }
    ];
    // if (devlog) {
    //     copyPatterns.push({ context: 'dev_assets', from: '**/*', to: 'assets', globOptions });
    // }
    config.plugins.unshift(new CopyPlugin({ patterns: copyPatterns }));

    config.plugins.unshift(
        new webpack.ProvidePlugin({
            svN: '~/svelteNamespace'
        })
    );

    config.plugins.unshift(
        new webpack.ProvidePlugin({
            setTimeout: [require.resolve(coreModulesPackageName + '/timer/index.' + platform), 'setTimeout'],
            clearTimeout: [require.resolve(coreModulesPackageName + '/timer/index.' + platform), 'clearTimeout'],
            setInterval: [require.resolve(coreModulesPackageName + '/timer/index.' + platform), 'setInterval'],
            clearInterval: [require.resolve(coreModulesPackageName + '/timer/index.' + platform), 'clearInterval'],
            FormData: [require.resolve(coreModulesPackageName + '/polyfills/formdata'), 'FormData'],
            requestAnimationFrame: [require.resolve(coreModulesPackageName + '/animation-frame'), 'requestAnimationFrame'],
            cancelAnimationFrame: [require.resolve(coreModulesPackageName + '/animation-frame'), 'cancelAnimationFrame']
        })
    );

    config.plugins.push(new IgnoreNotFoundExportPlugin());
    config.plugins.push(new SpeedMeasurePlugin());

    // save as long as we dont use calc in css
    config.plugins.push(new webpack.IgnorePlugin({ resourceRegExp: /reduce-css-calc$/ }));
    config.plugins.push(new webpack.IgnorePlugin({ resourceRegExp: /punnycode$/ }));
    config.plugins.push(new webpack.IgnorePlugin({ resourceRegExp: /^url$/ }));
    // config.plugins.push(new webpack.IgnorePlugin({ resourceRegExp: /polymer-expressions$/ }));

    Object.assign(config.plugins.find((p) => p.constructor.name === 'DefinePlugin').definitions, defines);

    config.plugins.push(new webpack.ContextReplacementPlugin(/dayjs[\/\\]locale$/, new RegExp(`(${locales.join('|')})$`)));
    // if (fork && nsconfig.cssParser !== 'css-tree') {
    //     config.plugins.push(new webpack.IgnorePlugin({ resourceRegExp: /css-tree$/ }));
    // }
    config.devtool = inlineSourceMap ? 'inline-cheap-source-map' : false;
    if (!inlineSourceMap && (hiddenSourceMap || sourceMap)) {
        if (!!sentry && !!uploadSentry) {
            config.plugins.push(
                new webpack.SourceMapDevToolPlugin({
                    append: `\n//# sourceMappingURL=${process.env.SENTRY_PREFIX}[name].js.map`,
                    filename: join(process.env.SOURCEMAP_REL_DIR, '[name].js.map')
                })
            );
            let appVersion;
            let buildNumber;
            if (platform === 'android') {
                appVersion = readFileSync('app/App_Resources/Android/app.gradle', 'utf8').match(/versionName "((?:[0-9]+\.?)+)"/)[1];
                buildNumber = readFileSync('app/App_Resources/Android/app.gradle', 'utf8').match(/versionCode ([0-9]+)/)[1];
            } else if (platform === 'ios') {
                appVersion = readFileSync('app/App_Resources/iOS/Info.plist', 'utf8').match(/<key>CFBundleShortVersionString<\/key>[\s\n]*<string>(.*?)<\/string>/)[1];
                buildNumber = readFileSync('app/App_Resources/iOS/Info.plist', 'utf8').match(/<key>CFBundleVersion<\/key>[\s\n]*<string>([0-9]*)<\/string>/)[1];
            }
            config.plugins.push(
                new SentryCliPlugin({
                    release: appVersion,
                    urlPrefix: 'app:///',
                    rewrite: true,
                    release: `${nconfig.id}@${appVersion}+${buildNumber}`,
                    dist: `${buildNumber}.${platform}`,
                    ignoreFile: '.sentrycliignore',
                    setCommits: {
                        auto: true,
                        ignoreMissing: true,
                        ignoreEmpty: true
                    },
                    include: [join(dist, process.env.SOURCEMAP_REL_DIR)]
                })
            );
        } else {
            config.plugins.push(
                new webpack.SourceMapDevToolPlugin({
                    filename: '[name].js.map'
                })
            );
        }
    }
    if (!!production) {
        // config.plugins.push(new ForkTsCheckerWebpackPlugin());
    }

    config.externalsPresets = { node: false };
    config.resolve.fallback = config.resolve.fallback || {};
    config.resolve.fallback.timers = require.resolve('timers/');
    config.resolve.fallback.stream = require.resolve('stream/');
    config.optimization.splitChunks.cacheGroups.defaultVendor.test = /[\\/](node_modules|nativescript-carto|NativeScript[\\/]dist[\\/]packages[\\/]core)[\\/]/;
    // config.optimization.usedExports = true;
    config.optimization.minimize = uglify !== undefined ? !!uglify : production;
    const isAnySourceMapEnabled = !!sourceMap || !!hiddenSourceMap || !!inlineSourceMap;
    config.optimization.minimizer = [
        new TerserPlugin({
            parallel: true,
            // cache: true,
            // sourceMap: isAnySourceMapEnabled,
            terserOptions: {
                ecma: 2017,
                module: true,
                // toplevel: true,
                output: {
                    comments: false,
                    semicolons: !isAnySourceMapEnabled
                },
                // mangle:true,
                // mangle: {
                //     // toplevel: false,
                //     properties: {
                //         regex: /^(?!(com|org|akylas|android|androidx)\.)/mg
                //     },
                // },
                compress: {
                    // The Android SBG has problems parsing the output
                    // when these options are enabled
                    collapse_vars: platform !== 'android',
                    sequences: platform !== 'android',
                    passes: 5,
                    drop_console: production
                },
                keep_classnames: false,
                keep_fnames: false
            }
        })
    ];
    const configs = [config];
    // if (!!production) {
    configs.unshift({
        entry: resolve(__dirname, 'geo-three/webapp/app.ts'),
        devtool: false,
        target: 'web',
        mode: production ? 'production' : 'development',
        optimization: {
            usedExports: true,
            // minimize: true,
            minimizer: [
                new ESBuildMinifyPlugin({
                    target: 'es2017', // Syntax to compile to (see options below for possible values)
                    implementation: esbuild
                })
            ]
        },
        resolve: {
            exportsFields: [],
            modules: [resolve(__dirname, 'node_modules'), resolve(__dirname, 'geo-three', 'node_modules')],
            mainFields: ['browser', 'module', 'main'],
            extensions: ['.ts', '.js', '.json'],
            alias: {
                './LocalHeightProvider': resolve(__dirname, 'webapp/LocalHeightProvider'),
                './RasterMapProvider': resolve(__dirname, 'webapp/RasterMapProvider')
            }
        },
        output: {
            pathinfo: false,
            path: resolve(__dirname, 'app/assets'),
            // libraryTarget: 'commonjs',
            library: {
                name: 'webapp',
                type: 'global'
            },
            filename: 'webapp.js'
            // globalObject: 'global'
        },
        module: {
            rules: [
                {
                    test: /\.ts$/,
                    loader: 'ts-loader',
                    options: {
                        transpileOnly: true,
                        allowTsInNodeModules: true,
                        configFile: resolve(__dirname, 'tsconfig.web.json'),
                        compilerOptions: {
                            sourceMap: false,
                            declaration: false
                        }
                    }
                },
                {
                    test: /\.js$/,
                    loader: 'esbuild-loader',
                    options: {
                        target: 'es2015',
                        implementation: esbuild
                        // sourceMaps: false,
                        // plugins: ['@babel/plugin-transform-runtime'],
                        // presets: [
                        //     [
                        //         '@babel/env',
                        //         {
                        //             modules: false,
                        //             targets: {
                        //                 chrome: '70'
                        //             }
                        //         }
                        //     ]
                        // ]
                    }
                }
            ]
        }
    });
    // }
    return configs;
};
