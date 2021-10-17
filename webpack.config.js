const webpack = require('@nativescript/webpack');
module.exports = (env) => {
    webpack.init(env);
    webpack.chainWebpack((config, env) => {
        // config.module
        //     .rule('ts')
        //     .clear()
        //     .use('esbuild-loader')
        //     .loader('esbuild-loader')
        //     .options({
        //         loader: 'tsx'
        //     })
        //     .end();
        config.when(env.production, (config) => {
            config.module
                .rule('svelte')
                .use('string-replace-loader')
                .loader('string-replace-loader')
                .before('svelte-loader')
                .options({
                    search: 'createElementNS\\("https:\\/\\/svelte\\.dev\\/docs#svelte_options"',
                    replace: 'createElementNS(svN',
                    flags: 'gm'
                })
                .end();
        });

        return config;
    });
    // return webpack.resolveChainableConfig();
    return webpack.resolveConfig();
};
