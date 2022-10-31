<script lang="ts">
    import type { GenericGeoLocation } from '@nativescript-community/gps';
    import * as perms from '@nativescript-community/perms';
    import { isSensorAvailable } from '@nativescript-community/sensors';
    import type { MapPos } from '@nativescript-community/ui-carto/core';
    import { ClickType, MapBounds, toNativeMapRange, toNativeScreenPos } from '@nativescript-community/ui-carto/core';
    import { GeoJSONVectorTileDataSource } from '@nativescript-community/ui-carto/datasources';
    import { LocalVectorDataSource } from '@nativescript-community/ui-carto/datasources/vector';
    import { Layer } from '@nativescript-community/ui-carto/layers';
    import type { RasterTileClickInfo } from '@nativescript-community/ui-carto/layers/raster';
    import type { VectorElementEventData, VectorTileEventData } from '@nativescript-community/ui-carto/layers/vector';
    import { BaseVectorTileLayer, CartoOnlineVectorTileLayer, VectorLayer, VectorTileLayer, VectorTileRenderOrder } from '@nativescript-community/ui-carto/layers/vector';
    import { Projection } from '@nativescript-community/ui-carto/projections';
    import { CartoMap, PanningMode, RenderProjectionMode } from '@nativescript-community/ui-carto/ui';
    import { nativeVectorToArray, setShowDebug, setShowError, setShowInfo, setShowWarn, ZippedAssetPackage } from '@nativescript-community/ui-carto/utils';
    import { Point } from '@nativescript-community/ui-carto/vectorelements/point';
    import { Text, TextStyleBuilder } from '@nativescript-community/ui-carto/vectorelements/text';
    import { MBVectorTileDecoder } from '@nativescript-community/ui-carto/vectortiles';
    import { isBottomSheetOpened, showBottomSheet } from '~/utils/svelte/bottomsheet';
    import { action, prompt } from '@nativescript-community/ui-material-dialogs';
    import { getUniversalLink, registerUniversalLinkCallback } from '@nativescript-community/universal-links';
    // import { Brightness } from '@nativescript/brightness';
    import { AndroidApplication, Application, Page, Utils } from '@nativescript/core';
    import * as appSettings from '@nativescript/core/application-settings';
    import type { AndroidActivityBackPressedEventData } from '@nativescript/core/application/application-interfaces';
    import { Folder, knownFolders, path } from '@nativescript/core/file-system';
    import { Screen } from '@nativescript/core/platform';
    import { ad } from '@nativescript/core/utils/utils';
    import type { Point as GeoJSONPoint } from 'geojson';
    import { debounce } from 'push-it-to-the-limit/target/es6';
    import { onDestroy, onMount } from 'svelte';
    import { navigate } from 'svelte-native';
    import { NativeViewElementNode } from 'svelte-native/dom';
    import { GeoHandler } from '~/handlers/GeoHandler';
    import { l, lc, lt, onLanguageChanged } from '~/helpers/locale';
    import { sTheme, toggleTheme } from '~/helpers/theme';
    import watcher from '~/helpers/watcher';
    import CustomLayersModule from '~/mapModules/CustomLayersModule';
    import ItemsModule from '~/mapModules/ItemsModule';
    import type { LayerType } from '~/mapModules/MapModule';
    import { getMapContext, handleMapAction, setMapContext } from '~/mapModules/MapModule';
    import UserLocationModule from '~/mapModules/UserLocationModule';
    import type { IItem, RouteInstruction } from '~/models/Item';
    import { NotificationHelper, NOTIFICATION_CHANEL_ID_KEEP_AWAKE_CHANNEL } from '~/services/android/NotifcationHelper';
    import { onServiceLoaded, onServiceUnloaded } from '~/services/BgService.common';
    import type { NetworkConnectionStateEventData } from '~/services/NetworkService';
    import { NetworkConnectionStateEvent, networkService } from '~/services/NetworkService';
    import { packageService } from '~/services/PackageService';
    import { transitService } from '~/services/TransitService';
    import { rotateEnabled, pitchEnabled, showGlobe, showContourLines, showRoutes, showSlopePercentages, show3DBuildings, contourLinesOpacity, preloading } from '~/stores/mapStore';
    import { showError } from '~/utils/error';
    import { getBoundsZoomLevel } from '~/utils/geo';
    import { parseUrlQueryParameters } from '~/utils/http';
    import { share } from '~/utils/share';
    import { disableShowWhenLockedAndTurnScreenOn, enableShowWhenLockedAndTurnScreenOn } from '~/utils/utils.android';
    import { navigationBarHeight, primaryColor } from '../variables';
    import BottomSheetInner from './BottomSheetInner.svelte';
    import DirectionsPanel from './DirectionsPanel.svelte';
    import LocationInfoPanel from './LocationInfoPanel.svelte';
    import MapScrollingWidgets from './MapScrollingWidgets.svelte';
    import Search from './Search.svelte';
    import IconButton from './IconButton.svelte';
    import { isSentryEnabled, Sentry } from '~/utils/sentry';
    import { showSnack } from '@nativescript-community/ui-material-snackbar';

    const KEEP_AWAKE_NOTIFICATION_ID = 23466578;

    const LAYERS_ORDER: LayerType[] = ['map', 'customLayers', 'routes', 'transit', 'hillshade', 'selection', 'items', 'directions', 'search', 'userLocation'];
    const KEEP_AWAKE_KEY = 'keepAwake';
    let defaultLiveSync = global.__onLiveSync;

    let page: NativeViewElementNode<Page>;
    let cartoMap: CartoMap<LatLonKeys>;
    let directionsPanel: DirectionsPanel;
    let bottomSheetInner: BottomSheetInner;
    let mapScrollingWidgets: MapScrollingWidgets;
    let locationInfoPanel: LocationInfoPanel;
    let searchView: Search;
    const mapContext = getMapContext();

    let selectedOSMId: string;
    let selectedId: string;
    let selectedPosMarker: Point<LatLonKeys>;
    let selectedItem = watcher<IItem>(null, onSelectedItemChanged);
    let packageServiceEnabled = __CARTO_PACKAGESERVICE__;
    let licenseRegistered: boolean = false;
    let currentLayer: VectorTileLayer;
    let currentLayerStyle: string;
    let localVectorDataSource: LocalVectorDataSource;
    let localVectorLayer: VectorLayer;
    let vectorTileDecoder: MBVectorTileDecoder;
    let bottomSheetStepIndex = 0;
    let itemLoading = false;
    let projection: Projection = null;
    let currentLanguage = appSettings.getString('language', 'en');
    let addedLayers: { layer: Layer<any, any>; layerId: LayerType }[] = [];
    let keepScreenAwake = appSettings.getBoolean(KEEP_AWAKE_KEY, false);
    let showOnLockscreen = false;
    let currentMapRotation = 0;
    let shouldShowNavigationBarOverlay = false;
    let steps;
    let topTranslationY;
    let networkConnected = false;
    let navigationInstructions: {
        remainingDistance: number;
        remainingTime: number;
        instruction: RouteInstruction;
        distanceToNextInstruction: number;
    };

    let ignoreNextMapClick = false;
    let handleSelectedRouteTimer: NodeJS.Timeout;
    let selectedRoutes: { featurePosition; featureData; layer: BaseVectorTileLayer<any, any> }[];
    let didIgnoreAlreadySelected = false;

    let showTransitLines = false;
    let selectedClickMarker: Text<LatLonKeys>;

    let transitVectorTileDataSource: GeoJSONVectorTileDataSource;
    let transitVectorTileLayer: VectorTileLayer;

    const bottomSheetPanGestureOptions = { failOffsetXEnd: 20, minDist: 40 };

    $: {
        if (steps) {
            // ensure bottomSheetStepIndex is not out of range when
            // steps changes
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
    let fetchingTransitLines = false;
    $: {
        if (showTransitLines) {
            // const pos = cartoMap.focusPos;
            if (!transitVectorTileDataSource && !fetchingTransitLines) {
                transitService
                    .getTransitLines()
                    .then((result) => {
                        transitVectorTileDataSource = new GeoJSONVectorTileDataSource({
                            // simplifyTolerance: 0,
                            minZoom: 0,
                            maxZoom: 24
                        });
                        transitVectorTileDataSource.createLayer('lines');
                        transitVectorTileDataSource.setLayerGeoJSONString(1, result.replace(/"geometry":{}/g, '"geometry":null'));
                        if (!transitVectorTileLayer) {
                            transitVectorTileLayer = new VectorTileLayer({
                                // preloading: true,
                                labelRenderOrder: VectorTileRenderOrder.LAST,
                                dataSource: transitVectorTileDataSource,
                                decoder: mapContext.innerDecoder
                            });
                            transitVectorTileLayer.setVectorTileEventListener<LatLonKeys>(
                                {
                                    onVectorTileClicked: ({ featureData }) => {
                                        const item: IItem = {
                                            properties: {
                                                ...featureData,
                                                route: {
                                                    osmid: featureData.id
                                                } as any
                                            },
                                            layer: transitVectorTileLayer
                                        };
                                        selectItem({ item, isFeatureInteresting: true, preventZoom: true });
                                        return true;
                                        // mapContext.vectorTileClicked(e);
                                    }
                                },
                                mapContext.getProjection()
                            );
                            // transitVectorTileLayer.setVectorTileEventListener(this,
                            // mapContext.getProjection());
                            // always add it at 1 to respect local order
                            addLayer(transitVectorTileLayer, 'transit');
                        } else {
                            transitVectorTileLayer.visible = true;
                        }
                    })
                    .catch((error) => {
                        showTransitLines = false;
                        showError(error);
                    })
                    .finally(() => {
                        fetchingTransitLines = false;
                    });
            } else if (transitVectorTileLayer) {
                transitVectorTileLayer.visible = true;
            }
        } else if (transitVectorTileLayer) {
            transitVectorTileLayer.visible = false;
        }
    }

    function onAppUrl(link: string) {
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
        try {
            TEST_LOG && console.log('Got the following appURL', link);
            if (link.startsWith('geo')) {
                const latlong = link.split(':')[1].split(',').map(parseFloat) as [number, number];
                const loaded = !!cartoMap;
                if (latlong[0] !== 0 || latlong[1] !== 0) {
                    if (loaded) {
                        cartoMap.setFocusPos({ lat: latlong[0], lon: latlong[1] }, 0);
                    } else {
                        // happens before map ready
                        appSettings.setString('mapFocusPos', `{"lat":${latlong[0]},"lon":${latlong[1]}}`);
                    }
                }
                const params = parseUrlQueryParameters(link);
                if (params.hasOwnProperty('z')) {
                    const zoom = parseFloat(params.z);
                    if (loaded) {
                        cartoMap.setZoom(zoom, 0);
                    } else {
                        appSettings.setNumber('mapZoom', zoom);
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
            }
        } catch (err) {
            console.error(err);
        }
    }

    async function onNetworkChange(event: NetworkConnectionStateEventData) {
        networkConnected = event.data.connected;
    }
    onMount(() => {
        networkService.on(NetworkConnectionStateEvent, onNetworkChange);
        networkConnected = networkService.connected;
        if (__ANDROID__) {
            Application.android.on(AndroidApplication.activityBackPressedEvent, onAndroidBackButton);
        }
        setMapContext({
            // drawer: drawer.nativeView,
            getMap: () => cartoMap,
            getMainPage: () => page,
            getProjection: () => projection,
            getCurrentLanguage: () => currentLanguage,
            getSelectedItem: () => $selectedItem,
            vectorElementClicked: onVectorElementClicked,
            vectorTileElementClicked: onVectorTileElementClicked,
            vectorTileClicked: onVectorTileClicked,
            rasterTileClicked: onRasterTileClicked,
            getVectorTileDecoder,
            getCurrentLayer,
            selectItem,
            unselectItem,
            unFocusSearch,
            addLayer,
            insertLayer,
            getLayerIndex,
            replaceLayer,
            getLayerTypeFirstIndex,
            getLayers,
            removeLayer,
            moveLayer,
            zoomToItem,
            setBottomSheetStepIndex: (index: number) => {
                bottomSheetStepIndex = index;
            },
            toggleMenu: async (side = 'left') => {
                // if (side === 'bottom') {
                //     await layersMenu.loadRightMenuView();
                // }
                // drawer.nativeView.toggle(side as any);
            },

            showOptions: showOptions,
            mapModules: {
                items: new ItemsModule(),
                userLocation: new UserLocationModule(),
                customLayers: new CustomLayersModule(),
                directionsPanel: directionsPanel,
                // search: searchView,
                // rightMenu: rightMenu,
                mapScrollingWidgets
                // bottomSheet: bottomSheet
            }
        });

        onServiceLoaded((handler: GeoHandler) => {
            mapContext.runOnModules('onServiceLoaded', handler);
        });
        onServiceUnloaded((handler: GeoHandler) => {
            mapContext.runOnModules('onServiceUnloaded', handler);
        });

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
    function onDeviceScreen(isScreenOn: boolean) {
        // console.log('onDeviceScreen', isScreenOn);
    }
    // function onLoaded() {}
    onDestroy(() => {
        // console.log('onMapDestroyed');
        mapContext.runOnModules('onMapDestroyed');

        localVectorLayer = null;
        if (localVectorDataSource) {
            localVectorDataSource.clear();
            localVectorDataSource = null;
        }
        if (cartoMap) {
            // const layers = cartoMap.getLayers();
            // if (layers) {
            //     layers.clear();
            // }
            cartoMap = null;
        }
        if (DEV_LOG) {
            global.__onLiveSync = defaultLiveSync;
        }
        selectedPosMarker = null;
    });

    let inFront = false;
    function onNavigatingTo() {
        inFront = true;
    }
    function onNavigatingFrom() {
        inFront = false;
    }
    function onAndroidBackButton(data: AndroidActivityBackPressedEventData) {
        if (!inFront || isBottomSheetOpened()) {
            return;
        }
        data.cancel = true;
        if (searchView && searchView.hasFocus()) {
            searchView.unfocus();
        } else if (directionsPanel && directionsPanel.isVisible()) {
            directionsPanel.cancel();
        } else {
            Application.android.foregroundActivity.moveTaskToBack(true);
        }
    }
    function reloadMapStyle() {
        mapContext.runOnModules('reloadMapStyle');
    }

    function getOrCreateLocalVectorLayer() {
        if (!localVectorLayer) {
            localVectorDataSource = new LocalVectorDataSource({ projection });

            localVectorLayer = new VectorLayer({ dataSource: localVectorDataSource });
            localVectorLayer.setVectorElementEventListener<LatLonKeys>({
                onVectorElementClicked: onVectorElementClicked
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
    const saveSettings = debounce(function () {
        if (!cartoMap) {
            return;
        }
        appSettings.setNumber('mapZoom', cartoMap.zoom);
        appSettings.setNumber('mapBearing', cartoMap.bearing);
        appSettings.setString('mapFocusPos', JSON.stringify(cartoMap.focusPos));
    }, 500);

    async function onMainMapReady(e) {
        try {
            cartoMap = e.object as CartoMap<LatLonKeys>;
            CartoMap.setRunOnMainThread(true);
            if (DEV_LOG) {
                setShowDebug(true);
                setShowInfo(true);
                setShowWarn(true);
                setShowError(true);
            }
            projection = cartoMap.projection;
            const options = cartoMap.getOptions();
            options.setWatermarkScale(0);
            options.setRestrictedPanning(true);
            options.setPanningMode(PanningMode.PANNING_MODE_STICKY_FINAL);
            options.setEnvelopeThreadPoolSize(2);
            options.setTileThreadPoolSize(2);

            options.setZoomGestures(true);
            options.setDoubleClickMaxDuration(0.3);
            options.setLongClickDuration(0.5);
            options.setKineticRotation(false);
            options.setRotatable($rotateEnabled);
            toggleMapPitch($pitchEnabled);
            // options.setClickTypeDetection(false);
            // options.setRotatable(true);
            const pos = JSON.parse(appSettings.getString('mapFocusPos', '{"lat":45.2012,"lon":5.7222}')) as MapPos<LatLonKeys>;
            const zoom = appSettings.getNumber('mapZoom', 10);
            const bearing = appSettings.getNumber('mapBearing', 0);
            cartoMap.setFocusPos(pos, 0);
            cartoMap.setZoom(zoom, 0);
            cartoMap.setBearing(bearing, 0);
            try {
                await perms.request('storage');
                if (__CARTO_PACKAGESERVICE__) {
                    packageService.start();
                }
                transitService.start();
                setMapStyle(PRODUCTION ? 'osm.zip~osm' : 'osm~osm', true);
                // setMapStyle('osm.zip~osm', true);
            } catch (err) {
                showError(err);
            }
            mapContext.runOnModules('onMapReady', cartoMap);

            registerUniversalLinkCallback(onAppUrl);
            const current = getUniversalLink();
            if (current) {
                onAppUrl(current);
            }
        } catch (error) {
            console.error(error);
        }
    }
    let mapMoved = false;
    function onMainMapMove(e) {
        if (!cartoMap) {
            return;
        }
        mapMoved = true;
        // console.log('onMapMove');
        // const bearing = cartoMap.bearing;
        // console.log('onMapMove', bearing);
        // currentMapRotation = Math.round(bearing * 100) / 100;
        mapContext.runOnModules('onMapMove', e);
        // executeOnMainThread(function () {
        currentMapRotation = Math.round(cartoMap.bearing * 100) / 100;
        // });
        unFocusSearch();
    }
    function onMainMapIdle(e) {
        if (!cartoMap) {
            return;
        }
        mapContext.runOnModules('onMapIdle', e);
    }
    function onMainMapStable(e) {
        if (!cartoMap) {
            return;
        }
        if (mapMoved) {
            mapMoved = false;
            saveSettings();
        }
        mapContext.runOnModules('onMapStable', e);
    }

    function onMainMapClicked(e) {
        const { clickType, position } = e.data;
        TEST_LOG && console.log('onMainMapClicked', clickType, position);
        // handleClickedFeatures(position);
        if (ignoreNextMapClick) {
            ignoreNextMapClick = false;
            return;
        }
        if (didIgnoreAlreadySelected) {
            didIgnoreAlreadySelected = false;
            return;
        }
        const handledByModules = mapContext.runOnModules('onMapClicked', e);
        // console.log('mapTile', latLngToTileXY(position.lat, position.lon, cartoMap.zoom), clickType === ClickType.SINGLE, handledByModules, !!selectedItem);
        if (!handledByModules && clickType === ClickType.SINGLE) {
            selectItem({ item: { geometry: { type: 'Point', coordinates: [position.lon, position.lat] }, properties: {} }, isFeatureInteresting: !$selectedItem, preventZoom: true });
        }
        unFocusSearch();
    }
    function onSelectedItemChanged(oldValue: IItem, value: IItem) {
        mapContext.runOnModules('onSelectedItem', value, oldValue);
    }
    async function selectItem({
        item,
        isFeatureInteresting = false,
        peek = true,
        setSelected = true,
        showButtons = false,
        preventZoom = true,
        minZoom,
        zoom,
        zoomDuration
    }: {
        item: IItem;
        showButtons?: boolean;
        isFeatureInteresting: boolean;
        peek?: boolean;
        setSelected?: boolean;
        preventZoom?: boolean;
        minZoom?: number;
        zoom?: number;
        zoomDuration?: number;
    }) {
        didIgnoreAlreadySelected = false;
        if (isFeatureInteresting) {
            let isCurrentItem = item === $selectedItem;
            TEST_LOG && console.log('selectItem', setSelected, isCurrentItem, item.properties?.class, item.properties?.name, peek, setSelected, showButtons);
            if (setSelected && isCurrentItem && !item) {
                unselectItem(false);
            }
            const route = item?.properties?.route;
            if (setSelected && route) {
                TEST_LOG && console.log('selected_id', typeof item.properties.route.osmid, item.properties.route.osmid, typeof item.properties.id, item.properties.id, setSelected);

                if (item.properties.id !== undefined) {
                    selectedId = item.properties.id;
                    if (typeof item.properties.id === 'string') {
                        mapContext.innerDecoder.setStyleParameter('selected_id_str', selectedId + '');
                        mapContext.innerDecoder.setStyleParameter('selected_id', '0');
                    } else {
                        mapContext.innerDecoder.setStyleParameter('selected_id', selectedId + '');
                        mapContext.innerDecoder.setStyleParameter('selected_id_str', '0');
                    }
                    mapContext.innerDecoder.setStyleParameter('selected_osmid', '0');
                } else if (item.properties.route.osmid !== undefined) {
                    selectedOSMId = item.properties.route.osmid;
                    mapContext.innerDecoder.setStyleParameter('selected_osmid', selectedOSMId + '');
                    mapContext.innerDecoder.setStyleParameter('selected_id', '0');
                    mapContext.innerDecoder.setStyleParameter('selected_id_str', '0');
                }

                // console.log('selectedOSMId', selectedOSMId);
                // if (!selectedRouteLine) {
                //     getOrCreateLocalVectorLayer();
                //     selectedRouteLine = mapContext.mapModule('items').createLocalLine(item, {
                //         // color: '#55ff0000',
                //         color: (darkColor as any).setAlpha(150),
                //         joinType: LineJointType.ROUND,
                //         endType: LineEndType.ROUND,
                //         width: 3,
                //         clickWidth: 10
                //     });
                //     localVectorDataSource.add(selectedRouteLine);
                // } else {
                //     selectedRouteLine.positions = item.route.positions;
                //     selectedRouteLine.visible = true;
                // }
                // }
                // if (route.instructions) {
                //     if (!selectedRouteInstructionsGroup) {
                //         selectedRouteInstructionsGroup = new Group();
                //     }
                //     selectedRouteInstructionsGroup.elements = iroute.instructions.map(
                //         (i, index) =>
                //             new Point({
                //                 projection: mapContext.getProjection(),
                //                 position: omit(item.route.positions.getPos(i.index), 'altitude'),
                //                 styleBuilder: {
                //                     size: 12,
                //                     placementPriority: 10,
                //                     hideIfOverlapped: false,
                //                     scaleWithDPI: true,
                //                     color: 'red'
                //                 },
                //                 metaData: { instruction: JSON.stringify(i) }
                //             })
                //     );
                //     getOrCreateLocalVectorLayer();
                //     // selectedRouteInstructionsGroup.elements.forEach(e=>localVectorDataSource.add(e))
                //     localVectorDataSource.add(selectedRouteInstructionsGroup);
                // }

                if (selectedPosMarker) {
                    selectedPosMarker.visible = false;
                }
            } else {
                const geometry = item.geometry as GeoJSONPoint;
                const position = { lat: geometry.coordinates[1], lon: geometry.coordinates[0] };
                if (!selectedPosMarker) {
                    getOrCreateLocalVectorLayer();
                    const itemModule = mapContext.mapModule('items');
                    selectedPosMarker = itemModule.createLocalPoint(position, {
                        color: primaryColor.setAlpha(178).hex,
                        clickSize: 0,
                        scaleWithDPI: true,
                        size: 30
                    });
                    localVectorDataSource.add(selectedPosMarker);
                } else {
                    selectedPosMarker.position = position;
                    selectedPosMarker.visible = true;
                }
                if (setSelected) {
                    if (item.properties.id !== undefined) {
                        selectedId = item.properties.id;
                        if (typeof item.properties.id === 'string') {
                            mapContext.innerDecoder.setStyleParameter('selected_id_str', selectedId + '');
                            mapContext.innerDecoder.setStyleParameter('selected_id', '0');
                        } else {
                            mapContext.innerDecoder.setStyleParameter('selected_id', selectedId + '');
                            mapContext.innerDecoder.setStyleParameter('selected_id_str', '0');
                        }
                        mapContext.innerDecoder.setStyleParameter('selected_osmid', '0');
                    } else {
                        if (selectedOSMId !== undefined) {
                            selectedOSMId = undefined;
                            mapContext.innerDecoder.setStyleParameter('selected_osmid', '0');
                        }
                        if (selectedId !== undefined) {
                            selectedId = undefined;
                            mapContext.innerDecoder.setStyleParameter('selected_id', '0');
                            mapContext.innerDecoder.setStyleParameter('selected_id_str', '');
                        }
                    }
                }
            }
            if (setSelected) {
                $selectedItem = item;
            }
            if (setSelected && !route) {
                // if (!item.properties.address || !item.properties.address['street']) {
                //     const service = packageService.localOSMOfflineReverseGeocodingService;
                //     if (service) {
                //         itemLoading = true;
                //         const radius = 200;

                //         const geometry = item.geometry as GeoJSONPoint;
                //         const position = { lat: geometry.coordinates[1], lon: geometry.coordinates[0] };
                //         // use a promise not to "wait" for it
                //         packageService
                //             .searchInGeocodingService(service, {
                //                 projection,
                //                 location: position,
                //                 searchRadius: radius
                //             })
                //             .then((res) => {
                //                 if (res) {
                //                     let bestFind;
                //                     for (let index = 0; index < res.size(); index++) {
                //                         const r = packageService.convertGeoCodingResult(res.get(index), true);
                //                         if (r && r.properties.rank > 0.7 && computeDistanceBetween(position, r.properties.position) <= radius) {
                //                             if (!bestFind || Object.keys(r.properties.address).length > Object.keys(bestFind.address).length) {
                //                                 bestFind = r;
                //                             } else if (bestFind && item.properties.address && item.properties.address['street']) {
                //                                 break;
                //                             }
                //                         } else {
                //                             break;
                //                         }
                //                     }
                //                     if (bestFind && $selectedItem.geometry === item.geometry) {
                //                         if (item.properties.layer === 'housenumber') {
                //                             $selectedItem.properties.address = { ...bestFind.address, name: null, houseNumber: item.properties.housenumber } as any;
                //                             $selectedItem = $selectedItem;
                //                         } else {
                //                             $selectedItem.properties.address = { ...bestFind.address, name: null } as any;
                //                             $selectedItem = $selectedItem;
                //                         }
                //                     }
                //                 }
                //             })
                //             .catch((err) => console.error('searchInGeocodingService', err, err['stack']));
                //     }
                // }

                if (item.properties && 'ele' in item.properties === false && packageService.hasElevation()) {
                    const geometry = item.geometry as GeoJSONPoint;
                    const position = { lat: geometry.coordinates[1], lon: geometry.coordinates[0] };
                    packageService.getElevation(position).then((result) => {
                        if ($selectedItem.geometry === item.geometry) {
                            $selectedItem.properties = $selectedItem.properties || {};
                            $selectedItem.properties['ele'] = result;
                            $selectedItem = $selectedItem;
                        }
                    });
                }
            }

            if (peek) {
                await bottomSheetInner.loadView();
                bottomSheetStepIndex = Math.max(showButtons ? 2 : 1, bottomSheetStepIndex);
            }
            if (preventZoom) {
                return;
            }
            zoomToItem({ item, zoom, minZoom, duration: zoomDuration });
        } else {
            unselectItem();
        }
    }
    export function zoomToItem({ item, zoom, minZoom, duration = 200, forceZoomOut = false }: { item: IItem; zoom?: number; minZoom?: number; duration?; forceZoomOut?: boolean }) {
        const screenBounds = {
            min: { x: 0, y: Utils.layout.toDevicePixels(90 + topTranslationY) },
            max: { x: page.nativeView.getMeasuredWidth(), y: page.nativeView.getMeasuredHeight() - Utils.layout.toDevicePixels($navigationBarHeight - mapTranslation) }
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
            let extent: [number, number, number, number] = item.properties.extent as any;
            if (typeof extent === 'string') {
                if (extent[0] !== '[') {
                    extent = `[${extent}]` as any;
                }
                extent = JSON.parse(extent as any);
            }
            cartoMap.moveToFitBounds(new MapBounds({ lat: extent[1], lon: extent[0] }, { lat: extent[3], lon: extent[2] }), screenBounds, true, true, false, 200);
        } else {
            if (zoom) {
                cartoMap.setZoom(zoom, duration);
            } else if (minZoom) {
                cartoMap.setZoom(Math.max(minZoom, cartoMap.zoom), duration);
            }
            const geometry = item.geometry as GeoJSONPoint;
            const position = { lat: geometry.coordinates[1], lon: geometry.coordinates[0] };
            cartoMap.setFocusPos(position, duration);
        }
    }
    export function unselectItem(updateBottomSheet = true) {
        if (!!$selectedItem) {
            // const item = $selectedItem;
            $selectedItem = null;
            if (selectedPosMarker) {
                selectedPosMarker.visible = false;
            }
            // if (selectedRouteInstructionsGroup) {
            //     localVectorDataSource.remove(selectedRouteInstructionsGroup);
            //     selectedRouteInstructionsGroup = null;
            // }
            if (selectedOSMId !== undefined) {
                selectedOSMId = undefined;
                mapContext.innerDecoder.setStyleParameter('selected_osmid', '0');
                // setStyleParameter('selected_id', '');
            }
            if (selectedId !== undefined) {
                selectedId = undefined;
                mapContext.innerDecoder.setStyleParameter('selected_id', '0');
                mapContext.innerDecoder.setStyleParameter('selected_id_str', '');
            }
            // if (item.route) {
            //     const vectorElement = item.vectorElement as Line;
            //     if (vectorElement) {
            //         vectorElement.color = new Color(vectorElement.color as string).lighten(10);
            //         vectorElement.width -= 2;
            //     }
            // }
            if (updateBottomSheet) {
                bottomSheetStepIndex = 0;
            }
        }
    }

    $: setRenderProjectionMode($showGlobe);
    $: vectorTileDecoder && setStyleParameter('buildings', !!$show3DBuildings ? '2' : '1');
    $: vectorTileDecoder && setStyleParameter('contours', $showContourLines ? '1' : '0');
    // $: vectorTileDecoder && mapContext?.innerDecoder?.setStyleParameter('routes', $showRoutes ? '1' : '0');
    $: {
        const visible = $showRoutes;
        getLayers('routes').forEach((l) => {
            l.layer.visible = visible;
        });
        cartoMap && cartoMap.requestRedraw();
    }
    $: vectorTileDecoder && setStyleParameter('contoursOpacity', $contourLinesOpacity.toFixed(1));
    $: vectorTileDecoder && toggleHillshadeSlope($showSlopePercentages);
    $: toggleMapRotate($rotateEnabled);
    $: toggleMapPitch($pitchEnabled);
    $: currentLayer && (currentLayer.preloading = $preloading);
    // $: shouldShowNavigationBarOverlay = $navigationBarHeight !== 0 && !!selectedItem;
    $: bottomSheetStepIndex === 0 && unselectItem();
    $: cartoMap?.getOptions().setFocusPointOffset(toNativeScreenPos({ x: 0, y: Utils.layout.toDevicePixels(steps[bottomSheetStepIndex]) / 2 }));

    $: {
        appSettings.setBoolean(KEEP_AWAKE_KEY, keepScreenAwake);
        if (keepScreenAwake) {
            showKeepAwakeNotification();
        } else {
            hideKeepAwakeNotification();
        }
    }
    function toggleHillshadeSlope(value: boolean) {
        mapContext?.mapModule('customLayers').toggleHillshadeSlope(value);
    }
    function toggleMapRotate(value: boolean) {
        if (cartoMap) {
            cartoMap?.getOptions().setRotatable(value);
        }
    }
    function toggleMapPitch(value: boolean) {
        if (cartoMap) {
            cartoMap?.getOptions().setTiltRange(toNativeMapRange([value ? 30 : 90, 90]));
        }
    }

    async function handleRouteSelection(featureData, layer: VectorTileLayer) {
        // console.log('handleRouteSelection', featureData);
        const item: IItem = {
            properties: {
                ...featureData,
                route: {
                    osmid: featureData.osmid || featureData.ref || featureData.name
                }
            },
            layer
        };
        selectItem({ item, isFeatureInteresting: true, preventZoom: true });
    }
    async function handleSelectedRoutes() {
        unFocusSearch();
        try {
            if (selectedRoutes && selectedRoutes.length > 0) {
                if (selectedRoutes.length === 1) {
                    handleRouteSelection(selectedRoutes[0].featureData, selectedRoutes[0].layer);
                } else {
                    const RouteSelect = (await import('~/components/RouteSelect.svelte')).default;
                    const results = await showBottomSheet({
                        parent: page,
                        view: RouteSelect,
                        ignoreTopSafeArea: true,
                        props: {
                            // title: l('pick_route'),
                            options: selectedRoutes.map((s) => ({ name: s.featureData.name, route: s }))
                        }
                    });
                    const result = Array.isArray(results) ? results[0] : results;
                    if (result) {
                        handleRouteSelection(result.route.featureData, result.route.layer);
                    }
                }
            }
        } catch (err) {
            console.error('handleSelectedRoutes', err, err['stack']);
        }
        selectedRoutes = null;
        handleSelectedRouteTimer = null;
    }
    function handleClickedFeatures(position: GenericGeoLocation<LatLonKeys>) {
        let fakeIndex = 0;
        // currentClickedFeatures = [...new Map(clickedFeatures.map((item) => [JSON.stringify(item), item])).values()];
        if (!selectedClickMarker) {
            getOrCreateLocalVectorLayer();
            const styleBuilder = new TextStyleBuilder({
                color: 'black',
                scaleWithDPI: true,
                borderWidth: 0,
                strokeWidth: 0,
                fontSize: 20,
                anchorPointX: 0.3,
                anchorPointY: -0.1
            });
            selectedClickMarker = new Text<LatLonKeys>({ position, projection, styleBuilder, text: '+' });
            localVectorDataSource.add(selectedClickMarker);
        } else {
            selectedClickMarker.position = position;
            selectedClickMarker.visible = true;
        }
        // clickedFeatures = [];
    }

    function onRasterTileClicked(data: RasterTileClickInfo<LatLonKeys>) {
        const { clickType, position, nearestColor, layer } = data;
    }
    function onVectorTileClicked(data: VectorTileEventData<LatLonKeys>) {
        const { clickType, featureId, position, featureLayerName, featureData, featurePosition, featureGeometry, layer } = data;

        TEST_LOG && console.log('onVectorTileClicked', clickType, featureLayerName, featureId, featureData.class, featureData.subclass, featureData, featurePosition);

        const handledByModules = mapContext.runOnModules('onVectorTileClicked', data);
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
                if (handleSelectedRouteTimer) {
                    clearTimeout(handleSelectedRouteTimer);
                }
                selectedRoutes = selectedRoutes || [];
                handleSelectedRouteTimer = setTimeout(handleSelectedRoutes, 10);
                if (selectedRoutes.findIndex((s) => s.featureData.osmid === featureData.osmid) === -1) {
                    selectedRoutes.push({ featurePosition, featureData, layer });
                    ignoreNextMapClick = true;
                }
                return false;
            }

            const isFeatureInteresting =
                featureLayerName === 'poi' ||
                featureLayerName === 'mountain_peak' ||
                featureLayerName === 'housenumber' ||
                (!!featureData.name && (featureData.class !== 'national_park' || cartoMap.zoom < 9) && (featureData.class !== 'protected_area' || cartoMap.zoom < 11));
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
                        coordinates: isFeatureInteresting ? [featurePosition.lon, featurePosition.lat] : [position.lon, position.lat]
                    }
                };
                selectItem({ item: result, isFeatureInteresting, showButtons: featureData.class === 'bus' || featureData.subclass === 'tram_stop' });
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
        const { clickType, position, elementPos, metaData, element } = data;
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
        const { clickType, position, featureData } = data;
        TEST_LOG && console.log('onVectorTileElementClicked', clickType, position, featureData.id);
        const itemModule = mapContext.mapModule('items');
        const feature = itemModule.getFeature(featureData.id);
        if (!feature) {
            return false;
        }
        Object.keys(feature.properties).forEach((k) => {
            if (feature.properties[k][0] === '{' || feature.properties[k][0] === '[') {
                feature.properties[k] = JSON.parse(feature.properties[k]);
            }
        });
        const handledByModules = mapContext.runOnModules('onVectorTileElementClicked', data);
        // if (DEV_LOG) {
        //     console.log('handledByModules', handledByModules);
        // }
        if (!!featureData.instruction) {
            return true;
        }
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
        if (searchView && searchView.hasFocus()) {
            searchView.unfocus();
        }
        // });
    }

    function setRenderProjectionMode(showGlobe) {
        cartoMap && cartoMap.getOptions().setRenderProjectionMode(showGlobe ? RenderProjectionMode.RENDER_PROJECTION_MODE_SPHERICAL : RenderProjectionMode.RENDER_PROJECTION_MODE_PLANAR);
    }

    function setStyleParameter(key: string, value: string) {
        // console.log('setStyleParameter', key, value);
        let decoder = getVectorTileDecoder();
        if (!!decoder) {
            decoder.setStyleParameter(key, value);
        }
    }

    function setCurrentLayer(id: string) {
        if (__CARTO_PACKAGESERVICE__) {
            TEST_LOG && console.log('setCurrentLayer', id, $preloading);
            // const cartoMap = cartoMap;
            if (currentLayer) {
                removeLayer(currentLayer, 'map');
                currentLayer.setVectorTileEventListener(null);
                currentLayer = null;
            }
            currentLayerStyle = id;
            const decoder = getVectorTileDecoder();

            currentLayer = new VectorTileLayer({
                preloading: $preloading,
                labelRenderOrder: VectorTileRenderOrder.LAST,
                dataSource: packageService.getDataSource($showContourLines),
                decoder
            });
            handleNewLanguage(currentLanguage);
            // console.log('currentLayer', !!currentLayer);
            // currentLayer.setLabelRenderOrder(VectorTileRenderOrder.LAST);
            currentLayer.setVectorTileEventListener<LatLonKeys>(
                {
                    onVectorTileClicked: (data) => onVectorTileClicked(data)
                },
                projection,
                akylas.alpi.maps.VectorTileEventListener
            );
            try {
                addLayer(currentLayer, 'map');
            } catch (err) {
                showError(err);
                vectorTileDecoder = null;
            }
        }
    }
    function handleNewLanguage(newLang) {
        currentLanguage = newLang;
        packageService.currentLanguage = newLang;
        setStyleParameter('lang', newLang);
        // setStyleParameter('fallback_lang', 'en');
    }
    onLanguageChanged(handleNewLanguage);

    function getVectorTileDecoder() {
        return vectorTileDecoder || packageService.getVectorTileDecoder();
    }

    function getCurrentLayer() {
        return currentLayer;
    }

    // function getStyleFromCartoMapStyle(style: CartoMapStyle) {
    //     switch (style) {
    //         case CartoMapStyle.DARKMATTER:
    //             return 'darkmatter';
    //         case CartoMapStyle.POSITRON:
    //             return 'positron';
    //         case CartoMapStyle.VOYAGER:
    //         default:
    //             return 'voyager';
    //     }
    // }
    // function geteCartoMapStyleFromStyle(style: string) {
    //     switch (style) {
    //         case 'darkmatter':
    //             return CartoMapStyle.DARKMATTER;
    //         case 'positron':
    //             return CartoMapStyle.POSITRON;
    //         case 'voyager':
    //         default:
    //             return CartoMapStyle.VOYAGER;
    //     }
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
        // console.log('setMapStyle', layerStyle, currentLayerStyle, mapStyle, mapStyleLayer);
        if (layerStyle !== currentLayerStyle || !!force) {
            currentLayerStyle = layerStyle;
            appSettings.setString('mapStyle', layerStyle);
            const oldVectorTileDecoder = vectorTileDecoder;
            if (layerStyle === 'default') {
                vectorTileDecoder = new CartoOnlineVectorTileLayer({
                    style: mapStyleLayer
                }).getTileDecoder();
                // if (!PRODUCTION) {
                //     vectorTileDecoder.setStyleParameter('debug', '1')
                // }
            } else {
                try {
                    // const start = Date.now();
                    vectorTileDecoder = new MBVectorTileDecoder({
                        style: mapStyleLayer,
                        liveReload: !PRODUCTION,
                        [mapStyle.endsWith('.zip') ? 'zipPath' : 'dirPath']: `~/assets/styles/${mapStyle}`
                    });
                    mapContext.runOnModules('vectorTileDecoderChanged', oldVectorTileDecoder, vectorTileDecoder);
                } catch (err) {
                    showError(err);
                    vectorTileDecoder = null;
                }
            }
            handleNewLanguage(currentLanguage);
            if (__CARTO_PACKAGESERVICE__) {
                setCurrentLayer(currentLayerStyle);
            }
        }
    }

    async function selectStyle() {
        let styles = [];
        const stylePath = path.join(knownFolders.currentApp().path, 'assets', 'styles');
        const entities = await Folder.fromPath(stylePath).getEntities();
        for (let index = 0; index < entities.length; index++) {
            const e = entities[index];
            if (Folder.exists(e.path)) {
                const subs = await Folder.fromPath(e.path).getEntities();
                styles.push(...subs.filter((s) => s.name.endsWith('.json') || s.name.endsWith('.xml')).map((s) => e.name + '~' + s.name.split('.')[0]));
            } else {
                try {
                    const assetsNames = nativeVectorToArray(new ZippedAssetPackage({ zipPath: e.path }).getAssetNames());
                    styles.push(...assetsNames.filter((s) => s.endsWith('.xml')).map((s) => e.name + '~' + s.split('.')[0]));
                } catch (error) {
                    console.error(error);
                }
            }
        }
        const actions = styles.concat('default');
        action({
            title: lc('select_style'),
            actions
        }).then((result) => {
            if (actions.indexOf(result) !== -1) {
                setMapStyle(result);
            }
        });
    }

    async function downloadPackages() {
        // const PackagesDownloadComponent = (await import('./PackagesDownloadComponent.svelte'))['default'];
        // const { PackagesDownloadComponent: component } = await import("~/components/PackagesDownloadComponent.svelte");
        // showBottomSheet({ parent: page, view: PackagesDownloadComponent });
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
        const index = addedLayers.findIndex((d) => d.layer === layer);
        if (index !== -1 && index !== newIndex) {
            const val = addedLayers[index];
            addedLayers.splice(index, 1);
            addedLayers.splice(newIndex, 0, val);
        }
        cartoMap.getLayers().remove(layer);
        cartoMap.getLayers().insert(newIndex, layer);
    }
    function getLayerIndex(layer: Layer<any, any>) {
        return addedLayers.findIndex((d) => d.layer === layer);
    }
    function replaceLayer(oldLayer: Layer<any, any>, layer: Layer<any, any>) {
        const index = addedLayers.findIndex((d) => d.layer === oldLayer);
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
        return addedLayers.slice(startIndex, endIndex !== -1 ? endIndex : undefined);
    }
    function addLayer(layer: Layer<any, any>, layerId: LayerType) {
        // console.log('addLayer', layer.constructor.name, layerId, new Error().stack);
        if (cartoMap) {
            if (addedLayers.findIndex((d) => d.layer === layer) !== -1) {
                return;
            }
            const layerIndex = LAYERS_ORDER.indexOf(layerId);
            let realIndex = addedLayers.findIndex((d) => LAYERS_ORDER.indexOf(d.layerId) > layerIndex);
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
            let realIndex =
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
    function topSheetTranslationFunction(maxTranslation, translation, progress) {
        return {
            topSheet: {
                translateY: translation
            },
            search: {
                translateY: maxTranslation - translation
            }
        };
    }

    function bottomSheetTranslationFunction(maxTranslation, translation, progress) {
        if (translation < 300) {
            scrollingWidgetsOpacity = 1;
        } else {
            scrollingWidgetsOpacity = 4 * (2 - 2 * progress) - 3;
        }
        mapTranslation = -(maxTranslation - translation);
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
            mapScrollingWidgets: {
                target: mapScrollingWidgets.getNativeView(),
                translateY: mapTranslation,
                opacity: scrollingWidgetsOpacity
            }
        };
        return result;
    }

    function drawerTranslationFunction(side, width, value, delta, progress) {
        if (side === 'left') {
            const result = {
                mainContent: {
                    translateX: 0
                },
                [side + 'Drawer']: {
                    translateX: side === 'left' ? -value : value
                }
                // backDrop: {
                //     translateX: 0,
                //     opacity: 0,
                // },
            } as any;
            if (side === 'left') {
                result.backDrop = {
                    translateX: 0,
                    opacity: progress
                };
            }
            return result;
        } else if (side === 'bottom') {
            const result = {
                mainContent: {
                    translateY: 0
                },
                [side + 'Drawer']: {
                    translateY: value
                }
                // backDrop: {
                //     translateX: 0,
                //     opacity: 0,
                // },
            } as any;
            result.backDrop = {
                translateY: 0,
                opacity: 0
            };
            return result;
        }
    }

    function showKeepAwakeNotification() {
        if (__ANDROID__) {
            const context: android.content.Context = ad.getApplicationContext();
            const builder = NotificationHelper.getNotification(context, {
                title: lt('screen_awake_notification'),
                channel: NOTIFICATION_CHANEL_ID_KEEP_AWAKE_CHANNEL
            });

            const notification = builder.build();
            NotificationHelper.showNotification(notification, KEEP_AWAKE_NOTIFICATION_ID);
        }
    }

    function hideKeepAwakeNotification() {
        if (__ANDROID__) {
            NotificationHelper.hideNotification(KEEP_AWAKE_NOTIFICATION_ID);
        }
    }

    async function switchKeepAwake() {
        keepScreenAwake = !keepScreenAwake;
    }
    async function switchShowOnLockscreen() {
        try {
            if (showOnLockscreen) {
                disableShowWhenLockedAndTurnScreenOn();
                showOnLockscreen = false;
            } else {
                enableShowWhenLockedAndTurnScreenOn();
                showOnLockscreen = true;
            }
        } catch (err) {
            showError(err);
        }
    }

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

    async function showOptions() {
        try {
            const options = [
                {
                    title: lc('select_style'),
                    id: 'select_style',
                    icon: 'mdi-layers'
                },
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
                //     color: keepAwakeEnabled ? 'red' : '#00ff00',
                //     id: 'keep_awake',
                //     icon: keepAwakeEnabled ? 'mdi-sleep' : 'mdi-sleep-off'
                // },
                {
                    title: lc('compass'),
                    id: 'compass',
                    icon: 'mdi-compass'
                },
                {
                    title: lc('satellites_view'),
                    id: 'gps_status',
                    icon: 'mdi-satellite-variant'
                },
                {
                    title: lc('astronomy'),
                    id: 'astronomy',
                    icon: 'mdi-weather-night'
                },
                {
                    title: lc('settings'),
                    id: 'settings',
                    icon: 'mdi-cogs'
                },

                {
                    title: lc('dark_mode'),
                    id: 'dark_mode',
                    color: $sTheme === 'dark' ? primaryColor : undefined,
                    icon: 'mdi-theme-light-dark'
                }
            ];
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

            if (packageServiceEnabled) {
                options.unshift({
                    title: lc('offline_packages'),
                    id: 'offline_packages',
                    icon: 'mdi-earth'
                });
            }
            const MapOptions = (await import('~/components/MapOptions.svelte')).default;
            const result = (await showBottomSheet({
                parent: page,
                view: MapOptions,
                props: { options }
                // transparent: true,
                // disableDimBackground: true
            })) as any;
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
                    case 'offline_packages':
                        downloadPackages();
                        break;
                    case 'dark_mode':
                        toggleTheme(true);
                        break;
                    case 'sentry':
                        await sendBugReport();
                        break;
                    default:
                        await handleMapAction(result.id);
                        break;
                }
            }
        } catch (err) {
            showError(err);
        }
    }

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
            if (result.result) {
                Sentry.captureMessage(result.text);
                Sentry.flush();
                showSnack({ message: l('bug_report_sent') });
            }
        }
    }

    async function showTransitLinesPage() {
        try {
            const component = (await import('~/components/transit/TransitLines.svelte')).default;
            await navigate({ page: component });
        } catch (error) {
            showError(error);
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
</script>

<page
    bind:this={page}
    actionBarHidden={true}
    backgroundColor="#E3E1D3"
    on:navigatingTo={onNavigatingTo}
    on:navigatingFrom={onNavigatingFrom}
    {keepScreenAwake}
    screenBrightness={keepScreenAwake ? 1 : 0}
>
    <bottomsheet
        android:marginBottom={$navigationBarHeight}
        backgroundColor="#01550000"
        panGestureOptions={bottomSheetPanGestureOptions}
        {steps}
        stepIndex={bottomSheetStepIndex}
        on:stepIndexChange={(e) => (bottomSheetStepIndex = e.value)}
        translationFunction={bottomSheetTranslationFunction}
    >
        <cartomap
            zoom="16"
            on:mapReady={onMainMapReady}
            on:mapMoved={onMainMapMove}
            on:mapStable={onMainMapStable}
            on:mapIdle={onMainMapIdle}
            on:mapClicked={onMainMapClicked}
            useTextureView={false}
            on:layoutChanged={reportFullyDrawn}
        />
        <stacklayout horizontalAlignment="left" verticalAlignment="middle">
            <IconButton gray={true} text="mdi-bullseye" isSelected={$showContourLines} on:tap={() => showContourLines.set(!$showContourLines)} />
            <IconButton gray={true} text="mdi-signal" isSelected={$showSlopePercentages} on:tap={() => showSlopePercentages.set(!$showSlopePercentages)} />
            <IconButton gray={true} text="mdi-routes" isSelected={$showRoutes} on:tap={() => showRoutes.set(!$showRoutes)} />
            <IconButton gray={true} text="mdi-speedometer" on:tap={switchLocationInfo} />
            {#if packageServiceEnabled}
                <IconButton gray={true} text="mdi-map-clock" isSelected={$preloading} on:tap={() => preloading.set(!$preloading)} />
            {/if}
            <IconButton gray={true} text={keepScreenAwake ? 'mdi-sleep' : 'mdi-sleep-off'} selectedColor={'red'} isSelected={keepScreenAwake} on:tap={switchKeepAwake} />
            <IconButton gray={true} text="mdi-cellphone-lock" isSelected={showOnLockscreen} on:tap={switchShowOnLockscreen} />
            <!-- <IconButton text="mdi-information-outline" isSelected={showClickedFeatures} on:tap={() => (showClickedFeatures = !showClickedFeatures)} /> -->
            <IconButton gray={true} text="mdi-bus-marker" isSelected={showTransitLines} on:tap={() => (showTransitLines = !showTransitLines)} onLongPress={showTransitLinesPage} />
        </stacklayout>
        <Search bind:this={searchView} verticalAlignment="top" defaultElevation={0} isUserInteractionEnabled={scrollingWidgetsOpacity > 0.3} />
        <LocationInfoPanel horizontalAlignment="left" verticalAlignment="top" marginLeft="20" marginTop="90" bind:this={locationInfoPanel} isUserInteractionEnabled={scrollingWidgetsOpacity > 0.3} />
        <canvaslabel
            orientation="vertical"
            verticalAlignment="middle"
            horizontalAlignment="right"
            isUserInteractionEnabled="false"
            color="red"
            fontSize="12"
            width="20"
            height="30"
            class="mdi"
            textAlignment="center"
        >
            <cspan text="mdi-access-point-network-off" visibility={networkConnected ? 'collapsed' : 'visible'} textAlignment="left" verticalTextAlignement="top" />
        </canvaslabel>
        <mdbutton
            marginTop="90"
            visibility={currentMapRotation !== 0 ? 'visible' : 'collapsed'}
            on:tap={resetBearing}
            class="small-floating-btn"
            text="mdi-navigation"
            color={primaryColor}
            rotate={-currentMapRotation}
            verticalAlignment="top"
            horizontalAlignment="right"
            translateY={Math.max(topTranslationY - 50, 0)}
        />
        <MapScrollingWidgets bind:this={mapScrollingWidgets} bind:navigationInstructions opacity={scrollingWidgetsOpacity} userInteractionEnabled={scrollingWidgetsOpacity > 0.3} />
        <DirectionsPanel bind:this={directionsPanel} bind:translationY={topTranslationY} width="100%" verticalAlignment="top" />
        <BottomSheetInner bind:this={bottomSheetInner} bind:navigationInstructions bind:steps prop:bottomSheet updating={itemLoading} item={$selectedItem} />
        <!-- <collectionview
                items={currentClickedFeatures}
                height="80"
                margin="80 20 0 20"
                verticalAlignment="top"
                borderRadius="16"
                backgroundColor="#00000055"
                visibility={currentClickedFeatures && currentClickedFeatures.length > 0 ? 'visible' : 'collapsed'}
            >
                <Template let:item>
                    <label padding="0 20 0 20" text={JSON.stringify(item)} verticalAlignment="center" fontSize="11" color="white" />
                </Template>
            </collectionview> -->
    </bottomsheet>
</page>
