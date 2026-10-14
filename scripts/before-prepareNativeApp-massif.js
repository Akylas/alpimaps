const { execFileSync } = require('child_process');
const fs = require('fs');
const path = require('path');

const MASSIF_IOS_DEV = process.env['MASSIF_SDK_DIR'] || '/Volumes/dev/carto/mobile-sdk';

// DEBUGMASSIF=1 on Catalyst: rebuild the SDK from source (incremental) before the app links it
module.exports = function ($logger, projectData, injector, hookArgs) {
    if (!process.env['DEBUGMASSIF'] || process.env['CI']) {
        return;
    }
    const platformName = String(
        (hookArgs && hookArgs.platformData && hookArgs.platformData.normalizedPlatformName) || (hookArgs && hookArgs.checkForChangesOpts && hookArgs.checkForChangesOpts.platform) || ''
    ).toLowerCase();
    if (platformName !== 'catalyst') {
        return;
    }
    $logger.info('DEBUGMASSIF: building the SDK for Mac Catalyst');
    const output = execFileSync(path.join(MASSIF_IOS_DEV, 'scripts/ios-dev/build-plugin-catalyst.sh'), { encoding: 'utf8' });
    $logger.info(output);
    if (output.includes('Up to date')) {
        return;
    }
    // ns only rebuilds the app when its own inputs changed: forget the last build so the new lib gets linked
    const buildDir = path.join(projectData.platformsDir, 'catalyst', 'build');
    if (fs.existsSync(buildDir)) {
        for (const dir of fs.readdirSync(buildDir)) {
            fs.rmSync(path.join(buildDir, dir, '.nsbuildinfo'), { force: true });
        }
    }
};
