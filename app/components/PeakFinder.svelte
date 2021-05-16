<script lang="ts">
    import { MBTilesTileDataSource } from '@nativescript-community/ui-carto/datasources/mbtiles';
    import { LoadFinishedEventData, ShouldOverrideUrlLoadEventData, WebViewExt } from '@nota/nativescript-webview-ext';
    import { Folder, LoadEventData, WebView, knownFolders, path, Page } from '@nativescript/core';
    import { MapTilerOnlineTileDataSource } from '@nativescript-community/ui-carto/datasources/maptiler';
    import { PersistentCacheTileDataSource } from '@nativescript-community/ui-carto/datasources/cache';

    import { MergedMBVTTileDataSource, TileDataSource } from '@nativescript-community/ui-carto/datasources';
    import { debounce } from 'push-it-to-the-limit';
    import { NativeViewElementNode } from 'svelte-native/dom';
    import { onDestroy, onMount } from 'svelte';
    import { Drawer } from '@nativescript-community/ui-drawer';
    import { request } from '@nativescript-community/perms';
    import { showError } from '~/utils/error';

    export let position;
    export let terrarium: boolean = false;
    export let dataSource: TileDataSource<any, any>;
    export let vectorDataSource: MBTilesTileDataSource | MergedMBVTTileDataSource<any, any>;
    let webView: NativeViewElementNode<WebViewExt>;
    let page: NativeViewElementNode<Page>;
    let drawer: NativeViewElementNode<Drawer>;
    let webserver;

    function getDefaultDataSource() {
        const cacheFolder = Folder.fromPath(path.join(knownFolders.documents().path, 'carto_cache'));
        const dataSource = new PersistentCacheTileDataSource({
            dataSource: new MapTilerOnlineTileDataSource({ key: 'V7KGiDaKQBCWTYsgsmxh' }),
            capacity: 300 * 1024 * 1024,
            databasePath: path.join(cacheFolder.path, 'cache.db')
        });
        return dataSource;
    }

    let currentAltitude;
    $: {
        currentAltitude = position.altitude + 1200;
    }

    const updateElevation = debounce(function (elevation) {
        if (!webView) {
            return;
        }
        webView.nativeView.executeJavaScript(`webapp.setElevation(${elevation})`);
    }, 10);
    $: {
        updateElevation(currentAltitude);
    }
    function refresh() {
        webView.nativeView.reload();
    }

    function webviewLoaded(args: LoadEventData) {
        const webview = args.object as WebViewExt;

        webview.src = '~/assets/webapp.html';
        // webview.src = "~/assets/index.html";

        // webview.on(WebViewExt.shouldOverrideUrlLoadingEvent, (args: ShouldOverrideUrlLoadEventData) => {
        //     console.log(`${args.httpMethod} ${args.url}`);
        //     if (args.url.includes("google.com")) {
        //         args.cancel = true;
        //     }
        // });

        webview.on(WebViewExt.loadFinishedEvent, (args: LoadFinishedEventData) => {
            args.object.executeJavaScript(`webapp.setTerrarium(${terrarium});webapp.setPosition(${JSON.stringify({ ...position, altitude: currentAltitude })})`);
        });

        // webview.on(WebViewExt.requestPermissionsEvent, (args: RequestPermissionsEventData) => {
        //     const wantedPerssions = args.permissions
        //         .map((p) => {
        //             if (p === 'RECORD_AUDIO') {
        //                 return android.Manifest.permission.RECORD_AUDIO;
        //             }

        //             if (p === 'CAMERA') {
        //                 return android.Manifest.permission.CAMERA;
        //             }

        //             return p;
        //         })
        //         .filter((p) => !!p);

        //     permissions
        //         .requestPermissions(wantedPerssions)
        //         .then(() => args.callback(true))
        //         .catch(() => args.callback(false));
        // });

        // webview.on("gotMessage", (msg) => {
        //     console.log(`webview.gotMessage: ${JSON.stringify(msg.data)} (${typeof msg})`);
        // });
    }

    onMount(() => {
        // console.log('onMount', vectorDataSource, dataSource);
        try {
            webserver = new (akylas.alpi as any).maps.WebServer(8080, dataSource.getNative(), (vectorDataSource || getDefaultDataSource()).getNative());
            webserver.start();
        } catch (err) {
            console.error(err);
        }
    });
    onDestroy(() => {
        if (webserver) {
            webserver.stop();
        }
    });

    function callJSFunction(method: string) {
        if (!webView) {
            return;
        }
        try {
            webView.nativeView.executeJavaScript(`webapp.${method}()`);
        } catch (err) {
            showError(err);
        }
    }

    async function toggleCamera() {
        try {
            console.log('toggleCamera');

            const res = await request('camera');
            console.log('request', res);
            if (res[0] === 'authorized') {
                callJSFunction('toggleCamera');
            }
        } catch (err) {
            showError(err);
        }
    }

</script>

<frame backgroundColor="transparent">
    <page bind:this={page} actionBarHidden={true}>
        <drawer bind:this={drawer}>
            <gridLayout>
                <webviewext bind:this={webView} on:loaded={webviewLoaded} displayZoomControls={false} backgroundColor="#ffffff" />
                <button marginTop="20" text="mdi-camera" variant="text" class="mdi" verticalAlignment="top" horizontalAlignment="right" on:tap={toggleCamera} />
                <slider verticalAlignment="bottom" bind:value={currentAltitude} minValue="0" maxValue="8000" />
            </gridLayout>
            <stacklayout prop:rightDrawer width="60%">
                <button text="mdi-refresh" variant="text" class="mdi" horizontalAlignment="right" on:tap={refresh} />
                <button text="dark mode" class="mdi" on:tap={() => callJSFunction('toggleDarkMode')} />
                <button text="debug features" class="mdi" on:tap={() => callJSFunction('toggleDebugFeaturePoints')} />
                <button text="draw lines" class="mdi" on:tap={() => callJSFunction('toggleDrawLines')} />
                <button text="read features" class="mdi" on:tap={() => callJSFunction('toggleReadFeatures')} />
                <button text="debugGPUPicking" class="mdi" on:tap={() => callJSFunction('toggleDebugGPUPicking')} />
            </stacklayout>
        </drawer>
    </page>
</frame>
