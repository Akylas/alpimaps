<script lang="ts">
    import { GeoJSONVectorTileDataSource } from '@nativescript-community/ui-carto/datasources';
    import { VectorTileLayer } from '@nativescript-community/ui-carto/layers/vector';
    import { CartoMap, PanningMode } from '@nativescript-community/ui-carto/ui';
    import { CollectionView } from '@nativescript-community/ui-collectionview';
    import { Page } from '@nativescript/core';
    import { openUrl } from '@nativescript/core/utils';
    import { goBack, navigate } from 'svelte-native';
    import { Template } from 'svelte-native/components';
    import { NativeViewElementNode } from 'svelte-native/dom';
    import CActionBar from '~/components/common/CActionBar.svelte';
    import { lc } from '~/helpers/locale';
    import { onThemeChanged } from '~/helpers/theme';
    import { getMapContext } from '~/mapModules/MapModule';
    import { onNetworkChanged } from '~/services/NetworkService';
    import { packageService } from '~/services/PackageService';
    import { MetroLineStop, TransitRoute, transitService } from '~/services/TransitService';
    import { NoNetworkError, showError } from '~/utils/error';
    import { colors, fonts, navigationBarHeight } from '~/variables';
    import IconButton from '../common/IconButton.svelte';
    $: ({ colorSurfaceContainer, colorBackground } = $colors);
    interface Item extends MetroLineStop {
        color: string;
        first: boolean;
        last: boolean;
    }
    let page: NativeViewElementNode<Page>;
    let collectionView: NativeViewElementNode<CollectionView>;
    export let line: TransitRoute;
    DEV_LOG && console.log('line', line);
    let loading = false;
    let dataItems: Item[] = null;
    let noNetworkAndNoData = false;
    const mapContext = getMapContext();
    const lineColor = line.color || transitService.defaultTransitLineColor;

    async function refresh() {
        try {
            if (!cartoMap) {
                return;
            }
            dataItems = (await transitService.getLineStops(line.id))
                .filter((i) => i.visible === true)
                .map((i, index, array) => ({ ...i, color: lineColor, first: index === 0, last: index === array.length - 1 }));

            const lineGeoJSON = await transitService.getTransitLines(line.id);
            const stopsGeoJSON = [];
            dataItems.forEach((i) => {
                stopsGeoJSON.push({ type: 'Feature', geometry: { type: 'Point', coordinates: [i.lon, i.lat] }, properties: { id: i.id, name: i.name, color: i.color } as any });
            });
            // lineGeoJSON = lineGeoJSON.replace('features":[{', `features":[${JSON.stringify(stopsGeoJSON).slice(1, -1)},{`);

            const transitVectorTileDataSource = new GeoJSONVectorTileDataSource({
                minZoom: 0,
                maxZoom: 24
            });
            transitVectorTileDataSource.createLayer('routes');
            const geometry = packageService.getGeoJSONReader().readFeatureCollection(lineGeoJSON);
            transitVectorTileDataSource.setLayerGeoJSONString(1, lineGeoJSON);

            const transitVectorTileLayer = new VectorTileLayer({
                dataSource: transitVectorTileDataSource,
                decoder: getMapContext().innerDecoder
            });

            transitVectorTileLayer.setVectorTileEventListener(this);
            cartoMap.addLayer(transitVectorTileLayer);
            cartoMap.moveToFitBounds(geometry.getBounds(), undefined, true, true, true, 0);
            noNetworkAndNoData = false;
        } catch (error) {
            if (error instanceof NoNetworkError && !dataItems) {
                noNetworkAndNoData = true;
            }
            showError(error);
        } finally {
            loading = false;
        }
    }
    // onMount(() => {
    //     focus();
    // });
    function onNavigatingTo(e) {
        refresh();
    }
    let cartoMap: CartoMap<LatLonKeys>;
    async function onMapReady(e) {
        cartoMap = e.object as CartoMap<LatLonKeys>;
        // projection = cartoMap.projection;
        // if (__ANDROID__) {
        //     console.log('onMapReady', com.carto.ui.BaseMapView.getSDKVersion());
        // } else {
        //     console.log('onMapReady', cartoMap.nativeViewProtected as NTMapView);
        // }

        const options = cartoMap.getOptions();
        options.setRestrictedPanning(true);
        options.setPanningMode(PanningMode.PANNING_MODE_STICKY_FINAL);

        options.setZoomGestures(true);
        options.setKineticRotation(false);
        // const route = dataItems.map(i=>([]))
        try {
            let layers = mapContext.getLayers('map');
            if (layers.length === 0) {
                layers = mapContext.getLayers('customLayers');
            }
            layers.forEach((l) => {
                const prototype = Object.getPrototypeOf(l.layer);
                cartoMap.addLayer(new prototype.constructor(l.layer.options));
            });
            refresh();
        } catch (err) {
            showError(err);
        }
    }

    onThemeChanged(() => collectionView?.nativeView.refreshVisibleItems());
    onNetworkChanged((connected) => {
        if (connected && noNetworkAndNoData) {
            refresh();
        }
    });

    async function downloadPDF() {
        try {
            openUrl(`https://data.mobilites-m.fr/api/planligne/pdf?route=${line.id.replace('_', ':')}`);
        } catch (error) {
            showError(error);
        }
    }

    async function showTimesheet() {
        try {
            const component = (await import('~/components/transit/TransitTimesheet.svelte')).default;
            navigate({
                page: component,
                props: {
                    line
                }
            });
        } catch (error) {
            showError(error);
        }
    }
    async function backToMapOnPoint(item: Item) {
        try {
            mapContext.selectItem({
                item: { geometry: { type: 'Point', coordinates: [item.lon, item.lat] }, properties: { id: item.id, name: item.name, color: item.color } },
                isFeatureInteresting: true,
                setSelected: false,
                peek: false,
                zoomDuration: 0
            });
            goBack({ to: mapContext.getMainPage() });
        } catch (error) {
            showError(error);
        }
    }
    async function selectStop(item: Item) {
        try {
            mapContext.selectItem({
                item: { geometry: { type: 'Point', coordinates: [item.lon, item.lat] }, properties: { id: item.id, name: item.name, color: item.color } },
                isFeatureInteresting: true,
                setSelected: false,
                peek: false,
                zoom: 15,
                zoomDuration: 0
            });
            cartoMap.setFocusPos(item, 200);
            cartoMap.setZoom(15, 200);
        } catch (error) {
            showError(error);
        }
    }
