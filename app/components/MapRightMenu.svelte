<script lang="ts" context="module">
    import { GridLayout } from '@nativescript/core';
    import { CartoMap } from '@nativescript-community/ui-carto/ui';
    import { setNumber } from '@nativescript/core/application-settings';
    import { ObservableArray } from '@nativescript/core/data/observable-array';
    import { onDestroy } from 'svelte';
    import { Template } from 'svelte-native/components';
    import { NativeViewElementNode } from 'svelte-native/dom';
    import CustomLayersModule from '~/mapModules/CustomLayersModule';
    import type { SourceItem } from '~/mapModules/CustomLayersModule';
    import { getMapContext } from '~/mapModules/MapModule';
    import { navigationBarHeight, primaryColor } from '../variables';
    import { showBottomSheet } from './bottomsheet';
    import mapStore from '~/stores/mapStore';
</script>

<script lang="ts">
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
    function onLayerOpacityChanged(item, event) {
        const opacity = event.value / 100;
        item.layer.opacity = opacity;
        setNumber(item.name + '_opacity', opacity);
        item.layer.visible = opacity !== 0;
        mapContext.getMap().requestRedraw();
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

    let loaded = false;
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
    backgroundColor="#99000000">
    {#if loaded}
        <collectionview col="0" rowHeight="70" items={customSources} bind:this={collectionView}>
            <Template let:item>
                <gridlayout paddingLeft="15" paddingRight="5" rows="*" columns="*,auto" on:longPress={showSourceOptions(item)}>
                    <canvaslabel color={item.layer.opacity === 0 ? 'grey' : 'white'}>
                        <cspan
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
                        value={Math.round(item.layer.opacity * 100)}
                        on:valueChange={(event) => onLayerOpacityChanged(item, event)}
                        minValue="0"
                        maxValue="100"
                        verticalAlignment="center"
                    />
                    <button
                        col="1"
                        rowSpan="2"
                        color="white"
                        rippleColor="white"
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

            <button
                variant="text"
                class="icon-btn"
                text="mdi-signal"
                color={$mapStore.showContourLines ? primaryColor : 'gray'}
                on:tap={() => mapStore.setShowContourLines(!$mapStore.showContourLines)}
            />
            <button
                variant="text"
                class="icon-btn"
                text="mdi-map-marker-path"
                color={$mapStore.showRoutes ? primaryColor : 'gray'}
                on:tap={() => mapStore.setShowRoutes(!$mapStore.showRoutes)}
            />
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
