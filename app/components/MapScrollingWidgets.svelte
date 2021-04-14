<script lang="ts">
    import { GridLayout, ViewBase } from '@nativescript/core';
    import { l, lc } from '@nativescript-community/l';
    import type { MapPos } from '@nativescript-community/ui-carto/core';
    import type { PackageStatus } from '@nativescript-community/ui-carto/packagemanager';
    import { PackageAction } from '@nativescript-community/ui-carto/packagemanager';
    import { confirm } from '@nativescript-community/ui-material-dialogs';
    import { showSnack } from '@nativescript-community/ui-material-snackbar';
    import { debounce } from 'push-it-to-the-limit';
    import { onDestroy, onMount } from 'svelte';
    import { NativeViewElementNode } from 'svelte-native/dom';
    import { writable } from 'svelte/store';
    import { GeoHandler } from '~/handlers/GeoHandler';
    import { getMapContext } from '~/mapModules/MapModule';
    import UserLocationModule from '~/mapModules/UserLocationModule';
    import type { IItem } from '~/models/Item';
    import { packageService } from '~/services/PackageService';
    import { convertDistance } from '~/helpers/formatter';
    import { showError } from '~/utils/error';
    import {
        accentColor,
        alpimapsFontFamily,
        borderColor,
        globalMarginTop,
        mdiFontFamily,
        primaryColor,
        subtitleColor,
        textColor,
        widgetBackgroundColor
    } from '~/variables';
    import { resolveComponentElement } from './bottomsheet';
    import OptionPicker from './OptionPicker.svelte';
    import ScaleView from './ScaleView.svelte';
    import { showBottomSheet } from './bottomsheet';
    import mapStore from '~/stores/mapStore';
    import { AnimationCurve } from '@nativescript/core/ui/enums';
    import { asSvelteTransition } from 'svelte-native/transitions';
    import { showModal } from 'svelte-native';
    import { RouteInstruction } from '~/models/Route';
    import { RoutingAction } from '~/models/Route';
    import { Canvas, CanvasView, LayoutAlignment, Paint, StaticLayout } from '@nativescript-community/ui-canvas';
    import { onThemeChanged } from '~/helpers/theme';
    function scale(node, { delay = 0, duration = 400, easing = AnimationCurve.easeOut }) {
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
    const mapContext = getMapContext();
    let packageServiceEnabled = __CARTO_PACKAGESERVICE__;

    let selectedItem: IItem = null;

    export let userInteractionEnabled: boolean = true;

    let suggestionPackage: { id: string; name: string; status: PackageStatus } = null;
    let suggestionPackageName: string = null;
    let scaleView: ScaleView;
    let userLocationModule: UserLocationModule = null;
    let currentLocation: MapPos = null;
    // let lastSuggestionKey: string;
    let gridLayout: NativeViewElementNode<GridLayout>;
    let navigationCanvas: NativeViewElementNode<CanvasView>;

    let showSuggestionPackage = false;
    let locationButtonClass = 'buttontext';
    let locationButtonLabelClass: string = '';
    let selectedItemHasPosition = false;

    let instructionIcon;
    export let navigationInstructions: {
        remainingDistance: number;
        remainingTime: number;
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
        navigationCanvas && navigationCanvas.nativeView.invalidate();
    }

    onThemeChanged(() => {
        navigationCanvas && navigationCanvas.nativeView.invalidate();
    });

    export function getNativeView() {
        return gridLayout && gridLayout.nativeView;
    }
    mapContext.onMapReady(() => {
        userLocationModule = mapContext.mapModule('userLocation');

        const customLayers = mapContext.mapModule('customLayers');
        if (customLayers) {
            customLayers.on('onProgress', onTotalDownloadProgress, this);
        }
        // userLocationModule.on('location', onNewLocation, this);
    });
    $: locationButtonClass = !$mapStore.queryingLocation && $mapStore.watchingLocation ? 'buttonthemed' : 'buttontext';
    $: locationButtonLabelClass = $mapStore.queryingLocation ? 'fade-blink' : '';
    $: selectedItemHasPosition = selectedItem && !selectedItem.route && !!selectedItem.position;

    export function onSelectedItem(item: IItem, oldItem: IItem) {
        selectedItem = item;
    }
    $: {
        showSuggestionPackage =
            suggestionPackage &&
            (!suggestionPackage.status ||
                (suggestionPackage.status.getCurrentAction() !== PackageAction.READY &&
                    suggestionPackage.status.getCurrentAction() !== PackageAction.DOWNLOADING));
    }
    onMount(() => {
        if (__CARTO_PACKAGESERVICE__) {
            if (packageService) {
                packageService.on('onProgress', onTotalDownloadProgress, this);
                packageService.on('onPackageStatusChanged', onPackageStatusChanged, this);
            }
        }
    });
    onDestroy(() => {

        userLocationModule = null;
        if (__CARTO_PACKAGESERVICE__) {
            if (packageService) {
                packageService.off('onProgress', onTotalDownloadProgress, this);
                packageService.off('onPackageStatusChanged', onPackageStatusChanged, this);
            }
        }
        const customLayers = mapContext.mapModule('customLayers');
        if (customLayers) {
            customLayers.off('onProgress', onTotalDownloadProgress, this);
        }
    });
    if (__CARTO_PACKAGESERVICE__) {
        const updateSuggestion = debounce((focusPos) => {
            // console.log('updateSuggestion', focusPos);

            // if (zoom < 8) {
            //     suggestionPackage = null;
            //     suggestionPackageName = null;
            //     return;
            // }
            const suggestions = packageService.packageManager.suggestPackages(focusPos, mapContext.getProjection());
            const sPackage = suggestions[0];
            // console.log('test suggestion', focusPos, suggestionPackage && suggestionPackage.getPackageId(), suggestionPackage && suggestionPackage.getName());
            if (sPackage) {
                const status = packageService.packageManager.getLocalPackageStatus(sPackage.getPackageId(), -1);
                // console.log('test suggestion status', status, status && status.getCurrentAction());
                if (!status || status.getCurrentAction() !== PackageAction.READY) {
                    suggestionPackage = {
                        id: sPackage.getPackageId(),
                        name: sPackage.getName(),
                        status
                    };
                    suggestionPackageName = suggestionPackage.name.split('/').slice(-1)[0];
                } else {
                    suggestionPackage = null;
                    suggestionPackageName = null;
                }
            } else {
                suggestionPackage = null;
                suggestionPackageName = null;
            }

            // console.log('onMapStable suggestions', !!suggestionPackage, suggestionPackageName, Date.now());
        }, 2000);
        mapContext.onMapStable((cartoMap) => {
            const zoom = Math.round(cartoMap.zoom);
            // console.log('onMapStable', zoom);
            // currentMapRotation = Math.round(bearing * 100) / 100;
            // if (zoom < 10) {
            //     suggestionPackage = undefined;
            //     suggestionPackageName = undefined;
            // }
            if (zoom >= 8) {
                const focusPos = cartoMap.focusPos;
                const suggestionKey = `${focusPos.lat.toFixed(5)}${focusPos.lat.toFixed(5)}${zoom}`;
                if (suggestionKey !== lastSuggestionKey) {
                    lastSuggestionKey = suggestionKey;
                    updateSuggestion(focusPos);
                }
            } else {
                suggestionPackage = null;
                suggestionPackageName = null;
            }
        });
    }
    function downloadSuggestion() {
        if (__CARTO_PACKAGESERVICE__) {
            if (suggestionPackage) {
                packageService.packageManager.startPackageDownload(suggestionPackage.id);
            }
            showSnack({ message: `${l('downloading')}  ${suggestionPackageName}` });
        }
    }
    async function customDownloadSuggestion() {
        if (__CARTO_PACKAGESERVICE__) {
            console.log('customDownloadSuggestion');
            if (!suggestionPackage) {
                return;
            }
            const options = [
                { name: lc('map_package'), checked: true },
                { name: lc('search_package'), checked: false },
                { name: lc('routing_package'), checked: false }
            ];
            const componentInstanceInfo = resolveComponentElement(OptionPicker, {
                options
            });
            try {
                const nView: ViewBase = componentInstanceInfo.element.nativeView;
                const result = await confirm({
                    title: `${lc('download_suggestion')}: ${suggestionPackageName}`,
                    okButtonText: l('download'),
                    cancelButtonText: l('cancel'),
                    view: nView
                });
                if (result) {
                    if (options[0].checked) {
                        packageService.packageManager.startPackageDownload(suggestionPackage.id);
                    }
                    if (options[1].checked) {
                        packageService.geoPackageManager.startPackageDownload(suggestionPackage.id);
                    }
                    if (options[2].checked) {
                        packageService.routingPackageManager.startPackageDownload(suggestionPackage.id);
                    }
                }
            } catch (err) {
                showError(err);
            } finally {
                componentInstanceInfo.viewInstance.$destroy(); // don't let an exception in destroy kill the promise callback
            }
        }
    }
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
    function onPackageStatusChanged(e) {
        if (__CARTO_PACKAGESERVICE__) {
            const { id, status } = e.data;
            if (suggestionPackage && id === suggestionPackage.id) {
                suggestionPackage.status = status;
            }

            // dataItems.some((d, index) => {
            //     if (d.id === id) {
            //         // console.log('updating item!', id, index);
            //         switch (e.type as PackageType) {
            //             case 'geo':
            //                 d.geoStatus = status;
            //                 break;
            //             case 'routing':
            //                 d.routingStatus = status;
            //                 break;
            //             default:
            //                 d.status = status;
            //         }
            //         dataItems.setItem(index, d);
            //         // d.status = status;
            //         return true;
            //     }
            //     return false;
            // });
        }
    }

    // setCurrentLayerStyle(style: CartoMapStyle) {
    //     currentLayerStyle = style;
    //     if (vectorTileDecoder instanceof CartoOnlineVectorTileLayer) {
    //         // vectorTileDecoder.style = getStyleFromCartoMapStyle(currentLayerStyle);
    //     }
    // }
    function askUserLocation() {
        return userLocationModule.askUserLocation();
    }
    function onWatchLocation() {
        return userLocationModule.onWatchLocation();
    }
    function startDirections() {
        if (selectedItem) {
            const module = mapContext.mapModule('directionsPanel');
            module.addWayPoint(selectedItem.position, selectedItem.properties);
        }
    }

    async function showMapRightMenu() {
        // mapContext.toggleMenu('bottom');
        const LayersMenu = (await import('~/components/LayersMenu.svelte')).default;
        const results = await showBottomSheet({
            view: LayersMenu,
            transparent: true,
            disableDimBackground: true,
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
            iconPaint.setAntiAlias(true);
            iconPaint.fontFamily = alpimapsFontFamily;
        }
        if (!textPaint) {
            textPaint = new Paint();
            textPaint.setAntiAlias(true);
        }
        textPaint.setColor($textColor);
        iconPaint.setColor($textColor);
        iconPaint.setTextSize(40);
        canvas.save();

        if (navigationInstructions.instruction) {
            const data = convertDistance(navigationInstructions.instruction.dist);

            let staticLayout = new StaticLayout(instructionIcon, iconPaint, w, LayoutAlignment.ALIGN_NORMAL, 1, 0, true);
            canvas.translate(10, h / 2 - staticLayout.getHeight() / 2);
            staticLayout.draw(canvas);
            canvas.restore();
            textPaint.setTextSize(11);
            canvas.drawText(
                `${data.value.toFixed(data.unit === 'm' ? 0 : 1)} ${data.unit}`,
                14,
                h / 2 + staticLayout.getHeight() / 2 + 15,
                textPaint
            );
            textPaint.setTextSize(13);
            staticLayout = new StaticLayout(
                navigationInstructions.instruction.inst,
                textPaint,
                w - 20 - 50,
                LayoutAlignment.ALIGN_NORMAL,
                1,
                0,
                true
            );
            canvas.translate(60, 10);
            staticLayout.draw(canvas);
            if (navigationInstructions.instruction.name) {
                let transH = staticLayout.getHeight();
                textPaint.setTextSize(11);
                textPaint.setColor($subtitleColor);
                canvas.drawText(navigationInstructions.instruction.name, 0, transH + 10, textPaint);
            }
        }
    }
</script>

<gridlayout
    id="scrollingWidgets"
    bind:this={gridLayout}
    {...$$restProps}
    rows="auto,*,auto"
    columns="70,*,70"
    isPassThroughParentEnabled={true}
    marginTop={globalMarginTop}
    {userInteractionEnabled}
>
    {#if packageServiceEnabled}
        <label
            borderRadius="6"
            visibility={showSuggestionPackage ? 'visible' : 'collapsed'}
            col="1"
            row="2"
            backgroundColor="#00000055"
            verticalAlignment="bottom"
            verticalTextAlignment="middle"
            horizontalAlignment="center"
            textWrap={true}
            marginBottom="30"
            fontSize="10"
            padding="4 2 4 4"
            on:tap={downloadSuggestion}
            on:longPress={customDownloadSuggestion}
            color="white"
            :html={`<big
            ><big><font face="${mdiFontFamily}">mdi-download</font></big></big
        >${suggestionPackageName}`}
        />
    {/if}
    <stacklayout col="2" row="2" verticalAlignment="bottom" padding="2">
        <button
            transition:scale={{ duration: 200 }}
            on:tap={startDirections}
            row="0"
            rowSpan="2"
            col="2"
            class="floating-btn"
            text="mdi-directions"
            visibility={selectedItemHasPosition ? 'visible' : 'collapsed'}
        />
        <mdcardview class={'floating-btn ' + locationButtonClass} on:tap={askUserLocation} on:longPress={onWatchLocation}>
            <canvaslabel class={'mdi ' + locationButtonLabelClass} :isUserInteractionEnabled="false">
                <cspan
                    textAlignment="center"
                    verticalAlignment="middle"
                    text="mdi-crosshairs-gps"
                    color={!$mapStore.queryingLocation && $mapStore.watchingLocation ? 'white' : accentColor}
                />
            </canvaslabel>
        </mdcardview>
    </stacklayout>
    <button
        marginTop="80"
        on:tap={showMapRightMenu}
        class="small-floating-btn"
        color={primaryColor}
        text="mdi-layers"
        row="2"
        verticalAlignment="bottom"
        horizontalAlignment="left"
    />
    <ScaleView bind:this={scaleView} col="1" row="2" horizontalAlignment="right" verticalAlignment="bottom" marginBottom="8" />
    <mdprogress
        col="0"
        colSpan="3"
        row="2"
        value={totalDownloadProgress}
        visibility={totalDownloadProgress > 0 ? 'visible' : 'collapsed'}
        verticalAlignment="bottom"
    />
    <canvas
        bind:this={navigationCanvas}
        rowSpan="3"
        antiAlias={true}
        transition:scale={{ duration: 200 }}
        on:swipe={() => (navigationInstructions = null)}
        col="1"
        visibility={navigationInstructions ? 'visible' : 'collapsed'}
        verticalAlignment="bottom"
        horizontalAlignment="center"
        backgroundColor={$widgetBackgroundColor}
        borderRadius="6"
        marginBottom="24"
        elevation="2"
        width="70%"
        height="100"
        on:draw={drawNavigationInstruction}
    />
</gridlayout>
