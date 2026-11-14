<script lang="ts">
    import { lc } from '@nativescript-community/l';
    import { Label } from '@nativescript-community/ui-label';
    import { showBottomSheet } from '@nativescript-community/ui-bottomsheet/svelte';
    import { HorizontalPosition, VerticalPosition } from '@nativescript-community/ui-popover';
    import { alert } from '@nativescript-community/ui-dialogs';
    import { ApplicationSettings, GridLayout, Utils, View } from '@nativescript/core';
    import { showError } from '@shared/utils/showError';
    import { navigate } from '@shared/utils/svelte/ui';
    import type { Point } from 'geojson';
    import { onDestroy } from 'svelte';
    import { NativeViewElementNode } from '@nativescript-community/svelte-native/dom';
    import IconButton from '~/components/common/IconButton.svelte';
    import { isEInk } from '~/helpers/theme';
    import ScaleView from '~/components/map/ScaleView.svelte';
    import { getMapContext } from '~/mapModules/MapModule';
    import UserLocationModule, { navigationModeStore, userFollowStore } from '~/mapModules/UserLocationModule';
    import type { IItem } from '~/models/Item';
    import { queryingLocation, watchingLocation } from '~/stores/mapStore';
    import { isNavigating, isNavigationRunning } from '~/stores/navigationStore';
    import { showNoEntry, showTurnOptions } from '~/stores/navigationStore';
    import { activeTravelProfile, travelMode, travelModeLocked } from '~/stores/travelModeStore';
    import type { TravelMode } from '~/routeFeatures/junctions/travelMode';
    import { Profiles } from '~/utils/routing';
    import { openLink, showPopoverMenu, showSnack } from '~/utils/ui';
    import { colors, fontScaleMaxed, fonts } from '~/variables';

    let { colorOnPrimary, colorOnSurface, colorOnSurfaceVariant, colorPrimary, colorSurface } = $colors;
    $: ({ colorOnPrimary, colorOnSurface, colorOnSurfaceVariant, colorPrimary, colorSurface } = $colors);

    // const currentMapZoom = 0;
    let totalDownloadProgress = 0;
    let attributionVisible = false;
    const mapContext = getMapContext();

    let selectedItem: IItem = null;

    export let isUserInteractionEnabled: boolean = true;
    /** what covers the map on the left, the landscape navigation column */
    export let leftInset = 0;

    // let scaleView: ScaleView;
    let userLocationModule: UserLocationModule = null;
    // const currentLocation: MapPos = null;
    // let lastSuggestionKey: string;
    let gridLayout: NativeViewElementNode<GridLayout>;

    let locationButtonLabelClass: string = '';
    let selectedItemHasPosition = false;

    export function getNativeView() {
        return gridLayout && gridLayout.nativeView;
    }
    mapContext.onMapReady(() => {
        userLocationModule = mapContext.mapModule('userLocation');

        const customLayers = mapContext.mapModule('customLayers');
        if (customLayers) {
            customLayers.on('datasource_download_progress', onTotalDownloadProgress);
            customLayers.on('attribution', onAttribution);
        }
        // userLocationModule.on('location', onNewLocation);
    });
    $: watchingLocationActive = !$queryingLocation && $watchingLocation;
    $: locationButtonLabelClass = $queryingLocation ? 'fade-blink' : '';
    $: selectedItemHasPosition = selectedItem && !selectedItem.route && selectedItem.geometry.type === 'Point';
    export function onSelectedItem(item: IItem, oldItem: IItem) {
        selectedItem = item;
    }
    onDestroy(() => {
        userLocationModule = null;

        const customLayers = mapContext.mapModule('customLayers');
        if (customLayers) {
            customLayers.off('datasource_download_progress', onTotalDownloadProgress);
        }
    });

    // function onNewLocation(e: any) {
    //     currentLocation = e.data;
    // }

    function onTotalDownloadProgress(e) {
        // DEV_LOG && console.log('onTotalDownloadProgress', e.data);
        if (e.data === 100) {
            totalDownloadProgress = 0;
        } else {
            totalDownloadProgress = e.data;
        }
    }
    function onAttribution(e) {
        const devMode = mapContext.mapModule('customLayers').devMode;
        attributionVisible = !devMode && e.needsAttribution;
    }

    // while navigating, only needed to bring the camera back after a pan
    $: locationButtonVisible = !$isNavigating || !$userFollowStore;

    const SEGMENT_HEIGHT = 54;
    let capsule: NativeViewElementNode<View>;
    let modeSegment: NativeViewElementNode<GridLayout>;
    let modeShown: boolean = null;
    // the capsule grows upwards while watching, and while navigating, where it shows the route's mode: the location button stays at its foot
    $: if (capsule && modeSegment) {
        showModeSegment(watchingLocationActive || $isNavigating);
    }
    function showModeSegment(show: boolean) {
        const height = show ? SEGMENT_HEIGHT * 2 : SEGMENT_HEIGHT;
        const opacity = show ? 1 : 0;
        const first = modeShown === null;
        modeShown = show;
        if (first || isEInk) {
            capsule.nativeView.height = height;
            modeSegment.nativeView.opacity = opacity;
        } else {
            void capsule.nativeView.animate({ height, duration: 180 });
            void modeSegment.nativeView.animate({ opacity, duration: 180 });
        }
    }

    function askUserLocation() {
        if ($isNavigationRunning) {
            // plain follow would lose the navigation tilt and offset, so re-engage the whole camera mode
            userLocationModule.navigationMode = true;
            return;
        }
        return userLocationModule?.askUserLocation();
    }
    function onWatchLocation() {
        return userLocationModule?.onWatchLocation();
    }
    async function onTravelModeTap(event) {
        try {
            if ($travelModeLocked) {
                showSnack({ message: lc('travel_mode_locked', lc($activeTravelProfile === 'bicycle' ? 'bicycle' : $activeTravelProfile === 'pedestrian' ? 'walk' : 'car')) });
                return;
            }
            const modes: { mode: TravelMode; title: string; icon: string }[] = [
                { mode: 'walk', title: lc('walk'), icon: 'mdi-walk' },
                { mode: 'bike', title: lc('bicycle'), icon: 'mdi-bike' },
                { mode: 'car', title: lc('car'), icon: 'mdi-car' },
                { mode: 'auto', title: lc('travel_mode_auto'), icon: 'mdi-routes' }
            ];
            await showPopoverMenu({
                anchor: event.object,
                vertPos: VerticalPosition.ABOVE,
                horizPos: HorizontalPosition.LEFT,
                // the mode in use is the accent one
                options: modes.map((option) => ({ ...option, color: option.mode === $travelMode ? colorPrimary : undefined })),
                props: {
                    autoSizeListItem: true,
                    rowHeight: 52,
                    toggles: [
                        { id: 'turns', icon: 'mdi-arrow-split-vertical', label: lc('junction_turns'), selected: $showTurnOptions },
                        { id: 'noEntry', icon: 'mdi-hand-back-right', label: lc('junction_no_entry'), selected: $showNoEntry }
                    ],
                    onToggle: (toggle) => (toggle.id === 'turns' ? showTurnOptions : showNoEntry).set(toggle.selected)
                },
                onClose: (item) => {
                    if (item?.mode) {
                        $travelMode = item.mode;
                    }
                }
            });
        } catch (error) {
            showError(error);
        }
    }
    function startDirections() {
        if (selectedItem) {
            const module = mapContext.mapModule('directionsPanel');
            const geometry = selectedItem.geometry as Point;
            module.addStartOrStopPoint({ lat: geometry.coordinates[1], lon: geometry.coordinates[0] }, selectedItem.properties);
        }
    }

    async function showItemsList() {
        try {
            const RoutesList = (await import('~/components/items/ItemsList.svelte')).default;
            navigate({ page: RoutesList });
        } catch (error) {
            showError(error);
        }
    }
    async function showMapRightMenu() {
        // try {
        //     const RoutesList = (await import('~/components/Testpage.svelte')).default;
        //     navigate({ page: RoutesList });
        // } catch (error) {
        //     showError(error);
        // }
        try {
            const LayersMenu = (await import('~/components/layers/LayersMenu.svelte')).default;
            return showBottomSheet({
                skipCollapsedState: true,
                view: LayersMenu
            });
        } catch (error) {
            showError(error);
        }
    }

    // async function open3DMap() {
    //     try {
    //         const position = mapContext.getMap().getFocusPos();
    //         if (!position.altitude) {
    //             position.altitude = await packageService.getElevation(position);
    //         }
    //         const hillshadeDatasource = packageService.hillshadeLayer?.dataSource;
    //         const vectorDataSource = packageService.localVectorTileLayer?.dataSource;
    //         const customSources = mapContext.mapModules.customLayers.customSources;
    //         let rasterDataSource: TileDataSource<any, any>;
    //         customSources.some((s) => {
    //             if (s.layer instanceof RasterTileLayer) {
    //                 rasterDataSource = s.layer.options.dataSource;
    //                 return true;
    //             }
    //         });
    //         if (!rasterDataSource) {
    //             rasterDataSource = await mapContext.mapModules.customLayers.getDataSource('openstreetmap');
    //         }
    //         const component = (await import('~/components/3DMap.svelte')).default;
    //         navigate({
    //             page: component,
    //             props: {
    //                 position,
    //                 vectorDataSource,
    //                 dataSource: hillshadeDatasource,
    //                 rasterDataSource
    //             }
    //         });
    //     } catch (err) {
    //         showError(err);
    //     }
    // }

    function onAttributionTap() {
        const customLayers = mapContext.mapModule('customLayers');
        if (customLayers) {
            const attributions = customLayers.getAllAtributions();
            const label = new Label();
            label.style.padding = '10 20 0 20';
            label.color = colorOnSurface as any;
            label.linkColor = colorPrimary;
            label.html = attributions.join('<br/>');
            label.textWrap = true;
            label.on('linkTap', (e) => openLink(e['link']));
            return alert({
                title: lc('attributions'),
                view: label,
                okButtonText: lc('ok')
            });
        }
    }
    async function stopDatasourceDownload() {
        try {
            mapContext.mapModule('customLayers')?.stopDownloads();
        } catch (error) {
            showError(error);
        }
    }
    async function onListItemLongPress() {
        try {
            if (ApplicationSettings.getBoolean('list_longpress_camera', false)) {
                const intent = new android.content.Intent('android.media.action.STILL_IMAGE_CAMERA_SECURE');
                intent.addFlags(android.content.Intent.FLAG_ACTIVITY_NEW_TASK);
                Utils.android.getApplicationContext().startActivity(intent);
            }
        } catch (error) {
            showError(error);
        }
    }
