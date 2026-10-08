<script context="module" lang="ts">
    import { share } from '@akylas/nativescript-app-utils/share';
    import { isSensorAvailable } from '@nativescript-community/sensors';
    import * as api from '@nativescript-community/ui-massifmaps/api';
    import type { MassifLayer, MassifMap, MassifObject, MassifSource } from '@nativescript-community/ui-massifmaps/api';
    import type { MassifMap as MassifMapView } from '@nativescript-community/ui-massifmaps/ui';
    import { openFilePicker } from '@nativescript-community/ui-document-picker';
    import { isBottomSheetOpened, showBottomSheet } from '@nativescript-community/ui-material-bottomsheet/svelte';
    import { prompt } from '@nativescript-community/ui-material-dialogs';
    import { HorizontalPosition, VerticalPosition } from '@nativescript-community/ui-popover';
    import { getUniversalLink, registerUniversalLinkCallback } from '@nativescript-community/universal-links';
    import { Application, ApplicationSettings, Color, File, GridLayout, Page, Utils, View } from '@nativescript/core';
    import type { AndroidActivityBackPressedEventData, OrientationChangedEventData } from '@nativescript/core/application/application-interfaces';
    import { Folder, knownFolders, path } from '@nativescript/core/file-system';
    import { Screen } from '@nativescript/core/platform';
    import { SDK_VERSION, debounce } from '@nativescript/core/utils';
    import { Sentry, isSentryEnabled } from '@shared/utils/sentry';
    import { showError } from '@shared/utils/showError';
    import { tryCatch, tryCatchFunction } from '@shared/utils/ui';
    import type { Point as GeoJSONPoint } from 'geojson';
    import { onDestroy, onMount } from 'svelte';
    import { NativeViewElementNode } from '@nativescript-community/svelte-native/dom';
    import BottomSheetInner from '~/components/bottomsheet/BottomSheetInner.svelte';
    import ButtonBar from '~/components/common/ButtonBar.svelte';
    import DirectionsPanel from '~/components/directions/DirectionsPanel.svelte';
    import LocationInfoPanel from '~/components/map/LocationInfoPanel.svelte';
    import MapScrollingWidgets from '~/components/map/MapScrollingWidgets.svelte';
    import Search from '~/components/search/Search.svelte';
    import { GeoHandler } from '~/handlers/GeoHandler';
    import { l, lc, onLanguageChanged, onMapLanguageChanged } from '~/helpers/locale';
    import { currentRealTheme, forceDarkMode, isDarkTheme, isEInk, theme, toggleForceDarkMode } from '~/helpers/theme';
    import watcher from '~/helpers/watcher';
    import CustomLayersModule, { mapCapabilities } from '~/mapModules/CustomLayersModule';
    import ItemsModule from '~/mapModules/ItemsModule';
    import { registerNavigationRouteModule } from '~/mapModules/NavigationRouteModule';
    import type { LayerType } from '~/mapModules/layerStack';
    import { LayerStack } from '~/mapModules/layerStack';
    import {
        ClickType,
        type ElementClickData,
        type FeatureClickData,
        type MapClickData,
        type MapDecoder,
        type MapMoveReason,
        getMapContext,
        handleMapAction,
        setMapContext
    } from '~/mapModules/MapModule';
    import { registerMapModule } from '~/mapModules/registry';
    import { installMacMouse } from './macMouse';
    import { FeaturePicker, clearIgnoreNextMapClick, consumeIgnoreNextMapClick } from '~/mapModules/featurePicker';
    import { featureMenuItems, featureSideButtons } from '~/mapModules/mapFeatures';
    // registers the built-in map features; imported for side effect
    import '~/mapModules/features/admin';
    import '~/mapModules/features/immersive';
    import '~/mapModules/features/styleToggles';
    import '~/mapModules/features/legend';
    import MapLegend from './MapLegend.svelte';
    import '~/mapModules/features/terrain3d';
    import { exitPeakFinder, onArCameraOpen } from '~/mapModules/features/peakFinder';
    import type { PreviewGeometrySource } from '~/utils/cameraFov';
    import { addTransitLayerIfPending, isTransitPickerPending } from '~/mapModules/features/transit';
    import { startWebServerIfWanted, stopWebServer } from '~/mapModules/features/tileServer';
    import { keepScreenAwake, keepScreenAwakeFullBrightness } from '~/mapModules/features/screenAwake';
    import UserLocationModule, { getUserBitmapUrl } from '~/mapModules/UserLocationModule';
    import type { IItem, Item, RouteInstruction } from '~/models/Item';
    import { onServiceLoaded, onServiceUnloaded } from '~/services/BgService.common';
    import { navigationService } from '~/services/NavigationService';
    import { isNavigating, navigationHasPreviewWidgets, navigationItem, navigationScale } from '~/stores/navigationStore';
    import { MANEUVER_VIEW_HEIGHT, navigationSections, navigationSheetSteps } from '~/utils/navigation';
    import type { NetworkConnectionStateEventData } from '~/services/NetworkService';
    import { NetworkConnectionStateEvent, networkService } from '~/services/NetworkService';
    import { packageService } from '~/services/PackageService';
    import { transitService } from '~/services/TransitService';
    import { innerNutiProps, itemLock, layerProps, nutiProps, preloading, projectionModeSpherical, rotateEnabled, showItemsLayer, styleParameterKeys, styleParameterValues } from '~/stores/mapStore';
    import { legendVersion, showLegend } from '~/stores/legendStore';
    import {
        MASSIF_PACKAGE,
        MASSIF_VARIANTS,
        type MassifIconFont,
        VARIANT_PARAMETER_KEYS,
        iconFontParameters,
        isMassifStyle,
        massifIconFont,
        massifLook,
        massifVariant,
        rankingFor,
        rankingParameters,
        setRankingFor,
        variantParameters
    } from '~/utils/massif';
    import type { MassifRanking } from '~/utils/massif';
    import { mapTiltRange, peakFinderActive, peakFinderArActive } from '~/stores/terrainStore';
    import { type MapBounds, type MapPos, fromPosition, geometryBounds, getBoundsZoomLevel, toBounds, toPosition } from '~/utils/geo';
    import { parseUrlQueryParameters } from '~/utils/http';
    import { hideLoading, onBackButton, showLoading, showPopoverMenu, showSnack } from '~/utils/ui';
    import { clearTimeout, getDataFolder, getSavedMBTilesDir, setTimeout } from '~/utils/utils';
    import { colors, windowInset, windowSize } from '../../variables';
    import MapResultPager from '../search/MapResultPager.svelte';
    import type { StyleFamily, StyleVariant } from './StylePicker.svelte';

    const GEO_TEXT_REGEXP = /([+-]?([0-9]*[.])?[0-9])+\,([+-]?([0-9]*[.])?[0-9]+)(?:\(.*\))/;

    // Alpimaps OSM over Massif: a folder while developing, massif.zip in release (styleSpec picks)
    const DEFAULT_STYLE = `${MASSIF_PACKAGE}~alpimaps`;
</script>

