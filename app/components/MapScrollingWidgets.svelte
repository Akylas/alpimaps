<script lang="ts">
    import { l, lc } from '@nativescript-community/l';
    import { createNativeAttributedString } from '@nativescript-community/text';
    import { Canvas, CanvasView, LayoutAlignment, Paint, StaticLayout } from '@nativescript-community/ui-canvas';
    import type { MapPos } from '@nativescript-community/ui-carto/core';
    import { TileDataSource } from '@nativescript-community/ui-carto/datasources';
    import { RasterTileLayer } from '@nativescript-community/ui-carto/layers/raster';
    import type { PackageStatus } from '@nativescript-community/ui-carto/packagemanager';
    import { PackageAction } from '@nativescript-community/ui-carto/packagemanager';
    import { alert, confirm } from '@nativescript-community/ui-material-dialogs';
    import { showSnack } from '@nativescript-community/ui-material-snackbar';
    import { CoreTypes, GridLayout, ViewBase } from '@nativescript/core';
    import type { Point } from 'geojson';
    import { debounce } from 'push-it-to-the-limit';
    import { onDestroy, onMount } from 'svelte';
    import { NativeViewElementNode, navigate } from 'svelte-native/dom';
    import { asSvelteTransition } from 'svelte-native/transitions';
    import OptionPicker from '~/components/OptionPicker.svelte';
    import ScaleView from '~/components/ScaleView.svelte';
    import { convertDistance } from '~/helpers/formatter';
    import { onThemeChanged } from '~/helpers/theme';
    import { getMapContext } from '~/mapModules/MapModule';
    import UserLocationModule from '~/mapModules/UserLocationModule';
    import type { IItem } from '~/models/Item';
    import { RouteInstruction, RoutingAction } from '~/models/Item';
    import { packageService } from '~/services/PackageService';
    import { queryingLocation, watchingLocation } from '~/stores/mapStore';
    import { showError } from '~/utils/error';
    import { resolveComponentElement, showBottomSheet } from '~/utils/svelte/bottomsheet';
    import { accentColor, alpimapsFontFamily, globalMarginTop, mdiFontFamily, primaryColor, subtitleColor, textColor, widgetBackgroundColor } from '~/variables';
    import { Label } from '@nativescript-community/ui-label';
    import { openLink } from '~/utils/ui';
    import IconButton from './IconButton.svelte';
    function scale(node, { delay = 0, duration = 400, easing = CoreTypes.AnimationCurve.easeOut }) {
        const scaleX = node.nativeView.scaleX;
        const scaleY = node.nativeView.scaleY;
        return asSvelteTransition(node, delay, duration, easing, (t) => ({
            scale: {
                x: t * scaleX,
                y: t * scaleY
            }
        }));
    }

    let currentMapZoom = 0;
    let totalDownloadProgress = 0;
    let attributionVisible = false;
    const mapContext = getMapContext();

    let selectedItem: IItem = null;

    export let userInteractionEnabled: boolean = true;

    let scaleView: ScaleView;
    let userLocationModule: UserLocationModule = null;
    let currentLocation: MapPos = null;
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
    } = undefined;
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
            customLayers.on('onProgress', onTotalDownloadProgress);
            customLayers.on('attribution', onAttribution);
        }
        // userLocationModule.on('location', onNewLocation);
    });
    $: locationButtonClass = !$queryingLocation && $watchingLocation ? 'buttonthemed' : 'buttontext';
    $: locationButtonLabelClass = $queryingLocation ? 'fade-blink' : '';
    $: selectedItemHasPosition = selectedItem && !selectedItem.route && selectedItem.geometry.type === 'Point';

    export function onSelectedItem(item: IItem, oldItem: IItem) {
        selectedItem = item;
    }
    onDestroy(() => {
        userLocationModule = null;

        const customLayers = mapContext.mapModule('customLayers');
        if (customLayers) {
            customLayers.off('onProgress', onTotalDownloadProgress);
        }
    });

    // function onNewLocation(e: any) {
    //     currentLocation = e.data;
    // }

    function onTotalDownloadProgress(e) {
        if (e.data === 100) {
            totalDownloadProgress = 0;
        } else {
            totalDownloadProgress = e.data;
        }
    }
    function onAttribution(e) {
        attributionVisible = e.needsAttribution;
    }

    function askUserLocation() {
        return userLocationModule.askUserLocation();
    }
    function onWatchLocation() {
        return userLocationModule.onWatchLocation();
    }
    function startDirections() {
        if (selectedItem) {
            const module = mapContext.mapModule('directionsPanel');
            const geometry = selectedItem.geometry as Point;
            module.addStartOrStopPoint({ lat: geometry.coordinates[1], lon: geometry.coordinates[0] }, selectedItem.properties);
        }
    }

    async function showRouteList() {
        const RoutesList = (await import('~/components/RoutesList.svelte')).default;
        navigate({ page: RoutesList });
    }
    async function showMapRightMenu() {
        const LayersMenu = (await import('~/components/LayersMenu.svelte')).default;
        return showBottomSheet({
            view: LayersMenu,
            trackingScrollView: 'trackingScrollView'
        });
    }

    let iconPaint: Paint;
    let textPaint: Paint;
    function drawNavigationInstruction({ canvas, object }: { canvas: Canvas; object: Canvas }) {
        let w = canvas.getWidth();
        let h = canvas.getHeight();
        if (!iconPaint) {
            iconPaint = new Paint();
            iconPaint.fontFamily = alpimapsFontFamily;
        }
        if (!textPaint) {
            textPaint = new Paint();
        }
        textPaint.setColor($textColor);
        iconPaint.setColor($textColor);
        iconPaint.setTextSize(40);
        canvas.save();

        if (navigationInstructions.instruction) {
            let staticLayout = new StaticLayout(instructionIcon, iconPaint, w, LayoutAlignment.ALIGN_NORMAL, 1, 0, true);
            canvas.translate(10, h / 2 - staticLayout.getHeight() / 2);
            staticLayout.draw(canvas);
            canvas.restore();
            if (navigationInstructions.distanceToNextInstruction > 0) {
                const data = convertDistance(navigationInstructions.distanceToNextInstruction);
                textPaint.setTextSize(11);
                canvas.drawText(`${data.value.toFixed(data.unit === 'm' ? 0 : 1)} ${data.unit}`, 14, h / 2 + staticLayout.getHeight() / 2 + 15, textPaint);
            }

            // textPaint.setTextSize(13);

            const nString = createNativeAttributedString(
                {
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
                                      color: $subtitleColor,
                                      fontSize: 13,
                                      text: '\n' + navigationInstructions.instruction.name
                                  }
                              ]
                            : ([] as any)
                    )
                }
            );
            staticLayout = new StaticLayout(nString, textPaint, w - 20 - 50, LayoutAlignment.ALIGN_NORMAL, 1, 0, true);
            canvas.translate(60, h / 2 - staticLayout.getHeight() / 2);
            staticLayout.draw(canvas);
            // if (navigationInstructions.instruction.name) {
            //     let transH = staticLayout.getHeight();
            //     textPaint.setTextSize(11);
            //     textPaint.setColor($subtitleColor);
            //     canvas.drawText(navigationInstructions.instruction.name, 0, transH + 10, textPaint);
            // }
        }
    }

    async function open3DMap() {
        try {
            const position = mapContext.getMap().getFocusPos();
            if (!position.altitude) {
                position.altitude = await packageService.getElevation(position);
            }
            const hillshadeDatasource = packageService.hillshadeLayer?.dataSource;
            const vectorDataSource = packageService.localVectorTileLayer?.dataSource;
            const customSources = mapContext.mapModules.customLayers.customSources;
            let rasterDataSource: TileDataSource<any, any>;
            customSources.some((s) => {
                if (s.layer instanceof RasterTileLayer) {
                    rasterDataSource = s.layer.options.dataSource;
                    return true;
                }
            });
            if (!rasterDataSource) {
                rasterDataSource = await mapContext.mapModules.customLayers.getDataSource('openstreetmap');
            }
            const component = (await import('~/components/3DMap.svelte')).default;
            navigate({
                page: component,
                props: {
                    position,
                    vectorDataSource,
                    dataSource: hillshadeDatasource,
                    rasterDataSource
                }
            });
        } catch (err) {
            showError(err);
        }
    }

    function onAttributionTap() {
        const customLayers = mapContext.mapModule('customLayers');
        if (customLayers) {
            const attributions = customLayers.getAllAtributions();
            const label = new Label();
            label.style.padding = '10 20 0 20';
            label.color = $textColor as any;
            label.html = attributions.join('<br/>');
            label.on('linkTap', (e) => openLink(e['link']));
            return alert({
                title: lc('attributions'),
                view: label,
                okButtonText: lc('ok')
            });
        }
    }
