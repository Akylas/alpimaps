<script lang="ts">
    import { lc } from '@nativescript-community/l';
    import { createNativeAttributedString } from '@nativescript-community/text';
    import { Canvas, CanvasView, LayoutAlignment, Paint, StaticLayout } from '@nativescript-community/ui-canvas';
    import { Label } from '@nativescript-community/ui-label';
    import { showBottomSheet } from '@nativescript-community/ui-material-bottomsheet/svelte';
    import { alert } from '@nativescript-community/ui-material-dialogs';
    import { ApplicationSettings, GridLayout, Utils } from '@nativescript/core';
    import { showError } from '@shared/utils/showError';
    import { navigate } from '@shared/utils/svelte/ui';
    import type { Point } from 'geojson';
    import { onDestroy } from 'svelte';
    import { NativeViewElementNode } from '@nativescript-community/svelte-native/dom';
    import IconButton from '~/components/common/IconButton.svelte';
    import ScaleView from '~/components/map/ScaleView.svelte';
    import { formatDistance } from '~/helpers/formatter';
    import { onThemeChanged } from '~/helpers/theme';
    import { getMapContext } from '~/mapModules/MapModule';
    import UserLocationModule, { navigationModeStore } from '~/mapModules/UserLocationModule';
    import type { IItem } from '~/models/Item';
    import { RouteInstruction, RoutingAction } from '~/models/Item';
    import { queryingLocation, watchingLocation } from '~/stores/mapStore';
    import { openLink } from '~/utils/ui';
    import { colors, fontScaleMaxed, fonts } from '~/variables';

    let { colorOnPrimary, colorOnPrimaryContainer, colorOnSurface, colorOnSurfaceVariant, colorPrimary, colorPrimaryContainer, colorSurfaceContainer } = $colors;
    $: ({ colorOnPrimary, colorOnPrimaryContainer, colorOnSurface, colorOnSurfaceVariant, colorPrimary, colorPrimaryContainer, colorSurfaceContainer } = $colors);

    // const currentMapZoom = 0;
    let totalDownloadProgress = 0;
    let attributionVisible = false;
    const mapContext = getMapContext();

    let selectedItem: IItem = null;

    export let isUserInteractionEnabled: boolean = true;

    // let scaleView: ScaleView;
    let userLocationModule: UserLocationModule = null;
    // const currentLocation: MapPos = null;
    // let lastSuggestionKey: string;
    let gridLayout: NativeViewElementNode<GridLayout>;
    let navigationCanvas: NativeViewElementNode<CanvasView>;

    let locationButtonClass = 'buttontext';
    let locationButtonLabelClass: string = '';
    let selectedItemHasPosition = false;
    let instructionIcon;
    export let navigationInstructions: {
        remainingDistance: number;
        remainingTime: number;
        distanceToNextInstruction: number;
        instruction: RouteInstruction;
    };
    $: {
        if (navigationInstructions && navigationInstructions.instruction) {
            switch (navigationInstructions.instruction.a) {
                case RoutingAction.UTURN:
                    instructionIcon = 'alpimaps-u-turn';
                    break;
                case RoutingAction.FINISH:
                    instructionIcon = 'alpimaps-flag-checkered';
                    break;
                case RoutingAction.TURN_LEFT:
                    instructionIcon = 'alpimaps-left-turn-1';
                    break;
                case RoutingAction.TURN_RIGHT:
                    instructionIcon = 'alpimaps-right-turn-1';
                    break;
                case RoutingAction.STAY_ON_ROUNDABOUT:
                case RoutingAction.ENTER_ROUNDABOUT:
                    instructionIcon = 'alpimaps-roundabout';
                    break;
                default:
                case RoutingAction.HEAD_ON:
                case RoutingAction.GO_STRAIGHT:
                    instructionIcon = 'alpimaps-up-arrow';
                    break;
            }
        } else {
            instructionIcon = null;
        }
        navigationCanvas?.nativeView.invalidate();
    }

    onThemeChanged(() => navigationCanvas?.nativeView.invalidate());

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
    $: locationButtonClass = !$queryingLocation && $watchingLocation ? 'buttonthemed' : 'buttontext';
    $: locationButtonLabelClass = $queryingLocation ? 'fade-blink' : '';
    $: selectedItemHasPosition = selectedItem && !selectedItem.route && selectedItem.geometry.type === 'Point';
    // $: DEV_LOG && console.log('locationButtonClass', locationButtonClass);
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

    function askUserLocation() {
        return userLocationModule?.askUserLocation();
    }
    function onWatchLocation() {
        return userLocationModule?.onWatchLocation();
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

    let iconPaint: Paint;
    let textPaint: Paint;
    function drawNavigationInstruction({ canvas, object }: { canvas: Canvas; object: CanvasView }) {
        const w = canvas.getWidth();
        const h = canvas.getHeight();
        if (!iconPaint) {
            iconPaint = new Paint();
            iconPaint.fontFamily = $fonts.app;
        }
        if (!textPaint) {
            textPaint = new Paint();
        }
        textPaint.setColor(colorOnSurface);
        iconPaint.setColor(colorOnSurface);
        iconPaint.setTextSize(40);
        canvas.save();

        if (navigationInstructions.instruction) {
            let staticLayout = new StaticLayout(instructionIcon, iconPaint, w, LayoutAlignment.ALIGN_NORMAL, 1, 0, true);
            canvas.translate(10, h / 2 - staticLayout.getHeight() / 2);
            staticLayout.draw(canvas);
            canvas.restore();
            if (navigationInstructions.distanceToNextInstruction > 0) {
                const data = formatDistance(navigationInstructions.distanceToNextInstruction);
                textPaint.setTextSize(11);
                canvas.drawText(`${data}`, 14, h / 2 + staticLayout.getHeight() / 2 + 15, textPaint);
            }

            // textPaint.setTextSize(13);

            const nString = createNativeAttributedString({
                spans: [
                    {
                        fontWeight: 'bold',
                        fontSize: 15,
                        text: navigationInstructions.instruction.inst
                    }
                ].concat(
                    navigationInstructions.instruction.name
                        ? [
                              {
                                  color: colorOnSurfaceVariant,
                                  fontSize: 13,
                                  text: '\n' + navigationInstructions.instruction.name
                              }
                          ]
                        : ([] as any)
                )
            });
            staticLayout = new StaticLayout(nString, textPaint, w - 20 - 50, LayoutAlignment.ALIGN_NORMAL, 1, 0, true);
            canvas.translate(60, h / 2 - staticLayout.getHeight() / 2);
            staticLayout.draw(canvas);
            // if (navigationInstructions.instruction.name) {
            //     let transH = staticLayout.getHeight();
            //     textPaint.setTextSize(11);
            //     textPaint.setColor(colorOnSurfaceVariant);
            //     canvas.drawText(navigationInstructions.instruction.name, 0, transH + 10, textPaint);
            // }
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
            class="small-floating-btn btn-themed"
            col={2}
            horizontalAlignment="center"
            rowSpan={2}
            text="mdi-directions"
            visibility={selectedItemHasPosition ? 'visible' : 'hidden'}
            on:tap={startDirections} />
        <mdcardview id="location" class={`${locationButtonClass} floating-btn`} on:tap={askUserLocation} on:longPress={onWatchLocation}>
            <label
                ios:iosAccessibilityAdjustsFontSize={false}
                class={`mdi ${locationButtonLabelClass}`}
                color={$watchingLocation && !$queryingLocation ? colorOnPrimary : colorPrimary}
                fontSize={24 * $fontScaleMaxed}
                text="mdi-crosshairs-gps"
                textAlignment="center"
                verticalAlignment="middle" />
        </mdcardview>
    </stacklayout>
    <IconButton
        col={1}
        color={colorOnSurfaceVariant}
        horizontalAlignment="right"
        isSelected={$navigationModeStore}
        isVisible={$watchingLocation && !$queryingLocation}
        marginBottom={16}
        row={2}
        text={$navigationModeStore ? 'mdi-navigation' : 'mdi-navigation-outline'}
        verticalAlignment="bottom"
        on:tap={() => (userLocationModule.navigationMode = !$navigationModeStore)} />
    <stacklayout id="stack2" horizontalAlignment="left" marginTop={80} row={2} verticalAlignment="bottom">
        <!-- <mdbutton on:tap={open3DMap} class="small-floating-btn" color={colorPrimary} text="mdi-video-3d" /> -->
        <mdbutton id="list" class="small-floating-btn" text="mdi-format-list-checkbox" on:tap={showItemsList} on:longPress={onListItemLongPress} />
        <mdbutton id="layers" class="small-floating-btn" text="mdi-layers" on:tap={showMapRightMenu} on:longPress={() => mapContext.selectStyle()} />
    </stacklayout>

    <ScaleView col={1} horizontalAlignment="right" marginBottom={8} row={2} verticalAlignment="bottom" />
    <IconButton
        col={1}
        horizontalAlignment="left"
        isSelected={true}
        isVisible={attributionVisible}
        row={2}
        text="mdi-information-outline"
        tooltip={lc('attributions')}
        verticalAlignment="bottom"
        on:tap={onAttributionTap} />

    <gridlayout
        backgroundColor={colorPrimaryContainer}
        borderRadius="50%"
        col={1}
        columns="auto,auto"
        horizontalAlignment="left"
        marginBottom={10}
        row={2}
        verticalAlignment="bottom"
        visibility={totalDownloadProgress > 0 ? 'visible' : 'collapse'}>
        <label color={colorOnPrimaryContainer} fontSize={13} padding={10} text={lc('downloading_area', Math.round(totalDownloadProgress))} verticalTextAlignment="center" />
        <mdbutton class="mdi" col={1} color={colorOnPrimaryContainer} fontSize={13} marginRight={10} text="mdi-close" variant="text" width={40} on:tap={stopDatasourceDownload} />
    </gridlayout>

    <progress colSpan={3} row={3} value={totalDownloadProgress} verticalAlignment="bottom" visibility={totalDownloadProgress > 0 ? 'visible' : 'collapse'} />
    <canvasview
        bind:this={navigationCanvas}
        backgroundColor={colorSurfaceContainer}
        borderRadius={6}
        col={1}
        height={80}
        marginBottom={24}
        rowSpan={3}
        verticalAlignment="bottom"
        visibility="collapse"
        width="70%"
        on:swipe={() => (navigationInstructions = null)}
        on:draw={drawNavigationInstruction} />
</gridlayout>