</script>

<gridlayout bind:this={gridLayout} id="scrollingWidgets" {...$$restProps} columns="auto,*,auto" isPassThroughParentEnabled={true} {isUserInteractionEnabled} rows="auto,*,auto,auto">
    <stacklayout id="stack1" col={2} padding={2} row={2} verticalAlignment="bottom">
        <mdbutton
            id="directions"
            class="small-floating-btn"
            col={2}
            color={colorPrimary}
            horizontalAlignment="center"
            rowSpan={2}
            text="mdi-directions"
            visibility={!$isNavigating && selectedItemHasPosition ? 'visible' : 'hidden'}
            on:tap={startDirections} />
        <!-- one capsule: the mode segment grows above the location button while watching, which fills with the accent -->
        <mdcardview bind:this={capsule} id="location" class="buttontext floating-btn" visibility={locationButtonVisible ? 'visible' : 'collapse'}>
            <!-- a grid, not a stack: a stack is measured within the card's height, which pushes the location button out of view -->
            <gridlayout>
                <gridlayout bind:this={modeSegment} id="travelMode" height={SEGMENT_HEIGHT} marginBottom={SEGMENT_HEIGHT} opacity={0} verticalAlignment="bottom" width={54} on:tap={onTravelModeTap}>
                    <label
                        color={colorOnSurface}
                        fontFamily={Profiles[$activeTravelProfile].fontFamily ? $fonts[Profiles[$activeTravelProfile].fontFamily] : $fonts.mdi}
                        fontSize={24 * $fontScaleMaxed}
                        text={Profiles[$activeTravelProfile].icon}
                        textAlignment="center"
                        verticalAlignment="middle" />
                    {#if $travelModeLocked}
                        <label class="mdi" color={colorOnSurfaceVariant} fontSize={13} horizontalAlignment="right" margin="0 8 6 0" text="mdi-lock" verticalAlignment="bottom" />
                    {:else if $travelMode === 'auto'}
                        <label
                            backgroundColor={colorOnSurfaceVariant}
                            borderRadius={8}
                            color={colorSurface}
                            fontSize={10}
                            fontWeight="bold"
                            height={16}
                            horizontalAlignment="right"
                            margin="0 6 6 0"
                            text="A"
                            textAlignment="center"
                            verticalAlignment="bottom"
                            width={16} />
                    {/if}
                </gridlayout>
                <gridlayout
                    backgroundColor={watchingLocationActive ? colorPrimary : 'transparent'}
                    height={SEGMENT_HEIGHT}
                    verticalAlignment="bottom"
                    width={54}
                    on:tap={askUserLocation}
                    on:longPress={onWatchLocation}>
                    <label
                        ios:iosAccessibilityAdjustsFontSize={false}
                        class={`mdi ${locationButtonLabelClass}`}
                        color={watchingLocationActive ? colorOnPrimary : colorPrimary}
                        fontSize={24 * $fontScaleMaxed}
                        text="mdi-crosshairs-gps"
                        textAlignment="center"
                        verticalAlignment="middle" />
                </gridlayout>
            </gridlayout>
        </mdcardview>
    </stacklayout>
    <IconButton
        col={1}
        color={colorOnSurfaceVariant}
        horizontalAlignment="right"
        isSelected={$navigationModeStore}
        isVisible={$watchingLocation && !$queryingLocation && !$isNavigating}
        marginBottom={16}
        row={2}
        text={$navigationModeStore ? 'mdi-navigation' : 'mdi-navigation-outline'}
        verticalAlignment="bottom"
        on:tap={() => (userLocationModule.navigationMode = !$navigationModeStore)} />
    <stacklayout id="stack2" horizontalAlignment="left" marginTop={80} row={2} verticalAlignment="bottom" visibility={$isNavigating ? 'collapse' : 'visible'}>
        <!-- <mdbutton on:tap={open3DMap} class="small-floating-btn" color={colorPrimary} text="mdi-video-3d" /> -->
        <mdbutton id="list" class="small-floating-btn" text="mdi-format-list-checkbox" on:tap={showItemsList} on:longPress={onListItemLongPress} />
        <mdbutton id="layers" class="small-floating-btn" text="mdi-layers" on:tap={showMapRightMenu} on:longPress={() => mapContext.selectStyle()} />
    </stacklayout>

    <ScaleView col={1} horizontalAlignment={$isNavigating ? 'left' : 'right'} marginBottom={8} marginLeft={8 + leftInset} row={2} verticalAlignment="bottom" />
    <IconButton
        col={1}
        horizontalAlignment="left"
        isSelected={true}
        isVisible={!$isNavigating && attributionVisible}
        row={2}
        text="mdi-information-outline"
        tooltip={lc('attributions')}
        verticalAlignment="bottom"
        on:tap={onAttributionTap} />

    <gridlayout
        class="panel"
        borderRadius={20}
        col={1}
        columns="auto,auto"
        horizontalAlignment="left"
        marginBottom={10}
        row={2}
        verticalAlignment="bottom"
        visibility={totalDownloadProgress > 0 ? 'visible' : 'collapse'}>
        <label color={colorOnSurface} fontSize={13} padding={10} text={lc('downloading_area', Math.round(totalDownloadProgress))} verticalTextAlignment="center" />
        <mdbutton class="mdi" col={1} color={colorOnSurface} fontSize={13} marginRight={10} text="mdi-close" variant="text" width={40} on:tap={stopDatasourceDownload} />
    </gridlayout>

    <progress colSpan={3} row={3} value={totalDownloadProgress} verticalAlignment="bottom" visibility={totalDownloadProgress > 0 ? 'visible' : 'collapse'} />
</gridlayout>
