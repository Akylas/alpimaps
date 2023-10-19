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
    import CActionBar from '~/components/CActionBar.svelte';
    import { lc } from '~/helpers/locale';
    import { onThemeChanged } from '~/helpers/theme';
    import { getMapContext } from '~/mapModules/MapModule';
    import { NoNetworkError, onNetworkChanged } from '~/services/NetworkService';
    import { packageService } from '~/services/PackageService';
    import { transitService } from '~/services/TransitService';
    import type { TransitRoute } from '~/services/transitland';
    import { showError } from '~/utils/error';
    import { mdiFontFamily, navigationBarHeight, widgetBackgroundColor } from '~/variables';
    import type { Feature, Point } from 'geojson';
    import IconButton from '../IconButton.svelte';

    let page: NativeViewElementNode<Page>;
    let collectionView: NativeViewElementNode<CollectionView>;
    export let line: TransitRoute;
    const routeColor = getRouteColor();
    let loading = false;
    let dataItems = null;
    let noNetworkAndNoData = false;
    const mapContext = getMapContext();

    async function refresh() {
        try {
            const route = await transitService.route(line.onestop_id || line.route_id, { include_alerts: true, include_geometry: true });
            const stops = route.route_stops.map((s, index, array) => {
                const { geometry, ...properties } = s.stop;
                return { type: 'Feature', properties: { ...properties, color: routeColor }, geometry, first: index === 0, last: index === array.length - 1 };
            });
            dataItems = stops;
            const transitVectorTileDataSource = new GeoJSONVectorTileDataSource({
                minZoom: 0,
                maxZoom: 24
            });
            transitVectorTileDataSource.createLayer('routes');
            transitVectorTileDataSource.createLayer('stops');
            const { geometry, ...properties } = route;
            const routeItem = { type: 'Feature', geometry, properties: { ...properties, route_color: routeColor } };
            const featureCollection = packageService.getGeoJSONReader().readFeatureCollection({
                type: 'FeatureCollection',
                features: [routeItem]
            });
            transitVectorTileDataSource.setLayerFeatureCollection(1, mapContext.getProjection(), featureCollection);
            transitVectorTileDataSource.setLayerGeoJSONString(2, {
                type: 'FeatureCollection',
                features: stops
            });

            const transitVectorTileLayer = new VectorTileLayer({
                dataSource: transitVectorTileDataSource,
                decoder: getMapContext().innerDecoder
            });

            transitVectorTileLayer.setVectorTileEventListener(this);
            cartoMap.addLayer(transitVectorTileLayer);
            cartoMap.moveToFitBounds(featureCollection.getBounds(), undefined, true, true, true, 0);
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
        options.setWatermarkScale(0);
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
                var prototype = Object.getPrototypeOf(l.layer);
                cartoMap.addLayer(new prototype.constructor(l.layer.options));
            });
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
            openUrl(`https://data.mobilites-m.fr/api/planligne/pdf?route=${line.id}`);
        } catch (error) {
            showError(error);
        }
    }

    async function showTimesheet() {
        try {
            const component = (await import('~/components/transit/TransitTimesheet.svelte')).default as any;
            await navigate({
                page: component,
                props: {
                    line
                }
            });
        } catch (error) {
            showError(error);
        }
    }
    async function backToMapOnPoint(item) {
        try {
            mapContext.selectItem({
                item,
                isFeatureInteresting: true,
                setSelected: false,
                preventZoom: false,
                zoom: 15,
                peek: false,
                zoomDuration: 0
            });
            goBack({ to: mapContext.getMainPage() });
        } catch (error) {
            showError(error);
        }
    }
    async function selectStop(item: Feature<Point>) {
        try {
            mapContext.selectItem({
                item: item as any,
                isFeatureInteresting: true,
                setSelected: false,
                peek: false,
                preventZoom: false,
                zoom: 15,
                zoomDuration: 0
            });
            cartoMap.setFocusPos({ lat: item.geometry.coordinates[1], lon: item.geometry.coordinates[0] }, 200);
            cartoMap.setZoom(15, 200);
        } catch (error) {
            showError(error);
        }
    }
    function getRouteColor() {
        return transitService.getRouteColor(line);
    }
    function getRouteTextColor() {
        return transitService.getRouteTextColor(line);
    }
</script>

<page bind:this={page} actionBarHidden={true} on:navigatingTo={onNavigatingTo}>
    <gridlayout rows="auto,auto,*,2*">
        <label
            row={1}
            text={line.route_long_name.replace(' / ', '\n')}
            fontWeight="bold"
            padding="15 10 15 10"
            fontSize={20}
            maxFontSize={20}
            autoFontSize={true}
            maxLines={3}
            textAlignment="center"
            verticalTextAlignment="center"
        />
        <cartomap row={2} zoom={16} on:mapReady={onMapReady} />
        <collectionview bind:this={collectionView} row={3} items={dataItems} android:marginBottom={$navigationBarHeight}>
            <Template let:item>
                <canvas columns="*,auto" on:tap={() => selectStop(item)}>
                    <line strokeColor={item.properties.color} startX={30} stopX={30} startY={0} stopY="50%" strokeWidth={4} visibility={item.first ? 'hidden' : 'visible'} horizontalAlignment="left"/>
                    <line strokeColor={item.properties.color} startX={30} stopX={30} startY="50%" stopY="100%" strokeWidth={4} visibility={item.last ? 'hidden' : 'visible'}  horizontalAlignment="left"/>
                    <circle
                        strokeColor={item.properties.color}
                        fillColor={item.first || item.last ? item.properties.color : $widgetBackgroundColor}
                        radius={12}
                        antiAlias={true}
                        verticalAlignment="middle"
                        width={0}
                        strokeWidth={3}
                        paddingLeft={30}
                        horizontalAlignment="left"
                    />
                    <label marginLeft={60} fontSize={16} text={item.properties.stop_name} verticalTextAlignment="middle" />
                    <!-- <label row={1} col={1} fontSize={14} color={$subtitleColor} text={item.city} verticalTextAlignment="top" /> -->
                    <IconButton col={2} rowSpan={2} text="mdi-map-marker-radius-outline" on:tap={() => backToMapOnPoint(item)} verticalAlignment="middle" />
                </canvas>
            </Template>
        </collectionview>
        <mdactivityindicator busy={loading} verticalAlignment="middle" visibility={loading ? 'visible' : 'hidden'} row={3} />
        {#if noNetworkAndNoData}
            <canvaslabel row={3}>
                <cgroup textAlignment="center" verticalAlignment="middle">
                    <cspan text="mdi-alert-circle-outline" fontSize={50} fontFamily={mdiFontFamily} />
                    <cspan text={'\n' + lc('no_network')} fontSize={20} />
                </cgroup>
            </canvaslabel>
        {/if}
        <CActionBar backgroundColor="transparent">
            <label slot="center" class="transitIconLabel" colSpan={3} marginLeft={5} backgroundColor={routeColor} color={getRouteTextColor()} text={line.route_short_name} autoFontSize={true} />

            <IconButton text="mdi-file-pdf-box" on:tap={() => downloadPDF()} />
            <IconButton text="mdi-calendar-clock-outline" on:tap={() => showTimesheet()} />
        </CActionBar>
    </gridlayout>
</page>
