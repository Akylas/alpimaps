const sveltePreprocess = require('svelte-preprocess');
const svelteNativePreprocessor = require('svelte-native-preprocessor');

module.exports = {
    compilerOptions: {
        namespace: 'foreign'
    },
    preprocess: [
        svelteNativePreprocessor(),
        sveltePreprocess({
            defaults: { script: 'typescript', style: 'scss' },
            sourceMap: false
        })
    ]
};