<script lang="ts">
    $: ({ colorBackground, colorError, colorOnSurfaceVariant, colorOutlineSoft, colorPrimary } = $colors);
    $: ({ bottom: windowInsetBottom, left: windowInsetLeft, right: windowInsetRight, top: windowInsetTop } = $windowInset);

    let defaultLiveSync = global.__onLiveSync;

    let page: NativeViewElementNode<Page>;
    let widgetsHolder: NativeViewElementNode<GridLayout>;
    let massifMap: MassifMap;
    // terrain shader params and post-process effects are object-API only, hence the view itself
    let mapViewInstance: MassifMapView;
    let uninstallMacMouse: () => void;
    let macMenuAnchor: NativeViewElementNode<View>;
    const isCatalyst = __CATALYST__;
    let directionsPanel: DirectionsPanel;
    let directionsPanelVisible: boolean;
    let mapResultsPager: MapResultPager;
    let bottomSheetInner: BottomSheetInner;
    let mapScrollingWidgets: MapScrollingWidgets;
    let locationInfoPanel: LocationInfoPanel;
    let searchView: Search;
    const mapContext = getMapContext();
    const featureMenuItemsStore = featureMenuItems('overflow');
    const mainMenuItemsStore = featureMenuItems('main');
    const featureSideButtonsStore = featureSideButtons();

    let selectedOSMId: string;
    let selectedId: string;
    let selectedMapId: string;
    // parameterised on purpose: a bare MassifObject accepts ANY path, hiding read-only writes
    let selectedPosMarker: MassifObject<'massif::Marker'>;
    const selectedItem = watcher<Item>(null, onSelectedItemChanged);
    let editingItem: Item = null;
    let didIgnoreAlreadySelected = false;

    let currentLayerStyle: string;
    let vectorTileDecoder: MapDecoder;

    let bottomSheetStepIndex = 0;
    let steps;

    // navigation has its own sheet (sharing the item one made them fight over steps); views lazy-loaded
    let navigationViewComponent = null;
    let maneuverViewComponent = null;
    let navigationRailComponent = null;
    let routeSimulatorPanelComponent = null;
    let navigationStepIndex = 0;
    // no 0 step: the bar is the only way out of navigation, so it can never be dismissed
    $: navigationSteps = navigationSheetSteps(
        navigationSections($navigationScale, {
            hasAhead: $navigationHasPreviewWidgets,
            hasProfile: !!$navigationItem?.profile?.data?.length,
            hasStats: !!$navigationItem?.stats
        })
    );

    async function loadNavigationViews() {
        if (navigationViewComponent) {
            return;
        }
        const [navigationView, maneuverView, navigationRail] = await Promise.all([
            import('~/components/navigation/NavigationView.svelte'),
            import('~/components/navigation/ManeuverView.svelte'),
            import('~/components/navigation/NavigationRail.svelte')
        ]);
        navigationViewComponent = navigationView.default;
        maneuverViewComponent = maneuverView.default;
        navigationRailComponent = navigationRail.default;
        if (!PRODUCTION) {
            routeSimulatorPanelComponent = (await import('~/components/navigation/RouteSimulatorPanel.svelte')).default;
        }
    }
    // lazy: Map is the root component, so mode-only views stay off the startup path
    let peakFinderOverlayComponent = null;
    // a second map view (PeakFinderMap.svelte); rendered behind an `{#if}` so its GL surface isn't
    // held open outside the mode
    let peakFinderMapComponent = null;
    // only the capture-session owner knows the stream's resolution, rotation, fit and zoom, which the
    // peak finder needs to draw terrain at the photo's scale
    let arCameraPreview: PreviewGeometrySource = null;
    async function loadPeakFinderComponents() {
        if (!peakFinderOverlayComponent) {
            peakFinderOverlayComponent = (await import('~/components/peaks/PeakFinderOverlay.svelte')).default;
        }
        if (!peakFinderMapComponent) {
            peakFinderMapComponent = (await import('~/components/peaks/PeakFinderMap.svelte')).default;
        }
    }
    $: if ($peakFinderActive) {
        loadPeakFinderComponents();
        // the mode owns the whole screen: an open item sheet would sit on top of the panorama
        // bottomSheetStepIndex = 0;
    }
    let topTranslationY;
    let networkConnected = false;
    const itemLoading = false;

    const layerStack = new LayerStack(() => massifMap);

    let currentLanguage = ApplicationSettings.getString('map_language', ApplicationSettings.getString('language', 'en'));
    let currentMapRotation = 0;

    let navigationInstructions: {
        remainingDistance: number;
        remainingTime: number;
        instruction: RouteInstruction;
        distanceToNextInstruction: number;
    };

    // let localVectorDataSource: LocalVectorDataSource;
    let localVectorLayer: MassifLayer<'massif::VectorLayer'>;

    $: {
        if (steps) {
            // DEV_LOG && console.log('steps changed', bottomSheetStepIndex, steps);
            bottomSheetStepIndex = Math.min(steps.length - 1, bottomSheetStepIndex);
        }
    }

    // $: {
    //     if (showClickedFeatures === false) {
    //         currentClickedFeatures = null;
    //         if (selectedClickMarker) {
    //             selectedClickMarker.visible = false;
    //         }
    //     }
    // }

    const onAppUrl = tryCatchFunction(
        async (link: string) => {
            // if (__ANDROID__) {
            //     const activity = Application.android.startActivity;
            //     const visible = activity && activity.getWindow().getDecorView().getRootView().isShown();
            //     if (!visible) {
            //         if (args && args.eventName === AndroidApplication.activityStartedEvent) {
            //             //ignoring newIntent in background as we already received start activity event with intent
            //             return;
            //         } else {
            //         }
            //     }
            // }
            DEV_LOG && console.log('Got the following appURL', link);
            const loaded = !!massifMap;
            const isGeoUrl = link.startsWith('geo:');
            let locationMatch = isGeoUrl ? null : link.match(GEO_TEXT_REGEXP);
            let query: string;
            if (isGeoUrl || locationMatch) {
                let pos: MapPos;
                let posName: string;
                let searchQuery: string;
                if (isGeoUrl) {
                    const latlong = link.split(':')[1].split(',').map(parseFloat) as [number, number];
                    if (latlong[0] !== 0 || latlong[1] !== 0) {
                        pos = { lat: latlong[0], lon: latlong[1] };
                    }
                    const params = parseUrlQueryParameters(link);
                    if (params.hasOwnProperty('z')) {
                        const zoom = parseFloat(params.z);
                        if (loaded) {
                            massifMap.camera().zoom(zoom);
                        } else {
                            ApplicationSettings.setNumber('mapZoom', zoom);
                        }
                    }
                    if (params.q) {
                        locationMatch = params.q.match(GEO_TEXT_REGEXP);
                        if (!locationMatch && !pos) {
                            query = params.q;
                        }
                    }
                }
                if (locationMatch) {
                    pos = { lat: parseFloat(locationMatch[2]), lon: parseFloat(locationMatch[1]) };
                    if (locationMatch[3]) {
                        posName = decodeURIComponent(locationMatch[3]).replace(/\+/g, ' ');
                    }
                }
                if (pos) {
                    const item = {
                        properties: {
                            name: posName
                        },
                        geometry: {
                            coordinates: [pos.lon, pos.lat]
                        } as any
                    };
                    if (loaded) {
                        ApplicationSettings.remove('selectPosOnLoad');
                        massifMap.camera().position(toPosition(pos));
                        selectItem({
                            item,
                            isFeatureInteresting: true
                        });
                        // geo:lat,lon?pf=1 opens the panorama directly: debug aid to reproduce the exact
                        // same viewpoint with one adb command
                        if (isGeoUrl && parseUrlQueryParameters(link).pf) {
                            const { enterPeakFinder } = await import('~/mapModules/features/peakFinder');
                            await enterPeakFinder(item as any);
                        }
                    } else {
                        // happens before map ready
                        ApplicationSettings.setString('mapFocusPos', JSON.stringify(pos));
                        ApplicationSettings.setString('selectPosOnLoad', JSON.stringify(item));
                    }
                }
                if (searchQuery) {
                    query = decodeURIComponent(searchQuery).replace(/\+/g, ' ');
                }
            } else if (/(http(s?):\/\/)?((maps\.google\..*?\/)|((www\.)?google\..*?\/maps\/)|(goo.gl\/maps\/)).*/.test(link)) {
                const params = parseUrlQueryParameters(link);
                Object.keys(params).forEach((k) => {
                    const value = params[k];
                    if (k === 'saddr') {
                        if (value) {
                            if (/[\d.-]+,[\d.-]+/.test(value)) {
                                const pos = value.split(',').map(parseFloat);
                                massifMap.camera().position([pos[1], pos[0]]);
                                directionsPanel.addStartPoint({
                                    lat: pos[0],
                                    lon: pos[1]
                                });
                            }
                        }
                    } else if (k === 'daddr') {
                        if (value) {
                            if (/[\d.-]+,[\d.-]+/.test(value)) {
                                const pos = value.split(',').map(parseFloat);
                                massifMap.camera().position([pos[1], pos[0]]);
                                directionsPanel.addStopPoint({
                                    lat: pos[0],
                                    lon: pos[1]
                                });
                            }
                        }
                    }
                });
            } else if (link.endsWith('.gpx')) {
                showLoading();
                await itemModule.importGPXFile(link);
            } else if (link.endsWith('.geojson')) {
                showLoading();
                await itemModule.importGeoJSONFile(link);
            } else {
                query = decodeURIComponent(link).replace(/\+/g, ' ');
            }
            if (query) {
                if (loaded) {
                    ApplicationSettings.remove('searchOnLoad');
                    searchView.searchForQuery(query);
                } else {
                    ApplicationSettings.setString('searchOnLoad', query);
                }
                searchView.searchForQuery(query);
            }
        },
        undefined,
        hideLoading
    );

    async function onNetworkChange(event: NetworkConnectionStateEventData) {
        networkConnected = event.data.connected;
    }
    let customLayersModule: CustomLayersModule;
    let itemModule: ItemsModule;

    let isLandscape = Application.orientation() === 'landscape';
    // a Mac window has no orientation, only a size
    $: if (__CATALYST__) isLandscape = $windowSize.width > $windowSize.height;
    function onOrientationChanged(event: OrientationChangedEventData) {
        DEV_LOG && console.log('onOrientationChanged', event.newValue);
        isLandscape = event.newValue === 'landscape';
        if (__IOS__) {
            page?.nativeElement?.requestLayout();
        }
    }
    function onLayersReady() {
        startWebServerIfWanted();
    }

    onMount(() => {
        Application.on(Application.orientationChangedEvent, onOrientationChanged);
        networkService.on(NetworkConnectionStateEvent, onNetworkChange);
        networkConnected = networkService.connected;
        if (__ANDROID__) {
            Application.android.on(Application.android.activityBackPressedEvent, onAndroidBackButton);
        }
        customLayersModule = new CustomLayersModule();
        customLayersModule.once('ready', onLayersReady);

        itemModule = new ItemsModule();

        setMapContext({
            // drawer: drawer.nativeView,
            getMap: () => massifMap,
            getMapView: () => mapViewInstance,
            getMainPage: () => page,
            getCurrentLanguage: () => currentLanguage,
            getSelectedItem: () => $selectedItem,
            getEditingItem: () => editingItem,
            vectorElementClicked: onVectorElementClicked,
            vectorTileElementClicked: onVectorTileElementClicked,
            vectorTileClicked: onVectorTileClicked,
            getMapViewPort,
            // getCurrentLayer,
            selectStyle,
            selectItem,
            unselectItem,
            unFocusSearch,
            clearSearch,
            addLayer,
            insertLayer,
            getLayerIndex,
            replaceLayer,
            getLayerTypeFirstIndex,
            getLayers,
            removeLayer,
            startEditingItem,
            setSelectedItem,
            moveLayer,
            zoomToItem,
            showMapResultsPager,
            saveItem,
            setBottomSheetStepIndex: (index: number) => {
                DEV_LOG && console.log('setBottomSheetStepIndex', bottomSheetStepIndex, index, JSON.stringify(steps));
                bottomSheetStepIndex = index;
            },
            showMapMenu,
            showMapOptions
        });

        // registration order is dispatch order: the first module to handle a click wins
        registerMapModule('items', itemModule);
        registerMapModule('userLocation', new UserLocationModule());
        registerMapModule('customLayers', customLayersModule);
        registerMapModule('directionsPanel', directionsPanel);
        registerMapModule('mapScrollingWidgets', mapScrollingWidgets);
        // draws the route being navigated, which is never the selected item
        registerNavigationRouteModule();
        // mapResultsPager registers itself: it is behind an {#if}, so it does not exist yet

        onServiceLoaded((handler: GeoHandler) => {
            mapContext.runOnModules('onServiceLoaded', handler);
            navigationService.onServiceLoaded(handler);
        });
        onServiceUnloaded((handler: GeoHandler) => {
            mapContext.runOnModules('onServiceUnloaded', handler);
            navigationService.onServiceUnloaded();
        });

        Application.on('colorsChange', onColorsChange);

        if (!PRODUCTION) {
            defaultLiveSync = global.__onLiveSync.bind(global);
            global.__onLiveSync = (...args) => {
                DEV_LOG && console.log('__onLiveSync', args, currentLayerStyle);
                const context = args[0];
                if (!context && !!currentLayerStyle && !currentLayerStyle.endsWith('.zip')) {
                    reloadMapStyle && reloadMapStyle();
                }
                defaultLiveSync.apply(global, args);
            };
        }
    });
    function onColorsChange() {
        if (massifMap) {
            mapContext.innerDecoder?.call('setStyleParameters', {
                main_color: $colors.colorPrimary,
                main_darker_color: new Color($colors.colorPrimary).darken(10).hex
            });
        }
    }
    // function onLoaded() {}
    onDestroy(() => {
        // console.log('onMapDestroyed');
        Application.off(Application.orientationChangedEvent, onOrientationChanged);
        uninstallMacMouse?.();
        mapContext.runOnModules('onMapDestroyed');

        // localVectorLayer = null;
        // if (localVectorDataSource) {
        //     localVectorDataSource = null;
        // }
        // if (massifMap) {
        //     massifMap = null;
        // }
        // selectedPosMarker = null;
        if (DEV_LOG) {
            global.__onLiveSync = defaultLiveSync;
        }
    });

    let inFront = false;
    function onNavigatingTo() {
        inFront = true;
    }
    function onNavigatingFrom() {
        inFront = false;
    }
    const onAndroidBackButton = (data: AndroidActivityBackPressedEventData) =>
        onBackButton(page?.nativeView, () => {
            if (__ANDROID__) {
                if (!inFront || isBottomSheetOpened()) {
                    return;
                }
                data.cancel = true;
                // peak finder first: it's full-screen with its chrome hidden, so back means leave it
                if ($peakFinderActive) {
                    exitPeakFinder();
                } else if (searchView && searchView.hasFocus()) {
                    searchView.unfocus();
                } else if (directionsPanelVisible) {
                    directionsPanel.cancel();
                } else if (bottomSheetStepIndex !== 0) {
                    bottomSheetStepIndex = 0;
                } else {
                    Application.android.foregroundActivity.moveTaskToBack(true);
                }
            }
        });
    function reloadMapStyle() {
        // a folder style is compiled when its decoder is created: a new one picks up the edited files
        setMapStyle(currentLayerStyle, true);
        mapContext.runOnModules('reloadMapStyle');
    }

    function getOrCreateLocalVectorLayer(position) {
        if (!localVectorLayer) {
            const localVectorDataSource = massifMap.source('source.selection', { type: 'local', projection: { type: 'EPSG:4326' } });

            // a marker, not a point: drawn without depth, it sits on the terrain instead of above its drape lift
            const selectionColor = new Color(colorPrimary).setAlpha(178).hex;
            selectedPosMarker = massifMap.object('element', 'element.selection', {
                type: 'marker',
                position: toPosition(position),
                style: {
                    type: 'marker',
                    size: 20,
                    clickSize: 0,
                    bitmap: { type: 'url', url: getUserBitmapUrl('dot', selectionColor, selectionColor) },
                    // this dot *is* the place, so centred like the user marker
                    anchorPointX: 0,
                    anchorPointY: 0,
                    causesOverlap: false,
                    hideIfOverlapped: false,
                    // lies on the ground like the point it replaces, rather than standing up to face the camera
                    orientationMode: 'BILLBOARD_ORIENTATION_GROUND',
                    scalingMode: 'BILLBOARD_SCALING_CONST_SCREEN_SIZE'
                }
            });
            localVectorDataSource.call('add', selectedPosMarker.handle);
            localVectorLayer = massifMap.buildLayer('layer.selection', { type: 'elements', source: localVectorDataSource.id });
            // billboards draw after every layer, over the map's last labels: this puts the marker under them.
            // `trySet`: a no-op on an SDK without the property
            const selectionLayer: MassifLayer = localVectorLayer;
            selectionLayer.trySet('billboardsUnderLabels', true);
            localVectorLayer.onElementClick((e) => {
                e.consumed = onVectorElementClicked(mapContext.elementClickData(e));
            });
            addLayer(localVectorLayer, 'selection');
        }
        return localVectorLayer;
    }

    function resetBearing() {
        massifMap?.camera().rotation(0);
    }
    function getMapViewPort() {
        const { height, width } = massifMap.size();
        const left = Utils.layout.toDevicePixels(40);
        const top = Utils.layout.toDevicePixels(windowInsetTop + 90 + topTranslationY);
        const bottom = Utils.layout.toDevicePixels(windowInsetBottom - mapTranslation + 0);
        const min = Math.min(width - 2 * left, height - top - bottom);
        const deltaX = (width - min) / 2;
        const result = {
            left,
            top,
            width: width - 2 * left,
            height: height - top - bottom
        };
        // DEV_LOG && console.log('getMapViewPort', width, height, mapTranslation, topTranslationY, result);
        return result;
    }
    const saveSettings = debounce(function () {
        if (!massifMap) {
            return;
        }
        const camera = massifMap.camera();
        ApplicationSettings.setNumber('mapZoom', camera.zoom());
        ApplicationSettings.setNumber('mapBearing', camera.rotation());
        ApplicationSettings.setString('mapFocusPos', JSON.stringify(fromPosition(camera.position())));
    }, 500);

    let appUrlRegistered = false;

    async function onMainMapReady(e) {
        try {
            mapViewInstance = e.object;
            massifMap = api.attach(e.object);
            // massifMap.set('drawDistance', 4);
            api.log().apply({ showDebug: DEV_LOG, showInfo: DEV_LOG, showWarn: DEV_LOG, showError: DEV_LOG });
            mapContext.setMapDefaultOptions(massifMap);
            subscribeToMapEvents();
            if (__CATALYST__) {
                uninstallMacMouse = installMacMouse(mapViewInstance, onMapSecondaryClick);
            }

            const pos = JSON.parse(ApplicationSettings.getString('mapFocusPos', '{"lat":45.2012,"lon":5.7222}')) as MapPos;
            const zoom = ApplicationSettings.getNumber('mapZoom', 10);
            const bearing = ApplicationSettings.getNumber('mapBearing', 0);
            // ONE move: position, zoom and rotation set separately animate against each other
            massifMap.camera().moveTo(pos, { zoom, rotation: bearing });
            DEV_LOG && console.log('onMainMapReady', JSON.stringify(pos), zoom, bearing, layerStack.layers.length, theme);
            // re-add what modules registered before the map existed, and after an activity re-create
            layerStack.layers.forEach((added) => {
                addLayer(added.layer, added.layerId, true);
            });

            tryCatch(async () => {
                packageService.start();
                transitService.start();
                setMapStyle(ApplicationSettings.getString('mapStyle', DEFAULT_STYLE), true);
                onColorsChange();
                // setMapStyle('mobile-sdk-styles~voyager', true);
            });
            // the overlay may have been switched on before the map existed to add it to
            addTransitLayerIfPending();
            // setTimeout(() => {
            mapContext.runOnModules('onMapReady', massifMap);

            // }, 0);
            if (!appUrlRegistered) {
                appUrlRegistered = true;
                registerUniversalLinkCallback(onAppUrl);
                const current = getUniversalLink();
                if (current) {
                    itemModule.onDbInit(() => {
                        onAppUrl(current);
                    });
                }
            }
            try {
                const selectItemOnLoad = JSON.parse(ApplicationSettings.getString('selectPosOnLoad')) as IItem;
                if (selectItemOnLoad) {
                    ApplicationSettings.remove('selectPosOnLoad');
                    selectItem({
                        item: selectItemOnLoad,
                        isFeatureInteresting: true
                    });
                }
            } catch (error) {}
            const searchOnLoad = ApplicationSettings.getString('searchOnLoad');
            if (searchOnLoad) {
                ApplicationSettings.remove('searchOnLoad');
                searchView.searchForQuery(searchOnLoad);
            }
        } catch (error) {
            console.error(error, error.stack);
        }
    }
    let mapMoved = false;

    // `map.moved` fires above frame rate during a drag, hence the throttle. The camera is saved on
    // `map.stable` (once per movement), not `map.idle`, which also fires when tiles finish loading.
    function subscribeToMapEvents() {
        massifMap.subscribe(
            'map.moved',
            (e) => {
                mapContext.runOnModules('onMapMove', { data: { reason: e.reason as MapMoveReason } });
                mapMoved = true;
                currentMapRotation = Math.round(massifMap.camera().rotation() * 100) / 100;
            },
            { throttle: 100 }
        );
        massifMap.onInteraction((e) => {
            // an interaction is by definition the user: the SDK only raises it from the touch pipeline
            if (!mapMoved) {
                unFocusSearch();
            }
            mapContext.runOnModules('onMapInteraction', {
                data: {
                    panAction: e.panAction,
                    zoomAction: e.zoomAction,
                    rotateAction: e.rotateAction,
                    tiltAction: e.tiltAction,
                    animationStarted: e.animationStarted
                }
            });
            mapMoved = true;
        });
        massifMap.onStable((e) => {
            if (mapMoved) {
                mapMoved = false;
                saveSettings();
            }
            mapContext.runOnModules('onMapStable', { data: { reason: e.reason as MapMoveReason } });
        });
        massifMap.onIdle((e) => mapContext.runOnModules('onMapIdle', e));
        massifMap.onClick((e) => onMainMapClicked({ data: { clickType: e.clickType as ClickType, position: fromPosition(e.getPos('clickPos')) } }));
    }

    function onMainMapClicked(e: { data: MapClickData }) {
        const { clickType, position } = e.data;
        // DEV_LOG && console.log('onMainMapClicked', clickType, JSON.stringify(position), ignoreNextMapClick);
        // handleClickedFeatures(position);
        if (consumeIgnoreNextMapClick()) {
            return;
        }
        unFocusSearch();
        if (didIgnoreAlreadySelected) {
            didIgnoreAlreadySelected = false;
            return;
        }
        const handledByModules = mapContext.runOnModules('onMapClicked', e);
        // console.log('mapTile', latLngToTileXY(position.lat, position.lon, massifMap.zoom), clickType === ClickType.SINGLE, handledByModules, !!selectedItem);
        if (!handledByModules && clickType === ClickType.SINGLE) {
            selectItem({ item: { geometry: { type: 'Point', coordinates: [position.lon, position.lat] }, properties: {} }, isFeatureInteresting: !$selectedItem });
        }
    }
    // right-click selects the place under the cursor and lists what the sheet can do with it, there
    async function onMapSecondaryClick(point: { x: number; y: number }, position: MapPos) {
        try {
            unFocusSearch();
            await selectItem({ item: { geometry: { type: 'Point', coordinates: [position.lon, position.lat] }, properties: {} }, isFeatureInteresting: true });
            const anchor = macMenuAnchor.nativeView;
            anchor.translateX = point.x;
            anchor.translateY = point.y;
            await bottomSheetInner?.showActionsMenu(anchor);
        } catch (error) {
            showError(error);
        }
    }
    function onSelectedItemChanged(oldValue: IItem, value: IItem) {
        mapContext.runOnModules('onSelectedItem', value, oldValue);
    }

    function setSelectedItem(item, updateProperties?) {
        // DEV_LOG && console.log('setSelectedItem', item?.id, Date.now());
        if (updateProperties) {
            item.properties = item.properties || {};
            Object.assign(item.properties, updateProperties);
        }
        $selectedItem = item;
        itemModule?.onItemSelected(item);
    }
    async function selectItem({
        forceZoomOut = false,
        isFeatureInteresting = false,
        item,
        minZoom,
        peek = true,
        preventZoom = true,
        setMapSelected = false,
        setSelected = true,
        showButtons = false,
        zoom,
        zoomDuration
    }: {
        item: IItem;
        showButtons?: boolean;
        isFeatureInteresting?: boolean;
        peek?: boolean;
        setSelected?: boolean;
        setMapSelected?: boolean;
        preventZoom?: boolean;
        minZoom?: number;
        zoom?: number;
        zoomDuration?: number;
        forceZoomOut?: boolean;
    }) {
        try {
            // the peak finder has its own selection (the summit chip); anything else would raise the
            // item sheet behind chrome the mode hides
            if ($peakFinderActive) {
                return;
            }
            if (isFeatureInteresting && setSelected && $itemLock && $selectedItem) {
                return;
            }
            didIgnoreAlreadySelected = false;
            if (isFeatureInteresting) {
                const isCurrentItem = item === $selectedItem;
                // DEV_LOG && console.log('selectItem', setSelected, isCurrentItem, item.properties?.class, item.properties?.name, peek, setSelected, showButtons, Date.now());
                if (setSelected && isCurrentItem && !item) {
                    unselectItem(false);
                }
                const route = item?.route;
                const props = item.properties;
                if (peek) {
                    // the item sheet is not mounted while navigating: selecting still works, the sheet
                    // just comes back with the item already set once navigation ends
                    bottomSheetInner?.loadView().then(() => {
                        bottomSheetStepIndex = Math.max(showButtons ? 2 : 1, bottomSheetStepIndex);
                    });
                }
                if (setSelected) {
                    setSelectedItem(item);
                }
                if (setSelected && route) {
                    (async () => {
                        // DEV_LOG && console.log('selected_id', typeof route.osmid, route.osmid, typeof props.id, props.id, setSelected);
                        if (setMapSelected) {
                            selectedMapId = (route.osmid || props.osmid || props.id || props.name + props.class) + '';
                            mapContext.mapDecoder.call('setStyleParameters', { selected_id: selectedMapId });
                            const styleParameters = {};
                            styleParameters['selected_osmid'] = '0';
                            styleParameters['selected_id_str'] = '0';
                            styleParameters['selected_id'] = '0';
                            mapContext.innerDecoder.call('setStyleParameters', styleParameters);
                        } else {
                            if (selectedMapId) {
                                mapContext.mapDecoder.call('setStyleParameters', { selected_id: '' });
                                selectedMapId = null;
                            }
                            // selected_osmid is for routes
                            // mapContext.mapDecoder.setStyleParameter('selected_id', '');
                            const styleParameters = {};
                            if (props.id !== undefined) {
                                selectedId = props.id;
                                selectedOSMId = undefined;
                                styleParameters['selected_osmid'] = '0';
                                if (typeof props.id === 'string') {
                                    styleParameters['selected_id_str'] = selectedId;
                                    styleParameters['selected_id'] = '0';
                                } else {
                                    styleParameters['selected_id_str'] = '0';
                                    styleParameters['selected_id'] = selectedId + '';
                                }
                            } else if (route.osmid !== undefined) {
                                if (typeof route.osmid === 'string') {
                                    selectedId = route.osmid;
                                    selectedOSMId = undefined;
                                    styleParameters['selected_id_str'] = selectedId + '';
                                    styleParameters['selected_osmid'] = '0';
                                    styleParameters['selected_id'] = '0';
                                } else {
                                    selectedId = undefined;
                                    selectedOSMId = route.osmid;
                                    styleParameters['selected_osmid'] = selectedOSMId + '';
                                    styleParameters['selected_id_str'] = '0';
                                    styleParameters['selected_id'] = '0';
                                }
                            }
                            mapContext.innerDecoder.call('setStyleParameters', styleParameters);
                        }

                        if (selectedPosMarker) {
                            selectedPosMarker.set('visible', false);
                        }
                    })();
                } else {
                    (async () => {
                        const geometry = item.geometry as GeoJSONPoint;
                        const position = { lat: geometry.coordinates[1], lon: geometry.coordinates[0] };
                        if (!selectedPosMarker) {
                            getOrCreateLocalVectorLayer(position);
                        } else {
                            // the whole geometry: PointGeometry's `pos` is read-only
                            selectedPosMarker.set('geometry', { type: 'point', pos: toPosition(position) });
                            selectedPosMarker.set('visible', true);
                        }
                        if (setMapSelected) {
                            // TODO: not enabled for now as really slow
                            DEV_LOG && console.log('mapDecoder selected_id', props.name + props.class);
                            // if (props.subclass) {
                            selectedMapId = props.name + props.class;
                            mapContext.mapDecoder.call('setStyleParameters', { selected_id: selectedMapId });
                            // } else {
                            // mapContext.mapDecoder.setStyleParameter('selected_id', '');
                            // }
                        } else if (selectedMapId) {
                            mapContext.mapDecoder.call('setStyleParameters', { selected_id: '' });
                            selectedMapId = null;
                        }
                        if (setSelected) {
                            const styleParameters = {};
                            if (props.id !== undefined) {
                                selectedId = props.id;
                                if (typeof props.id === 'string') {
                                    styleParameters['selected_id_str'] = selectedId + '';
                                    styleParameters['selected_id'] = '0';
                                } else {
                                    styleParameters['selected_id'] = selectedId + '';
                                    styleParameters['selected_id_str'] = '';
                                }
                                styleParameters['selected_osmid'] = '0';
                            } else {
                                if (selectedOSMId !== undefined) {
                                    selectedOSMId = undefined;
                                    styleParameters['selected_osmid'] = '0';
                                }
                                if (selectedId !== undefined) {
                                    selectedId = undefined;
                                    // styleParameters['selected_osmid'] = '0';
                                    styleParameters['selected_id_str'] = '';
                                    styleParameters['selected_id'] = '0';
                                }
                            }
                            mapContext.innerDecoder.call('setStyleParameters', styleParameters);
                        }
                    })();
                }
                if (setSelected && !route) {
                    // independent lookups, so elevation doesn't wait on the much slower geocoder
                    if (props && 'ele' in props === false && packageService.hasElevation()) {
                        (async () => {
                            const geometry = item.geometry as GeoJSONPoint;
                            const position = { lat: geometry.coordinates[1], lon: geometry.coordinates[0] };
                            const ele = await packageService.getElevation(position);
                            if (ele && $selectedItem?.geometry === item.geometry) {
                                // DEV_LOG && console.log('found elevation', ele);
                                setSelectedItem($selectedItem, { ele });
                            }
                        })();
                    }
                    if (!props.address?.['city']) {
                        // off the selection tick: the offline geocoder opens its databases synchronously
                        // on first use, which would hold the item sheet back
                        setTimeout(async () => {
                            if ($selectedItem?.geometry !== item.geometry) {
                                return;
                            }
                            const address = await packageService.getItemAddress(item);
                            if (address && $selectedItem?.geometry === item.geometry) {
                                // DEV_LOG && console.log('found addresses', JSON.stringify(address));
                                const toUpdate = { address } as Record<string, any>;
                                if (address.name && !$selectedItem.properties.name) {
                                    toUpdate.name = address.name;
                                }
                                setSelectedItem($selectedItem, toUpdate);
                            }
                        }, 0);
                    }
                    // if (props && 'timezone' in props === false) {
                    //     const geometry = item.geometry as GeoJSONPoint;
                    //     const position = { lat: geometry.coordinates[1], lon: geometry.coordinates[0] };
                    //     packageService.getTimezone(position).then((result) => {
                    //         DEV_LOG && console.log('getTimezone', position, result.getFeatureCount());
                    //         const tzid = result?.getFeature(0).properties['tzid'];
                    //         if (tzid) {
                    //             if (__ANDROID__) {
                    //                 const timezone = java.util.TimeZone.getTimeZone(tzid);
                    //                 const offset = timezone.getOffset(Date.now()) / 3600000;
                    //                 DEV_LOG && console.log('timezone', tzid, timezone.getDisplayName(), offset, dayjs.utc().utcOffset(offset).format('lll'));
                    //             }
                    //         }
                    //     });
                    // }
                }

                if (!preventZoom) {
                    zoomToItem({ item, zoom, minZoom, duration: zoomDuration, forceZoomOut });
                }
            } else {
                unselectItem();
            }
        } catch (error) {
            console.error(error, error.stack);
        }
    }
    let mapResultItems: IItem<GeoJSONPoint>[] = [];
    let mapResultPagerLoaded = false;
    export function showMapResultsPager(items: IItem<GeoJSONPoint>[]) {
        mapResultPagerLoaded = true;
        mapResultItems = items || [];
    }

    export function zoomToItem({ duration = 200, forceZoomOut = false, item, minZoom, zoom }: { item: IItem; zoom?: number; minZoom?: number; duration?; forceZoomOut?: boolean }) {
        const viewPort = getMapViewPort();
        // DEV_LOG && console.log('zoomToItem', viewPort, item.properties?.zoomBounds, item.properties?.extent, !!item.route);
        const screen = {
            min: { x: viewPort.left, y: viewPort.top },
            max: { x: viewPort.left + viewPort.width, y: viewPort.top + viewPort.height }
        };
        const camera = massifMap.camera();
        if (item.properties?.zoomBounds) {
            const zoomLevel = getBoundsZoomLevel(item.properties.zoomBounds, {
                width: Screen.mainScreen.widthDIPs,
                height: Screen.mainScreen.widthDIPs
            });
            if (forceZoomOut || camera.zoom() < zoomLevel) {
                camera.fitBounds(toBounds(item.properties.zoomBounds), { screen, resetRotation: true, duration });
            }
        } else if (item.properties?.extent) {
            let extent: [number, number, number, number] = item.properties.extent as [number, number, number, number];
            if (typeof extent === 'string') {
                if (extent[0] !== '[') {
                    extent = `[${extent as string}]` as any;
                }
                extent = JSON.parse(extent as any);
            }
            camera.fitBounds(
                [
                    [extent[0], extent[1]],
                    [extent[2], extent[3]]
                ],
                { screen, integerZoom: true, resetRotation: true, duration: 200 }
            );
        } else if (item.route) {
            const bounds = geometryBounds(item.geometry);
            if (bounds) {
                camera.fitBounds(toBounds(bounds), { screen, integerZoom: true, resetRotation: true, duration: 200 });
            }
        } else if (item.geometry.type === 'Point') {
            // one move rather than a zoom animation racing a position animation
            const target = item.geometry.coordinates as [number, number];
            camera.moveTo(target, { zoom: zoom ?? (minZoom ? Math.max(minZoom, camera.zoom()) : undefined), duration });
        }
        // DEV_LOG && console.log('zoomToItem done ');
    }
    export function unselectItem(updateBottomSheet = true, forceUnlock = false) {
        // DEV_LOG && console.log('unselectItem', updateBottomSheet, !!$selectedItem, new Error().stack);

        // the route being followed cannot be dropped: a map tap or a pan would otherwise leave
        // navigation running against an item nothing is showing anymore

        if ($itemLock) {
            if (forceUnlock) {
                $itemLock = false;
            } else {
                return;
            }
        }
        if (!!$selectedItem) {
            // mapContext.mapDecoder.setStyleParameter('selected_id', '');
            setSelectedItem(null);
            if (selectedPosMarker) {
                selectedPosMarker.set('visible', false);
            }

            if (selectedMapId) {
                selectedMapId = null;
                mapContext.mapDecoder.call('setStyleParameters', { selected_id: '' });
            }
            const styleParameters = {};
            if (selectedOSMId !== undefined) {
                selectedOSMId = undefined;
                styleParameters['selected_osmid'] = '0';
            }
            if (selectedId !== undefined) {
                selectedId = undefined;
                styleParameters['selected_id'] = '0';
                styleParameters['selected_id_str'] = '';
            }
            mapContext.innerDecoder.call('setStyleParameters', styleParameters);
            if (updateBottomSheet) {
                bottomSheetStepIndex = 0;
            }
        }
    }

    //    $: {
    //        try {
    //            massifMap && mapContext?.innerDecoder?.setStyleParameter('routes_type', $routesType + '');
    //        } catch (error) {
    //           console.error(error, error.stack);
    //       }
    //    }
    //    $: {
    //        try {
    //            massifMap && mapContext?.innerDecoder?.setStyleParameter('route_shields', $showRouteShields ? '1' : '0');
    //       } catch (error) {
    //            console.error(error, error.stack);
    //       }
    //    }
    $: massifMap?.set('renderProjectionMode', $projectionModeSpherical ? 'RENDER_PROJECTION_MODE_SPHERICAL' : 'RENDER_PROJECTION_MODE_PLANAR');

    nutiProps.on('change', (event: any) => {
        // console.log('nutichange', event.key, event.nutiValue);
        if (event.nutiValue == null) {
            // reset to the style: its own value, then a Massif variant's, which the reset key may carry
            if (styleDefaults[event.key] != null) {
                setStyleParameter(event.key, styleDefaults[event.key]);
            }
            if (isMassifStyle(currentLayerStyle)) {
                vectorTileDecoder?.call('setStyleParameters', massifParameters(currentLayerStyle, mapStyleVariant(currentLayerStyle)));
            }
        } else {
            const value = styleValue(event.key, event.nutiValue);
            if (value != null) {
                setStyleParameter(event.key, value);
            }
        }
        styleParametersChanged();
    });
    innerNutiProps.on('change', (event: any) => {
        setStyleParameter(event.key, event.nutiValue, mapContext.innerDecoder);
    });
    layerProps.on('change', (event: any) => {
        switch (event.key) {
            case 'showSlopePercentages': {
                customLayersModule?.toggleHillshadeSlope(event.value);
                break;
            }
            default: {
                customLayersModule?.updateVectorTileLayerProperty(event.key, event.value);
                break;
            }
        }
    });
    // $: {
    //   const visible = $showRoutes;
    //    getLayers('routes').forEach((l) => {
    //           l.layer.visible = visible;
    //        });
    //      massifMap?.requestRedraw();
    //   }
    //    $: customLayersModule?.toggleHillshadeSlope($showSlopePercentages);
    $: itemModule?.setVisibility($showItemsLayer);
    // `rotationGestures`, not `rotatable`: the latter blocks EVERY rotation, compass reset included
    $: massifMap?.set('rotationGestures', $rotateEnabled);
    // derived: the 3D and peak-finder modes also constrain tilt (see mapTiltRange in terrainStore)
    $: massifMap?.set('tiltRange', $mapTiltRange);
    // $: currentLayer && (currentLayer.preloading = $preloading);
    let wasNavigating = false;
    // the item sheet steps aside while navigating and comes back after. Must stay before the
    // unselect below, which reads bottomSheetStepIndex
    $: if (wasNavigating !== $isNavigating) {
        wasNavigating = $isNavigating;
        // the sheet being unmounted cannot undo what it did to the floating widgets on its way out
        resetWidgetTransforms();
        if ($isNavigating) {
            $itemLock = true;
            loadNavigationViews();
            bottomSheetStepIndex = 0;
            navigationStepIndex = 1;
            showMapResultsPager(null);
        } else {
            $itemLock = false;
            navigationStepIndex = 0;
            bottomSheetStepIndex = $selectedItem ? 1 : 0;
        }
    }
    $: !$isNavigating && bottomSheetStepIndex === 0 && unselectItem(true, true);
    $: activeSheetHeight = $isNavigating ? navigationSteps[navigationStepIndex] : steps?.[bottomSheetStepIndex];
    $: {
        if (activeSheetHeight >= 0) {
            // the middle of the map left visible: above the sheet, or right of the landscape column (a
            // positive x moves the focus left)
            mapContext.focusOffset = landscapeNavigation
                ? { x: -Utils.layout.toDevicePixels(navigationColumnLeft + navigationColumnWidth) / 2, y: 0 }
                : { x: 0, y: Utils.layout.toDevicePixels(activeSheetHeight) / 2 };
            // a ScreenPos crosses as `[x, y]`, not as the {x, y} the rest of the app passes around
            massifMap?.set('focusPointOffset', [mapContext.focusOffset.x, mapContext.focusOffset.y]);
        }
    }

    // $: shouldShowNavigationBarOverlay = $navigationBarHeight !== 0 && !!selectedItem;

    const routePicker = new FeaturePicker({
        id: 'routes',
        key: (item) => item.route.osmid,
        label: (item) => item.properties.name,
        select: (item) => selectItem({ item, isFeatureInteresting: true, setMapSelected: true })
    });
    // function handleClickedFeatures(position: GeoLocation) {
    //     let fakeIndex = 0;
    //     // currentClickedFeatures = [...new Map(clickedFeatures.map((item) => [JSON.stringify(item), item])).values()];
    //     if (!selectedClickMarker) {
    //         getOrCreateLocalVectorLayer();
    //         const styleBuilder = new TextStyleBuilder({
    //             color: 'black',
    //             scaleWithDPI: true,
    //             borderWidth: 0,
    //             strokeWidth: 0,
    //             fontSize: 20,
    //             anchorPointX: 0.3,
    //             anchorPointY: -0.1
    //         });
    //         selectedClickMarker = new Text<LatLonKeys>({ position, projection, styleBuilder, text: '+' });
    //         localVectorDataSource.add(selectedClickMarker);
    //     } else {
    //         selectedClickMarker.position = position;
    //         selectedClickMarker.visible = true;
    //     }
    //     // clickedFeatures = [];
    // }

    // These three handlers must return a real boolean: `e.consumed` goes to native as a Boolean and
    // `undefined` unboxes to null, crashing the UI thread (`runOnModules` returns `unknown`).
    function onVectorTileClicked(data: FeatureClickData): boolean {
        DEV_LOG && console.log('onVectorTileClicked', data);
        if (isTransitPickerPending()) {
            return false;
        }
        const { clickType, featureData, featureGeometry, featureId, featureLayerName, featurePosition, layer, position } = data;

        const handledByModules = !!mapContext.runOnModules('onVectorTileClicked', data);
        DEV_LOG &&
            console.log(
                'onVectorTileClicked',
                clickType,
                featureLayerName,
                featureId,
                featureData.class,
                featureData.subclass,
                // featureData,
                JSON.stringify(position),
                JSON.stringify(featurePosition),
                handledByModules
            );
        if (!handledByModules && clickType === ClickType.SINGLE) {
            const currentProperties = $selectedItem?.properties;
            const currentGeometry = $selectedItem?.geometry;
            if (
                !!$selectedItem &&
                (didIgnoreAlreadySelected ||
                    (currentProperties && featureData.osmid && featureData.osmid === currentProperties.osmid) ||
                    featureId === currentProperties.id ||
                    (featureData.name === currentProperties.name &&
                        currentGeometry &&
                        currentGeometry.type === 'Point' &&
                        currentGeometry.coordinates[1] === featurePosition.lat &&
                        currentGeometry.coordinates[0] === featurePosition.lon))
            ) {
                didIgnoreAlreadySelected = true;
                return false;
            }
            featureData.layer = featureLayerName;
            if (featureLayerName === 'route') {
                DEV_LOG && console.log('handling route ');
                const added = routePicker.add({
                    properties: {
                        ...featureData
                    },
                    _nativeGeometry: featureGeometry,
                    route: {
                        osmid: featureData.osmid || featureData.ref || featureData.name
                    },
                    layer
                });
                return false;
            }

            //    const isFeatureInteresting = featureLayerName === 'poi' || featureLayerName === 'mountain_peak' || featureLayerName === 'housenumber' || (!!featureData.name && !selectedRoutes);
            const isFeatureInteresting = !routePicker.pending;
            // DEV_LOG && console.log('isFeatureInteresting', featureLayerName, featureData.name, isFeatureInteresting, featureGeometry.constructor.name, featurePosition, position);
            if (isFeatureInteresting) {
                clearIgnoreNextMapClick();
                routePicker.cancel();
                const result: IItem = {
                    properties: { featureId, ...featureData },
                    geometry: {
                        type: 'Point',
                        // GeoJSON geometry: test its `type`, not its constructor name
                        coordinates: isFeatureInteresting && !/Line|Polygon/.test(featureGeometry?.type ?? '') ? [featurePosition.lon, featurePosition.lat] : [position.lon, position.lat]
                    }
                };
                selectItem({
                    item: result,
                    isFeatureInteresting,
                    showButtons: featureData.class === 'bus' || featureData.subclass === 'tram_stop',
                    setMapSelected: /park|water_name|waterway/.test(featureLayerName)
                });
            }
            unFocusSearch();
            // if (isFeatureInteresting && showClickedFeatures) {
            //     didIgnoreAlreadySelected = true;
            //     return false;
            // }
            // return true to only look at first vector found
            return isFeatureInteresting;
        }
        return handledByModules;
    }
    function onVectorElementClicked(data: ElementClickData): boolean {
        const { clickType, elementPosition, metaData, position } = data;
        DEV_LOG && console.log('onVectorElementClicked', clickType, position, metaData);
        Object.keys(metaData).forEach((k) => {
            if (metaData[k][0] === '{' || metaData[k][0] === '[') {
                metaData[k] = JSON.parse(metaData[k]);
            }
        });

        const handledByModules = mapContext.runOnModules('onVectorElementClicked', data);
        // if (DEV_LOG) {
        //     console.log('handledByModules', handledByModules);
        // }
        if (!!metaData.instruction) {
            return true;
        }
        if (!handledByModules && clickType === ClickType.SINGLE && Object.keys(metaData).length > 0) {
            const item: IItem = {
                geometry: {
                    type: 'Point',
                    coordinates: [elementPosition.lon, elementPosition.lat]
                },
                properties: metaData
            };
            // }
            if (item.id && $selectedItem && $selectedItem.id === item.id) {
                return true;
            }
            // if (item.properties?.route) {
            //     item.properties.route.positions = (element as Line<LatLonKeys>).getPoses() as any;
            // }
            selectItem({ item, isFeatureInteresting: true });
            unFocusSearch();
            return true;
        }
        return !!handledByModules;
    }
    function onVectorTileElementClicked(data: FeatureClickData): boolean {
        const { clickType, featureData, featurePosition, position } = data;
        DEV_LOG && console.log('onVectorTileElementClicked', clickType, position, featurePosition, featureData.id);
        const feature = itemModule.getFeature(featureData.id);
        if (!feature) {
            return false;
        }
        // Object.keys(feature.properties).forEach((k) => {
        //     if (feature.properties[k][0] === '{' || feature.properties[k][0] === '[') {
        //         feature.properties[k] = JSON.parse(feature.properties[k]);
        //     }
        // });
        const handledByModules = !!mapContext.runOnModules('onVectorTileElementClicked', data);
        // if (DEV_LOG) {
        //     console.log('handledByModules', handledByModules);
        // }
        if (!!featureData.instruction) {
            return true;
        }
        DEV_LOG && console.log('onVectorTileElementClicked', clickType, JSON.stringify(position), JSON.stringify(featurePosition), featureData.id, handledByModules, $selectedItem?.id);
        if (!handledByModules && clickType === ClickType.SINGLE) {
            const item: IItem = feature;
            // }
            if (item.id && $selectedItem && $selectedItem.id === item.id) {
                return true;
            }
            // if (item.properties?.route) {
            //     item.properties.route.positions = (element as Line<LatLonKeys>).getPoses() as any;
            // }
            selectItem({ item, isFeatureInteresting: true });
            unFocusSearch();
            return true;
        }
        return handledByModules;
    }
    function unFocusSearch() {
        // executeOnMainThread(function () {
        // DEV_LOG && console.log('unFocusSearch', searchView?.hasFocus());
        if (searchView?.hasFocus()) {
            searchView.unfocus();
        }
        // });
    }
    function clearSearch() {
        // executeOnMainThread(function () {
        // DEV_LOG && console.log('unFocusSearch', searchView?.hasFocus());
        searchView?.clearSearch();
        // });
    }

    function setStyleParameter(key: string, value: string | number, decoder?) {
        decoder = decoder || mapContext.mapDecoder;
        // DEV_LOG && console.log('setStyleParameter', key, value);
        decoder?.call('setStyleParameter', key, value + '');
    }

    function handleNewLanguage(newLang) {
        // DEV_LOG && console.log('handleNewLanguage', newLang);
        currentLanguage = newLang;
        packageService.currentLanguage = newLang;
        setStyleParameter('lang', newLang);
    }
    onLanguageChanged(handleNewLanguage);
    onMapLanguageChanged(handleNewLanguage);

    // function getCurrentLayer() {
    //     return currentLayer;
    // }

    function setMapStyle(layerStyle: string, force = false) {
        layerStyle = layerStyle.toLowerCase();
        // a variant project (`massif~outdoor`, stored by an earlier build) is the variant row's project at that variant
        const massifProject = isMassifStyle(layerStyle) && layerStyle.split('~')[1];
        if (massifProject && (MASSIF_VARIANTS as readonly string[]).includes(massifProject)) {
            layerStyle = `${MASSIF_PACKAGE}~${MASSIF_PACKAGE}`;
            ApplicationSettings.setString('mapStyleVariant.' + layerStyle, massifProject);
        }
        let mapStyle = layerStyle;
        let mapStyleLayer = 'streets';
        if (layerStyle.indexOf('~') !== -1) {
            const array = layerStyle.split('~');
            mapStyle = array[0];
            mapStyleLayer = array[1];
        }
        DEV_LOG && console.log('setMapStyle', layerStyle, currentLayerStyle, mapStyle, mapStyleLayer, force);
        //  showToast('setMapStyle ' + layerStyle);
        if (layerStyle !== currentLayerStyle || !!force) {
            const isZip = mapStyle.endsWith('.zip');
            const stylePath = mapStyle.startsWith('/') ? mapStyle : `~/assets/styles/${mapStyle}`;
            DEV_LOG && console.log('stylePath', stylePath, isZip, stylePath.startsWith('~/assets/'));
            if (!stylePath.startsWith('~/assets/') && ((isZip && !File.exists(stylePath)) || (!isZip && !Folder.exists(stylePath)))) {
                return setMapStyle(DEFAULT_STYLE, true);
            }
            currentLayerStyle = layerStyle;
            ApplicationSettings.setString('mapStyle', layerStyle);
            try {
                vectorTileDecoder = mapContext.createMapDecoder(mapStyle, mapStyleLayer);
                readStyleDefaults(vectorTileDecoder);
                // the default click filter follows the style family
                mapContext.mapModules.customLayers?.updateClickHandlerLayerFilter();
                const nutiPropsToApply = nutiProps.getKeys().reduce((acc, key) => {
                    const value = styleValue(key, nutiProps.getNutiValue(key));
                    if (value != null) {
                        acc[key] = value;
                    }
                    return acc;
                }, {});
                if (isMassifStyle(layerStyle)) {
                    const variant = mapStyleVariant(layerStyle);
                    Object.assign(nutiPropsToApply, massifParameters(layerStyle, variant));
                    if (variant === 'eink') {
                        mapContext.setInnerStyle('eink', mapStyle);
                    }
                }
                if (Object.keys(nutiPropsToApply).length > 0) {
                    //    showToast(JSON.stringify(nutiPropsToApply));
                    vectorTileDecoder.call('setStyleParameters', nutiPropsToApply);
                }
                massifVariant.set(mapStyleVariant(layerStyle));
                styleParametersChanged();
            } catch (error) {
                vectorTileDecoder = null;
                showError(error);
            }

            handleNewLanguage(currentLanguage);
        }
    }

    /** the style's own value of each parameter the app knows, read before the app sets any: what a zoom left unset goes back to */
    let styleDefaults: Record<string, string> = {};
    function readStyleDefaults(decoder) {
        const defaults: Record<string, string> = {};
        for (const key of new Set([...nutiProps.getKeys(), ...VARIANT_PARAMETER_KEYS])) {
            try {
                defaults[key] = decoder.call('getStyleParameter', key);
            } catch (error) {
                // not a parameter of this style
            }
        }
        // the hillshade layer's own max visible zoom is the limit, the style's z16 cut-off would override it
        if (defaults.hillshade_max_zoom != null) {
            defaults.hillshade_max_zoom = '24';
        }
        styleDefaults = defaults;
        styleParameterKeys.set(Object.keys(defaults));
    }
    /** the legend and the map options follow what the style draws with now */
    function styleParametersChanged() {
        const values: Record<string, string> = {};
        Object.keys(styleDefaults).forEach((key) => {
            try {
                values[key] = vectorTileDecoder?.call('getStyleParameter', key);
            } catch (error) {}
        });
        styleParameterValues.set(values);
        legendVersion.update((v) => v + 1);
    }
    type NutiKey = ReturnType<typeof nutiProps.getKeys>[number];
    const isNutiKey = (key: string): key is NutiKey => nutiProps.getKeys().includes(key as NutiKey);
    /** a zoom parameter at -1 is unset: the style's own value, not zoom -1 */
    function styleValue(key: string, value: string) {
        if (value === '-1' && isNutiKey(key) && nutiProps.getProps(key)?.settingsOptionsType === 'zoom') {
            return styleDefaults[key] ?? null;
        }
        return value;
    }

    // a Massif project draws every variant and every POI ranking: style parameters, stored per project
    function mapStyleVariant(layerStyle: string) {
        return isMassifStyle(layerStyle) && layerStyle.split('~')[1] === MASSIF_PACKAGE ? ApplicationSettings.getString('mapStyleVariant.' + layerStyle, null) : null;
    }
    /** the variant project's own parameters, under the user's settings, then the variant and the ranking */
    function massifParameters(layerStyle: string, variant: string) {
        const params: Record<string, string> = {};
        VARIANT_PARAMETER_KEYS.forEach((key) => {
            if (styleDefaults[key] != null) {
                params[key] = styleValue(key, isNutiKey(key) ? nutiProps.getNutiValue(key) : null) ?? styleDefaults[key];
            }
        });
        const overrides = variantParameters(variant);
        Object.keys(overrides).forEach((key) => {
            if (!isNutiKey(key) || !ApplicationSettings.hasKey(nutiProps.getKey(key))) {
                params[key] = overrides[key];
            }
        });
        Object.assign(params, rankingParameters(rankingFor(massifLook(layerStyle, variant))), iconFontParameters());
        if (variant) {
            params['variant'] = variant;
        }
        return params;
    }
    function setMapStyleVariant(layerStyle: string, variant: string) {
        ApplicationSettings.setString('mapStyleVariant.' + layerStyle, variant);
        if (layerStyle !== currentLayerStyle) {
            return setMapStyle(layerStyle, true);
        }
        // same decoder, a few parameters: a re-decode, not a new style
        vectorTileDecoder?.call('setStyleParameters', massifParameters(layerStyle, variant));
        massifVariant.set(variant);
        const innerStyle = variant === 'eink' ? 'eink' : 'voyager';
        if (ApplicationSettings.getString('innerStyle') !== innerStyle) {
            mapContext.setInnerStyle(innerStyle, layerStyle.split('~')[0]);
        }
        styleParametersChanged();
    }
    /** the map loads its icon font with the decoder: a new one */
    function setMassifIconFont(font: MassifIconFont) {
        massifIconFont.set(font);
        setMapStyle(currentLayerStyle, true);
    }
    function setMapStyleRanking(ranking: MassifRanking) {
        setRankingFor(massifLook(currentLayerStyle, mapStyleVariant(currentLayerStyle)), ranking);
        vectorTileDecoder?.call('setStyleParameters', rankingParameters(ranking));
        legendVersion.update((v) => v + 1);
    }

    const VARIANT_LOOKS: { [k: string]: { icon: string; iconColor: string; swatch: [string, string] } } = {
        streets: { icon: 'mdi-city-variant-outline', iconColor: '#5d6b7a', swatch: ['#f7f4ee', '#c9d7e6'] },
        outdoor: { icon: 'mdi-pine-tree', iconColor: '#3f6b2a', swatch: ['#eef3e3', '#a9cf8a'] },
        topo: { icon: 'mdi-terrain', iconColor: '#7a5a32', swatch: ['#f6eedc', '#c9ad7e'] },
        hybrid: { icon: 'mdi-satellite-variant', iconColor: '#e8efe2', swatch: ['#3d5236', '#1f2a1c'] },
        eink: { icon: 'mdi-book-open-variant', iconColor: '#000000', swatch: ['#ffffff', '#9a9a9a'] }
    };
    const LEGACY_LOOK = { icon: 'mdi-map-outline', iconColor: '#5d6b7a', swatch: ['#f2efe9', '#d6d2c8'] as [string, string] };

    function stylePreview(name: string) {
        const file = path.join(knownFolders.currentApp().path, 'assets', 'images', 'styles', `massif-${name}.png`);
        return File.exists(file) ? file : undefined;
    }
    async function listStyleFamilies(): Promise<StyleFamily[]> {
        function filterEntity(e) {
            return !/(inner|admin|cleaned|base)/.test(e.name);
        }
        async function getFolderEntities(folderPath): Promise<(File | Folder)[]> {
            if (Folder.exists(folderPath)) {
                return (await Folder.fromPath(folderPath).getEntities()).filter(filterEntity);
            }
            return [];
        }
        const stylePath = path.join(knownFolders.currentApp().path, 'assets', 'styles');
        const entities = (
            await Promise.all(
                [stylePath, path.join(getDataFolder(), 'styles'), path.join(getSavedMBTilesDir(), 'styles'), '/storage/emulated/0/Documents/dev/alpimaps/dev_assets/styles'].map(getFolderEntities)
            )
        ).flat();
        const families: StyleFamily[] = [];
        for (let index = 0; index < entities.length; index++) {
            const e = entities[index];
            const packageName = e.path.startsWith(stylePath) ? e.name.replace(/\.zip$/, '') : e.path;
            let styleNames: string[];
            if (Folder.exists(e.path)) {
                styleNames = (await Folder.fromPath(e.path).getEntities()).filter((s) => s.name.endsWith('.json') || s.name.endsWith('.xml')).map((s) => s.name.split('.')[0]);
            } else {
                try {
                    // the archive, only to list what is in it: `assetNames` is a plain property
                    const pack = api.create('assets', `assets.probe.${e.name}`, { type: 'zip', data: { type: 'url', url: `file://${e.path}` } });
                    styleNames = pack
                        .get('assetNames')
                        .filter((s) => s.endsWith('.xml'))
                        .map((s) => s.split('.')[0]);
                    pack.destroy();
                } catch (error) {
                    console.error(error, error.stack);
                    continue;
                }
            }
            const data = (name: string) => (e.path.startsWith(stylePath) ? e.name : e.path) + '~' + name;
            if (packageName === MASSIF_PACKAGE) {
                // the folder (dev) and the zip (release) are the same styles: list them once
                if (families.some((f) => f.id === 'massif')) {
                    continue;
                }
                // one row: the five variants of one project (a style parameter, no reload), then the
                // Alpimaps OSM look, a project of its own (its colour sheets differ)
                const variants: StyleVariant[] = MASSIF_VARIANTS.map((variant) => {
                    const look = VARIANT_LOOKS[variant];
                    return {
                        id: variant,
                        name: lc('variant_' + variant),
                        style: `${MASSIF_PACKAGE}~${MASSIF_PACKAGE}`,
                        variant,
                        icon: look.icon,
                        iconColor: look.iconColor,
                        swatch: look.swatch,
                        preview: stylePreview(variant)
                    };
                });
                if (styleNames.includes('alpimaps')) {
                    variants.push({
                        id: 'alpimaps',
                        name: 'OSM',
                        style: `${MASSIF_PACKAGE}~alpimaps`,
                        icon: 'mdi-map-legend',
                        iconColor: '#7a5a32',
                        swatch: ['#f2efe9', '#aad3df'],
                        preview: stylePreview('osm')
                    });
                }
                families.unshift({ id: 'massif', name: 'Massif', subtitle: '', variants });
                continue;
            }
            const variants = styleNames
                .filter((name) => name !== 'project' && name !== 'legend')
                .map((name) => {
                    const look = VARIANT_LOOKS[name] || LEGACY_LOOK;
                    return { id: name, name, style: data(name), icon: look.icon, iconColor: look.iconColor, swatch: look.swatch };
                });
            if (variants.length) {
                families.push({ id: data(''), name: e.name.replace(/\.zip$/, ''), subtitle: e.name.endsWith('.zip') ? 'ZIP' : lc('legacy'), variants });
            }
        }
        return families;
    }

    async function selectStyle() {
        try {
            const families = await listStyleFamilies();
            const StylePicker = (await import('./StylePicker.svelte')).default;
            await showBottomSheet({
                view: StylePicker,
                peekHeight: 200,
                trackingScrollView: 'collectionView',
                disableDimBackground: true,
                dismissOnBackgroundTap: true,
                props: {
                    families,
                    current: { style: currentLayerStyle, variant: mapStyleVariant(currentLayerStyle) },
                    onSelect: (family: StyleFamily, variant: StyleVariant) => {
                        if (variant.variant) {
                            setMapStyleVariant(variant.style.toLowerCase(), variant.variant);
                        } else {
                            setMapStyle(variant.style, true);
                        }
                    },
                    onRanking: setMapStyleRanking,
                    onIconFont: setMassifIconFont
                }
            });
        } catch (error) {
            showError(error);
        }
    }

    const addLayer = (layer: MassifLayer, layerId: LayerType, force = false) => layerStack.addLayer(layer, layerId, force);
    const insertLayer = (layer: MassifLayer, layerId: LayerType, index: number) => layerStack.insertLayer(layer, layerId, index);
    const removeLayer = (layer: MassifLayer) => layerStack.removeLayer(layer);
    const moveLayer = (layer: MassifLayer, newIndex: number) => layerStack.moveLayer(layer, newIndex);
    const replaceLayer = (oldLayer: MassifLayer, layer: MassifLayer) => layerStack.replaceLayer(oldLayer, layer);
    const getLayerIndex = (layer: MassifLayer) => layerStack.getLayerIndex(layer);
    const getLayerTypeFirstIndex = (layerId: LayerType) => layerStack.getLayerTypeFirstIndex(layerId);
    const getLayers = (layerId?: LayerType) => layerStack.getLayers(layerId);
    // landscape: banner and bar share a left column (a bike mount), the map gets the rest
    $: landscapeNavigation = $isNavigating && isLandscape;
    $: navigationColumnWidth = Math.round(Math.min(Math.max($windowSize.width * 0.42, 320), 460));
    // the map button bar keeps its portrait place on the left edge, the column starts right of it
    $: navigationColumnLeft = landscapeNavigation ? windowInsetLeft + 50 : 0;
    // the banner is reserved in every navigation state, so what sits under it never moves; in
    // landscape nothing does, the banner has the column to itself
    $: navigationRailTop = landscapeNavigation ? 10 : Math.round(MANEUVER_VIEW_HEIGHT * $navigationScale) + 20;
    // the banner takes the search bar's place for the whole navigation, paused included
    $: hideChromeForNavigation = $isNavigating;
    $: hideChromeForPeakFinder = $peakFinderActive;

    let scrollingWidgetsOpacity = 1;
    let mapTranslation = 0;
    function getWidgetsOpacity(translation) {
        if (translation >= -300) {
            return 1;
        } else {
            return Math.max(0, 1 - (-translation - 300) / 30);
        }
    }

    $: scrollingWidgetsOpacity = windowInsetBottom > 200 ? 0 : getWidgetsOpacity(mapTranslation);

    function bottomSheetTranslationFunction(translation, maxTranslation, progress) {
        if (!$isNavigating) {
            scrollingWidgetsOpacity = getWidgetsOpacity(translation);
            // mapTranslation = translation - (__IOS__ && translation !== 0 ? $navigationBarHeight : 0);
            mapTranslation = translation;
        }
        const result = {
            bottomSheet: {
                translateY: translation
            },
            searchView: {
                target: searchView.getNativeView(),
                opacity: scrollingWidgetsOpacity
            },
            locationInfo: {
                target: locationInfoPanel.getNativeView(),
                opacity: scrollingWidgetsOpacity
            },
            ...(!$isNavigating
                ? {
                      mapScrollingWidgets: {
                          target: mapScrollingWidgets.getNativeView(),
                          translateY: translation,
                          opacity: scrollingWidgetsOpacity
                      }
                  }
                : {})
        } as any;
        if (mapResultsPager) {
            result.mapResultsPager = {
                target: mapResultsPager.getNativeView(),
                translateY: translation,
                opacity: scrollingWidgetsOpacity
            };
        }
        return result;
    }
    function navigationBottomSheetcanAnimateToStep(step) {
        return step !== 0;
    }
    function navigationBottomSheetTranslationFunction(translation, maxTranslation, progress) {
        // mapTranslation = translation - (__IOS__ && translation !== 0 ? $navigationBarHeight : 0);
        if ($isNavigating) {
            scrollingWidgetsOpacity = getWidgetsOpacity(translation);
            mapTranslation = translation;
        }
        const result = {
            bottomSheet: {
                translateY: translation
            },
            ...($isNavigating
                ? {
                      mapScrollingWidgets: {
                          target: mapScrollingWidgets.getNativeView(),
                          // beside the landscape column, not above it: nothing to make room for
                          translateY: landscapeNavigation ? 0 : translation,
                          opacity: scrollingWidgetsOpacity
                      }
                  }
                : {})
        } as any;
        return result;
    }

    const saveItem = tryCatchFunction(async (item: IItem = $selectedItem, peek = true) => {
        DEV_LOG && console.log('saveItem', item);
        if (!item) {
            return;
        }
        const itemsModule = mapContext.mapModule('items');
        item = await itemsModule.saveItem(item);
        if (item.route) {
            await mapContext.mapModules.directionsPanel.cancel(false);
            await itemsModule.takeItemPicture(item);
        }
        mapContext.selectItem({ item, isFeatureInteresting: true, peek, preventZoom: false });
    });

    function switchLocationInfo() {
        locationInfoPanel.switchLocationInfo();
    }

    async function shareScreenshot() {
        const image = await massifMap.capture(true);
        return share({
            image
        });
    }

    onDestroy(stopWebServer);
    const showMapMenu = tryCatchFunction(
        async (event) => {
            const options = (
                [
                    {
                        accessibilityValue: 'settingsBtn',
                        title: lc('settings'),
                        id: 'settings',
                        icon: 'mdi-cogs'
                    }
                ] as any
            )
                .concat(
                    customLayersModule.hasLocalData
                        ? [
                              {
                                  title: lc('select_style'),
                                  id: 'select_style',
                                  icon: 'mdi-layers'
                              }
                          ]
                        : []
                )
                .concat([
                    {
                        title: lc('location_info'),
                        id: 'location_info',
                        icon: 'mdi-speedometer'
                    },
                    {
                        title: lc('share_screenshot'),
                        id: 'share_screenshot',
                        icon: 'mdi-cellphone-screenshot'
                    },
                    {
                        title: lc('compass'),
                        id: 'compass',
                        icon: 'mdi-compass'
                    }
                ])
                .concat(
                    __ANDROID__
                        ? [
                              {
                                  title: lc('satellites_view'),
                                  id: 'gps_status',
                                  icon: 'mdi-satellite-variant'
                              }
                          ]
                        : ([] as any)
                )
                .concat([
                    {
                        title: lc('astronomy'),
                        id: 'astronomy',
                        icon: 'mdi-weather-night'
                    },
                    {
                        title: lc('import_data'),
                        id: 'import',
                        icon: 'mdi-import'
                    }
                ] as any);

            if (SENTRY_ENABLED && isSentryEnabled) {
                options.push({
                    title: lc('bug_report'),
                    id: 'sentry',
                    icon: 'mdi-bug'
                });
            }

            if (isSensorAvailable('barometer')) {
                options.splice(options.length - 2, 0, {
                    title: lc('altimeter'),
                    id: 'altimeter',
                    icon: 'mdi-altimeter'
                });
            }
            // whatever the registered features contribute to the main menu — see ~/mapModules/features/
            options.push(...$mainMenuItemsStore.map(({ color, icon, id, title }) => ({ color, icon, id, title })));

            await showPopoverMenu({
                options,
                vertPos: VerticalPosition.BELOW,
                horizPos: HorizontalPosition.ALIGN_RIGHT,
                anchor: event.object,
                props: {
                    // autoSizeListItem: true,
                    maxHeight: Screen.mainScreen.heightDIPs - 100,
                    width: Math.min(280, Screen.mainScreen.widthDIPs * 0.8),
                    // the two modes lead as toggle pills, switched in place without closing the menu
                    toggles: [
                        { id: 'dark_mode', icon: 'mdi-theme-light-dark', label: lc('dark'), selected: $forceDarkMode },
                        { id: 'offline_mode', icon: 'mdi-wifi-strength-off-outline', label: lc('offline'), selected: networkService.forcedOffline }
                    ],
                    onToggle: (toggle) => {
                        if (toggle.id === 'dark_mode') {
                            toggleForceDarkMode();
                        } else {
                            networkService.forcedOffline = toggle.selected;
                        }
                    }
                },
                onLongPress: tryCatchFunction(async (result) => {
                    if (result) {
                        await $mainMenuItemsStore.find((item) => item.id === result.id)?.onLongPress?.();
                    }
                }),
                onClose: async (result) => {
                    if (result) {
                        switch (result.id) {
                            case 'select_style':
                                await selectStyle();
                                break;
                            case 'location_info':
                                switchLocationInfo();
                                break;
                            case 'share_screenshot':
                                shareScreenshot();
                                break;
                            case 'keep_awake':
                                keepScreenAwake.set(!$keepScreenAwake);
                                break;
                            case 'dark_mode':
                                toggleForceDarkMode();
                                break;
                            case 'offline_mode':
                                networkService.forcedOffline = !networkService.forcedOffline;
                                break;
                            case 'sentry':
                                await sendBugReport();
                                break;
                            case 'import': {
                                const result = await openFilePicker({
                                    documentTypes: ['com.akylas.gpx'],
                                    mimeTypes: ['*/*'],
                                    multipleSelection: true,
                                    pickerMode: 0
                                });
                                DEV_LOG && console.log('selected', result.files);

                                const geojsonFiles = [];
                                const gpxFiles = [];
                                const files = result.files?.filter((f) => {
                                    let filePath = f;
                                    if (__ANDROID__) {
                                        filePath = akylas.alpi.maps.Utils.Companion.getFileNameSync(Utils.android.getApplicationContext(), f);
                                    }
                                    if (filePath.match(/(\.gpx)$/i)) {
                                        gpxFiles.push(f);
                                    } else if (filePath.match(/(\.geojson)$/i)) {
                                        geojsonFiles.push(f);
                                    }
                                });
                                DEV_LOG && console.log('fil?es', files);
                                if (geojsonFiles?.length || gpxFiles?.length) {
                                    showLoading();
                                    for (let index = 0; index < geojsonFiles.length; index++) {
                                        const filePath = geojsonFiles[index];
                                        if (filePath && File.exists(filePath)) {
                                            await getMapContext().mapModule('items').importGeoJSONFile(filePath);
                                        }
                                    }
                                    for (let index = 0; index < gpxFiles.length; index++) {
                                        const filePath = gpxFiles[index];
                                        if (filePath && File.exists(filePath)) {
                                            await getMapContext().mapModule('items').importGPXFile(filePath);
                                        }
                                    }
                                }
                                break;
                            }
                            default: {
                                const featureItem = $mainMenuItemsStore.find((item) => item.id === result.id);
                                if (featureItem) {
                                    await featureItem.run();
                                } else {
                                    await handleMapAction(result.id);
                                }
                                break;
                            }
                        }
                    }
                }
            });
        },
        undefined,
        hideLoading
    );
    const showMapOptions = tryCatchFunction(async () => {
        const MapOptions = (await import('~/components/map/MapOptions.svelte')).default;
        return showBottomSheet({
            view: MapOptions,
            skipCollapsedState: true
        });
    });

    async function sendBugReport() {
        if (SENTRY_ENABLED) {
            const result = await prompt({
                title: lc('send_bug_report'),
                message: lc('send_bug_report_desc'),
                okButtonText: l('send'),
                cancelButtonText: l('cancel'),
                autoFocus: true,
                hintText: lc('description'),
                helperText: lc('please_describe_error')
            });
            if (result?.result) {
                Sentry.captureMessage(result.text);
                // flush doesn't work on Android yet: the event is sent on restart
                setTimeout(() => Sentry.flush(0), 1000);
                showSnack({ message: l('bug_report_sent') });
            }
        }
    }

    let drawn = false;
    function reportFullyDrawn() {
        if (!drawn) {
            drawn = true;
            if (__ANDROID__) {
                try {
                    (Application.android.foregroundActivity as android.app.Activity).reportFullyDrawn();
                } catch (err) {}
            }
        }
    }

    // outside the reactive statement below, or the linter flags a possible loop
    const overflowButton = {
        text: 'mdi-dots-vertical',
        order: 90,
        onTap: tryCatchFunction(
            async (event) => {
                // entirely fed by the registered features — see ~/mapModules/features/
                const options = $featureMenuItemsStore.map(({ color, icon, id, title }) => ({ color, icon, id, title }));

                await showPopoverMenu({
                    options,
                    vertPos: VerticalPosition.ALIGN_BOTTOM,
                    horizPos: HorizontalPosition.LEFT,
                    anchor: event.object,
                    props: {
                        maxHeight: Screen.mainScreen.heightDIPs - 100
                    },
                    onLongPress: tryCatchFunction(async (result) => {
                        if (result) {
                            await $featureMenuItemsStore.find((item) => item.id === result.id)?.onLongPress?.();
                        }
                    }),
                    onClose: async (result) => {
                        if (result) {
                            await $featureMenuItemsStore.find((item) => item.id === result.id)?.run();
                        }
                    }
                });
            },
            undefined,
            hideLoading
        )
    };
    $: hasOverflowMenu = (WITH_BUS_SUPPORT && customLayersModule?.devMode) || $mapCapabilities.hasLocalData;
    // features slot themselves in by order rather than the bar knowing where each one belongs
    $: sideButtons = [...$featureSideButtonsStore, ...(hasOverflowMenu ? [overflowButton] : [])].sort((first, second) => (first.order ?? 0) - (second.order ?? 0));

    function onDirectionsCancel() {
        endEditingItem();
    }
    function startEditingItem(item: Item) {
        if (!!item.route) {
            DEV_LOG && console.log('startEditingItem', item.properties.id);
            mapContext.innerDecoder.call('setStyleParameter', 'editing_id', item.properties.id + '');
            getMapContext().mapModule('items').showItem(item);
            editingItem = item;
            unselectItem(true, true);

            // getMapContext().mapModule('items').hideItem(item);
        }
    }
    function endEditingItem() {
        if (editingItem) {
            editingItem = null;
            mapContext.innerDecoder.call('setStyleParameter', 'editing_id', '0');

            // getMapContext().mapModule('items').hideItem(item);
        }
    }
    function onStepIndexChanged(e) {
        if (e.value !== bottomSheetStepIndex) {
            bottomSheetStepIndex = e.value;
        }
    }
    function onNavigationStepIndexChanged(e) {
        if (e.value !== navigationStepIndex) {
            navigationStepIndex = e.value;
        }
    }
    // translation functions move widgets by native reference, so the outgoing sheet's transforms
    // outlive it
    function resetWidgetTransforms() {
        scrollingWidgetsOpacity = 1;
        mapTranslation = 0;
        [searchView, locationInfoPanel, mapScrollingWidgets, mapResultsPager].forEach((view) => {
            const nativeView = view?.getNativeView();
            if (nativeView) {
                nativeView.opacity = 1;
                nativeView.translateY = 0;
            }
        });
    }
    // translation only: the item sheet owns the widgets' opacity
    function navigationTranslationFunction(translation, maxTranslation, progress) {
        const result = {
            bottomSheet: {
                translateY: translation
            }
        } as any;
        if (mapScrollingWidgets) {
            result.mapScrollingWidgets = {
                target: mapScrollingWidgets.getNativeView(),
                translateY: translation
            };
        }
        return result;
    }
