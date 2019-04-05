const { relative, resolve, sep } = require('path');

const webpack = require('webpack');
const CleanWebpackPlugin = require('clean-webpack-plugin');
const CopyWebpackPlugin = require('copy-webpack-plugin');
const { BundleAnalyzerPlugin } = require('webpack-bundle-analyzer');
const TerserPlugin = require('terser-webpack-plugin');

const VueLoaderPlugin = require('vue-loader/lib/plugin');

const NsVueTemplateCompiler = require('akylas-nativescript-vue-template-compiler');
NsVueTemplateCompiler.registerElement('MDTextField', () => require('~/nativescript-material-textfield').TextField, {
    model: {
        prop: 'text',
        event: 'textChange'
    }
});

const nsWebpack = require('nativescript-dev-webpack');
const nativescriptTarget = require('nativescript-dev-webpack/nativescript-target');
const { NativeScriptWorkerPlugin } = require('nativescript-worker-loader/NativeScriptWorkerPlugin');
const ForkTsCheckerWebpackPlugin = require('fork-ts-checker-webpack-plugin');

module.exports = env => {
    // Add your custom Activities, Services and other android app components here.
    const appComponents = [
        'tns-core-modules/ui/frame',
        'tns-core-modules/ui/frame/activity',
        resolve(__dirname, 'app/services/android/BgService.ts'),
        resolve(__dirname, 'app/services/android/BgServiceBinder.ts')
    ];
    console.log('appComponents', appComponents);

    const platform = env && ((env.android && 'android') || (env.ios && 'ios'));
    if (!platform) {
        throw new Error('You need to provide a target platform!');
    }

    const platforms = ['ios', 'android'];
    const projectRoot = __dirname;

    const tsconfig = platform === 'android' ? 'tsconfig.android.json' : 'tsconfig.json';

    // Default destination inside platforms/<platform>/...
    const dist = resolve(projectRoot, nsWebpack.getAppPath(platform, projectRoot));
    const appResourcesPlatformDir = platform === 'android' ? 'Android' : 'iOS';

    const {
        // The 'appPath' and 'appResourcesPath' values are fetched from
        // the nsconfig.json configuration file
        // when bundling with `tns run android|ios --bundle`.
        appPath = 'app',
        appResourcesPath = 'app/App_Resources',

        // You can provide the following flags when running 'tns run android|ios'
        snapshot, // --env.snapshot
        uglify, // --env.uglify
        production, // --env.production
        report, // --env.report
        sourceMap, // --env.sourceMap
        hmr, // --env.hmr
        unitTesting // --env.unitTesting
    } = env;

    const externals = nsWebpack.getConvertedExternals(env.externals);

    const mode = production ? 'production' : 'development';

    const appFullPath = resolve(projectRoot, appPath);
    const appResourcesFullPath = resolve(projectRoot, appResourcesPath);

    const entryModule = nsWebpack.getEntryModule(appFullPath);
    const entryPath = `.${sep}${entryModule}`;
    const entries = { bundle: entryPath };
    if (platform === 'ios') {
        entries['tns_modules/tns-core-modules/inspector_modules'] = 'inspector_modules.js';
    }
    console.log(`Bundling application for entryPath ${entryPath}...`);

    const config = {
        mode: mode,
        context: appFullPath,
        // stats:'verbose',
        externals,
        watchOptions: {
            ignored: [
                appResourcesFullPath,
                // Don't watch hidden files
                '**/.*'
            ]
        },
        target: nativescriptTarget,
        entry: entries,
        output: {
            pathinfo: false,
            path: dist,
            libraryTarget: 'commonjs2',
            filename: '[name].js',
            globalObject: 'global'
        },
        resolve: {
            extensions: ['.vue', '.ts', '.tsx', '.js', '.scss', '.css'],
            // Resolve {N} system modules from tns-core-modules
            modules: [resolve(__dirname, 'node_modules/tns-core-modules'), resolve(__dirname, 'node_modules'), 'node_modules/tns-core-modules', 'node_modules'],
            alias: {
                '~': appFullPath,
                '@': appFullPath,
                vue: 'akylas-nativescript-vue',
                'nativescript-vue': 'akylas-nativescript-vue'
            },
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
            __dirname: false
        },
        devtool: sourceMap ? 'inline-source-map' : 'none',
        optimization: {
            runtimeChunk: 'single',
            splitChunks: {
                cacheGroups: {
                    vendor: {
                        name: 'vendor',
                        chunks: 'all',
                        test: module => {
                            const moduleName = module.nameForCondition ? module.nameForCondition() : '';
                            return /[\\/]node_modules[\\/]/.test(moduleName) || appComponents.some(comp => comp === moduleName);
                        },
                        enforce: true
                    }
                }
            },
            minimize: !!uglify,
            minimizer: [
                new TerserPlugin({
                    sourceMap: !!sourceMap,
                    parallel: true,
                    cache: true,
                    terserOptions: {
                        keep_fnames: true,
                        output: {
                            comments: false
                        },
                        compress: {
                            // The Android SBG has problems parsing the output
                            // when these options are enabled
                            collapse_vars: platform !== 'android',
                            sequences: platform !== 'android'
                        }
                        // safari10: platform === 'ios'
                    }
                })
            ]
        },
        module: {
            rules: [
                {
                    test: new RegExp(entryPath),
                    use: [
                        // Require all Android app components
                        platform === 'android' && {
                            loader: 'nativescript-dev-webpack/android-app-components-loader',
                            options: { modules: appComponents }
                        },

                        {
                            loader: 'nativescript-dev-webpack/bundle-config-loader',
                            options: {
                                registerPages: true, // applicable only for non-angular apps
                                loadCss: !snapshot, // load the application css if in debug mode
                                unitTesting,
                                appFullPath,
                                projectRoot
                            }
                        }
                    ].filter(loader => Boolean(loader))
                },
                {
                    test: /\.css$/,
                    use: [
                        'nativescript-dev-webpack/style-hot-loader',
                        'nativescript-dev-webpack/apply-css-loader.js',
                        {
                            loader: 'css-loader',
                            options: { url: false }
                        }
                    ]
                },
                {
                    test: /\.scss$/,
                    use: [
                        'nativescript-dev-webpack/style-hot-loader',
                        'nativescript-dev-webpack/apply-css-loader.js',
                        {
                            loader: 'css-loader',
                            options: { url: false }
                        },
                        'sass-loader'
                    ]
                },
                {
                    test: /\.tsx?$/,
                    exclude: /node_modules/,
                    loader: 'ts-loader',
                    options: {
                        transpileOnly: true,
                        configFile: resolve(tsconfig),
                        appendTsSuffixTo: [/\.vue$/],
                        allowTsInNodeModules: true // wanted?
                    }
                },
                {
                    test: /\.js$/,
                    loader: 'babel-loader'
                },
                {
                    test: /\.vue$/,
                    loader: 'vue-loader',
                    options: {
                        compiler: NsVueTemplateCompiler
                    }
                }
            ]
        },
        plugins: [
            //
            // ... Vue Loader plugin omitted
            // make sure to include the plugin!
            new VueLoaderPlugin(),
            // Define useful constants like TNS_WEBPACK
            new webpack.EnvironmentPlugin(
                Object.assign(
                    {
                        NODE_ENV: JSON.stringify(mode), // use 'development' unless process.env.NODE_ENV is defined
                        DEBUG: false
                    },
                    require('./API_KEYS').keys
                )
            ),
            new webpack.DefinePlugin({
                'global.TNS_WEBPACK': 'true',
                TNS_ENV: JSON.stringify(mode)
            }),
            // Remove all files from the out dir.
            new CleanWebpackPlugin({ cleanOnceBeforeBuildPatterns: [`${dist}/**/*`] }),
            // Copy native app resources to out dir.
            new CopyWebpackPlugin([
                {
                    from: `${appResourcesFullPath}/${appResourcesPlatformDir}`,
                    to: `${dist}/App_Resources/${appResourcesPlatformDir}`,
                    context: projectRoot
                }
            ]),
            // Copy assets to out dir. Add your own globs as needed.
            new CopyWebpackPlugin(
                [
                    { from: 'fonts/**' },
                    { from: '**/*.+(jpg|png)' },
                    { from: 'assets/**/*' },
                    { from: '../node_modules/@mdi/font/fonts/materialdesignicons-webfont.ttf', to: 'fonts' },
                    { from: '../node_modules/@mdi/font/css/materialdesignicons.min.css', to: 'assets' }
                ],
                {
                    ignore: [`${relative(appPath, appResourcesFullPath)}/**`]
                }
            ),
            // Generate a bundle starter script and activate it in package.json
            new nsWebpack.GenerateBundleStarterPlugin( // Don't include `runtime.js` when creating a snapshot. The plugin
                // configures the WebPack runtime to be generated inside the snapshot
                // module and no `runtime.js` module exist.
                (snapshot ? [] : ['./runtime']).concat(['./vendor', './bundle'])
            ),
            // For instructions on how to set up workers with webpack
            // check out https://github.com/nativescript/worker-loader
            new NativeScriptWorkerPlugin(),
            new nsWebpack.PlatformFSPlugin({
                platform,
                platforms
            }),
            // Does IPC communication with the {N} CLI to notify events when running in watch mode.
            new nsWebpack.WatchStateLoggerPlugin()
        ]
    };

    if (!!production) {
        config.module.rules.push({
            test: /\.tsx?$/,
            enforce: 'pre',
            exclude: /node_modules/,
            use: [
                {
                    loader: 'webpack-strip-block',
                    options: {
                        start: 'DEV-START',
                        end: 'DEV-END'
                    }
                }
            ]
        });
        config.plugins.push(
            new ForkTsCheckerWebpackPlugin({
                tsconfig: resolve(tsconfig)
                // workers: 2
            })
        );
    }
    if (unitTesting) {
        config.module.rules.push(
            {
                test: /-page\.js$/,
                use: 'nativescript-dev-webpack/script-hot-loader'
            },
            {
                test: /\.(html|xml)$/,
                use: 'nativescript-dev-webpack/markup-hot-loader'
            },

            { test: /\.(html|xml)$/, use: 'nativescript-dev-webpack/xml-namespace-loader' }
        );
    }

    // Copy the native app resources to the out dir
    // only if doing a full build (tns run/build) and not previewing (tns preview)
    if (!externals || externals.length === 0) {
        config.plugins.push(
            new CopyWebpackPlugin([
                {
                    from: `${appResourcesFullPath}/${appResourcesPlatformDir}`,
                    to: `${dist}/App_Resources/${appResourcesPlatformDir}`,
                    context: projectRoot
                }
            ])
        );
    }

    if (!!report) {
        // Generate report files for bundles content
        config.plugins.push(
            new BundleAnalyzerPlugin({
                analyzerMode: 'static',
                openAnalyzer: false,
                generateStatsFile: true,
                reportFilename: resolve(projectRoot, 'report', `report.html`),
                statsFilename: resolve(projectRoot, 'report', `stats.json`)
            })
        );
    }

    if (!!snapshot) {
        config.plugins.push(
            new nsWebpack.NativeScriptSnapshotPlugin({
                chunk: 'vendor',
                requireModules: ['tns-core-modules/bundle-entry-points'],
                projectRoot,
                targetArchs: ['arm'],
                webpackConfig: config
            })
        );
    }

    if (!!hmr) {
        config.plugins.push(new webpack.HotModuleReplacementPlugin());
    }

    return config;
};
