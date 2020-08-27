const { join, relative, resolve, sep } = require('path');
const { existsSync, mkdirSync, readFileSync } = require('fs');

const webpack = require('webpack');
const { CleanWebpackPlugin } = require('clean-webpack-plugin');
const CopyWebpackPlugin = require('copy-webpack-plugin');
const { BundleAnalyzerPlugin } = require('webpack-bundle-analyzer');
const TerserPlugin = require('terser-webpack-plugin');

const { VueLoaderPlugin } = require('vue-loader');

const nsWebpack = require('nativescript-dev-webpack');
const nativescriptTarget = require('nativescript-dev-webpack/nativescript-target');
const { NativeScriptWorkerPlugin } = require('nativescript-worker-loader/NativeScriptWorkerPlugin');
const hashSalt = Date.now().toString();
const ForkTsCheckerWebpackPlugin = require('fork-ts-checker-webpack-plugin');
const mergeOptions = require('merge-options');
const SentryCliPlugin = require('@sentry/webpack-plugin');

// returns a new object with the values at each key mapped using mapFn(value)

// temporary hack to support v-model using ns-vue-template-compiler
// See https://github.com/nativescript-vue/nativescript-vue/issues/371
const NsVueTemplateCompiler = require('nativescript-vue-template-compiler');
NsVueTemplateCompiler.registerElement('MDTextField', () => require('nativescript-material-textfield').TextField, {
    model: {
        prop: 'text',
        event: 'textChange'
    }
});
NsVueTemplateCompiler.registerElement('MDSlider', () => require('nativescript-material-slider').Slider, {
    model: {
        prop: 'value',
        event: 'valueChange'
    }
});

