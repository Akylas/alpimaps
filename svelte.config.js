const sveltePreprocess = require('svelte-preprocess');
const svelteNativePreprocessor = require('svelte-native-preprocessor');
const { transformSync } = require('@swc/core');
const { typescript } = require('svelte-preprocess-esbuild');
// import { transformSync } from '@swc/core';

module.exports = {
    compilerOptions: {
        namespace: 'foreign'
    },
    preprocess: [
        typescript({
            target: 'es2019'
        }),
        sveltePreprocess({
            typescript: false
        })
        // sveltePreprocess({
        //     typescript: {
        //         compilerOptions: {
        //             target: 'es2017'
        //         }
        //     }
        // }),
        // svelteNativePreprocessor()
    ]
};
