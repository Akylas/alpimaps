const fs = require('fs');
const nodePath = require('path');
const readdirp = require('readdirp');

readdirp('node_modules', { fileFilter: '*.aar', alwaysStat: true }).on('data', (entry) => {
    const {
        path,
        stats: { size }
    } = entry;
    if (
        !path.startsWith('@akylas/nativescript') &&
        !path.startsWith('@nativescript-community/ui-carto') &&
        !path.startsWith('@nativescript/core') &&
        !path.startsWith('@nativescript/android') &&
        path.indexOf('.pnpm') === -1
    ) {
        console.log(path);
        fs.unlinkSync(nodePath.join('node_modules', path));
    }
});
