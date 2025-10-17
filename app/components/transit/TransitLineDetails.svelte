<script lang="ts">
    import { GeoJSONVectorTileDataSource } from '@nativescript-community/ui-carto/datasources';
    import { VectorTileLayer } from '@nativescript-community/ui-carto/layers/vector';
    import { CartoMap, PanningMode } from '@nativescript-community/ui-carto/ui';
    import { CollectionView, SnapPosition } from '@nativescript-community/ui-collectionview';
    import { ObservableArray, Page } from '@nativescript/core';
    import { openUrl } from '@nativescript/core/utils';
    import { Template } from '@nativescript-community/svelte-native/components';
    import { NativeViewElementNode } from '@nativescript-community/svelte-native/dom';
    import CActionBar from '~/components/common/CActionBar.svelte';
    import { lc } from '~/helpers/locale';
    import { onThemeChanged } from '~/helpers/theme';
    import { createTileDecoder, getMapContext } from '~/mapModules/MapModule';
    import { onNetworkChanged } from '~/services/NetworkService';
    import { packageService } from '~/services/PackageService';
    import { MetroLineStop, TransitRoute, transitService } from '~/services/TransitService';
    import { NoNetworkError } from '@shared/utils/error';
    import { showError } from '@shared/utils/showError';
    import { goBack, navigate } from '@shared/utils/svelte/ui';
    import { colors, fonts, windowInset } from '~/variables';
    import IconButton from '../common/IconButton.svelte';
    import { FeatureCollection } from 'geojson';
    import { MapPos } from '@nativescript-community/ui-carto/core';
    import { getDistanceSimple } from '~/helpers/geolib';
    $: ({ bottom: windowInsetBottom } = $windowInset);
    let { colorBackground, colorOnBackground, colorPrimary } = $colors;
    $: ({ colorBackground, colorOnBackground, colorPrimary } = $colors);
    interface Item extends MetroLineStop {
        selected: boolean;
        color: string;
        first: boolean;
        last: boolean;
    }
    let page: NativeViewElementNode<Page>;
    let collectionView: NativeViewElementNode<CollectionView>;
    export let line: TransitRoute;
    export let position: MapPos<LatLonKeys> = null;
    export let selectedStop = line.stopIds?.[0];

    let cartoMap: CartoMap<LatLonKeys>;
    let selectedIndex = -1;

    DEV_LOG && console.log('line', selectedStop, JSON.stringify(line));
    let loading = false;
    let dataItems: ObservableArray<Item> = null;
    let noNetworkAndNoData = false;
    export let decoder = createTileDecoder('inner');
    const mapContext = getMapContext();
    const lineColor = line.color || transitService.defaultTransitLineColor;

    async function refresh() {
        try {
            if (!cartoMap) {
                return;
            }
            dataItems = new ObservableArray(
                (await transitService.getLineStops(line.id))
                    .filter((i) => i.visible === true)
                    .map((i, index, array) => {
                        const selected = i.id === selectedStop || (position && getDistanceSimple(i, position) < 50);
                        if (selected) {
                            selectedIndex = index;
                        }
                        return { ...i, color: lineColor, first: index === 0, last: index === array.length - 1, selected };
                    })
            );

            const lineGeoJSON: FeatureCollection = await transitService.getTransitLines(line.id);
            dataItems.forEach((i) => {
                lineGeoJSON.features.unshift({ type: 'Feature', geometry: { type: 'Point', coordinates: [i.lon, i.lat] }, properties: { id: i.id, name: i.name, color: i.color } as any });
            });
            // lineGeoJSON = lineGeoJSON.replace('features":[{', `features":[${JSON.stringify(stopsGeoJSON).slice(1, -1)},{`);

            const transitVectorTileDataSource = new GeoJSONVectorTileDataSource({
                minZoom: 0,
                maxZoom: 24
            });
            const lineGeoJSONStr = JSON.stringify(lineGeoJSON);
            DEV_LOG && console.log('line', JSON.stringify(lineGeoJSONStr));
            transitVectorTileDataSource.createLayer('routes');
            const geometry = packageService.getGeoJSONReader().readFeatureCollection(lineGeoJSONStr);
            transitVectorTileDataSource.setLayerGeoJSONString(1, lineGeoJSONStr);

            const transitVectorTileLayer = new VectorTileLayer({
                dataSource: transitVectorTileDataSource,
                decoder
            });

            transitVectorTileLayer.setVectorTileEventListener(this);
            cartoMap.addLayer(transitVectorTileLayer);
            if (selectedIndex) {
                focusOnItem(dataItems.getItem(selectedIndex), true);
            } else {
                cartoMap.moveToFitBounds(geometry.getBounds(), undefined, true, true, true, 0);
            }
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
    async function onMapReady(e) {
        cartoMap = e.object as CartoMap<LatLonKeys>;
        mapContext.setMapDefaultOptions(cartoMap.getOptions());
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

    function focusOnItem(item: Item, scrollToIndex = false) {
        cartoMap.setFocusPos(item, 200);
        cartoMap.setZoom(15, 200);
        decoder.setJSONStyleParameters({ selected_id_str: item.id + '' });
        if (scrollToIndex) {
            collectionView.nativeView.scrollToIndex(dataItems.indexOf(item), false, SnapPosition.START);
        }
    }
    async function selectStop(item: Item) {
        try {
            DEV_LOG && console.log('selectStop', item.id);
            if (selectedIndex !== -1) {
                const oldItem = dataItems.getItem(selectedIndex);
                oldItem.selected = false;
                dataItems.setItem(selectedIndex, oldItem);
            }
            selectedIndex = dataItems.indexOf(item);
            item.selected = true;
            dataItems.setItem(selectedIndex, item);
            // mapContext.selectItem({
            //     item: { geometry: { type: 'Point', coordinates: [item.lon, item.lat] }, properties: { id: item.id, name: item.name, color: item.color } },
            //     isFeatureInteresting: true,
            //     setSelected: false,
            //     peek: false,
            //     zoom: 15,
            //     zoomDuration: 0
            // });
            focusOnItem(item);
        } catch (error) {
            showError(error);
        }
    }
</script>

<page bind:this={page} actionBarHidden={true} on:navigatingTo={onNavigatingTo}>
    <gridlayout rows="auto,auto,4*,6*">
        <label
            autoFontSize={true}
            fontSize={20}
            fontWeight="bold"
            maxFontSize={20}
            maxLines={3}
            padding="0 10 5 10"
            row={1}
            text={(line.longName || line.name)?.replace(' / ', '\n')}
            textAlignment="center"
            verticalTextAlignment="center"
            visibility={line.longName ? 'visible' : 'collapse'} />
        <cartomap row={2} useTextureView={false} zoom={16} on:mapReady={onMapReady} />
        <collectionview bind:this={collectionView} items={dataItems} row={3} android:paddingBottom={windowInsetBottom + $windowInset.keyboard}>
            <Template let:item>
                <canvasview columns="*,auto" on:tap={() => selectStop(item)}>
                    <line horizontalAlignment="left" startX={30} startY={0} stopX={30} stopY="50%" strokeColor={item.color} strokeWidth={4} visibility={item.first ? 'hidden' : 'visible'} />
                    <line horizontalAlignment="left" startX={30} startY="50%" stopX={30} stopY="100%" strokeColor={item.color} strokeWidth={4} visibility={item.last ? 'hidden' : 'visible'} />
                    <circle
                        antiAlias={true}
                        fillColor={item.first || item.last ? item.color : colorBackground}
                        horizontalAlignment="left"
                        paddingLeft={30}
                        radius={item.selected ? 14 : 12}
                        strokeColor={item.color}
                        strokeWidth={3}
                        verticalAlignment="middle"
                        width={0} />
                    <label color={item.selected ? colorPrimary : colorOnBackground} fontSize={16} marginLeft={60} text={item.name} verticalTextAlignment="middle" />
                    <IconButton col={2} rowSpan={2} text="mdi-map-marker-radius-outline" verticalAlignment="middle" on:tap={() => backToMapOnPoint(item)} />
                </canvasview>
            </Template>
        </collectionview>
        <activityindicator busy={loading} row={3} verticalAlignment="middle" visibility={loading ? 'visible' : 'hidden'} />
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
                backgroundColor={transitService.getRouteColor(line)}
                colSpan={3}
                color={transitService.getRouteTextColor(line)}
                horizontalAlignment="center"
                text={line.shortName || line.name} />

            <IconButton text="mdi-file-pdf-box" on:tap={() => downloadPDF()} />
            <IconButton text="mdi-calendar-clock-outline" on:tap={() => showTimesheet()} />
        </CActionBar>
    </gridlayout>
</page>
