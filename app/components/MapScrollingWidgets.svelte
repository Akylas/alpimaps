<script lang="ts" context="module">
    import { GridLayout, ViewBase } from '@akylas/nativescript';
    import { l, lc } from '@nativescript-community/l';
    import { MapPos } from '@nativescript-community/ui-carto/core';
    import { PackageAction, PackageStatus } from '@nativescript-community/ui-carto/packagemanager';
    import { confirm } from '@nativescript-community/ui-material-dialogs';
    import { showSnack } from '@nativescript-community/ui-material-snackbar';
    import { debounce } from 'push-it-to-the-limit';
    import { onDestroy, onMount } from 'svelte';
    import { NativeViewElementNode } from 'svelte-native/dom';
    import { writable } from 'svelte/store';
    import { GeoHandler } from '~/handlers/GeoHandler';
    import { getMapContext } from '~/mapModules/MapModule';
    import UserLocationModule from '~/mapModules/UserLocationModule';
    import { IItem } from '~/models/Item';
    import { packageService } from '~/services/PackageService';
    import { showError } from '~/utils/error';
    import { accentColor, globalMarginTop, mdiFontFamily } from '~/variables';
    import { resolveComponentElement } from './bottomsheet';
    import OptionPicker from './OptionPicker.svelte';
    import ScaleView from './ScaleView.svelte';
    import mapStore from '~/stores/mapStore';
</script>

<script lang="ts">
    let currentMapZoom = 0;
    let totalDownloadProgress = 0;
    const mapContext = getMapContext();

    let selectedItem: IItem = null;

    export let userInteractionEnabled: boolean = true;

    let suggestionPackage: { id: string; name: string; status: PackageStatus } = null;
    let suggestionPackageName: string = null;
    let scaleView: ScaleView;
    let userLocationModule: UserLocationModule = null;
    let currentLocation: MapPos = null;
    let lastSuggestionKey: string;
    let gridLayout: NativeViewElementNode<GridLayout>;

    let showSuggestionPackage = false;
    let locationButtonClass = 'buttontext';
    let locationButtonLabelClass: string = '';
    let selectedItemHasPosition = false;

    export function getNativeView() {
        return gridLayout && gridLayout.nativeView;
    }
    mapContext.onMapReady(() => {
        userLocationModule = mapContext.mapModule('userLocation');
        userLocationModule.on('location', onNewLocation, this);
    });
    // get currentLocation() {
    //     return userLocationModule && userLocationModule.lastUserLocation;
    // }
    $: {
        showSuggestionPackage =
            suggestionPackage &&
            (!suggestionPackage.status ||
                (suggestionPackage.status.getCurrentAction() !== PackageAction.READY &&
                    suggestionPackage.status.getCurrentAction() !== PackageAction.DOWNLOADING));
    }
    $: {
        locationButtonClass = $mapStore.watchingLocation ? 'buttonthemed' : 'buttontext';
    }

    $: {
        locationButtonLabelClass = $mapStore.queryingLocation ? 'fade-blink' : '';
    }

    $: {
        // console.log('selectedItemHasPosition', selectedItem);
        selectedItemHasPosition = selectedItem && !selectedItem.route && !!selectedItem.position;
    }

    export function onSelectedItem(selectedItem: IItem, oldItem: IItem) {
        selectedItem = selectedItem;
    }
    if (gVars.packageServiceEnabled) {
        onMount(() => {
            if (packageService) {
                packageService.on('onProgress', onTotalDownloadProgress, this);
                packageService.on('onPackageStatusChanged', onPackageStatusChanged, this);
            }
        });
        onDestroy(() => {
            if (packageService) {
                packageService.off('onProgress', onTotalDownloadProgress, this);
                packageService.off('onPackageStatusChanged', onPackageStatusChanged, this);
            }
        });
    }

    function onServiceLoaded(geoHandler: GeoHandler) {}
    function onServiceUnloaded(geoHandler: GeoHandler) {}

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
    if (gVars.packageServiceEnabled) {
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
        // console.log('downloadSuggestion', suggestionPackage.id);
        if (suggestionPackage) {
            packageService.packageManager.startPackageDownload(suggestionPackage.id);
        }
        showSnack({ message: `${l('downloading')}  ${suggestionPackageName}` });
    }
    async function customDownloadSuggestion() {
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
            console.log('result', result, options);
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
    function onNewLocation(e: any) {
        currentLocation = e.data;
        console.log('onNewLocation', currentLocation);
    }

    onDestroy(() => {
        userLocationModule.off('location', onNewLocation, this);
        userLocationModule = null;
    });
    function onTotalDownloadProgress(e) {
        // console.log('onTotalDownloadProgress', e.data);
        if (e.data === 100) {
            totalDownloadProgress = 0;
        } else {
            totalDownloadProgress = e.data;
        }
    }
    function onPackageStatusChanged(e) {
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
            module.addStopPoint(selectedItem.position, selectedItem.properties);
        }
    }
</script>

<gridlayout
    bind:this={gridLayout}
    {...$$restProps}
    rows="auto,*,auto"
    columns="70,*,70"
    isPassThroughParentEnabled={true}
    marginTop={globalMarginTop}>
    <label
        borderRadius="6"
        visibility={showSuggestionPackage ? 'visible' : 'collapsed'}
        col="1"
        row="2"
        backgroundColor="#55000000"
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
        >${suggestionPackageName}`} />
    <stacklayout col="2" row="2" verticalAlignment="bottom" padding="2">
        <mdbutton
            transition:scale={{ duration: 200 }}
            on:tap={startDirections}
            row="0"
            rowSpan="2"
            col="2"
            class="floating-btn"
            text="mdi-directions"
            visibility={selectedItemHasPosition ? 'visible' : 'collapsed'}
            isUserInteractionEnabled={userInteractionEnabled} />
        <gridlayout
            class={'floating-btn ' + locationButtonClass}
            on:tap={askUserLocation}
            on:longPress={onWatchLocation}
            isUserInteractionEnabled={userInteractionEnabled}>
            <label
                textAlignment="center"
                verticalTextAlignment="middle"
                class={'mdi ' + locationButtonLabelClass}
                text="mdi-crosshairs-gps"
                color={$mapStore.watchingLocation ? 'white' : accentColor}
                isUserInteractionEnabled="false" />
        </gridlayout>
    </stacklayout>
    <ScaleView bind:this={scaleView} col="1" row="2" horizontalAlignment="right" verticalAlignment="bottom" marginBottom="8" />
    <mdprogress
        col="0"
        colSpan="3"
        row="2"
        value={totalDownloadProgress}
        visibility={totalDownloadProgress > 0 ? 'visible' : 'collapsed'}
        verticalAlignment="bottom" />
</gridlayout>
