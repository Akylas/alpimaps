const origin = require('./nativescript.config');
module.exports = {
    ...origin,
    profiling: 'timeline',
    forceLog: true,
    android: {
        maxLogcatObjectSize: 4096,
        forceLog: true
    }
};