</script>

<page
    bind:this={page}
    actionBarHidden={true}
    backgroundColor="#E3E1D3"
    ios:iosIgnoreSafeArea={false}
    keepScreenAwake={$keepScreenAwake}
    screenBrightness={$keepScreenAwake && $keepScreenAwakeFullBrightness ? 1 : -1}
    statusBarStyle={directionsPanelVisible && isDarkTheme($currentRealTheme) ? 'dark' : 'light'}
    ios:statusBarColor="transparent"
    android:statusBarColor={directionsPanelVisible ? colorBackground : 'transparent'}
    on:navigatingTo={onNavigatingTo}
    on:navigatingFrom={onNavigatingFrom}>
    <gridlayout>
        <!-- AR preview UNDER the map: a translucent GL surface only reveals surfaces below it.
             `{#if}` so no camera is held open outside the mode. -->
        {#if $peakFinderArActive}
            <!-- pinch zoom off on purpose: zoom changes the FOV, and the live zoom ratio can't be
                 queried on Android (it lives on the plugin's CameraX camera) -->
            <cameraview bind:this={arCameraPreview} enablePinchZoom={false} height="100%" width="100%" on:cameraOpen={() => onArCameraOpen(arCameraPreview)} />
        {/if}
        <!-- collapsed during AR: three GL surfaces (preview, live map, panorama) have no defined order -->
        <massifmap accessibilityLabel="massifMap" visibility={$peakFinderArActive ? 'collapse' : 'visible'} zoom={16} on:mapReady={onMainMapReady} on:layoutChanged={reportFullyDrawn} />
        {#if isCatalyst}
            <!-- the right-click menu points at it: an iOS popover only anchors to a view -->
            <gridlayout bind:this={macMenuAnchor} height={1} horizontalAlignment="left" isUserInteractionEnabled={false} verticalAlignment="top" width={1} />
        {/if}

        <!-- two sheets, never both: item and navigation step lists are incompatible -->
        <!-- transparent: the navigation view is a row of floating cards with the map showing between them -->
        <bottomsheet
            backgroundColor="transparent"
            canAnimateToStep={navigationBottomSheetcanAnimateToStep}
            marginBottom={windowInsetBottom}
            marginLeft={windowInsetLeft}
            marginRight={windowInsetRight}
            panGestureOptions={{ failOffsetXEnd: 20, minDist: 40 }}
            stepIndex={navigationStepIndex}
            steps={navigationSteps}
            translationFunction={navigationBottomSheetTranslationFunction}
            on:stepIndexChange={onNavigationStepIndexChanged}>
            <gridlayout height="100%" isPassThroughParentEnabled={true} width="100%" />
            <gridlayout
                prop:bottomSheet
                height={navigationSteps[navigationSteps.length - 1]}
                horizontalAlignment={landscapeNavigation ? 'left' : 'stretch'}
                marginLeft={landscapeNavigation ? navigationColumnLeft - windowInsetLeft : 0}
                width={landscapeNavigation ? navigationColumnWidth : '100%'}>
                {#if navigationViewComponent}
                    <!-- tall enough for every step, the sheet decides how much of it shows -->
                    <svelte:component this={navigationViewComponent} />
                {/if}
            </gridlayout>
        </bottomsheet>
        <bottomsheet
            marginBottom={windowInsetBottom}
            marginLeft={windowInsetLeft}
            marginRight={windowInsetRight}
            panGestureOptions={{ failOffsetXEnd: 20, minDist: 40 }}
            stepIndex={$isNavigating ? 0 : bottomSheetStepIndex}
            {steps}
            translationFunction={bottomSheetTranslationFunction}
            on:stepIndexChange={onStepIndexChanged}>
            <!-- the map overlays live outside both sheets: neither owns them, so either sheet can come and
             go with the mode without taking the widgets down with it -->
            <gridlayout bind:this={widgetsHolder} height="100%" isPassThroughParentEnabled={true} width="100%">
                <ButtonBar
                    class="panel mapControl"
                    borderRadius={20}
                    buttonSize={40}
                    buttons={sideButtons}
                    color={isEInk ? '#aaa' : colorOnSurfaceVariant}
                    gray={true}
                    horizontalAlignment="left"
                    isUserInteractionEnabled={!$isNavigating || scrollingWidgetsOpacity > 0.3}
                    marginLeft={landscapeNavigation ? windowInsetLeft + 5 : 5}
                    opacity={$isNavigating ? scrollingWidgetsOpacity : 1}
                    separatorColor={colorOutlineSoft}
                    verticalAlignment="top"
                    visibility={$peakFinderActive ? 'collapse' : 'visible'}
                    android:marginTop={($isNavigating ? navigationRailTop : 66 + Math.max(topTranslationY - 90, 0)) + windowInsetTop}
                    ios:marginTop={$isNavigating ? navigationRailTop : 66 + windowInsetTop + Math.max(topTranslationY - 90, 0)} />

                <LocationInfoPanel
                    bind:this={locationInfoPanel}
                    hidden={$isNavigating || $peakFinderActive}
                    horizontalAlignment="left"
                    isUserInteractionEnabled={scrollingWidgetsOpacity > 0.3}
                    marginLeft={53}
                    marginTop={66 + windowInsetTop + Math.max(topTranslationY - 90, 0)}
                    verticalAlignment="top" />
                <Search
                    bind:this={searchView}
                    style="z-index:1000;"
                    defaultElevation={0}
                    isUserInteractionEnabled={scrollingWidgetsOpacity > 0.3}
                    item={$selectedItem}
                    margin={10}
                    verticalAlignment="top"
                    visibility={hideChromeForNavigation || hideChromeForPeakFinder ? 'collapse' : 'visible'}
                    android:marginTop={windowInsetTop + 10} />
                {#if maneuverViewComponent}
                    <!-- in landscape the expanded sheet runs up into it, so it fades with the sheet like the map buttons -->
                    <svelte:component
                        this={maneuverViewComponent}
                        style="z-index:1001;"
                        horizontalAlignment={landscapeNavigation ? 'left' : 'stretch'}
                        margin={10}
                        opacity={landscapeNavigation ? scrollingWidgetsOpacity : 1}
                        verticalAlignment="top"
                        width={landscapeNavigation ? navigationColumnWidth - 20 : 'auto'}
                        android:marginLeft={(landscapeNavigation ? navigationColumnLeft : windowInsetLeft) + 10}
                        ios:marginLeft={(landscapeNavigation ? navigationColumnLeft - windowInsetLeft : 0) + 10}
                        android:marginTop={windowInsetTop + 10} />
                {/if}
                {#if navigationRailComponent}
                    <svelte:component
                        this={navigationRailComponent}
                        horizontalAlignment="right"
                        isUserInteractionEnabled={scrollingWidgetsOpacity > 0.3}
                        marginRight={10}
                        onCompass={resetBearing}
                        opacity={scrollingWidgetsOpacity}
                        rotation={currentMapRotation}
                        verticalAlignment="top"
                        visibility={$isNavigating ? 'visible' : 'collapse'}
                        android:marginTop={windowInsetTop + navigationRailTop}
                        ios:marginTop={navigationRailTop} />
                {/if}
                {#if routeSimulatorPanelComponent}
                    <svelte:component
                        this={routeSimulatorPanelComponent}
                        horizontalAlignment="center"
                        verticalAlignment="top"
                        android:marginTop={windowInsetTop + navigationRailTop}
                        ios:marginTop={navigationRailTop} />
                {/if}
                <canvaslabel
                    class="mdi"
                    color={colorError}
                    fontSize={12}
                    height={30}
                    horizontalAlignment="right"
                    isUserInteractionEnabled={false}
                    textAlignment="center"
                    verticalAlignment="middle"
                    width={20}>
                    <cspan text="mdi-access-point-network-off" textAlignment="left" verticalTextAlignment="top" visibility={networkConnected ? 'collapse' : 'visible'} />
                </canvaslabel>
                <mdcardview
                    id="orientation"
                    class="small-floating-btn"
                    horizontalAlignment="right"
                    android:marginTop={66 + windowInsetTop + Math.max(topTranslationY - 90, 0)}
                    ios:marginTop={66 + Math.max(topTranslationY - 90, 0)}
                    shape="round"
                    verticalAlignment="top"
                    visibility={currentMapRotation !== 0 && !$peakFinderActive && !$isNavigating ? 'visible' : 'collapse'}
                    on:tap={resetBearing}>
                    <label class="mdi" color={colorPrimary} rotate={currentMapRotation} text="mdi-navigation" textAlignment="center" verticalAlignment="middle" />
                </mdcardview>
                <!-- <mdbutton


                on:tap={resetBearing}
                class="small-floating-btn"
                text="mdi-navigation"
                rotate={-currentMapRotation}
                verticalAlignment="top"
                horizontalAlignment="right"
                translateY={Math.max(topTranslationY - 50, 0)}
            /> -->
                {#if $showLegend && !$peakFinderActive && !$isNavigating}
                    <!-- below the compass, under half the screen: the map stays there to compare -->
                    <MapLegend
                        horizontalAlignment="right"
                        marginRight={5}
                        marginTop={116 + windowInsetTop + Math.max(topTranslationY - 90, 0)}
                        maxHeight={$windowSize.height * 0.45}
                        verticalAlignment="top" />
                {/if}
                <MapScrollingWidgets
                    bind:this={mapScrollingWidgets}
                    isUserInteractionEnabled={scrollingWidgetsOpacity > 0.3}
                    leftInset={landscapeNavigation ? navigationColumnLeft + navigationColumnWidth : 0}
                    opacity={scrollingWidgetsOpacity}
                    visibility={$peakFinderActive ? 'collapse' : 'visible'} />
                <DirectionsPanel
                    bind:this={directionsPanel}
                    {editingItem}
                    paddingTop={windowInsetTop}
                    verticalAlignment="top"
                    width="100%"
                    bind:visible={directionsPanelVisible}
                    bind:translationY={topTranslationY}
                    on:cancel={onDirectionsCancel} />
                {#if mapResultPagerLoaded}
                    <MapResultPager bind:this={mapResultsPager} style="z-index:9000;" items={mapResultItems} translateY={mapTranslation} verticalAlignment="bottom" width="100%" />
                {/if}
            </gridlayout>

            <BottomSheetInner
                prop:bottomSheet
                bind:this={bottomSheetInner}
                horizontalAlignment={isLandscape ? 'left' : 'stretch'}
                item={$selectedItem}
                sheetWidth={isLandscape ? Math.max($windowSize.width / 2, 400) : $windowSize.width}
                updating={itemLoading}
                width={isLandscape ? Math.max($windowSize.width / 2, 400) : '100%'}
                bind:navigationInstructions
                bind:steps />
        </bottomsheet>

        <!-- the live map underneath is only covered: the SDK renders when dirty, so it costs nothing idle -->
        {#if $peakFinderActive && peakFinderMapComponent}
            <svelte:component this={peakFinderMapComponent} />
        {/if}

        <!-- the peak finder's own chrome, over the map and above every other widget -->
        {#if peakFinderOverlayComponent}
            <svelte:component this={peakFinderOverlayComponent} style="z-index:1002;" visibility={$peakFinderActive ? 'visible' : 'collapse'} />
        {/if}

        <!-- {#if __IOS__ || (__ANDROID__ && SDK_VERSION >= 35)}
            <absolutelayout backgroundColor={colorBackground} ios:iosIgnoreSafeArea={false} height={__IOS__ ? 1 : windowInsetBottom} verticalAlignment="bottom" />
        {/if} -->
    </gridlayout>
</page>