</script>

<page bind:this={page} actionBarHidden={true} on:navigatingTo={onNavigatingTo}>
    <gridlayout rows="auto,auto,*,2*">
        <label
            autoFontSize={true}
            fontSize={20}
            fontWeight="bold"
            maxFontSize={20}
            maxLines={3}
            padding="15 10 15 10"
            row={1}
            text={(line.longName || line.name)?.replace(' / ', '\n')}
            textAlignment="center"
            verticalTextAlignment="center"
            visibility={line.longName ? 'visible' : 'collapse'} />
        <cartomap row={2} useTextureView={false} zoom={16} on:mapReady={onMapReady} />
        <collectionview bind:this={collectionView} items={dataItems} row={3} android:paddingBottom={$navigationBarHeight}>
            <Template let:item>
                <canvasview columns="*,auto" on:tap={() => selectStop(item)}>
                    <line horizontalAlignment="left" startX={30} startY={0} stopX={30} stopY="50%" strokeColor={item.color} strokeWidth={4} visibility={item.first ? 'hidden' : 'visible'} />
                    <line horizontalAlignment="left" startX={30} startY="50%" stopX={30} stopY="100%" strokeColor={item.color} strokeWidth={4} visibility={item.last ? 'hidden' : 'visible'} />
                    <circle
                        antiAlias={true}
                        fillColor={item.first || item.last ? item.color : colorBackground}
                        horizontalAlignment="left"
                        paddingLeft={30}
                        radius={12}
                        strokeColor={item.color}
                        strokeWidth={3}
                        verticalAlignment="middle"
                        width={0} />
                    <label fontSize={16} marginLeft={60} text={item.name} verticalTextAlignment="middle" />
                    <!-- <label row={1} col={1} fontSize={14} color={colorOnSurfaceVariant} text={item.city} verticalTextAlignment="top" /> -->
                    <IconButton col={2} rowSpan={2} text="mdi-map-marker-radius-outline" verticalAlignment="middle" on:tap={() => backToMapOnPoint(item)} />
                </canvasview>
            </Template>
        </collectionview>
        <mdactivityindicator busy={loading} row={3} verticalAlignment="middle" visibility={loading ? 'visible' : 'hidden'} />
        {#if noNetworkAndNoData}
            <canvaslabel row={3}>
                <cgroup textAlignment="center" verticalAlignment="middle">
                    <cspan fontFamily={$fonts.mdi} fontSize={50} text="mdi-alert-circle-outline" />
                    <cspan fontSize={20} text={'\n' + lc('no_network')} />
                </cgroup>
            </canvaslabel>
        {/if}
        <CActionBar backgroundColor="transparent" buttonsDefaultVisualState="transparent" labelsDefaultVisualState="transparent">
            <label
                slot="center"
                class="transitIconLabel"
                autoFontSize={true}
                backgroundColor={lineColor}
                colSpan={3}
                color={line.textColor || 'white'}
                horizontalAlignment="center"
                text={line.shortName || line.name} />

            <IconButton text="mdi-file-pdf-box" on:tap={() => downloadPDF()} />
            <IconButton text="mdi-calendar-clock-outline" on:tap={() => showTimesheet()} />
        </CActionBar>
    </gridlayout>
</page>