</script>

<gridlayout id="scrollingWidgets" bind:this={gridLayout} {...$$restProps} rows="auto,*,auto" columns="60,*,70" isPassThroughParentEnabled={true} marginTop={globalMarginTop} {userInteractionEnabled}>
    <stacklayout col={2} row={2} verticalAlignment="bottom" padding={2}>
        <mdbutton
            transition:scale={{ duration: 200 }}
            on:tap={startDirections}
            rowSpan={2}
            col={2}
            class="floating-btn"
            id="directions"
            text="mdi-directions"
            visibility={selectedItemHasPosition ? 'visible' : 'collapsed'}
        />
        <mdcardview class={'floating-btn ' + locationButtonClass} on:tap={askUserLocation} on:longPress={onWatchLocation}>
            <label
                class={'mdi ' + locationButtonLabelClass}
                textAlignment="center"
                verticalAlignment="middle"
                text="mdi-crosshairs-gps"
                color={!$queryingLocation && $watchingLocation ? 'white' : accentColor}
            />
        </mdcardview>
    </stacklayout>
    <stacklayout marginTop={80} row={2} verticalAlignment="bottom" horizontalAlignment="left">
        <!-- <mdbutton on:tap={open3DMap} class="small-floating-btn" color={primaryColor} text="mdi-video-3d" /> -->
        <mdbutton id="layers" on:tap={showRouteList} class="small-floating-btn" text="mdi-format-list-checkbox" />
        <mdbutton id="layers" on:tap={showMapRightMenu} class="small-floating-btn" text="mdi-layers" />
    </stacklayout>

    <ScaleView bind:this={scaleView} col={1} row={2} horizontalAlignment="right" verticalAlignment="bottom" marginBottom={8} />
    <IconButton
        isVisible={attributionVisible}
        isSelected={true}
        col={1}
        row={2}
        horizontalAlignment="left"
        verticalAlignment="bottom"
        tooltip={lc('attributions')}
        text="mdi-information-outline"
        on:tap={onAttributionTap}
    />

    <mdprogress colSpan={3} row={2} value={totalDownloadProgress} visibility={totalDownloadProgress > 0 ? 'visible' : 'collapsed'} verticalAlignment="bottom" />
    <canvas
        bind:this={navigationCanvas}
        rowSpan={3}
        on:swipe={() => (navigationInstructions = null)}
        col={1}
        visibility={navigationInstructions ? 'visible' : 'collapsed'}
        verticalAlignment="bottom"
        backgroundColor={$widgetBackgroundColor}
        borderRadius={6}
        marginBottom={24}
        width="70%"
        height={80}
        on:draw={drawNavigationInstruction}
    />
</gridlayout>
