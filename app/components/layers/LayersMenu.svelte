<script lang="ts">
    import { lc } from '@nativescript-community/l';
    import { CollectionViewWithSwipeMenu } from '@nativescript-community/ui-collectionview-swipemenu';
    import { closeBottomSheet, showBottomSheet } from '@nativescript-community/ui-material-bottomsheet/svelte';
    import { ContentView, GridLayout } from '@nativescript/core';
    // not from the barrel: ui/gestures/index.d.ts redeclares TouchGestureEventData with an unexported
    // Pointer type that startDragging does not accept
    import type { TouchGestureEventData } from '@nativescript/core/ui/gestures/gestures-types';
    import { setNumber } from '@nativescript/core/application-settings';
    import { ObservableArray } from '@nativescript/core/data/observable-array';
    import { debounce } from '@nativescript/core/utils';
    import { showError } from '@shared/utils/showError';
    import { onDestroy, onMount } from 'svelte';
    import { Template } from '@nativescript-community/svelte-native/components';
    import { NativeViewElementNode } from '@nativescript-community/svelte-native/dom';
    import StoreValue from '~/components/common/StoreValue.svelte';
    import { onThemeChanged } from '~/helpers/theme';
    import type { SourceItem } from '~/mapModules/CustomLayersModule';
    import CustomLayersModule, { LOCAL_DATA_SUPPORTED, hybridImagery, localInventory, mapCapabilities } from '~/mapModules/CustomLayersModule';
    import { disabledLocalData } from '~/mapModules/localData/scan';
    import { archivesSummary } from './offlineData';
    import { getMapContext } from '~/mapModules/MapModule';
    import { nutiProps, pitchEnabled, projectionModeSpherical, styleHasParameter, styleParameterKeys } from '~/stores/mapStore';
    import { openLink, showPopoverMenu } from '~/utils/ui/index.common';
    import { colors, fontScaleMaxed } from '~/variables';
    import IconButton from '../common/IconButton.svelte';
    import Pill from '../common/Pill.svelte';
    import { layerCapabilities, layerTitle, runLayerAction } from './layerActions';
    import { HorizontalPosition, VerticalPosition } from '@nativescript-community/ui-popover';
    import PanelHeader from '../common/PanelHeader.svelte';
    import ReorderLongPressHandler from './ReorderLongPressHandler';
    $: ({ colorBackground, colorError, colorOnSurface, colorOnSurfaceVariant, colorOutline, colorPrimary, colorSurfaceContainer } = $colors);

    const mapContext = getMapContext();
    let gridLayout: NativeViewElementNode<GridLayout>;
    let collectionView: NativeViewElementNode<CollectionViewWithSwipeMenu>;

    export let customLayers: CustomLayersModule = null;
    export let customSources: ObservableArray<SourceItem> = [] as any;
    const currentLegend: string = null;

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

    async function addSource() {
        try {
            await customLayers.addSource();
        } catch (error) {
            showError(error);
        }
    }
    function clearCache() {}
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
        if (item.layer.opacity() === opacity) {
            return;
        }
        const wasVisible = item.layer.opacity() > 0;
        item.layer.opacity(opacity).visible(opacity > 0);
        setNumber(item.name + '_opacity', opacity);
        // the terrain slots follow the top-most shown base map
        if (wasVisible !== opacity > 0 && item.layer.is('massif::CompositeVectorTileLayer')) {
            customLayers?.updateTerrainAttachment();
        }
        mapContext.getMap().requestRedraw();
        updateItem(item);
    }

    // what the map uses out of the folder: disabled archives left out
    $: offlineSummary = (() => {
        const archives = [...($localInventory?.world ?? []), ...($localInventory?.regions ?? []).filter((region) => !$disabledLocalData.has(region.id)).flatMap((region) => region.archives)].filter(
            (archive) => !$disabledLocalData.has(archive.id)
        );
        return archives.length ? archivesSummary(archives) : lc('offline_data_none');
    })();

    async function showOfflineData() {
        const OfflineDataSheet = (await import('./OfflineDataSheet.svelte')).default;
        closeBottomSheet();
        setTimeout(
            () => {
                showBottomSheet({
                    parent: gridLayout,
                    view: OfflineDataSheet,
                    skipCollapsedState: true,
                    dismissOnBackgroundTap: true,
                    disableDimBackground: true
                });
            },
            __IOS__ ? 500 : 0
        );
    }

    async function showSourceOptions(item: SourceItem) {
        const LayerOptionsBottomSheet = (await import('./LayerOptionsBottomSheet.svelte')).default;
        closeBottomSheet();
        setTimeout(
            () => {
                showBottomSheet({
                    parent: gridLayout,
                    view: LayerOptionsBottomSheet,
                    skipCollapsedState: true,
                    dismissOnBackgroundTap: true,
                    disableDimBackground: true,
                    props: {
                        item
                    }
                });
            },
            __IOS__ ? 500 : 0
        );
    }
    async function onItemReordered(e) {
        (e.view as ContentView).content.opacity = 1;
    }
    async function onItemReorderStarting(e) {
        (e.view as ContentView).content.opacity = 0.6;
    }
    function onButtonLongPress(item, event: TouchGestureEventData) {
        collectionView.nativeView.startDragging(customSources.indexOf(item), event.getAllPointers()?.[0]);
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

    // the opacity a hidden layer comes back to
    const opacityBeforeHide = new Map<string, number>();
    function toggleLayerVisible(item: SourceItem) {
        const opacity = item.layer.opacity();
        if (opacity > 0) {
            opacityBeforeHide.set(item.name, opacity);
        }
        onLayerOpacityChanged(item, { value: opacity > 0 ? 0 : (opacityBeforeHide.get(item.name) ?? 1) });
        collectionView?.nativeView?.refreshVisibleItems();
    }

    async function showLayerMenu(item: SourceItem, event) {
        try {
            const capabilities = layerCapabilities(item);
            const hidden = item.layer.opacity() === 0;
            const options = [
                { id: 'toggle_visible', name: hidden ? lc('show') : lc('hide'), icon: hidden ? 'mdi-eye-off-outline' : 'mdi-eye-outline' },
                capabilities.downloadable && { id: 'download_area', name: lc('download_area'), icon: 'mdi-download' },
                capabilities.cacheable && { id: 'clear_cache', name: lc('clear_cache'), icon: 'mdi-clock-remove-outline' },
                capabilities.removable && { id: 'delete', name: lc('remove_layer'), icon: 'mdi-delete', color: colorError }
            ].filter(Boolean);
            await showPopoverMenu({
                options,
                anchor: event.object,
                vertPos: VerticalPosition.BELOW,
                horizPos: HorizontalPosition.ALIGN_RIGHT,
                props: { autoSizeListItem: true },
                onClose: async (option) => {
                    if (option.id === 'toggle_visible') {
                        toggleLayerVisible(item);
                    } else {
                        await runLayerAction(item, option.id);
                    }
                }
            });
        } catch (error) {
            showError(error);
        }
    }
    function onCloseBottomSheet() {
        collectionView?.nativeView?.closeCurrentMenu();
    }

    let reorderLongPressHandler;
    let reorderLongPressGesture;

    function onReorderButtonLoaded(event) {
        try {
            reorderLongPressHandler = ReorderLongPressHandler.initWithOwner(new WeakRef(collectionView.nativeElement));
            reorderLongPressGesture = UILongPressGestureRecognizer.alloc().initWithTargetAction(reorderLongPressHandler, 'longPress');
            event.object.nativeViewProtected.addGestureRecognizer(reorderLongPressGesture);
        } catch (error) {
            showError(error);
        }
    }
    const nutiIconParams = ['contours', 'buildings'] as const;
</script>

<!-- on iOS a bottomsheet adds a safe-area padding to the collectionview: contentInsetAdjustmentBehavior removes it -->
<gesturerootview class="bottomsheet" {...$$restProps} height={(LOCAL_DATA_SUPPORTED ? 470 : 400) + ($hybridImagery ? 64 : 0)} rows="auto,auto,auto,auto,*" on:closedBottomSheet={onCloseBottomSheet}>
    <PanelHeader icon="mdi-layers-outline" title={lc('layers')}>
        <Pill icon="mdi-plus" label={lc('add')} on:tap={addSource} />
    </PanelHeader>
    <!-- the map-wide toggles, then the layer stack top first -->
    <wraplayout padding="0 12 4 12" row={1}>
        {#each nutiIconParams
            .filter((key) => styleHasParameter($styleParameterKeys, key))
            .map((key) => ({ ...nutiProps.getSettingsOptions(key), id: key }))
            .filter((s) => s.visible?.($mapCapabilities) ?? true) as option}
            <StoreValue store={option.store} let:value>
                <Pill icon={option.icon} label={lc(option.id)} selected={value} on:tap={() => option.store.set(!value)} on:longPress={(event) => option.onLongPress?.(event)} />
            </StoreValue>
        {/each}
        <Pill icon="mdi-rotate-orbit" label={lc('pitch')} selected={$pitchEnabled} on:tap={() => pitchEnabled.set(!$pitchEnabled)} />
    </wraplayout>
    {#if LOCAL_DATA_SUPPORTED}
        <gridlayout backgroundColor={colorSurfaceContainer} borderRadius={12} columns="auto,*,auto" margin="4 12" padding="10 12" rippleColor={colorPrimary} row={2} on:tap={showOfflineData}>
            <label class="panelIcon" text="mdi-database-outline" verticalAlignment="middle" />
            <stacklayout col={1} paddingLeft={12} verticalAlignment="middle">
                <label color={colorOnSurface} fontSize={15} fontWeight="bold" text={lc('offline_data')} />
                <label color={colorOnSurfaceVariant} fontSize={12} lineBreak="end" maxLines={1} text={offlineSummary} />
            </stacklayout>
            <label class="mdi" col={2} color={colorOnSurfaceVariant} fontSize={22} text="mdi-chevron-right" verticalAlignment="middle" />
        </gridlayout>
    {/if}
    <!-- the hybrid variant's imagery: under the whole stack, so not one of its rows -->
    {#if $hybridImagery}
        <gridlayout
            backgroundColor={colorSurfaceContainer}
            borderRadius={12}
            columns="auto,*,auto"
            margin="4 12"
            padding="10 12"
            rippleColor={colorPrimary}
            row={3}
            on:tap={() => showSourceOptions($hybridImagery)}>
            <label class="panelIcon" text="mdi-satellite-variant" verticalAlignment="middle" />
            <stacklayout col={1} paddingLeft={12} verticalAlignment="middle">
                <label color={colorOnSurface} fontSize={15} fontWeight="bold" text={lc('hybrid_imagery')} />
                <label color={colorOnSurfaceVariant} fontSize={12} lineBreak="end" maxLines={1} text={layerTitle($hybridImagery)} />
            </stacklayout>
            <label class="mdi" col={2} color={colorOnSurfaceVariant} fontSize={22} text="mdi-chevron-right" verticalAlignment="middle" />
        </gridlayout>
    {/if}
    <gridlayout bind:this={gridLayout} row={4} rows="auto,*">
        <label class="sectionHeader" padding="4 16 0 16" text={lc('layer_stack')} />
        <collectionview
            bind:this={collectionView}
            id="scrollView"
            items={customSources}
            row={1}
            ios:contentInsetAdjustmentBehavior={2}
            android:reorderEnabled={true}
            rowHeight={84 * Math.sqrt($fontScaleMaxed)}
            on:itemReordered={onItemReordered}
            on:itemReorderStarting={onItemReorderStarting}>
            <Template let:item>
                <swipemenu
                    id={item.name}
                    closeAnimationDuration={100}
                    gestureHandlerOptions={{
                        failOffsetYStart: -40,
                        failOffsetYEnd: 40,
                        minDist: 50
                    }}
                    leftSwipeDistance={item.local ? 0.0001 : 130}
                    openAnimationDuration={100}
                    startingSide={item.startingSide}
                    translationFunction={drawerTranslationFunction}>
                    <gridlayout prop:mainContent backgroundColor={colorBackground} columns="auto,*,auto" padding="8 0 0 0" rows="auto,*">
                        <!-- drag to reorder -->
                        <IconButton
                            color={colorOnSurfaceVariant}
                            onLongPress={__ANDROID__ ? (event) => onButtonLongPress(item, event) : null}
                            rowSpan={2}
                            text="mdi-drag-vertical"
                            tooltip={lc('reorder')}
                            width={40}
                            on:loaded={onReorderButtonLoaded} />
                        <gridlayout col={1} columns="*,auto">
                            <label
                                ios:class="ignoreA11yFontScale"
                                color={item.layer.opacity() === 0 ? colorOnSurfaceVariant : colorOnSurface}
                                fontSize={15 * $fontScaleMaxed}
                                fontWeight="bold"
                                lineBreak="end"
                                maxLines={1}
                                text={layerTitle(item)} />
                            <label col={1} color={colorOnSurfaceVariant} fontSize={13} text={Math.round(item.layer.opacity() * 100) + ' %'} verticalAlignment="top" />
                            <label
                                colSpan={2}
                                color={colorOnSurfaceVariant}
                                fontSize={11 * $fontScaleMaxed}
                                html={item.provider.attribution}
                                linkColor={colorOnSurfaceVariant}
                                {...{ linkUnderline: false }}
                                marginTop={20 * $fontScaleMaxed}
                                maxLines={1}
                                visibility={item.provider.attribution ? 'visible' : 'collapse'}
                                on:linkTap={onLinkTap} />
                        </gridlayout>
                        <slider
                            col={1}
                            marginBottom={8}
                            marginLeft={-10}
                            marginRight={24}
                            marginTop={0}
                            maxValue={1}
                            minValue={0}
                            row={1}
                            value={item.layer.opacity()}
                            verticalAlignment="middle"
                            on:valueChange={(event) => onLayerOpacityChanged(item, event)} />
                        <IconButton
                            col={2}
                            color={colorOnSurfaceVariant}
                            onLongPress={(event) => showLayerMenu(item, event)}
                            rowSpan={2}
                            text="mdi-tune-variant"
                            tooltip={lc('layer_settings')}
                            width={44}
                            on:tap={() => showSourceOptions(item)} />
                        <progress col={1} row={1} value={item.downloadProgress} verticalAlignment="bottom" visibility={item.downloading > 0 ? 'visible' : 'collapse'} />
                    </gridlayout>
                    <mdbutton
                        prop:leftDrawer
                        id="deleteBtn"
                        class="icon-btn"
                        backgroundColor={colorError}
                        color="white"
                        height="100%"
                        shape="none"
                        text="mdi-trash-can"
                        textAlignment="center"
                        variant="text"
                        verticalTextAlignment="middle"
                        width={60}
                        on:tap={() => deleteSource(item)} />
                </swipemenu>
            </Template>
        </collectionview>
    </gridlayout>
</gesturerootview>
