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
    let webView: NativeViewElementNode<AWebView>;

    export let bearing;
    export let zoom;
    export let pitch;

    const mapContext = getMapContext();
    const hillshadeDatasource = packageService.hillshadeLayer?.dataSource;
    const vectorDataSource = packageService.localVectorTileLayer?.dataSource;
    const routeDataSource = mapContext.getLayers('routes')?.[0]?.layer.dataSource;

    const consoleEnabled = !PRODUCTION;

    let shown = false;
    function onNavigatedTo() {
        // called also on resume
        if (shown) {
            return;
        }
        shown = true;
        if (webView) {
            const devMode = getMapContext().mapModule('customLayers').devMode;
            webView.nativeView.src = `http://127.0.0.1/3dmap/index.html?zoom=${zoom}&bearing=${bearing}&pitch=${pitch}&position=${position.lat},${position.lon}&lang=${lang}&hideAttribution=${devMode}`;
        }
    }

    function createCustomWebViewClient(webview: AWebView, webClientClass) {
        const originalClient = new webClientClass(webview);
        const vDataSource = vectorDataSource?.getNative();

        const client = new (akylas as any).alpi.maps.WebViewClient(originalClient, hillshadeDatasource?.getNative(), vDataSource, vDataSource, null, routeDataSource?.getNative());

        client.registerLocalResource('http://127.0.0.1/sprite@2x.json', path.join(knownFolders.currentApp().path, 'assets/3dmap/sprite@2x.json'));
        client.registerLocalResource('http://127.0.0.1/sprite@2x.png', path.join(knownFolders.currentApp().path, 'assets/3dmap/sprite@2x.png'));
        client.registerLocalResource('http://127.0.0.1/3dmap', path.join(knownFolders.currentApp().path, 'assets/3dmap'));
        // this crashes in production saying no originalClient property ...
        // client.originalClient = originalClient;
        return client;
    }

</script>

<page actionBarHidden={true} on:navigatedTo={onNavigatedTo}>
    <gridlayout>
        <awebview bind:this={webView} createWebViewClient={createCustomWebViewClient} displayZoomControls={false} normalizeUrls={false} webConsoleEnabled={consoleEnabled} />
    </gridlayout>
</page>