module.exports = (env, params = {}) => {
    const platform = env && ((env.android && 'android') || (env.ios && 'ios') || env.platform);
    if (!platform) {
        throw new Error('You need to provide a target platform!');
    }

    // Add your custom Activities, Services and other android app components here.
    let appComponents = env.appComponents || [];
    appComponents.push(...['tns-core-modules/ui/frame', 'tns-core-modules/ui/frame/activity']);

    // if (platform === 'android') {
    // appComponents.push(...[resolve(__dirname, 'app/services/android/BgService.ts'), resolve(__dirname, 'app/services/android/BgServiceBinder.ts')]);
    // }
    console.log('appComponents', appComponents);
    const platforms = ['ios', 'android'];
    const projectRoot = __dirname;


    if (env.platform) {
        platforms.push(env.platform);
    }

    // Default destination inside platforms/<platform>/...
    const dist = resolve(projectRoot, nsWebpack.getAppPath(platform, projectRoot));

    if (env.adhoc) {
        env = Object.assign({}, env, {
            production: true,
            sentry: false,
            sourceMap: true,
            uglify: true
        });
    }
    const {
        // The 'appPath' and 'appResourcesPath' values are fetched from
        // the nsconfig.json configuration file.
        appPath = 'app',
        appResourcesPath = 'app/App_Resources',

        // You can provide the following flags when running 'tns run android|ios'
        emulator, // --env.emulator
        snapshot, // --env.snapshot
        production, // --env.production
        report, // --env.report
        hmr, // --env.hmr
        sourceMap, // --env.sourceMap
        hiddenSourceMap, // --env.hiddenSourceMap
        inlineSourceMap, // --env.inlineSourceMap
        unitTesting, // --env.unitTesting
        verbose, // --env.verbose
        snapshotInDocker, // --env.snapshotInDocker
        skipSnapshotTools, // --env.skipSnapshotTools
        compileSnapshot, // --env.compileSnapshot
        uglify, // --env.uglify
        devlog, // --env.devlog
        sentry, // --env.sentry
        adhoc, // --env.adhoc
        es5 // --env.es5
    } = env;

    let tsconfig = params.tsconfig;
    if (!tsconfig) {
        tsconfig = 'tsconfig.json';
        if (es5) {
            tsconfig = 'tsconfig.es5.json';
        }
    }
    console.log('tsconfig', tsconfig);

    const useLibs = compileSnapshot;
    const isAnySourceMapEnabled = !!sourceMap || !!hiddenSourceMap || !!inlineSourceMap;
    const externals = nsWebpack.getConvertedExternals(env.externals);

    const mode = production ? 'production' : 'development';

    const appFullPath = resolve(projectRoot, appPath);
    const hasRootLevelScopedModules = nsWebpack.hasRootLevelScopedModules({ projectDir: projectRoot });
    let coreModulesPackageName = 'tns-core-modules';
    const alias = env.alias || {};
    alias['~'] = appFullPath;
    alias['@'] = appFullPath;
    alias['vue'] = 'nativescript-vue';
    alias['@nativescript/core'] = '@akylas/nativescript';

    if (hasRootLevelScopedModules) {
        coreModulesPackageName = '@nativescript/core';
        alias['tns-core-modules'] = coreModulesPackageName;
    }

    Object.assign(alias, {
        '../adapters/webSQL': 'nativescript-akylas-sqlite/typeorm/NativescriptDriver',
        '../driver/oracle/OracleDriver': 'nativescript-akylas-sqlite/typeorm/NativescriptDriver',
        './oracle/OracleDriver': 'nativescript-akylas-sqlite/typeorm/NativescriptDriver',
        '../driver/cockroachdb/CockroachDriver': 'nativescript-akylas-sqlite/typeorm/NativescriptDriver',
        './cockroachdb/CockroachDriver': 'nativescript-akylas-sqlite/typeorm/NativescriptDriver',
        './cordova/CordovaDriver': 'nativescript-akylas-sqlite/typeorm/NativescriptDriver',
        './react-native/ReactNativeDriver': 'nativescript-akylas-sqlite/typeorm/NativescriptDriver',
        '../driver/react-native/ReactNativeDriver': 'nativescript-akylas-sqlite/typeorm/NativescriptDriver',
        './nativescript/NativescriptDriver': 'nativescript-akylas-sqlite/typeorm/NativescriptDriver',
        '../driver/nativescript/NativescriptDriver': 'nativescript-akylas-sqlite/typeorm/NativescriptDriver',
        './mysql/MysqlDriver': 'nativescript-akylas-sqlite/typeorm/NativescriptDriver',
        '../driver/mysql/MysqlDriver': 'nativescript-akylas-sqlite/typeorm/NativescriptDriver',
        './postgres/PostgresDriver': 'nativescript-akylas-sqlite/typeorm/NativescriptDriver',
        '../driver/postgres/PostgresDriver': 'nativescript-akylas-sqlite/typeorm/NativescriptDriver',
        './expo/ExpoDriver': 'nativescript-akylas-sqlite/typeorm/NativescriptDriver',
        './aurora-data-api/AuroraDataApiDriver': 'nativescript-akylas-sqlite/typeorm/NativescriptDriver',
        '../driver/aurora-data-api/AuroraDataApiDriver': 'nativescript-akylas-sqlite/typeorm/NativescriptDriver',
        './sqlite/SqliteDriver': 'nativescript-akylas-sqlite/typeorm/NativescriptDriver',
        '../driver/sqljs/SqljsDriver': 'nativescript-akylas-sqlite/typeorm/NativescriptDriver',
        './sqljs/SqljsDriver': 'nativescript-akylas-sqlite/typeorm/NativescriptDriver',
        '../driver/sqlserver/SqlServerDriver': 'nativescript-akylas-sqlite/typeorm/NativescriptDriver',
        './sqlserver/SqlServerDriver': 'nativescript-akylas-sqlite/typeorm/NativescriptDriver',
        './mongodb/MongoDriver': 'nativescript-akylas-sqlite/typeorm/NativescriptDriver',
        '../driver/mongodb/MongoDriver': 'nativescript-akylas-sqlite/typeorm/NativescriptDriver',
        './cordova/CordovaDriver': 'nativescript-akylas-sqlite/typeorm/NativescriptDriver',
        '../driver/cordova/CordovaDriver': 'nativescript-akylas-sqlite/typeorm/NativescriptDriver'
    });

    const appResourcesFullPath = resolve(projectRoot, appResourcesPath);

    const entryModule = nsWebpack.getEntryModule(appFullPath, platform);
    const entryPath = `.${sep}${entryModule}`;
    const entries = env.entries || {};
    entries.bundle = entryPath;

    const areCoreModulesExternal = Array.isArray(env.externals) && env.externals.some(e => e.indexOf('tns-core-modules') > -1);
    if (platform === 'ios' && !areCoreModulesExternal) {
        entries['tns_modules/tns-core-modules/inspector_modules'] = 'inspector_modules';
    }
    console.log(`Bundling application for entryPath ${entryPath}...`);

    const sourceMapFilename = nsWebpack.getSourceMapFilename(hiddenSourceMap, __dirname, dist);

    const itemsToClean = [`${dist}/**/*`];
    if (platform === 'android') {
        itemsToClean.push(`${join(projectRoot, 'platforms', 'android', 'app', 'src', 'main', 'assets', 'snapshots')}`);
        itemsToClean.push(
            `${join(projectRoot, 'platforms', 'android', 'app', 'build', 'configurations', 'nativescript-android-snapshot')}`
        );
    }

    const defines = mergeOptions(
        {
            PRODUCTION: !!production,
            process: 'global.process',
            'global.TNS_WEBPACK': 'true',
            'gVars.platform': `"${platform}"`,
            'gVars.isIOS': platform === 'ios',
            'gVars.isAndroid': platform === 'android',
            TNS_ENV: JSON.stringify(mode),
            'gVars.sentry': !!sentry,
            MAGICK_MODE:true, 
            SENTRY_DSN: `"${process.env.SENTRY_DSN}"`,
            SENTRY_PREFIX: `"${!!sentry ? process.env.SENTRY_PREFIX : ''}"`,
            LOCAL_MBTILES: `"${!!emulator ? '/storage/100F-3415/alpimaps_mbtiles' : '/storage/C0E5-1DEA/alpimaps_mbtiles'}"`,
            LOG_LEVEL: devlog ? '"full"' : '""',
            DEV_LOG: devlog && !production,
            TEST_LOGS: adhoc || !production
        },
        params.definePlugin || {}
    );
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
    console.log('defines', defines);

    const symbolsParser = require('scss-symbols-parser');
    const mdiSymbols = symbolsParser.parseSymbols(
        readFileSync(resolve(projectRoot, 'node_modules/@mdi/font/scss/_variables.scss')).toString()
    );
    const mdiIcons = JSON.parse(
        `{${mdiSymbols.variables[mdiSymbols.variables.length - 1].value.replace(/" (F|0)(.*?)([,\n]|$)/g, '": "$1$2"$3')}}`
    );

    // const cairnSymbols = symbolsParser.parseSymbols(readFileSync(resolve(appFullPath, 'css/cairn.scss')).toString());
    // const cairnIcons = JSON.parse(`{${cairnSymbols.variables[cairnSymbols.variables.length - 1].value.replace(/'cairn-([a-zA-Z0-9-_]+)' (F|f|e|0)(.*?)([,\n]+|$)/g, '"$1": "$2$3"$4')}}`);

    const scssPrepend = `$mdi-fontFamily: ${platform === 'android' ? 'materialdesignicons-webfont' : 'Material Design Icons'};`;

    nsWebpack.processAppComponents(appComponents, platform);
    const config = {
        mode,
        context: appFullPath,
        externals: externals.concat(params.externals || []),
        watchOptions: {
            ignored: [
                appResourcesFullPath,
                // Don't watch hidden files
                '**/.*'
            ]
        },
        target: nativescriptTarget,
        // target: nativeScriptVueTarget,
        entry: entries,
        output: {
            pathinfo: false,
            path: dist,
            libraryTarget: 'commonjs2',
            filename: '[name].js',
            globalObject: 'global',
            hashSalt
        },
        resolve: {
            mainFields: es5 ? ['main'] : ['module', 'main'],
            extensions: es5 ? ['.vue', '.ts', '.js', '.scss', '.css'] : ['.vue', '.mjs', '.ts', '.js', '.scss', '.css'],
            // Resolve {N} system modules from tns-core-modules
            modules: [
                resolve(__dirname, `node_modules/${coreModulesPackageName}`),
                resolve(__dirname, 'node_modules'),
                `node_modules/${coreModulesPackageName}`,
                'node_modules'
            ],
            alias,
            // resolve symlinks to symlinked modules
            symlinks: true
        },
        resolveLoader: {
            // don't resolve symlinks to symlinked loaders
            symlinks: false
        },
        node: {
            // Disable node shims that conflict with NativeScript
            http: false,
            timers: false,
            setImmediate: false,
            fs: 'empty',
            crypto: 'empty',
            __dirname: false
        },
        devtool: inlineSourceMap ? 'inline-cheap-source-map' : false,
        optimization: {
            runtimeChunk: 'single',
            noEmitOnErrors: true,
            splitChunks: {
                cacheGroups: {
                    vendor: {
                        name: 'vendor',
                        chunks: 'all',
                        test: module => {
                            const moduleName = module.nameForCondition ? module.nameForCondition() : '';
                            return (
                                /[\\/]node_modules[\\/]/.test(moduleName) ||
                                /@nativescript\/core/.test(moduleName) ||
                                /nativescript-core/.test(moduleName) || // this one is for linked nativescript core build
                                appComponents.some(comp => comp === moduleName) ||
                                (params.chunkTestCallback && params.chunkTestCallback(moduleName))
                            );
                        },
                        enforce: true
                    }
                }
            },
            minimize: uglify !== undefined ? uglify : production,
            minimizer: [
                new TerserPlugin(
                    mergeOptions(
                        {
                            parallel: true,
                            cache: true,
                            sourceMap: isAnySourceMapEnabled,
                            terserOptions: {
                                ecma: 2016,
                                // warnings: true,
                                // toplevel: true,
                                output: {
                                    comments: false,
                                    semicolons: !isAnySourceMapEnabled
                                },
                                compress: {
                                    // The Android SBG has problems parsing the output
                                    // when these options are enabled
                                    collapse_vars: platform !== 'android',
                                    sequences: platform !== 'android',
                                    passes: 2
                                }
                                // keep_fnames: true
                            }
                        },
                        params.terserOptions || {}
                    )
                )
            ]
        },
        module: {
            rules: [
                {
                    include: [join(appFullPath, entryPath + '.js'), join(appFullPath, entryPath + '.ts')],
                    use: [
                        // Require all Android app components
                        platform === 'android' && {
                            loader: resolve(__dirname, 'node_modules', 'nativescript-dev-webpack/android-app-components-loader'),
                            options: { modules: appComponents }
                        },

                        {
                            loader: resolve(__dirname, 'node_modules', 'nativescript-dev-webpack/bundle-config-loader'),
                            options: {
                                registerPages: true, // applicable only for non-angular apps
                                loadCss: !snapshot, // load the application css if in debug mode
                                unitTesting,
                                appFullPath,
                                projectRoot,
                                ignoredFiles: nsWebpack.getUserDefinedEntries(entries, platform)
                            }
                        }
                    ].filter(loader => Boolean(loader))
                },
                {
                    // needs to be boefore the string replace
                    test: /\.vue$/,
                    use: [
                        {
                            loader: resolve(__dirname, 'node_modules', 'vue-loader'),
                            options: {
                                compiler: NsVueTemplateCompiler
                            }
                        }
                    ]
                },
                {
                    // rules to replace mdi icons and not use nativescript-font-icon
                    test: /\.(ts|js|css|vue)$/,
                    exclude: /node_modules/,
                    use: [
                        {
                            loader: resolve(__dirname, 'node_modules', 'string-replace-loader'),
                            options: {
                                search: 'cairn-([a-zA-Z0-9-_]+)',
                                replace: (match, p1, offset) => {
                                    if (cairnIcons[p1]) {
                                        return String.fromCharCode(parseInt(cairnIcons[p1], 16));
                                    }
                                    return match;
                                },
                                flags: 'g'
                            }
                        },
                        {
                            loader: resolve(__dirname, 'node_modules', 'string-replace-loader'),
                            options: {
                                search: 'mdi-([a-z-]+)',
                                replace: (match, p1, offset) => {
                                    if (mdiIcons[p1]) {
                                        return String.fromCharCode(parseInt(mdiIcons[p1], 16));
                                    }
                                    return match;
                                },
                                flags: 'g'
                            }
                        }
                    ]
                },
                {
                    test: /[\/|\\]app\.css$/,
                    use: [
                        resolve(__dirname, 'node_modules', 'nativescript-dev-webpack/style-hot-loader'),
                        {
                            loader: resolve(__dirname, 'node_modules', 'nativescript-dev-webpack/css2json-loader'),
                            options: { useForImports: true }
                        }
                    ]
                },
                {
                    test: /[\/|\\]app\.scss$/,
                    use: [
                        resolve(__dirname, 'node_modules', 'nativescript-dev-webpack/style-hot-loader'),
                        {
                            loader: resolve(__dirname, 'node_modules', 'nativescript-dev-webpack/css2json-loader'),
                            options: { useForImports: true }
                        },
                        {
                            loader: resolve(__dirname, 'node_modules', 'sass-loader'),
                            options: {
                                sourceMap: false,
                                prependData: scssPrepend
                            }
                        }
                    ]
                },
                {
                    test: /\.css$/,
                    exclude: /[\/|\\]app\.css$/,
                    use: [
                        resolve(__dirname, 'node_modules', 'nativescript-dev-webpack/style-hot-loader'),
                        resolve(__dirname, 'node_modules', 'nativescript-dev-webpack/apply-css-loader.js'),
                        { loader: resolve(__dirname, 'node_modules', 'css-loader'), options: { url: false } }
                    ]
                },
                {
                    test: /\.scss$/,
                    exclude: /[\/|\\]app\.scss$/,
                    use: [
                        resolve(__dirname, 'node_modules', 'nativescript-dev-webpack/style-hot-loader'),
                        resolve(__dirname, 'node_modules', 'nativescript-dev-webpack/apply-css-loader.js'),
                        { loader: resolve(__dirname, 'node_modules', 'css-loader'), options: { url: false } },
                        {
                            loader: resolve(__dirname, 'node_modules', 'sass-loader'),
                            options: {
                                sourceMap: false,
                                prependData: scssPrepend
                            }
                        }
                    ]
                },
                {
                    test: /\.mjs$/,
                    type: 'javascript/auto'
                },
                // {
                //     test: /\.js$/,
                //     loader: 'babel-loader'
                // },
                {
                    test: /\.ts$/,
                    exclude: /node_modules/,
                    use: [
                        {
                            loader: resolve(__dirname, 'node_modules', 'ts-loader'),
                            options: {
                                configFile: resolve(tsconfig),
                                transpileOnly: true,
                                appendTsSuffixTo: [/\.vue$/],
                                allowTsInNodeModules: true,
                                compilerOptions: {
                                    sourceMap: isAnySourceMapEnabled,
                                    declaration: false
                                }
                            }
                        }
                    ]
                }
            ]
        },
        plugins: [
            // ... Vue Loader plugin omitted
            // make sure to include the plugin!
            new VueLoaderPlugin(),
            // Define useful constants like TNS_WEBPACK
            new webpack.EnvironmentPlugin(
                mergeOptions(
                    {
                        NODE_ENV: JSON.stringify(mode), // use 'development' unless process.env.NODE_ENV is defined
                        DEBUG: false
                    },
                    params.environmentPlugin || {}
                )
            ),
            new webpack.DefinePlugin(defines),
            // Remove all files from the out dir.
            new CleanWebpackPlugin({
                dangerouslyAllowCleanPatternsOutsideProject: true,
                dry: false,
                verbose: !!verbose,
                cleanOnceBeforeBuildPatterns: itemsToClean
            }),
            // Copy assets to out dir. Add your own globs as needed.
            new CopyWebpackPlugin(
                [
                    { from: 'fonts/!(ios|android)/**/*', to: 'fonts', flatten: true },
                    { from: 'fonts/*', to: 'fonts', flatten: true },
                    { from: `fonts/${platform}/**/*`, to: 'fonts', flatten: true },
                    { from: '**/*.+(jpg|png)' },
                    { from: 'assets/**/*' },
                    {
                        from: resolve(__dirname, 'node_modules', '@mdi/font/fonts/materialdesignicons-webfont.ttf'),
                        to: 'fonts'
                        // },
                        // {
                        //     from: '../node_modules/weather-icons/font/weathericons-regular-webfont.ttf',
                        //     to: 'fonts'
                    }
                ].concat(params.copyPlugin || []),
                {
                    ignore: [`${relative(appPath, appResourcesFullPath)}/**`]
                }
            ),
            new nsWebpack.GenerateNativeScriptEntryPointsPlugin('bundle'),
            // For instructions on how to set up workers with webpack
            // check out https://github.com/nativescript/worker-loader
            new NativeScriptWorkerPlugin(),
            new nsWebpack.PlatformFSPlugin({
                platform,
                platforms
            }),
            // Does IPC communication with the {N} CLI to notify events when running in watch mode.
            new nsWebpack.WatchStateLoggerPlugin(),
            new webpack.ContextReplacementPlugin(/dayjs[/\\]locale$/, /en|fr/)
        ]
    };
    if (hiddenSourceMap || sourceMap) {
        if (!!sentry) {
            // const sourceMapFilename = nsWebpack.getSourceMapFilename(hiddenSourceMap, __dirname, dist);

            config.plugins.push(
                new webpack.SourceMapDevToolPlugin(
                    mergeOptions(
                        {
                            append: `\n//# sourceMappingURL=${process.env.SENTRY_PREFIX}[name].js.map`,
                            filename: join(process.env.SOURCEMAP_REL_DIR, '[name].js.map')
                        },
                        params.sourceMapPlugin || {}
                    )
                )
            );
            let appVersion;
            let buildNumber;
            if (platform === 'android') {
                appVersion = readFileSync('app/App_Resources/Android/app.gradle', 'utf8').match(
                    /versionName "((?:[0-9]+\.?)+)"/
                )[1];
                buildNumber = readFileSync('app/App_Resources/Android/app.gradle', 'utf8').match(/versionCode ([0-9]+)/)[1];
            } else if (platform === 'ios') {
                appVersion = readFileSync('app/App_Resources/iOS/Info.plist', 'utf8').match(
                    /<key>CFBundleShortVersionString<\/key>[\s\n]*<string>(.*?)<\/string>/
                )[1];
                buildNumber = readFileSync('app/App_Resources/iOS/Info.plist', 'utf8').match(
                    /<key>CFBundleVersion<\/key>[\s\n]*<string>([0-9]*)<\/string>/
                )[1];
            }
            console.log('appVersion', appVersion, buildNumber);

            config.plugins.push(
                new SentryCliPlugin({
                    release: appVersion,
                    urlPrefix: 'app:///',
                    rewrite: true,
                    dist: `${buildNumber}.${platform}`,
                    ignore: ['tns-java-classes', 'hot-update'],
                    include: [dist, join(dist, process.env.SOURCEMAP_REL_DIR)]
                })
            );
        } else {
            config.plugins.push(
                new webpack.SourceMapDevToolPlugin(
                    mergeOptions(
                        {
                            noSources: true
                            //  fileContext:params.sourceMapPublicPath
                            // publicPath: params.sourceMapPublicPath || '~/',
                            // fileContext:sourceMapsDist,
                            // noSources:true,
                            // moduleFilenameTemplate: info => {
                            //     let filePath = info.identifier;
                            //     console.log( 'filePath', filePath);
                            //     if (filePath.startsWith('./')) {
                            //         filePath = './app' + filePath.slice(1);
                            //     }
                            //     // if (filePath.startsWith('file:///')) {
                            //     //     filePath = './app' + filePath.slice(1);
                            //     // }
                            //     return filePath.replace('file:///', '');
                            // }
                        },
                        params.sourceMapPlugin || {}
                    )
                )
            );
        }
    }

    if (unitTesting) {
        config.module.rules.push(
            {
                test: /-page\.js$/,
                use: 'nativescript-dev-webpack/script-hot-loader'
            },
            {
                test: /\.(html|xml)$/,
                exclude: /assets\/styles/,
                use: 'nativescript-dev-webpack/markup-hot-loader'
            },

            { test: /\.(html|xml)$/, exclude: /assets\/styles/, use: 'nativescript-dev-webpack/xml-namespace-loader' }
        );
    }

    if (!!report) {
        // Generate report files for bundles content
        config.plugins.push(
            new BundleAnalyzerPlugin({
                analyzerMode: 'static',
                openAnalyzer: false,
                reportFilename: resolve(projectRoot, 'report', 'report.html')
            })
        );
    }

    if (!!snapshot) {
        const options = mergeOptions(
            {
                chunk: 'vendor',
                requireModules: ['tns-core-modules/bundle-entry-points'],
                projectRoot,
                // targetArchs: params.targetArchs || ['arm'],
                snapshotInDocker,
                skipSnapshotTools,
                useLibs
            },
            params.snapshotPlugin
        );
        config.plugins.push(new nsWebpack.NativeScriptSnapshotPlugin(Object.assign(options, { webpackConfig: config })));
    }

    if (!!hmr) {
        config.plugins.push(new webpack.HotModuleReplacementPlugin());
    }

    // if (!!production) {
    //     config.plugins.push(
    //         new ForkTsCheckerWebpackPlugin({
    //             tsconfig: resolve(tsconfig),
    //             async: false,
    //             useTypescriptIncrementalApi: true,
    //             checkSyntacticErrors: true,
    //             memoryLimit: 4096
    //             // workers: 1
    //         })
    //     );
    // }

    return config;
};
