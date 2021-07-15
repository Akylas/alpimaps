const sveltePreprocess = require('svelte-preprocess');
const svelteNativePreprocessor = require('svelte-native-preprocessor');

module.exports = {
    compilerOptions: {
        namespace: 'foreign',
        accessors: true
    },
    preprocess: [
        sveltePreprocess({
            defaults: { script: 'typescript', style: 'scss' },
            sourceMap: false
        }),
        svelteNativePreprocessor()
    ]
};
