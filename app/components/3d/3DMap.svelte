<script lang="ts">
    import { AWebView } from '@nativescript-community/ui-webview';
    import { LoadEventData, Page, knownFolders, path } from '@nativescript/core';
    import { debounce } from '@nativescript/core/utils';
    // import type { Feature } from 'geojson';
    import { NativeViewElementNode } from 'svelte-native/dom';
    import { lang } from '~/helpers/locale';
    import { getMapContext } from '~/mapModules/MapModule';
    import { packageService } from '~/services/PackageService';

    export let position;
    // export let terrarium: boolean = false;
    // export let dataSource: TileDataSource<any, any>;
    // export let vectorDataSource: MBTilesTileDataSource | MergedMBVTTileDataSource<any, any>;
    // export let rasterDataSource: TileDataSource<any, any>;
    let webView: NativeViewElementNode<AWebView>;
    let page: NativeViewElementNode<Page>;

    export let bearing;
    export let zoom;
    export let pitch;

    const mapContext = getMapContext();
    const hillshadeDatasource = packageService.hillshadeLayer?.dataSource;
    const vectorDataSource = packageService.localVectorTileLayer?.dataSource;
    // const contoursDataSource = mapContext.getLayers('routes')?.[0]?.layer.dataSource;
    const routeDataSource = mapContext.getLayers('routes')?.[0]?.layer.dataSource;
    // let webserver;
    // const selectedItem: Feature & { distance: number } = null;

    // const now = new Date();
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
            const devMode = getMapContext().mapModule('customLayers').devMode;
            webView.nativeView.src = `~/assets/3dmap/index.html?zoom=${zoom}&bearing=${bearing}&pitch=${pitch}&position=${position.lat},${position.lon}&lang=${lang}&hideAttribution=${devMode}`;
        }
    }

    function webviewLoaded(args: LoadEventData) {
        const webview = args.object as AWebView;
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

    function createCustomWebViewClient(webview: AWebView, webClientClass) {
        const originalClient = new webClientClass(webview);
        const vDataSource = vectorDataSource?.getNative();

        const client = new (akylas as any).alpi.maps.WebViewClient(originalClient, hillshadeDatasource?.getNative(), vDataSource, vDataSource, null, routeDataSource?.getNative());

        client.registerLocalResource('http://127.0.0.1/sprite@2x.json', path.join(knownFolders.currentApp().path, 'assets/3dmap/sprite@2x.json'));
        client.registerLocalResource('http://127.0.0.1/sprite@2x.png', path.join(knownFolders.currentApp().path, 'assets/3dmap/sprite@2x.png'));
        // this crashes in production saying no originalClient property ...
        // client.originalClient = originalClient;
        return client;
    }

    $: currentAltitude = position.altitude + 10;
    $: updateElevation(currentAltitude);
</script>

<page bind:this={page} actionBarHidden={true} on:navigatedTo={onNavigatedTo}>
    <gridlayout>
        <awebview bind:this={webView} createWebViewClient={createCustomWebViewClient} displayZoomControls={false} normalizeUrls={false} webConsoleEnabled={consoleEnabled} on:loaded={webviewLoaded} />
    </gridlayout>
</page>
