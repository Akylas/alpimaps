<script lang="ts">
    import { getFromLocation } from '@nativescript-community/geocoding';
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
    import { CartoMap, PanningMode, RenderProjectionMode } from '@nativescript-community/ui-carto/ui';
    import { ZippedAssetPackage, nativeVectorToArray, setShowDebug, setShowError, setShowInfo, setShowWarn } from '@nativescript-community/ui-carto/utils';
    import { Point } from '@nativescript-community/ui-carto/vectorelements/point';
    import { MBVectorTileDecoder } from '@nativescript-community/ui-carto/vectortiles';
    import { openFilePicker } from '@nativescript-community/ui-document-picker';
    import { closeBottomSheet, isBottomSheetOpened, showBottomSheet } from '@nativescript-community/ui-material-bottomsheet/svelte';
    import { action, confirm, prompt } from '@nativescript-community/ui-material-dialogs';
    import { showSnack } from '@nativescript-community/ui-material-snackbar';
    import { VerticalPosition } from '@nativescript-community/ui-popover';
    import { showPopover } from '@nativescript-community/ui-popover/svelte';
    import { getUniversalLink, registerUniversalLinkCallback } from '@nativescript-community/universal-links';
    import { AbsoluteLayout, Application, ApplicationSettings, Color, File, Page, Utils } from '@nativescript/core';
    import type { AndroidActivityBackPressedEventData } from '@nativescript/core/application/application-interfaces';
    import { Folder, knownFolders, path } from '@nativescript/core/file-system';
    import { Screen } from '@nativescript/core/platform';
    import { debounce } from '@nativescript/core/utils';
    import type { Point as GeoJSONPoint } from 'geojson';
    import { onDestroy, onMount } from 'svelte';
    import { navigate } from 'svelte-native';
    import { NativeViewElementNode } from 'svelte-native/dom';
    import BottomSheetInner from '~/components/bottomsheet/BottomSheetInner.svelte';
    import ButtonBar from '~/components/common/ButtonBar.svelte';
    import DirectionsPanel from '~/components/directions/DirectionsPanel.svelte';
    import LocationInfoPanel from '~/components/map/LocationInfoPanel.svelte';
    import MapScrollingWidgets from '~/components/map/MapScrollingWidgets.svelte';
    import Search from '~/components/search/Search.svelte';
    import { GeoHandler } from '~/handlers/GeoHandler';
    import { l, lc, lt, onLanguageChanged, onMapLanguageChanged } from '~/helpers/locale';
    import { sTheme, toggleTheme } from '~/helpers/theme';
    import watcher from '~/helpers/watcher';
    import CustomLayersModule from '~/mapModules/CustomLayersModule';
    import ItemsModule from '~/mapModules/ItemsModule';
    import type { LayerType } from '~/mapModules/MapModule';
    import { getMapContext, handleMapAction, setMapContext } from '~/mapModules/MapModule';
    import UserLocationModule from '~/mapModules/UserLocationModule';
    import type { IItem, Item, RouteInstruction } from '~/models/Item';
    import { onServiceLoaded, onServiceUnloaded } from '~/services/BgService.common';
    import type { NetworkConnectionStateEventData } from '~/services/NetworkService';
    import { NetworkConnectionStateEvent, networkService } from '~/services/NetworkService';
    import { GeoResult, packageService } from '~/services/PackageService';
    import { transitService } from '~/services/TransitService';
    import { NOTIFICATION_CHANEL_ID_KEEP_AWAKE_CHANNEL, NotificationHelper } from '~/services/android/NotifcationHelper';
    import { contourLinesOpacity, pitchEnabled, preloading, rotateEnabled, routesType, show3DBuildings, showContourLines, showGlobe, showRoutes, showSlopePercentages } from '~/stores/mapStore';
    import { showError } from '~/utils/error';
    import { computeDistanceBetween, getBoundsZoomLevel } from '~/utils/geo';
    import { parseUrlQueryParameters } from '~/utils/http';
    import { Sentry, isSentryEnabled } from '~/utils/sentry';
    import { share } from '~/utils/share';
    import { hideLoading, showLoading } from '~/utils/ui';
    import { clearTimeout, disableShowWhenLockedAndTurnScreenOn, enableShowWhenLockedAndTurnScreenOn, iosExecuteOnMainThread, setTimeout } from '~/utils/utils';
    import { colors, navigationBarHeight, statusBarHeight } from '../../variables';

    $: ({ colorPrimary, colorError, colorBackground } = $colors);
    const KEEP_AWAKE_NOTIFICATION_ID = 23466578;

    const LAYERS_ORDER: LayerType[] = ['map', 'customLayers', 'routes', 'transit', 'hillshade', 'items', 'directions', 'search', 'selection', 'userLocation'];
    const KEEP_AWAKE_KEY = '_keep_awake';
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
    const selectedItem = watcher<Item>(null, onSelectedItemChanged);
    let editingItem: Item = null;
    // let currentLayer: VectorTileLayer;
    let currentLayerStyle: string;
    let localVectorDataSource: LocalVectorDataSource;
    let localVectorLayer: VectorLayer;
    let vectorTileDecoder: MBVectorTileDecoder;
    let bottomSheetStepIndex = 0;
    let itemLoading = false;
    let projection: Projection = null;
    let currentLanguage = ApplicationSettings.getString('map_language', ApplicationSettings.getString('language', 'en'));
    const addedLayers: { layer: Layer<any, any>; layerId: LayerType }[] = [];
    let keepScreenAwake = ApplicationSettings.getBoolean(KEEP_AWAKE_KEY, false);
    let showOnLockscreen = false;
    let currentMapRotation = 0;
    const shouldShowNavigationBarOverlay = false;
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
    let handleSelectedTransitLinesTimer: NodeJS.Timeout;
    let selectedRoutes: IItem[];
    let selectedTransitLines: IItem[];
    let didIgnoreAlreadySelected = false;

    let showTransitLines = false;
    // let selectedClickMarker: Text<LatLonKeys>;

    let transitVectorTileDataSource: GeoJSONVectorTileDataSource;
    let transitVectorTileLayer: VectorTileLayer;

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
    const fetchingTransitLines = false;
    $: {
        if (showTransitLines) {
            // const pos = cartoMap.focusPos;
            (async () => {
                try {
                    if (!transitVectorTileDataSource && !fetchingTransitLines) {
                        DEV_LOG && console.time('getTransitLines');
                        const result = await transitService.getTransitLines();
                        DEV_LOG && console.timeEnd('getTransitLines');
                        transitVectorTileDataSource = new GeoJSONVectorTileDataSource({
                            // simplifyTolerance: 0,
                            minZoom: 0,
                            maxZoom: 24
                        });
                        transitVectorTileDataSource.createLayer('routes');
                        transitVectorTileDataSource.setLayerGeoJSONString(1, result);
                        if (!transitVectorTileLayer) {
                            mapContext.innerDecoder.setStyleParameter('default_transit_color', transitService.defaultTransitLineColor);
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
                            transitVectorTileLayer.setVectorTileEventListener<LatLonKeys>(
                                {
                                    onVectorTileClicked: ({ featureId, featureData, featureLayerName, featureGeometry }) => {
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
                                                        // ref: lineName,
                                                        // subtitle: lineName,
                                                        // name: lineName,
                                                        // symbol: `${color}:${color}:${lineName}:${textColor}`,
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
                            addLayer(transitVectorTileLayer, 'transit');
                        } else {
                            transitVectorTileLayer.visible = true;
                        }
                    } else if (transitVectorTileLayer) {
                        transitVectorTileLayer.visible = true;
                    }
                } catch (error) {
                    showError(error);
                }
            })();
        } else if (transitVectorTileLayer) {
            transitVectorTileLayer.visible = false;
        }
    }

    async function onAppUrl(link: string) {
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
                const itemModule = mapContext.mapModule('items');
                showLoading();
                await itemModule.importGPXFile(link);
            } else if (link.endsWith('.geojson')) {
                const itemModule = mapContext.mapModule('items');
                showLoading();
                await itemModule.importGeoJSONFile(link);
            } else {
                searchView.searchForQuery(link);
            }
        } catch (err) {
            console.error(err, err.stack);
            showError(err);
        } finally {
            hideLoading();
        }
    }

    async function onNetworkChange(event: NetworkConnectionStateEventData) {
        networkConnected = event.data.connected;
    }
    let customLayersModule: CustomLayersModule;
    onMount(() => {
        networkService.on(NetworkConnectionStateEvent, onNetworkChange);
        networkConnected = networkService.connected;
        if (__ANDROID__) {
            Application.android.on(Application.android.activityBackPressedEvent, onAndroidBackButton);
        }
        customLayersModule = new CustomLayersModule();
        customLayersModule.once('ready', updateSideButtons);
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
            setBottomSheetStepIndex: (index: number) => {
                DEV_LOG && console.log('setBottomSheetStepIndex', bottomSheetStepIndex, steps);
                bottomSheetStepIndex = index;
            },
            showOptions,
            mapModules: {
                items: new ItemsModule(),
                userLocation: new UserLocationModule(),
                customLayers: customLayersModule,
                directionsPanel,
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
    function onColorsChange() {
        mapContext.innerDecoder.setJSONStyleParameters({
            main_color: $colors.colorPrimary,
            main_darker_color: new Color($colors.colorPrimary).darken(10).hex
        });
    }
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
        if (__ANDROID__) {
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
    }
    function reloadMapStyle() {
        mapContext.runOnModules('reloadMapStyle');
    }

    function getOrCreateLocalVectorLayer() {
        if (!localVectorLayer) {
            localVectorDataSource = new LocalVectorDataSource({ projection });

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
        const top = Utils.layout.toDevicePixels($statusBarHeight + 90 + topTranslationY);
        const bottom = Utils.layout.toDevicePixels($navigationBarHeight - mapTranslation + 0);
        const min = Math.min(width - 2 * left, height - top - bottom);
        const deltaX = (width - min) / 2;
        const result = {
            left,
            top,
            width: width - 2 * left,
            height: height - top - bottom
        };
        DEV_LOG && console.log('getMapViewPort', width, height, mapTranslation, topTranslationY, result);
        return result;
    }
    const saveSettings = debounce(function () {
        DEV_LOG && console.log('saveSettings');
        if (!cartoMap) {
            return;
        }
        ApplicationSettings.setNumber('mapZoom', cartoMap.zoom);
        ApplicationSettings.setNumber('mapBearing', cartoMap.bearing);
        ApplicationSettings.setString('mapFocusPos', JSON.stringify(cartoMap.focusPos));
    }, 500);

    // mapContext.onOtherAppTextSelected((text)=>{
    //     console.log('onOtherAppTextSelected', text)
    //     showApp();
    //     searchView.searchForQuery(text);
    // })

    async function onMainMapReady(e) {
        try {
            if (!PRODUCTION) {
                await new Promise((resolve) => setTimeout(resolve, 1000));
            }
            const map = e.object as CartoMap<LatLonKeys>;
            CartoMap.setRunOnMainThread(true);
            if (!PRODUCTION && DEV_LOG) {
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
            const options = map.getOptions();
            //@ts-ignore
            options.setLayersLabelsProcessedInReverseOrder(false);
            options.setWatermarkScale(0);
            options.setRestrictedPanning(true);
            options.setPanningMode(PanningMode.PANNING_MODE_STICKY_FINAL);
            options.setEnvelopeThreadPoolSize(1);
            options.setTileThreadPoolSize(1);

            options.setZoomGestures(true);
            options.setDoubleClickMaxDuration(0.3);
            options.setLongClickDuration(0.5);
            options.setKineticRotation(false);

            cartoMap = map;
            onColorsChange();
            const pos = JSON.parse(ApplicationSettings.getString('mapFocusPos', '{"lat":45.2012,"lon":5.7222}')) as MapPos<LatLonKeys>;
            const zoom = ApplicationSettings.getNumber('mapZoom', 10);
            const bearing = ApplicationSettings.getNumber('mapBearing', 0);
            cartoMap.setFocusPos(pos, 0);
            cartoMap.setZoom(zoom, 0);
            cartoMap.setBearing(bearing, 0);
            DEV_LOG && console.log('onMainMapReady', pos, zoom, bearing, addedLayers);
            try {
                packageService.start();
                transitService.start();
                setMapStyle(ApplicationSettings.getString('mapStyle', PRODUCTION || TEST_ZIP_STYLES ? 'osm.zip~osm' : 'osm~osm'), true);
                // setMapStyle('mobile-sdk-styles~voyager', true);
            } catch (err) {
                showError(err);
            }
            if (addedLayers) {
                Object.values(addedLayers).forEach((d) => {
                    addLayer(d.layer, d.layerId, true);
                });
            }
            //in case it is created before (clicked as soon as the UI is shown)
            if (transitVectorTileLayer) {
                addLayer(transitVectorTileLayer, 'transit');
            }
            mapContext.runOnModules('onMapReady', cartoMap);

            registerUniversalLinkCallback(onAppUrl);
            const current = getUniversalLink();
            if (current) {
                onAppUrl(current);
            }
        } catch (error) {
            console.error(error, error.stack);
        }
    }
    let mapMoved = false;
    function onMainMapMove(e) {
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
        // DEV_LOG && console.log('onMainMapInteraction', mapMoved);
        if (!cartoMap) {
            return;
        }
        if (!mapMoved) {
            unFocusSearch();
        }
        mapMoved = true;
    }
    function onMainMapIdle(e) {
        // DEV_LOG && console.log('onMainMapIdle', mapMoved);
        if (!cartoMap) {
            return;
        }
        mapContext.runOnModules('onMapIdle', e);
    }
    function onMainMapStable(e) {
        // DEV_LOG && console.log('onMainMapStable', mapMoved);
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
        TEST_LOG && console.log('onMainMapClicked', clickType, position, ignoreNextMapClick);
        // handleClickedFeatures(position);
        if (ignoreNextMapClick || searchView.hasFocus()) {
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

    function setSelectedItem(item) {
        // DEV_LOG && console.log('setSelectedItem', item?.id);
        $selectedItem = item;
    }
    let geocodingAvailable = true;
    async function selectItem({
        item,
        isFeatureInteresting = false,
        peek = true,
        setSelected = true,
        showButtons = false,
        preventZoom = true,
        minZoom,
        zoom,
        zoomDuration,
        forceZoomOut = false
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
        forceZoomOut?: boolean;
    }) {
        try {
            didIgnoreAlreadySelected = false;
            if (isFeatureInteresting) {
                const isCurrentItem = item === $selectedItem;
                TEST_LOG && console.log('selectItem', setSelected, isCurrentItem, item.properties?.class, item.properties?.name, peek, setSelected, showButtons);
                if (setSelected && isCurrentItem && !item) {
                    unselectItem(false);
                }
                const route = item?.route;
                const props = item.properties;
                if (setSelected && route) {
                    TEST_LOG && console.log('selected_id', typeof route.osmid, route.osmid, typeof props.id, props.id, setSelected);

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
                            color: new Color(colorPrimary).setAlpha(178).hex,
                            clickSize: 0,
                            scaleWithDPI: true,
                            size: 20
                        });
                        localVectorDataSource.add(selectedPosMarker);
                    } else {
                        selectedPosMarker.position = position;
                        selectedPosMarker.visible = true;
                    }
                    if (setSelected) {
                        // TODO: not enabled for now as really slow
                        // if (props.subclass) {
                        //     mapContext.mapDecoder.setStyleParameter('selected_id', props.name + props.subclass);
                        // } else {
                        //     mapContext.mapDecoder.setStyleParameter('selected_id', '');
                        // }
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
                }
                if (setSelected) {
                    setSelectedItem(item);
                }
                if (setSelected && !route) {
                    // if geocodingAvailable is not available it means we tested once
                    if (!props.address?.['city'] && geocodingAvailable) {
                        (async () => {
                            try {
                                const service = packageService.localOSMOfflineReverseGeocodingService;
                                const geometry = item.geometry as GeoJSONPoint;
                                const position = { lat: geometry.coordinates[1], lon: geometry.coordinates[0] };
                                // DEV_LOG && console.log('fetching addresses', !!service, position);
                                if (service) {
                                    itemLoading = true;
                                    const radius = 200;
                                    // use a promise not to "wait" for it
                                    const res = await packageService.searchInGeocodingService(service, {
                                        projection,
                                        location: position,
                                        searchRadius: radius
                                    });
                                    if (res) {
                                        let bestFind: GeoResult;
                                        for (let index = 0; index < res.size(); index++) {
                                            const r = packageService.convertGeoCodingResult(res.get(index), true);

                                            if (
                                                r &&
                                                r.properties.rank > 0.6 &&
                                                computeDistanceBetween(position, {
                                                    lat: r.geometry.coordinates[1],
                                                    lon: r.geometry.coordinates[0]
                                                }) <= radius
                                            ) {
                                                if (!bestFind || Object.keys(r.properties.address).length > Object.keys(bestFind.properties.address).length) {
                                                    bestFind = r;
                                                } else if (bestFind && props.address && props.address['street']) {
                                                    break;
                                                }
                                            } else {
                                                break;
                                            }
                                        }
                                        // DEV_LOG && console.log('fetched addresses', bestFind, $selectedItem.geometry === item.geometry);
                                        if (bestFind && $selectedItem.geometry === item.geometry) {
                                            $selectedItem.properties.address = { ...bestFind.properties.address, name: null, ...(props.housenumber ? { houseNumber: props.housenumber } : {}) } as any;
                                            if (bestFind.properties.address.name && !$selectedItem.properties.name) {
                                                $selectedItem.properties.name = bestFind.properties.address.name;
                                            }
                                            setSelectedItem($selectedItem);
                                        }
                                    }
                                } else {
                                    const results = await getFromLocation(position.lat, position.lon, 10);
                                    DEV_LOG && console.log('found addresses', results);
                                    if (results?.length > 0) {
                                        const result = results[0];
                                        $selectedItem.properties.address = {
                                            city: result.locality,
                                            country: result.country,
                                            state: result.administrativeArea,
                                            housenumber: result.subThoroughfare,
                                            postcode: result.postalCode,
                                            street: result.thoroughfare
                                        } as any;
                                        setSelectedItem($selectedItem);
                                    }
                                }
                            } catch (error) {
                                if (__ANDROID__ && /IOException.*UNAVAILABLE$/.test(error.toString())) {
                                    geocodingAvailable = false;
                                }
                                console.error('error fetching address', error, error.stack);
                            }
                        })();
                    }

                    if (props && 'ele' in props === false && packageService.hasElevation()) {
                        const geometry = item.geometry as GeoJSONPoint;
                        const position = { lat: geometry.coordinates[1], lon: geometry.coordinates[0] };
                        packageService.getElevation(position).then((result) => {
                            if ($selectedItem.geometry === item.geometry) {
                                $selectedItem.properties = $selectedItem.properties || {};
                                $selectedItem.properties['ele'] = result;
                                setSelectedItem($selectedItem);
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
                zoomToItem({ item, zoom, minZoom, duration: zoomDuration, forceZoomOut });
            } else {
                unselectItem();
            }
        } catch (error) {
            console.error(error, error.stack);
        }
    }

    export function zoomToItem({ item, zoom, minZoom, duration = 200, forceZoomOut = false }: { item: IItem; zoom?: number; minZoom?: number; duration?; forceZoomOut?: boolean }) {
        const viewPort = getMapViewPort();
        DEV_LOG && console.log('zoomToItem', viewPort, item.properties?.zoomBounds, item.properties?.extent, !!item.route);
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
        DEV_LOG && console.log('zoomToItem done ');
    }
    export function unselectItem(updateBottomSheet = true) {
        TEST_LOG && console.log('unselectItem', updateBottomSheet, !!$selectedItem);
        if (!!$selectedItem) {
            // mapContext.mapDecoder.setStyleParameter('selected_id', '');
            setSelectedItem(null);
            if (selectedPosMarker) {
                selectedPosMarker.visible = false;
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
    async function selectShownRoutes(event) {
        try {
            const component = (await import('~/components/routes/RoutesTypePopover.svelte')).default;
            await showPopover({
                view: component,
                anchor: event.object,
                vertPos: VerticalPosition.ALIGN_TOP
            });
        } catch (error) {}
    }
    $: {
        try {
            cartoMap && mapContext?.innerDecoder?.setStyleParameter('routes_type', $routesType + '');
        } catch (error) {
            console.error(error, error.stack);
        }
    }
    $: cartoMap?.getOptions().setRenderProjectionMode($showGlobe ? RenderProjectionMode.RENDER_PROJECTION_MODE_SPHERICAL : RenderProjectionMode.RENDER_PROJECTION_MODE_PLANAR);
    $: vectorTileDecoder && setStyleParameter('buildings', !!$show3DBuildings ? '2' : '1');
    $: vectorTileDecoder && setStyleParameter('contours', $showContourLines ? '1' : '0');
    $: vectorTileDecoder && setStyleParameter('contoursOpacity', $contourLinesOpacity.toFixed(1));
    $: {
        const visible = $showRoutes;
        getLayers('routes').forEach((l) => {
            l.layer.visible = visible;
        });
        cartoMap?.requestRedraw();
    }
    $: customLayersModule?.toggleHillshadeSlope($showSlopePercentages);
    $: cartoMap?.getOptions().setRotationGestures($rotateEnabled);
    $: cartoMap?.getOptions().setTiltRange(toNativeMapRange([$pitchEnabled ? 30 : 90, 90]));
    // $: currentLayer && (currentLayer.preloading = $preloading);
    $: bottomSheetStepIndex === 0 && unselectItem();
    $: cartoMap?.getOptions().setFocusPointOffset(toNativeScreenPos({ x: 0, y: Utils.layout.toDevicePixels(steps[bottomSheetStepIndex]) / 2 }));

    $: {
        ApplicationSettings.setBoolean(KEEP_AWAKE_KEY, keepScreenAwake);
        showHideKeepAwakeNotification(keepScreenAwake);
    }
    // $: vectorTileDecoder && mapContext?.innerDecoder?.setStyleParameter('routes', $showRoutes ? '1' : '0');
    // $: shouldShowNavigationBarOverlay = $navigationBarHeight !== 0 && !!selectedItem;

    async function handleSelectedRoutes() {
        unFocusSearch();
        try {
            if (selectedRoutes && selectedRoutes.length > 0) {
                if (selectedRoutes.length === 1) {
                    selectItem({ item: selectedRoutes[0], isFeatureInteresting: true });
                } else {
                    const RouteSelect = (await import('~/components/routes/RouteSelect.svelte')).default;
                    const results = await showBottomSheet({
                        parent: page,
                        view: RouteSelect,
                        props: {
                            // title: l('pick_route'),
                            options: selectedRoutes.map((s) => ({ name: s.properties.name, route: s }))
                        }
                    });
                    const result = Array.isArray(results) ? results[0] : results;
                    if (result) {
                        selectItem({ item: result.route, isFeatureInteresting: true });
                    }
                }
            }
        } catch (err) {
            console.error('handleSelectedRoutes', err, err['stack']);
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
        const { clickType, position, nearestColor, layer } = data;
    }
    function onVectorTileClicked(data: VectorTileEventData<LatLonKeys>) {
        if (handleSelectedTransitLinesTimer) {
            return;
        }
        const { clickType, featureId, position, featureLayerName, featureData, featurePosition, featureGeometry, layer } = data;

        // TEST_LOG && console.log('onVectorTileClicked', clickType, featureLayerName, featureId, featureData.class, featureData.subclass, featureData, position, featurePosition, featureGeometry);
        const handledByModules = mapContext.runOnModules('onVectorTileClicked', data) as boolean;
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

            const isFeatureInteresting =
                featureLayerName === 'poi' ||
                featureLayerName === 'mountain_peak' ||
                featureLayerName === 'housenumber' ||
                (!!featureData.name && (featureData.class !== 'national_park' || cartoMap.zoom < 9) && (featureData.class !== 'protected_area' || cartoMap.zoom < 11) && !selectedRoutes);
            // DEV_LOG && console.log('isFeatureInteresting', featureLayerName, featureData.name, isFeatureInteresting);
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
                        coordinates: isFeatureInteresting && !/Line|Polygon/.test(featureGeometry.constructor.name) ? [featurePosition.lon, featurePosition.lat] : [position.lon, position.lat]
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
        const { clickType, position, featurePosition, featureData } = data;
        TEST_LOG && console.log('onVectorTileElementClicked', clickType, position, featurePosition, featureData.id);
        const itemModule = mapContext.mapModule('items');
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
        TEST_LOG && console.log('onVectorTileElementClicked2', clickType, position, featurePosition, featureData.id, handledByModules, $selectedItem?.id);
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
        TEST_LOG && console.log('unFocusSearch', searchView?.hasFocus());
        if (searchView?.hasFocus()) {
            searchView.unfocus();
        }
        // });
    }

    function setStyleParameter(key: string, value: string) {
        const decoder = mapContext.mapDecoder;
        if (!!decoder) {
            decoder.setStyleParameter(key, value + '');
        }
    }

    function handleNewLanguage(newLang) {
        DEV_LOG && console.log('handleNewLanguage', newLang);
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
            // if (layerStyle === 'default') {
            //     vectorTileDecoder = new CartoOnlineVectorTileLayer({
            //         style: mapStyleLayer
            //     }).getTileDecoder();
            //     // if (!PRODUCTION) {
            //     //     vectorTileDecoder.setStyleParameter('debug', '1')
            //     // }
            // } else {
            try {
                // const start = Date.now();
                vectorTileDecoder = mapContext.createMapDecoder(mapStyle, mapStyleLayer);
            } catch (err) {
                showError(err);
                vectorTileDecoder = null;
            }
            // }
            handleNewLanguage(currentLanguage);
        }
    }

    async function selectStyle() {
        const styles = [];
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
                    console.error(error, error.stack);
                }
            }
        }
        const actions = styles;
        const result = await action({
            title: lc('select_style'),
            actions
        });
        if (actions.indexOf(result) !== -1) {
            setMapStyle(result);
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

    function bottomSheetTranslationFunction(translation, maxTranslation, progress) {
        if (translation >= -300) {
            scrollingWidgetsOpacity = 1;
        } else {
            scrollingWidgetsOpacity = Math.max(0, 1 - (-translation - 300) / 30);
        }
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

    function showHideKeepAwakeNotification(value: boolean) {
        if (__ANDROID__) {
            if (value) {
                const context: android.content.Context = Utils.android.getApplicationContext();
                const builder = NotificationHelper.getNotification(context, {
                    title: lt('screen_awake_notification'),
                    channel: NOTIFICATION_CHANEL_ID_KEEP_AWAKE_CHANNEL
                });

                const notification = builder.build();
                NotificationHelper.showNotification(notification, KEEP_AWAKE_NOTIFICATION_ID);
            } else {
                NotificationHelper.hideNotification(KEEP_AWAKE_NOTIFICATION_ID);
            }
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
            ]
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
                        color: $sTheme === 'dark' ? colorPrimary : undefined,
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
                    },
                    {
                        accessibilityValue: 'settingsBtn',
                        title: lc('settings'),
                        id: 'settings',
                        icon: 'mdi-cogs'
                    }
                ] as any);
            if (customLayersModule.hasLocalData) {
                options.unshift({
                    title: lc('select_style'),
                    id: 'select_style',
                    icon: 'mdi-layers'
                });
            }
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

            const MapOptions = (await import('~/components/map/MapOptions.svelte')).default;
            const result = await showBottomSheet({
                parent: page,
                view: MapOptions,
                props: { options },
                trackingScrollView: 'scrollView'
                // transparent: true,
                // disableDimBackground: true
            });
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
                        toggleTheme(true);
                        break;
                    case 'offline_mode':
                        networkService.forcedOffline = !networkService.forcedOffline;
                        break;
                    case 'sentry':
                        await sendBugReport();
                        break;
                    case 'import': {
                        const result = await openFilePicker({
                            extensions: __IOS__ ? ['com.microoled.gpx'] : ['application/gpx+xml', 'application/json', 'application/geo+json'],
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
                    default:
                        await handleMapAction(result.id);
                        break;
                }
            }
        } catch (err) {
            showError(err);
        } finally {
            hideLoading();
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
                // flush is not yet working on Android
                // event will be sent on restart
                setTimeout(() => Sentry.flush(0), 1000);
                showSnack({ message: l('bug_report_sent') });
            }
        }
    }

    async function showTransitLinesPage() {
        try {
            const component = (await import('~/components/transit/TransitLines.svelte')).default;
            navigate({ page: component });
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
                tooltip: lc('map_rotation'),
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
                onTap: () => showSlopePercentages.set(!$showSlopePercentages)
            },
            {
                text: 'mdi-routes',
                id: 'routes',
                tooltip: lc('show_routes'),
                isSelected: $showRoutes,
                visible: !!customLayersModule?.hasRoute,
                onTap: () => showRoutes.set(!$showRoutes),
                onLongPress: selectShownRoutes
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
        if (WITH_BUS_SUPPORT && customLayersModule?.devMode) {
            newButtons.push({
                text: 'mdi-bus-marker',
                isSelected: showTransitLines,
                selectedColor: colorPrimary,
                onTap: () => (showTransitLines = !showTransitLines),
                onLongPress: showTransitLinesPage
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
            unselectItem();

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
</script>

<page
    bind:this={page}
    actionBarHidden={true}
    backgroundColor="#E3E1D3"
    {keepScreenAwake}
    screenBrightness={keepScreenAwake ? 1 : -1}
    on:navigatingTo={onNavigatingTo}
    on:navigatingFrom={onNavigatingFrom}
    >\
    <gridlayout>
        <bottomsheet
            backgroundColor="#01550000"
            marginBottom={$navigationBarHeight}
            panGestureOptions={{ failOffsetXEnd: 20, minDist: 40 }}
            stepIndex={bottomSheetStepIndex}
            {steps}
            translationFunction={bottomSheetTranslationFunction}
            on:stepIndexChange={(e) => (bottomSheetStepIndex = e.value)}>
            <gridlayout height="100%" width="100%">
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
                <ButtonBar
                    id="mapButtonsNew"
                    buttonSize={40}
                    buttons={sideButtons}
                    color="#666"
                    gray={true}
                    horizontalAlignment="left"
                    marginLeft={5}
                    marginTop={66 + $statusBarHeight + Math.max(topTranslationY - 90, 0)}
                    verticalAlignment="top" />

                <LocationInfoPanel
                    bind:this={locationInfoPanel}
                    horizontalAlignment="left"
                    isUserInteractionEnabled={scrollingWidgetsOpacity > 0.3}
                    marginLeft={20}
                    marginTop={90}
                    verticalAlignment="top" />
                <Search bind:this={searchView} defaultElevation={0} isUserInteractionEnabled={scrollingWidgetsOpacity > 0.3} verticalAlignment="top" />
                <canvaslabel
                    class="mdi"
                    color={colorError}
                    fontSize={12}
                    height={30}
                    horizontalAlignment="right"
                    isUserInteractionEnabled={false}
                    orientation="vertical"
                    textAlignment="center"
                    verticalAlignment="middle"
                    width={20}>
                    <cspan text="mdi-access-point-network-off" textAlignment="left" verticalTextAlignment="top" visibility={networkConnected ? 'collapse' : 'visible'} />
                </canvaslabel>
                <mdcardview
                    id="orientation"
                    class="small-floating-btn"
                    horizontalAlignment="right"
                    marginTop={66 + $statusBarHeight + Math.max(topTranslationY - 90, 0)}
                    shape="round"
                    verticalAlignment="top"
                    visibility={currentMapRotation !== 0 ? 'visible' : 'collapse'}
                    on:tap={resetBearing}>
                    <label class="mdi" color={colorPrimary} rotate={-currentMapRotation} text="mdi-navigation" textAlignment="center" verticalAlignment="middle" />
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
                <MapScrollingWidgets bind:this={mapScrollingWidgets} opacity={scrollingWidgetsOpacity} userInteractionEnabled={scrollingWidgetsOpacity > 0.3} bind:navigationInstructions />
                <DirectionsPanel bind:this={directionsPanel} {editingItem} verticalAlignment="top" width="100%" bind:translationY={topTranslationY} on:cancel={onDirectionsCancel} />
            </gridlayout>
            <BottomSheetInner prop:bottomSheet bind:this={bottomSheetInner} item={$selectedItem} updating={itemLoading} bind:navigationInstructions bind:steps />
            <!-- <collectionview
                items={currentClickedFeatures}
                height={80}
                margin="80 20 0 20"
                verticalAlignment="top"
                borderRadius={16}
                backgroundColor="#00000055"
                visibility={currentClickedFeatures && currentClickedFeatures.length > 0 ? 'visible' : 'collapse'}
            >
                <Template let:item>
                    <label padding="0 20 0 20" text={JSON.stringify(item)} verticalAlignment="middle" fontSize={11} color="white" />
                </Template>
            </collectionview> -->
        </bottomsheet>

        <absolutelayout backgroundColor={colorBackground} height={$navigationBarHeight} verticalAlignment="bottom" width="100%" />
    </gridlayout>
</page>
