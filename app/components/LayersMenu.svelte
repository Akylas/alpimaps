<script lang="ts">
    import { lc } from '@nativescript-community/l';
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
    import { pitchEnabled, preloading, rotateEnabled, showGlobe, show3DBuildings } from '~/stores/mapStore';
    import { closeBottomSheet, showBottomSheet } from '~/utils/svelte/bottomsheet';
    import { borderColor, navigationBarHeight, primaryColor, subtitleColor, textColor } from '~/variables';
    import IconButton from './IconButton.svelte';

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
                dismissOnBackgroundTap: true,
                disableDimBackground: true,
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

<gridlayout {...$$restProps} id="rightMenu" bind:this={gridLayout} columns="*,auto" height={240 + $navigationBarHeight} paddingBottom={$navigationBarHeight}>
    {#if loaded}
        <collectionview id="trackingScrollView" items={customSources} bind:this={collectionView} reorderEnabled={true} on:itemReordered={onItemReordered}>
            <Template let:item>
                <gridlayout paddingLeft="15" paddingRight="5" rows="*" columns="130,*,auto" borderBottomColor={$borderColor} borderBottomWidth="1">
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
                    <mdbutton
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
            <IconButton text="mdi-plus" on:tap={addSource} />
            <IconButton gray={true} isSelected={$show3DBuildings} tooltip={lc('buildings_3d')} text="mdi-domain" on:tap={() => show3DBuildings.set(!$show3DBuildings)} />
            <IconButton gray={true} isSelected={$showGlobe} tooltip={lc('globe_mode')} text="mdi-globe-model" on:tap={() => showGlobe.set(!$showGlobe)} />
            <IconButton gray={true} isSelected={$rotateEnabled} tooltip={lc('map_rotation')} text="mdi-rotate-3d-variant" on:tap={() => rotateEnabled.set(!$rotateEnabled)} />
            <IconButton gray={true} isSelected={$pitchEnabled} tooltip={lc('map_pitch')} text="mdi-rotate-orbit" on:tap={() => pitchEnabled.set(!$pitchEnabled)} />
            <IconButton gray={true} isSelected={$preloading} tooltip={lc('preloading')} text="mdi-map-clock" isVisible={packageServiceEnabled} on:tap={() => preloading.set(!$preloading)} />
        </stacklayout>
    {/if}
    <!-- <GridLayout visibility="(currentLegend)?'visible':'collapsed'" rows="auto,*" columns="auto,*" backgroundColor={white}>
                <WebView rowSpan={2} colSpan={2} v-if="currentLegend" src="currentLegend" @scroll={onListViewScroll}  />
                <MDButton variant="flat" class="icon-btn" text="mdi-arrow-left" @tap="currentLegend = null" />
            </GridLayout> -->
</gridlayout>
