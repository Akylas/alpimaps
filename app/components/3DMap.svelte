<script lang="ts">
    import { AWebView } from '@nativescript-community/ui-webview';
    import { LoadEventData, Page } from '@nativescript/core';
    import type { Feature } from 'geojson';
    import { debounce } from 'push-it-to-the-limit';
    import { NativeViewElementNode } from 'svelte-native/dom';

    export let position;
    // export let terrarium: boolean = false;
    // export let dataSource: TileDataSource<any, any>;
    // export let vectorDataSource: MBTilesTileDataSource | MergedMBVTTileDataSource<any, any>;
    // export let rasterDataSource: TileDataSource<any, any>;
    let webView: NativeViewElementNode<AWebView>;
    let page: NativeViewElementNode<Page>;
    // let webserver;
    let selectedItem: Feature & { distance: number } = null;

    const now = new Date();
    let currentAltitude;
    const consoleEnabled = !PRODUCTION;

    const updateElevation = debounce(function (elevation) {
        if (!webView) {
            return;
        }
        // callJSFunction(`setElevation`, elevation);
    }, 10);
    function refresh() {
        webView.nativeView.reload();
    }
    let shown = false;
    function onNavigatedTo() {
        // called also on resume
        if (shown) {
            return;
        }
        shown = true;
        if (webView) {
            webView.nativeView.src = '~/assets/3dterrain/index.html';
        }
    }

    function webviewLoaded(args: LoadEventData) {
        const webview = args.object as AWebView;
        // webview.registerLocalResource('https://api.maptiler.com/maps/topo/sprite@2x.json', '~/assets/3dterrain/sprite@2x.json')
        // webview.registerLocalResource('https://api.maptiler.com/maps/topo/sprite@2x.png', '~/assets/3dterrain/sprite@2x.png')
        // webview.once('layoutChanged', () => {
        // webview.src = '~/assets/webapp.html';
        // });

        // webview.once(AWebView.loadFinishedEvent, (args: LoadFinishedEventData) => {
        //     args.object.executeJavaScript(`webapp.setTerrarium(${terrarium});webapp.setPosition(${JSON.stringify({ ...position, altitude: currentAltitude })})`);
        // });
    }

    // onMount(() => {
    // console.log('onMount', !!vectorDataSource, !!dataSource, !!rasterDataSource);
    // try {
    // const vDataSource = vectorDataSource.getNative();
    // webserver = new (akylas.alpi as any).maps.WebServer(8080, dataSource.getNative(), vDataSource, rasterDataSource?.getNative(), vDataSource);
    // webserver.start();
    // } catch (err) {
    // console.error(err);
    // }
    // });
    // onDestroy(() => {
    // if (webserver) {
    // webserver.stop();
    // }
    // });

    $: currentAltitude = position.altitude + 10;
    $: updateElevation(currentAltitude);
</script>

<page bind:this={page} actionBarHidden={true} on:navigatedTo={onNavigatedTo}>
    <gridlayout>
        <awebview bind:this={webView} on:loaded={webviewLoaded} webConsoleEnabled={consoleEnabled} displayZoomControls={false} normalizeUrls={false} />
    </gridlayout>
</page>
