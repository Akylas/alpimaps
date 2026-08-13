import { ApplicationSettings } from '@nativescript/core';
import { derived, get, writable } from 'svelte/store';
import { lc } from '~/helpers/locale';
import { mapCapabilities } from '~/mapModules/CustomLayersModule';
import { registerMapFeature } from '~/mapModules/mapFeatures';
import { packageService } from '~/services/PackageService';
import { DEFAULT_TILE_SERVER_AUTO_START, DEFAULT_TILE_SERVER_PORT, SETTINGS_TILE_SERVER_AUTO_START, SETTINGS_TILE_SERVER_PORT } from '~/utils/constants';
import { copyTextToClipboard } from '~/utils/ui';

/**
 * Serves the offline tiles over http so a desktop map tool can render the same data. Android only:
 * the native WebServer lives in the android sources.
 */
let webserver;

/** Drives the menu entry's label, which flips between start and stop. */
const running = writable(false);

function serverPort() {
    return ApplicationSettings.getNumber(SETTINGS_TILE_SERVER_PORT, DEFAULT_TILE_SERVER_PORT);
}

export function startStopWebServer() {
    if (webserver) {
        webserver.stop();
        webserver = null;
        running.set(false);
        return;
    }
    try {
        const hillshadeDatasource = packageService.hillshadeLayer?.dataSource;
        const vectorDataSource = packageService.localVectorTileLayer?.dataSource;
        const vDataSource = vectorDataSource.getNative();
        DEV_LOG && console.log('webserver', vDataSource, hillshadeDatasource?.getNative());
        webserver = new (akylas.alpi as any).maps.WebServer(serverPort(), hillshadeDatasource?.getNative(), vDataSource, vDataSource, null);
        webserver.start();
        running.set(true);
    } catch (error) {
        console.error(error);
    }
}

/** Called by the map once its layers are ready — there is nothing to serve before that. */
export function startWebServerIfWanted() {
    if (ApplicationSettings.getBoolean(SETTINGS_TILE_SERVER_AUTO_START, DEFAULT_TILE_SERVER_AUTO_START)) {
        startStopWebServer();
    }
}

export function stopWebServer() {
    if (webserver) {
        webserver.stop();
        webserver = null;
        running.set(false);
    }
}

registerMapFeature({
    id: 'tileServer',
    enabled: () => __ANDROID__,
    // mapCapabilities is a dependency because localVectorTileLayer is assigned by the same mbtiles
    // load that sets hasLocalData: without it this would keep the value it had when the server was
    // last toggled, and the entry would stay missing after offline data finished loading
    menuItems: derived([running, mapCapabilities], ([$running]) =>
        // no local vector tiles means nothing worth serving
        packageService.localVectorTileLayer
            ? [
                  {
                      id: 'web_server',
                      title: $running ? lc('stop_tile_server') : lc('start_tile_server'),
                      icon: 'mdi-server',
                      order: 100,
                      run: startStopWebServer,
                      // the tile url is only useful pasted into something else
                      onLongPress: () => copyTextToClipboard(`http://127.0.0.1:${serverPort()}?source=data&x={x}&y={y}&z={z}`)
                  }
              ]
            : []
    )
});

export { running as tileServerRunning };
