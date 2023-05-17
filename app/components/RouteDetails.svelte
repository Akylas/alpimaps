<script lang="ts">
    import type { MapPos } from '@nativescript-community/ui-carto/core';
    import { ClickType, MapBounds, toNativeScreenPos } from '@nativescript-community/ui-carto/core';
    import { LocalVectorDataSource } from '@nativescript-community/ui-carto/datasources/vector';
    import { Layer } from '@nativescript-community/ui-carto/layers';
    import { CartoOnlineVectorTileLayer, VectorLayer, VectorTileEventData, VectorTileLayer } from '@nativescript-community/ui-carto/layers/vector';
    import { Projection } from '@nativescript-community/ui-carto/projections';
    import { CartoMap, PanningMode, RenderProjectionMode } from '@nativescript-community/ui-carto/ui';
    import { setShowDebug, setShowError, setShowInfo, setShowWarn } from '@nativescript-community/ui-carto/utils';
    import { Point } from '@nativescript-community/ui-carto/vectorelements/point';
    // import { Text, TextStyleBuilder } from '@nativescript-community/ui-carto/vectorelements/text';
    import { MBVectorTileDecoder } from '@nativescript-community/ui-carto/vectortiles';
    import { isBottomSheetOpened } from '~/utils/svelte/bottomsheet';
    // import { Brightness } from '@nativescript/brightness';
    import { getFromLocation } from '@nativescript-community/geocoding';
    import { Application, Page, Utils } from '@nativescript/core';
    import * as appSettings from '@nativescript/core/application-settings';
    import type { AndroidActivityBackPressedEventData } from '@nativescript/core/application/application-interfaces';
    import { Screen } from '@nativescript/core/platform';
    import type { Point as GeoJSONPoint } from 'geojson';
    import { onDestroy, onMount } from 'svelte';
    import { NativeViewElementNode } from 'svelte-native/dom';
    import watcher from '~/helpers/watcher';
    import type { LayerType } from '~/mapModules/MapModule';
    import { getMapContext } from '~/mapModules/MapModule';
    import type { IItem, Item, RouteInstruction } from '~/models/Item';
    import { GeoResult, packageService } from '~/services/PackageService';
    import { preloading, rotateEnabled } from '~/stores/mapStore';
    import { showError } from '~/utils/error';
    import { computeDistanceBetween, getBoundsZoomLevel } from '~/utils/geo';
    import { navigationBarHeight, primaryColor } from '../variables';
    import BottomSheetInner from './BottomSheetInner.svelte';
    import DirectionsPanel from './DirectionsPanel.svelte';
    import MapScrollingWidgets from './MapScrollingWidgets.svelte';
    import Search from './Search.svelte';
    import { GeoJSONVectorTileDataSource } from '@nativescript-community/ui-carto/datasources';
    import { ItemFeature } from '~/mapModules/ItemsModule';

    const LAYERS_ORDER: LayerType[] = ['map', 'customLayers', 'routes', 'transit', 'hillshade', 'items', 'directions', 'search', 'selection', 'userLocation'];
    let defaultLiveSync = global.__onLiveSync;

    let page: NativeViewElementNode<Page>;
    let cartoMap: CartoMap<LatLonKeys>;
    let directionsPanel: DirectionsPanel;
    let bottomSheetInner: BottomSheetInner;
    let mapScrollingWidgets: MapScrollingWidgets;
    let searchView: Search;
    const mapContext = getMapContext();

    let selectedOSMId: string;
    let selectedId: string;
    let selectedPosMarker: Point<LatLonKeys>;
    let selectedItem = watcher<IItem>(null, onSelectedItemChanged);
    let currentLayer: VectorTileLayer;
    let currentLayerStyle: string;
    let currentMapRotation = 0;
    let vectorTileDecoder: MBVectorTileDecoder;
    let bottomSheetStepIndex = 0;
    let itemLoading = false;
    let projection: Projection = null;
    let currentLanguage = appSettings.getString('map_language', appSettings.getString('language', 'en'));
    let addedLayers: { layer: Layer<any, any>; layerId: LayerType }[] = [];
    let steps;
    let topTranslationY;
    let navigationInstructions: {
        remainingDistance: number;
        remainingTime: number;
        instruction: RouteInstruction;
        distanceToNextInstruction: number;
    };

    let ignoreNextMapClick = false;
    let didIgnoreAlreadySelected = false;

    const bottomSheetPanGestureOptions = { failOffsetXEnd: 20, minDist: 40 };

    let localVectorDataSource: GeoJSONVectorTileDataSource;
    let currentLayerFeatures: ItemFeature[] = [];
    let currentItems: IItem[] = [];
    let localVectorLayer: VectorTileLayer;
    export let item: Item;
    function getOrCreateLocalVectorLayer() {
        if (!localVectorLayer) {
            localVectorDataSource = new GeoJSONVectorTileDataSource({
                simplifyTolerance: 2,
                minZoom: 0,
                maxZoom: 24
            });
            localVectorDataSource.createLayer('items');
            // localVectorDataSource.setGeometrySimplifier(new DouglasPeuckerGeometrySimplifier({ tolerance: 2 }));
            localVectorLayer = new VectorTileLayer({
                labelBlendingSpeed: 0,
                layerBlendingSpeed: 0,
                clickRadius: 6,
                dataSource: localVectorDataSource,
                decoder: mapContext.innerDecoder
            });
            localVectorLayer.setVectorTileEventListener<LatLonKeys>(
                {
                    onVectorTileClicked(info: VectorTileEventData<LatLonKeys>) {
                        return mapContext.vectorTileElementClicked(info);
                    }
                },
                mapContext.getProjection()
            );
            cartoMap.addLayer(localVectorLayer);
        }
    }
    function updateGeoJSONLayer() {
        getOrCreateLocalVectorLayer();
        const str = JSON.stringify({
            type: 'FeatureCollection',
            features: currentLayerFeatures
        });
        // DEV_LOG && console.log('updateGeoJSONLayer', str);
        localVectorDataSource.setLayerGeoJSONString(1, str);
    }
    function addItemToLayer(item: IItem, autoUpdate = false) {
        currentItems.push(item);
        // DEV_LOG && console.log('addItemToLayer', JSON.stringify(item.properties));
        currentLayerFeatures.push({ type: 'Feature', id: item.id, properties: item.properties, geometry: item.geometry });
        if (autoUpdate) {
            updateGeoJSONLayer();
        }
    }

    $: {
        if (steps) {
            // ensure bottomSheetStepIndex is not out of range when
            // steps changes
            // DEV_LOG && console.log('steps changed', bottomSheetStepIndex, steps);
            bottomSheetStepIndex = Math.min(steps.length - 1, bottomSheetStepIndex);
        }
    }
    onMount(() => {
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
        // mapContext.runOnModules('onMapDestroyed');

        localVectorLayer = null;
        if (localVectorDataSource) {
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
    function reloadMapStyle() {
        // mapContext.runOnModules('reloadMapStyle');
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
        const left = Utils.layout.toDevicePixels(60);
        const top = Utils.layout.toDevicePixels(90 + topTranslationY);
        const bottom = Utils.layout.toDevicePixels($navigationBarHeight - mapTranslation + 100);
        const min = Math.min(width - 2 * left, height - top - bottom);
        const deltaX = (width - min) / 2;
        const result = {
            left: deltaX,
            top: top + (height - top - bottom - min) / 2,
            width: min,
            height: min
        };
        // DEV_LOG && console.log('getMapViewPort', width, height, mapTranslation, topTranslationY, result);
        return result;
    }
    // const saveSettings = debounce(function () {
    //     if (!cartoMap) {
    //         return;
    //     }
    //     appSettings.setNumber('mapZoom', cartoMap.zoom);
    //     appSettings.setNumber('mapBearing', cartoMap.bearing);
    //     appSettings.setString('mapFocusPos', JSON.stringify(cartoMap.focusPos));
    // }, 500);

    async function onMainMapReady(e) {
        try {
            cartoMap = e.object as CartoMap<LatLonKeys>;
            // CartoMap.setRunOnMainThread(true);
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
            options.setEnvelopeThreadPoolSize(1);
            options.setTileThreadPoolSize(1);

            options.setZoomGestures(true);
            options.setDoubleClickMaxDuration(0.3);
            options.setLongClickDuration(0.5);
            options.setKineticRotation(false);
            options.setRotationGestures($rotateEnabled);
            // toggleMapPitch($pitchEnabled);
            const pos = JSON.parse(appSettings.getString('mapFocusPos', '{"lat":45.2012,"lon":5.7222}')) as MapPos<LatLonKeys>;
            const zoom = appSettings.getNumber('mapZoom', 10);
            const bearing = appSettings.getNumber('mapBearing', 0);
            DEV_LOG && console.log('onMainMapReady', pos, zoom, bearing);
            cartoMap.setFocusPos(pos, 0);
            cartoMap.setZoom(zoom, 0);
            cartoMap.setBearing(bearing, 0);
            try {
                // packageService.start();
                // transitService.start();
                setMapStyle(appSettings.getString('mapStyle', PRODUCTION ? 'osm.zip~osm' : 'osm~osm'), true);
                // setMapStyle('osm.zip~osm', true);
            } catch (err) {
                showError(err);
            }
            // mapContext.runOnModules('onMapReady', cartoMap);

            // registerUniversalLinkCallback(onAppUrl);
            // const current = getUniversalLink();
            // if (current) {
            //     onAppUrl(current);
            // }
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
        // mapContext.runOnModules('onMapMove', e);
        // executeOnMainThread(function () {
        currentMapRotation = Math.round(cartoMap.bearing * 100) / 100;
        // });
        // unFocusSearch();
    }
    // function onMainMapIdle(e) {
    //     if (!cartoMap) {
    //         return;
    //     }
    //     mapContext.runOnModules('onMapIdle', e);
    // }
    // function onMainMapStable(e) {
    //     if (!cartoMap) {
    //         return;
    //     }
    //     if (mapMoved) {
    //         mapMoved = false;
    //         saveSettings();
    //     }
    //     mapContext.runOnModules('onMapStable', e);
    // }

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
        // TODO: fix to allow only this map modules to handle events
        const handledByModules = mapContext.runOnModules('onMapClicked', e);
        // console.log('mapTile', latLngToTileXY(position.lat, position.lon, cartoMap.zoom), clickType === ClickType.SINGLE, handledByModules, !!selectedItem);
        if (!handledByModules && clickType === ClickType.SINGLE) {
            selectItem({ item: { geometry: { type: 'Point', coordinates: [position.lon, position.lat] }, properties: {} }, isFeatureInteresting: !$selectedItem });
        }
    }
    function onSelectedItemChanged(oldValue: IItem, value: IItem) {
        //     mapContext.runOnModules('onSelectedItem', value, oldValue);
    }

    function setSelectedItem(item) {
        DEV_LOG && console.log('setSelectedItem', item?.id);
        $selectedItem = item;
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
        try {
            didIgnoreAlreadySelected = false;
            if (isFeatureInteresting) {
                let isCurrentItem = item === $selectedItem;
                TEST_LOG && console.log('selectItem', setSelected, isCurrentItem, item.properties?.class, item.properties?.name, peek, setSelected, showButtons);
                if (setSelected && isCurrentItem && !item) {
                    unselectItem(false);
                }
                const route = item?.route;
                const props = item.properties;
                if (setSelected && route) {
                    TEST_LOG && console.log('selected_id', typeof route.osmid, route.osmid, typeof props.id, props.id, setSelected);

                    if (props.id !== undefined) {
                        selectedId = props.id;
                        if (typeof props.id === 'string') {
                            mapContext.innerDecoder.setStyleParameter('selected_id_str', selectedId + '');
                            mapContext.innerDecoder.setStyleParameter('selected_id', '0');
                        } else {
                            mapContext.innerDecoder.setStyleParameter('selected_id', selectedId + '');
                            mapContext.innerDecoder.setStyleParameter('selected_id_str', '0');
                        }
                        mapContext.innerDecoder.setStyleParameter('selected_osmid', '0');
                    } else if (route.osmid !== undefined) {
                        selectedOSMId = route.osmid;
                        mapContext.innerDecoder.setStyleParameter('selected_osmid', selectedOSMId + '');
                        mapContext.innerDecoder.setStyleParameter('selected_id', '0');
                        mapContext.innerDecoder.setStyleParameter('selected_id_str', '0');
                    }

                    if (selectedPosMarker) {
                        selectedPosMarker.visible = false;
                    }
                } else {
                    // const geometry = item.geometry as GeoJSONPoint;
                    // const position = { lat: geometry.coordinates[1], lon: geometry.coordinates[0] };
                    // if (!selectedPosMarker) {
                    //     getOrCreateLocalVectorLayer();
                    //     const itemModule = mapContext.mapModule('items');
                    //     selectedPosMarker = itemModule.createLocalPoint(position, {
                    //         color: primaryColor.setAlpha(178).hex,
                    //         clickSize: 0,
                    //         scaleWithDPI: true,
                    //         size: 20
                    //     });
                    //     localVectorDataSource.add(selectedPosMarker);
                    // } else {
                    //     selectedPosMarker.position = position;
                    //     selectedPosMarker.visible = true;
                    // }
                    if (setSelected) {
                        if (props.id !== undefined) {
                            selectedId = props.id;
                            if (typeof props.id === 'string') {
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
                    setSelectedItem(item);
                }
                if (setSelected && !route) {
                    if (!props.address || !props.address['street']) {
                        (async () => {
                            try {
                                const service = packageService.localOSMOfflineReverseGeocodingService;
                                const geometry = item.geometry as GeoJSONPoint;
                                const position = { lat: geometry.coordinates[1], lon: geometry.coordinates[0] };
                                DEV_LOG && console.log('fetching addresses', !!service, position);
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
                                        if (bestFind && $selectedItem.geometry === item.geometry) {
                                            if (props.layer === 'housenumber') {
                                                $selectedItem.properties.address = { ...bestFind.properties.address, name: null, houseNumber: props.housenumber } as any;
                                                setSelectedItem($selectedItem);
                                            } else {
                                                $selectedItem.properties.address = { ...bestFind.properties.address, name: null } as any;
                                                setSelectedItem($selectedItem);
                                            }
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
                zoomToItem({ item, zoom, minZoom, duration: zoomDuration });
            } else {
                unselectItem();
            }
        } catch (error) {
            console.error(error);
        }
    }

    export function zoomToItem({ item, zoom, minZoom, duration = 200, forceZoomOut = false }: { item: IItem; zoom?: number; minZoom?: number; duration?; forceZoomOut?: boolean }) {
        const viewPort = getMapViewPort();
        DEV_LOG && console.log('zoomToItem', viewPort);
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
        TEST_LOG && console.log('unselectItem', updateBottomSheet);
        if (!!$selectedItem) {
            setSelectedItem(null);
            if (selectedPosMarker) {
                selectedPosMarker.visible = false;
            }
            if (selectedOSMId !== undefined) {
                selectedOSMId = undefined;
                mapContext.innerDecoder.setStyleParameter('selected_osmid', '0');
            }
            if (selectedId !== undefined) {
                selectedId = undefined;
                mapContext.innerDecoder.setStyleParameter('selected_id', '0');
                mapContext.innerDecoder.setStyleParameter('selected_id_str', '');
            }
            if (updateBottomSheet) {
                bottomSheetStepIndex = 0;
            }
        }
    }
    $: currentLayer && (currentLayer.preloading = $preloading);
    $: bottomSheetStepIndex === 0 && unselectItem();
    $: cartoMap?.getOptions().setFocusPointOffset(toNativeScreenPos({ x: 0, y: Utils.layout.toDevicePixels(steps[bottomSheetStepIndex]) / 2 }));

    // function onVectorElementClicked(data: VectorElementEventData<LatLonKeys>) {
    //     const { clickType, position, elementPos, metaData, element } = data;
    //     TEST_LOG && console.log('onVectorElementClicked', clickType, position, metaData);
    //     Object.keys(metaData).forEach((k) => {
    //         if (metaData[k][0] === '{' || metaData[k][0] === '[') {
    //             metaData[k] = JSON.parse(metaData[k]);
    //         }
    //     });
    //     const handledByModules = mapContext.runOnModules('onVectorElementClicked', data);
    //     // if (DEV_LOG) {
    //     //     console.log('handledByModules', handledByModules);
    //     // }
    //     if (!!metaData.instruction) {
    //         return true;
    //     }
    //     if (!handledByModules && clickType === ClickType.SINGLE && Object.keys(metaData).length > 0) {
    //         const item: IItem = {
    //             geometry: {
    //                 type: 'Point',
    //                 coordinates: [elementPos.lon, elementPos.lat]
    //             },
    //             properties: metaData
    //         };
    //         // }
    //         if (item.id && $selectedItem && $selectedItem.id === item.id) {
    //             return true;
    //         }
    //         // if (item.properties?.route) {
    //         //     item.properties.route.positions = (element as Line<LatLonKeys>).getPoses() as any;
    //         // }
    //         selectItem({ item, isFeatureInteresting: true });
    //         return true;
    //     }
    //     return !!handledByModules;
    // }

    function setRenderProjectionMode(showGlobe) {
        cartoMap && cartoMap.getOptions().setRenderProjectionMode(showGlobe ? RenderProjectionMode.RENDER_PROJECTION_MODE_SPHERICAL : RenderProjectionMode.RENDER_PROJECTION_MODE_PLANAR);
    }

    function getVectorTileDecoder() {
        return vectorTileDecoder || packageService.vectorTileDecoder;
    }

    function getCurrentLayer() {
        return currentLayer;
    }
    // function handleNewLanguage(newLang) {
        // console.log('handleNewLanguage', newLang);
        // currentLanguage = newLang;
        // packageService.currentLanguage = newLang;
        // setStyleParameter('lang', newLang);
        // setStyleParameter('fallback_lang', 'en');
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
                    // mapContext.runOnModules('vectorTileDecoderChanged', oldVectorTileDecoder, vectorTileDecoder);
                } catch (err) {
                    showError(err);
                    vectorTileDecoder = null;
                }
            }
            // handleNewLanguage(currentLanguage);
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
    let scrollingWidgetsOpacity = 1;
    let mapTranslation = 0;

    function bottomSheetTranslationFunction(translation, maxTranslation, progress) {
        if (translation >= -300) {
            scrollingWidgetsOpacity = 1;
        } else {
            scrollingWidgetsOpacity = Math.max(0, 1 - (-translation - 300) / 30);
        }
        // DEV_LOG && console.log('bottomSheetTranslationFunction', translation, maxTranslation, scrollingWidgetsOpacity, progress);
        mapTranslation = translation;
        const result = {
            bottomSheet: {
                translateY: translation
            },
            mapScrollingWidgets: {
                target: mapScrollingWidgets.getNativeView(),
                translateY: mapTranslation,
                opacity: scrollingWidgetsOpacity
            }
        };
        return result;
    }
</script>

<page
    bind:this={page}
    actionBarHidden={true}
    backgroundColor="#E3E1D3"
    on:navigatingTo={onNavigatingTo}
    on:navigatingFrom={onNavigatingFrom}
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
        <gridlayout width="100%" height="100%">
            <cartomap
                zoom={16}
                on:mapReady={onMainMapReady}
                on:mapMoved={onMainMapMove}
                on:mapClicked={onMainMapClicked}
            />
            <!-- <ButtonBar marginLeft={5} gray={true} buttonSize={40} horizontalAlignment="left" verticalAlignment="middle" id="mapButtonsNew" buttons={sideButtons} /> -->

            <!-- <Search bind:this={searchView} verticalAlignment="top" defaultElevation={0} isUserInteractionEnabled={scrollingWidgetsOpacity > 0.3} /> -->
            <!-- <LocationInfoPanel
                horizontalAlignment="left"
                verticalAlignment="top"
                marginLeft={20}
                marginTop={90}
                bind:this={locationInfoPanel}
                isUserInteractionEnabled={scrollingWidgetsOpacity > 0.3}
            /> -->
            <!-- <canvaslabel
                orientation="vertical"
                verticalAlignment="middle"
                horizontalAlignment="right"
                isUserInteractionEnabled="false"
                color="red"
                fontSize={12}
                width={20}
                height={30}
                class="mdi"
                textAlignment="center"
            >
                <cspan text="mdi-access-point-network-off" visibility={networkConnected ? 'collapsed' : 'visible'} textAlignment="left" verticalTextAlignment="top" />
            </canvaslabel> -->
            <mdbutton
                marginTop={90}
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
            <!-- <MapScrollingWidgets bind:this={mapScrollingWidgets} bind:navigationInstructions opacity={scrollingWidgetsOpacity} userInteractionEnabled={scrollingWidgetsOpacity > 0.3} /> -->
            <DirectionsPanel bind:this={directionsPanel} bind:translationY={topTranslationY} width="100%" verticalAlignment="top" />
        </gridlayout>
        <BottomSheetInner bind:this={bottomSheetInner} bind:navigationInstructions bind:steps prop:bottomSheet updating={itemLoading} item={$selectedItem} />
        <!-- <collectionview
                items={currentClickedFeatures}
                height={80}
                margin="80 20 0 20"
                verticalAlignment="top"
                borderRadius={16}
                backgroundColor="#00000055"
                visibility={currentClickedFeatures && currentClickedFeatures.length > 0 ? 'visible' : 'collapsed'}
            >
                <Template let:item>
                    <label padding="0 20 0 20" text={JSON.stringify(item)} verticalAlignment="middle" fontSize={11} color="white" />
                </Template>
            </collectionview> -->
    </bottomsheet>
</page>
