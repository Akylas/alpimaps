const preprocess = require('svelte-preprocess');
// const svelteNativePreprocessor = require('svelte-native-preprocessor');
const { transformSync } = require('@swc/core');
const { typescript } = require('svelte-preprocess-esbuild');
// import preprocess from 'svelte-preprocess';

module.exports = {
    // preprocess: [
    //     typescript({
    //         target: 'es2019'
    //     }),
    //     preprocess({
    //       // avoid double
    //       typescript: false
    //     })
    //   ],
    compilerOptions: {
        namespace: 'foreign'
    },
    preprocess: [
        preprocess({
            typescript: {
                compilerOptions: {
                    target: 'es2019'
                }
            }
        })
        // svelteNativePreprocessor()
    ],
    // preprocess: [
    //     preprocess({
    //         typescript({ content }) {
    //             // use SWC to transpile TS scripts in Svelte files
    //             const { code } = transformSync(content, {
    //                 jsc: {
    //                     target: 'es2019',
    //                     parser: { syntax: 'typescript' }
    //                 }
    //             });
    //             return { code };
    //         }
    //     })
    //     // svelteNativePreprocessor()
    // ]
};
