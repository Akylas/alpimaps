<script lang="ts">
    import { AppURL, handleOpenURL } from '@nativescript-community/appurl';
    import * as EInfo from '@nativescript-community/extendedinfo';
    import * as perms from '@nativescript-community/perms';
    import { CartoMapStyle, ClickType, GenericMapPos, MapBounds, toNativeScreenPos } from '@nativescript-community/ui-carto/core';
    import type { MapPos } from '@nativescript-community/ui-carto/core';
    import { PersistentCacheTileDataSource } from '@nativescript-community/ui-carto/datasources/cache';
    import { LocalVectorDataSource } from '@nativescript-community/ui-carto/datasources/vector';
    import { Layer } from '@nativescript-community/ui-carto/layers';
    import {
        BaseVectorTileLayer,
        CartoOnlineVectorTileLayer,
        VectorLayer,
        VectorTileLayer,
        VectorTileRenderOrder
    } from '@nativescript-community/ui-carto/layers/vector';
    import type { VectorElementEventData, VectorTileEventData } from '@nativescript-community/ui-carto/layers/vector';
    import { Projection } from '@nativescript-community/ui-carto/projections';
    import { CartoMap, PanningMode, RenderProjectionMode } from '@nativescript-community/ui-carto/ui';
    import { setShowDebug, setShowError, setShowInfo, setShowWarn } from '@nativescript-community/ui-carto/utils';
    import { Line } from '@nativescript-community/ui-carto/vectorelements/line';
    import { Marker, MarkerStyleBuilder } from '@nativescript-community/ui-carto/vectorelements/marker';
    import type { MarkerStyleBuilderOptions } from '@nativescript-community/ui-carto/vectorelements/marker';
    import { Point } from '@nativescript-community/ui-carto/vectorelements/point';
    import { Text, TextStyleBuilder } from '@nativescript-community/ui-carto/vectorelements/text';
    import type { TextStyleBuilderOptions } from '@nativescript-community/ui-carto/vectorelements/text';
    import { MBVectorTileDecoder } from '@nativescript-community/ui-carto/vectortiles';
    import type { RasterTileClickInfo } from '@nativescript-community/ui-carto/layers/raster';
    import { Drawer } from '@nativescript-community/ui-drawer';
    import { action, alert, login } from '@nativescript-community/ui-material-dialogs';
    import { TextField } from '@nativescript-community/ui-material-textfield';
    import { Brightness } from '@nativescript/brightness';
    import { AndroidApplication, Application, Color, Utils, Page } from '@nativescript/core';
    import * as appSettings from '@nativescript/core/application-settings';
    import type { AndroidActivityBackPressedEventData } from '@nativescript/core/application/application-interfaces';
    import { Folder, knownFolders, path } from '@nativescript/core/file-system';
    import { Device, Screen } from '@nativescript/core/platform';
    import { ad } from '@nativescript/core/utils/utils';
    import { compose } from '@nativescript/email';
    import { allowSleepAgain, keepAwake } from '@nativescript-community/insomnia';
    import * as SocialShare from 'nativescript-social-share';
    import { debounce } from 'push-it-to-the-limit';
    import { onDestroy, onMount } from 'svelte';
    import { NativeViewElementNode } from 'svelte-native/dom';
    import { GeoHandler } from '~/handlers/GeoHandler';
    import { l, lc, lt, onLanguageChanged } from '~/helpers/locale';
    import watcher from '~/helpers/watcher';
    import type { SourceItem } from '~/mapModules/CustomLayersModule';
    import CustomLayersModule from '~/mapModules/CustomLayersModule';
    import ItemsModule from '~/mapModules/ItemsModule';
    import type { LayerType } from '~/mapModules/MapModule';
    import { getMapContext, setMapContext } from '~/mapModules/MapModule';
    import UserLocationModule from '~/mapModules/UserLocationModule';
    import type { IItem } from '~/models/Item';
    import { NotificationHelper, NOTIFICATION_CHANEL_ID_KEEP_AWAKE_CHANNEL } from '~/services/android/NotifcationHelper';
    import { onServiceLoaded, onServiceUnloaded } from '~/services/BgService.common';
    import { packageService } from '~/services/PackageService';
    import mapStore from '~/stores/mapStore';
    import { showError } from '~/utils/error';
    import { computeDistanceBetween } from '~/utils/geo';
    import { Sentry } from '~/utils/sentry';
    import { accentColor, screenHeightDips, screenWidthDips } from '~/variables';
    import { navigationBarHeight, primaryColor } from '../variables';
    import { isBottomSheetOpened, showBottomSheet } from './bottomsheet';
    import BottomSheetInner from './BottomSheetInner.svelte';
    import DirectionsPanel from './DirectionsPanel.svelte';
    import LocationInfoPanel from './LocationInfoPanel.svelte';
    import MapScrollingWidgets from './MapScrollingWidgets.svelte';
    import Search from './Search.svelte';
    import { GenericGeoLocation, GeoLocation } from '@nativescript-community/gps';
    import { Template } from 'svelte-native/components';
    import { isModalOpened, showModal } from 'svelte-native';
    import { isSensorAvailable } from '@nativescript-community/sensors';
    // import { asSvelteTransition } from 'svelte-native/transitions';
    // import { AnimationCurve } from '@nativescript/core/ui/enums';
    import { NetworkConnectionStateEvent, NetworkConnectionStateEventData, networkService } from '~/services/NetworkService';
    import { sTheme, toggleTheme } from '~/helpers/theme';
    import { RouteInstruction } from '~/models/Route';

    // function slideFromRight(node, { delay = 0, duration = 200, easing = AnimationCurve.easeOut }) {
    //     const scaleX = node.nativeView.scaleX;
    //     const scaleY = node.nativeView.scaleY;
    //     return asSvelteTransition(node, delay, duration, easing, (t) => ({
    //         scale: {
    //             x: t * scaleX,
    //             y: t * scaleY
    //         }
    //     }));
    // }

    const KEEP_AWAKE_NOTIFICATION_ID = 23466578;
    const mailRegexp = /(?:[a-z0-9!#$%&'*+/=?^_`{|}~-]+(?:\.[a-z0-9!#$%&'*+/=?^_`{|}~-]+)*|"(?:[\x01-\x08\x0b\x0c\x0e-\x1f\x21\x23-\x5b\x5d-\x7f]|\\[\x01-\x09\x0b\x0c\x0e-\x7f])*")@(?:(?:[a-z0-9](?:[a-z0-9-]*[a-z0-9])?\.)+[a-z0-9](?:[a-z0-9-]*[a-z0-9])?|\[(?:(?:25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)\.){3}(?:25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?|[a-z0-9-]*[a-z0-9]:(?:[\x01-\x08\x0b\x0c\x0e-\x1f\x21-\x5a\x53-\x7f]|\\[\x01-\x09\x0b\x0c\x0e-\x7f])+)\])/;

    const LAYERS_ORDER: LayerType[] = [
        'map',
        'customLayers',
        'hillshade',
        'selection',
        'items',
        'directions',
        'search',
        'userLocation'
    ];
    const KEEP_AWAKE_KEY = 'keepAwake';
    let defaultLiveSync = global.__onLiveSync;

    const brightness = new Brightness();
    function base64Encode(value) {
        if (global.isIOS) {
            const text = NSString.stringWithString(value);
            const data = text.dataUsingEncoding(NSUTF8StringEncoding);
            return data.base64EncodedStringWithOptions(0);
        }
        if (global.isAndroid) {
            const text = new java.lang.String(value);
            const data = text.getBytes('UTF-8');
            return android.util.Base64.encodeToString(data, android.util.Base64.DEFAULT);
        }
    }
    let page: NativeViewElementNode<Page>;
    let cartoMap: CartoMap<LatLonKeys>;
    let directionsPanel: DirectionsPanel;
    let bottomSheetInner: BottomSheetInner;
    let mapScrollingWidgets: MapScrollingWidgets;
    let locationInfoPanel: LocationInfoPanel;
    let drawer: NativeViewElementNode<Drawer>;
    let searchView: Search;
    const mapContext = getMapContext();

    let selectedOSMId: string;
    let selectedPosMarker: Point<LatLonKeys>;
    let selectedItem = watcher<IItem>(null, onSelectedItemChanged);
    let appVersion = EInfo.getVersionNameSync() + '.' + EInfo.getBuildNumberSync();
    let packageServiceEnabled = __CARTO_PACKAGESERVICE__;
    let licenseRegistered: boolean = false;
    let darkMode = false;
    // $: {
    //     darkMode = currentLayerStyle === 'positron';
    //     setMapStyle(darkMode ? 'positron' : 'voyager');
    // }
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
    let keepAwakeEnabled = appSettings.getBoolean(KEEP_AWAKE_KEY, false);
    let currentMapRotation = 0;
    let shouldShowNavigationBarOverlay = false;
    let steps;
    let topTranslationY;
    let networkConnected = false;
    let navigationInstructions: {
        remainingDistance: number;
        remainingTime: number;
        instruction: RouteInstruction;
    };

    let ignoreNextMapClick = false;
    let handleSelectedRouteTimer: NodeJS.Timeout;
    let selectedRoutes: { featurePosition; featureData; layer: BaseVectorTileLayer<any, any> }[];
    let didIgnoreAlreadySelected = false;
    let clickedFeatures = [];

    let showClickedFeatures = false;
    let currentClickedFeatures: any[];
    let selectedClickMarker: Text<LatLonKeys>;

    const bottomSheetPanGestureOptions = { failOffsetXEnd: 20, minDist: 40 };

    $: {
        if (steps) {
            // ensure bottomSheetStepIndex is not out of range when
            // steps changes
            bottomSheetStepIndex = Math.min(steps.length - 1, bottomSheetStepIndex);
        }
    }

    $: {
        if (showClickedFeatures === false) {
            currentClickedFeatures = null;
            if (selectedClickMarker) {
                selectedClickMarker.visible = false;
            }
        }
    }

    handleOpenURL(onAppUrl);
    function onAppUrl(appURL: AppURL, args) {
        if (global.isAndroid) {
            const activity = Application.android.startActivity;
            const visible = activity && activity.getWindow().getDecorView().getRootView().isShown();
            if (!visible) {
                if (args && args.eventName === AndroidApplication.activityStartedEvent) {
                    //ignoring newIntent in background as we already received start activity event with intent
                    return;
                } else {
                }
            }
        }
        try {
            handleReceivedAppUrl(appURL);
        } catch (err) {
            console.log(err);
        }
    }
    function handleReceivedAppUrl(appURL: AppURL) {
        if (DEV_LOG) {
            console.log('Got the following appURL', appURL.path, Array.from(appURL.params.entries()));
        }
        if (appURL.path.startsWith('eo')) {
            const latlong = appURL.path.split(':')[1].split(',').map(parseFloat) as [number, number];
            const loaded = !!cartoMap;
            if (latlong[0] !== 0 || latlong[1] !== 0) {
                if (loaded) {
                    cartoMap.setFocusPos({ lat: latlong[0], lon: latlong[1] }, 0);
                } else {
                    // happens before map ready
                    appSettings.setString('mapFocusPos', `{"lat":${latlong[0]},"lon":${latlong[1]}}`);
                }
            }
            if (appURL.params.has('z')) {
                const zoom = parseFloat(appURL.params.get('z'));
                if (loaded) {
                    cartoMap.setZoom(zoom, 0);
                } else {
                    appSettings.setNumber('mapZoom', zoom);
                }
            }
            if (appURL.params.has('q')) {
                const geoTextRegexp = /([\d\.-]+),([\d\.-]+)\((.*?)\)/;
                const query = appURL.params.get('q');
                const match = query.match(geoTextRegexp);
                const actualQuery = decodeURIComponent(query).replace(/[+]/g, ' ');
                if (match) {
                    selectItem({
                        item: {
                            properties: {
                                name: actualQuery
                            },
                            position: {
                                lat: parseFloat(match[1]),
                                lon: parseFloat(match[2])
                            }
                        },
                        isFeatureInteresting: true
                    });
                } else {
                    searchView.searchForQuery(actualQuery);
                }
            }
        } else if (appURL.path && appURL.path.endsWith('.gpx')) {
            console.log('importing GPX', appURL.path);
        }
    }
    async function onNetworkChange(event: NetworkConnectionStateEventData) {
        networkConnected = event.data.connected;
    }
    onMount(() => {
        networkService.on(NetworkConnectionStateEvent, onNetworkChange);
        networkConnected = networkService.connected;
        if (global.isAndroid) {
            Application.android.on(AndroidApplication.activityBackPressedEvent, onAndroidBackButton);
        }
        setMapContext({
            drawer: drawer.nativeView,
            getMap: () => cartoMap,
            getMainPage: () => page,
            getProjection: () => projection,
            getCurrentLanguage: () => currentLanguage,
            getSelectedItem: () => $selectedItem,
            vectorElementClicked: onVectorElementClicked,
            vectorTileClicked: onVectorTileClicked,
            rasterTileClicked: onRasterTileClicked,
            getVectorTileDecoder,
            selectItem,
            unselectItem,
            addLayer,
            insertLayer,
            getLayerIndex,
            getLayerTypeFirstIndex,
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
                drawer.nativeView.toggle(side as any);
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

        if (DEV_LOG) {
            defaultLiveSync = global.__onLiveSync.bind(global);
            global.__onLiveSync = (...args) => {
                // console.log('__onLiveSync', args);
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
    function onAndroidBackButton(data: AndroidActivityBackPressedEventData) {
        if (isModalOpened() || isBottomSheetOpened()) {
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
        setMapStyle(currentLayerStyle, true);
    }

    function getOrCreateLocalVectorLayer() {
        if (!localVectorLayer) {
            localVectorDataSource = new LocalVectorDataSource({ projection });

            localVectorLayer = new VectorLayer({ dataSource: localVectorDataSource });
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
        appSettings.setString('mapFocusPos', JSON.stringify(cartoMap.focusPos));
    }, 100);

    async function onMainMapReady(e) {
        cartoMap = e.object as CartoMap<LatLonKeys>;
        // CartoMap.setRunOnMainThread(false);
        if (DEV_LOG) {
            setShowDebug(DEV_LOG);
            setShowInfo(DEV_LOG);
            setShowWarn(DEV_LOG);
            setShowError(true);
        }
        projection = cartoMap.projection;
        // if (global.isAndroid) {
        //     console.log('onMapReady', com.carto.ui.BaseMapView.getSDKVersion());
        // } else {
        //     console.log('onMapReady', cartoMap.nativeViewProtected as NTMapView);
        // }

        const options = cartoMap.getOptions();
        options.setWatermarkScale(0);
        options.setRestrictedPanning(true);
        options.setPanningMode(PanningMode.PANNING_MODE_STICKY_FINAL);
        // options.setSeamlessPanning(true);
        // options.setEnvelopeThreadPoolSize(2);
        // options.setTileThreadPoolSize(2);
        options.setZoomGestures(true);
        options.setKineticRotation(false);
        // options.setRotatable(true);
        const pos = JSON.parse(appSettings.getString('mapFocusPos', '{"lat":45.2002,"lon":5.7222}')) as MapPos<LatLonKeys>;
        const zoom = appSettings.getNumber('mapZoom', 10);
        cartoMap.setFocusPos(pos, 0);
        cartoMap.setZoom(zoom, 0);
        try {
            const status = await perms.request('storage');
            if (__CARTO_PACKAGESERVICE__) {
                packageService.start();
            }
            setMapStyle(appSettings.getString('mapStyle', 'osm.zip~voyager'), true);
        } catch (err) {
            showError(err);
        }

        setTimeout(() => {
            mapContext.runOnModules('onMapReady', cartoMap);
        }, 100);
    }

    function onMainMapMove(e) {
        if (!cartoMap) {
            return;
        }
        const bearing = cartoMap.bearing;
        currentMapRotation = Math.round(bearing * 100) / 100;
        // console.log('onMapMove');
        // const bearing = cartoMap.bearing;
        // console.log('onMapMove', bearing);
        // currentMapRotation = Math.round(bearing * 100) / 100;
        mapContext.runOnModules('onMapMove', e);
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
        saveSettings();
        mapContext.runOnModules('onMapStable', e);
    }

    function onMainMapClicked(e) {
        const { clickType, position } = e.data;
        handleClickedFeatures(position);
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
            selectItem({ item: { position, properties: {} }, isFeatureInteresting: !$selectedItem });
        }
        unFocusSearch();
    }

    // function createLocalMarker(position: MapPos<LatLonKeys>, options: MarkerStyleBuilderOptions) {
    //     getOrCreateLocalVectorLayer();
    //     const styleBuilder = new MarkerStyleBuilder(options);
    //     return new Marker<LatLonKeys>({ position, projection, styleBuilder });
    // }
    function onSelectedItemChanged(oldValue: IItem, value: IItem) {
        mapContext.runOnModules('onSelectedItem', value, oldValue);
    }
    function selectItem({
        item,
        isFeatureInteresting = false,
        peek = true,
        setSelected = true,
        showButtons = false,
        preventZoom = false,
        position,
        minZoom,
        zoom,
        zoomDuration
    }: {
        item: IItem;
        showButtons?: boolean;
        position?: GenericMapPos<LatLonKeys>;
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
            let isCurrentItem = item !== $selectedItem;
            if (setSelected && isCurrentItem) {
                unselectItem(false);
            }
            if (item.route) {
                const vectorElement = item.vectorElement as Line;
                if (vectorElement) {
                    const color = new Color(vectorElement.color as string);
                    vectorElement.color = color.darken(10);
                    vectorElement.width += 2;
                } else if (item.route.osmid) {
                    selectedOSMId = item.route.osmid + '';
                    // console.log('selectedOSMId', selectedOSMId)
                    setStyleParameter('selected_id', selectedOSMId);
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
                }

                if (selectedPosMarker) {
                    selectedPosMarker.visible = false;
                }
            } else {
                if (!selectedPosMarker) {
                    getOrCreateLocalVectorLayer();
                    const itemModule = mapContext.mapModule('items');
                    selectedPosMarker = itemModule.createLocalPoint(item.position, {
                        // color: '#55ff0000',
                        color: primaryColor.setAlpha(178),
                        clickSize: 0,
                        scaleWithDPI: true,
                        size: 30
                        // orientationMode: BillboardOrientation.GROUND,
                        // scalingMode: BillboardScaling.SCREEN_SIZE
                    });
                    localVectorDataSource.add(selectedPosMarker);
                } else {
                    selectedPosMarker.position = item.position;
                    selectedPosMarker.visible = true;
                }
                if (selectedOSMId) {
                    selectedOSMId = null;
                    setStyleParameter('selected_id', '0');
                }
            }
            // item.route = {
            //     instructions: Array.from({length: 40}, () => ({
            //         position: null,
            //         action: "left",
            //         azimuth: 0,
            //         distance: 0,
            //         time: 0,
            //         turnAngle: 0,
            //         streetName: 'toto'
            //     }))
            // } as any
            if (setSelected) {
                $selectedItem = item;
            }
            if (setSelected && !item.route) {
                const service = packageService.localOSMOfflineReverseGeocodingService;
                if (service) {
                    itemLoading = true;
                    const radius = 100;
                    // use a promise not to "wait" for it
                    packageService
                        .searchInGeocodingService(service, {
                            projection,
                            location: item.position,
                            searchRadius: radius
                        })
                        .then((res) => {
                            if (res) {
                                for (let index = 0; index < res.size(); index++) {
                                    const r = packageService.convertGeoCodingResult(res.get(index));
                                    if (computeDistanceBetween(item.position, r.position) <= radius && r.rank > 0.7) {
                                        if ($selectedItem.position === item.position) {
                                            $selectedItem = packageService.prepareGeoCodingResult(
                                                {
                                                    address: r.address as any,
                                                    ...$selectedItem
                                                },
                                                r.rank < 0.9
                                            );
                                        }
                                        break;
                                    }
                                }
                            }
                        })
                        .catch((err) => console.error('searchInGeocodingService', err, err['stack']));
                }
                if (item.properties && 'ele' in item.properties === false && packageService.hasElevation()) {
                    packageService.getElevation(item.position).then((result) => {
                        if ($selectedItem.position === item.position) {
                            $selectedItem.properties = $selectedItem.properties || {};
                            $selectedItem.properties['ele'] = result;
                            $selectedItem = { ...$selectedItem };
                        }
                    });
                }
            }

            // console.log('selectedItem', item);
            // const vectorTileDecoder = getVectorTileDecoder();
            // vectorTileDecoder.setStyleParameter('selected_id', ((item.properties && item.properties.osm_id) || '') + '');
            // vectorTileDecoder.setStyleParameter('selected_name', (item.properties && item.properties.name) || '');
            if (peek) {
                bottomSheetInner.loadView().then(() => {
                    bottomSheetStepIndex = Math.max(showButtons ? 2 : 1, bottomSheetStepIndex);
                });
            }
            if (preventZoom) {
                return;
            }
            zoomToItem({ item, zoom, minZoom, duration: zoomDuration });
        } else {
            unselectItem();
        }
    }
    export function zoomToItem({
        item,
        zoom,
        minZoom,
        duration = 200
    }: {
        item: IItem;
        zoom?: number;
        minZoom?: number;
        duration?;
    }) {
        if (item.zoomBounds) {
            // const zoomLevel = getBoundsZoomLevel(item.zoomBounds, {
            //     width: Screen.mainScreen.widthPixels,
            //     height: Screen.mainScreen.heightPixels
            // });
            cartoMap.moveToFitBounds(item.zoomBounds, undefined, true, true, false, duration);
            // cartoMap.setZoom(zoomLevel, 200);
            // cartoMap.setFocusPos(getCenter(item.zoomBounds.northeast, item.zoomBounds.southwest), 200);
        } else if (item.properties && item.properties.extent) {
            let extent: [number, number, number, number] = item.properties.extent as any;
            if (typeof extent === 'string') {
                extent = JSON.parse(`[${extent}]`);
            }
            cartoMap.moveToFitBounds(
                new MapBounds({ lat: extent[1], lon: extent[0] }, { lat: extent[3], lon: extent[2] }),
                undefined,
                true,
                true,
                false,
                200
            );
        } else {
            if (zoom) {
                cartoMap.setZoom(zoom, duration);
            } else if (minZoom) {
                cartoMap.setZoom(Math.max(minZoom, cartoMap.zoom), duration);
            }
            cartoMap.setFocusPos(item.position, duration);
        }
    }
    export function unselectItem(updateBottomSheet = true) {
        if (!!$selectedItem) {
            const item = $selectedItem;
            $selectedItem = null;
            if (selectedPosMarker) {
                selectedPosMarker.visible = false;
            }
            if (selectedOSMId) {
                selectedOSMId = null;
                setStyleParameter('selected_id', '0');
            }
            if (item.route) {
                const vectorElement = item.vectorElement as Line;
                if (vectorElement) {
                    vectorElement.color = new Color(vectorElement.color as string).lighten(10);
                    vectorElement.width -= 2;
                }
            }
            if (updateBottomSheet) {
                bottomSheetStepIndex = 0;
            }
        }
    }

    $: setRenderProjectionMode($mapStore.showGlobe);
    $: vectorTileDecoder && setStyleParameter('buildings', !!$mapStore.show3DBuildings ? '2' : '1');
    $: vectorTileDecoder && setStyleParameter('contours', $mapStore.showContourLines ? '1' : '0');
    $: vectorTileDecoder && setStyleParameter('routes', $mapStore.showRoutes ? '1' : '0');
    $: vectorTileDecoder && setStyleParameter('contoursOpacity', $mapStore.contourLinesOpacity.toFixed(1));
    $: vectorTileDecoder && toggleHillshadeSlope($mapStore.showSlopePercentages);
    $: currentLayer && (currentLayer.zoomLevelBias = parseFloat($mapStore.zoomBiais));
    $: currentLayer && (currentLayer.preloading = $mapStore.preloading);
    $: shouldShowNavigationBarOverlay = global.isAndroid && navigationBarHeight !== 0 && !!selectedItem;
    $: bottomSheetStepIndex === 0 && unselectItem();
    $: {
        if (cartoMap) {
            cartoMap
                .getOptions()
                .setFocusPointOffset(
                    toNativeScreenPos({ x: 0, y: Utils.layout.toDevicePixels(steps[bottomSheetStepIndex]) / 2 })
                );
        }
    }
    $: {
        appSettings.setBoolean(KEEP_AWAKE_KEY, keepAwakeEnabled);
        if (keepAwakeEnabled) {
            showKeepAwakeNotification();
        } else {
            hideKeepAwakeNotification();
        }
    }
    function toggleHillshadeSlope(value: boolean) {
        if (mapContext) {
            mapContext.mapModule('customLayers').toggleHillshadeSlope(value);
            // cartoMap.redraw();
        }
    }

    function cancelDirections() {
        directionsPanel.cancel();
    }

    async function handleRouteSelection(featureData, layer: VectorTileLayer) {
        const item: IItem = {
            properties: featureData,

            route: {
                osmid: featureData.osmid,
                layer
            } as any
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
                        view: RouteSelect,
                        props: {
                            title: l('pick_route'),
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
        // console.log('handleClickedFeatures', clickedFeatures);
        let fakeIndex = 0;
        currentClickedFeatures = [...new Map(clickedFeatures.map((item) => [JSON.stringify(item), item])).values()];
        // if (currentClickedFeatures.length > 0) {
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
        // console.log('handleClickedFeatures', currentClickedFeatures);
        // }
        clickedFeatures = [];
    }

    function onRasterTileClicked(data: RasterTileClickInfo<LatLonKeys>) {
        const { clickType, position, nearestColor, layer } = data;
        console.log('onRasterTileClicked', position, nearestColor);
    }
    function onVectorTileClicked(data: VectorTileEventData<LatLonKeys>) {
        const { clickType, position, featureLayerName, featureData, featurePosition, layer } = data;
        // if (DEV_LOG) {
            console.log(
                'onVectorTileClicked',
                featureLayerName,
                featureData.class,
                featureData.subclass,
                featureData,
                featurePosition
            );
        // }

        const handledByModules = mapContext.runOnModules('onVectorTileClicked', data);
        if (!handledByModules && clickType === ClickType.SINGLE) {
            if (showClickedFeatures) {
                clickedFeatures.push({
                    featurePosition,
                    layer: featureLayerName,
                    data: featureData
                });
            }

            if (
                featureLayerName === 'transportation' ||
                featureLayerName === 'transportation_name' ||
                featureLayerName === 'waterway' ||
                // featureLayerName === 'place' ||
                featureLayerName === 'contour' ||
                featureLayerName === 'hillshade' ||
                ((featureLayerName === 'building' ||
                    featureLayerName === 'park' ||
                    featureLayerName === 'landcover' ||
                    featureLayerName === 'landuse') &&
                    !featureData.name)
            ) {
                return false;
            }
            if (
                !!$selectedItem &&
                (didIgnoreAlreadySelected ||
                    (featureData.osmid && featureData.osmid === $selectedItem.properties.osmid) ||
                    ($selectedItem.properties &&
                        featureData.name === $selectedItem.properties.name &&
                        $selectedItem.position.lat === featurePosition.lat &&
                        $selectedItem.position.lon === featurePosition.lon))
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
                !!featureData.name ||
                featureLayerName === 'poi' ||
                featureLayerName === 'mountain_peak' ||
                featureLayerName === 'housenumber';
            if (isFeatureInteresting) {
                ignoreNextMapClick = false;
                selectedRoutes = null;
                if (handleSelectedRouteTimer) {
                    clearTimeout(handleSelectedRouteTimer);
                    handleSelectedRouteTimer = null;
                }
                const result: IItem = {
                    properties: featureData,
                    position: isFeatureInteresting ? featurePosition : position
                };
                selectItem({ item: result, isFeatureInteresting });
            }
            unFocusSearch();
            if (isFeatureInteresting && showClickedFeatures) {
                didIgnoreAlreadySelected = true;
                return false;
            }
            // return true to only look at first vector found
            return isFeatureInteresting;
        }
        return handledByModules;
    }
    function onVectorElementClicked(data: VectorElementEventData<LatLonKeys>) {
        const { clickType, position, elementPos, metaData, element } = data;
        if (DEV_LOG) {
            console.log('onVectorElementClicked', clickType, position);
        }
        Object.keys(metaData).forEach((k) => {
            metaData[k] = JSON.parse(metaData[k]);
        });
        const handledByModules = mapContext.runOnModules('onVectorElementClicked', data);
        if (DEV_LOG) {
            console.log('handledByModules', handledByModules);
        }
        if (!handledByModules && clickType === ClickType.SINGLE && Object.keys(metaData).length > 0) {
            const item: IItem = { position, vectorElement: element, ...metaData };
            // }
            if (item.id && $selectedItem && $selectedItem.id === item.id) {
                return true;
            }
            if (item.route) {
                item.route.positions = (element as Line<LatLonKeys>).getPoses() as any;
            }
            selectItem({ item, isFeatureInteresting: true, position });
            unFocusSearch();
            return true;
        }
        return handledByModules;
    }
    function unFocusSearch() {
        if (searchView && searchView.hasFocus()) {
            searchView.unfocus();
        }
    }

    function setRenderProjectionMode(showGlobe) {
        cartoMap &&
            cartoMap
                .getOptions()
                .setRenderProjectionMode(
                    showGlobe
                        ? RenderProjectionMode.RENDER_PROJECTION_MODE_SPHERICAL
                        : RenderProjectionMode.RENDER_PROJECTION_MODE_PLANAR
                );
    }

    function setStyleParameter(key: string, value: string) {
        // console.log('setStyleParameter', key, value);
        const decoder = getVectorTileDecoder();
        if (decoder) {
            decoder.setStyleParameter(key, value);
        }
    }

    function setCurrentLayer(id: string) {
        // console.log('setCurrentLayer', id, $mapStore.zoomBiais, $mapStore.preloading);
        // const cartoMap = cartoMap;
        if (currentLayer) {
            removeLayer(currentLayer, 'map');
            currentLayer.setVectorTileEventListener(null);
            currentLayer = null;
        }
        currentLayerStyle = id;
        const decoder = getVectorTileDecoder();

        currentLayer = new VectorTileLayer({
            preloading: $mapStore.preloading,
            zoomLevelBias: parseFloat($mapStore.zoomBiais),
            dataSource: packageService.getDataSource($mapStore.showContourLines),
            decoder
        });
        handleNewLanguage(currentLanguage);
        // console.log('currentLayer', !!currentLayer);
        currentLayer.setLabelRenderOrder(VectorTileRenderOrder.LAST);
        currentLayer.setVectorTileEventListener<LatLonKeys>(
            {
                onVectorTileClicked: (data) => onVectorTileClicked(data)
            },
            projection
        );
        try {
            addLayer(currentLayer, 'map');
        } catch (err) {
            showError(err);
            vectorTileDecoder = null;
        }
    }
    function handleNewLanguage(newLang) {
        currentLanguage = newLang;
        packageService.currentLanguage = newLang;
        setStyleParameter('lang', newLang);
        setStyleParameter('fallback_lang', 'latin');
    }
    onLanguageChanged(handleNewLanguage);

    function getVectorTileDecoder() {
        return vectorTileDecoder || packageService.getVectorTileDecoder();
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
        let mapStyleLayer = 'voyager';
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
            } else {
                try {
                    vectorTileDecoder = new MBVectorTileDecoder({
                        style: mapStyleLayer,
                        liveReload: TNS_ENV !== 'production',
                        ...(mapStyle.endsWith('.zip')
                            ? { zipPath: `~/assets/styles/${mapStyle}` }
                            : { dirPath: `~/assets/styles/${mapStyle}` })
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
        const entities = await Folder.fromPath(path.join(knownFolders.currentApp().path, 'assets', 'styles')).getEntities();
        for (let index = 0; index < entities.length; index++) {
            const e = entities[index];
            if (Folder.exists(e.path)) {
                const subs = await Folder.fromPath(e.path).getEntities();
                styles.push(
                    ...subs
                        .filter((s) => s.name.endsWith('.json') || s.name.endsWith('.xml'))
                        .map((s) => e.name + '~' + s.name.split('.')[0])
                );
            } else {
                styles.push(e.name);
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
        const PackagesDownloadComponent = (await import('./PackagesDownloadComponent.svelte')).default;
        showBottomSheet({ parent: page, view: PackagesDownloadComponent });
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
    function getLayerTypeFirstIndex(layerId: LayerType) {
        const layerIndex = LAYERS_ORDER.indexOf(layerId);
        return addedLayers.findIndex((d) => LAYERS_ORDER.indexOf(d.layerId) >= layerIndex);
    }
    function addLayer(layer: Layer<any, any>, layerId: LayerType) {
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
            cartoMap.requestRedraw();
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
    //     const result = mBottomSheetTranslation + navigationBarHeight;
    //     return result;
    // }
    let scrollingWidgetsOpacity = 1;
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
        const maptranslation = -(maxTranslation - translation);
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
                translateY: maptranslation,
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

    let lastBrightness;
    function showKeepAwakeNotification() {
        lastBrightness = brightness.get();
        brightness.set({
            intensity: 100
        });
        if (global.isAndroid) {
            const Intent = android.content.Intent;
            const NotificationCompat = androidx.core.app.NotificationCompat;
            const context: android.content.Context = ad.getApplicationContext();
            const builder = new NotificationCompat.Builder(context, NOTIFICATION_CHANEL_ID_KEEP_AWAKE_CHANNEL);
            // create notification channel
            const color = accentColor.android;
            NotificationHelper.createNotificationChannel(context);

            const activityClass = (com as any).tns.NativeScriptActivity.class;
            const tapActionIntent = new Intent(context, activityClass);
            tapActionIntent.setAction(Intent.ACTION_MAIN);
            tapActionIntent.addCategory(Intent.CATEGORY_LAUNCHER);
            const tapActionPendingIntent = android.app.PendingIntent.getActivity(context, 10, tapActionIntent, 0);

            // construct notification in builder
            builder.setVisibility(NotificationCompat.VISIBILITY_SECRET);
            builder.setShowWhen(false);
            builder.setOngoing(true);
            builder.setColor(color);
            builder.setOnlyAlertOnce(true);
            builder.setPriority(NotificationCompat.PRIORITY_MIN);
            builder.setContentIntent(tapActionPendingIntent);
            builder.setSmallIcon(ad.resources.getDrawableId('ic_stat_logo'));
            builder.setContentTitle('Alpi Maps is keeping the screen awake');
            // builder.setLargeIcon();
            const notifiction = builder.build();
            const service = context.getSystemService(
                android.content.Context.NOTIFICATION_SERVICE
            ) as android.app.NotificationManager;
            service.notify(KEEP_AWAKE_NOTIFICATION_ID, notifiction);
        }
    }

    function hideKeepAwakeNotification() {
        brightness.set({
            intensity: lastBrightness
        });
        if (global.isAndroid) {
            const context: android.content.Context = ad.getApplicationContext();
            const service = context.getSystemService(
                android.content.Context.NOTIFICATION_SERVICE
            ) as android.app.NotificationManager;
            service.cancel(KEEP_AWAKE_NOTIFICATION_ID);
        }
    }

    async function switchKeepAwake() {
        console.log('switchKeepAwake');
        try {
            if (keepAwakeEnabled) {
                await allowSleepAgain();
                keepAwakeEnabled = false;
            } else {
                await keepAwake();
                keepAwakeEnabled = true;
            }
        } catch (err) {
            showError(err);
        }
    }

    function switchLocationInfo() {
        locationInfoPanel.switchLocationInfo();
    }

    function shareScreenshot() {
        cartoMap.captureRendering(true).then((result) => {
            SocialShare.shareImage(result as any);
        });
    }
    function onTap(command: string) {
        switch (command) {
            case 'sendFeedback':
                compose({
                    subject: `[${EInfo.getAppNameSync()}(${appVersion})] Feedback`,
                    to: ['martin@akylas.fr'],
                    attachments: [
                        {
                            fileName: 'report.json',
                            path: `base64://${base64Encode(
                                JSON.stringify(
                                    {
                                        device: {
                                            model: Device.model,
                                            DeviceType: Device.deviceType,
                                            language: Device.language,
                                            manufacturer: Device.manufacturer,
                                            os: Device.os,
                                            osVersion: Device.osVersion,
                                            region: Device.region,
                                            sdkVersion: Device.sdkVersion,
                                            uuid: Device.uuid
                                        },
                                        screen: {
                                            widthDIPs: screenWidthDips,
                                            heightDIPs: screenHeightDips,
                                            widthPixels: Screen.mainScreen.widthPixels,
                                            heightPixels: Screen.mainScreen.heightPixels,
                                            scale: Screen.mainScreen.scale
                                        }
                                    },
                                    null,
                                    4
                                )
                            )}`,
                            mimeType: 'application/json'
                        }
                    ]
                }).catch((err) => showError(err));
                break;
            case 'sendBugReport':
                login({
                    title: lc('send_bug_report'),
                    message: lc('send_bug_report_desc'),
                    okButtonText: l('send'),
                    cancelButtonText: l('cancel'),
                    autoFocus: true,
                    usernameTextFieldProperties: {
                        marginLeft: 10,
                        marginRight: 10,
                        autocapitalizationType: 'none',
                        keyboardType: 'email',
                        autocorrect: false,
                        error: lc('email_required'),
                        hint: lc('email')
                    },
                    passwordTextFieldProperties: {
                        marginLeft: 10,
                        marginRight: 10,
                        error: lc('please_describe_error'),
                        secure: false,
                        hint: lc('description')
                    },
                    beforeShow: (options, usernameTextField: TextField, passwordTextField: TextField) => {
                        usernameTextField.on('textChange', (e: any) => {
                            const text = e.value;
                            if (!text) {
                                usernameTextField.error = lc('email_required');
                            } else if (!mailRegexp.test(text)) {
                                usernameTextField.error = lc('non_valid_email');
                            } else {
                                usernameTextField.error = null;
                            }
                        });
                        passwordTextField.on('textChange', (e: any) => {
                            const text = e.value;
                            if (!text) {
                                passwordTextField.error = lc('description_required');
                            } else {
                                passwordTextField.error = null;
                            }
                        });
                    }
                }).then((result) => {
                    if (result.result) {
                        if (!result.userName || !mailRegexp.test(result.userName)) {
                            showError(lc('email_required'));
                            return;
                        }
                        if (!result.password || result.password.length === 0) {
                            showError(lc('description_required'));
                            return;
                        }
                        Sentry.withScope((scope) => {
                            scope.setUser({ email: result.userName });
                            Sentry.captureMessage(result.password);
                            alert(l('bug_report_sent'));
                        });
                    }
                });
                break;
        }
    }

    async function showOptions() {
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
            {
                title: lc('keep_awake'),
                color: keepAwakeEnabled ? 'red' : '#00ff00',
                id: 'keep_awake',
                icon: keepAwakeEnabled ? 'mdi-sleep' : 'mdi-sleep-off'
            },
            {
                title: lc('compass'),
                id: 'compass',
                icon: 'mdi-compass'
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
            },

            {
                title: lc('bug'),
                id: 'bug',
                icon: 'mdi-bug'
            }
        ];

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
        const MapOptions = (await import('./MapOptions.svelte')).default;
        const result = (await showBottomSheet({
            parent: page,
            view: MapOptions,
            props: { options },
            transparent: true,
            disableDimBackground: true
        })) as any;
        if (result) {
            switch (result.id) {
                case 'select_style':
                    selectStyle();
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
                case 'bug':
                    sendBug();
                    break;
                case 'compass':
                    try {
                        const CompassView = (await import('./CompassView.svelte')).default;
                        await showBottomSheet({ parent: page, view: CompassView, transparent: true });
                    } catch (err) {
                        console.error('showCompass', err, err['stack']);
                    }
                    break;
                case 'altimeter':
                    try {
                        const AltimeterView = (await import('./AltimeterView.svelte')).default;
                        await showBottomSheet({ parent: page, view: AltimeterView });
                    } catch (err) {
                        console.error('showAltimeter', err, err['stack']);
                    }
                    break;
                case 'settings':
                    try {
                        const Settings = (await import('~/components/Settings.svelte')).default;
                        showModal({ page: Settings, animated: true, fullscreen: true });
                    } catch (err) {
                        console.error('showSettings', err, err['stack']);
                    }
                    break;
            }
        }
    }

    async function sendBug() {
        login({
            title: lc('send_bug_report'),
            message: lc('send_bug_report_desc'),
            okButtonText: l('send'),
            cancelButtonText: l('cancel'),
            autoFocus: true,
            usernameTextFieldProperties: {
                marginLeft: 10,
                marginRight: 10,
                autocapitalizationType: 'none',
                keyboardType: 'email',
                autocorrect: false,
                error: lc('email_required'),
                hint: lc('email')
            },
            passwordTextFieldProperties: {
                marginLeft: 10,
                marginRight: 10,
                error: lc('please_describe_error'),
                secure: false,
                hint: lc('description')
            },
            beforeShow: (options, usernameTextField: TextField, passwordTextField: TextField) => {
                usernameTextField.on('textChange', (e: any) => {
                    const text = e.value;
                    if (!text) {
                        usernameTextField.error = lc('email_required');
                    } else if (!mailRegexp.test(text)) {
                        usernameTextField.error = lc('non_valid_email');
                    } else {
                        usernameTextField.error = null;
                    }
                });
                passwordTextField.on('textChange', (e: any) => {
                    const text = e.value;
                    if (!text) {
                        passwordTextField.error = lc('description_required');
                    } else {
                        passwordTextField.error = null;
                    }
                });
            }
        }).then((result) => {
            if (result.result) {
                if (!result.userName || !mailRegexp.test(result.userName)) {
                    showError(new Error(lc('email_required')));
                    return;
                }
                if (!result.password || result.password.length === 0) {
                    showError(new Error(lc('description_required')));
                    return;
                }
                Sentry.withScope((scope) => {
                    scope.setUser({ email: result.userName });
                    Sentry.captureMessage(result.password);
                    alert(l('bug_report_sent'));
                });
            }
        });
    }
</script>

<page bind:this={page} actionBarHidden={true} backgroundColor="#E3E1D3">
    <drawer
        bind:this={drawer}
        translationFunction={drawerTranslationFunction}
        bottomOpenedDrawerAllowDraging={true}
        bottomClosedDrawerAllowDraging={false}
        backgroundColor="#E3E1D3"
    >
        <!-- <LayersMenu prop:bottomDrawer bind:this={layersMenu} /> -->
        <cartomap
            zoom="16"
            on:mapReady={onMainMapReady}
            on:mapMoved={onMainMapMove}
            on:mapStable={onMainMapStable}
            on:mapIdle={onMainMapIdle}
            on:mapClicked={onMainMapClicked}
        />
        <bottomsheet
            android:marginBottom={navigationBarHeight}
            backgroundColor="#01550000"
            panGestureOptions={bottomSheetPanGestureOptions}
            {steps}
            bind:stepIndex={bottomSheetStepIndex}
            translationFunction={bottomSheetTranslationFunction}
        >
            <stacklayout horizontalAlignment="left" verticalAlignment="middle">
                <button
                    variant="text"
                    class="icon-btn"
                    text={keepAwakeEnabled ? 'mdi-sleep' : 'mdi-sleep-off'}
                    color={keepAwakeEnabled ? 'red' : 'gray'}
                    on:tap={switchKeepAwake}
                />

                <button
                    variant="text"
                    class="icon-btn"
                    text="mdi-bullseye"
                    color={$mapStore.showContourLines ? primaryColor : 'gray'}
                    on:tap={() => mapStore.setShowContourLines(!$mapStore.showContourLines)}
                />
                <button
                    variant="text"
                    class="icon-btn"
                    text="mdi-signal"
                    color={$mapStore.showSlopePercentages ? primaryColor : 'gray'}
                    on:tap={() => mapStore.setShowSlopePercentages(!$mapStore.showSlopePercentages)}
                />
                <button
                    variant="text"
                    class="icon-btn"
                    text="mdi-map-marker-path"
                    color={$mapStore.showRoutes ? primaryColor : 'gray'}
                    on:tap={() => mapStore.setShowRoutes(!$mapStore.showRoutes)}
                />
                <button variant="text" class="icon-btn" text="mdi-speedometer" color="gray" on:tap={switchLocationInfo} />

                <button
                    variant="text"
                    class="icon-btn"
                    text="mdi-map-clock"
                    visibility={packageServiceEnabled ? 'visible' : 'collapsed'}
                    color={$mapStore.preloading ? primaryColor : 'gray'}
                    on:tap={() => mapStore.setPreloading(!$mapStore.preloading)}
                />
                <button
                    variant="text"
                    class="icon-btn"
                    text="mdi-information-outline"
                    color={showClickedFeatures ? primaryColor : 'gray'}
                    on:tap={() => (showClickedFeatures = !showClickedFeatures)}
                />
            </stacklayout>
            <Search
                bind:this={searchView}
                verticalAlignment="top"
                defaultElevation={0}
                isUserInteractionEnabled={scrollingWidgetsOpacity > 0.3}
            />
            <LocationInfoPanel
                horizontalAlignment="left"
                verticalAlignment="top"
                marginLeft="20"
                marginTop="90"
                bind:this={locationInfoPanel}
                isUserInteractionEnabled={scrollingWidgetsOpacity > 0.3}
            />
            <canvaslabel
                orientation="vertical"
                verticalAlignment="middle"
                horizontalAlignment="right"
                isUserInteractionEnabled="false"
                color="red"
                fontSize="12"
                width="20"
                height="30"
            >
                <cspan
                    text="mdi-access-point-network-off"
                    visibility={networkConnected ? 'collapsed' : 'visible'}
                    textAlignment="left"
                    verticalTextAlignement="top"
                />
            </canvaslabel>
            <button
                marginTop="80"
                visibility={currentMapRotation !== 0 ? 'visible' : 'collapsed'}
                on:tap={resetBearing}
                class="small-floating-btn"
                text="mdi-navigation"
                rotate={currentMapRotation}
                verticalAlignment="top"
                horizontalAlignment="right"
                translateY={Math.max(topTranslationY - 50, 0)}
            />
            <MapScrollingWidgets
                bind:this={mapScrollingWidgets}
                bind:navigationInstructions
                opacity={scrollingWidgetsOpacity}
                userInteractionEnabled={scrollingWidgetsOpacity > 0.3}
            />
            <DirectionsPanel
                bind:this={directionsPanel}
                bind:translationY={topTranslationY}
                width="100%"
                verticalAlignment="top"
            />
            <BottomSheetInner
                bind:this={bottomSheetInner}
                bind:steps
                bind:navigationInstructions
                prop:bottomSheet
                updating={itemLoading}
                item={$selectedItem}
            />
            <collectionview
                items={currentClickedFeatures}
                height="80"
                margin="80 20 0 20"
                verticalAlignment="top"
                borderRadius="16"
                backgroundColor="#00000055"
                visibility={currentClickedFeatures && currentClickedFeatures.length > 0 ? 'visible' : 'collapsed'}
            >
                <Template let:item>
                    <label
                        padding="0 20 0 20"
                        text={JSON.stringify(item)}
                        verticalAlignment="center"
                        fontSize="11"
                        color="white"
                    />
                </Template>
            </collectionview>
        </bottomsheet>
    </drawer>
</page>
