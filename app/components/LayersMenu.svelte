<script lang="ts">
    import { CollectionView } from '@nativescript-community/ui-collectionview';
    import { GridLayout } from '@nativescript/core';
    import { setNumber } from '@nativescript/core/application-settings';
    import { ObservableArray } from '@nativescript/core/data/observable-array';
    import { debounce } from 'push-it-to-the-limit/target/es6';
    import { onDestroy, onMount } from 'svelte';
    import { Template } from 'svelte-native/components';
    import { NativeViewElementNode } from 'svelte-native/dom';
    import { onThemeChanged } from '~/helpers/theme';
    import type { SourceItem } from '~/mapModules/CustomLayersModule';
    import CustomLayersModule from '~/mapModules/CustomLayersModule';
    import { getMapContext } from '~/mapModules/MapModule';
    import mapStore from '~/stores/mapStore';
    import { borderColor, navigationBarHeight, primaryColor, subtitleColor, textColor, widgetBackgroundColor } from '~/variables';
    import { closeBottomSheet, showBottomSheet } from '~/utils/bottomsheet';

    const mapContext = getMapContext();
    let gridLayout: NativeViewElementNode<GridLayout>;
    let collectionView: NativeViewElementNode<CollectionView>;

    export let customLayers: CustomLayersModule = null;
    export let customSources: ObservableArray<SourceItem> = [] as any;
    let currentLegend: string = null;
    // mapContext.onMapReady((view: CartoMap<LatLonKeys>) => {
    //     customLayers = mapContext.mapModule('customLayers');
    //     console.log('onMapready')
    //     customSources = customLayers.customSources;
    // });
    onMount(() => {
        customLayers = mapContext.mapModule('customLayers');
        if (customLayers) {
            customSources = customLayers.customSources;
            // customSources.forEach((s) => {
            //     const dataSource = s.layer.dataSource;
            //     if (dataSource instanceof PersistentCacheTileDataSource) {
            //         const databasePath = dataSource.options.databasePath;
            //         console.log(databasePath, formatSize(File.fromPath(databasePath).size));
            //     }
            // });
        }
    });
    onDestroy(() => {
        customLayers = null;
        customSources = null;
    });

    const packageServiceEnabled = __CARTO_PACKAGESERVICE__;

    function addSource() {
        customLayers.addSource();
    }
    function clearCache() {
        // clearCache();
    }
    const updateItem = debounce(function (item: SourceItem) {
        customSources &&
            customSources.some((d, index) => {
                if (d === item) {
                    customSources.setItem(index, item);
                    return true;
                }
            });
    }, 500);
    function onLayerOpacityChanged(item: SourceItem, event) {
        const opacity = event.value;
        if (item.layer.opacity === opacity) {
            return;
        }
        item.layer.opacity = opacity;
        setNumber(item.name + '_opacity', opacity);
        item.layer.visible = opacity !== 0 ? true : false;
        mapContext.getMap().requestRedraw();
        updateItem(item);
    }

    async function showSourceOptions(item: SourceItem) {
        const LayerOptionsBottomSheet = (await import('./LayerOptionsBottomSheet.svelte')).default;
        closeBottomSheet();
        setTimeout(() => {
            showBottomSheet({
                parent: gridLayout,
                view: LayerOptionsBottomSheet,
                trackingScrollView: 'scrollView',
                disableDimBackground: true,
                dismissOnBackgroundTap: true,
                props: {
                    item
                }
            });
        }, 0);
    }
    async function onItemReordered() {}

    let loaded = true;
    let loadedListeners = [];
    export async function loadRightMenuView() {
        if (!loaded) {
            await new Promise((resolve) => {
                loadedListeners.push(resolve);
                loaded = true;
            });
        }
    }
    $: {
        if (collectionView) {
            loadedListeners.forEach((l) => l());
        }
    }
    function onButtonLongPress(item, event) {
        collectionView.nativeView.startDragging(customSources.indexOf(item));
    }
    onThemeChanged(() => {
        collectionView && (collectionView.nativeView as CollectionView).refreshVisibleItems();
    });
</script>

