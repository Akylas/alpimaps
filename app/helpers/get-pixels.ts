import * as https from '@nativescript-community/https';
const ndarray = require('ndarray');

export default async function getPixels(uri: string, cb) {
    console.log('getPixels', uri);
    const res = await https.request({
        method: 'GET',
        url: uri,
        useLegacy: true
    });
    const array = await (res.content as https.HttpsResponseLegacy).toArrayBufferAsync();
    cb(null, ndarray(new Uint8Array(array), [512, 512, 4], [4, 4 * 512, 1], 0));
}
