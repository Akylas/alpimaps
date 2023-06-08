<script lang="ts">
    import { lc } from '@nativescript-community/l';
    import { CollectionView } from '@nativescript-community/ui-collectionview';
    import { ContentView, GridLayout } from '@nativescript/core';
    import { setNumber } from '@nativescript/core/application-settings';
    import { ObservableArray } from '@nativescript/core/data/observable-array';
    import { debounce } from 'push-it-to-the-limit';
    import { onDestroy, onMount } from 'svelte';
    import { Template } from 'svelte-native/components';
    import { NativeViewElementNode } from 'svelte-native/dom';
    import { onThemeChanged } from '~/helpers/theme';
    import type { SourceItem } from '~/mapModules/CustomLayersModule';
    import CustomLayersModule from '~/mapModules/CustomLayersModule';
    import { getMapContext } from '~/mapModules/MapModule';
    import { pitchEnabled, preloading, rotateEnabled, showGlobe, show3DBuildings } from '~/stores/mapStore';
    import { showError } from '~/utils/error';
    import { closeBottomSheet, showBottomSheet } from '~/utils/svelte/bottomsheet';
    import { openLink } from '~/utils/ui';
    import { backgroundColor, borderColor, navigationBarHeight, primaryColor, subtitleColor, textColor, widgetBackgroundColor } from '~/variables';
    import IconButton from './IconButton.svelte';
    import { CollectionViewWithSwipeMenu } from '@nativescript-community/ui-collectionview-swipemenu';

    const mapContext = getMapContext();
    let gridLayout: NativeViewElementNode<GridLayout>;
    let collectionView: NativeViewElementNode<CollectionViewWithSwipeMenu>;

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

    async function addSource() {
        try {
            await customLayers.addSource();
        } catch (error) {
            showError(error);
        }
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
        item.layer.visible = opacity > 0;
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
    async function onItemReordered(e) {
        (e.view as ContentView).content.opacity = 1;
    }
    async function onItemReorderStarting(e) {
        (e.view as ContentView).content.opacity = 0.6;
    }

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
    function onLinkTap(e) {
        openLink(e.link);
    }
    onThemeChanged(() => collectionView?.nativeView.refreshVisibleItems());

    function drawerTranslationFunction(side, width, value, delta, progress) {
        const result = {
            mainContent: {
                translateX: side === 'right' ? -delta : delta
            },
            backDrop: {
                translateX: side === 'right' ? -delta : delta,
                opacity: progress * 0.1
            }
        } as any;

        return result;
    }

    function deleteSource(item) {
        customLayers.deleteSource(item);
    }
    function onCloseBottomSheet() {
        collectionView?.nativeView?.closeCurrentMenu();
    }
</script>

<gesturerootview {...$$restProps} on:closedBottomSheet={onCloseBottomSheet} height={240}>
    <gridlayout bind:this={gridLayout} columns="*,auto" backgroundColor={$backgroundColor}>
    {#if loaded}
        <collectionview
            id="trackingScrollView"
            items={customSources}
            bind:this={collectionView}
            reorderEnabled={true}
            on:itemReordered={onItemReordered}
            on:itemReorderStarting={onItemReorderStarting}
            rowHeight={56}
        >
            <Template let:item>
                <swipemenu
                    id={item.name}
                    leftSwipeDistance={item.local ? 0.0001 : 130}
                    startingSide={item.startingSide}
                    translationFunction={drawerTranslationFunction}
                    openAnimationDuration={100}
                    closeAnimationDuration={100}
                    gestureHandlerOptions={{
                        failOffsetYStart: -40,
                        failOffsetYEnd: 40,
                        minDist: 50
                    }}
                >
                    <gridlayout prop:mainContent paddingLeft={15} paddingRight={5} rows="*" columns="130,*,auto" borderBottomColor={$borderColor} borderBottomWidth={1} backgroundColor={$backgroundColor}>
                        <stacklayout verticalAlignment="center">
                            <label color={item.layer.opacity === 0 ? $subtitleColor : $textColor} text={item.name.toUpperCase()} fontSize={13} fontWeight="bold" lineBreak="end" maxLines={2} />
                            <label
                                visibility={item.provider.attribution ? 'visible' : 'collapsed'}
                                color={$subtitleColor}
                                html={item.provider.attribution}
                                fontSize={11}
                                maxLines={2}
                                paddingTop={3}
                                on:linkTap={onLinkTap}
                            />
                        </stacklayout>
                        <slider
                            marginLeft={10}
                            marginRight={10}
                            col={1}
                            value={item.layer.opacity}
                            on:valueChange={(event) => onLayerOpacityChanged(item, event)}
                            minValue={0}
                            maxValue={1}
                            verticalAlignment="middle"
                        />
                        <IconButton col={2} rowSpan={2} gray={true} text="mdi-dots-vertical" on:tap={() => showSourceOptions(item)} onLongPress={(event) => onButtonLongPress(item, event)} />
                        <mdprogress colSpan={3} value={item.downloadProgress} visibility={item.downloading > 0 ? 'visible' : 'collapsed'} verticalAlignment="bottom" />
                    </gridlayout>
                        <mdbutton prop:leftDrawer
                            id="deleteBtn"
                            variant="text"
                            class="icon-btn"
                            width={60}
                            height="100%"
                            text="mdi-trash-can"
                            color="white"
                            backgroundColor="red"
                            textAlignment="center"
                            shape="none"
                            verticalTextAlignment="middle"
                            on:tap={deleteSource(item)}
                        />
                </swipemenu>
            </Template>
        </collectionview>
        <stacklayout col={1} borderLeftColor={$borderColor} borderLeftWidth={1}>
            <IconButton gray={true} text="mdi-plus" on:tap={addSource} />
            <IconButton gray={true} isSelected={$show3DBuildings} tooltip={lc('buildings_3d')} text="mdi-domain" on:tap={() => show3DBuildings.set(!$show3DBuildings)} />
            <IconButton gray={true} isSelected={$showGlobe} tooltip={lc('globe_mode')} text="mdi-globe-model" on:tap={() => showGlobe.set(!$showGlobe)} />
            <IconButton gray={true} isSelected={$rotateEnabled} tooltip={lc('map_rotation')} text="mdi-rotate-3d-variant" on:tap={() => rotateEnabled.set(!$rotateEnabled)} />
            <IconButton gray={true} isSelected={$pitchEnabled} tooltip={lc('map_pitch')} text="mdi-rotate-orbit" on:tap={() => pitchEnabled.set(!$pitchEnabled)} />
            <!-- <IconButton gray={true} isSelected={$preloading} tooltip={lc('preloading')} text="mdi-map-clock" on:tap={() => preloading.set(!$preloading)} /> -->
        </stacklayout>
    {/if}
    <!-- <GridLayout visibility="(currentLegend)?'visible':'collapsed'" rows="auto,*" columns="auto,*" backgroundColor={white}>
                <WebView rowSpan={2} colSpan={2} v-if="currentLegend" src="currentLegend" @scroll={onListViewScroll}  />
                <MDButton variant="flat" class="icon-btn" text="mdi-arrow-left" @tap="currentLegend = null" />
            </GridLayout> -->
</gridlayout>
</gesturerootview>