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

    export let position;
    export let terrarium: boolean = false;
    export let dataSource: TileDataSource<any, any>;
    export let vectorDataSource: MBTilesTileDataSource | MergedMBVTTileDataSource<any, any>;
    let webView: NativeViewElementNode<WebViewExt>;
    let page: NativeViewElementNode<Page>;
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
    }, 60);
    $: {
        updateElevation(currentAltitude);
    }
    function  refresh() {
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

        // webview.on("gotMessage", (msg) => {
        //     console.log(`webview.gotMessage: ${JSON.stringify(msg.data)} (${typeof msg})`);
        // });
    }
    console.log('PeakFinder view');

    onMount(()=>{
        // console.log('onMount', vectorDataSource, dataSource);
        try {
            webserver = new (akylas.alpi as any).maps.WebServer(8080, dataSource.getNative(), (vectorDataSource || getDefaultDataSource()).getNative());
            webserver.start();
        } catch (err) {
            console.error(err);
        }
    })
    onDestroy(()=>{
        if (webserver) {
            webserver.stop();
        }
    })
</script>

<frame backgroundColor="transparent">
    <page bind:this={page} actionBarHidden={true}>
        <gridLayout>
            <button text="mdi-refresh" class="mdi" verticalAlignment="top" horizontalAlignment="right" on:tap={refresh} />
            <webviewext  bind:this={webView} on:loaded={webviewLoaded} displayZoomControls={false} backgroundColor="#ffffff" />
            <slider verticalAlignment="bottom" bind:value={currentAltitude} minValue="0" maxValue="8000" />
        </gridLayout>
    </page>
</frame>
