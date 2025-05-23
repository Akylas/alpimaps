<script lang="ts">
    import { share } from '@akylas/nativescript-app-utils/share';
    import { isSensorAvailable } from '@nativescript-community/sensors';
    import type { MapPos } from '@nativescript-community/ui-carto/core';
    import { ClickType, MapBounds, toNativeMapRange, toNativeScreenPos } from '@nativescript-community/ui-carto/core';
    import { GeoJSONVectorTileDataSource } from '@nativescript-community/ui-carto/datasources';
    import { LocalVectorDataSource } from '@nativescript-community/ui-carto/datasources/vector';
    import { Layer, TileSubstitutionPolicy } from '@nativescript-community/ui-carto/layers';
    import type { RasterTileClickInfo } from '@nativescript-community/ui-carto/layers/raster';
    import type { VectorElementEventData, VectorTileEventData } from '@nativescript-community/ui-carto/layers/vector';
    import { VectorLayer, VectorTileLayer, VectorTileRenderOrder } from '@nativescript-community/ui-carto/layers/vector';
    import { Projection } from '@nativescript-community/ui-carto/projections';
    import { EPSG3857 } from '@nativescript-community/ui-carto/projections/epsg3857';
    import { EPSG4326 } from '@nativescript-community/ui-carto/projections/epsg4326';
    import { CartoMap, MapClickInfo, RenderProjectionMode } from '@nativescript-community/ui-carto/ui';
    import { ZippedAssetPackage, nativeVectorToArray, setShowDebug, setShowError, setShowInfo, setShowWarn } from '@nativescript-community/ui-carto/utils';
    import { Point } from '@nativescript-community/ui-carto/vectorelements/point';
    import { MBVectorTileDecoder } from '@nativescript-community/ui-carto/vectortiles';
    import { openFilePicker } from '@nativescript-community/ui-document-picker';
    import { closeBottomSheet, isBottomSheetOpened, showBottomSheet } from '@nativescript-community/ui-material-bottomsheet/svelte';
    import { prompt } from '@nativescript-community/ui-material-dialogs';
    import { HorizontalPosition, VerticalPosition } from '@nativescript-community/ui-popover';
    import { closePopover, showPopover } from '@nativescript-community/ui-popover/svelte';
    import { getUniversalLink, registerUniversalLinkCallback } from '@nativescript-community/universal-links';
    import { Application, ApplicationSettings, Color, File, GridLayout, Page, Utils } from '@nativescript/core';
    import type { AndroidActivityBackPressedEventData, OrientationChangedEventData } from '@nativescript/core/application/application-interfaces';
    import { Folder, knownFolders, path } from '@nativescript/core/file-system';
    import { Screen } from '@nativescript/core/platform';
    import { debounce } from '@nativescript/core/utils';
    import { Sentry, isSentryEnabled } from '@shared/utils/sentry';
    import { navigate } from '@shared/utils/svelte/ui';
    import { writable } from 'svelte/store';
    import { tryCatch, tryCatchFunction } from '@shared/utils/ui';
    import type { Point as GeoJSONPoint } from 'geojson';
    import { onDestroy, onMount } from 'svelte';
    import { NativeViewElementNode } from 'svelte-native/dom';
    import BottomSheetInner from '~/components/bottomsheet/BottomSheetInner.svelte';
    import ButtonBar from '~/components/common/ButtonBar.svelte';
    import DirectionsPanel from '~/components/directions/DirectionsPanel.svelte';
    import LocationInfoPanel from '~/components/map/LocationInfoPanel.svelte';
    import MapScrollingWidgets from '~/components/map/MapScrollingWidgets.svelte';
    import Search from '~/components/search/Search.svelte';
    import { GeoHandler } from '~/handlers/GeoHandler';
    import { l, lc, lt, onLanguageChanged, onMapLanguageChanged } from '~/helpers/locale';
    import { forceDarkMode, isEInk, theme, toggleForceDarkMode } from '~/helpers/theme';
    import watcher from '~/helpers/watcher';
    import CustomLayersModule from '~/mapModules/CustomLayersModule';
    import ItemsModule from '~/mapModules/ItemsModule';
    import type { LayerType } from '~/mapModules/MapModule';
    import { createTileDecoder, getMapContext, handleMapAction, setMapContext } from '~/mapModules/MapModule';
    import UserLocationModule from '~/mapModules/UserLocationModule';
    import type { IItem, Item, RouteInstruction } from '~/models/Item';
    import { onServiceLoaded, onServiceUnloaded } from '~/services/BgService.common';
    import type { NetworkConnectionStateEventData } from '~/services/NetworkService';
    import { NetworkConnectionStateEvent, networkService } from '~/services/NetworkService';
    import { packageService } from '~/services/PackageService';
    import { transitService } from '~/services/TransitService';
    import { NOTIFICATION_CHANEL_ID_KEEP_AWAKE_CHANNEL, NotificationHelper } from '~/services/android/NotifcationHelper';
    import {
        cityMinZoom,
        forestPatternZoom,
        rockPatternZoom,
        scrubPatternZoom,
        screePatternZoom,
        contourLinesOpacity,
        emphasisDrinkingWater,
        emphasisRails,
        mapFontScale,
        pitchEnabled,
        preloading,
        projectionModeSpherical,
        rotateEnabled,
        routesType,
        show3DBuildings,
        showContourLines,
        showRoutes,
        showSlopePercentages,
        showSubBoundaries,
        showPolygonsBorder,
        showRoadShields,
        showRouteShields,
        showItemsLayer,
        itemLock,
        routeDashMinZoom,
        immersive,
        immersiveOnlyLocked
    } from '~/stores/mapStore';
    import { ALERT_OPTION_MAX_HEIGHT, DEFAULT_TILE_SERVER_AUTO_START, DEFAULT_TILE_SERVER_PORT, SETTINGS_TILE_SERVER_AUTO_START, SETTINGS_TILE_SERVER_PORT } from '~/utils/constants';
    import { getBoundsZoomLevel } from '~/utils/geo';
    import { parseUrlQueryParameters } from '~/utils/http';
    import { showError } from '@shared/utils/showError';
    import { copyTextToClipboard, hideLoading, onBackButton, showAlertOptionSelect, showLoading, showPopoverMenu, showSnack, showSliderPopover, showToolTip } from '~/utils/ui';
    import { clearTimeout, disableShowWhenLockedAndTurnScreenOn, enableShowWhenLockedAndTurnScreenOn, setTimeout, askForScheduleAlarmPermission } from '~/utils/utils';
    import { colors, screenHeightDips, screenWidthDips, windowInset } from '../../variables';
    import MapResultPager from '../search/MapResultPager.svelte';
    $: ({ colorBackground, colorError, colorPrimary } = $colors);
    $: ({ bottom: windowInsetBottom, left: windowInsetLeft, right: windowInsetRight, top: windowInsetTop } = $windowInset);
    const KEEP_AWAKE_NOTIFICATION_ID = 23466578;

    const LAYERS_ORDER: LayerType[] = ['map', 'customLayers', 'admin', 'routes', 'transit', 'hillshade', 'items', 'directions', 'search', 'selection', 'userLocation'];
    const KEEP_AWAKE_KEY = '_keep_awake';
    let defaultLiveSync = global.__onLiveSync;

    let page: NativeViewElementNode<Page>;
    let widgetsHolder: NativeViewElementNode<GridLayout>;
    let cartoMap: CartoMap<LatLonKeys>;
    let directionsPanel: DirectionsPanel;
    let mapResultsPager: MapResultPager;
    let bottomSheetInner: BottomSheetInner;
    let mapScrollingWidgets: MapScrollingWidgets;
    let locationInfoPanel: LocationInfoPanel;
    let searchView: Search;
    const mapContext = getMapContext();

    let selectedOSMId: string;
    let selectedId: string;
    let selectedMapId: string;
    let selectedPosMarker: Point<LatLonKeys>;
    const selectedItem = watcher<Item>(null, onSelectedItemChanged);
    let editingItem: Item = null;
    let handleSelectedRouteTimer: NodeJS.Timeout;
    let handleSelectedTransitLinesTimer: NodeJS.Timeout;
    let selectedRoutes: IItem[];
    let selectedTransitLines: IItem[];
    let didIgnoreAlreadySelected = false;

    let currentLayerStyle: string;
    let vectorTileDecoder: MBVectorTileDecoder;

    let bottomSheetStepIndex = 0;
    let steps;
    let topTranslationY;
    let networkConnected = false;
    const itemLoading = false;  

    let projection: Projection = new EPSG4326();
    const addedLayers: { layer: Layer<any, any>; layerId: LayerType }[] = [];

    let currentLanguage = ApplicationSettings.getString('map_language', ApplicationSettings.getString('language', 'en'));
    let keepScreenAwake = ApplicationSettings.getBoolean(KEEP_AWAKE_KEY, false);
    let keepScreenAwakeFullBrightness = false;
    let showOnLockscreen = false;
    let currentMapRotation = 0;

    let navigationInstructions: {
        remainingDistance: number;
        remainingTime: number;
        instruction: RouteInstruction;
        distanceToNextInstruction: number;
    };

    let ignoreNextMapClick = false;

    let fetchingTransitLines = false;
    let showTransitLines = false;
    let showAdmins = false;

    let transitVectorTileDataSource: GeoJSONVectorTileDataSource;
    let transitVectorTileLayer: VectorTileLayer;
    // let localVectorDataSource: LocalVectorDataSource;
    let localVectorLayer: VectorLayer;
    let adminVectorTileLayer: VectorTileLayer;

    $: {
        if (steps) {
            // ensure bottomSheetStepIndex is not out of range when
            // steps changes
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
    function updateTransitLayer() {
        const oldLayer = transitVectorTileLayer;
        transitVectorTileLayer = null;
        createTransitLayer(false);
        mapContext.replaceLayer(oldLayer, transitVectorTileLayer);
    }
    function createTransitLayer(add = true) {
        transitVectorTileLayer = new VectorTileLayer({
            // preloading: true,
            visibleZoomRange: [7, 24],
            layerBlendingSpeed: 3,
            labelBlendingSpeed: 3,
            preloading: $preloading,
            tileSubstitutionPolicy: TileSubstitutionPolicy.TILE_SUBSTITUTION_POLICY_VISIBLE,
            labelRenderOrder: VectorTileRenderOrder.LAST,
            dataSource: transitVectorTileDataSource,
            decoder: mapContext.innerDecoder
        });
        mapContext.innerDecoder.once('change', updateTransitLayer);
        transitVectorTileLayer.setVectorTileEventListener<LatLonKeys>(
            {
                onVectorTileClicked: ({ featureData, featureGeometry, featureId, featureLayerName }) => {
                    if (handleSelectedRouteTimer) {
                        return;
                    }
                    DEV_LOG && console.log('clicked on transit data', featureId, featureLayerName, featureGeometry, handleSelectedTransitLinesTimer);
                    if (featureLayerName === 'routes') {
                        if (handleSelectedTransitLinesTimer) {
                            clearTimeout(handleSelectedTransitLinesTimer);
                        }
                        const id = featureData.route_id || featureData.id || featureId;
                        selectedTransitLines = selectedTransitLines || [];
                        handleSelectedTransitLinesTimer = setTimeout(() => {
                            handleSelectedTransitLines();
                        }, 10);

                        if (selectedTransitLines.findIndex((s) => s.properties.id === id) === -1) {
                            const color = featureData['route_color']?.length ? featureData['route_color'] : transitService.defaultTransitLineColor;
                            const agency = featureData['agency_id'];
                            const textColor = new Color(color).getBrightness() >= 186 ? '#000000' : '#ffffff';
                            const lineName = featureData['CODE'].split('_')[1];
                            const item: IItem = {
                                properties: {
                                    class: 'bus',
                                    id,
                                    ref: featureData['route_short_name'],
                                    subtitle: featureData['agency_name'],
                                    name: featureData['route_long_name'],
                                    symbol: `${color}:${color}:${agency === 'FLIXBUS-eu' ? 'FLIX' : featureData['route_short_name']}:${textColor}`,
                                    layer: featureLayerName,
                                    ...featureData
                                },
                                route: {
                                    osmid: id
                                } as any,
                                _nativeGeometry: featureGeometry,
                                layer: transitVectorTileLayer
                            };
                            selectedTransitLines.push(item);
                            ignoreNextMapClick = true;
                        }
                        return false;
                    }
                    // selectItem({ item, isFeatureInteresting: true });
                    // return true;
                    // mapContext.vectorTileClicked(e);
                }
            },
            mapContext.getProjection()
        );
        mapContext.innerDecoder.setStyleParameter('default_transit_color', transitService.defaultTransitLineColor);
        if (add) {
            addLayer(transitVectorTileLayer, 'transit');
        }
    }
    $: {
        if (showTransitLines) {
            // const pos = cartoMap.focusPos;
            tryCatch(
                async () => {
                    if (!transitVectorTileLayer && !fetchingTransitLines) {
                        fetchingTransitLines = true;

                        const result = await transitService.getTransitLines();
                        if (!transitVectorTileDataSource) {
                            transitVectorTileDataSource = new GeoJSONVectorTileDataSource({
                                // simplifyTolerance: 0,
                                minZoom: 0,
                                maxZoom: 24
                            });
                            transitVectorTileDataSource.createLayer('routes');
                        }
                        transitVectorTileDataSource.setLayerGeoJSONString(1, result);
                        if (!transitVectorTileLayer) {
                            createTransitLayer();
                        }
                        // if (!transitVectorTileLayer) {
                        // } else {
                        //     transitVectorTileLayer.visible = true;
                        // }
                    } else if (transitVectorTileLayer) {
                        transitVectorTileLayer.visible = true;
                    }
                },
                () => {
                    showTransitLines = false;
                },
                () => {
                    fetchingTransitLines = false;
                }
            );
        } else if (transitVectorTileLayer) {
            transitVectorTileLayer.visible = false;
        }
    }

    $: {
        // DEV_LOG && console.log('showAdmins', showAdmins, customLayersModule?.hasLocalData, adminVectorTileLayer);
        if (showAdmins && customLayersModule?.hasLocalData) {
            // const pos = cartoMap.focusPos;
            tryCatch(
                async () => {
                    if (!adminVectorTileLayer) {
                        DEV_LOG && console.log('show admins ');
                        adminVectorTileLayer = new VectorTileLayer({
                            layerBlendingSpeed: 3,
                            labelBlendingSpeed: 3,
                            preloading: $preloading,
                            tileSubstitutionPolicy: TileSubstitutionPolicy.TILE_SUBSTITUTION_POLICY_VISIBLE,
                            labelRenderOrder: VectorTileRenderOrder.LAST,
                            dataSource: (getLayers('map')[0].layer as any as VectorTileLayer).dataSource,
                            decoder: createTileDecoder('admin')
                        });
                        adminVectorTileLayer.setVectorTileEventListener<LatLonKeys>(
                            {
                                onVectorTileClicked: ({ featureData, featureGeometry, featureId, featureLayerName }) => {
                                    if (handleSelectedRouteTimer) {
                                        return;
                                    }
                                    // DEV_LOG && console.log('onVectorTileClicked', featureId, featureLayerName, JSON.stringify(featureData));
                                    return false;
                                    // selectItem({ item, isFeatureInteresting: true });
                                    // return true;
                                    // mapContext.vectorTileClicked(e);
                                }
                            },
                            mapContext.getProjection()
                        );
                        addLayer(adminVectorTileLayer, 'admin');
                        // } else {
                        //     transitVectorTileLayer.visible = true;
                        // }
                    } else if (adminVectorTileLayer) {
                        adminVectorTileLayer.visible = true;
                    }
                },
                () => (showAdmins = false)
            );
        } else if (adminVectorTileLayer) {
            adminVectorTileLayer.visible = false;
        }
        if (adminVectorTileLayer) {
            setStyleParameter('hide_admins', adminVectorTileLayer.visible ? '1' : '0');
        }
    }

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
            TEST_LOG && console.log('Got the following appURL', link);
            if (link.startsWith('geo')) {
                const latlong = link.split(':')[1].split(',').map(parseFloat) as [number, number];
                const loaded = !!cartoMap;
                if (latlong[0] !== 0 || latlong[1] !== 0) {
                    if (loaded) {
                        cartoMap.setFocusPos({ lat: latlong[0], lon: latlong[1] }, 0);
                    } else {
                        // happens before map ready
                        ApplicationSettings.setString('mapFocusPos', `{"lat":${latlong[0]},"lon":${latlong[1]}}`);
                    }
                }
                const params = parseUrlQueryParameters(link);
                if (params.hasOwnProperty('z')) {
                    const zoom = parseFloat(params.z);
                    if (loaded) {
                        cartoMap.setZoom(zoom, 0);
                    } else {
                        ApplicationSettings.setNumber('mapZoom', zoom);
                    }
                }
                if (params.q) {
                    const geoTextRegexp = /([\d\.-]+),([\d\.-]+)\((.*?)\)/;
                    const query = params.q;
                    const match = query.match(geoTextRegexp);
                    const actualQuery = decodeURIComponent(query).replace(/\+/g, ' ');
                    if (match) {
                        selectItem({
                            item: {
                                properties: {
                                    name: actualQuery
                                },
                                geometry: {
                                    coordinates: [parseFloat(match[2]), parseFloat(match[1])]
                                } as any
                            },
                            isFeatureInteresting: true
                        });
                    } else {
                        searchView.searchForQuery(actualQuery);
                    }
                }
            } else if (/(http(s?):\/\/)?((maps\.google\..*?\/)|((www\.)?google\..*?\/maps\/)|(goo.gl\/maps\/)).*/.test(link)) {
                const params = parseUrlQueryParameters(link);
                Object.keys(params).forEach((k) => {
                    const value = params[k];
                    if (k === 'saddr') {
                        // directions!
                        if (value) {
                            if (/[\d.-]+,[\d.-]+/.test(value)) {
                                const pos = value.split(',').map(parseFloat);
                                cartoMap.setFocusPos({ lat: pos[0], lon: pos[1] }, 0);
                                directionsPanel.addStartPoint({
                                    lat: pos[0],
                                    lon: pos[1]
                                });
                            }
                        }
                    } else if (k === 'daddr') {
                        // directions!
                        if (value) {
                            if (/[\d.-]+,[\d.-]+/.test(value)) {
                                const pos = value.split(',').map(parseFloat);
                                cartoMap.setFocusPos({ lat: pos[0], lon: pos[1] }, 0);
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
                searchView.searchForQuery(link);
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
    function onOrientationChanged(event: OrientationChangedEventData) {
        DEV_LOG && console.log('onOrientationChanged', event.newValue);
        isLandscape = event.newValue === 'landscape';
        if (__IOS__) {
            page?.nativeElement?.requestLayout();
        }
    }
    function onLayersReady() {
        updateSideButtons();

        if (autoStartWebServer) {
            startStopWebServer();
        }
    }
    let screenOnOffReceiver: android.content.BroadcastReceiver;
    
    let toggleSystemBarsWithWindowCompat;
    if (__ANDROID__) {
         toggleSystemBarsWithWindowCompat = function(show = true) {
        const activity = Application.android.startActivity;
    if (!activity) return;

    const window = activity.getWindow();
    const decorView = window.getDecorView();

    const WindowCompat = androidx.core.view.WindowCompat;
    const WindowInsetsControllerCompat = androidx.core.view.WindowInsetsControllerCompat;
    const WindowInsetsCompat = androidx.core.view.WindowInsetsCompat;

    // Make content extend into system windows
    WindowCompat.setDecorFitsSystemWindows(window, false);

    const controller = new WindowInsetsControllerCompat(window, decorView);
    if (show) {
        controller.show(WindowInsetsCompat.Type.systemBars());
    } else {
        controller.hide(WindowInsetsCompat.Type.systemBars());

    // Set behavior to allow swipe to show bars temporarily
    controller.setSystemBarsBehavior(WindowInsetsControllerCompat.BEHAVIOR_SHOW_TRANSIENT_BARS_BY_SWIPE);
    }
    
}
    }
    
    
    onMount(() => {
        Application.on(Application.orientationChangedEvent, onOrientationChanged);
        networkService.on(NetworkConnectionStateEvent, onNetworkChange);
        networkConnected = networkService.connected;
        if (__ANDROID__) {
            Application.android.on(Application.android.activityBackPressedEvent, onAndroidBackButton);
            if (!screenOnOffReceiver) {
                const ScreenOnReceiver = (<any>android.content.BroadcastReceiver).extend('akylas.alpi.maps.ScreenOnReceiver', {
            onReceive: function (context: android.content.Context, intent: android.content.Intent) {
                if (intent.getAction() === android.content.Intent.ACTION_SCREEN_OFF) {
                            console.log("Screen turned ON");
                            if ($immersiveOnlyLocked) {
                                toggleSystemBarsWithWindowCompat(false);
                            }
                        } else if (intent.getAction() === android.content.Intent.ACTION_USER_PRESENT) {
                            if ($immersiveOnlyLocked) {
                                toggleSystemBarsWithWindowCompat(true);
                            }
                        }
            }
        });
                screenOnOffReceiver = new ScreenOnReceiver();

                const intentFilter = new android.content.IntentFilter();
                intentFilter.addAction(android.content.Intent.ACTION_SCREEN_OFF);
                intentFilter.addAction(android.content.Intent.ACTION_USER_PRESENT);
                Application.android.startActivity.registerReceiver(screenOnOffReceiver, intentFilter);
            }
            
        }
        customLayersModule = new CustomLayersModule();
        customLayersModule.once('ready', onLayersReady);
        
        itemModule = new ItemsModule();
        
        setMapContext({
            // drawer: drawer.nativeView,
            getMap: () => cartoMap,
            getMainPage: () => page,
            getProjection: () => projection,
            getCurrentLanguage: () => currentLanguage,
            getSelectedItem: () => $selectedItem,
            getEditingItem: () => editingItem,
            vectorElementClicked: onVectorElementClicked,
            vectorTileElementClicked: onVectorTileElementClicked,
            vectorTileClicked: onVectorTileClicked,
            rasterTileClicked: onRasterTileClicked,
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
                // DEV_LOG && console.log('setBottomSheetStepIndex', bottomSheetStepIndex, JSON.stringify(steps));
                bottomSheetStepIndex = index;
            },
            showMapMenu,
            showMapOptions,
            mapModules: {
                items: itemModule,
                userLocation: new UserLocationModule(),
                customLayers: customLayersModule,
                directionsPanel,
                mapResultsPager,
                mapScrollingWidgets
            }
        });

        onServiceLoaded((handler: GeoHandler) => {
            mapContext.runOnModules('onServiceLoaded', handler);
        });
        onServiceUnloaded((handler: GeoHandler) => {
            mapContext.runOnModules('onServiceUnloaded', handler);
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
    $: {
        if (__ANDROID__) {
            if (screenOnOffReceiver){
                toggleSystemBarsWithWindowCompat(!$immersive || $immersiveOnlyLocked)
                
            }
        }
    }
    function onColorsChange() {
        if (cartoMap) {
            mapContext.innerDecoder.setJSONStyleParameters({
                main_color: $colors.colorPrimary,
                main_darker_color: new Color($colors.colorPrimary).darken(10).hex
            });
        }
    }
    // function onLoaded() {}
    onDestroy(() => {
        // console.log('onMapDestroyed');
        Application.off(Application.orientationChangedEvent, onOrientationChanged);
        mapContext.runOnModules('onMapDestroyed');

        // localVectorLayer = null;
        // if (localVectorDataSource) {
        //     localVectorDataSource = null;
        // }
        // if (cartoMap) {
        //     cartoMap = null;
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
                if (searchView && searchView.hasFocus()) {
                    searchView.unfocus();
                } else if (directionsPanel && directionsPanel.isVisible()) {
                    directionsPanel.cancel();
                } else if (bottomSheetStepIndex !== 0) {
                    bottomSheetStepIndex = 0;
                } else {
                    Application.android.foregroundActivity.moveTaskToBack(true);
                }
            }
        });
    function reloadMapStyle() {
        mapContext.runOnModules('reloadMapStyle');
    }

    function getOrCreateLocalVectorLayer(position) {
        if (!localVectorLayer) {
            const localVectorDataSource = new LocalVectorDataSource({ projection });

            selectedPosMarker = itemModule.createLocalPoint(position, {
                color: new Color(colorPrimary).setAlpha(178).hex,
                clickSize: 0,
                scaleWithDPI: true,
                size: 20
            });
            localVectorDataSource.add(selectedPosMarker);
            localVectorLayer = new VectorLayer({ dataSource: localVectorDataSource });
            localVectorLayer.setVectorElementEventListener<LatLonKeys>({
                onVectorElementClicked
            });
            addLayer(localVectorLayer, 'selection');
        }
        return localVectorLayer;
    }

    function resetBearing() {
        if (!cartoMap) {
            return;
        }
        cartoMap.setBearing(0, 200);
    }
    function getMapViewPort() {
        const width = cartoMap.getMeasuredWidth();
        const height = cartoMap.getMeasuredHeight();
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
        if (!cartoMap) {
            return;
        }
        ApplicationSettings.setNumber('mapZoom', cartoMap.zoom);
        ApplicationSettings.setNumber('mapBearing', cartoMap.bearing);
        ApplicationSettings.setString('mapFocusPos', JSON.stringify(cartoMap.focusPos));
    }, 500);

    let appUrlRegistered = false;
    
    async function onMainMapReady(e) {
        try {
            // if (!PRODUCTION) {
            //     await new Promise((resolve) => setTimeout(resolve, 1000));
            // }
            const map = e.object as CartoMap<LatLonKeys>;
            CartoMap.setRunOnMainThread(true);
            if (DEV_LOG) {
                setShowDebug(true);
                setShowInfo(true);
                setShowWarn(true);
                setShowError(true);
            } else {
                setShowDebug(false);
                setShowInfo(false);
                setShowWarn(false);
                setShowError(false);
            }
            projection = map.projection;
            mapContext.setMapDefaultOptions(map.getOptions());

            cartoMap = map;
            onColorsChange();
            const pos = JSON.parse(ApplicationSettings.getString('mapFocusPos', '{"lat":45.2012,"lon":5.7222}')) as MapPos<LatLonKeys>;
            const zoom = ApplicationSettings.getNumber('mapZoom', 10);
            const bearing = ApplicationSettings.getNumber('mapBearing', 0);
            cartoMap.setFocusPos(pos, 0);
            cartoMap.setZoom(zoom, 0);
            cartoMap.setBearing(bearing, 0);
            DEV_LOG && console.log('onMainMapReady', JSON.stringify(pos), zoom, bearing, addedLayers.length, theme);
            tryCatch(async () => {
                packageService.start();
                transitService.start();
                setMapStyle(ApplicationSettings.getString('mapStyle', PRODUCTION || TEST_ZIP_STYLES ? 'osm.zip~osm' : 'osm~osm'), true);
                // setMapStyle('mobile-sdk-styles~voyager', true);
            });
            if (addedLayers) {
                Object.values(addedLayers).forEach((d) => {
                    addLayer(d.layer, d.layerId, true);
                });
            }
            //in case it is created before (clicked as soon as the UI is shown)
            if (transitVectorTileLayer) {
                addLayer(transitVectorTileLayer, 'transit');
            }
            // setTimeout(() => {
            mapContext.runOnModules('onMapReady', cartoMap);

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
        } catch (error) {
            console.error(error, error.stack);
        }
    }
    let mapMoved = false;
    function onMainMapMove(e: { data: { userAction: boolean } }) {
        // DEV_LOG && console.log('onMainMapMove', mapMoved);
        if (!cartoMap) {
            return;
        }
        mapContext.runOnModules('onMapMove', e);
        mapMoved = true;
        currentMapRotation = Math.round(cartoMap.bearing * 100) / 100;
    }
    function onMainMapInteraction(e) {
        // this means user interaction
        // DEV_LOG && console.log('onMainMapInteraction', Object.keys(e));
        if (!cartoMap) {
            return;
        }
        if (!mapMoved) {
            unFocusSearch();
        }
        mapContext.runOnModules('onMapInteraction', e);
        mapMoved = true;
    }
    function onMainMapIdle(e) {
        // DEV_LOG && console.log('onMainMapIdle', mapMoved);
        if (!cartoMap) {
            return;
        }
        if (mapMoved) {
            mapMoved = false;
            saveSettings();
        }
        mapContext.runOnModules('onMapIdle', e);
    }
    function onMainMapStable(e) {
        // DEV_LOG && console.log('onMainMapStable', mapMoved);
        if (!cartoMap) {
            return;
        }
        mapContext.runOnModules('onMapStable', e);
    }

    function onMainMapClicked(e: { data: MapClickInfo<MapPos<LatLonKeys>> }) {
        const { clickType, position } = e.data;
        // TEST_LOG && console.log('onMainMapClicked', clickType, JSON.stringify(position), ignoreNextMapClick);
        // handleClickedFeatures(position);
        if (ignoreNextMapClick) {
            ignoreNextMapClick = false;
            return;
        }
        unFocusSearch();
        if (didIgnoreAlreadySelected) {
            didIgnoreAlreadySelected = false;
            return;
        }
        const handledByModules = mapContext.runOnModules('onMapClicked', e);
        // console.log('mapTile', latLngToTileXY(position.lat, position.lon, cartoMap.zoom), clickType === ClickType.SINGLE, handledByModules, !!selectedItem);
        if (!handledByModules && clickType === ClickType.SINGLE) {
            selectItem({ item: { geometry: { type: 'Point', coordinates: [position.lon, position.lat] }, properties: {} }, isFeatureInteresting: !$selectedItem });
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
        isFeatureInteresting: boolean;
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
            if (isFeatureInteresting && setSelected && $itemLock && $selectedItem) {
                return;
            }
            didIgnoreAlreadySelected = false;
            if (isFeatureInteresting) {
                const isCurrentItem = item === $selectedItem;
                // TEST_LOG && console.log('selectItem', setSelected, isCurrentItem, item.properties?.class, item.properties?.name, peek, setSelected, showButtons, Date.now());
                if (setSelected && isCurrentItem && !item) {
                    unselectItem(false);
                }
                const route = item?.route;
                const props = item.properties;
                if (peek) {
                    bottomSheetInner.loadView().then(() => {
                        bottomSheetStepIndex = Math.max(showButtons ? 2 : 1, bottomSheetStepIndex);
                    });
                }
                if (setSelected) {
                    setSelectedItem(item);
                }
                if (setSelected && route) {
                    (async () => {
                        TEST_LOG && console.log('selected_id', typeof route.osmid, route.osmid, typeof props.id, props.id, setSelected);
                        if (setMapSelected) {
                            selectedMapId = (route.osmid  || props.osmid || props.id || (props.name + props.class)) + '';
                            mapContext.mapDecoder.setJSONStyleParameters({ selected_id: selectedMapId });
                            const styleParameters = {};
                            styleParameters['selected_osmid'] = '0';
                            styleParameters['selected_id_str'] = '0';
                            styleParameters['selected_id'] = '0';
                            mapContext.innerDecoder.setJSONStyleParameters(styleParameters);
                        } else {
                            if (selectedMapId) {
                                mapContext.mapDecoder.setJSONStyleParameters({ selected_id: '' });
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
                            mapContext.innerDecoder.setJSONStyleParameters(styleParameters);
                        }

                        if (selectedPosMarker) {
                            selectedPosMarker.visible = false;
                        }
                    })();
                } else {
                    (async () => {
                        const geometry = item.geometry as GeoJSONPoint;
                        const position = { lat: geometry.coordinates[1], lon: geometry.coordinates[0] };
                        if (!selectedPosMarker) {
                            getOrCreateLocalVectorLayer(position);
                        } else {
                            selectedPosMarker.position = position;
                            selectedPosMarker.visible = true;
                        }
                        if (setMapSelected) {
                            // TODO: not enabled for now as really slow
                            DEV_LOG && console.log('mapDecoder selected_id', props.name + props.class);
                            // if (props.subclass) {
                            selectedMapId = props.name + props.class;
                            mapContext.mapDecoder.setJSONStyleParameters({ selected_id: selectedMapId });
                            // } else {
                            // mapContext.mapDecoder.setStyleParameter('selected_id', '');
                            // }
                        } else if (selectedMapId) {
                            mapContext.mapDecoder.setJSONStyleParameters({ selected_id: '' });
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
                            mapContext.innerDecoder.setJSONStyleParameters(styleParameters);
                        }
                    })();
                }
                if (setSelected && !route) {
                    const toUpdate = {} as Record<string, any>;
                    Promise.all([
                        (async () => {
                            if (!props.address?.['city']) {
                                const r = await packageService.getItemAddress(item, projection);
                                if (r && $selectedItem.geometry === item.geometry) {
                                    DEV_LOG && console.log('found addresses', JSON.stringify(r));
                                    toUpdate.address = r;
                                    // $selectedItem.properties.address = r;
                                    if (r.name && !$selectedItem.properties.name) {
                                        toUpdate.name = r.name;
                                        //     $selectedItem.properties.name = r.name;
                                    }
                                    return true;
                                }
                            }
                        })(),
                        (async () => {
                            if (props && 'ele' in props === false && packageService.hasElevation()) {
                                const geometry = item.geometry as GeoJSONPoint;
                                const position = { lat: geometry.coordinates[1], lon: geometry.coordinates[0] };
                                const r = await packageService.getElevation(position);
                                if (r && $selectedItem.geometry === item.geometry) {
                                    // DEV_LOG && console.log('found elevation', r);
                                    toUpdate.ele = r;
                                    // $selectedItem.properties = $selectedItem.properties || {};
                                    // $selectedItem.properties['ele'] = r;
                                    return true;
                                }
                            }
                        })()
                    ]).then((r) => {
                        if (r.some((d) => d === true)) {
                            setSelectedItem($selectedItem, toUpdate);
                        }
                    });
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
    let mapResultPagerLaoded = false;
    export function showMapResultsPager(items: IItem<GeoJSONPoint>[]) {
        mapResultPagerLaoded = true;
        mapResultItems = items || [];
    }

    export function zoomToItem({ duration = 200, forceZoomOut = false, item, minZoom, zoom }: { item: IItem; zoom?: number; minZoom?: number; duration?; forceZoomOut?: boolean }) {
        const viewPort = getMapViewPort();
        // DEV_LOG && console.log('zoomToItem', viewPort, item.properties?.zoomBounds, item.properties?.extent, !!item.route);
        // we ensure the viewPort is squared for the screen captured
        const screenBounds = {
            min: { x: viewPort.left, y: viewPort.top },
            max: { x: viewPort.left + viewPort.width, y: viewPort.top + viewPort.height }
        };
        if (item.properties?.zoomBounds) {
            const zoomLevel = getBoundsZoomLevel(item.properties.zoomBounds, {
                width: Screen.mainScreen.widthDIPs,
                height: Screen.mainScreen.widthDIPs
            });
            if (forceZoomOut || cartoMap.zoom < zoomLevel) {
                cartoMap.moveToFitBounds(item.properties.zoomBounds, screenBounds, false, true, false, duration);
            }
        } else if (item.properties?.extent) {
            let extent: [number, number, number, number] = item.properties.extent as [number, number, number, number];
            if (typeof extent === 'string') {
                if (extent[0] !== '[') {
                    extent = `[${extent as string}]` as any;
                }
                extent = JSON.parse(extent as any);
            }
            cartoMap.moveToFitBounds(new MapBounds({ lat: extent[1], lon: extent[0] }, { lat: extent[3], lon: extent[2] }), screenBounds, true, true, false, 200);
        } else if (item.route) {
            const geometry = packageService.getRouteItemGeometry(item);
            //we need to convert geometry bounds to wgs84
            //not perfect as vectorTile geometry might not represent the whole entier route at higher zoom levels
            const bounds = geometry?.getBounds();
            const projection = new EPSG3857();
            cartoMap.moveToFitBounds(new MapBounds(projection.toWgs84(bounds.getMin()), projection.toWgs84(bounds.getMax())), screenBounds, true, true, false, 200);
        } else if (item.geometry.type === 'Point') {
            if (zoom) {
                cartoMap.setZoom(zoom, duration);
            } else if (minZoom) {
                cartoMap.setZoom(Math.max(minZoom, cartoMap.zoom), duration);
            }
            const geometry = item.geometry;
            const position = { lat: geometry.coordinates[1], lon: geometry.coordinates[0] };
            cartoMap.setFocusPos(position, duration);
        }
        // DEV_LOG && console.log('zoomToItem done ');
    }
    export function unselectItem(updateBottomSheet = true, forceUnlock = false) {
        // TEST_LOG && console.log('unselectItem', updateBottomSheet, !!$selectedItem);
        
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
                selectedPosMarker.visible = false;
            }

            if (selectedMapId) {
                selectedMapId = null;
                mapContext.mapDecoder.setJSONStyleParameters({ selected_id: '' });
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
            mapContext.innerDecoder.setJSONStyleParameters(styleParameters);
            if (updateBottomSheet) {
                bottomSheetStepIndex = 0;
            }
        }
    }

//    $: {
//        try {
//            cartoMap && mapContext?.innerDecoder?.setStyleParameter('routes_type', $routesType + '');
//        } catch (error) {
 //           console.error(error, error.stack);
 //       }
//    }
//    $: {
//        try {
//            cartoMap && mapContext?.innerDecoder?.setStyleParameter('route_shields', $showRouteShields ? '1' : '0');
 //       } catch (error) {
//            console.error(error, error.stack);
 //       }
//    }
    $: cartoMap?.getOptions().setRenderProjectionMode($projectionModeSpherical ? RenderProjectionMode.RENDER_PROJECTION_MODE_SPHERICAL : RenderProjectionMode.RENDER_PROJECTION_MODE_PLANAR);
    $: vectorTileDecoder && setStyleParameter('buildings', !!$show3DBuildings ? '2' : '1');
    $: vectorTileDecoder && setStyleParameter('contours', $showContourLines ? '1' : '0');
    $: vectorTileDecoder && setStyleParameter('sub_boundaries', $showSubBoundaries ? '1' : '0');
    $: vectorTileDecoder && setStyleParameter('emphasis_rails', $emphasisRails ? '1' : '0');
    $: vectorTileDecoder && setStyleParameter('highlight_drinking_water', $emphasisDrinkingWater ? '1' : '0');
    $: vectorTileDecoder && $contourLinesOpacity >= 0 && setStyleParameter('contoursOpacity', $contourLinesOpacity.toFixed(1));
    $: vectorTileDecoder && $mapFontScale > 0 && setStyleParameter('_fontscale', $mapFontScale.toFixed(2));
    $: vectorTileDecoder && $cityMinZoom > 0 && setStyleParameter('city_min_zoom', $cityMinZoom);
    $: vectorTileDecoder && $forestPatternZoom > 0 && setStyleParameter('forest_pattern_zoom', $forestPatternZoom);
    $: vectorTileDecoder && $rockPatternZoom > 0 && setStyleParameter('rock_pattern_zoom', $rockPatternZoom);
    $: vectorTileDecoder && $screePatternZoom > 0 && setStyleParameter('scree_pattern_zoom', $screePatternZoom);
    $: vectorTileDecoder && $scrubPatternZoom > 0 && setStyleParameter('scrub_pattern_zoom', $scrubPatternZoom);
    $: vectorTileDecoder && setStyleParameter('polygons_border', $showPolygonsBorder ? '1' : '0');
    $: vectorTileDecoder && setStyleParameter('road_shields', $showRoadShields ? '1' : '0');
   // $: {
     //   const visible = $showRoutes;
    //    getLayers('routes').forEach((l) => {
 //           l.layer.visible = visible;
//        });
  //      cartoMap?.requestRedraw();
 //   }
    $: vectorTileDecoder && setStyleParameter('show_routes', $showRoutes ? '1' : '0');
    $: vectorTileDecoder && setStyleParameter('route_shields', $showRouteShields ? '1' : '0');
    $: vectorTileDecoder && setStyleParameter('routes_type', $routesType + '');
    $: vectorTileDecoder && $routeDashMinZoom > 0 && setStyleParameter('routes_dash_min_zoom', $routeDashMinZoom);
    $: customLayersModule?.toggleHillshadeSlope($showSlopePercentages);
    $: itemModule?.setVisibility($showItemsLayer);
    $: cartoMap?.getOptions().setRotationGestures($rotateEnabled);
    $: cartoMap?.getOptions().setTiltRange(toNativeMapRange([$pitchEnabled ? 30 : 90, 90]));
    // $: currentLayer && (currentLayer.preloading = $preloading);
    $: bottomSheetStepIndex === 0 && unselectItem(true, true);
    $: {
        if (steps?.length) {
            mapContext.focusOffset = { x: 0, y: Utils.layout.toDevicePixels(steps[bottomSheetStepIndex]) / 2 };
            cartoMap?.getOptions().setFocusPointOffset(toNativeScreenPos(mapContext.focusOffset));
        }
    }

    $: {
        ApplicationSettings.setBoolean(KEEP_AWAKE_KEY, keepScreenAwake);
        showHideKeepAwakeNotification(keepScreenAwake);
    }
    // $: vectorTileDecoder && mapContext?.innerDecoder?.setStyleParameter('routes', $showRoutes ? '1' : '0');
    // $: shouldShowNavigationBarOverlay = $navigationBarHeight !== 0 && !!selectedItem;

    async function handleSelectedRoutes() {
        DEV_LOG && console.log('handleSelectedRoutes');
        unFocusSearch();
        try {
            if (selectedRoutes && selectedRoutes.length > 0) {
                if (selectedRoutes.length === 1) {
                    selectItem({ item: selectedRoutes[0], isFeatureInteresting: true, setMapSelected: true });
                } else {
                    const RouteSelect = (await import('~/components/routes/RouteSelect.svelte')).default;
                    const results = await showBottomSheet({
                        parent: page,
                        view: RouteSelect,
                        skipCollapsedState: true,
                        props: {
                            // title: l('pick_route'),
                            options: selectedRoutes.map((s) => ({ name: s.properties.name, route: s }))
                        }
                    });
                    const result = Array.isArray(results) ? results[0] : results;
                    if (result) {
                        selectItem({ item: result.route, isFeatureInteresting: true, setMapSelected: true });
                    }
                }
            }
        } catch (err) {
            console.error('handleSelectedRoutes', err, err.stack);
        }
        selectedRoutes = null;
        handleSelectedRouteTimer = null;
    }

    async function handleSelectedTransitLines() {
        DEV_LOG && console.log('handleSelectedTransitLines');
        unFocusSearch();
        try {
            DEV_LOG && console.log('handleSelectedTransitLines', selectedTransitLines?.length);
            if (selectedTransitLines?.length > 0) {
                if (selectedTransitLines.length === 1) {
                    selectItem({ item: selectedTransitLines[0], isFeatureInteresting: true, showButtons: true });
                    // handleRouteSelection(selectedRoutes[0].featureData, selectedRoutes[0].layer);
                } else {
                    closeBottomSheet();
                    const RouteSelect = (await import('~/components/routes/RouteSelect.svelte')).default;
                    const results = await showBottomSheet({
                        parent: page,
                        view: RouteSelect,
                        skipCollapsedState: true,
                        props: {
                            options: selectedTransitLines
                                .map((s) => ({ name: s.properties.name, route: s }))
                                .sort((a, b) => {
                                    const aS = a.route.properties.shortName;
                                    const bS = b.route.properties.shortName;
                                    if (aS.length === bS.length) {
                                        return aS > bS ? 1 : -1;
                                    }
                                    return aS.length - bS.length;
                                })
                        }
                    });
                    const result = Array.isArray(results) ? results[0] : results;
                    if (result) {
                        selectItem({ item: result.route, isFeatureInteresting: true, showButtons: true });
                    }
                }
            }
        } catch (err) {
            console.error('handleSelectedTransitLines', err, err['stack']);
        }
        selectedTransitLines = null;
        handleSelectedTransitLinesTimer = null;
    }
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

    function onRasterTileClicked(data: RasterTileClickInfo<LatLonKeys>) {
        const { clickType, layer, nearestColor, position } = data;
    }
    function onVectorTileClicked(data: VectorTileEventData<LatLonKeys>) {
        if (handleSelectedTransitLinesTimer) {
            return;
        }
        const { clickType, featureData, featureGeometry, featureId, featureLayerName, featurePosition, layer, position } = data;

        const handledByModules = mapContext.runOnModules('onVectorTileClicked', data) as boolean;
        // TEST_LOG && console.log('onVectorTileClicked', clickType, featureLayerName, featureId, featureData.class, featureData.subclass, featureData, JSON.stringify(position), JSON.stringify(featurePosition), handledByModules);
        if (!handledByModules && clickType === ClickType.SINGLE) {
            // if (showClickedFeatures) {
            //     clickedFeatures.push({
            //         featurePosition,
            //         layer: featureLayerName,
            //         data: featureData
            //     });
            // }

            // if (
            //     featureLayerName === 'transportation' ||
            //     featureLayerName === 'transportation_name' ||
            //     featureLayerName === 'waterway' ||
            //     // featureLayerName === 'place' ||
            //     featureLayerN    ame === 'contour' ||
            //     featureLayerName === 'hillshade' ||
            //     (featureLayerName === 'park' && !!featureGeometry['getHoles']) ||
            //     ((featureLayerName === 'building' || featureLayerName === 'landcover' || featureLayerName === 'landuse') && !featureData.name)
            // ) {
            //     return false;
            // }
            // featureData.id = featureId;
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
                // console.log(
                //     'onVectorTileClicked ignoring already selected item',
                //     featureData.name,
                //     featurePosition,
                //     $selectedItem
                // );
                didIgnoreAlreadySelected = true;
                return false;
            }
            featureData.layer = featureLayerName;
            if (featureLayerName === 'route') {
                DEV_LOG && console.log('handling route ');
                if (handleSelectedRouteTimer) {
                    clearTimeout(handleSelectedRouteTimer);
                }
                selectedRoutes = selectedRoutes || [];
                handleSelectedRouteTimer = setTimeout(handleSelectedRoutes, 10);
                if (selectedRoutes.findIndex((s) => s.route.osmid === featureData.osmid) === -1) {
                    selectedRoutes.push({
                        properties: {
                            ...featureData
                        },
                        route: {
                            osmid: featureData.osmid || featureData.ref || featureData.name
                        },
                        layer
                    });
                    ignoreNextMapClick = true;
                }
                return false;
            }

            const isFeatureInteresting = featureLayerName === 'poi' || featureLayerName === 'mountain_peak' || featureLayerName === 'housenumber' || (!!featureData.name && !selectedRoutes);
            // DEV_LOG && console.log('isFeatureInteresting', featureLayerName, featureData.name, isFeatureInteresting, featureGeometry.constructor.name, featurePosition, position);
            if (isFeatureInteresting) {
                ignoreNextMapClick = false;
                selectedRoutes = null;
                if (handleSelectedRouteTimer) {
                    clearTimeout(handleSelectedRouteTimer);
                    handleSelectedRouteTimer = null;
                }
                const result: IItem = {
                    properties: featureData,
                    geometry: {
                        type: 'Point',
                        // coordinates: [featurePosition.lon, featurePosition.lat]
                        coordinates: isFeatureInteresting && !/Line|Polygon/.test(featureGeometry.constructor.name) ? [featurePosition.lon, featurePosition.lat] : [position.lon, position.lat]
                    }
                };
                selectItem({ item: result, isFeatureInteresting, showButtons: featureData.class === 'bus' || featureData.subclass === 'tram_stop', setMapSelected: featureLayerName === 'park' });
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
    function onVectorElementClicked(data: VectorElementEventData<LatLonKeys>) {
        const { clickType, element, elementPos, metaData, position } = data;
        TEST_LOG && console.log('onVectorElementClicked', clickType, position, metaData);
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
                    coordinates: [elementPos.lon, elementPos.lat]
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
    function onVectorTileElementClicked(data: VectorTileEventData<LatLonKeys>) {
        const { clickType, featureData, featurePosition, position } = data;
        TEST_LOG && console.log('onVectorTileElementClicked', clickType, position, featurePosition, featureData.id);
        const feature = itemModule.getFeature(featureData.id);
        if (!feature) {
            return false;
        }
        // Object.keys(feature.properties).forEach((k) => {
        //     if (feature.properties[k][0] === '{' || feature.properties[k][0] === '[') {
        //         feature.properties[k] = JSON.parse(feature.properties[k]);
        //     }
        // });
        const handledByModules = mapContext.runOnModules('onVectorTileElementClicked', data) as boolean;
        // if (DEV_LOG) {
        //     console.log('handledByModules', handledByModules);
        // }
        if (!!featureData.instruction) {
            return true;
        }
        TEST_LOG && console.log('onVectorTileElementClicked', clickType, JSON.stringify(position), JSON.stringify(featurePosition), featureData.id, handledByModules, $selectedItem?.id);
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
        // TEST_LOG && console.log('unFocusSearch', searchView?.hasFocus());
        if (searchView?.hasFocus()) {
            searchView.unfocus();
        }
        // });
    }
    function clearSearch() {
        // executeOnMainThread(function () {
        // TEST_LOG && console.log('unFocusSearch', searchView?.hasFocus());
        searchView?.clearSearch();
        // });
    }

    function setStyleParameter(key: string, value: string | number) {
        // DEV_LOG && console.log('setStyleParameter', key, value);
        mapContext.mapDecoder?.setStyleParameter(key, value + '');
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
        let mapStyle = layerStyle;
        let mapStyleLayer = 'streets';
        if (layerStyle.indexOf('~') !== -1) {
            const array = layerStyle.split('~');
            mapStyle = array[0];
            mapStyleLayer = array[1];
        }
        DEV_LOG && console.log('setMapStyle', layerStyle, currentLayerStyle, mapStyle, mapStyleLayer, force);
        if (layerStyle !== currentLayerStyle || !!force) {
            currentLayerStyle = layerStyle;
            ApplicationSettings.setString('mapStyle', layerStyle);
            try {
                vectorTileDecoder = mapContext.createMapDecoder(mapStyle, mapStyleLayer);
            } catch(error) {
                vectorTileDecoder = null;
                showError(error);
            }

            handleNewLanguage(currentLanguage);
        }
    }

    async function selectStyle() {
        function filterEntity(e) {
            return !/(inner|admin|cleaned|base)/.test(e.name);
        }
        const styles = [];
        const stylePath = path.join(knownFolders.currentApp().path, 'assets', 'styles');
        const entities = (await Folder.fromPath(stylePath).getEntities()).filter(filterEntity);
        for (let index = 0; index < entities.length; index++) {
            const e = entities[index];
            if (Folder.exists(e.path)) {
                const subs = (await Folder.fromPath(e.path).getEntities()).filter(filterEntity);
                styles.push(
                    ...subs
                        .filter((s) => s.name.endsWith('.json') || s.name.endsWith('.xml'))
                        .map((s) => ({ name: s.name.split('.')[0], subtitle: e.name.toUpperCase(), data: e.name + '~' + s.name.split('.')[0] }))
                );
            } else {
                try {
                    const assetsNames = nativeVectorToArray(new ZippedAssetPackage({ zipPath: e.path }).getAssetNames());
                    // DEV_LOG && console.log('assetsNames', assetsNames);
                    styles.push(...assetsNames.filter((s) => s.endsWith('.xml')).map((s) => ({ name: s.split('.')[0], subtitle: e.name.toUpperCase(), data: e.name + '~' + s.split('.')[0] })));
                } catch (error) {
                    console.error(error, error.stack);
                }
            }
        }

        DEV_LOG && console.log('selectStyle', screenHeightDips, ALERT_OPTION_MAX_HEIGHT);
        let selectedIndex = -1;
        const options = styles.map((d, index) => {
            const value = currentLayerStyle === d.data;
            if (value) {
                selectedIndex = index;
            }
            return {
                ...d,
                boxType: 'circle',
                type: 'checkbox',
                value
            };
        });
        const result = await showAlertOptionSelect(
            {
                height: Math.min(options.length * 56, ALERT_OPTION_MAX_HEIGHT),
                rowHeight: 56,
                selectedIndex,
                options
            },
            {
                title: lc('select_style')
            }
        );
        DEV_LOG && console.log('on style selected', result);
        if (result?.data) {
            setMapStyle(result.data);
        }
    }

    function removeLayer(layer: Layer<any, any>, layerId: LayerType) {
        // const realLayerId = offset ? layerId + offset : layerId;
        const index = addedLayers.findIndex((d) => d.layer === layer);
        if (index !== -1) {
            addedLayers.splice(index, 1);
        }
        cartoMap.removeLayer(layer);
    }
    function moveLayer(layer: Layer<any, any>, newIndex: number) {
        // const realLayerId = offset ? layerId + offset : layerId;
        const layers = cartoMap.getLayers();
        newIndex = Math.max(0, Math.min(newIndex, layers.count() - 1));
        const index = addedLayers.findIndex((d) => d.layer === layer);
        if (index !== -1 && index !== newIndex) {
            const val = addedLayers[index];
            addedLayers.splice(index, 1);
            addedLayers.splice(newIndex, 0, val);
        }
        layers.remove(layer);
        layers.insert(newIndex, layer);
    }
    function getLayerIndex(layer: Layer<any, any>) {
        return addedLayers.findIndex((d) => d.layer === layer);
    }
    function replaceLayer(oldLayer: Layer<any, any>, layer: Layer<any, any>) {
        const index = addedLayers.findIndex((d) => d.layer === oldLayer);
        // DEV_LOG && console.log('replaceLayer', index, oldLayer, layer);
        if (index !== -1) {
            addedLayers[index].layer = layer;
            cartoMap.getLayers().set(index, layer);
        }
    }
    function getLayerTypeFirstIndex(layerId: LayerType) {
        const layerIndex = LAYERS_ORDER.indexOf(layerId);
        return addedLayers.findIndex((d) => LAYERS_ORDER.indexOf(d.layerId) === layerIndex);
    }

    function getLayers(layerId: LayerType) {
        if (!layerId) {
            return addedLayers.slice();
        }
        const layerIndex = LAYERS_ORDER.indexOf(layerId);
        const startIndex = addedLayers.findIndex((d) => LAYERS_ORDER.indexOf(d.layerId) === layerIndex);
        const endIndex = addedLayers.findIndex((d) => LAYERS_ORDER.indexOf(d.layerId) > layerIndex);
        if (startIndex !== -1) {
            return addedLayers.slice(startIndex, endIndex !== -1 ? endIndex : undefined);
        }
        return [];
    }
    function addLayer(layer: Layer<any, any>, layerId: LayerType, force = false) {
        // console.log('addLayer', layer.constructor.name, layerId);
        if (cartoMap) {
            if (force) {
                // used when restoring everything after activity re create
                cartoMap.addLayer(layer);
                return;
            }
            if (addedLayers.findIndex((d) => d.layer === layer) !== -1) {
                return;
            }
            const layerIndex = LAYERS_ORDER.indexOf(layerId);
            const realIndex = addedLayers.findIndex((d) => LAYERS_ORDER.indexOf(d.layerId) > layerIndex);
            if (realIndex >= 0 && realIndex < addedLayers.length) {
                cartoMap.addLayer(layer, realIndex);
                addedLayers.splice(realIndex, 0, { layer, layerId });
            } else {
                cartoMap.addLayer(layer);
                addedLayers.push({ layer, layerId });
            }
            // cartoMap.requestRedraw();
        }
    }
    function insertLayer(layer: Layer<any, any>, layerId: LayerType, index: number) {
        if (cartoMap) {
            if (addedLayers.findIndex((d) => d.layer === layer) !== -1) {
                return;
            }
            const layerIndex = LAYERS_ORDER.indexOf(layerId);
            const realIndex =
                Math.max(
                    addedLayers.findIndex((d) => LAYERS_ORDER.indexOf(d.layerId) >= layerIndex),
                    0
                ) + index;
            const nbLayers = cartoMap.getLayers().count();
            if (realIndex >= 0 && realIndex < nbLayers) {
                cartoMap.getLayers().insert(realIndex, layer);
                addedLayers.splice(realIndex, 0, { layer, layerId });
            } else {
                cartoMap.addLayer(layer);
                addedLayers.push({ layer, layerId });
            }
            // } else {
            // cartoMap.addLayer(layer);
            // addedLayers.push({ layer, layerId });
            // }
            // cartoMap.requestRedraw();
        }
    }
    // let bottomSheetTranslation = 0;
    // get bottomSheetTranslation() {
    //     const result = mBottomSheetTranslation + $navigationBarHeight;
    //     return result;
    // }
    let scrollingWidgetsOpacity = 1;
    let mapTranslation = 0;
    // function topSheetTranslationFunction(maxTranslation, translation, progress) {
    //     return {
    //         topSheet: {
    //             translateY: translation
    //         },
    //         search: {
    //             translateY: maxTranslation - translation
    //         }
    //     };
    // }

    function getWidgetsOpacity(translation) {
        if (translation >= -300) {
            return 1;
        } else {
            return Math.max(0, 1 - (-translation - 300) / 30);
        }
    }

    $: scrollingWidgetsOpacity = windowInsetBottom > 200 ? 0 : getWidgetsOpacity(mapTranslation);

    function bottomSheetTranslationFunction(translation, maxTranslation, progress) {
        scrollingWidgetsOpacity = getWidgetsOpacity(translation);
        // mapTranslation = translation - (__IOS__ && translation !== 0 ? $navigationBarHeight : 0);
        mapTranslation = translation;
        const result = {
            bottomSheet: {
                // translateY: translation + (__IOS__ ? (translation === 0 ? $navigationBarHeight : -$navigationBarHeight) : 0)
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
            mapScrollingWidgets: {
                target: mapScrollingWidgets.getNativeView(),
                translateY: translation,
                opacity: scrollingWidgetsOpacity
            }
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

    const saveItem = tryCatchFunction(async (item: IItem = $selectedItem, peek = true) => {
        DEV_LOG && console.log('saveItem', item);
        if (!item) {
            return;
        }
        const itemsModule = mapContext.mapModule('items');
        item = await itemsModule.saveItem(item);
        if (item.route) {
            mapContext.mapModules.directionsPanel.cancel(false);
            
        }
    //    if (item.route) {
           await itemsModule.takeItemPicture(item);
  //      } else {
            mapContext.selectItem({ item, isFeatureInteresting: true, peek, preventZoom: false });
  //      }
    });

    async function showHideKeepAwakeNotification(value: boolean) {
        if (__ANDROID__) {
            if (value) {
                NotificationHelper.showNotification(
                    {
                        title: lt('screen_awake_notification'),
                        channel: NOTIFICATION_CHANEL_ID_KEEP_AWAKE_CHANNEL
                    },
                    KEEP_AWAKE_NOTIFICATION_ID
                );
            } else {
                NotificationHelper.hideNotification(KEEP_AWAKE_NOTIFICATION_ID);
            }
        }
    }

    async function switchKeepAwake() {
        keepScreenAwake = !keepScreenAwake;
    }
    const switchShowOnLockscreen = tryCatchFunction(async () => {
        if (showOnLockscreen) {
            disableShowWhenLockedAndTurnScreenOn();
            showOnLockscreen = false;
        } else {
            enableShowWhenLockedAndTurnScreenOn();
            showOnLockscreen = true;
        }
    });

    function switchLocationInfo() {
        locationInfoPanel.switchLocationInfo();
    }

    async function shareScreenshot() {
        const image = await cartoMap.captureRendering(true);
        return share({
            image
        });
    }

    function onTap(command: string) {
        switch (
            command
            // case 'sendFeedback':
            //     compose({
            //         subject: `[${EInfo.getAppNameSync()}(${appVersion})] Feedback`,
            //         to: ['contact@akylas.fr'],
            //         attachments: [
            //             {
            //                 fileName: 'report.json',
            //                 path: `base64://${base64Encode(
            //                     JSON.stringify(
            //                         {
            //                             device: {
            //                                 model: Device.model,
            //                                 DeviceType: Device.deviceType,
            //                                 language: Device.language,
            //                                 manufacturer: Device.manufacturer,
            //                                 os: Device.os,
            //                                 osVersion: Device.osVersion,
            //                                 region: Device.region,
            //                                 sdkVersion: Device.sdkVersion,
            //                                 uuid: Device.uuid
            //                             },
            //                             screen: {
            //                                 widthDIPs: screenWidthDips,
            //                                 heightDIPs: screenHeightDips,
            //                                 widthPixels: Screen.mainScreen.widthPixels,
            //                                 heightPixels: Screen.mainScreen.heightPixels,
            //                                 scale: Screen.mainScreen.scale
            //                             }
            //                         },
            //                         null,
            //                         4
            //                     )
            //                 )}`,
            //                 mimeType: 'application/json'
            //             }
            //         ]
            //     }).catch((err) => showError(err));
            //     break;
        ) {
        }
    }

    const autoStartWebServer = ApplicationSettings.getBoolean(SETTINGS_TILE_SERVER_AUTO_START, DEFAULT_TILE_SERVER_AUTO_START);
    let webserver;

    function startStopWebServer() {
        if (webserver) {
            webserver.stop();
            webserver = null;
        } else {
            try {
                const hillshadeDatasource = packageService.hillshadeLayer?.dataSource;
                const vectorDataSource = packageService.localVectorTileLayer?.dataSource;
                const vDataSource = vectorDataSource.getNative();
                DEV_LOG && console.log('webserver', vDataSource, hillshadeDatasource?.getNative());
                webserver = new (akylas.alpi as any).maps.WebServer(
                    ApplicationSettings.getNumber(SETTINGS_TILE_SERVER_PORT, DEFAULT_TILE_SERVER_PORT),
                    hillshadeDatasource?.getNative(),
                    vDataSource,
                    vDataSource,
                    null
                );
                webserver.start();
            } catch (err) {
                console.error(err);
            }
        }
    }

    // onMount(() => {
    // console.log('onMount', !!vectorDataSource, !!dataSource, !!rasterDataSource);
    // try {
    //     const vDataSource = (vectorDataSource || getDefaultDataSource()).getNative();
    //     webserver = new (akylas.alpi as any).maps.WebServer(8080, dataSource.getNative(), vDataSource, vDataSource, rasterDataSource?.getNative());
    //     webserver.start();
    // } catch (err) {
    //     console.error(err);
    // }
    // });
    onDestroy(() => {
        webserver?.stop();
    });
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
                    // {
                    //     title: lc('keep_awake'),
                    //     color: keepAwakeEnabled ? colorError : '#00ff00',
                    //     id: 'keep_awake',
                    //     icon: keepAwakeEnabled ? 'mdi-sleep' : 'mdi-sleep-off'
                    // },
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
                        title: lc('dark_mode'),
                        id: 'dark_mode',
                        color: $forceDarkMode ? colorPrimary : undefined,
                        icon: 'mdi-theme-light-dark'
                    },
                    {
                        title: lc('offline_mode'),
                        id: 'offline_mode',
                        color: networkService.forcedOffline ? colorError : undefined,
                        icon: 'mdi-wifi-strength-off-outline'
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
            if (__ANDROID__ && packageService.localVectorTileLayer) {
                options.push({
                    title: webserver ? lc('stop_tile_server') : lc('start_tile_server'),
                    id: 'web_server',
                    icon: 'mdi-server'
                });
            }

            await showPopoverMenu({
                options,
                vertPos: VerticalPosition.BELOW,
                horizPos: HorizontalPosition.ALIGN_RIGHT,
                anchor: event.object,
                props: {
                    // autoSizeListItem: true,
                    maxHeight: Screen.mainScreen.heightDIPs - 100
                },
                onLongPress: tryCatchFunction(async (result) => {
                    if (result) {
                        switch (result.id) {
                            case 'web_server':
                                copyTextToClipboard(`http://127.0.0.1:${ApplicationSettings.getNumber(SETTINGS_TILE_SERVER_PORT, DEFAULT_TILE_SERVER_PORT)}?source=data&x={x}&y={y}&z={z}`);
                                break;
                        }
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
                                switchKeepAwake();
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
                                    mimeTypes: ['application/gpx+xml', 'application/json', 'application/geo+json'],
                                    multipleSelection: false,
                                    pickerMode: 0
                                });
                                const filePath = result.files[0];
                                if (filePath && File.exists(filePath)) {
                                    showLoading();
                                    if (filePath.endsWith('gpx')) {
                                        await getMapContext().mapModule('items').importGPXFile(filePath);
                                    } else {
                                        await getMapContext().mapModule('items').importGeoJSONFile(filePath);
                                    }
                                }
                                break;
                            }
                            case 'web_server': {
                                startStopWebServer();
                                break;
                            }
                            default:
                                await handleMapAction(result.id);
                                break;
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
                // flush is not yet working on Android
                // event will be sent on restart
                setTimeout(() => Sentry.flush(0), 1000);
                showSnack({ message: l('bug_report_sent') });
            }
        }
    }

    const showTransitLinesPage = tryCatchFunction(async () => {
        const component = (await import('~/components/transit/TransitLines.svelte')).default;
        navigate({ page: component });
    });

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

    let sideButtons = [];

    function updateSideButtons() {
        sideButtons.find((b) => b.id === 'routes').visible = !!customLayersModule?.hasRoute;
        sideButtons.find((b) => b.id === 'slopes').visible = !!customLayersModule?.hasTerrain;
        // sideButtons.find((b) => b.id === 'contours').visible = !!customLayersModule?.hasLocalData;
        sideButtons = sideButtons;
    }
    $: {
        const newButtons: any[] = [
            {
                text: 'mdi-rotate-3d-variant',
                id: 'map_rotation',
                tooltip: lc('enable_map_rotation'),
                isSelected: $rotateEnabled,
                onTap: () => rotateEnabled.set(!$rotateEnabled)
            },
            // {
            //     text: 'mdi-bullseye',
            //     id: 'contours',
            //     tooltip: lc('show_contour_lines'),
            //     isSelected: $showContourLines,
            //     visible: !!customLayersModule?.hasLocalData,
            //     onTap: () => showContourLines.set(!$showContourLines)
            // },
            {
                text: 'mdi-signal',
                id: 'slopes',
                tooltip: lc('show_percentage_slopes'),
                isSelected: $showSlopePercentages,
                visible: !!customLayersModule?.hasTerrain,
                onTap: () => showSlopePercentages.set(!$showSlopePercentages),
                onLongPress: tryCatchFunction(async (event, button) => {
                    if ($showSlopePercentages) {
                        const component = (await import('~/components/map/SlopesInfoPopover.svelte')).default;
                        await showPopover({
                            view: component,
                            anchor: event.object,
                            vertPos: VerticalPosition.ALIGN_TOP,
                            horizPos: HorizontalPosition.RIGHT
                        });
                    } else {
                        showToolTip(button.tooltip);
                    }
                })
            },
            {
                text: 'mdi-routes',
                id: 'routes',
                tooltip: lc('show_routes'),
                isSelected: $showRoutes,
                visible: !!customLayersModule?.hasRoute,
                onTap: () => showRoutes.set(!$showRoutes),
                onLongPress: tryCatchFunction(async (event) => {
                    const component = (await import('~/components/routes/RoutesTypePopover.svelte')).default;
                    await showPopover({
                        view: component,
                        anchor: event.object,
                        vertPos: VerticalPosition.ALIGN_TOP,
                        horizPos: HorizontalPosition.RIGHT
                    });
                })
            },
            // {
            //     text: 'mdi-speedometer',
            //     tooltip: lc('speedometer'),
            //     onTap: switchLocationInfo
            // },
            {
                text: keepScreenAwake ? 'mdi-sleep' : 'mdi-sleep-off',
                isSelected: keepScreenAwake,
                tooltip: lc('keep_screen_awake'),
                selectedColor: colorError,
                onLongPress: () => keepScreenAwakeFullBrightness = !keepScreenAwakeFullBrightness,
                onTap: switchKeepAwake
            },
            {
                text: 'mdi-cellphone-lock',
                isSelected: showOnLockscreen,
                tooltip: lc('show_screen_lock'),
                visible: __ANDROID__,
                onTap: switchShowOnLockscreen
            }
        ];
        if ((WITH_BUS_SUPPORT && customLayersModule?.devMode) || customLayersModule?.hasLocalData) {
            newButtons.push({
                text: 'mdi-dots-vertical',
                onTap: tryCatchFunction(
                    async (event) => {
                        const options = []
                            .concat(
                                WITH_BUS_SUPPORT && customLayersModule?.devMode
                                    ? [
                                          {
                                              icon: 'mdi-bus-marker',
                                              id: 'transit_lines',
                                              title: lc('show_transit_lines'),
                                              color: showTransitLines ? colorPrimary : undefined
                                          }
                                      ]
                                    : []
                            )
                            .concat(
                                customLayersModule.hasLocalData
                                    ? [
                                          {
                                              icon: 'mdi-vector-polygon',
                                              id: 'show_admin_regions',
                                              title: lc('show_admin_regions'),
                                              color: showAdmins ? colorPrimary : undefined
                                          }
                                      ]
                                    : []
                            );

                        await showPopoverMenu({
                            options,
                            vertPos: VerticalPosition.ALIGN_BOTTOM,
                            horizPos: HorizontalPosition.LEFT,
                            anchor: event.object,
                            props: {
                                // autoSizeListItem: true,
                                maxHeight: Screen.mainScreen.heightDIPs - 100
                            },
                            onLongPress: tryCatchFunction(async (result) => {
                                if (result) {
                                    switch (result.id) {
                                        case 'transit_lines':
                                            closePopover();
                                            await showTransitLinesPage();
                                            break;
                                    }
                                }
                            }),
                            onClose: async (result) => {
                                if (result) {
                                    switch (result.id) {
                                        case 'transit_lines':
                                            showTransitLines = !showTransitLines;
                                            break;
                                        case 'show_admin_regions':
                                            showAdmins = !showAdmins;
                                            break;
                                    }
                                }
                            }
                        });
                    },
                    undefined,
                    hideLoading
                )
            });
        }

        sideButtons = newButtons;
    }
    function onDirectionsCancel() {
        endEditingItem();
    }
    function startEditingItem(item: Item) {
        if (!!item.route) {
            DEV_LOG && console.log('startEditingItem', item.properties.id);
            mapContext.innerDecoder.setStyleParameter('editing_id', item.properties.id + '');
            getMapContext().mapModule('items').showItem(item);
            editingItem = item;
            unselectItem(true, true);

            // getMapContext().mapModule('items').hideItem(item);
        }
    }
    function endEditingItem() {
        if (editingItem) {
            editingItem = null;
            mapContext.innerDecoder.setStyleParameter('editing_id', '0');

            // getMapContext().mapModule('items').hideItem(item);
        }
    }
    function onStepIndexChanged(e) {
        if (e.value !== bottomSheetStepIndex) {
            bottomSheetStepIndex = e.value;
        }
    }
</script>

<page
    bind:this={page}
    actionBarHidden={true}
    backgroundColor="#E3E1D3"
    ios:iosIgnoreSafeArea={false}
    ios:statusBarStyle="light"
    ios:statusBarColor="transparent"
    {keepScreenAwake}
    screenBrightness={keepScreenAwake && keepScreenAwakeFullBrightness ? 1 : -1}
    on:navigatingTo={onNavigatingTo}
    on:navigatingFrom={onNavigatingFrom}>
    <gridlayout>
        <cartomap
            accessibilityLabel="cartoMap"
            zoom={16}
            on:mapReady={onMainMapReady}
            on:mapMoved={onMainMapMove}
            on:mapInteraction={onMainMapInteraction}
            on:mapStable={onMainMapStable}
            on:mapIdle={onMainMapIdle}
            on:mapClicked={onMainMapClicked}
            on:layoutChanged={reportFullyDrawn} />
        <bottomsheet
            marginBottom={windowInsetBottom}
            marginLeft={windowInsetLeft}
            marginRight={windowInsetRight}
            panGestureOptions={{ failOffsetXEnd: 20, minDist: 40 }}
            stepIndex={bottomSheetStepIndex}
            {steps}
            translationFunction={bottomSheetTranslationFunction}
            on:stepIndexChange={onStepIndexChanged}>
            <gridlayout bind:this={widgetsHolder} height="100%" isPassThroughParentEnabled={true} width="100%">
                <ButtonBar
                    id="mapButtonsNew"
                    buttonSize={40}
                    buttons={sideButtons}
                    color={isEInk ? '#aaa' : '#666'}
                    gray={true}
                    horizontalAlignment="left"
                    marginLeft={5}
                    marginTop={66 + windowInsetTop + Math.max(topTranslationY - 90, 0)}
                    verticalAlignment="top" />

                <LocationInfoPanel
                    bind:this={locationInfoPanel}
                    horizontalAlignment="left"
                    isUserInteractionEnabled={scrollingWidgetsOpacity > 0.3}
                    marginLeft={40}
                    marginTop={90}
                    verticalAlignment="top" />
                <Search
                    bind:this={searchView}
                    style="z-index:1000;"
                    defaultElevation={0}
                    isUserInteractionEnabled={scrollingWidgetsOpacity > 0.3}
                    item={$selectedItem}
                    margin={10}
                    verticalAlignment="top"
                    android:marginTop={windowInsetTop + 10} />
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
                    visibility={currentMapRotation !== 0 ? 'visible' : 'collapse'}
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
                <MapScrollingWidgets bind:this={mapScrollingWidgets} isUserInteractionEnabled={scrollingWidgetsOpacity > 0.3} opacity={scrollingWidgetsOpacity} bind:navigationInstructions />
                <DirectionsPanel
                    bind:this={directionsPanel}
                    {editingItem}
                    paddingTop={windowInsetTop}
                    verticalAlignment="top"
                    width="100%"
                    bind:translationY={topTranslationY}
                    on:cancel={onDirectionsCancel} />
                {#if mapResultPagerLaoded}
                    <MapResultPager bind:this={mapResultsPager} style="z-index:9000;" items={mapResultItems} translateY={mapTranslation} verticalAlignment="bottom" width="100%" />
                {/if}
            </gridlayout>
            <BottomSheetInner
                prop:bottomSheet
                bind:this={bottomSheetInner}
                borderRadius={isLandscape ? 10 : 0}
                horizontalAlignment={isLandscape ? 'left' : 'stretch'}
                item={$selectedItem}
                updating={itemLoading}
                width={isLandscape ? Math.max(screenWidthDips / 2, 400) : '100%'}
                bind:navigationInstructions
                bind:steps />
        </bottomsheet>

        {#if __IOS__}
            <absolutelayout backgroundColor={colorBackground} height={windowInsetBottom} verticalAlignment="bottom" />
        {/if}
    </gridlayout>
</page>
