import { request } from '@nativescript-community/https';
import { File, knownFolders, path } from '@nativescript/core';

// Stellarium's own repository: the files are small (~30 KB) and fetched once, on the first figure that needs one.
const BASE_URL = 'https://raw.githubusercontent.com/Stellarium/stellarium/master/skycultures/modern/illustrations/';

const pending = new Map<string, Promise<string>>();

async function fetchArt(file: string) {
    const target = path.join(knownFolders.documents().getFolder('stellarium').path, file);
    if (!File.exists(target)) {
        // Through a temporary name: a download cut short would otherwise be a broken image for good.
        const partial = `${target}.part`;
        const response = await request({ url: BASE_URL + file, method: 'GET' });
        if (Math.round(response.statusCode / 100) !== 2) {
            throw new Error(`constellation art ${file}: HTTP ${response.statusCode}`);
        }
        // Copied rather than renamed: renameSync takes a name on iOS but a path on Android.
        const downloaded = await response.content.toFile(partial);
        File.fromPath(target).writeSync(downloaded.readSync());
        downloaded.removeSync();
    }
    return `file://${target}`;
}

/** Drops a kept file that turned out not to be an image, e.g. a captive portal's page: the next call downloads it again. */
export function forgetConstellationArt(file: string) {
    pending.delete(file);
    const target = path.join(knownFolders.documents().getFolder('stellarium').path, file);
    if (File.exists(target)) {
        File.fromPath(target).removeSync();
    }
}

/** A `file://` URL of a figure's artwork, downloaded on first use and kept. Rejects when offline; the next call retries. */
export function constellationArtUrl(file: string) {
    let result = pending.get(file);
    if (!result) {
        result = fetchArt(file);
        pending.set(file, result);
        result.catch(() => pending.delete(file));
    }
    return result;
}
