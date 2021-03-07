<script lang="ts">
    import { GridLayout } from '@nativescript/core';
    import { CartoMap } from '@nativescript-community/ui-carto/ui';
    import { setNumber } from '@nativescript/core/application-settings';
    import { ObservableArray } from '@nativescript/core/data/observable-array';
    import { onDestroy, onMount } from 'svelte';
    import { Template } from 'svelte-native/components';
    import { NativeViewElementNode } from 'svelte-native/dom';
    import CustomLayersModule from '~/mapModules/CustomLayersModule';
    import type { SourceItem } from '~/mapModules/CustomLayersModule';
    import { getMapContext } from '~/mapModules/MapModule';
    import { navigationBarHeight, primaryColor, widgetBackgroundColor } from '~/variables';
    import { showBottomSheet } from './bottomsheet';
    import mapStore from '~/stores/mapStore';
    import { debounce } from 'push-it-to-the-limit';
    import { CollectionView } from '@nativescript-community/ui-collectionview';

    const mapContext = getMapContext();
    let gridLayout: NativeViewElementNode<GridLayout>;
    let collectionView: NativeViewElementNode<CollectionView>;

    export let customLayers: CustomLayersModule = null;
    export let customSources: ObservableArray<SourceItem> = [] as any;
    let currentLegend: string = null;
    mapContext.onMapReady((view: CartoMap<LatLonKeys>) => {
        customLayers = mapContext.mapModule('customLayers');
        customSources = customLayers.customSources;
    });
    onMount(() => {
        customLayers = mapContext.mapModule('customLayers');
        if (customLayers) {
            customSources = customLayers.customSources;
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
        // customSources.some((d, index) => {
        //     if (d === item) {
        //         customSources.setItem(index, item);
        //         return true;
        //     }
        // });
        updateItem(item);
    }

    async function showSourceOptions(item: SourceItem) {
        const LayerOptionsBottomSheet = (await import('./LayerOptionsBottomSheet.svelte')).default;
        showBottomSheet({
            parent: gridLayout,
            view: LayerOptionsBottomSheet,
            disableDimBackground: true,
            dismissOnBackgroundTap: true,
            props: {
                item
            }
        });
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
</script>

<gridlayout
    {...$$restProps}
    id="rightMenu"
    bind:this={gridLayout}
    columns="*,auto"
    height={210 + navigationBarHeight}
    paddingBottom={navigationBarHeight}
    backgroundColor={$widgetBackgroundColor}
>
    {#if loaded}
        <collectionview
            id="trackingScrollView"
            col="0"
            rowHeight="70"
            items={customSources}
            bind:this={collectionView}
            reorderEnabled={true}
            reorderLongPressEnabled={true}
            on:itemReordered={onItemReordered}
        >
            <Template let:item>
                <gridlayout paddingLeft="15" paddingRight="5" rows="*" columns="2*,*,auto">
                    <canvaslabel colSpan="2">
                        <cspan
                            color={item.layer.opacity === 0 ? 'grey' : undefined}
                            text={item.name.toUpperCase()}
                            fontSize="13"
                            fontWeight="bold"
                            verticalAlignment="top"
                            paddingTop="5"
                        />
                    </canvaslabel>
                    <mdslider
                        marginLeft="10"
                        marginRight="10"
                        value={item.layer.opacity}
                        on:valueChange={(event) => onLayerOpacityChanged(item, event)}
                        minValue="0"
                        maxValue="1"
                        verticalAlignment="center"
                    />
                    <button
                        col="2"
                        rowSpan="2"
                        variant="text"
                        class="icon-btn"
                        text="mdi-dots-vertical"
                        on:tap={showSourceOptions(item)}
                    />
                </gridlayout>
            </Template>
        </collectionview>
        <stacklayout col="1" borderLeftColor="rgba(255,255,255,0.4)" borderLeftWidth="1">
            <button variant="text" class="icon-btn" text="mdi-plus" on:tap={addSource} />
            <button variant="text" class="icon-btn" text="mdi-layers-off" on:tap={clearCache} />
            <!-- <MDButton class="buttonthemed" @tap="addSource" text={l('add_source')} /> -->
            <!-- <MDButton class="buttonthemed" @tap="clearCache" text={l('clear_cache')} /> -->
            <!-- <MDButton class="buttonthemed" @tap="selectLocalMbtilesFolder" text={l('select_local_folder')} /> -->
            <button
                variant="text"
                class="icon-btn"
                text="mdi-domain"
                color={$mapStore.show3DBuildings ? primaryColor : 'gray'}
                on:tap={() => mapStore.setShow3DBuildings(!$mapStore.show3DBuildings)}
            />

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
            <button
                variant="text"
                class="icon-btn"
                text="mdi-globe-model"
                color={$mapStore.showGlobe ? primaryColor : 'gray'}
                on:tap={() => mapStore.setShowGlobe(!$mapStore.showGlobe)}
            />

            <button
                variant="text"
                class="icon-btn"
                text="mdi-map-clock"
                visibility={packageServiceEnabled ? 'visible' : 'collapsed'}
                color={$mapStore.preloading ? primaryColor : 'gray'}
                on:tap={() => mapStore.setPreloading(!$mapStore.preloading)}
            />
        </stacklayout>
    {/if}
    <!-- <GridLayout visibility="(currentLegend)?'visible':'collapsed'" rows="auto,*" columns="auto,*" backgroundColor={white}>
                <WebView rowSpan="2" colSpan="2" v-if="currentLegend" src="currentLegend" @scroll={onListViewScroll}  />
                <MDButton variant="flat" class="icon-btn" text="mdi-arrow-left" @tap="currentLegend = null" />
            </GridLayout> -->
</gridlayout>
