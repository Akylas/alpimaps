<script lang="ts">
    import * as api from '@nativescript-community/ui-massifmaps/api';
    import type { MassifMap, MassifSource } from '@nativescript-community/ui-massifmaps/api';
    import { CollectionView, SnapPosition } from '@nativescript-community/ui-collectionview';
    import { ObservableArray, Page } from '@nativescript/core';
    import { Template } from '@nativescript-community/svelte-native/components';
    import { NativeViewElementNode } from '@nativescript-community/svelte-native/dom';
    import CActionBar from '@shared/components/CActionBar.svelte';
    import { lc } from '~/helpers/locale';
    import { onThemeChanged } from '~/helpers/theme';
    import { cloneLayerSpec, createTileDecoder, getMapContext } from '~/mapModules/MapModule';
    import { decompress, onNetworkChanged } from '~/services/NetworkService';
    import { packageService } from '~/services/PackageService';
    import { type StopLine } from '~/features/trains/lines';
    import { transitousService } from '~/features/trains/TransitousService';
    import { NoNetworkError } from '@akylas/nativescript-app-utils/error';
    import { showError } from '@shared/utils/showError';
    import { goBack, navigate } from '@shared/utils/svelte/ui';
    import { colors, fonts, windowInset } from '~/variables';
    import { geoJSONBounds } from '~/utils/geo';
    import IconButton from '~/components/common/IconButton.svelte';
    import type { Feature, FeatureCollection } from 'geojson';
    import type { MapPos } from '~/utils/geo';
    import { getDistanceSimple } from '~/helpers/geolib';
    $: ({ bottom: windowInsetBottom } = $windowInset);
    let { colorBackground, colorOnBackground, colorPrimary } = $colors;
    $: ({ colorBackground, colorOnBackground, colorPrimary } = $colors);
    interface Item {
        id: string;
        name: string;
        lat: number;
        lon: number;
        selected: boolean;
        color: string;
        first: boolean;
        last: boolean;
    }
    let page: NativeViewElementNode<Page>;
    let collectionView: NativeViewElementNode<CollectionView>;
    export let line: StopLine;
    export let position: MapPos = null;
    export let selectedStop = line.stopIds?.[0];

    let massifMap: MassifMap;
    let lineDataSource: MassifSource<'massif::GeoJSONVectorTileDataSource'>;
    let directionIndex = 0;
    let selectedIndex = -1;

    DEV_LOG && console.log('line', selectedStop, JSON.stringify(line));
    let loading = false;
    let dataItems: ObservableArray<Item> = null;
    let noNetworkAndNoData = false;
    export let decoder = createTileDecoder('inner');
    const mapContext = getMapContext();

    async function refresh() {
        try {
            if (!massifMap) {
                return;
            }
            loading = true;
            const leg = await transitousService.getTrip(line.directions[directionIndex].tripId);
            const places = [leg.from, ...(leg.intermediateStops ?? []), leg.to];
            selectedIndex = -1;
            dataItems = new ObservableArray(
                places.map((place, index, array) => {
                    const selected = line.stopIds.includes(place.stopId) || (position && getDistanceSimple(place, position) < 50);
                    if (selected && selectedIndex === -1) {
                        selectedIndex = index;
                    }
                    return { id: place.stopId, name: place.name, lat: place.lat, lon: place.lon, color: line.color, first: index === 0, last: index === array.length - 1, selected };
                })
            );

            const path: Feature = {
                type: 'Feature',
                geometry: { type: 'LineString', coordinates: decompress(leg.legGeometry.points, leg.legGeometry.precision ?? 6).map(({ lat, lon }) => [lon, lat]) },
                properties: {
                    route_id: line.id,
                    route_mode: line.mode,
                    route_short_name: line.shortName,
                    route_long_name: line.longName,
                    shortName: line.shortName,
                    longName: line.longName,
                    name: line.longName,
                    route_color: line.color,
                    route_text_color: line.textColor,
                    color: line.color,
                    textColor: line.textColor
                }
            };
            const lineGeoJSON: FeatureCollection = { type: 'FeatureCollection', features: [path] };
            dataItems.forEach((i) => {
                lineGeoJSON.features.unshift({ type: 'Feature', geometry: { type: 'Point', coordinates: [i.lon, i.lat] }, properties: { id: i.id, name: i.name, color: i.color } as any });
            });

            if (!lineDataSource) {
                lineDataSource = massifMap.source('source.transitLine', { type: 'geojson', minZoom: 0, maxZoom: 24 });
                lineDataSource.createLayer('routes');
                massifMap.addLayer('layer.transitLine', { type: 'vector', source: lineDataSource.id, style: decoder.id });
            }
            lineDataSource.setGeoJSON(1, lineGeoJSON);
            if (selectedIndex !== -1) {
                focusOnItem(dataItems.getItem(selectedIndex), true);
            } else {
                massifMap.camera().fitBounds(geoJSONBounds(lineGeoJSON), { integerZoom: true, resetRotation: true, resetTilt: true });
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
    function reverseDirection() {
        directionIndex = (directionIndex + 1) % line.directions.length;
        refresh();
    }
    // onMount(() => {
    //     focus();
    // });
    function onNavigatingTo(e) {
        refresh();
    }
    async function onMapReady(e) {
        // its own registry id: two maps in one app must not share the "map" one
        massifMap = api.attach(e.object, { id: 'map.transitLine' });
        mapContext.setMapDefaultOptions(massifMap);
        try {
            let layers = mapContext.getLayers('map');
            if (layers.length === 0) {
                layers = mapContext.getLayers('customLayers');
            }
            layers.forEach((l, index) => {
                const spec = cloneLayerSpec(l.layer);
                if (spec) {
                    // its own composite, so it needs its own hillshade and contour children
                    mapContext.mapModule('customLayers')?.attachTerrain(massifMap.addLayer(`layer.transitLine.base${index}`, spec));
                }
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

    async function showTimesheet() {
        try {
            const component = (await import('~/features/trains/LineTimesheet.svelte')).default;
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
        // one move rather than a position animation racing a zoom animation
        massifMap.camera().moveTo({ lat: item.lat, lon: item.lon }, { zoom: 15, duration: 200 });
        decoder.call('setStyleParameters', { selected_id_str: item.id + '' });
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
            text={(line.longName || line.directions[directionIndex].headsign)?.replace(' / ', '\n')}
            textAlignment="center"
            verticalTextAlignment="center"
            visibility={line.longName || line.directions[directionIndex]?.headsign ? 'visible' : 'collapse'} />
        <massifmap row={2} useTextureView={false} zoom={16} on:mapReady={onMapReady} />
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
                backgroundColor={line.color}
                colSpan={3}
                color={line.textColor}
                horizontalAlignment="center"
                text={line.shortName || line.longName} />

            <IconButton text="mdi-swap-vertical" visibility={line.directions.length > 1 ? 'visible' : 'collapse'} on:tap={reverseDirection} />
            <IconButton text="mdi-calendar-clock-outline" on:tap={() => showTimesheet()} />
        </CActionBar>
    </gridlayout>
</page>
