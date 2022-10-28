<script lang="ts">
    import { l, lc } from '@nativescript-community/l';
    import { Align, Canvas, DashPathEffect, LayoutAlignment, Paint, StaticLayout, Style } from '@nativescript-community/ui-canvas';
    import { fromNativeMapPos, GenericMapPos } from '@nativescript-community/ui-carto/core';
    import { TileDataSource } from '@nativescript-community/ui-carto/datasources';
    import { RasterTileLayer } from '@nativescript-community/ui-carto/layers/raster';
    import type { VectorTileEventData } from '@nativescript-community/ui-carto/layers/vector';
    import { CartoMap } from '@nativescript-community/ui-carto/ui';
    import { distanceToEnd, isLocationOnPath } from '@nativescript-community/ui-carto/utils';
    import { LineChart } from '@nativescript-community/ui-chart/charts';
    import type { HighlightEventData } from '@nativescript-community/ui-chart/charts/Chart';
    import { XAxisPosition } from '@nativescript-community/ui-chart/components/XAxis';
    import type { Entry } from '@nativescript-community/ui-chart/data/Entry';
    import { LineData } from '@nativescript-community/ui-chart/data/LineData';
    import { LineDataSet, Mode } from '@nativescript-community/ui-chart/data/LineDataSet';
    import { Highlight } from '@nativescript-community/ui-chart/highlight/Highlight';
    import { showSnack } from '@nativescript-community/ui-material-snackbar';
    import { Application, Utils } from '@nativescript/core';
    import { openUrl } from '@nativescript/core/utils';
    import type { Point } from 'geojson';
    import { onDestroy, onMount } from 'svelte';
    import { NativeViewElementNode, navigate } from 'svelte-native/dom';
    import BottomSheetInfoView from '~/components/BottomSheetInfoView.svelte';
    import { formatValueToUnit, UNITS } from '~/helpers/formatter';
    import { slc } from '~/helpers/locale';
    import { onThemeChanged } from '~/helpers/theme';
    import { formatter } from '~/mapModules/ItemFormatter';
    import { getMapContext, handleMapAction } from '~/mapModules/MapModule';
    import type { IItem, IItem as Item, ItemProperties, RouteInstruction } from '~/models/Item';
    import { networkService } from '~/services/NetworkService';
    import { packageService } from '~/services/PackageService';
    import { showError } from '~/utils/error';
    import { computeDistanceBetween } from '~/utils/geo';
    import { showBottomSheet } from '~/utils/svelte/bottomsheet';
    import { openLink } from '~/utils/ui';
    import { borderColor, screenHeightDips, statusBarHeight, textColor, widgetBackgroundColor } from '~/variables';
    import IconButton from './IconButton.svelte';

    const LISTVIEW_HEIGHT = 200;
    const PROFILE_HEIGHT = 150;
    const WEB_HEIGHT = 400;
    const INFOVIEW_HEIGHT = 80;

    const mapContext = getMapContext();
    const highlightPaint = new Paint();
    highlightPaint.setColor('#8687A2');
    highlightPaint.setAntiAlias(true);
    // highlightPaint.setTextAlign(Align.CENTER);
    highlightPaint.setStrokeWidth(1);
    highlightPaint.setTextSize(10);

    const Intent = __ANDROID__ ? android.content.Intent : undefined;

    export let item: Item;
    let profileHeight = PROFILE_HEIGHT;
    let graphAvailable = false;
    let chart: NativeViewElementNode<LineChart>;
    let infoView: BottomSheetInfoView;
    let webViewSrc: string = null;
    let showListView = false;
    $: showListView = listViewAvailable && listViewVisible;
    let itemIsRoute = false;
    let itemIsBusStop = false;
    let itemCanQueryProfile = false;
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

    mapContext.onVectorTileElementClicked((data: VectorTileEventData<LatLonKeys>) => {
        const { clickType, position, feature, featureData } = data;
        if (item && item.id && featureData?.route && feature.properties?.id === item.id) {
            updateRouteItemWithPosition(item, position, true, true);
        }
    });

    $: {
        if (itemIsRoute && currentLocation) {
            updateRouteItemWithPosition(item, currentLocation);
        }
    }
    $: {
        if (!item) {
            navigationInstructions = null;
        }
    }
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
    function openWikipedia() {
        try {
            const props = item && item.properties;
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
        graphAvailable = itemIsRoute && !!item.properties.profile && !!item.properties.profile.data && item.properties.profile.data.length > 0;
    }
    $: {
        try {
            itemIsRoute = !!item?.properties?.route;
            itemIsBusStop = item && !itemIsRoute && (item.properties?.class === 'bus' || item.properties?.subclass === 'tram_stop');
            itemCanQueryProfile = itemIsRoute;
            updateGraphAvailable();
            if (graphAvailable) {
                updateChartData();
            }
            updateSteps();
        } catch (err) {
            console.error('item changed', !!err, err, err.stack);
            // showError(err);
        }
    }

    $: {
        try {
            if (chart && graphAvailable) {
                updateChartData();
            }
        } catch (err) {
            console.error('updateChartData', !!err, err, err.stack);
            showError(err);
        }
    }

    function updateRouteItemWithPosition(routeItem: Item, location: GenericMapPos<LatLonKeys>, updateNavigationInstruction = true, updateGraph = true) {
        if (routeItem?.properties?.route) {
            const props = routeItem.properties;
            const route = props.route;
            const positions = packageService.getRouteItemPoses(routeItem);
            const onPathIndex = isLocationOnPath(location, positions, false, true, 2 * Math.pow(2, 2 * Math.max(0, 17 - mapContext.getMap().getZoom())));
            if (props.instructions && onPathIndex !== -1 && updateNavigationInstruction) {
                let routeInstruction;
                for (let index = props.instructions.length - 1; index >= 0; index--) {
                    const element = props.instructions[index];
                    if (element.index < onPathIndex) {
                        break;
                    }
                    routeInstruction = element;
                }

                const distance = distanceToEnd(onPathIndex, positions);
                let distanceToNextInstruction = computeDistanceBetween(location, fromNativeMapPos(positions.get(onPathIndex)));
                for (let index = onPathIndex; index < routeInstruction.index; index++) {
                    distanceToNextInstruction += computeDistanceBetween(fromNativeMapPos(positions.get(index)), fromNativeMapPos(positions.get(index + 1)));
                }
                navigationInstructions = {
                    instruction: routeInstruction,
                    remainingDistance: distance,
                    distanceToNextInstruction,
                    remainingTime: ((route.totalTime * distance) / route.totalDistance) * 1000
                };
            }
            if (updateGraph && graphAvailable) {
                if (onPathIndex === -1) {
                    chart.nativeView.highlight(null);
                } else {
                    const profile = props.profile;
                    const profileData = profile?.data;
                    if (profileData) {
                        const dataSet = chart.nativeView.getData().getDataSetByIndex(0);
                        dataSet.setIgnoreFiltered(true);
                        const item = profileData[onPathIndex];
                        dataSet.setIgnoreFiltered(false);
                        chart.nativeView.highlightValues([
                            {
                                dataSetIndex: 0,
                                x: onPathIndex,
                                entry: item
                            } as any
                        ]);
                    }
                }
            }
        } else if (updateNavigationInstruction) {
            navigationInstructions = null;
        }
    }

    function onNewLocation(e: any) {
        currentLocation = e.data;
        updateRouteItemWithPosition(item, currentLocation);
    }

    function showAstronomy() {
        if (item) {
            const positions = item.geometry.type === 'Point' ? item.geometry?.['coordinates'] : item.geometry?.['coordinates'][0];
            console.log('showAstronomy', positions);
            handleMapAction('astronomy', { lat: positions[1], lon: positions[0] });
        }
    }
    function onChartHighlight(event: HighlightEventData) {
        const x = event.highlight.entryIndex;
        const positions = item.geometry?.['coordinates'];
        const position = positions[Math.max(0, Math.min(x, positions.length - 1))];
        if (position) {
            updateRouteItemWithPosition(item, { lat: position[1], lon: position[0] }, false, false);
            mapContext.selectItem({
                item: { geometry: { type: 'Point', coordinates: position } },
                isFeatureInteresting: true,
                setSelected: false,
                peek: false,
                zoomDuration: 100,
                preventZoom: false
            });
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
    // $: console.log('updateSteps changed', steps);

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
        if (listViewAvailable) {
            total += WEB_HEIGHT;
            result.push(total);
            const delta = Math.floor(screenHeightDips - statusBarHeight - total);
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
                    item.properties.profile = profile;
                    await saveItem(false);
                }
                updateGraphAvailable();
                updateSteps();
                if (graphAvailable) {
                    updateChartData();
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
        try {
            updatingItem = true;
            const item = await mapContext.mapModule('items').saveItem(mapContext.getSelectedItem());
            mapContext.mapModules.directionsPanel.cancel(false);
            mapContext.selectItem({ item, isFeatureInteresting: true, peek });
        } catch (err) {
            showError(err);
        } finally {
            updatingItem = false;
        }
    }
    async function updateItem(item: IItem, data: Partial<ItemProperties>, peek = true) {
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
    async function shareItem() {
        if (item.properties?.route) {
            if (!item.properties?.profile && itemCanQueryProfile) {
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
            openUrl(`weather://query?lat=${geometry.coordinates[1]}&lon=${geometry.coordinates[0]}&name=${query}`);
            // const result = await networkService.sendWeatherBroadcastQuery({ ...item.position, timeout: 10000 });
            // const WeatherBottomSheet = (await import('./WeatherBottomSheet.svelte')).default;
            // await showBottomSheet({
            //     parent: mapContext.getMainPage(),
            //     view: WeatherBottomSheet,
            //     props: { item:result[0] }
            // });
        } catch (err) {
            this.showError(err);
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
            const { default: component } = await import('~/components/PeakFinder.svelte');
            // const component = (await import('~/components/PeakFinder.svelte')).default;
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
            this.showError(err);
        }
    }

    async function getTransitLines() {
        try {
            const TransitLinesBottomSheet = (await import('~/components/transit/TransitLinesBottomSheet.svelte')).default;
            const geometry = item.geometry as Point;
            const position = { lat: geometry.coordinates[1], lon: geometry.coordinates[0], altitude: geometry.coordinates[2] };
            showBottomSheet({ parent: mapContext.getMainPage(), trackingScrollView: 'scrollView', view: TransitLinesBottomSheet, props: { name: formatter.getItemName(item), position } });
        } catch (err) {
            this.showError(err);
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
    let chartInitialized = false;

    onThemeChanged(() => {
        if (!chart) {
            return;
        }
        const chartView = chart.nativeView;

        const leftAxis = chartView.getAxisLeft();
        leftAxis.setTextColor($textColor);
        leftAxis.setGridColor($borderColor);
        const xAxis = chartView.getXAxis();
        xAxis.setTextColor($textColor);
        xAxis.setGridColor($borderColor);
        const set = chartView.getData()?.getDataSetByIndex(0)?.setValueTextColor($textColor);
    });
    function updateChartData() {
        if (!chart) {
            return;
        }
        const chartView = chart.nativeView;
        const sets = [];
        const profile = item.properties?.profile;
        const profileData = profile?.data;
        if (profileData) {
            const xAxis = chartView.getXAxis();
            if (!chartInitialized) {
                chartInitialized = true;
                chartView.panGestureOptions = { minDist: 40, failOffsetYEnd: 20 };
                chartView.setHighlightPerDragEnabled(true);
                chartView.setHighlightPerTapEnabled(true);
                chartView.setScaleXEnabled(true);
                chartView.setDoubleTapToZoomEnabled(true);
                chartView.setDragEnabled(true);
                chartView.clipHighlightToContent = false;
                chartView.setClipValuesToContent(false);
                // chartView.setExtraTopOffset(30);
                chartView.setExtraOffsets(0, 0, 0, 0);
                chartView.getAxisRight().setEnabled(false);
                chartView.getLegend().setEnabled(false);
                const leftAxis = chartView.getAxisLeft();
                leftAxis.setTextColor($textColor);
                leftAxis.setDrawZeroLine(true);
                leftAxis.setGridColor($borderColor);

                leftAxis.setGridDashedLine(new DashPathEffect([6, 3], 0));
                leftAxis.ensureLastLabel = true;
                // leftAxis.setLabelCount(3);

                xAxis.setPosition(XAxisPosition.BOTTOM);
                xAxis.setLabelTextAlign(Align.CENTER);
                xAxis.ensureLastLabel = true;
                xAxis.setTextColor($textColor);
                xAxis.setGridColor($borderColor);
                xAxis.setDrawGridLines(false);
                xAxis.setDrawMarkTicks(true);
                xAxis.setValueFormatter({
                    getAxisLabel: (value, axis, viewPortHandler) => Math.floor(value / 1000).toFixed()
                });

                chartView.setCustomRenderer({
                    drawHighlight(c: Canvas, h: Highlight<Entry>, set: LineDataSet, paint: Paint) {
                        // const canvasHeight = c.getHeight();
                        const x = h.drawX;
                        const y = h.drawY;
                        const w = 50;
                        highlightPaint.setColor('white');
                        const layout = new StaticLayout(
                            h.entry.a.toFixed() +
                                'm' +
                                '\n' +
                                Math.abs(h.entry.avg.toFixed()) +
                                '%(' +
                                '~' +
                                Math.abs(h.entry.g.toFixed()) +
                                '%)' +
                                '\n' +
                                formatValueToUnit(h.entry.d, UNITS.DistanceKm),
                            highlightPaint,
                            w,
                            LayoutAlignment.ALIGN_CENTER,
                            1,
                            0,
                            true
                        );

                        highlightPaint.setColor('#8687A2');
                        paint.setColor('#8687A2');
                        paint.setStyle(Style.FILL);

                        let layoutyY = 0;
                        const layoutHeight = layout.getHeight();
                        if (y <= layoutHeight + 15) {
                            layoutyY = y + 15;
                            c.drawLine(x, y + 2, x, layoutyY, highlightPaint);
                        } else {
                            c.drawLine(x, 0, x, y - 2, highlightPaint);
                        }
                        highlightPaint.setColor('white');
                        c.drawRoundRect(x - w / 2, layoutyY, x + w / 2, layoutyY + layoutHeight, 2, 2, paint);
                        c.save();
                        c.translate(x - w / 2, layoutyY);
                        layout.draw(c);
                        c.restore();
                    }
                });
            } else {
                chartView.highlightValues(null);
                chartView.resetZoom();
            }
            const chartData = chartView.getData();
            if (!chartData) {
                const set = new LineDataSet(profileData, 'a', 'd', 'a');
                set.setDrawValues(true);
                set.setValueTextColor($textColor);
                set.setValueTextSize(10);
                set.setMaxFilterNumber(100);
                set.setUseColorsForFill(true);
                set.setFillFormatter({
                    getFillLinePosition(dataSet: LineDataSet, dataProvider) {
                        return dataProvider.getYChartMin();
                    }
                });
                set.setValueFormatter({
                    getFormattedValue(value: number, entry: Entry, index, count, dataSetIndex: any, viewPortHandler: any) {
                        if (index === 0 || index === count - 1 || value === profile.max[1]) {
                            return value.toFixed();
                        }
                    }
                } as any);
                set.setDrawFilled(true);
                set.setColor('#60B3FC');
                set.setLineWidth(1);
                set.setFillColor('#60B3FC80');
                if (showProfileGrades && profile.colors && profile.colors.length > 1) {
                    set.setLineWidth(2);
                    set.setColors(profile.colors);
                }
                // set.setMode(Mode.LINEAR);
                sets.push(set);
                const lineData = new LineData(sets);
                chartView.setData(lineData);
            } else {
                chartView.highlightValues(null);
                const set = chartData.getDataSetByIndex(0);
                if (showProfileGrades && profile.colors && profile.colors.length > 1) {
                    set.setLineWidth(2);
                    set.setColors(profile.colors);
                } else {
                    set.setLineWidth(1);
                    set.setColor('#60B3FC');
                }
                set.setValues(profileData);
                set.notifyDataSetChanged();
                chartData.notifyDataChanged();
                chartView.notifyDataSetChanged();
            }
            // chartView.zoomAndCenter(7, 1, 100, 0, AxisDependency.LEFT);
        }
    }
    function routeInstructions() {
        if (listViewAvailable) {
            return item.properties?.instructions;
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
        if (infoView && loadedListeners.length > 0) {
            loadedListeners.forEach((l) => l());
            loadedListeners = [];
        }
    }
</script>

<gridlayout {...$$restProps} width="100%" rows={`${INFOVIEW_HEIGHT},50,${profileHeight},auto`} columns="*,auto" backgroundColor={$widgetBackgroundColor} on:tap={() => {}}>
    {#if loaded}
        <BottomSheetInfoView bind:this={infoView} {item} />

        <mdactivityindicator visibility={updatingItem ? 'visible' : 'collapsed'} horizontalAligment="right" busy={true} width={20} height={20} />
        <IconButton col={1} text="mdi-crosshairs-gps" isVisible={itemIsRoute} on:tap={zoomToItem} />
        <stacklayout orientation="horizontal" row={1} colSpan={2} borderTopWidth="1" borderBottomWidth="1" borderColor={$borderColor}>
            <IconButton on:tap={searchWeb} tooltip={lc('search_web')} isVisible={item && (!itemIsRoute || item.properties?.name) && !item.id} text="mdi-web" rounded={false} />
            <IconButton on:tap={() => getProfile()} tooltip={lc('elevation_profile')} isVisible={itemIsRoute && itemCanQueryProfile} text="mdi-chart-areaspline" rounded={false} />
            <IconButton on:tap={() => saveItem()} tooltip={lc('save')} isVisible={item && !item.id} text="mdi-map-plus" rounded={false} />
            <!-- <IconButton on:tap={shareItem} tooltip={lc('share')} isVisible={itemIsRoute} text="mdi-share-variant" rounded={false} /> -->
            <IconButton on:tap={deleteItem} tooltip={lc('delete')} isVisible={item && item.id} color="red" text="mdi-delete" rounded={false} />
            <IconButton on:tap={openWikipedia} tooltip={lc('wikipedia')} isVisible={item && item.properties && item.properties.wikipedia} text="mdi-wikipedia" rounded={false} />
            {#if itemIsRoute && networkService.canCheckWeather}
                <IconButton on:tap={checkWeather} tooltip={lc('weather')} text="mdi-weather-partly-cloudy" rounded={false} />
            {/if}
            <IconButton id="astronomy" on:tap={showAstronomy} tooltip={lc('astronomy')} text="mdi-weather-night" rounded={false} />
            <IconButton on:tap={openPeakFinder} tooltip={lc('peaks')} isVisible={item && !itemIsRoute} text="mdi-summit" rounded={false} />
            <IconButton on:tap={getTransitLines} tooltip={lc('bus_stop_infos')} isVisible={item && itemIsBusStop} text="mdi-bus" rounded={false} />
        </stacklayout>
        <linechart bind:this={chart} row={2} colSpan={2} height={profileHeight} visibility={graphAvailable ? 'visible' : 'hidden'} on:highlight={onChartHighlight} />
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
        <!-- <CollectionView id="bottomsheetListView" row={3} bind:this="listView" rowHeight="40" items="routeInstructions" :visibility="showListView ? 'visible' : 'hidden'" isBounceEnabled="false" @scroll="onListViewScroll" :isScrollEnabled={scrollEnabled}>
            <v-template>
                <GridLayout columns="30,*" rows="*,auto,auto,*" rippleColor="white"  @tap="onInstructionTap(item)">
                    <label  rowSpan={4} text="getRouteInstructionIcon(item) |fonticon" class="osm" color="white" fontSize="20" verticalAlignment="center" textAlignment={center} />
                    <label col={1} row={1} text="getRouteInstructionTitle(item)" color="white" fontSize="13" fontWeight={bold} textWrap={true} />
                </GridLayout>
            </v-template>
        </CollectionView> -->
    {/if}
</gridlayout>
