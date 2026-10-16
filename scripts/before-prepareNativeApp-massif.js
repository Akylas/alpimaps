const { execFileSync } = require('child_process');
const fs = require('fs');
const path = require('path');

const MASSIF_IOS_DEV = process.env['MASSIF_SDK_DIR'] || process.env['MASSIF_SDK_HOME'] || '/Volumes/dev/massif/massif-sdk';

// DEBUGMASSIF=1 on Catalyst: rebuild the SDK from source (incremental) before the app links it
module.exports = function ($logger, projectData, injector, hookArgs) {
    if (!process.env['DEBUGMASSIF'] || process.env['CI']) {
        return;
    }
    // Not platformData.normalizedPlatformName: the CLI reports Catalyst as "iOS", so that check never matched
    const requested = hookArgs && hookArgs.prepareData && hookArgs.prepareData.platform;
    const projectRoot = hookArgs && hookArgs.platformData && hookArgs.platformData.projectRoot;
    const isCatalyst = String(requested || '').toLowerCase() === 'catalyst' || (!!projectRoot && path.basename(projectRoot) === 'catalyst');
    if (!isCatalyst) {
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
