<script lang="ts">
    import { lc } from '@nativescript-community/l';
    import { CollectionViewWithSwipeMenu } from '@nativescript-community/ui-collectionview-swipemenu';
    import { closeBottomSheet, showBottomSheet } from '@nativescript-community/ui-material-bottomsheet/svelte';
    import { ContentView, GridLayout, TouchGestureEventData } from '@nativescript/core';
    import { setNumber } from '@nativescript/core/application-settings';
    import { ObservableArray } from '@nativescript/core/data/observable-array';
    import { debounce, throttle } from '@nativescript/core/utils';
    import { onDestroy, onMount } from 'svelte';
    import { Template } from 'svelte-native/components';
    import { NativeViewElementNode } from 'svelte-native/dom';
    import StoreValue from '~/components/common/StoreValue.svelte';
    import { onThemeChanged } from '~/helpers/theme';
    import type { SourceItem } from '~/mapModules/CustomLayersModule';
    import CustomLayersModule from '~/mapModules/CustomLayersModule';
    import { getMapContext } from '~/mapModules/MapModule';
    import { pitchEnabled, projectionModeSpherical, nutiProps } from '~/stores/mapStore';
    import { showError } from '@shared/utils/showError';
    import { openLink, showSliderPopover } from '~/utils/ui/index.common';
    import { colors } from '~/variables';
    import IconButton from '../common/IconButton.svelte';
    import { VerticalPosition } from '@nativescript-community/ui-popover';
    import ReorderLongPressHandler from './ReorderLongPressHandler';
    $: ({ colorBackground, colorError, colorOnSurface, colorOnSurfaceVariant, colorOutline, colorOutlineVariant, colorPrimary } = $colors);

    const mapContext = getMapContext();
    let gridLayout: NativeViewElementNode<GridLayout>;
    let collectionView: NativeViewElementNode<CollectionViewWithSwipeMenu>;

    export let customLayers: CustomLayersModule = null;
    export let customSources: ObservableArray<SourceItem> = [] as any;
    const currentLegend: string = null;
    // mapContext.onMapReady((view: CartoMap<LatLonKeys>) => {
    //     customLayers = mapContext.mapModule('customLayers');
    //     console.log('onMapready')
    //     customSources = customLayers.customSources;
    // });
    onMount(() => {
        customLayers = mapContext.mapModule('customLayers');  
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
    const nutiIconParams = ['contours', 'buildings']
</script>

<!-- on iOS the collectionview is applied a padding because of the safearea
while being shown using bottomsheet. We remove it with paddingTop -->
<gesturerootview {...$$restProps} height={240} on:closedBottomSheet={onCloseBottomSheet}>
    <gridlayout bind:this={gridLayout} columns="*,auto">
        <collectionview
            bind:this={collectionView}
            id="scrollView"
            items={customSources}
            ios:contentInsetAdjustmentBehavior={2}
            android:reorderEnabled={true}
            rowHeight={56}
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
                    <gridlayout
                        prop:mainContent
                        backgroundColor={colorBackground}
                        borderBottomColor={colorOutlineVariant}
                        borderBottomWidth={1}
                        columns="130,*,auto"
                        paddingLeft={15}
                        paddingRight={5}
                        rows="*">
                        <stacklayout verticalAlignment="center">
                            <label
                                color={item.layer.opacity === 0 ? colorOnSurfaceVariant : colorOnSurface}
                                fontSize={13}
                                fontWeight="bold"
                                lineBreak="end"
                                maxLines={2}
                                text={item.name.toUpperCase()} />
                            <label
                                color={colorOnSurfaceVariant}
                                fontSize={11}
                                html={item.provider.attribution}
                                linkColor={colorPrimary}
                                maxLines={2}
                                paddingTop={3}
                                visibility={item.provider.attribution ? 'visible' : 'collapse'}
                                on:linkTap={onLinkTap} />
                        </stacklayout>
                        <slider
                            col={1}
                            marginLeft={10}
                            marginRight={10}
                            maxValue={1}
                            minValue={0}
                            value={item.layer.opacity}
                            verticalAlignment="middle"
                            on:valueChange={(event) => onLayerOpacityChanged(item, event)} />
                        <IconButton
                            col={2}
                            gray={true}
                            onLongPress={__ANDROID__ ? (event) => onButtonLongPress(item, event) : null}
                            rowSpan={2}
                            text="mdi-dots-vertical"
                            on:tap={() => showSourceOptions(item)}
                            on:loaded={onReorderButtonLoaded} />
                        <progress colSpan={3} value={item.downloadProgress} verticalAlignment="bottom" visibility={item.downloading > 0 ? 'visible' : 'collapse'} />
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
        <stacklayout borderLeftColor={colorOutlineVariant} borderLeftWidth={1} col={1}>
            <IconButton gray={true} text="mdi-plus" on:tap={addSource} />
            {#each nutiIconParams.map(key=>({...nutiProps.getSettingsOptions(key), id:key})).filter(s=>s.visible?.(customLayers) ?? true) as option}
           <StoreValue store={option.store} let:value>      
              <IconButton isSelected={value} text={option.icon} toggable={true} tooltip={option.title} on:tap={() => option.store.update(!value)} onLongPress={option.onLongPress}/>
            </StoreValue>
        {/each}
            <IconButton isSelected={$projectionModeSpherical} text="mdi-globe-model" toggable={true} tooltip={lc('globe_mode')} on:tap={() => projectionModeSpherical.set(!$projectionModeSpherical)} />
            <IconButton isSelected={$pitchEnabled} text="mdi-rotate-orbit" toggable={true} tooltip={lc('map_pitch')} on:tap={() => pitchEnabled.set(!$pitchEnabled)} />
        </stacklayout>
    </gridlayout>
</gesturerootview>
