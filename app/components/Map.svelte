<script lang="ts" context="module">
    import { AppURL, handleOpenURL } from '@nativescript-community/appurl';
    import * as EInfo from '@nativescript-community/extendedinfo';
    import * as perms from '@nativescript-community/perms';
    import { CartoMapStyle, ClickType, MapBounds, MapPos } from '@nativescript-community/ui-carto/core';
    import { PersistentCacheTileDataSource } from '@nativescript-community/ui-carto/datasources/cache';
    import { LocalVectorDataSource } from '@nativescript-community/ui-carto/datasources/vector';
    import { Layer } from '@nativescript-community/ui-carto/layers';
    import {
        CartoOnlineVectorTileLayer,
        VectorElementEventData,
        VectorLayer,
        VectorTileEventData,
        VectorTileLayer,
        VectorTileRenderOrder
    } from '@nativescript-community/ui-carto/layers/vector';
    import { Projection } from '@nativescript-community/ui-carto/projections';
    import { CartoMap, PanningMode, RenderProjectionMode } from '@nativescript-community/ui-carto/ui';
    import { setShowDebug, setShowError, setShowInfo, setShowWarn } from '@nativescript-community/ui-carto/utils';
    import { Line, LineStyleBuilder, LineStyleBuilderOptions } from '@nativescript-community/ui-carto/vectorelements/line';
    import {
        Marker,
        MarkerStyleBuilder,
        MarkerStyleBuilderOptions
    } from '@nativescript-community/ui-carto/vectorelements/marker';
    import { Point, PointStyleBuilder, PointStyleBuilderOptions } from '@nativescript-community/ui-carto/vectorelements/point';
    import { MBVectorTileDecoder } from '@nativescript-community/ui-carto/vectortiles';
    import { Drawer } from '@nativescript-community/ui-drawer';
    import { action, alert, login } from '@nativescript-community/ui-material-dialogs';
    import { TextField } from '@nativescript-community/ui-material-textfield';
    import { Brightness } from '@nativescript/brightness';
    import { AndroidApplication, Application, Color, Page } from '@nativescript/core';
    import * as appSettings from '@nativescript/core/application-settings';
    import { AndroidActivityBackPressedEventData } from '@nativescript/core/application/application-interfaces';
    import { Folder, knownFolders, path } from '@nativescript/core/file-system';
    import { Device, Screen } from '@nativescript/core/platform';
    import { ad } from '@nativescript/core/utils/utils';
    import { compose } from '@nativescript/email';
    import { allowSleepAgain, keepAwake } from 'nativescript-insomnia';
    import * as SocialShare from 'nativescript-social-share';
    import { debounce } from 'push-it-to-the-limit';
    import { onDestroy, onMount } from 'svelte';
    import { NativeViewElementNode } from 'svelte-native/dom';
    import { GeoHandler } from '~/handlers/GeoHandler';
    import { l, lc, lt } from '~/helpers/locale';
    import watcher from '~/helpers/watcher';
    import CustomLayersModule, { SourceItem } from '~/mapModules/CustomLayersModule';
    import ItemsModule from '~/mapModules/ItemsModule';
    import { getMapContext, LayerType, setMapContext } from '~/mapModules/MapModule';
    import UserLocationModule from '~/mapModules/UserLocationModule';
    import { IItem } from '~/models/Item';
    import { NotificationHelper, NOTIFICATION_CHANEL_ID_KEEP_AWAKE_CHANNEL } from '~/services/android/NotifcationHelper';
    import { onServiceLoaded, onServiceUnloaded } from '~/services/BgService.common';
    import { packageService } from '~/services/PackageService';
    import mapStore from '~/stores/mapStore';
    import { showError } from '~/utils/error';
    import { computeDistanceBetween, getBoundsZoomLevel } from '~/utils/geo';
    import { isSentryEnabled, Sentry } from '~/utils/sentry';
    import { accentColor, screenHeightDips, screenWidthDips } from '~/variables';
    import { navigationBarHeight, primaryColor } from '../variables';
    import { showBottomSheet } from './bottomsheet';
    import BottomSheetInner from './BottomSheetInner.svelte';
    import DirectionsPanel from './DirectionsPanel.svelte';
    import LocationInfoPanel from './LocationInfoPanel.svelte';
    import MapRightMenu from './MapRightMenu.svelte';
    import MapScrollingWidgets from './MapScrollingWidgets.svelte';
    import Search from './Search.svelte';
    const KEEP_AWAKE_NOTIFICATION_ID = 23466578;
    const mailRegexp = /(?:[a-z0-9!#$%&'*+/=?^_`{|}~-]+(?:\.[a-z0-9!#$%&'*+/=?^_`{|}~-]+)*|"(?:[\x01-\x08\x0b\x0c\x0e-\x1f\x21\x23-\x5b\x5d-\x7f]|\\[\x01-\x09\x0b\x0c\x0e-\x7f])*")@(?:(?:[a-z0-9](?:[a-z0-9-]*[a-z0-9])?\.)+[a-z0-9](?:[a-z0-9-]*[a-z0-9])?|\[(?:(?:25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)\.){3}(?:25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?|[a-z0-9-]*[a-z0-9]:(?:[\x01-\x08\x0b\x0c\x0e-\x1f\x21-\x5a\x53-\x7f]|\\[\x01-\x09\x0b\x0c\x0e-\x7f])+)\])/;

    const LAYERS_ORDER: LayerType[] = ['map', 'customLayers', 'selection', 'items', 'directions', 'search', 'userLocation'];
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
</script>

<script lang="ts">
    let page: NativeViewElementNode<Page>;
    let cartoMap: CartoMap<LatLonKeys>;
    let rightMenu: MapRightMenu;
    let directionsPanel: DirectionsPanel;
    let bottomSheetInner: BottomSheetInner;
    let mapScrollingWidgets: MapScrollingWidgets;
    let locationInfoPanel: LocationInfoPanel;
    let drawer: NativeViewElementNode<Drawer>;
    let searchView: Search;
    const mapContext = getMapContext();

    let selectedPosMarker: Marker<LatLonKeys>;
    let selectedItem = watcher<IItem>(null, onSelectedItemChanged);
    let appVersion = EInfo.getVersionNameSync() + '.' + EInfo.getBuildNumberSync();
    let packageServiceEnabled = gVars.packageServiceEnabled;
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
    let addedLayers: string[] = [];
    let keepAwakeEnabled = appSettings.getBoolean(KEEP_AWAKE_KEY, false);
    let currentMapRotation = 0;
    let shouldShowNavigationBarOverlay = false;
    let geoHandler: GeoHandler;
    let steps;

    $: {
        if (steps) {
            // ensure bottomSheetStepIndex is not out of range when
            // steps changes
            bottomSheetStepIndex = Math.min(steps.length - 1, bottomSheetStepIndex)
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
        console.log('Got the following appURL', appURL.path, Array.from(appURL.params.entries()));
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

    onMount(() => {
        if (global.isAndroid) {
            Application.android.on(AndroidApplication.activityBackPressedEvent, onAndroidBackButton);
        }
        setMapContext({
            drawer: drawer.nativeView,
            getMap: () => cartoMap,
            getProjection: () => projection,
            getCurrentLanguage: () => currentLanguage,
            getSelecetedItem: () => $selectedItem,
            onVectorElementClicked,
            onVectorTileClicked,
            getVectorTileDecoder,
            selectItem,
            unselectItem,
            addLayer,
            removeLayer,
            setBottomSheetStepIndex: (index: number) => {
                bottomSheetStepIndex = index;
            },
            toggleMenu: async (side = 'left') => {
                if (side === 'bottom') {
                    await rightMenu.loadRightMenuView();
                }
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
            geoHandler = handler;
            mapContext.runOnModules('onServiceLoaded', handler);
        });
        onServiceUnloaded((handler: GeoHandler) => {
            geoHandler = null;
            mapContext.runOnModules('onServiceUnloaded', handler);
        });

        if (DEV_LOG) {
            defaultLiveSync = global.__onLiveSync.bind(global);
            global.__onLiveSync = (...args) => {
                console.log('__onLiveSync', args);
                const context = args[0];
                if (!context && !!currentLayerStyle && !currentLayerStyle.endsWith('.zip')) {
                    reloadMapStyle && reloadMapStyle();
                }
                defaultLiveSync.apply(global, args);
            };
        }
    });
    function onDeviceScreen(isScreenOn: boolean) {
        console.log('onDeviceScreen', isScreenOn);
    }
    // function onLoaded() {}
    onDestroy(() => {
        console.log('onMapDestroyed');
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
        data.cancel = true;
        Application.android.foregroundActivity.moveTaskToBack(true);
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
        console.log('onMainMapReady', cartoMap);
        // CartoMap.setRunOnMainThread(false);
        setShowDebug(DEV_LOG);
        setShowInfo(DEV_LOG);
        setShowWarn(DEV_LOG);
        setShowError(true);
        projection = cartoMap.projection;
        if (global.isAndroid) {
            console.log('onMapReady', com.carto.ui.BaseMapView.getSDKVersion());
        } else {
            console.log('onMapReady', cartoMap.nativeViewProtected as NTMapView);
        }

        const options = cartoMap.getOptions();
        options.setWatermarkScale(0);
        // options.setWatermarkPadding(toNativeScreenPos({ x: 80, y: navigationBarHeight }));
        options.setRestrictedPanning(true);
        options.setPanningMode(PanningMode.PANNING_MODE_STICKY);
        options.setSeamlessPanning(true);
        options.setEnvelopeThreadPoolSize(2);
        options.setTileThreadPoolSize(2);
        options.setZoomGestures(true);
        options.setRotatable(true);
        const pos = JSON.parse(appSettings.getString('mapFocusPos', '{"lat":45.2002,"lon":5.7222}')) as MapPos<LatLonKeys>;
        const zoom = appSettings.getNumber('mapZoom', 10);
        cartoMap.setFocusPos(pos, 0);
        cartoMap.setZoom(zoom, 0);
        try {
            const status = await perms.request('storage');
            if (gVars.packageServiceEnabled) {
                packageService.start();
            }
            setMapStyle(appSettings.getString('mapStyle', 'osmxml~topo'), true);
            mapContext.runOnModules('onMapReady', cartoMap);
        } catch (err) {
            showError(err);
        }
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
        const handledByModules = mapContext.runOnModules('onMapClicked', e);
        if (!handledByModules && clickType === ClickType.SINGLE) {
            selectItem({ item: { position, properties: {} }, isFeatureInteresting: !selectedItem });
        }
        unFocusSearch();
    }

    function createLocalMarker(position: MapPos<LatLonKeys>, options: MarkerStyleBuilderOptions) {
        getOrCreateLocalVectorLayer();
        const styleBuilder = new MarkerStyleBuilder(options);
        return new Marker<LatLonKeys>({ position, projection, styleBuilder });
    }
    function createLocalPoint(position: MapPos<LatLonKeys>, options: PointStyleBuilderOptions) {
        getOrCreateLocalVectorLayer();
        const styleBuilder = new PointStyleBuilder(options);
        return new Point<LatLonKeys>({ position, projection, styleBuilder });
    }
    function createLocalLine(positions: MapPos<LatLonKeys>[], options: LineStyleBuilderOptions) {
        getOrCreateLocalVectorLayer();
        const styleBuilder = new LineStyleBuilder(options);
        return new Line<LatLonKeys>({ positions, projection, styleBuilder });
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
        zoom
    }: {
        item: IItem;
        showButtons?: boolean;
        isFeatureInteresting: boolean;
        peek?: boolean;
        setSelected?: boolean;
        zoom?: number;
    }) {
        if (isFeatureInteresting) {
            if (item.route) {
                const vectorElement = item.vectorElement as Line;
                if (vectorElement) {
                    const color = new Color(vectorElement.color as string);
                    vectorElement.color = color.darken(10);
                    vectorElement.width += 2;
                }
                // if (!selectedRouteLine) {
                //     selectedRouteLine = createLocalLine(item.route.positions, {
                //         // color: '#55ff0000',
                //         color: '#99ffffff',
                //         // visible: false,
                //         joinType: LineJointType.ROUND,
                //         endType: LineEndType.ROUND,
                //         width: (item.styleOptions ? item.styleOptions.width : 6) + 2,
                //         clickWidth: 0

                //         // orientationMode: BillboardOrientation.GROUND,
                //         // scalingMode: BillboardScaling.SCREEN_SIZE
                //     });
                //     localVectorDataSource.add(selectedRouteLine);
                // } else {
                //     selectedRouteLine.positions = item.route.positions;
                //     selectedRouteLine.visible = true;
                // }
                if (selectedPosMarker) {
                    selectedPosMarker.visible = false;
                }
            } else {
                if (!selectedPosMarker) {
                    selectedPosMarker = createLocalPoint(item.position, {
                        // color: '#55ff0000',
                        color: primaryColor.setAlpha(178),
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
                // if (selectedRouteLine) {
                //     selectedRouteLine.visible = false;
                // }
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

            if (!item.route && (!item.properties || !item.properties.hasOwnProperty('ele')) && packageService.hillshadeLayer) {
                // console.log('test getElevation', item.position);
                packageService.getElevation(item.position).then((result) => {
                    if ($selectedItem.position === item.position) {
                        $selectedItem.properties = $selectedItem.properties || {};
                        $selectedItem.properties['ele'] = result;
                        $selectedItem = { ...$selectedItem };
                    }
                });
                // console.log('get elevation done ', item);
            }
            console.log('selectedItem', item);
            // const vectorTileDecoder = getVectorTileDecoder();
            // vectorTileDecoder.setStyleParameter('selected_id', ((item.properties && item.properties.osm_id) || '') + '');
            // vectorTileDecoder.setStyleParameter('selected_name', (item.properties && item.properties.name) || '');
            if (peek) {
                await bottomSheetInner.loadView();
                bottomSheetStepIndex = Math.max(showButtons ? 2 : 1, bottomSheetStepIndex);
            }
            if (item.zoomBounds) {
                const zoomLevel = getBoundsZoomLevel(item.zoomBounds, {
                    width: Screen.mainScreen.widthPixels,
                    height: Screen.mainScreen.heightPixels
                });
                cartoMap.moveToFitBounds(item.zoomBounds, undefined, true, true, false, 200);
                // cartoMap.setZoom(zoomLevel, 200);
                // cartoMap.setFocusPos(getCenter(item.zoomBounds.northeast, item.zoomBounds.southwest), 200);
            } else if (item.properties.extent) {
                const extent = item.properties.extent;
                cartoMap.moveToFitBounds(new MapBounds({lat:extent[1], lon:extent[0]}, {lat:extent[3], lon:extent[2]}), undefined, true, true, false, 200);
                // cartoMap.setZoom(zoomLevel, 200);
                // cartoMap.setFocusPos(getCenter(item.zoomBounds.northeast, item.zoomBounds.southwest), 200);
            } else {
                if (zoom) {
                    cartoMap.setZoom(zoom, 200);
                }
                cartoMap.setFocusPos(item.position, 200);
            }
        } else {
            unselectItem();
        }
    }
    export function unselectItem() {
        if (!!$selectedItem) {
            const item = $selectedItem;
            $selectedItem = null;
            if (selectedPosMarker) {
                selectedPosMarker.visible = false;
            }
            if (item.route) {
                const vectorElement = item.vectorElement as Line;
                if (vectorElement) {
                    vectorElement.color = new Color(vectorElement.color as string).lighten(10);
                    vectorElement.width -= 2;
                }
            }
            bottomSheetStepIndex = 0;
            // const vectorTileDecoder = getVectorTileDecoder();
            // vectorTileDecoder.setStyleParameter('selected_id', '0');
            // vectorTileDecoder.setStyleParameter('selected_name', '');
        }
    }

    $: setRenderProjectionMode($mapStore.showGlobe);
    $: setStyleParameter('buildings', !!$mapStore.show3DBuildings ? '2' : '1');
    $: setStyleParameter('contours', $mapStore.showContourLines ? '1' : '0');
    $: setStyleParameter('contoursOpacity', $mapStore.contourLinesOpacity.toFixed(1));
    $: currentLayer && (currentLayer.zoomLevelBias = parseFloat($mapStore.zoomBiais));
    $: currentLayer && (currentLayer.preloading = $mapStore.preloading);
    $: shouldShowNavigationBarOverlay = global.isAndroid && navigationBarHeight !== 0 && !!selectedItem;
    $: bottomSheetStepIndex === 0 && unselectItem();
    $: {
        appSettings.setBoolean(KEEP_AWAKE_KEY, keepAwakeEnabled);
        if (keepAwakeEnabled) {
            showKeepAwakeNotification();
        } else {
            hideKeepAwakeNotification();
        }
    }

    function cancelDirections() {
        directionsPanel.cancel();
    }
    function onVectorTileClicked(data: VectorTileEventData<LatLonKeys>) {
        const { clickType, position, featureLayerName, featureData, featurePosition } = data;
        console.log('onVectorTileClicked', featureLayerName, featureData.class, featureData.subclass, featureData);
        const handledByModules = mapContext.runOnModules('onVectorTileClicked', data);
        if (!handledByModules && clickType === ClickType.SINGLE) {
            if (
                featureLayerName === 'transportation' ||
                featureLayerName === 'transportation_name' ||
                featureLayerName === 'route' ||
                featureLayerName === 'contour' ||
                featureLayerName === 'hillshade' ||
                ((featureLayerName === 'waterway' ||
                    featureLayerName === 'building' ||
                    featureLayerName === 'park' ||
                    featureLayerName === 'landcover' ||
                    featureLayerName === 'landuse') &&
                    !featureData.name)
            ) {
                return false;
            }
            featureData.layer = featureLayerName;

            const isFeatureInteresting =
                !!featureData.name ||
                featureLayerName === 'poi' ||
                featureLayerName === 'mountain_peak' ||
                featureLayerName === 'housenumber';
            if (isFeatureInteresting) {
                const result: IItem = {
                    properties: featureData,
                    position: isFeatureInteresting ? featurePosition : position
                };
                selectItem({ item: result, isFeatureInteresting });

                const service = packageService.localOSMOfflineReverseGeocodingService;
                if (service) {
                    itemLoading = true;
                    const radius = 100;
                    packageService
                        .searchInGeocodingService(service, {
                            projection,
                            location: featurePosition,
                            searchRadius: radius
                        })
                        .then((res) => {
                            if (res) {
                                for (let index = 0; index < res.size(); index++) {
                                    const r = packageService.convertGeoCodingResult(res.get(index));
                                    if (computeDistanceBetween(result.position, r.position) <= radius && r.rank > 0.9) {
                                        if ($selectedItem.position === result.position) {
                                            $selectedItem = packageService.prepareGeoCodingResult({
                                                address: r.address as any,
                                                ...selectedItem
                                            });
                                        }
                                        break;
                                    }
                                }
                            }
                        })
                        // .then(() => {
                        //     console.log('test about to select item', result);
                        //     selectItem({ item: result, isFeatureInteresting });
                        // })
                        .catch((err) => {
                            console.error(err);
                        });
                }
            }
            unFocusSearch();

            // return true to only look at first vector found
            return isFeatureInteresting;
        }
        return handledByModules;
    }
    function onVectorElementClicked(data: VectorElementEventData<LatLonKeys>) {
        const { clickType, position, elementPos, metaData, element } = data;
        Object.keys(metaData).forEach((k) => {
            metaData[k] = JSON.parse(metaData[k]);
        });
        const handledByModules = mapContext.runOnModules('onVectorElementClicked', data);
        if (!handledByModules && clickType === ClickType.SINGLE) {
            const item: IItem = { position, vectorElement: element, ...metaData };
            // }
            if (item.id && $selectedItem && $selectedItem.id === item.id) {
                return true;
            }
            if (item.route) {
                item.route.positions = (element as Line<LatLonKeys>).getPoses() as any;
            }
            selectItem({ item, isFeatureInteresting: true });
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

    function setStyleParameter(key: string, value) {
        const decoder = getVectorTileDecoder();
        if (decoder) {
            decoder.setStyleParameter(key, value);
        }
    }

    function setCurrentLayer(id: string) {
        console.log('setCurrentLayer', id, $mapStore.zoomBiais, $mapStore.preloading);
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
        updateLanguage(currentLanguage);
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
        // console.log('setCurrentLayer', 'done');
    }

    function clearCache() {
        currentLayer && currentLayer.clearTileCaches(true);
        packageService.clearCache();
        cartoMap.requestRedraw();
    }
    function updateLanguage(code: string) {
        appSettings.setString('language', code);
        currentLanguage = code;
        packageService.currentLanguage = code;
        // if (currentLayer === null) {
        //     return;
        // }

        setStyleParameter('lang', code);
        setStyleParameter('fallback_lang', 'latin');
    }

    function getVectorTileDecoder() {
        return vectorTileDecoder || packageService.getVectorTileDecoder();
    }

    function getStyleFromCartoMapStyle(style: CartoMapStyle) {
        switch (style) {
            case CartoMapStyle.DARKMATTER:
                return 'darkmatter';
            case CartoMapStyle.POSITRON:
                return 'positron';
            case CartoMapStyle.VOYAGER:
            default:
                return 'voyager';
        }
    }
    function geteCartoMapStyleFromStyle(style: string) {
        switch (style) {
            case 'darkmatter':
                return CartoMapStyle.DARKMATTER;
            case 'positron':
                return CartoMapStyle.POSITRON;
            case 'voyager':
            default:
                return CartoMapStyle.VOYAGER;
        }
    }
    function setMapStyle(layerStyle: string, force = false) {
        layerStyle = layerStyle.toLowerCase();
        let mapStyle = layerStyle;
        let mapStyleLayer = 'voyager';
        if (layerStyle.indexOf('~') !== -1) {
            const array = layerStyle.split('~');
            mapStyle = array[0];
            mapStyleLayer = array[1];
        }
        console.log('setMapStyle', layerStyle, currentLayerStyle, mapStyle, mapStyleLayer);
        if (layerStyle !== currentLayerStyle || !!force) {
            currentLayerStyle = layerStyle;
            appSettings.setString('mapStyle', layerStyle);
            const oldVectorTileDecoder = vectorTileDecoder;
            if (layerStyle === 'default' ) {
                vectorTileDecoder = new CartoOnlineVectorTileLayer({
                    style: mapStyleLayer
                }).getTileDecoder();
            } else {
                try {
                    vectorTileDecoder = new MBVectorTileDecoder({
                        style: mapStyleLayer,
                        liveReload: TNS_ENV !== 'production',
                        ...(layerStyle.endsWith('.zip')
                            ? { zipPath: `~/assets/styles/${mapStyle}` }
                            : { dirPath: `~/assets/styles/${mapStyle}` })
                    });
                    console.log('vectorTileDecoder', vectorTileDecoder);
                    mapContext.runOnModules('vectorTileDecoderChanged', oldVectorTileDecoder, vectorTileDecoder);
                } catch (err) {
                    showError(err);
                    vectorTileDecoder = null;
                }
            }
            updateLanguage(currentLanguage);
            if (gVars.packageServiceEnabled) {
                setCurrentLayer(currentLayerStyle);
            }
        }
    }

    function onLayerOpacityChanged(item, event) {
        const opacity = event.value / 100;
        item.layer.opacity = opacity;
        appSettings.setNumber(item.name + '_opacity', opacity);
        item.layer.visible = opacity !== 0;
        cartoMap.requestRedraw();
    }

    function onSourceLongPress(item: SourceItem) {
        const actions = ['delete'];
        if (item.provider.cacheable !== false) {
            actions.push('clear_cache');
        }
        if (item.legend) {
            actions.push('legend');
        }
        action({
            title: `${item.name} Source`,
            message: 'Pick Action',
            actions: [l('delete'), l('clear_cache')]
        }).then((result) => {
            switch (result) {
                case 'delete': {
                    mapContext.mapModule('customLayers').deleteSource(item.name);
                    break;
                }
                case 'clear_cache': {
                    ((item.layer as any).dataSource as PersistentCacheTileDataSource).clear();
                    item.layer.clearTileCaches(true);
                    break;
                }
                case 'legend':
                    // const PhotoViewer = require('nativescript-photoviewer');
                    // new PhotoViewer().showGallery([item.legend]);
                    break;
            }
        });
    }

    async function selectStyle() {
            let styles = [];
        const entities = await Folder.fromPath(path.join(knownFolders.currentApp().path, 'assets', 'styles')).getEntities();
        for (let index = 0; index < entities.length; index++) {
            const e = entities[index];
            if (Folder.exists(e.path)) {
                const subs = await Folder.fromPath(e.path).getEntities();
                styles.push( ...subs.filter(s=>s.name.endsWith('.json') || s.name.endsWith('.xml')).map(s=>e.name+ '~' + s.name.split('.')[0]));
            } else {
                styles.push (e.name);
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
    function selectLanguage() {
        const actions = SUPPORTED_LOCALES;
        action({
            title: 'Language',
            message: 'Select Language',
            actions
        }).then((result) => {
            if (actions.indexOf(result) !== -1) {
                result && updateLanguage(result);
            }
        });
    }

    async function downloadPackages() {
        const PackagesDownloadComponent = (await import('./PackagesDownloadComponent.svelte')).default;
        showBottomSheet({ parent: page, view: PackagesDownloadComponent });
    }
    function removeLayer(layer: Layer<any, any>, layerId: LayerType, offset?: number) {
        const realLayerId = offset ? layerId + offset : layerId;
        const index = addedLayers.indexOf(realLayerId);
        if (index !== -1) {
            addedLayers.splice(index, 1);
        }
        cartoMap.removeLayer(layer);
    }
    function addLayer(layer: Layer<any, any>, layerId: LayerType, offset?: number) {
        const realLayerId = offset ? layerId + offset : layerId;
        if (cartoMap) {
            if (addedLayers.indexOf(realLayerId) !== -1) {
                return;
            }
            const layerIndex = LAYERS_ORDER.indexOf(layerId);
            let realIndex = 0;
            addedLayers.some((s) => {
                const i =LAYERS_ORDER.indexOf(s as any);
                if (i >= 0 && i < layerIndex) {
                    realIndex++;
                    return false;
                }
                return true;
            });
            if (realIndex >= 0 && realIndex < addedLayers.length) {
                const index = realIndex + (offset || 0);
                cartoMap.addLayer(layer, index);
                addedLayers.splice(index, 0, realLayerId);
            } else {
                cartoMap.addLayer(layer);
                addedLayers.push(realLayerId);
            }
            cartoMap.requestRedraw();
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
        console.log('switchKeepAwake', keepAwakeEnabled);
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
                break;
        }
    }

    async function showOptions() {
        const options = [
            {
                title: lt('select_style'),
                id: 'select_style',
                icon: 'mdi-layers'
            },
            {
                title: lt('select_language'),
                id: 'select_language',
                icon: 'mdi-translate'
            },
            {
                title: lt('location_info'),
                id: 'location_info',
                icon: 'mdi-speedometer'
            },
            {
                title: lt('share_screenshot'),
                id: 'share_screenshot',
                icon: 'mdi-cellphone-screenshot'
            },
            {
                title: lt('keep_awake'),
                color: keepAwakeEnabled ? 'red' : 'green',
                id: 'keep_awake',
                icon: keepAwakeEnabled ? 'mdi-sleep' : 'mdi-sleep-off'
            }
        ];
        if (packageServiceEnabled) {
            options.unshift({
                title: lt('offline_packages'),
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
                case 'select_language':
                    selectLanguage();
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
            }
        }
    }
</script>

<page bind:this={page} actionBarHidden="true" backgroundColor="#E3E1D3">
    <drawer
        bind:this={drawer}
        translationFunction={drawerTranslationFunction}
        bottomOpenedDrawerAllowDraging={true}
        backgroundColor="#E3E1D3">
        <MapRightMenu prop:bottomDrawer bind:this={rightMenu} />
        <cartomap
            zoom="16"
            on:mapReady={onMainMapReady}
            on:mapMoved={onMainMapMove}
            on:mapStable={onMainMapStable}
            on:mapIdle={onMainMapIdle}
            on:mapClicked={onMainMapClicked} />
        <bottomsheet
            android:marginBottom={navigationBarHeight}
            backgroundColor="#01550000"
            {steps}
            bind:stepIndex={bottomSheetStepIndex}
            translationFunction={bottomSheetTranslationFunction}>
            <Search
                bind:this={searchView}
                verticalAlignment="top"
                defaultElevation={0}
                isUserInteractionEnabled={scrollingWidgetsOpacity > 0.3} />
            <LocationInfoPanel
                horizontalAlignment="left"
                verticalAlignment="top"
                marginLeft="20"
                marginTop="90"
                bind:this={locationInfoPanel}
                isUserInteractionEnabled={scrollingWidgetsOpacity > 0.3} />
            <DirectionsPanel bind:this={directionsPanel} width="100%" verticalAlignment="top" />
            <canvaslabel
                orientation="vertical"
                verticalAlignment="middle"
                horizontalAlignment="right"
                isUserInteractionEnabled="false"
                color="red"
                class="label-icon-btn"
                fontSize="12"
                width="20"
                height="30">
                <cspan
                    text="mdi-crosshairs-gps"
                    visibility={$mapStore.watchingLocation || $mapStore.queryingLocation ? 'visible' : 'collapsed'}
                    textAlignment="left"
                    verticalTextAlignement="top" />
                <cspan
                    text="mdi-sleep-off"
                    visibility={keepAwakeEnabled ? 'visible' : 'collapsed'}
                    textAlignment="left"
                    verticalTextAlignement="bottom" />
            </canvaslabel>
            <BottomSheetInner
                bind:this={bottomSheetInner}
                bind:steps
                prop:bottomSheet
                updating={itemLoading}
                item={$selectedItem} />
            <button
                marginTop="80"
                visibility={currentMapRotation !== 0 ? 'visible' : 'collapsed'}
                on:tap={resetBearing}
                class="small-floating-btn"
                text="mdi-navigation"
                rotate={currentMapRotation}
                verticalAlignment="top"
                horizontalAlignment="right" />
            <MapScrollingWidgets
                bind:this={mapScrollingWidgets}
                opacity={scrollingWidgetsOpacity}
                userInteractionEnabled={scrollingWidgetsOpacity > 0.3} />
            <!-- <absolutelayout
                transition:slide={{ duration: 100 }}
                visibility={shouldShowNavigationBarOverlay ? 'visible' : 'collapsed'}
                class="navigationBarOverlay" /> -->
        </bottomsheet>
    </drawer>
</page>
