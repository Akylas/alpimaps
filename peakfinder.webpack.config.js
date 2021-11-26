const { resolve } = require('path');
const { DefinePlugin } = require('webpack');
const TerserPlugin = require('terser-webpack-plugin');
const esbuild = require('esbuild');
const MiniCssExtractPlugin = require('mini-css-extract-plugin');
const HtmlWebpackPlugin = require('html-webpack-plugin');

module.exports = (env, params = {}) => {
    Object.keys(env).forEach((k) => {
        if (env[k] === 'false' || env[k] === '0') {
            env[k] = false;
        } else if (env[k] === 'true' || env[k] === '1') {
            env[k] = true;
        }
    });
    const {
        production, // --env.production
        noconsole = true // --env.noconsole
    } = env;
    const mode = production ? 'production' : 'development';
    const platform = env && ((env.android && 'android') || (env.ios && 'ios'));

    return {
        entry: [resolve(__dirname, 'peakfinder/app.css'), resolve(__dirname, 'geo-three/webapp/app.ts')],
        devtool: false,
        target: 'web',
        mode,
        optimization: {
            usedExports: true,
            minimizer: [
                new TerserPlugin({
                    parallel: true,
                    terserOptions: {
                        ecma: 2019,
                        module: false,
                        toplevel: false,
                        keep_classnames: false,
                        keep_fnames: false,
                        compress: {
                            sequences: platform !== 'android',
                            passes: 2,
                            drop_console: production && noconsole
                        }
                    }
                })
            ]
        },
        resolve: {
            exportsFields: [],
            modules: [resolve(__dirname, 'node_modules'), resolve(__dirname, 'geo-three', 'node_modules')],
            mainFields: ['browser', 'module', 'main'],
            extensions: ['.css', '.ts', '.js', '.json'],
            alias: {
                './LocalHeightProvider': resolve(__dirname, 'peakfinder/LocalHeightProvider'),
                './TestMapProvider': resolve(__dirname, 'peakfinder/RasterMapProvider')
            }
        },
        plugins: [
            new DefinePlugin({
                FORCE_MOBILE: true,
                EXTERNAL_APP: true
            }),
            new HtmlWebpackPlugin({
                templateContent: `<html><body>
                <video id="video" autoplay playsinline></video>
                <canvas id="canvas" class="canvas"></canvas>
                <canvas id="canvas4" class="canvas"></canvas>
                <div id="compass" onclick="webapp.stopEventPropagation(event);webapp.setAzimuth(0)">
                    <div id="compass_slice"></div>
                </div>
                <div id="camera_button" onclick="webapp.stopEventPropagation(event);webapp.toggleCamera()" style="visibility:hidden;">
                </button></body></html>
                `,
                meta: {
                    viewport: 'width=device-width, initial-scale=1, maximum-scale=1.0, user-scalable=no'
                },
                minify: {
                    collapseWhitespace: true,
                    keepClosingSlash: true,
                    removeComments: true,
                    removeRedundantAttributes: true,
                    removeScriptTypeAttributes: true,
                    removeStyleLinkTypeAttributes: true,
                    useShortDoctype: true,
                    minifyCSS: true
                }
            }),
            new MiniCssExtractPlugin()
        ],
        output: {
            pathinfo: false,
            path: resolve(__dirname, 'app/assets/peakfinder'),
            // libraryTarget: 'commonjs',
            library: {
                name: 'webapp',
                type: 'global'
            },
            filename: 'webapp.js'
            // globalObject: 'global'
        },
        performance: {
            hints: false
        },
        module: {
            rules: [
                {
                    test: /\.svg$/,
                    type: 'asset/inline'
                },
                {
                    test: /\.css$/,
                    use: [
                        MiniCssExtractPlugin.loader,
                        {
                            loader: 'css-loader',
                            options: {
                                url: true
                            }
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
                        }
                    ]
                },
                {
                    test: /\.ts$/,
                    loader: 'ts-loader',
                    options: {
                        transpileOnly: true,
                        allowTsInNodeModules: true,
                        configFile: resolve(__dirname, 'tsconfig.peakfinder.json'),
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
                        target: 'es2019',
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
    };
};
