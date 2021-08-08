<script lang="ts">
    import { l } from '@nativescript-community/l';
    import { Align, Canvas, DashPathEffect, LayoutAlignment, Paint, StaticLayout, Style } from '@nativescript-community/ui-canvas';
    import { GenericMapPos } from '@nativescript-community/ui-carto/core';
    import { TileDataSource } from '@nativescript-community/ui-carto/datasources';
    import { RasterTileLayer } from '@nativescript-community/ui-carto/layers/raster';
    import { VectorElementEventData } from '@nativescript-community/ui-carto/layers/vector';
    import { CartoMap } from '@nativescript-community/ui-carto/ui';
    import { distanceToEnd, isLocationOnPath } from '@nativescript-community/ui-carto/utils';
    import { LineChart } from '@nativescript-community/ui-chart/charts';
    import type { HighlightEventData } from '@nativescript-community/ui-chart/charts/Chart';
    import { XAxisPosition } from '@nativescript-community/ui-chart/components/XAxis';
    import { Entry } from '@nativescript-community/ui-chart/data/Entry';
    import { LineData } from '@nativescript-community/ui-chart/data/LineData';
    import { LineDataSet, Mode } from '@nativescript-community/ui-chart/data/LineDataSet';
    import { Highlight } from '@nativescript-community/ui-chart/highlight/Highlight';
    import { showSnack } from '@nativescript-community/ui-material-snackbar';
    import { Application } from '@nativescript/core';
    import { openUrl } from '@nativescript/core/utils';
    import { onDestroy, onMount } from 'svelte';
    import { NativeViewElementNode, showModal } from 'svelte-native/dom';
    import { formatValueToUnit, UNITS } from '~/helpers/formatter';
    import { slc } from '~/helpers/locale';
    import { onThemeChanged } from '~/helpers/theme';
    import { formatter } from '~/mapModules/ItemFormatter';
    import { getMapContext } from '~/mapModules/MapModule';
    import type { IItem, IItem as Item } from '~/models/Item';
    import type { RouteInstruction } from '~/models/Route';
    import { networkService } from '~/services/NetworkService';
    import { packageService } from '~/services/PackageService';
    import { showError } from '~/utils/error';
    import { openLink } from '~/utils/ui';
    import { borderColor, screenHeightDips, statusBarHeight, textColor, widgetBackgroundColor } from '~/variables';
    import { showBottomSheet } from './bottomsheet';
    import BottomSheetInfoView from './BottomSheetInfoView.svelte';

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
        mapContext.mapModule('userLocation').on('location', onNewLocation, this);
    });
    onDestroy(() => {
        mapContext.mapModule('userLocation').on('location', onNewLocation, this);
    });

    mapContext.onVectorElementClicked((data: VectorElementEventData<LatLonKeys>) => {
        const { clickType, position, elementPos, metaData, element } = data;
        console.log('onVectorElementClicked', position);
        const selectedItem: IItem = { position, vectorElement: element, ...metaData };
        if (item && item.id && item.route && selectedItem.id === item.id) {
            updateRouteItemWithPosition(item, position, true, true);
        }
    });

    $: {
        if (itemIsRoute && currentLocation) {
            updateRouteItemWithPosition(item, currentLocation);
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

    function tooltip(text) {
        showSnack({ message: text });
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
                if (item.address) {
                    name += ' ' + item.address.county;
                }
                if (global.isAndroid) {
                    const intent = new android.content.Intent(android.content.Intent.ACTION_WEB_SEARCH);
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
        graphAvailable = itemIsRoute && !!item.route.profile && !!item.route.profile.data && item.route.profile.data.length > 0;
    }
    $: {
        try {
            itemIsRoute = item && !!item.route;
            itemIsBusStop = item && !itemIsRoute && !!item.properties && (item.properties.class === 'bus' || item.properties.subclass === 'tram_stop');
            itemCanQueryProfile = itemIsRoute && !!item.route.positions;
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
        if (routeItem && routeItem.route) {
            const route = routeItem.route;
            const positions = route.positions;
            const onPathIndex = isLocationOnPath(location, positions, false, true, 20);
            if (onPathIndex !== -1 && updateNavigationInstruction) {
                let routeInstruction;
                for (let index = route.instructions.length - 1; index >= 0; index--) {
                    const element = route.instructions[index];
                    if (element.index <  onPathIndex) {
                        break;
                    }
                    routeInstruction = element;
                }

                const distance = distanceToEnd(onPathIndex, positions);
                navigationInstructions = {
                    instruction: routeInstruction,
                    remainingDistance: distance,
                    remainingTime: ((route.totalTime * distance) / route.totalDistance) * 1000
                };
            }
            if (updateGraph && graphAvailable) {
                if (onPathIndex === -1) {
                    chart.nativeView.highlight(null);
                } else {
                    const profile = item.route.profile;
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
        this.updateRouteItemWithPosition(item, currentLocation);
    }
    function onChartHighlight(event: HighlightEventData) {
        const x = event.highlight.entryIndex;
        const positions = item.route.positions;
        const position = positions.getPos(Math.max(0, Math.min(x, positions.size() - 1)));
        if (position) {
            updateRouteItemWithPosition(item, position, false, false);
            mapContext.selectItem({
                item: { position },
                isFeatureInteresting: true,
                setSelected: false,
                peek: false,
                zoomDuration: 0
            });
        }
    }
    function searchItemWeb() {
        if (global.isAndroid) {
            const query = formatter.getItemName(item);
            if (global.isAndroid) {
                const intent = new android.content.Intent(android.content.Intent.ACTION_WEB_SEARCH);
                intent.putExtra(android.app.SearchManager.QUERY, query); // query contains search string
                if (intent.resolveActivity(Application.android.context.getPackageManager()) !== null) {
                    (Application.android.foregroundActivity as android.app.Activity).startActivity(intent);
                } else {
                    showSnack({ message: l('no_web_search_app') });
                }
            }
        }
    }
    function zoomToItem() {
        mapContext.zoomToItem({ item });
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
            // console.log('getProfile');
            const profile = await packageService.getElevationProfile(item);
            if (profile) {
                // item.route.profile = profile;
                if (item.id !== undefined) {
                    await updateItem(item, { route: { profile } } as any);
                } else {
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
    async function updateItem(item: IItem, data: Partial<IItem>, peek = true) {
        try {
            updatingItem = true;
            const savedItem = await mapContext.mapModule('items').updateItem(item, data);
            mapContext.selectItem({ item: savedItem, isFeatureInteresting: true, peek });
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
        if (item.route) {
            if (!item.route.profile && itemCanQueryProfile) {
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
            openUrl(`weather://query?lat=${item.position.lat}&lon=${item.position.lon}&name=${query}`);
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
            const position = { ...item.position };
            if (!position.altitude) {
                position.altitude = item.properties.ele || (await packageService.getElevation(position));
            }
            const hillshadeDatasource = packageService.hillshadeLayer?.dataSource;
            const vectorDataSource = packageService.localVectorTileLayer?.dataSource;
            const component = (await import('~/components/PeakFinder.svelte')).default;
            const customSources = mapContext.mapModules.customLayers.customSources;
            let rasterDataSource: TileDataSource<any, any>;
            customSources.some((s) => {
                if (s.layer instanceof RasterTileLayer) {
                    rasterDataSource = s.layer.dataSource;
                    return true;
                }
            });
            if (!rasterDataSource) {
                rasterDataSource = await mapContext.mapModules.customLayers.getDataSource('openstreetmap');
            }
            showModal({
                page: component,
                animated: true,
                fullscreen: true,
                props: {
                    terrarium: false,
                    position,
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
            const component = (await import('~/components/transit/TransitLinesBottomSheet.svelte')).default;
            console.log('getTransitLines', { name: formatter.getItemName(item), position: item.position });
            showBottomSheet({ parent: mapContext.getMainPage(), view: component, disableDimBackground: true, props: { name: formatter.getItemName(item), position: item.position } });
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
        const profile = item.route.profile;
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
                leftAxis.setGridColor($borderColor);
                leftAxis.setGridDashedLine(new DashPathEffect([6, 3], 0));
                leftAxis.ensureLastLabel = true;
                // leftAxis.setLabelCount(3);

                xAxis.setPosition(XAxisPosition.BOTTOM);
                xAxis.setLabelTextAlign(Align.CENTER);
                xAxis.setTextColor($textColor);
                xAxis.setGridColor($borderColor);
                xAxis.setDrawGridLines(false);
                xAxis.setDrawMarkTicks(true);
                // xAxis.ensureLastLabel = true;
                xAxis.setValueFormatter({
                    // getAxisLabel: (value, axis) => formatValueToUnit(value, UNITS.DistanceKm)
                    getAxisLabel: (value, axis, viewPortHandler) => Math.floor(value / 1000).toFixed()
                });

                chartView.setCustomRenderer({
                    drawHighlight(c: Canvas, h: Highlight<Entry>, set: LineDataSet, paint: Paint) {
                        // const canvasHeight = c.getHeight();
                        const x = h.drawX;
                        const y = h.drawY;
                        const w = 50;

                        highlightPaint.setColor('#8687A2');
                        paint.setColor('#8687A2');
                        paint.setStyle(Style.FILL);

                        c.drawLine(x, 0, x, y - 5, highlightPaint);
                        highlightPaint.setColor('white');
                        const layout = new StaticLayout(
                            h.entry.a.toFixed() + 'm' + '\n' + '~' + Math.abs(h.entry.g.toFixed()) + '%' + '\n' + formatValueToUnit(h.entry.d, UNITS.DistanceKm),
                            highlightPaint,
                            w,
                            LayoutAlignment.ALIGN_CENTER,
                            1,
                            0,
                            true
                        );
                        c.drawRoundRect(x - w / 2, 0, x + w / 2, layout.getHeight(), 2, 2, paint);
                        c.save();
                        c.translate(x - w / 2, 0);
                        layout.draw(c);
                        c.restore();
                    }
                });
                // chartView.setMarker({
                //     paint: new Paint(),
                //     refreshContent(e: Entry, highlight: Highlight) {
                //         this.entry = e;
                //     },
                //     draw(canvas: Canvas, posX: any, posY: any) {
                //         const canvasHeight = canvas.getHeight();
                //         const paint = this.paint as Paint;
                //         paint.setColor('#FFBB73');
                //         paint.setAntiAlias(true);
                //         paint.setTextAlign(Align.CENTER);
                //         paint.setStrokeWidth(1);
                //         paint.setTextSize(10);
                //         canvas.save();
                //         canvas.translate(posX, posY);
                //         canvas.drawLine(-5, 0, 5, 0, paint);
                //         canvas.drawLine(0, -5, 0, 5, paint);
                //         if (posY > canvasHeight - 20) {
                //             canvas.translate(0, -20);
                //         } else {
                //             canvas.translate(0,10);
                //         }
                //         canvas.drawText(this.entry.a.toFixed() + 'm' + '\n' + this.entry.g.toFixed() + '%' , 0, 5, paint);
                //         canvas.restore();
                //     }
                // } as any);
            } else {
                chartView.highlightValues(null);
                chartView.resetZoom();
            }
            // xAxis.setLabelCount(Math.round(item.route.totalDistance) / 1000);
            const chartData = chartView.getData();
            if (!chartData) {
                const set = new LineDataSet(profileData, 'a', 'd', 'avg');
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
                if (showProfileGrades && profile.colors && profile.colors.length > 0) {
                    set.setLineWidth(2);
                    set.setColors(profile.colors);
                } else {
                    set.setColor('#60B3FC');
                }
                set.setMode(Mode.LINEAR);
                set.setFillColor('#60B3FC80');
                sets.push(set);
                const lineData = new LineData(sets);
                chartView.setData(lineData);
            } else {
                chartView.highlightValues(null);
                const set = chartData.getDataSetByIndex(0);
                if (showProfileGrades && profile.colors && profile.colors.length > 0) {
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
            return item.route.instructions;
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
        <button col={1} variant="text" class="icon-btn" text="mdi-crosshairs-gps" visibility={itemIsRoute ? 'visible' : 'collapsed'} on:tap={zoomToItem} />
        <stacklayout orientation="horizontal" row={1} colSpan={2} borderTopWidth="1" borderBottomWidth="1" borderColor={$borderColor}>
            <button
                variant="text"
                on:tap={() => searchWeb()}
                on:longPress={() => tooltip($slc('search_web'))}
                visibility={item && !itemIsRoute && !item.id ? 'visible' : 'collapsed'}
                text="mdi-web"
                class="icon-btn"
            />
            <button
                variant="text"
                on:tap={() => getProfile()}
                on:longPress={() => tooltip($slc('elevation_profile'))}
                visibility={itemIsRoute && itemCanQueryProfile ? 'visible' : 'collapsed'}
                text="mdi-chart-areaspline"
                class="icon-btn"
            />
            <button variant="text" on:tap={() => saveItem()} on:longPress={() => tooltip($slc('save'))} visibility={item && !item.id ? 'visible' : 'collapsed'} text="mdi-map-plus" class="icon-btn" />
            <button
                variant="text"
                on:tap={() => shareItem()}
                on:longPress={() => tooltip($slc('share'))}
                visibility={itemIsRoute ? 'visible' : 'collapsed'}
                text="mdi-share-variant"
                class="icon-btn"
            />
            <button
                variant="text"
                on:tap={() => deleteItem()}
                on:longPress={() => tooltip($slc('delete'))}
                visibility={item && item.id ? 'visible' : 'collapsed'}
                color="red"
                text="mdi-delete"
                class="icon-btn"
            />
            <button
                variant="text"
                on:tap={() => openWikipedia()}
                on:longPress={() => tooltip($slc('wikipedia'))}
                visibility={item && item.properties && item.properties.wikipedia ? 'visible' : 'collapsed'}
                text="mdi-wikipedia"
                class="icon-btn"
            />
            <!-- <button
                variant="text"
                fontSize="10"
                on:tap={shareItem}
                text="share item"
                visibility={item && item.id ? 'visible' : 'collapsed'}
            /> -->
            <button
                variant="text"
                on:tap={() => checkWeather()}
                on:longPress={() => tooltip($slc('weather'))}
                visibility={item && networkService.canCheckWeather ? 'visible' : 'collapsed'}
                text="mdi-weather-partly-cloudy"
                class="icon-btn"
            />
            <button
                variant="text"
                on:tap={() => openPeakFinder()}
                on:longPress={() => tooltip($slc('peaks'))}
                visibility={item && !itemIsRoute ? 'visible' : 'collapsed'}
                text="mdi-summit"
                class="icon-btn"
            />
            <button
                variant="text"
                on:tap={() => getTransitLines()}
                on:longPress={() => tooltip($slc('bus_stop_infos'))}
                visibility={item && itemIsBusStop ? 'visible' : 'collapsed'}
                text="mdi-bus"
                class="icon-btn"
            />
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
                    <Label  rowSpan={4} text="getRouteInstructionIcon(item) |fonticon" class="osm" color="white" fontSize="20" verticalAlignment="center" textAlignment={center} />
                    <Label col={1} row={1} text="getRouteInstructionTitle(item)" color="white" fontSize="13" fontWeight={bold} textWrap={true} />
                </GridLayout>
            </v-template>
        </CollectionView> -->
    {/if}
</gridlayout>
