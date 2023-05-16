<script lang="ts">
    import { l, lc } from '@nativescript-community/l';
    import { createNativeAttributedString } from '@nativescript-community/text';
    import { Align, Canvas, CanvasView, DashPathEffect, LayoutAlignment, Paint, Rect, StaticLayout, Style } from '@nativescript-community/ui-canvas';
    import { stringProperty } from '@nativescript-community/ui-canvas/shapes/shape';
    import { fromNativeMapPos, GenericMapPos, MapBounds } from '@nativescript-community/ui-carto/core';
    import { TileDataSource } from '@nativescript-community/ui-carto/datasources';
    import { RasterTileLayer } from '@nativescript-community/ui-carto/layers/raster';
    import type { VectorTileEventData } from '@nativescript-community/ui-carto/layers/vector';
    import { CartoMap } from '@nativescript-community/ui-carto/ui';
    import { distanceToEnd, isLocationOnPath } from '@nativescript-community/ui-carto/utils';
    import { LineChart } from '@nativescript-community/ui-chart/charts';
    import type { HighlightEventData } from '@nativescript-community/ui-chart/charts/Chart';
    import { XAxisPosition } from '@nativescript-community/ui-chart/components/XAxis';
    import { Rounding } from '@nativescript-community/ui-chart/data/DataSet';
    import type { Entry } from '@nativescript-community/ui-chart/data/Entry';
    import { LineData } from '@nativescript-community/ui-chart/data/LineData';
    import { LineDataSet } from '@nativescript-community/ui-chart/data/LineDataSet';
    import { Highlight } from '@nativescript-community/ui-chart/highlight/Highlight';
    import { showSnack } from '@nativescript-community/ui-material-snackbar';
    import { Application, ApplicationSettings, ImageSource, Utils } from '@nativescript/core';
    import { File, path } from '@nativescript/core/file-system';
    import { openUrl } from '@nativescript/core/utils';
    import type { Point } from 'geojson';
    import { onDestroy, onMount } from 'svelte';
    import { NativeViewElementNode, navigate } from 'svelte-native/dom';
    import BottomSheetInfoView from '~/components/BottomSheetInfoView.svelte';
    import { convertDurationSeconds, convertElevation, formatDistance } from '~/helpers/formatter';
    import { getBounds } from '~/helpers/geolib';
    import { onThemeChanged } from '~/helpers/theme';
    import { formatter } from '~/mapModules/ItemFormatter';
    import { getMapContext, handleMapAction } from '~/mapModules/MapModule';
    import type { IItem, IItem as Item, RouteInstruction } from '~/models/Item';
    import { networkService } from '~/services/NetworkService';
    import { packageService } from '~/services/PackageService';
    import { showError } from '~/utils/error';
    import { computeDistanceBetween } from '~/utils/geo';
    import { showBottomSheet } from '~/utils/svelte/bottomsheet';
    import { openLink } from '~/utils/ui';
    import { alpimapsFontFamily, borderColor, mdiFontFamily, navigationBarHeight, primaryColor, screenHeightDips, statusBarHeight, subtitleColor, textColor, widgetBackgroundColor } from '~/variables';
    import ElevationChart from './ElevationChart.svelte';
    import IconButton from './IconButton.svelte';

    const LISTVIEW_HEIGHT = 200;
    const PROFILE_HEIGHT = 150;
    const STATS_HEIGHT = 180;
    const WEB_HEIGHT = 400;
    const INFOVIEW_HEIGHT = 80;

    const mapContext = getMapContext();
    const highlightPaint = new Paint();
    highlightPaint.setColor('#aaa');
    // highlightPaint.setTextAlign(Align.CENTER);
    highlightPaint.setStrokeWidth(1);
    highlightPaint.setTextSize(12);

    const Intent = __ANDROID__ ? android.content.Intent : undefined;

    export let item: Item;

    let graphAvailable = false;
    let statsAvailable = false;
    let statsCanvas: NativeViewElementNode<CanvasView>;
    let elevationChart: ElevationChart;
    let chartLoadHighlightData = null;
    let infoView: BottomSheetInfoView;
    let webViewSrc: string = null;
    let showListView = false;
    $: showListView = listViewAvailable && listViewVisible;
    let itemIsRoute = false;
    let itemIsBusStop = false;
    let itemCanQueryProfile = false;
    let itemCanQueryStats = false;
    let currentLocation: GenericMapPos<LatLonKeys> = null;
    let showProfileGrades = true;

    onMount(() => {
        updateSteps();
    });

    mapContext.onMapReady((mapView: CartoMap<LatLonKeys>) => {
        // updateSteps();
        mapContext.mapModule('userLocation').on('location', onNewLocation);
    });
    onDestroy(() => {
        mapContext.mapModule('userLocation').on('location', onNewLocation);
    });

    let dataToUpdateOnItemSelect = null;

    mapContext.onVectorTileElementClicked((data: VectorTileEventData<LatLonKeys>) => {
        const { clickType, position, feature, featureData } = data;
        DEV_LOG && console.log('BottomSheetInner onVectorTileElementClicked', item?.id, featureData, feature.properties);
        if (featureData?.route) {
            if (item && item.id && feature.properties?.id === item.id) {
                DEV_LOG && console.log('onVectorTileElementClicked updateRouteItemWithPosition', position);
                updateRouteItemWithPosition(item, position, false);
            } else {
                // we can update with position once the item is selected
                dataToUpdateOnItemSelect = { id: feature.properties?.id, position };
            }
        }
    });

    // $: {
    //     if (itemIsRoute && currentLocation) {
    //         DEV_LOG && console.log('currentLocation', 'updateRouteItemWithPosition');
    //         updateRouteItemWithPosition(item, currentLocation);
    //     }
    // }
    // $: {
    //     if (!item) {
    //         navigationInstructions = null;
    //     }
    // }
    // $: {
    //     const props = item && item.properties;
    //     if (props) {
    //         let name = props.name;
    //         if (props.wikipedia) {
    //             name = props.wikipedia.split(':')[1];
    //         }
    //         if (item.address) {
    //             name += ' ' + item.address.county;
    //         }
    //         const url = `https://duckduckgo.com/?kae=d&ks=s&ko=-2&kaj=m&k1=-1&q=${encodeURIComponent(name).toLowerCase().replace('/s+/g', '+')}`;
    //         webViewSrc = url;
    //     } else {
    //         webViewSrc = null;
    //     }
    // }

    $: {
        try {
            if (elevationChart && chartLoadHighlightData) {
                try {
                    const { onPathIndex, remainingDistance, remainingTime, highlight } = chartLoadHighlightData;
                    elevationChart.hilghlightPathIndex(onPathIndex, remainingDistance, remainingTime, highlight, false);
                } catch (error) {
                    console.error(error);
                } finally {
                    chartLoadHighlightData = null;
                }
            }
        } catch (error) {
            console.error(error);
        }
    }
    function openWikipedia() {
        try {
            const props = item && item.properties;
            DEV_LOG && console.log('openWikipedia', props.wikipedia);
            if (props && props.wikipedia) {
                const url = `https://en.wikipedia.org/wiki/${props.wikipedia}`;
                openLink(url);
            }
        } catch (error) {
            showError(error);
        }
    }
    function searchWeb() {
        let name;
        try {
            const props = item && item.properties;
            if (props) {
                name = props.name;
                if (props.wikipedia) {
                    name = props.wikipedia.split(':')[1];
                }
                if (props.address) {
                    name += ' ' + props.address.county;
                }
                if (__ANDROID__) {
                    const intent = new Intent(Intent.ACTION_WEB_SEARCH);
                    intent.putExtra(android.app.SearchManager.QUERY, name);
                    (Application.android.foregroundActivity as android.app.Activity).startActivity(intent);
                } else {
                    throw new Error();
                }
            }
        } catch (err) {
            if (name) {
                const url = `https://duckduckgo.com/?kae=d&ks=s&ko=-2&kaj=m&k1=-1&q=${encodeURIComponent(name).toLowerCase().replace('/s+/g', '+')}`;
                openLink(url);
            }
        }
    }
    function updateGraphAvailable() {
        graphAvailable = itemIsRoute && !!item.profile && !!item.profile.data && item.profile.data.length > 0;
    }
    function updateStatsAvailable() {
        let old = statsAvailable;
        statsAvailable = itemIsRoute && !!item.stats;
        if (statsAvailable && statsCanvas) {
            statsCanvas.nativeView.invalidate();
        }
    }

    function updateSelectedItem(item) {
        try {
            if (item) {
                itemIsRoute = !!item?.route;
                itemIsBusStop = item && !itemIsRoute && (item.properties?.class === 'bus' || item.properties?.subclass === 'tram_stop');
                itemCanQueryProfile = itemIsRoute && !!item?.id;
                itemCanQueryStats = itemIsRoute && !!item?.id;
                updateGraphAvailable();
                updateStatsAvailable();
                if (elevationChart && graphAvailable) {
                    // console.log('updateChartData1')
                    elevationChart.updateChartData();
                }
                updateSteps();
                if (currentLocation) {
                    // DEV_LOG && console.log('currentLocation', 'updateRouteItemWithPosition');
                    updateRouteItemWithPosition(item, currentLocation);
                } else if (dataToUpdateOnItemSelect && item && dataToUpdateOnItemSelect.id === item.id) {
                    updateRouteItemWithPosition(item, dataToUpdateOnItemSelect.position, false);
                }
                dataToUpdateOnItemSelect = null;
            } else {
                navigationInstructions = null;
            }
        } catch (err) {
            console.error('item changed', !!err, err, err.stack);
        }
    }
    $: updateSelectedItem(item);

    function updateRouteItemWithPosition(routeItem: Item, location: GenericMapPos<LatLonKeys>, updateNavigationInstruction = true, updateGraph = true, highlight?: Highlight<Entry>) {
        // DEV_LOG && console.log('updateRouteItemWithPosition', !!routeItem?.route, location, updateNavigationInstruction, updateGraph, !!highlight);
        try {
            if (routeItem?.route) {
                // const props = routeItem.properties;
                const route = routeItem.route;
                const positions = packageService.getRouteItemPoses(routeItem);
                const onPathIndex = isLocationOnPath(location, positions, false, true, 15);
                let remainingDistance: number, remainingTime: number;
                DEV_LOG && console.log('updateRouteItemWithPosition onPathIndex', onPathIndex);
                if (onPathIndex !== -1 && (graphAvailable || highlight || (routeItem.instructions && updateNavigationInstruction && !graphAvailable))) {
                    remainingDistance = distanceToEnd(onPathIndex, positions);
                    remainingTime = (route.totalTime * remainingDistance) / route.totalDistance;
                    if (!highlight && routeItem.instructions && updateNavigationInstruction) {
                        let routeInstruction;
                        for (let index = routeItem.instructions.length - 1; index >= 0; index--) {
                            const element = routeItem.instructions[index];
                            if (element.index < onPathIndex) {
                                break;
                            }
                            routeInstruction = element;
                        }

                        let distanceToNextInstruction = computeDistanceBetween(location, fromNativeMapPos(positions.get(onPathIndex)));
                        for (let index = onPathIndex; index < routeInstruction.index; index++) {
                            distanceToNextInstruction += computeDistanceBetween(fromNativeMapPos(positions.get(index)), fromNativeMapPos(positions.get(index + 1)));
                        }
                        navigationInstructions = {
                            instruction: routeInstruction,
                            remainingDistance,
                            distanceToNextInstruction,
                            remainingTime
                        };
                        // DEV_LOG && console.log('navigationInstructions', JSON.stringify(navigationInstructions));
                    }
                } else {
                    navigationInstructions = null;
                }

                if (updateGraph && graphAvailable) {
                    if (elevationChart) {
                        elevationChart.hilghlightPathIndex(onPathIndex, remainingDistance, remainingTime, highlight, false);
                    } else {
                        // chart must be loading
                        chartLoadHighlightData = { onPathIndex, remainingDistance, remainingTime, highlight };
                    }
                }
            } else if (updateNavigationInstruction) {
                navigationInstructions = null;
            }
        } catch (error) {
            console.error(error, error.stack);
        }
    }

    function onNewLocation(e: any) {
        currentLocation = e.data;
        // console.log('onNewLocation', currentLocation);
    }

    function showAstronomy() {
        if (item) {
            const positions = item.geometry.type === 'Point' ? item.geometry?.['coordinates'] : item.geometry?.['coordinates'][0];
            handleMapAction('astronomy', { lat: positions[1], lon: positions[0] });
        }
    }
    function searchItemWeb() {
        if (__ANDROID__) {
            const query = formatter.getItemName(item);
            if (__ANDROID__) {
                const intent = new Intent(Intent.ACTION_WEB_SEARCH);
                intent.putExtra(android.app.SearchManager.QUERY, query); // query contains search string
                if (intent.resolveActivity(Utils.ad.getApplicationContext().getPackageManager()) !== null) {
                    (Application.android.foregroundActivity as android.app.Activity).startActivity(intent);
                } else {
                    showSnack({ message: l('no_web_search_app') });
                }
            }
        }
    }
    function zoomToItem() {
        mapContext.zoomToItem({ item, forceZoomOut: true });
    }
    function openWebView() {
        openUrl(webViewSrc);
    }
    let webViewHeight = 0;
    let listViewAvailable = false;
    let listViewVisible = false;
    function toggleWebView() {
        // stepToScrollTo = !listViewAvailable ? steps.length : -1;
        listViewAvailable = !listViewAvailable;
    }
    export let steps;
    export let navigationInstructions: {
        remainingDistance: number;
        remainingTime: number;
        distanceToNextInstruction: number;
        instruction: RouteInstruction;
    } = undefined;

    function updateSteps() {
        if (!item) {
            steps = [0];
            return;
        }
        let total = INFOVIEW_HEIGHT;
        const result = [0, total];
        total += 50;
        result.push(total);
        if (graphAvailable) {
            total += PROFILE_HEIGHT;
            result.push(total);
        }
        if (statsAvailable) {
            total += STATS_HEIGHT;
            result.push(total);
        }
        if (listViewAvailable) {
            total += WEB_HEIGHT;
            result.push(total);
            const delta = Math.floor(screenHeightDips - $statusBarHeight - total);
            webViewHeight = WEB_HEIGHT + delta;
            total += delta;
            result.push(total);
        }
        steps = result;
    }

    let updatingItem = false;
    async function getProfile(updateView = true) {
        try {
            updatingItem = true;
            const profile = await packageService.getElevationProfile(item);
            if (profile) {
                // item.route.profile = profile;
                if (item.id !== undefined) {
                    await updateItem(item, { profile });
                } else {
                    item.profile = profile;
                    await saveItem(false);
                }
                updateGraphAvailable();
                updateSteps();
                if (elevationChart && graphAvailable) {
                    elevationChart.updateChartData();
                }
                if (updateView) {
                    mapContext.setBottomSheetStepIndex(3);
                }
            }
        } catch (err) {
            showError(err);
        } finally {
            updatingItem = false;
        }
    }

    function onChartHighlight({ detail }) {
        DEV_LOG && console.log('BottomSheetInner onChartHighlight', detail);
        updateRouteItemWithPosition(item, { lat: detail.lat, lon: detail.lon }, false, true, detail.highlight);
    }

    async function getStats(updateView = true) {
        try {
            updatingItem = true;
            const projection = mapContext.getProjection();
            const stats = await packageService.fetchStats({ item, projection });
            if (stats) {
                // item.route.profile = profile;
                if (item.id !== undefined) {
                    await updateItem(item, { stats });
                } else {
                    item.stats = stats;
                    await saveItem(false);
                }
                updateStatsAvailable();
                updateSteps();
                if (updateView) {
                    mapContext.setBottomSheetStepIndex(graphAvailable ? 4 : 3);
                }
            }
        } catch (err) {
            showError(err);
        } finally {
            updatingItem = false;
        }
    }

    // async function toGPX() {
    //     const name = 'test';
    //     const builder = new xml2js.Builder({
    //         rootName: 'gpx'
    //     });
    //     const profile = item.route.profile.data;
    //     return {
    //         name,
    //         // eslint-disable-next-line id-blacklist
    //         string: builder.buildObject({
    //             $: {
    //                 version: '1.1',
    //                 xmlns: 'http://www.topografix.com/GPX/1/1',
    //                 'xmlns:xsi': 'http://www.w3.org/2001/XMLSchema-instance',
    //                 'xsi:schemaLocation':
    //                     'http://www.topografix.com/GPX/1/1 http://www.topografix.com/GPX/1/1/gpx.xsd http://www.garmin.com/xmlschemas/GpxExtensions/v3 http://www.garmin.com/xmlschemas/GpxExtensionsv3.xsd http://www.garmin.com/xmlschemas/TrackPointExtension/v1 https://www8.garmin.com/xmlschemas/TrackPointExtensionv1.xsd',
    //                 creator: `AlpiMaps`,
    //                 'xmlns:gpxx': 'http://www.garmin.com/xmlschemas/GpxExtensions/v3',
    //                 'xmlns:gpxtpx': 'http://www.garmin.com/xmlschemas/TrackPointExtension/v1'
    //             },
    //             metadata: {
    //                 name,
    //                 bounds: item.zoomBounds
    //                     ? {
    //                           minlat: item.zoomBounds.southwest.lat,
    //                           minlon: item.zoomBounds.southwest.lon,
    //                           maxlat: item.zoomBounds.northeast.lat,
    //                           maxlon: item.zoomBounds.northeast.lon
    //                       }
    //                     : undefined,
    //                 copyright: {
    //                     author: 'AlpiMaps',
    //                     year: 2021
    //                 }
    //             },
    //             trk: {
    //                 trkseg: {
    //                     trkpt: item.route.positions.toArray().map((l, index) => {
    //                         const result = {
    //                             $: {
    //                                 lat: Math.round(l.lat * 1000000) / 1000000,
    //                                 lon: Math.round(l.lon * 1000000) / 1000000
    //                             },
    //                             ele: profile[index].a,
    //                             grade: profile[index].g
    //                         } as any;
    //                         return result;
    //                     })
    //                 }
    //             }
    //         })
    //     };
    // }

    async function saveItem(peek = true) {
        DEV_LOG && console.log('saveItem');
        try {
            updatingItem = true;
            const itemsModule = mapContext.mapModule('items');
            let item = mapContext.getSelectedItem();
            const isRoute = !!item.route;
            const imagePath = path.join(itemsModule.imagesFolder.path, Date.now() + '.png');
            if (isRoute) {
                item.image_path = imagePath;
            }

            item = await itemsModule.saveItem(item);
            mapContext.mapModules.directionsPanel.cancel(false);
            mapContext.selectItem({ item, isFeatureInteresting: true, peek, preventZoom: false });
            if (item.route) {
                takeItemPicture(item);
            }
        } catch (err) {
            showError(err);
        } finally {
            updatingItem = false;
        }
    }
    async function takeItemPicture(item) {
        //item needs to be already selected
        // we hide other items before the screenshot
        // and we show theme again after it
        mapContext.innerDecoder.setStyleParameter('hide_unselected', '1');
        mapContext.onMapStable(async () => {
            try {
                // const startTime = Date.now();
                const viewPort = mapContext.getMapViewPort();
                const image = await mapContext.getMap().captureRendering(true);
                mapContext.innerDecoder.setStyleParameter('hide_unselected', '0');
                // image.saveToFile(path.join(itemsModule.imagesFolder.path, Date.now() + '_full.png'), 'png');
                // console.log('captureRendering', image.width, image.height, viewPort, Date.now() - startTime, 'ms');
                const canvas = new Canvas(500, 500);
                //we offset a bit to be sure we the whole trace
                const offset = 20;
                canvas.drawBitmap(
                    image,
                    new Rect(viewPort.left - offset, viewPort.top - offset, viewPort.left + viewPort.width + offset, viewPort.top + viewPort.height + offset),
                    new Rect(0, 0, canvas.getWidth(), canvas.getHeight()),
                    null
                );
                new ImageSource(canvas.getImage()).saveToFile(item.image_path, 'png');
                // console.log('saved bitmap', imagePath, Date.now() - startTime, 'ms');
                canvas.release();
            } catch (error) {
                console.error(error);
            }
        }, true);
    }
    async function updateItem(item: IItem, data: Partial<IItem>, peek = true) {
        try {
            updatingItem = true;
            const savedItem = await mapContext.mapModule('items').updateItem(item, data);
            mapContext.selectItem({ item: savedItem, isFeatureInteresting: true, peek });
            return savedItem;
        } catch (err) {
            showError(err);
        } finally {
            updatingItem = false;
        }
    }
    function deleteItem() {
        mapContext.mapModule('items').deleteItem(mapContext.getSelectedItem());
    }
    function hideItem() {
        mapContext.mapModule('items').hideItem(mapContext.getSelectedItem());
    }
    async function shareItem() {
        if (item?.route) {
            if (!item.profile && itemCanQueryProfile) {
                await getProfile(false);
            }
            // const gpx = await toGPX();
            // mapContext.mapModules.items.shareFile(gpx.string, `${gpx.name.replace(/[\s\t]/g, '_')}.gpx`);
        }
        // shareFile(JSON.stringify(itemToShare), 'sharedItem.json');
    }
    async function checkWeather() {
        try {
            updatingItem = true;
            const query = formatter.getItemName(item);
            const geometry = item.geometry as Point;
            let url = `weather://query?lat=${geometry.coordinates[1]}&lon=${geometry.coordinates[0]}&name=${query}`;
            if (item.properties.address) {
                url += `&address=${JSON.stringify(item.properties.address)}`;
            }
            openUrl(url);
        } catch (err) {
            showError(err);
        } finally {
            updatingItem = false;
        }
    }

    async function openPeakFinder() {
        try {
            const geometry = item.geometry as Point;
            const position = { lat: geometry.coordinates[1], lon: geometry.coordinates[0], altitude: geometry.coordinates[2] };
            if (!position.altitude) {
                position.altitude = item.properties.ele || (await packageService.getElevation(position));
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
            // const { default: component } = await import('~/components/PeakFinder.svelte');
            const component = (await import('~/components/PeakFinder.svelte')).default;
            navigate({
                page: component,
                props: {
                    terrarium: false,
                    position,
                    bearing: mapContext.getMap().bearing,
                    vectorDataSource,
                    dataSource: hillshadeDatasource,
                    rasterDataSource
                }
            });
        } catch (err) {
            showError(err);
        }
    }
    async function openCompass() {
        try {
            const selected = mapContext.getSelectedItem();
            let location: any = currentLocation;
            let aimingItems: any = selected ? [selected] : [];
            let updateWithUserLocation = true;
            if (itemIsRoute && !item.id) {
                updateWithUserLocation = false;
                const points = mapContext.mapModules.directionsPanel.getFeatures().filter((s) => s.geometry.type === 'Point');
                location = { lat: (points[0].geometry as Point).coordinates[1], lon: (points[0].geometry as Point).coordinates[0] };
                aimingItems = points.slice(1);
            }
            const CompassView = (await import('~/components/CompassView.svelte')).default;
            await showBottomSheet({
                parent: mapContext.getMainPage(),
                view: CompassView,
                transparent: true,
                props: {
                    location,
                    updateWithUserLocation,
                    aimingItems
                }
            });
        } catch (error) {
            showError(error);
        }
    }

    async function getTransitLines() {
        try {
            const TransitLinesBottomSheet = (await import('~/components/transit/TransitLinesBottomSheet.svelte')).default;
            const geometry = item.geometry as Point;
            const position = { lat: geometry.coordinates[1], lon: geometry.coordinates[0], altitude: geometry.coordinates[2] };
            showBottomSheet({ parent: mapContext.getMainPage(), trackingScrollView: 'scrollView', view: TransitLinesBottomSheet, props: { name: formatter.getItemName(item), position } });
        } catch (err) {
            showError(err);
        }
    }
    // async function shareFile(content: string, fileName: string) {
    //     const file = knownFolders.temp().getFile(fileName);
    //     // iOS: using writeText was not adding the file. Surely because it was too soon or something
    //     // doing it sync works better but still needs a timeout
    //     // showLoading('loading');
    //     await file.writeText(content);
    //     const shareFile = new ShareFile();
    //     await shareFile.open({
    //         path: file.path,
    //         title: fileName,
    //         options: true, // optional iOS
    //         animated: true // optional iOS
    //     });
    // }
    function getRouteInstructionTitle(item: RouteInstruction) {
        return item.inst;
    }
    function getRouteInstructionSubtitle(item: RouteInstruction) {
        return item.name;
    }

    function routeInstructions() {
        if (listViewAvailable) {
            return item.instructions;
        }
        return [];
    }
    function onInstructionTap(instruction: RouteInstruction) {
        // console.log('onInstructionTap', instruction);
        // mapComp.selectItem({
        //     item: { position: instruction.position },
        //     isFeatureInteresting: true,
        //     setSelected: false,
        //     peek: false
        // });
        // if (graphAvailable) {
        //     const dataSet = chart.getData().getDataSetByIndex(0);
        //     dataSet.setIgnoreFiltered(true);
        //     const item = dataSet.getEntryForIndex(instruction.pointIndex);
        //     dataSet.setIgnoreFiltered(false);
        //     // console.log('highlight item', item);
        //     chart.highlightValues([
        //         {
        //             dataSetIndex: 0,
        //             x: item.x,
        //             entry: item
        //         } as Highlight
        //     ]);
        // }
    }
    let loaded = false;
    let loadedListeners = [];
    export async function loadView() {
        if (!loaded) {
            await new Promise((resolve) => {
                loadedListeners.push(resolve);
                loaded = true;
            });
        }
    }
    $: {
        try {
            if (infoView && loadedListeners.length > 0) {
                loadedListeners.forEach((l) => l());
                loadedListeners = [];
            }
        } catch (error) {
            console.error(error);
        }
    }
    let textPaint: Paint;
    let bigTextPaint: Paint;
    let barPaint: Paint;
    const colors = {
        highway: '#E6C264',
        track: '#AD9067',
        sac_scale_1: '#C9C1B2',
        sac_scale_2: '#C9C1B2',
        sac_scale_3: '#C9C1B2',
        sac_scale_4: '#A6AF8F',
        sac_scale_5: '#A6AF8F',
        sac_scale_6: '#A6AF8F',
        steps: '#CAD0D7',
        road: '#A4ACB7',
        street: '#B9C2C8',
        cycleway: '#65AAA2',
        paved_smooth: '#8B939E',
        paved_rough: '#8B857B',
        paved: '#D7D7D7',
        gravel: '#A89070',
        dirt: '#BA915E',
        path: '#A6AF8F',
        compacted: '#BA915E'
    };
    let statsKey = ApplicationSettings.getString('stats_key', 'waytypes');

    function setStatsKey(value) {
        statsKey = value;
        ApplicationSettings.setString('stats_key', value);
        statsCanvas?.nativeView?.invalidate();
    }

    function drawStats({ canvas, object }: { canvas: Canvas; object: Canvas }) {
        try {
            let w = canvas.getWidth();
            let h = canvas.getHeight();

            if (!barPaint) {
                barPaint = new Paint();
                barPaint.strokeWidth = 2;
            }
            if (!textPaint) {
                textPaint = new Paint();
                textPaint.textSize = 13;
            }
            if (!bigTextPaint) {
                bigTextPaint = new Paint();
                bigTextPaint.textSize = 16;
                bigTextPaint.fontWeight = 'bold';
            }
            bigTextPaint.color = $subtitleColor;
            textPaint.color = $textColor;

            const usedWidth = w - 20;
            let x = 10;
            let labelx = 13;
            let labely = 95;
            const stats = item.stats[statsKey];
            canvas.drawText(lc(statsKey), labelx, 20, bigTextPaint);
            const nbColumns = Math.max(1, Math.round(stats.length / Math.floor((h - 105) / 20)));
            const availableWidth = usedWidth / nbColumns - 15;
            let rigthX, nString, text, text2, layoutHeight, staticLayout;
            stats.forEach((s) => {
                const rigthX = x + s.perc * usedWidth;
                barPaint.color = 'white';
                barPaint.style = Style.STROKE;
                canvas.drawRect(x, 35, rigthX, 75, barPaint);
                barPaint.color = colors[s.id] || '#000000';
                barPaint.style = Style.FILL;
                canvas.drawRect(x, 35, rigthX, 75, barPaint);
                x = rigthX;
                text = lc(s.id);
                text2 = formatDistance(s.dist * 1000, s.dist < 1 ? 0 : 1);
                canvas.drawCircle(labelx + 3, labely - 4, 6, barPaint);
                nString = createNativeAttributedString(
                    {
                        spans: [
                            {
                                fontWeight: 'bold',
                                text: text + ': '
                            },
                            {
                                text: text2,
                                color: $subtitleColor,
                                fontSize: 12
                            }
                        ]
                    }
                );
                staticLayout = new StaticLayout(nString, textPaint, availableWidth, LayoutAlignment.ALIGN_NORMAL, 1, 0, true);
                layoutHeight = staticLayout.getHeight();
                canvas.save();
                canvas.translate(labelx + 15, labely - 14);
                staticLayout.draw(canvas);
                canvas.restore();
                if (labely < h - layoutHeight) {
                    labely += layoutHeight;
                } else {
                    labely = 105;
                    labelx += usedWidth / nbColumns;
                }
            });
        } catch (error) {
            console.error(error);
        }
    }
</script>

<gridlayout {...$$restProps} width="100%" rows={`${INFOVIEW_HEIGHT},50,auto,auto,auto`} columns="*,auto" backgroundColor={$widgetBackgroundColor} on:tap={() => {}}>
    {#if loaded}
        <BottomSheetInfoView bind:this={infoView} {item} />
        <mdactivityindicator visibility={updatingItem ? 'visible' : 'collapsed'} horizontalAligment="right" busy={true} width={20} height={20} />
        <IconButton col={1} text="mdi-crosshairs-gps" isVisible={itemIsRoute} on:tap={zoomToItem} />
        <stacklayout orientation="horizontal" row={1} colSpan={2} borderTopWidth={1} borderBottomWidth={1} borderColor={$borderColor} id="bottomsheetbuttons">
            <IconButton on:tap={deleteItem} tooltip={lc('delete')} isVisible={!!item?.id} color="red" text="mdi-delete" rounded={false} />
            <IconButton on:tap={hideItem} tooltip={lc('hide')} isVisible={!!item?.id && itemIsRoute} text="mdi-eye-off" rounded={false} />
            <IconButton on:tap={searchWeb} tooltip={lc('search_web')} isVisible={item && (!itemIsRoute || item.properties?.name) && !item.id} text="mdi-web" rounded={false} />
            {#if packageService.hasElevation()}
                <IconButton on:tap={() => getProfile()} tooltip={lc('elevation_profile')} isVisible={itemIsRoute && itemCanQueryProfile} text="mdi-chart-areaspline" rounded={false} />
            {/if}
            <IconButton on:tap={() => getStats()} tooltip={lc('road_stats')} isVisible={itemIsRoute && itemCanQueryStats} text="mdi-chart-bar-stacked" rounded={false} />
            <IconButton on:tap={() => saveItem()} tooltip={lc('save')} isVisible={item && !item.id} text="mdi-map-plus" rounded={false} />
            <!-- <IconButton on:tap={shareItem} tooltip={lc('share')} isVisible={itemIsRoute} text="mdi-share-variant" rounded={false} /> -->
            {#if item && item.properties && !!item.properties.wikipedia}
                <IconButton on:tap={openWikipedia} tooltip={lc('wikipedia')} text="mdi-wikipedia" rounded={false} />
            {/if}
            {#if !itemIsRoute && networkService.canCheckWeather}
                <IconButton on:tap={checkWeather} tooltip={lc('weather')} text="mdi-weather-partly-cloudy" rounded={false} />
            {/if}
            <IconButton id="astronomy" on:tap={showAstronomy} isVisible={!itemIsRoute} tooltip={lc('astronomy')} text="mdi-weather-night" rounded={false} />
            {#if packageService.hasElevation()}
                <IconButton on:tap={openPeakFinder} tooltip={lc('peaks')} isVisible={!itemIsRoute} text="mdi-summit" rounded={false} />
            {/if}
            <IconButton on:tap={openCompass} tooltip={lc('compass')} isVisible={(itemIsRoute && !item?.id) || !!currentLocation} text="mdi-compass-outline" rounded={false} />

            <IconButton on:tap={getTransitLines} tooltip={lc('bus_stop_infos')} isVisible={itemIsBusStop} text="mdi-bus" rounded={false} />
        </stacklayout>
        <ElevationChart bind:this={elevationChart} {item} row={2} colSpan={2} height={PROFILE_HEIGHT} visibility={graphAvailable ? 'visible' : 'collapsed'} on:highlight={onChartHighlight} />
        <gridlayout row={3} colSpan={2} height={STATS_HEIGHT} visibility={statsAvailable ? 'visible' : 'collapsed'}>
            <canvas bind:this={statsCanvas} on:draw={drawStats} />
            <IconButton
                small={true}
                fontSize={20}
                text="mdi-chevron-right"
                verticalAlignment="top"
                horizontalAlignment="right"
                isEnabled={statsKey === 'waytypes'}
                on:tap={() => setStatsKey('surfaces')}
            />
            <IconButton
                small={true}
                fontSize={20}
                text="mdi-chevron-left"
                verticalAlignment="top"
                horizontalAlignment="right"
                marginRight={25}
                isEnabled={statsKey === 'surfaces'}
                on:tap={() => setStatsKey('waytypes')}
            />
        </gridlayout>

        <!-- <AWebView
            row={3}
            height={webViewHeight}
            displayZoomControls="false"
            bind:this="listView"
            visibility={listViewVisible ? 'visible' : 'collapsed'}
            @scroll="onListViewScroll"
            isScrollEnabled={scrollEnabled}
            src={webViewSrc}
        /> -->
        <!-- <collectionView
            id="bottomsheetListView"
            row={3}
            rowHeight={40}
            items="routeInstructions"
            visibility={showListView ? 'visible' : 'hidden'}
            isBounceEnabled="false"
        >
            <v-template>
                <gridLayout columns="30,*" rows="*,auto,auto,*" rippleColor="white" on:tap={onInstructionTap(item)}>
                    <label rowSpan={4} text="getRouteInstructionIcon(item) |fonticon" class="osm" color="white" fontSize={20} verticalAlignment="middle" textAlignment='center' />
                    <label col={1} row={1} text="getRouteInstructionTitle(item)" color="white" fontSize={13} fontWeight='bold' textWrap={true} />
                </gridLayout>
            </v-template>
        </collectionView> -->
    {/if}
</gridlayout>