<gridlayout {...$$restProps} id="rightMenu" bind:this={gridLayout} columns="*,auto" height={240 + $navigationBarHeight} paddingBottom={$navigationBarHeight} backgroundColor={$widgetBackgroundColor}>
    {#if loaded}
        <collectionview id="trackingScrollView" items={customSources} bind:this={collectionView} reorderEnabled={true} on:itemReordered={onItemReordered}>
            <Template let:item>
                <gridlayout paddingLeft="15" paddingRight="5" rows="*" columns="100,*,auto" borderBottomColor={$borderColor} borderBottomWidth="1">
                    <label
                        color={item.layer.opacity === 0 ? $subtitleColor : $textColor}
                        text={item.name.toUpperCase()}
                        fontSize="13"
                        fontWeight="bold"
                        lineBreak="end"
                        verticalTextAlignment="center"
                        maxLines={2}
                        paddingTop="3"
                    />
                    <slider
                        marginLeft="10"
                        marginRight="10"
                        col={1}
                        value={item.layer.opacity}
                        on:valueChange={(event) => onLayerOpacityChanged(item, event)}
                        minValue="0"
                        maxValue="1"
                        verticalAlignment="center"
                    />
                    <button
                        col={2}
                        rowSpan={2}
                        variant="text"
                        class="icon-btn"
                        text="mdi-dots-vertical"
                        on:tap={() => showSourceOptions(item)}
                        on:longPress={(event) => onButtonLongPress(item, event)}
                    />
                </gridlayout>
            </Template>
        </collectionview>
        <stacklayout col={1} borderLeftColor={$borderColor} borderLeftWidth="1">
            <button variant="text" class="icon-btn" text="mdi-plus" on:tap={addSource} />
            <!-- <button variant="text" class="icon-btn" text="mdi-layers-off" on:tap={clearCache} /> -->
            <!-- <MDButton class="buttonthemed" @tap="addSource" text={l('add_source')} /> -->
            <!-- <MDButton class="buttonthemed" @tap="clearCache" text={l('clear_cache')} /> -->
            <!-- <MDButton class="buttonthemed" @tap="selectLocalMbtilesFolder" text={l('select_local_folder')} /> -->
            <button variant="text" class="icon-btn" text="mdi-domain" color={$mapStore.show3DBuildings ? primaryColor : 'gray'} on:tap={() => (mapStore.show3DBuildings = !mapStore.show3DBuildings)} />

            <!-- <button
                variant="text"
                class="icon-btn"
                text="mdi-signal"
                color={$mapStore.showContourLines ? primaryColor : 'gray'}
                on:tap={() => mapStore.setShowContourLines(!$mapStore.showContourLines)}
            /> -->
            <!-- <button
                variant="text"
                class="icon-btn"
                text="mdi-map-marker-path"
                color={$mapStore.showRoutes ? primaryColor : 'gray'}
                on:tap={() => mapStore.setShowRoutes(!$mapStore.showRoutes)}
            /> -->
            <button variant="text" class="icon-btn" text="mdi-globe-model" color={$mapStore.showGlobe ? primaryColor : 'gray'} on:tap={() => (mapStore.showGlobe = !mapStore.showGlobe)} />
            <button
                variant="text"
                class="icon-btn"
                text="mdi-rotate-3d-variant"
                color={$mapStore.rotateEnabled ? primaryColor : 'gray'}
                on:tap={() => (mapStore.rotateEnabled = !mapStore.rotateEnabled)}
            />
            <button variant="text" class="icon-btn" text="mdi-rotate-orbit" color={$mapStore.pitchEnabled ? primaryColor : 'gray'} on:tap={() => (mapStore.pitchEnabled = !mapStore.pitchEnabled)} />

            <button
                variant="text"
                class="icon-btn"
                text="mdi-map-clock"
                visibility={packageServiceEnabled ? 'visible' : 'collapsed'}
                color={$mapStore.preloading ? primaryColor : 'gray'}
                on:tap={() => (mapStore.preloading = !mapStore.preloading)}
            />
        </stacklayout>
    {/if}
    <!-- <GridLayout visibility="(currentLegend)?'visible':'collapsed'" rows="auto,*" columns="auto,*" backgroundColor={white}>
                <WebView rowSpan={2} colSpan={2} v-if="currentLegend" src="currentLegend" @scroll={onListViewScroll}  />
                <MDButton variant="flat" class="icon-btn" text="mdi-arrow-left" @tap="currentLegend = null" />
            </GridLayout> -->
</gridlayout>
