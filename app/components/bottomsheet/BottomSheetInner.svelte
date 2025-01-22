<script lang="ts">
    import addressFormatter from '@akylas/address-formatter';
    import { lc } from '@nativescript-community/l';
    import { createNativeAttributedString } from '@nativescript-community/text';
    import { Canvas, CanvasView, LayoutAlignment, Paint, StaticLayout, Style } from '@nativescript-community/ui-canvas';
    import { GenericMapPos, fromNativeMapPos } from '@nativescript-community/ui-carto/core';
    import { TileDataSource } from '@nativescript-community/ui-carto/datasources';
    import { RasterTileLayer } from '@nativescript-community/ui-carto/layers/raster';
    import type { VectorTileEventData } from '@nativescript-community/ui-carto/layers/vector';
    import { distanceToEnd, isLocationOnPath } from '@nativescript-community/ui-carto/utils';
    import type { Entry } from '@nativescript-community/ui-chart/data/Entry';
    import { Highlight } from '@nativescript-community/ui-chart/highlight/Highlight';
    import { SwipeMenu } from '@nativescript-community/ui-collectionview-swipemenu';
    import { showBottomSheet } from '@nativescript-community/ui-material-bottomsheet/svelte';
    import { Application, ApplicationSettings, Color } from '@nativescript/core';
    import { openUrl } from '@nativescript/core/utils';
    import type { Point } from 'geojson';
    import { onDestroy, onMount } from 'svelte';
    import { NativeViewElementNode } from 'svelte-native/dom';
    import { get } from 'svelte/store';
    import BottomSheetInfoView from '~/components/bottomsheet/BottomSheetInfoView.svelte';
    import { formatDistance } from '~/helpers/formatter';
    import { langStore } from '~/helpers/locale';
    import { formatter } from '~/mapModules/ItemFormatter';
    import { getMapContext, handleMapAction } from '~/mapModules/MapModule';
    import type { Item, RouteInstruction } from '~/models/Item';
    import { networkService } from '~/services/NetworkService';
    import { packageService } from '~/services/PackageService';
    import { showError } from '@shared/utils/showError';
    import { computeDistanceBetween } from '~/utils/geo';
    import { share } from '@akylas/nativescript-app-utils/share';
    import { navigate } from '@shared/utils/svelte/ui';
    import { hideLoading, openLink, showLoading, showPopoverMenu } from '~/utils/ui/index.common';
    import { actionBarButtonHeight, colors } from '~/variables';
    import ElevationChart from '../chart/ElevationChart.svelte';
    import IconButton from '../common/IconButton.svelte';
    import { compareArrays } from '~/utils/utils';
    import { ALERT_OPTION_MAX_HEIGHT } from '~/utils/constants';
    import { VerticalPosition } from '@nativescript-community/ui-popover';

    $: ({ colorError, colorOnSurface, colorOnSurfaceVariant, colorOutlineVariant, colorPrimary, colorWidgetBackground } = $colors);
    const PROFILE_HEIGHT = 150;
    const STATS_HEIGHT = 180;
    const WEB_HEIGHT = 400;
    const INFOVIEW_HEIGHT = 86;

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
    let swipemenu: NativeViewElementNode<SwipeMenu>;
    // const webViewSrc: string = null;
    // let showListView = false;
    // $: showListView = listViewAvailable && listViewVisible;
    let itemIsRoute = false;
    let itemIsEditingItem = false;
    let itemCanBeEdited = false;
    let itemIsBusStop = false;
    let itemCanBeAdded = false;
    let itemCanQueryProfile = false;
    let itemCanQueryStats = false;
    let currentLocation: GenericMapPos<LatLonKeys> = null;

    onMount(() => {
        updateSteps();
    });

    mapContext.onMapReady(() => {
        // updateSteps();
        mapContext.mapModule('userLocation').on('location', onNewLocation);
    });
    onDestroy(() => {
        mapContext.mapModule('userLocation').on('location', onNewLocation);
    });

    let dataToUpdateOnItemSelect = null;

    mapContext.onVectorTileElementClicked((data: VectorTileEventData<LatLonKeys>) => {
        const { feature, featureData, position } = data;
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
    //     if (item) {
    //         console.log('selected item ', item.id, item.properties?.address, item.geometry);
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
                    const { highlight, onPathIndex, remainingDistance, remainingTime } = chartLoadHighlightData;
                    elevationChart.hilghlightPathIndex(onPathIndex, remainingDistance, remainingTime, highlight, false);
                } catch (error) {
                    console.error(error, error.stack);
                } finally {
                    chartLoadHighlightData = null;
                }
            }
        } catch (error) {
            console.error(error, error.stack);
        }
    }
    function openWikipedia() {
        try {
            const props = item && item.properties;
            DEV_LOG && console.log('openWikipedia', props.wikipedia);
            if (props?.wikipedia) {
                const url = `https://en.wikipedia.org/wiki/${props.wikipedia}`;
                openLink(url);
            } else if (props?.name) {
                const url = `https://en.wikipedia.org/wiki/Special:Search?search=${props.name}`;
                openLink(url);
            }
        } catch (error) {
            showError(error);
        }
    }
    function searchWeb(canUseWebsite = true) {
        let query;
        try {
            const props = item && item.properties;
            if (props) {
                query = props.name || formatter.getItemPositionToString(item);
                if (canUseWebsite && props.website) {
                    query = props.website;
                } else {
                    // if (props.wikipedia) {
                    //     query = props.wikipedia.split(':')[1];
                    // }
                    if (props.address?.county && props.address?.county !== query) {
                        query += ' ' + props.address.county;
                    }
                }
                console.log('searchWeb', query);
                if (query) {
                    if (__ANDROID__) {
                        const intent = new Intent(Intent.ACTION_WEB_SEARCH);
                        intent.putExtra('query', query);
                        Application.android.startActivity.startActivity(intent);
                    } else {
                        throw new Error();
                    }
                }
            }
        } catch (err) {
            console.error(err, err.stack);
            if (query) {
                const url = `https://duckduckgo.com/?kae=d&ks=s&ko=-2&kaj=m&k1=-1&q=${encodeURIComponent(query).toLowerCase().replace('/s+/g', '+')}`;
                openLink(url);
            }
        }
    }
    async function showInformation() {
        try {
            // if (!item.properties?.osmid && !networkService.connected) {
            //     throw new NoNetworkError();
            // }
            const ItemInfo = (await import('~/components/items/ItemInfo.svelte')).default;
            // const hasOpenHours = !!item.properties?.opening_hours;
            const hasOpenHours = __ANDROID__;
            await showBottomSheet({
                parent: mapContext.getMainPage(),
                view: ItemInfo,
                peekHeight: hasOpenHours ? 300 : undefined,
                props: {
                    item,
                    height: hasOpenHours ? undefined : 300
                }
            });
        } catch (error) {
            showError(error);
        }
    }
    function updateGraphAvailable() {
        graphAvailable = itemIsRoute && !!item.profile && !!item.profile.data && item.profile.data.length > 0;
    }
    function updateStatsAvailable() {
        statsAvailable = itemIsRoute && !!item.stats;
        if (statsAvailable && statsCanvas) {
            statsCanvas.nativeView.invalidate();
        }
    }

    function updateSelectedItem(item) {
        try {
            // DEV_LOG && console.log('updateSelectedItem', !!item, Date.now());
            if (item) {
                swipemenu?.nativeView?.close('right', 0);
                itemIsRoute = !!item?.route;
                itemIsEditingItem = !!item?.properties.editingId && item?.properties.editingId === mapContext.getEditingItem()?.id;
                itemCanBeEdited = !!item && !!item.id && !itemIsEditingItem;
                itemCanBeAdded = !!item && (!item.id || !!itemIsEditingItem);
                itemIsBusStop = !!item && (item.properties?.class === 'bus' || item.properties?.subclass === 'tram_stop');
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
                DEV_LOG && console.log('updateRouteItemWithPosition', location, JSON.stringify(positions));
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
            const name = formatter.getItemTitle(item);
            const subtitle = formatter.getItemSubtitle(item, name);
            handleMapAction('astronomy', { name, subtitle, location: { lat: positions[1], lon: positions[0] }, timezone: item.properties.timezone });
        }
    }
    function closeSwipeMenu(animated = true) {
        swipemenu?.nativeView?.close(undefined, animated ? undefined : 0);
    }
    function zoomToItem() {
        closeSwipeMenu();
        mapContext.zoomToItem({ item, forceZoomOut: true });
    }
    // let webViewHeight = 0;
    // let listViewAvailable = false;
    // const listViewVisible = false;
    export let steps;
    export let navigationInstructions: {
        remainingDistance: number;
        remainingTime: number;
        distanceToNextInstruction: number;
        instruction: RouteInstruction;
    };

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
        // if (listViewAvailable) {
        //     total += WEB_HEIGHT;
        //     result.push(total);
        //     const delta = Math.floor(screenHeightDips - $statusBarHeight - total);
        //     webViewHeight = WEB_HEIGHT + delta;
        //     total += delta;
        //     result.push(total);
        // }
        if (compareArrays(steps, result) === false) {
            steps = result;
        }
    }

    let updatingItem = false;

    async function updateEditedItem() {
        try {
            updatingItem = true;
            const itemsModule = mapContext.mapModule('items');
            let item = mapContext.getSelectedItem();
            const isRoute = !!item.route;
            const editingItem = mapContext.getEditingItem();
            item.image_path = editingItem.image_path;
            item.id = editingItem.id;
            delete item.properties.editingId;
            // TODO: do we always remove it?
            if (item.properties) {
                delete item.properties.style;
            }
            DEV_LOG && console.log('updateEditedItem1', item.id, editingItem.id, !!editingItem.profile, !!editingItem.stats);
            if (editingItem.profile) {
                const profile = await packageService.getElevationProfile(item);
                item['_parsedProfile'] = profile;
            }
            if (editingItem.stats) {
                const projection = mapContext.getProjection();
                const stats = await packageService.fetchStats({ item, projection });
                item['_parsedStats'] = stats;
            }
            item = await itemsModule.updateItem(item, undefined, true, false);
            mapContext.selectItem({ item, isFeatureInteresting: true, peek: true, preventZoom: false });
            updateGraphAvailable();
            updateSteps();
            if (elevationChart && graphAvailable) {
                elevationChart.updateChartData();
            }
            if (isRoute) {
                await mapContext.mapModules.directionsPanel.cancel(false);
            }
            if (item.route) {
                itemsModule.takeItemPicture(item);
            }
        } catch (err) {
            showError(err);
        } finally {
            updatingItem = false;
        }
    }
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

    function onChartHighlight({ highlight, lat, lon }: any) {
        DEV_LOG && console.log('BottomSheetInner onChartHighlight', lat, lon, highlight);
        updateRouteItemWithPosition(item, { lat, lon }, false, true, highlight);
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

    async function saveItem(peek = true) {
        if (itemIsEditingItem) {
            updateEditedItem();
            return;
        }
        DEV_LOG && console.log('saveItem', item);
        try {
            updatingItem = true;
            const itemsModule = mapContext.mapModule('items');
            let item = mapContext.getSelectedItem();
            if (!item) {
                return;
            }

            item = await itemsModule.saveItem(item);
            if (item.route) {
                mapContext.mapModules.directionsPanel.cancel(false);
            }
            if (item.route) {
                itemsModule.takeItemPicture(item);
            } else {
                mapContext.selectItem({ item, isFeatureInteresting: true, peek, preventZoom: false });
            }
        } catch (err) {
            showError(err);
        } finally {
            updatingItem = false;
        }
    }

    async function updateItem(item: Item, data: Partial<Item>, peek = true) {
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
    async function shareItem(event) {
        // if (item?.route) {
        //     if (!item.profile && itemCanQueryProfile) {
        //         await getProfile(false);
        //     }
        //     // const gpx = await toGPX();
        //     // mapContext.mapModules.items.shareFile(gpx.string, `${gpx.name.replace(/[\s\t]/g, '_')}.gpx`);
        // }
        try {
            const OptionSelect = (await import('~/components/common/OptionSelect.svelte')).default;
            const options = [{ name: lc('geoson'), data: 'geojson' }];
            if (item.properties?.address) {
                options.unshift({ name: lc('address'), data: 'address' });
            }
            if (itemIsRoute) {
                options.push({ name: lc('gpx'), data: 'gpx' });
            } else {
                options.push({ name: lc('position'), data: 'position' });
            }
            await showPopoverMenu({
                options,
                anchor: event.object,
                vertPos: VerticalPosition.ABOVE,
                onClose: async (result) => {
                    if (result) {
                        switch (result.data) {
                            case 'address':
                                const address = { ...item.properties.address };
                                if (!address.name) {
                                    address.name = item.properties.name;
                                }
                                // console.log('item', JSON.stringify(item));
                                // console.log('address', JSON.stringify(address));
                                // console.log('test1', addressFormatter.format(address, {
                                //     fallbackCountryCode:get(langStore)
                                // }));
                                // console.log('test2', formatter.getItemName(item) + ',' + formatter.getItemAddress(item));
                                // clipboard.copy(
                                // addressFormatter.format(address, {
                                //     fallbackCountryCode: get(langStore)
                                // })
                                // );
                                share(
                                    {
                                        message: addressFormatter.format(address, {
                                            fallbackCountryCode: get(langStore)
                                        })
                                    },
                                    {
                                        dialogTitle: lc('share')
                                    }
                                );
                                break;
                            case 'position':
                                // clipboard.copy(formatter.getItemPositionToString(item));

                                share(
                                    {
                                        message: formatter.getItemPositionToString(item)
                                    },
                                    {
                                        dialogTitle: lc('share')
                                    }
                                );
                                break;
                            case 'geojson':
                                showLoading();
                                await mapContext.mapModule('items').shareItemsAsGeoJSON([item]);
                                break;
                            case 'gpx':
                                showLoading();
                                await mapContext.mapModule('items').shareItemsAsGPX([item]);
                                break;
                            default:
                                throw new Error('command not found');
                        }
                    }
                }
            });
        } catch (error) {
            showError(error);
        } finally {
            hideLoading();
        }
        // shareFile(JSON.stringify(itemToShare), 'sharedItem.json');
    }
    async function checkWeather() {
        try {
            updatingItem = true;
            const query = formatter.getItemTitle(item);
            const geometry = item.geometry as Point;
            let url;
            if (__ANDROID__) {
                url = `weather://query?lat=${geometry.coordinates[1]}&lon=${geometry.coordinates[0]}&name=${query}`;
                if (item.properties.address) {
                    url += `&address=${JSON.stringify(item.properties.address)}`;
                }
            } else {
                url = `https://weather.apple.com/?lat=${geometry.coordinates[1]}&lng=${geometry.coordinates[0]}`;
            }
            DEV_LOG && console.log('checkWeather', url);
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
            const component = (await import('~/components/peaks/PeakFinder.svelte')).default;
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
    async function open3DMap() {
        try {
            const geometry = item.geometry as Point;
            const position = { lat: geometry.coordinates[1], lon: geometry.coordinates[0], altitude: geometry.coordinates[2] };
            if (!position.altitude) {
                position.altitude = item.properties.ele || (await packageService.getElevation(position));
            }
            // const { default: component } = await import('~/components/PeakFinder.svelte');
            const component = (await import('~/components/3d/3DMap.svelte')).default;
            navigate({
                page: component,
                props: {
                    position,
                    pitch: 45,
                    zoom: mapContext.getMap().zoom,
                    bearing: mapContext.getMap().bearing
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
                // aim for the start point!
                updateWithUserLocation = false;
                const points = mapContext.mapModules.directionsPanel.getFeatures().filter((s) => s.geometry.type === 'Point');
                location = { lat: (points[0].geometry as Point).coordinates[1], lon: (points[0].geometry as Point).coordinates[0] };
                aimingItems = points.slice(1);
            }
            const CompassView = (await import('~/components/compass/CompassView.svelte')).default;
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
            if (itemIsRoute) {
                const component = (await import('~/components/transit/TransitLineDetails.svelte')).default;
                navigate({
                    page: component,
                    props: {
                        line: { geometry: item.geometry, ...item.properties } as any
                    }
                });
            } else {
                const TransitLinesBottomSheet = (await import('~/components/transit/TransitLinesBottomSheet.svelte')).default;
                const geometry = item.geometry as Point;
                const position = { lat: geometry.coordinates[1], lon: geometry.coordinates[0], altitude: geometry.coordinates[2] };
                showBottomSheet({ parent: mapContext.getMainPage(), trackingScrollView: 'scrollView', view: TransitLinesBottomSheet, props: { name: formatter.getItemName(item), position } });
            }
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

    // on iOS the first animation would not be nice so let load it right away
    // the issue must be in UIView.animate being call before a first layout
    let loaded = false;
    let loadedListeners = [];
    export async function loadView() {
        // DEV_LOG && console.log('loadView', loaded, Date.now());
        if (!loaded) {
            await new Promise((resolve) => {
                loadedListeners.push(resolve);
                loaded = true;
            });
        }
        // DEV_LOG && console.log('loadView done', loaded);
    }
    $: {
        try {
            if (infoView && loadedListeners.length > 0) {
                loadedListeners.forEach((l) => l());
                loadedListeners = [];
            }
        } catch (error) {
            console.error(error, error.stack);
        }
    }
    let textPaint: Paint;
    let bigTextPaint: Paint;
    let barPaint: Paint;
    const surfaceColors = {
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

    function drawStats({ canvas }: { canvas: Canvas; object: CanvasView }) {
        try {
            if (!item?.stats) {
                return;
            }
            const w = canvas.getWidth();
            const h = canvas.getHeight();

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
            bigTextPaint.color = colorOnSurfaceVariant;
            textPaint.color = colorOnSurface;

            const usedWidth = w - 20;
            let x = 10;
            let labelx = 13;
            let labely = 95;
            const stats = item.stats[statsKey];
            canvas.drawText(lc(statsKey), labelx, 20, bigTextPaint);
            const nbColumns = Math.max(1, Math.round(stats.length / Math.floor((h - 95) / 20)));
            const availableWidth = usedWidth / nbColumns - 15;
            let nString, text, text2, layoutHeight, staticLayout;
            stats.forEach((s) => {
                const rigthX = x + s.perc * usedWidth;
                barPaint.color = 'white';
                barPaint.style = Style.STROKE;
                canvas.drawRect(x, 35, rigthX, 75, barPaint);
                barPaint.color = surfaceColors[s.id] || '#000000';
                barPaint.style = Style.FILL;
                canvas.drawRect(x, 35, rigthX, 75, barPaint);
                x = rigthX;
                text = lc(s.id);
                text2 = formatDistance(s.dist * 1000, s.dist < 1 ? 0 : 1);
                canvas.drawCircle(labelx + 3, labely - 4, 6, barPaint);
                nString = createNativeAttributedString({
                    spans: [
                        {
                            fontWeight: 'bold',
                            text: text + ': '
                        },
                        {
                            text: text2,
                            color: colorOnSurfaceVariant,
                            fontSize: 12
                        }
                    ]
                });
                staticLayout = new StaticLayout(nString, textPaint, availableWidth, LayoutAlignment.ALIGN_NORMAL, 1, 0, true);
                layoutHeight = staticLayout.getHeight();
                canvas.save();
                canvas.translate(labelx + 15, labely - 14);
                staticLayout.draw(canvas);
                canvas.restore();
                if (labely < h - layoutHeight) {
                    labely += layoutHeight;
                } else {
                    labely = 95;
                    labelx += usedWidth / nbColumns;
                }
            });
        } catch (error) {
            console.error(error, error.stack);
        }
    }
    async function startEditingItem() {
        if (itemIsRoute && item.route.waypoints) {
            mapContext.startEditingItem(item);
        } else {
            try {
                const RoutesList = (await import('~/components/items/ItemEdit.svelte')).default;
                navigate({ page: RoutesList, props: { item } });
            } catch (error) {
                showError(error);
            }
        }
    }
    function drawerTranslationFunction(side, width, value, delta, progress) {
        const result = {
            mainContent: {
                translateX: side === 'right' ? -delta : delta
            },
            rightDrawer: {
                translateX: width + (side === 'right' ? -delta : delta)
            },
            leftDrawer: {
                translateX: (side === 'right' ? -delta : delta) - width
            },
            backDrop: {
                translateX: side === 'right' ? -delta : delta,
                opacity: progress * 0.1
            }
        };

        return result;
    }
</script>

<gridlayout id="bottomSheetInner" {...$$restProps} backgroundColor={colorWidgetBackground} rows={`${INFOVIEW_HEIGHT},50,${PROFILE_HEIGHT},${STATS_HEIGHT},auto`} on:tap={() => {}}>
    {#if loaded}
        <swipemenu
            bind:this={swipemenu}
            closeAnimationDuration={100}
            height={INFOVIEW_HEIGHT}
            leftSwipeDistance={0}
            openAnimationDuration={100}
            rightSwipeDistance={0}
            translationFunction={drawerTranslationFunction}>
            <BottomSheetInfoView bind:this={infoView} prop:mainContent colSpan={2} {item} rightTextPadding={itemIsRoute ? $actionBarButtonHeight : 0}>
                <mdactivityindicator slot="above" busy={true} height={20} horizontalAlignment="right" verticalAlignment="top" visibility={updatingItem ? 'visible' : 'hidden'} width={20} />
            </BottomSheetInfoView>
            <IconButton prop:leftDrawer backgroundColor={colorError} color="white" height="100%" shape="none" text="mdi-trash-can" tooltip={lc('delete')} width={60} on:tap={deleteItem} />

            <!-- <stacklayout prop:rightDrawer orientation="horizontal"> -->
            <IconButton
                prop:rightDrawer
                backgroundColor={new Color(colorPrimary).setAlpha(180).hex}
                color="white"
                height="100%"
                shape="none"
                text="mdi-crosshairs-gps"
                width={60}
                on:tap={zoomToItem} />
            <!-- </stacklayout> -->
        </swipemenu>

        <scrollview borderBottomWidth={1} borderColor={colorOutlineVariant} borderTopWidth={1} colSpan={2} orientation="horizontal" row={1}>
            <stacklayout id="bottomsheetbuttons" orientation="horizontal">
                <IconButton isVisible={item && !itemIsRoute} rounded={false} text="mdi-information-outline" tooltip={lc('information')} on:tap={() => showInformation()} />
                <IconButton isVisible={itemCanBeAdded} rounded={false} text={itemIsEditingItem ? 'mdi-content-save-outline' : 'mdi-map-plus'} tooltip={lc('save')} on:tap={() => saveItem()} />

                <!-- {#if packageService.hasElevation()} -->
                <IconButton isVisible={itemIsRoute && itemCanQueryProfile} rounded={false} text="mdi-chart-areaspline" tooltip={lc('elevation_profile')} on:tap={() => getProfile()} />
                <!-- {/if} -->
                <!-- {#if packageService.offlineRoutingSearchService()} -->
                <IconButton isVisible={itemIsRoute && itemCanQueryStats} rounded={false} text="mdi-chart-bar-stacked" tooltip={lc('road_stats')} on:tap={() => getStats()} />
                <!-- {/if} -->
                <IconButton isVisible={!!item?.id && itemIsRoute} rounded={false} text="mdi-eye-off" tooltip={lc('hide')} on:tap={hideItem} />
                <IconButton isVisible={itemCanBeEdited} rounded={false} text="mdi-pencil" tooltip={lc('edit')} on:tap={startEditingItem} />
                <IconButton
                    isVisible={item && (!itemIsRoute || (!!item.properties?.name && item.properties.hasRealName !== false))}
                    onLongPress={() => searchWeb(false)}
                    rounded={false}
                    text="mdi-web"
                    tooltip={lc('search_web')}
                    on:tap={() => searchWeb()} />
                <IconButton isVisible={!itemIsRoute && item && item.properties && !!item.properties.name} rounded={false} text="mdi-wikipedia" tooltip={lc('wikipedia')} on:tap={openWikipedia} />
                {#if networkService.canCheckWeather}
                    <IconButton isVisible={!itemIsRoute} rounded={false} text="mdi-weather-partly-cloudy" tooltip={lc('weather')} on:tap={checkWeather} />
                {/if}
                <IconButton id="astronomy" isVisible={!itemIsRoute} rounded={false} text="mdi-weather-night" tooltip={lc('astronomy')} on:tap={showAstronomy} />
                {#if WITH_PEAK_FINDER && __ANDROID__ && packageService.hasElevation()}
                    <IconButton isVisible={!itemIsRoute} rounded={false} text="mdi-summit" tooltip={lc('peaks')} on:tap={openPeakFinder} />
                {/if}
                {#if WITH_3D_MAP && __ANDROID__ && packageService.hasElevation()}
                    <IconButton isVisible={!itemIsRoute} rounded={false} text="mdi-video-3d" tooltip={lc('threed_map')} on:tap={open3DMap} />
                {/if}
                <IconButton isVisible={(itemIsRoute && !item?.id) || !!currentLocation} rounded={false} text="mdi-compass-outline" tooltip={lc('compass')} on:tap={openCompass} />

                <IconButton isVisible={itemIsBusStop} rounded={false} text="mdi-bus" tooltip={lc('bus_stop_infos')} on:tap={getTransitLines} />
                <IconButton rounded={false} text="mdi-share-variant" tooltip={lc('share')} on:tap={shareItem} />

                <!-- <IconButton on:tap={deleteItem} tooltip={lc('delete')} isVisible={!!item?.id} color="red" text="mdi-delete" rounded={false} /> -->
            </stacklayout>
        </scrollview>
        <!-- <label height={PROFILE_HEIGHT} row={2} visibility={graphAvailable ? 'visible' : 'collapse'}/> -->
        <ElevationChart bind:this={elevationChart} colSpan={2} {item} row={2} visibility={graphAvailable ? 'visible' : 'collapse'} on:highlight={onChartHighlight} />
        <canvasview bind:this={statsCanvas} colSpan={2} row={3} visibility={statsAvailable ? 'visible' : 'collapse'} on:draw={drawStats}>
            <IconButton
                fontSize={20}
                horizontalAlignment="right"
                isEnabled={statsKey === 'waytypes'}
                small={true}
                text="mdi-chevron-right"
                verticalAlignment="top"
                on:tap={() => setStatsKey('surfaces')} />
            <IconButton
                fontSize={20}
                horizontalAlignment="right"
                isEnabled={statsKey === 'surfaces'}
                marginRight={25}
                small={true}
                text="mdi-chevron-left"
                verticalAlignment="top"
                on:tap={() => setStatsKey('waytypes')} />
        </canvasview>

        <!-- <AWebView
            row={3}
            height={webViewHeight}
            displayZoomControls={false}
            bind:this="listView"
            visibility={listViewVisible ? 'visible' : 'collapse'}
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
            isBounceEnabled={false}
        >
            <v-template>
                <gridlayout columns="30,*" rows="*,auto,auto,*" rippleColor="white" on:tap={onInstructionTap(item)}>
                    <label rowSpan={4} text="getRouteInstructionIcon(item) |fonticon" class="osm" color="white" fontSize={20} verticalAlignment="middle" textAlignment='center' />
                    <label col={1} row={1} text="getRouteInstructionTitle(item)" color="white" fontSize={13} fontWeight='bold' textWrap={true} />
                </gridlayout>
            </v-template>
        </collectionView> -->
    {/if}
</gridlayout>
