const webpackConfig = require('./webpack.config.js');
const webpack = require('webpack');
const { readFileSync, readdirSync, existsSync, mkdirSync } = require('fs');
const { BundleAnalyzerPlugin } = require('webpack-bundle-analyzer');
const { basename, dirname, join, relative, resolve, isAbsolute } = require('path');
const nsWebpack = require('@akylas/nativescript-webpack');
const CopyPlugin = require('copy-webpack-plugin');
const ForkTsCheckerWebpackPlugin = require('fork-ts-checker-webpack-plugin');
const { sentryWebpackPlugin } = require('@sentry/webpack-plugin');
const TerserPlugin = require('terser-webpack-plugin');
const IgnoreNotFoundExportPlugin = require('./tools/scripts/IgnoreNotFoundExportPlugin');
const WaitPlugin = require('./tools/scripts/WaitPlugin');
const Fontmin = require('@nativescript-community/fontmin');
const SpeedMeasurePlugin = require('speed-measure-webpack-plugin');
const WebpackShellPluginNext = require('webpack-shell-plugin-next');

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
    if (env.adhoc_sentry) {
        env = Object.assign(
            {},
            {
                build3dmap: true,
                buildpeakfinder: true,
                production: env.production !== false,
                buildstyle: true,
                sentry: true,
                uploadSentry: true,
                testlog: true,
                devlog: true,
                noconsole: false,
                sourceMap: true,
                uglify: env.production !== false
            },
            env
        );
    } else if (env.adhoc) {
        env = Object.assign(
            {},
            {
                build3dmap: true,
                buildpeakfinder: true,
                buildstyle: true,
                production: true,
                noconsole: true,
                sentry: false,
                uploadSentry: false,
                apiKeys: true,
                sourceMap: false,
                uglify: true
            },
            env
        );
    } else if (env.adhoc_logging) {
        env = Object.assign(
            {},
            {
                build3dmap: true,
                buildpeakfinder: true,
                buildstyle: true,
                production: true,
                testlog: true,
                devlog: true,
                noconsole: false,
                sentry: false,
                uploadSentry: false,
                apiKeys: true,
                sourceMap: false,
                uglify: true
            },
            env
        );
    } else if (env.timeline) {
        env = Object.assign(
            {},
            {
                build3dmap: true,
                buildpeakfinder: true,
                buildstyle: true,
                production: true,
                sentry: false,
                noconsole: false,
                uploadSentry: false,
                apiKeys: true,
                keep_classnames_functionnames: true,
                sourceMap: false,
                uglify: true
            },
            env
        );
    }
    const {
        appId,
        appPath,
        appResourcesPath,
        production,
        sourceMap,
        hiddenSourceMap,
        inlineSourceMap,
        sentry,
        uploadSentry,
        uglify,
        profile,
        noconsole,
        timeline,
        cartoLicense = false,
        devlog,
        testlog,
        fork = true,
        buildpeakfinder,
        build3dmap,
        buildstyle = false,
        report,
        disableoffline = false,
        busSupport = true,
        apiKeys = true,
        playStoreBuild = !!process.env['PLAY_STORE_BUILD'],
        keep_classnames_functionnames = true,
        testZipStyles = false,
        accessibility = true,
        locale = 'en',
        theme = 'auto',
        adhoc
    } = env;
    // console.log('env', playStoreBuild, env);
    env.appPath = appPath;
    env.appResourcesPath = appResourcesPath;
    env.appComponents = env.appComponents || [];
    env.appComponents.push('~/services/android/BgService', '~/services/android/BgServiceBinder', '~/android/processtextactivity', '~/android/activity.android');

    const ignoredSvelteWarnings = new Set(['a11y-no-onchange', 'a11y-label-has-associated-control', 'illegal-attribute-character']);

    nsWebpack.chainWebpack((config, env) => {
        config.module
            .rule('svelte')
            .use('svelte-loader')
            .tap((options) => {
                options.onwarn = function (warning, onwarn) {
                    return ignoredSvelteWarnings.has(warning.code) || onwarn(warning);
                };
                return options;
            });
        config.when(env.production, (config) => {
            config.module
                .rule('svelte')
                .use('string-replace-loader')
                .loader('string-replace-loader')
                .before('svelte-loader')
                .options({
                    search: 'createElementNS\\("https:\\/\\/svelte.dev\\/docs\\/special-elements#svelte-options"',
                    replace: 'createElementNS(svN',
                    flags: 'gm'
                })
                .end();
        });

        return config;
    });
    const config = webpackConfig(env, params);
    // config.resolve.conditionNames.push('svelte');
    const mode = production ? 'production' : 'development';
    const platform = env && ((env.android && 'android') || (env.ios && 'ios'));
    const projectRoot = params.projectRoot || __dirname;
    const dist = nsWebpack.Utils.platform.getDistPath();
    const appResourcesFullPath = resolve(projectRoot, appResourcesPath);
    const isIOS = platform === 'ios';
    const isAndroid = platform === 'android';

    if (profile) {
        const StatsPlugin = require('stats-webpack-plugin');

        config.plugins.unshift(
            new StatsPlugin(resolve(join(projectRoot, 'webpack.stats.json')), {
                preset: 'minimal',
                chunkModules: true,
                modules: true,
                usedExports: true
            })
        );
        // config.profile = true;
        // config.parallelism = 1;
        // config.stats = { preset: 'minimal', chunkModules: true, modules: true, usedExports: true };
    }

    // nsWebpack.chainWebpack((config, env) => {
    //     config.externals([
    //         '~/licenses.json',
    //         '~/osm_icons.json',
    //         function ({ context, request }, cb) {
    //             if (/i18n$/i.test(context)) {
    //                 return cb(null, './i18n/' + request);
    //             }
    //             cb();
    //         }
    //     ]);
    //     config.resolve.modules.clear().add('node_modules');
    //     config.resolve.alias({
    //         '@nativescript/core': `${coreModulesPackageName}`,
    //         'svelte-native': '@akylas/svelte-native',
    //         'tns-core-modules': `${coreModulesPackageName}`,
    //         '@nativescript/core/accessibility$': '~/acessibilityShim',
    //         '../../../accessibility$': '~/acessibilityShim',
    //         '../../accessibility$': '~/acessibilityShim',
    //         [`${coreModulesPackageName}/accessibility$`]: '~/acessibilityShim'
    //     });
    //     const APP_STORE_ID = process.env.IOS_APP_ID;
    //     const CUSTOM_URL_SCHEME = 'alpimaps';
    //     const locales = readdirSync(join(projectRoot, appPath, 'i18n'))
    //         .filter((s) => s.endsWith('.json'))
    //         .map((s) => s.replace('.json', ''));
    //     config.plugin('DefinePlugin').tap((options) => {
    //         Object.assign(options, {
    //             PRODUCTION: !!production,
    //             'gVars.platform': `"${platform}"`,
    //             __UI_USE_EXTERNAL_RENDERER__: true,
    //             __UI_USE_XML_PARSER__: false,
    //             'global.__AUTO_REGISTER_UI_MODULES__': false,
    //             '__IOS__': isIOS,
    //             '__ANDROID__': isAndroid,
    //             'global.autoLoadPolyfills': false,
    //             'gVars.internalApp': false,
    //             TNS_ENV: JSON.stringify(mode),
    //             SUPPORTED_LOCALES: JSON.stringify(locales),
    //             'SENTRY_ENABLED': !!sentry,
    //             NO_CONSOLE: noconsole,
    //             SENTRY_DSN: `"${process.env.SENTRY_DSN}"`,
    //             SENTRY_PREFIX: `"${!!sentry ? process.env.SENTRY_PREFIX : ''}"`,
    //             GIT_URL: `"${package.repository}"`,
    //             SUPPORT_URL: `"${package.bugs.url}"`,
    //             CUSTOM_URL_SCHEME: `"${CUSTOM_URL_SCHEME}"`,./templates/abbreviations.json
    //                     ? ` itms-apps://itunes.apple.com/WebObjects/MZStore.woa/wa/viewContentsUserReviews?id=${APP_STORE_ID}&onlyLatestVersion=true&pageNumber=0&sortOrdering=1&type=Purple+Software`
    //                     : `market://details?id=${nconfig.id}`
    //             }"`,
    //             DEV_LOG: !!devlog,
    //             TEST_LOG: !!adhoc || !production
    //         });
    //         const keys = require(resolve(__dirname, 'API_KEYS')).keys;
    //         Object.keys(keys).forEach((s) => {
    //             if (s === 'ios' || s === 'android') {
    //                 if (s === platform) {
    //                     Object.keys(keys[s]).forEach((s2) => {
    //                         options[`gVars.${s2}`] = apiKeys ? `'${keys[s][s2]}'` : 'undefined';
    //                     });
    //                 }
    //             } else {
    //                 options[`gVars.${s}`] = apiKeys ? `'${keys[s]}'` : 'undefined';
    //             }
    //         });
    //         return options;
    //     });

    //     const symbolsParser = require('scss-symbols-parser');
    //     const mdiSymbols = symbolsParser.parseSymbols(readFileSync(resolve(projectRoot, 'node_modules/@mdi/font/scss/_variables.scss')).toString());
    //     const mdiIcons = JSON.parse(`{${mdiSymbols.variables[mdiSymbols.variables.length - 1].value.replace(/" (F|0)(.*?)([,\n]|$)/g, '": "$1$2"$3')}}`);
    //     const appSymbols = symbolsParser.parseSymbols(readFileSync(resolve(projectRoot, 'css/variables.scss')).toString());
    //     const appIcons = {};
    //     appSymbols.variables
    //         .filter((v) => v.name.startsWith('$icon-'))
    //         .forEach((v) => {
    //             appIcons[v.name.replace('$icon-', '')] = String.fromCharCode(parseInt(v.value.slice(2), 16));
    //         });

    //     const scssPrepend = `$alpimaps-fontFamily: alpimaps;
    // $mdi-fontFamily: ${platform === 'android' ? 'materialdesignicons-webfont' : 'Material Design Icons'};
    // `;
    //     config.module
    //         .rule('scss')
    //         .exclude('.module.scss$')
    //         .use('css2json-loader')
    //         .tap((options) => Object.assign(options, { useForImports: true }))
    //         .end()
    //         .use('postcss-loader')
    //         .tap((options) =>
    //             Object.assign(options, {
    //                 postcssOptions: {
    //                     plugins: [
    //                         'postcss-import',
    //                         [
    //                             'cssnano',
    //                             {
    //                                 preset: 'advanced'
    //                             }
    //                         ],
    //                         ['postcss-combine-duplicated-selectors', { removeDuplicatedProperties: true }]
    //                     ]
    //                 }
    //             })
    //         )
    //         .end()
    //         .use('sass-loader')
    //         .tap((options) =>
    //             Object.assign(options, {
    //                 sourceMap: false,
    //                 additionalData: scssPrepend
    //             })
    //         );
    //     config.module.rule('module.scss').use('css-loader').loader('css-loader').options({ url: false }).end().use('sass-loader').loader('sass-loader').options({
    //         sourceMap: false,
    //         additionalData: scssPrepend
    //     });

    //     const usedMDIICons = [];
    //     config.module
    //         .rule('font-icons')
    //         .use('mdi-icons')
    //         .loader('string-replace-loader')
    //         .options({
    //             search: 'mdi-([a-z0-9-_]+)',
    //             replace: (match, p1, offset, str) => {
    //                 if (mdiIcons[p1]) {
    //                     const unicodeHex = mdiIcons[p1];
    //                     const numericValue = parseInt(unicodeHex, 16);
    //                     const character = fixedFromCharCode(numericValue);
    //                     usedMDIICons.push(numericValue);
    //                     return character;
    //                 }
    //                 return match;
    //             },
    //             flags: 'g'
    //         })
    //         .end()
    //         .use('app-icons')
    //         .loader('string-replace-loader')
    //         .options({
    //             search: 'alpimaps-([a-z0-9-_]+)',
    //             replace: (match, p1, offset, str) => {
    //                 if (appIcons[p1]) {
    //                     return appIcons[p1];
    //                 }
    //                 return match;
    //             },
    //             flags: 'g'
    //         })
    //         .end();

    //     config.when(env.production, (config) => {
    //         config.module
    //             .rule('clean-profile')
    //             .test([/\.js$/])
    //             .use('string-replace-loader')
    //             .loader('string-replace-loader')
    //             .options({
    //                 search: '__decorate\\(\\[((.|\n)*?)profile,((.|\n)*?)\\],.*?,.*?,.*?\\);?',
    //                 replace: (match, p1, offset, string) => '',
    //                 flags: 'g'
    //             })
    //             .end();
    //         config.module.rule('clean-profile').test([/\.ts$/]).use('string-replace-loader').loader('string-replace-loader').options({
    //             search: 'if\\s*\\(\\s*Trace.isEnabled\\(\\)\\s*\\)',
    //             replace: 'if (false)',
    //             flags: 'g'
    //         });
    //     });
    // });
    const supportedLocales = readdirSync(join(projectRoot, appPath, 'i18n'))
        .filter((s) => s.endsWith('.json'))
        .map((s) => s.replace('.json', ''));

    const supportedValhallaLocales = readdirSync(join(projectRoot, appPath, 'assets', 'valhalla'))
        .filter((s) => s.endsWith('.json'))
        .map((s) => s.replace('.json', ''));
    config.externals.push('~/licenses.json');
    config.externals.push('~/osm_icons.json');
    config.externals.push('~/material_icons.json');
    config.externals.push(function ({ context, request }, cb) {
        if (/address-formatter/i.test(context)) {
            return cb(null, join('~/address-formatter/templates', basename(request)));
        }
        cb();
    });
    config.externals.push(function ({ context, request }, cb) {
        if (/i18n$/i.test(context)) {
            return cb(null, join('~/i18n/', request));
        }
        cb();
    });
    supportedLocales.forEach((l) => {
        config.externals.push(`~/i18n/${l}.json`);
    });
    supportedValhallaLocales.forEach((l) => {
        config.externals.push(`~/assets/valhalla/${l}.json`);
    });

    // disable resolve of symlinks so that stack dont use real path but node_modules ones
    config.resolve.symlinks = false;
    const coreModulesPackageName = fork ? '@akylas/nativescript' : '@nativescript/core';
    if (fork) {
        config.resolve.modules = [resolve(__dirname, `node_modules/${coreModulesPackageName}`), resolve(__dirname, 'node_modules'), `node_modules/${coreModulesPackageName}`, 'node_modules'];
        Object.assign(config.resolve.alias, {
            '@nativescript/core': `${coreModulesPackageName}`,
            'tns-core-modules': `${coreModulesPackageName}`
        });
    }
    Object.assign(config.resolve.alias, {
        '@shared': resolve(__dirname, 'tools/app'),
        'kiss-orm': '@akylas/kiss-orm'
    });
    let appVersion;
    let buildNumber;
    if (platform === 'android') {
        const gradlePath = resolve(projectRoot, appResourcesPath, 'Android/app.gradle');
        const gradleData = readFileSync(gradlePath, 'utf8');
        appVersion = gradleData.match(/versionName "((?:[0-9]+\.?)+(?:-(?:[a-z]|[A-Z])+)?)"/)[1];
        buildNumber = gradleData.match(/versionCode ([0-9]+)/)[1];
    } else if (platform === 'ios') {
        const plistPath = resolve(projectRoot, appResourcesPath, 'iOS/Info.plist');
        const plistData = readFileSync(plistPath, 'utf8');
        appVersion = plistData.match(/<key>CFBundleShortVersionString<\/key>[\s\n]*<string>(.*?)<\/string>/)[1];
        buildNumber = plistData.match(/<key>CFBundleVersion<\/key>[\s\n]*<string>([0-9]*)<\/string>/)[1];
    }

    const package = require('./package.json');
    const CUSTOM_URL_SCHEME = 'alpimaps';
    const APP_STORE_ID = process.env.IOS_APP_ID;
    const defines = {
        PRODUCTION: !!production,
        process: 'global.process',
        'global.TNS_WEBPACK': 'true',
        __UI_LABEL_USE_LIGHT_FORMATTEDSTRING__: true,
        __UI_USE_EXTERNAL_RENDERER__: true,
        __UI_USE_XML_PARSER__: false,
        __CSS_USE_CSS_TOOLS__: false,
        __ACCESSIBILITY_DEFAULT_ENABLED__: false,
        __ONLY_ALLOW_ROOT_VARIABLES__: true,
        __IOS__: isIOS,
        __ANDROID__: isAndroid,
        'global.autoLoadPolyfills': false,
        TNS_ENV: JSON.stringify(mode),
        __APP_ID__: `"${appId}"`,
        __APP_VERSION__: `"${appVersion}"`,
        __APP_BUILD_NUMBER__: `${buildNumber}`,
        __DISABLE_OFFLINE__: disableoffline,
        SUPPORTED_LOCALES: JSON.stringify(supportedLocales),
        SUPPORTED_VALHALLA_LOCALES: JSON.stringify(supportedValhallaLocales),
        __INAPP_PURCHASE_ID_PREFIX__: `""`,
        FALLBACK_LOCALE: `"${locale}"`,
        WITH_BUS_SUPPORT: busSupport,
        WITH_PEAK_FINDER: buildpeakfinder,
        WITH_3D_MAP: build3dmap,
        DEFAULT_THEME: `"${theme}"`,
        SENTRY_ENABLED: !!sentry,
        MATERIAL_MAP_FONT_FAMILY: "'Material Design Icons'",
        TEST_ZIP_STYLES: testZipStyles,
        NO_CONSOLE: noconsole,
        SENTRY_DSN: `"${process.env.SENTRY_DSN}"`,
        SENTRY_PREFIX: `"${!!sentry ? process.env.SENTRY_PREFIX : ''}"`,
        GIT_URL: `"${package.repository}"`,
        SUPPORT_URL: `"${package.bugs.url}"`,
        PLAY_STORE_BUILD: playStoreBuild,
        CUSTOM_URL_SCHEME: `"${CUSTOM_URL_SCHEME}"`,
        STORE_LINK: `"${isAndroid ? `https://play.google.com/store/apps/details?id=${appId}` : `https://itunes.apple.com/app/id${APP_STORE_ID}`}"`,
        STORE_REVIEW_LINK: `"${isIOS ? `https://itunes.apple.com/app/id${APP_STORE_ID}?action=write-review` : `market://details?id=${appId}`}"`,
        SPONSOR_URL: '"https://github.com/sponsors/farfromrefug"',
        DEV_LOG: !!devlog,
        TEST_LOG: !!devlog || !!testlog
    };
    try {
        const keys = process.env.API_KEYS ? JSON.parse(process.env.API_KEYS) : require(resolve(__dirname, 'API_KEYS'));
        console.log('got API_KEYS.json', JSON.stringify(Object.keys(keys)));
        Object.keys(keys).forEach((s) => {
            if (s === 'ios' || s === 'android') {
                if (s === platform) {
                    Object.keys(keys[s]).forEach((s2) => {
                        defines[`${s2}`] = apiKeys ? `'${keys[s][s2]}'` : 'undefined';
                    });
                }
            } else {
                defines[`${s}`] = apiKeys ? `'${keys[s]}'` : 'undefined';
            }
        });
    } catch (error) {
        console.error('could not access API_KEYS.json');
    }
    Object.assign(config.plugins.find((p) => p.constructor.name === 'DefinePlugin').definitions, defines);

    const symbolsParser = require('scss-symbols-parser');
    const mdiSymbols = symbolsParser.parseSymbols(readFileSync(resolve(projectRoot, 'node_modules/@mdi/font/scss/_variables.scss')).toString());
    const mdiIcons = JSON.parse(`{${mdiSymbols.variables[mdiSymbols.variables.length - 1].value.replace(/" (F|0)(.*?)([,\n]|$)/g, '": "$1$2"$3')}}`);
    const appSymbols = symbolsParser.parseSymbols(readFileSync(resolve(projectRoot, 'css/variables.scss')).toString());
    const appIcons = {};
    appSymbols.variables
        .filter((v) => v.name.startsWith('$icon-'))
        .forEach((v) => {
            // console.log('test', `'${v.value}'`, `'${v.value.slice(2)}'`)
            appIcons[v.name.replace('$icon-', '')] = String.fromCharCode(parseInt(v.value.slice(2, -1), 16));
        });

    const scssPrepend = `$appFontFamily: alpimaps;
    $mdiFontFamily: ${platform === 'android' ? 'materialdesignicons-webfont' : 'Material Design Icons'};
    `;
    const scssLoaderRuleIndex = config.module.rules.findIndex((r) => r.test && r.test.toString().indexOf('scss') !== -1);
    config.module.rules.splice(scssLoaderRuleIndex, 1, {
        test: /\.scss$/,
        use: [
            { loader: 'apply-css-loader' },
            {
                loader: 'css2json-loader',
                options: { useForImports: true }
            }
        ]
            .concat(
                !!production
                    ? [
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
                          }
                      ]
                    : []
            )
            .concat([
                {
                    loader: 'sass-loader',
                    options: {
                        sourceMap: false,
                        additionalData: scssPrepend
                    }
                }
            ])
        // },
        // {
        //     test: /\.module\.scss$/,
        //     use: [
        //         { loader: 'css-loader', options: { url: false } },
        //         {
        //             loader: 'sass-loader',
        //             options: {
        //                 sourceMap: false,
        //                 additionalData: scssPrepend
        //             }
        //         }
        //     ]
    });

    const usedMDIICons = [];
    config.module.rules.push({
        // rules to replace mdi icons and not use nativescript-font-icon
        test: /\.(ts|js|scss|css|svelte)$/,
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
                    search: '__PACKAGE__',
                    replace: appId,
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
        ]
    });
    // we remove default rules
    config.plugins = config.plugins.filter((p) => ['CopyPlugin', 'ForkTsCheckerWebpackPlugin'].indexOf(p.constructor.name) === -1);
    // we add our rules
    const globOptions = { dot: false, ignore: [`**/${relative(appPath, appResourcesFullPath)}/**`] };

    const context = nsWebpack.Utils.platform.getEntryDirPath();

    const allowedAddressFormatterCountries = supportedLocales.map((s) => s.toUpperCase()).concat(['default']);

    function filterObject(raw, allowed) {
        Object.keys(raw)
            .filter((key) => !allowed.includes(key))
            .forEach((key) => delete raw[key]);
        return raw;
    }
    const copyPatterns = [
        { context, from: 'fonts/!(ios|android)/**/*', to: 'fonts/[name][ext]', noErrorOnMissing: true, globOptions },
        { context, from: 'fonts/*', to: 'fonts/[name][ext]', noErrorOnMissing: true, globOptions },
        { context, from: `fonts/${platform}/**/*`, to: 'fonts/[name][ext]', noErrorOnMissing: true, globOptions },
        { context, from: '**/*.jpg', noErrorOnMissing: true, globOptions },
        { context, from: '**/*.png', noErrorOnMissing: true, globOptions },
        { context, from: 'assets/**/*', noErrorOnMissing: true, globOptions },
        { context: 'tools', from: 'assets/**/*', noErrorOnMissing: true, globOptions },
        {
            context,
            from: 'i18n/**/*',
            globOptions,
            transform: !!production
                ? {
                      transformer: (content, path) => Promise.resolve(Buffer.from(JSON.stringify(JSON.parse(content.toString())), 'utf8'))
                  }
                : undefined
        },
        {
            from: 'node_modules/@mdi/font/fonts/materialdesignicons-webfont.ttf',
            to: 'fonts',
            globOptions
            // transform: !!production
            //     ? {
            //           transformer(content, path) {
            //               return new Promise((resolve, reject) => {
            //                   new Fontmin()
            //                       .src(content)
            //                       .use(Fontmin.glyph({ subset: usedMDIICons }))
            //                       .run(function (err, files) {
            //                           if (err) {
            //                               reject(err);
            //                           } else {
            //                               resolve(files[0].contents);
            //                           }
            //                       });
            //               });
            //           }
            //       }
            //     : undefined
        },
        {
            from: 'css/osm.scss',
            to: 'osm_icons.json',
            globOptions,
            transform: {
                cache: !production,
                transformer(manifestBuffer, path) {
                    const symbols = symbolsParser.parseSymbols(manifestBuffer.toString());
                    const icons = symbols.variables.reduce(function (acc, value) {
                        if (value.name.startsWith('$osm-')) {
                            acc[value.name.slice(5)] = String.fromCharCode(parseInt(value.value.slice(11, -2), 16));
                        }
                        return acc;
                    }, {});
                    return Buffer.from(JSON.stringify(icons));
                }
            }
        },
        {
            from: 'css/variables.scss',
            to: 'material_icons.json',
            globOptions,
            transform: {
                cache: !production,
                transformer(manifestBuffer, path) {
                    return Buffer.from(
                        JSON.stringify(
                            Object.keys(mdiIcons).reduce(function (result, key) {
                                const numericValue = parseInt(mdiIcons[key], 16);
                                const character = fixedFromCharCode(numericValue);
                                result[key] = character;
                                return result;
                            }, {})
                        )
                    );
                }
            }
        },
        {
            context: 'node_modules/@akylas/address-formatter/src/templates',
            from: '*.json',
            to: 'address-formatter/templates',
            globOptions,
            transform: {
                cache: !production,
                transformer(buffer, path) {
                    const data = JSON.parse(buffer.toString());
                    return Buffer.from(JSON.stringify(path.endsWith('aliases.json') ? data : filterObject(data, allowedAddressFormatterCountries)));
                }
            }
        }
    ];
    if (!production) {
        copyPatterns.push({ context: 'dev_assets', from: '**/*', to: 'assets', globOptions });
    }
    config.plugins.unshift(new CopyPlugin({ patterns: copyPatterns }));

    config.plugins.unshift(
        new webpack.ProvidePlugin({
            svN: '@shared/svelteNamespace'
        })
    );

    config.plugins.push(new SpeedMeasurePlugin());

    config.plugins.unshift(
        new webpack.ProvidePlugin({
            setTimeout: [require.resolve(coreModulesPackageName + '/timer/index.' + platform), 'setTimeout'],
            clearTimeout: [require.resolve(coreModulesPackageName + '/timer/index.' + platform), 'clearTimeout'],
            setInterval: [require.resolve(coreModulesPackageName + '/timer/index.' + platform), 'setInterval'],
            clearInterval: [require.resolve(coreModulesPackageName + '/timer/index.' + platform), 'clearInterval'],
            // FormData: [require.resolve(coreModulesPackageName + '/polyfills/formdata'), 'FormData'],
            requestAnimationFrame: [require.resolve(coreModulesPackageName + '/animation-frame'), 'requestAnimationFrame'],
            cancelAnimationFrame: [require.resolve(coreModulesPackageName + '/animation-frame'), 'cancelAnimationFrame']
        })
    );
    config.plugins.push(new webpack.ContextReplacementPlugin(/dayjs[\/\\]locale$/, new RegExp(`(${supportedLocales.map((l) => l.replace('_', '-').toLowerCase()).join('|')}).\js`)));

    // config.optimization.splitChunks.cacheGroups.defaultVendor.test = /[\\/](node_modules|ui-carto|ui-chart|NativeScript[\\/]dist[\\/]packages[\\/]core)[\\/]/;
    config.optimization.splitChunks.cacheGroups.defaultVendor.test = function (module) {
        const absPath = module.resource;
        if (absPath) {
            const relativePath = relative(projectRoot, absPath);
            return absPath.indexOf('node_modules') !== -1 || !(relativePath && !relativePath.startsWith('..') && !isAbsolute(relativePath));
        }
        return false;
    };

    config.plugins.push(new IgnoreNotFoundExportPlugin());

    const nativescriptReplace = '(NativeScript[\\/]dist[\\/]packages[\\/]core|@nativescript/core|@akylas/nativescript)';
    config.plugins.push(
        new webpack.NormalModuleReplacementPlugin(/http/, (resource) => {
            if (resource.context.match(nativescriptReplace) || resource.request === '@nativescript/core/http' || resource.request === '@akylas/nativescript/http') {
                resource.request = '@nativescript-community/https';
            }
        })
    );
    if (fork && production) {
        if (!accessibility) {
            config.plugins.push(
                new webpack.NormalModuleReplacementPlugin(/accessibility$/, (resource) => {
                    if (resource.context.match(nativescriptReplace)) {
                        resource.request = '~/shims/accessibility';
                    }
                })
            );
        }
        config.plugins.push(
            new webpack.NormalModuleReplacementPlugin(/action-bar$/, (resource) => {
                if (resource.context.match(nativescriptReplace)) {
                    resource.request = '~/shims/action-bar';
                }
            })
        );
    }
    // save as long as we dont use calc in css
    config.plugins.push(new webpack.IgnorePlugin({ resourceRegExp: /reduce-css-calc$/ }));
    config.plugins.push(new webpack.IgnorePlugin({ resourceRegExp: /punnycode$/ }));
    config.plugins.push(new webpack.IgnorePlugin({ resourceRegExp: /^url$/ }));

    if (!!production && !timeline) {
        console.log('removing N profiling');
        config.plugins.push(
            new webpack.NormalModuleReplacementPlugin(/profiling$/, (resource) => {
                if (resource.context.match(nativescriptReplace)) {
                    resource.request = '~/shims/profile';
                }
            })
        );
        if (!sentry) {
            config.plugins.push(
                new webpack.NormalModuleReplacementPlugin(/trace$/, (resource) => {
                    if (resource.context.match(nativescriptReplace)) {
                        resource.request = '~/shims/trace';
                    }
                })
            );
        }
        config.module.rules.push(
            {
                // rules to replace mdi icons and not use nativescript-font-icon
                test: /\.(js)$/,
                use: [
                    {
                        loader: 'string-replace-loader',
                        options: {
                            search: /__decorate\(\[((\s|\t|\n)*?)([a-zA-Z]+\.)?profile((\s|\t|\n)*?)\],.*?,.*?,.*?\);?/gm,
                            replace: (match, p1, offset, str) => '',
                            flags: 'gm'
                        }
                    }
                ]
            },
            {
                // rules to replace mdi icons and not use nativescript-font-icon
                test: /\.(ts)$/,
                use: [
                    {
                        loader: 'string-replace-loader',
                        options: {
                            search: '@profile',
                            replace: (match, p1, offset, str) => '',
                            flags: ''
                        }
                    }
                ]
            },
            // rules to clean up all Trace in production
            // we must run it for all files even node_modules
            {
                test: /\.(ts|js)$/,
                use: [
                    {
                        loader: 'string-replace-loader',
                        options: {
                            search: /if\s*\(\s*Trace.isEnabled\(\)\s*\)/gm,
                            replace: (match, p1, offset, str) => 'if (false)',
                            flags: 'g'
                        }
                    }
                ]
            }
        );
    }
    if (!!production) {
        config.plugins.push(
            new ForkTsCheckerWebpackPlugin({
                async: false
            })
        );
    }

    if (report) {
        // Generate report files for bundles content
        config.plugins.push(
            new BundleAnalyzerPlugin({
                analyzerMode: 'static',
                openAnalyzer: false,
                generateStatsFile: true,
                reportFilename: resolve(projectRoot, 'report', 'report.html'),
                statsFilename: resolve(projectRoot, 'report', 'stats.json')
            })
        );
    }

    if (buildstyle) {
        const css2xmlBin = `css2xml_${process.platform === 'darwin' ? 'macos' : process.platform}`;
        let dir1 = join(projectRoot, 'dev_assets/styles/inner_cleaned');
        if (!existsSync(dir1)) {
            mkdirSync(dir1);
        }
        dir1 = join(projectRoot, 'dev_assets/styles/osm_cleaned');
        if (!existsSync(dir1)) {
            mkdirSync(dir1);
        }
        dir1 = join(projectRoot, 'dev_assets/styles/admin_cleaned');
        if (!existsSync(dir1)) {
            mkdirSync(dir1);
        }
        dir1 = join(projectRoot, 'app/assets/styles');
        if (!existsSync(dir1)) {
            mkdirSync(dir1);
        }
        config.plugins.unshift(
            new WebpackShellPluginNext({
                onBuildStart: {
                    scripts: [
                        'fontforge --script ./fixFontDirection_overlap.pe app/fonts/osm.ttf ./dev_assets/styles/inner/fonts/osm.ttf',
                        'fontforge --script ./fixFontDirection.pe node_modules/@mdi/font/fonts/materialdesignicons-webfont.ttf ./dev_assets/styles/base/fonts/materialdesignicons-webfont.ttf',
                        `./${css2xmlBin} dev_assets/styles/osm/streets.json dev_assets/styles/osmxml_cleaned/streets.xml`,
                        `./${css2xmlBin} dev_assets/styles/osm/osm.json dev_assets/styles/osmxml_cleaned/osm.xml`,
                        `./${css2xmlBin} dev_assets/styles/osm/outdoors.json dev_assets/styles/osmxml_cleaned/outdoors.xml`,
                        `./${css2xmlBin} dev_assets/styles/osm/eink.json dev_assets/styles/osmxml_cleaned/eink.xml`,
                        'cd ./dev_assets/styles/osmxml_cleaned && zip -r ../../../app/assets/styles/osm.zip ./* && cd -',
                        `./${css2xmlBin} dev_assets/styles/inner/voyager.json dev_assets/styles/inner_cleaned/voyager.xml`,
                        `./${css2xmlBin} dev_assets/styles/inner/eink.json dev_assets/styles/inner_cleaned/eink.xml`,
                        'cd ./dev_assets/styles/inner_cleaned && zip -r ../../../app/assets/styles/inner.zip ./* && cd -',
                        `./${css2xmlBin} dev_assets/styles/admin/voyager.json dev_assets/styles/admin_cleaned/voyager.xml`,
                        'cd ./dev_assets/styles/admin_cleaned && zip -r ../../../app/assets/styles/admin.zip ./* && cd -',
                        'cd ./dev_assets/styles/base && zip -r ../../../app/assets/styles/base.zip ./* && cd -'
                    ],
                    blocking: true,
                    parallel: false
                },
                safe: true
            })
        );
        config.plugins.unshift(
            new WebpackShellPluginNext({
                onBuildExit: {
                    scripts: [
                        //     `cp dev_assets/styles/inner/fonts/materialdesignicons-webfont.ttf ${join(dist, 'fonts')}`,
                        // `cp dev_assets/styles/inner_cleaned/fonts/materialdesignicons-webfont.ttf ${join(dist, 'assets/styles/inner/fonts')}`,
                        `cp dev_assets/styles/inner/fonts/osm.ttf ${join(dist, 'fonts')}`,
                        `cp dev_assets/styles/inner/fonts/osm.ttf dev_assets/styles/osm/fonts`
                        // `cp dev_assets/styles/base/fonts/osm.ttf ${join(dist, 'assets/styles/inner/fonts')}`,
                        // `cp dev_assets/styles/base/fonts/osm.ttf ${join(dist, 'assets/styles/osm/fonts')}`
                    ],
                    blocking: true,
                    parallel: false
                },
                safe: true
            })
        );
    }

    if (hiddenSourceMap || sourceMap) {
        if (!!sentry) {
            config.devtool = false;
            config.devtool = 'source-map';
            config.plugins.push(
                new webpack.SourceMapDevToolPlugin({
                    append: `\n//# sourceMappingURL=${process.env.SOURCEMAP_REL_DIR}/[name].js.map`,
                    filename: join(process.env.SOURCEMAP_REL_DIR, '[name].js.map')
                })
            );
            if (!!uploadSentry) {
                config.plugins.push(
                    sentryWebpackPlugin({
                        telemetry: false,
                        org: process.env.SENTRY_ORG,
                        url: process.env.SENTRY_URL,
                        project: process.env.SENTRY_PROJECT,
                        authToken: process.env.SENTRY_AUTH_TOKEN,
                        release: {
                            name: `${appId}@${platform}${isAndroid ? (playStoreBuild ? '.playstore' : '.fdroid') : ''}@${appVersion}+${buildNumber}`,
                            dist: `${buildNumber}.${platform}${isAndroid ? (playStoreBuild ? '.playstore' : '.fdroid') : ''}`,
                            setCommits: {
                                auto: true,
                                ignoreEmpty: true,
                                ignoreMissing: true
                            },
                            create: true,
                            cleanArtifacts: false
                        },
                        sourcemaps: {
                            rewriteSources: (source, map) => source.replace('webpack:///', 'webpack://'),
                            ignore: ['tns-java-classes', 'hot-update'],
                            assets: [join(dist, '**/*.js'), join(dist, process.env.SOURCEMAP_REL_DIR, '*.map')]
                        }
                    })
                );
            }
        } else {
            config.devtool = 'inline-nosources-cheap-module-source-map';
        }
    } else {
        config.devtool = false;
    }
    config.externalsPresets = { node: false };
    config.resolve.fallback = config.resolve.fallback || {};
    config.optimization.minimize = uglify !== undefined ? !!uglify : production;
    const isAnySourceMapEnabled = !!sourceMap || !!hiddenSourceMap || !!inlineSourceMap;
    const actual_keep_classnames_functionnames = keep_classnames_functionnames;
    config.optimization.usedExports = true;
    config.optimization.minimizer = [
        new TerserPlugin({
            parallel: true,
            terserOptions: {
                ecma: 2020,
                module: true,
                toplevel: false,
                keep_classnames: actual_keep_classnames_functionnames,
                keep_fnames: actual_keep_classnames_functionnames,
                output: {
                    comments: false,
                    semicolons: !isAnySourceMapEnabled
                },
                compress: {
                    booleans_as_integers: false,
                    // The Android SBG has problems parsing the output
                    // when these options are enabled
                    collapse_vars: platform !== 'android',
                    sequences: platform !== 'android',
                    passes: 3,
                    drop_console: production && noconsole
                }
            }
        })
    ];
    const configs = [config];
    if (buildpeakfinder) {
        if (env.adhoc || env.adhoc_sentry) {
            config.plugins.push(new WaitPlugin(join(projectRoot, appPath, 'assets', 'peakfinder', 'index.html'), 100, 60000));
        }
        configs.push(require('./peakfinder/webpack.config.js')(env, params));
    }
    if (build3dmap) {
        if (env.adhoc || env.adhoc_sentry) {
            config.plugins.push(new WaitPlugin(join(projectRoot, appPath, 'assets', '3dmap', 'index.html'), 100, 60000));
        }
        configs.push(require('./3dmap/webpack.config.js')(env, params));
    }
    return configs;
};
