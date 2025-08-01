<script lang="ts">
    import { packageService } from '~/services/PackageService';
    import { createNativeAttributedString } from '@nativescript-community/text';
    import { Align, Canvas, DashPathEffect, LayoutAlignment, Paint, StaticLayout } from '@nativescript-community/ui-canvas';
    import { MapBounds } from '@nativescript-community/ui-carto/core';
    import { LineChart } from '@nativescript-community/ui-chart/charts';
    import type { HighlightEventData } from '@nativescript-community/ui-chart/charts/Chart';
    import { XAxisPosition } from '@nativescript-community/ui-chart/components/XAxis';
    import { Rounding } from '@nativescript-community/ui-chart/data/DataSet';
    import type { Entry } from '@nativescript-community/ui-chart/data/Entry';
    import { LineData } from '@nativescript-community/ui-chart/data/LineData';
    import { LineDataSet, Mode } from '@nativescript-community/ui-chart/data/LineDataSet';
    import { Highlight } from '@nativescript-community/ui-chart/highlight/Highlight';
    import { LimitLabelPosition, LimitLine } from '@nativescript-community/ui-chart/components/LimitLine';
    import { ApplicationSettings, Color, Utils } from '@nativescript/core';
    import { createEventDispatcher } from '@shared/utils/svelte/ui';
    import { NativeViewElementNode } from 'svelte-native/dom';
    import { convertDurationSeconds, formatDistance, convertElevation } from '~/helpers/formatter';
    import { getBounds } from '~/helpers/geolib';
    import { onThemeChanged } from '~/helpers/theme';
    import { getMapContext } from '~/mapModules/MapModule';
    import type { AscentSegment, IItem as Item } from '~/models/Item';
    import { showError } from '@shared/utils/showError';
    import { colors, fonts } from '~/variables';
    import { SDK_VERSION } from '@akylas/nativescript/utils';
    let { colorOnSurface, colorOutline, colorOutlineVariant, colorOnPrimary, colorPrimary } = $colors;
    $: ({ colorOnSurface, colorOutline, colorOutlineVariant, colorPrimary } = $colors);
    
    const xintervals = [1, 2, 5, 10, 20, 50, 100];
    function closestUpper(arr: number[], target: number): number | undefined {
      return arr.filter(x => x >= target).sort((a, b) => a - b)[0];
    }


    const dispatch = createEventDispatcher();
    const mapContext = getMapContext();
    
    const highlightPaint = new Paint();
    highlightPaint.setColor('#aaa');
    highlightPaint.setStrokeWidth(1);
    highlightPaint.setTextSize(10);
    
    const waypointsBackPaint = new Paint();
    waypointsBackPaint.setColor(colorPrimary);
    
    const waypointsPaint = new Paint();
    waypointsPaint.fontFamily = 'osm';
    waypointsPaint.setColor(colorOnPrimary);
    waypointsPaint.setTextSize(8);
    waypointsPaint.setTextAlign(Align.CENTER);
    
    const nstringPaint = new Paint();
    nstringPaint.setColor('#aaa');
    nstringPaint.setStrokeWidth(1);
    nstringPaint.setTextSize(12);

    export let item: Item;
    export let showAscents = true;
    export let showWaypoints = true;
    let chart: NativeViewElementNode<LineChart>;
    export let showProfileGrades = true;

    $: {
        try {
            if (chart) {
                updateChartData(item);
            }
        } catch (err) {
            console.error('updateChartData', !!err, err, err.stack);
            showError(err);
        }
    }
    $: if (chart?.nativeView?.data && (showProfileGrades !== undefined || showAscents !== undefined)){
        updateChartData(item);
    }
    let onChartDataUpdateCallbacks = [];

    let highlightNString;
    function onChartPanOrZoom(event) {
        try {
            const chart = event.object as LineChart;
            const xAxisRender = chart.xAxisRenderer;
            const { max, min } = xAxisRender.getCurrentMinMax();
            const dataSet = chart.data.getDataSetByIndex(0);
            dataSet.ignoreFiltered = true;
            const minX = dataSet.getEntryIndexForXValue(min, NaN, Rounding.CLOSEST);
            const maxX = dataSet.getEntryIndexForXValue(max, NaN, Rounding.CLOSEST);
            dataSet.ignoreFiltered = false;
            const positions = (item.geometry?.['coordinates'] as any[]).slice(minX, maxX + 1);
            const region = getBounds(positions);
            mapContext.getMap().moveToFitBounds(
                new MapBounds(
                    {
                        lat: region.maxLat,
                        lon: region.maxLng
                    },
                    {
                        lat: region.minLat,
                        lon: region.minLng
                    }
                ),
                undefined,
                true,
                false,
                false,
                0
            );
        } catch (error) {
            console.error(error, error.stack);
        }
    }
    async function onChartHighlight(event: HighlightEventData) {
        // DEV_LOG && console.log('onChartHighlight', event.highlight);
        if (!item) {
            return;
        }
         const shouldSelectItem = event.highlight.hasOwnProperty('xPx');
       // const shouldSelectItem = true;
        const entryIndex = event.highlight.entryIndex;
        const positions = item.geometry?.['coordinates'];
        const actualIndex = Math.max(0, Math.min(entryIndex, positions.length - 1));
        const position = positions[actualIndex];
        DEV_LOG && console.log('onChartHighlight', entryIndex, position, shouldSelectItem);

        if (position) {
            if (event.highlight) {
                dispatch('highlight', { lat: position[1], lon: position[0], highlight: event.highlight });
            }
            if (shouldSelectItem) {
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
        // if (DEV_LOG) {
        //     try {
        //         const points = [{ lat: position[1], lon: position[0] }];
        //         if (actualIndex < positions.length - 1) {
        //             points.push({ lat: positions[actualIndex + 1][1], lon: positions[actualIndex + 1][0] });
        //         } else {
        //             points.unshift({ lat: positions[actualIndex - 1][1], lon: positions[actualIndex - 1][0] });
        //         }

        //         const projection = mapContext.getProjection();
        //         packageService
        //             .getStats({
        //                 projection,
        //                 points,
        //                 profile: item.properties.route.type,
        //                 attributes: ['edge.surface', 'edge.road_class', 'edge.sac_scale', 'edge.use'],
        //                 shape_match: 'edge_walk'
        //             })
        //             .then((edges) => console.log('edges', edges));
        //     } catch (error) {
        //         console.error(error, error.stack);
        //     }
        // }
    }

    let chartInitialized = false;

    onThemeChanged(() => {
        if (!chart) {
            return;
        }
        const chartView = chart.nativeView;

        const leftAxis = chartView.leftAxis;
        leftAxis.textColor = colorOnSurface;
        leftAxis.gridColor = colorOutlineVariant;
        const xAxis = chartView.xAxis;
        xAxis.textColor = colorOnSurface;
        xAxis.gridColor = colorOutlineVariant;
        const dataSet = chartView.data?.getDataSetByIndex(0);
        if (dataSet) {
            dataSet.valueTextColor = colorOnSurface;
        }
    });
    export function hilghlightPathIndex(params:{onPathIndex: number, remainingDistance: number, remainingDistanceToStep: number, remainingTime: number, dplus?: number, dmin?: number}, highlight?: Highlight<Entry>, sendEvent = true) {
        if (!chart) {
            return;
        }
        if (!item) {
            onChartDataUpdateCallbacks.push(() => {
                hilghlightPathIndex(params, highlight, sendEvent);
            });
            return;
        }
        const nChart = chart?.nativeView;
       DEV_LOG && console.log('hilghlightPathIndex', !!item, JSON.stringify(params), JSON.stringify(highlight), nChart);
        const onPathIndex = params.onPathIndex;
        if (onPathIndex === -1) {
            if (nChart) {
                nChart.highlight(null);
            }
            mapContext.mapModule('items').notify({
                eventName: 'user_onroute_data'
            });
        } else {
            const itemData = highlight?.entry || item?.profile?.data?.[onPathIndex];

            if (itemData) {
                const spans = [
                    {
                        fontFamily: $fonts.mdi,
                        color: colorPrimary,
                        text: 'mdi-arrow-expand-right'
                    },
                    {
                        text: formatDistance(params.remainingDistance) + '  '
                    },
                    {
                        fontFamily: $fonts.mdi,
                        color: colorPrimary,
                        text: 'mdi-triangle-outline'
                    },
                    {
                        text: (itemData.a || 0).toFixed() + 'm' + '  '
                    },
                    {
                        fontFamily: $fonts.app,
                        color: colorPrimary,
                        text: 'alpimaps-angle'
                    },
                    {
                        text: '~' + (itemData.g || 0).toFixed() + '% '
                    }
                ];
                if (!isNaN(itemData.dp) && (params.dplus - itemData.dp > 0)) {
                    spans.push({
                        fontFamily: $fonts.mdi,
                        color: colorPrimary,
                        text: 'mdi-arrow-top-right'
                    },
                    {
                        text: convertElevation(params.dplus - itemData.dp) + ' '
                    });
                }
                if (!isNaN(itemData.dm) && Math.abs(params.dmin - itemData.dm) > 0) {
                    spans.push({
                        fontFamily: $fonts.mdi,
                        color: colorPrimary,
                        text: 'mdi-arrow-bottom-right'
                    },
                    {
                        text: convertElevation(-(params.dmin - itemData.dm)) + ' '
                    });
                }
                if (!isNaN(params.remainingTime)) {
                    spans.unshift(
                        {
                            fontFamily: $fonts.mdi,
                            color: colorPrimary,
                            text: 'mdi-timer-outline'
                        },
                        {
                            text: convertDurationSeconds(params.remainingTime) + '  '
                        }
                    );
                }
                highlightNString = createNativeAttributedString({
                    spans
                });
                mapContext.mapModule('items').notify({
                    eventName: 'user_onroute_data',
                    itemData,
                    ...params
                });
            } else {
                mapContext.mapModule('items').notify({
                    eventName: 'user_onroute_data',
                    ...params
                });
            }
            if (highlight) {
                return;
            }
            function highlightFunc() {
                if (!item) {
                    return;
                }
                const nChart = chart?.nativeView;
                const profile = item.profile;
                const profileData = profile?.data;
                if (profileData) {
                    const dataSet = nChart.data.getDataSetByIndex(0);
                    dataSet.ignoreFiltered = true;
                    const entry = profileData[onPathIndex];
                    dataSet.ignoreFiltered = false;
                     DEV_LOG && console.log('highlight', onPathIndex, sendEvent, entry.d, JSON.stringify(entry));
                    const highlight = {
                        dataSetIndex: 0,
                        entryIndex: onPathIndex,
                        entry
                    };
                    nChart.highlightValues([highlight]);
                    if (sendEvent) {
                        onChartHighlight({ eventName: 'highlight', highlight, object: nChart } as any);
                    }
                }
            }
            if (nChart && nChart.data) {
                highlightFunc();
            } else {
                DEV_LOG && console.log('stacking highlight');
                onChartDataUpdateCallbacks.push(highlightFunc);
            }
        }
    }

    export function updateChartData(it = item) {
        if (!chart || !it) {
            return;
        }
        const chartView = chart.nativeView;
        const sets = [];
        const profile = it.profile;
        const profileData = profile?.data;
        const leftAxis = chartView.leftAxis;
        let xinterval;
        if (profileData) {
            const xAxis = chartView.xAxis;
            if (!chartInitialized) {
                chartInitialized = true;
                chartView.highlightPerDragEnabled = true;
                chartView.highlightPerTapEnabled = true;
                chartView.scaleXEnabled = true;
                chartView.doubleTapToZoomEnabled = true;
                chartView.dragEnabled = true;
                chartView.clipHighlightToContent = false;
                chartView.zoomedPanWith2Pointers = true;
                chartView.clipDataToContent = true;

                chartView.minOffset = 0;
                chartView.setExtraOffsets(0, 24, 10, 10);
                leftAxis.textColor = colorOnSurface;
                leftAxis.drawZeroLine = true;
                leftAxis.gridColor = new Color(colorOutlineVariant).setAlpha(70).hex;

                leftAxis.gridDashPathEffect = new DashPathEffect([6, 3], 0);
                leftAxis.ensureLastLabel = true;
                leftAxis.drawLimitLinesBehindData = false;

                xAxis.position = XAxisPosition.TOP;
                xAxis.labelTextAlign = Align.CENTER;
                xAxis.ensureLastLabel = true;
                xAxis.textColor = colorOnSurface;
                xAxis.drawGridLines = false;
                xAxis.drawMarkTicks = true;
                xAxis.drawLimitLinesBehindData = false;
                xAxis.valueFormatter = {
                    getAxisLabel: (value) => formatDistance(value, xinterval < 1000 ? 1 : 0)
                };

                chartView.customRenderer = {
                    drawHighlight(c: Canvas, h: Highlight<Entry>, set: LineDataSet, paint: Paint) {
                        const x = h.drawX;
                        if (highlightNString) {
                            const staticLayout = new StaticLayout(highlightNString, nstringPaint, c.getWidth(), LayoutAlignment.ALIGN_NORMAL, 1, 0, true);
                            c.save();
                            c.translate(10, 0);
                            staticLayout.draw(c);
                            c.restore();
                        }
                        c.drawLine(x, 20, x, c.getHeight(), highlightPaint);
                        c.drawCircle(x, 20, 4, highlightPaint);
                        c.drawText(formatDistance(h.entry['d'], xinterval < 1000 ? 1 : 0), x + 6, 23, highlightPaint);
                    }
                };
            } else {
                chartView.highlightValues(null);
                chartView.resetZoom();
            }
            const deltaA = profile.max[1] - profile.min[1];
            let spaceMin = 50;
            let spaceMax = 0;
            const chartElevationMinRange = ApplicationSettings.getNumber('chart_elevation_min_range', 250);
            if (deltaA < chartElevationMinRange) {
             //   const space = (chartElevationMinRange - deltaA) / 2;
            //    spaceMin += space;
                spaceMax += chartElevationMinRange - deltaA;
            }
            const labelCount = 5; 
            const interval = Math.max(chartElevationMinRange, deltaA) / labelCount < 100 ? 50 : Math.round(Math.max(chartElevationMinRange, deltaA) / labelCount / 100) * 100;
            leftAxis.forcedInterval = interval;
            leftAxis.labelCount = labelCount;
            leftAxis.spaceMin = spaceMin;
            leftAxis.spaceMax = spaceMax;
            leftAxis.textSize = 9;
            
            const totalDistance = it.route.totalDistance;
            const xLabelCount = 6; 
            xinterval = closestUpper( xintervals, totalDistance / xLabelCount / 1000)* 1000;
            xAxis.forcedInterval = xinterval;
            xAxis.labelCount = xLabelCount;
            xAxis.textSize = 9;
            xAxis.clipLimitLinesToContent = false;
            const chartData = chartView.data;
            let set: LineDataSet;
            function updateSetColors() {
                if (showProfileGrades && profile.colors && profile.colors.length > 1) {
                    set.lineWidth = 1;
                    set.colors = profile.colors as any;
                } else {
                    set.lineWidth = 1;
                    set.resetColors();
                    set.color = '#60B3FC';
                }
            }
            if (!chartData) {
               set = new LineDataSet(profileData, 'a', 'd', 'a');
                set.maxFilterNumber = ApplicationSettings.getNumber('chart_max_filter', 50);
                set.useColorsForFill = true;
                set.fillFormatter = {
                    getFillLinePosition(dataSet: LineDataSet, dataProvider) {
                        return dataProvider.yChartMin;
                    }
                };
                // set.valueFormatter=({
                //     getFormattedValue(value: number, entry: Entry, index, count, dataSetIndex: any, viewPortHandler: any) {
                //         if (index === 0 || index === count - 1 || value === profile.max[1] || value === profile.min[1]) {
                //             return convertElevation(value);
                //         }
                //     }
                // } as any);
                set.drawFilledEnabled = true;
                set.color = '#60B3FC';
                set.lineWidth = 1;
                set.fillColor = '#60B3FC80';
                set.mode = Mode.CUBIC_BEZIER;
                updateSetColors();
                sets.push(set);
                const lineData = new LineData(sets);
                chartView.data = lineData;
            } else {
                chartView.highlightValues(null);
                set = chartData.getDataSetByIndex(0) as LineDataSet;
                updateSetColors();
                set.values = profileData;
                set.notifyDataSetChanged();
                chartData.notifyDataChanged();
                chartView.notifyDataSetChanged();
            }
            
            leftAxis.removeAllLimitLines();
            let limitLine = new LimitLine(profile.min[1], convertElevation(profile.min[1]));
            limitLine.lineColor = colorOutline;
            limitLine.enableDashedLine(4, 3, 0);
            limitLine.lineWidth = 0.5;
            limitLine.yOffset = -1;
            limitLine.textSize = 9;
            limitLine.textColor= colorOnSurface;
           // limitLine.ensureVisible = true;
            limitLine.labelPosition = LimitLabelPosition.RIGHT_BOTTOM;
            leftAxis.addLimitLine(limitLine);
            
            limitLine = new LimitLine(profile.max[1], convertElevation(profile.max[1]));
            limitLine.lineColor = colorOutline;
            limitLine.enableDashedLine(4, 3, 0);
            limitLine.lineWidth = 0.5;
            limitLine.yOffset = 1;
            limitLine.textSize = 9;
            limitLine.textColor= colorOnSurface;
            limitLine.ensureVisible = true;
            leftAxis.addLimitLine(limitLine);
            
            xAxis.removeAllLimitLines();
            if (showAscents) {
                profile.ascents.forEach((ascent: AscentSegment) => {
                    const text = convertElevation(ascent.highestElevation) + '\n+' + convertElevation(ascent.gain);
            
                    limitLine = new LimitLine(profileData[ascent.highestPointIndex].d, text);
                    limitLine.lineColor = colorOutline;
                    limitLine.enableDashedLine(6, 3, 0);
                    limitLine.lineWidth = 0.5;
                    limitLine.textSize = 7;
                    limitLine.xOffset = 0;
                    limitLine.textColor= colorOnSurface;
                    limitLine.ensureVisible = true;
                    limitLine.drawLabel = (c: Canvas, label: string, x: number, y: number, paint: Paint) => {
                        c.drawCircle(x + 5, y - 6, 6, waypointsBackPaint);
                        waypointsPaint.textSize = 7;
                        c.drawText('', x + 5, y - 5 +1, waypointsPaint);
                     //   paint.setTextAlign(Align.CENTER);
                        const staticLayout = new StaticLayout(label, paint, c.getWidth(), LayoutAlignment.ALIGN_NORMAL, 1, 0, true);
                        c.save();
                        c.translate(x, y - 3);
                        staticLayout.draw(c);
                        c.restore();
                    }
                    xAxis.addLimitLine(limitLine);
              });
            }
            if (showWaypoints) {
                const positions = packageService.getRouteItemPoses(it);
                it.route.waypoints.forEach(p=> {
                    if (p.properties.showOnMap && p.properties.index > 0) {
                        limitLine = new LimitLine(profileData[p.properties.index].d, ' ');
                        limitLine.lineColor = colorOutline;
                        limitLine.enableDashedLine(6, 3, 0);
                        limitLine.lineWidth = 0.5;
                        limitLine.ensureVisible = true;
                        limitLine.drawLabel = (c: Canvas, label: string, x: number, y: number, paint: Paint) => {
                        
                            c.drawCircle(x - 5, y +0, 6, waypointsBackPaint);
                            waypointsPaint.textSize = 8;
                            c.drawText('', x - 5, y +4 - 1, waypointsPaint);
                            
                        }
                        xAxis.addLimitLine(limitLine);
                    }
                    
                });
            }
            

            onChartDataUpdateCallbacks.forEach((c) => c());
            onChartDataUpdateCallbacks = [];
        }
    }
</script>

<linechart
    bind:this={chart}
    hardwareAccelerated={__ANDROID__ && SDK_VERSION >= 28}
    {...$$restProps}
    doubleTapGestureOptions={{
        maxDelayMs: 100
    }}
    panGestureOptions={{
        minDist: 20,
        failOffsetYStart: -20,
        failOffsetYEnd: 20
    }}
    on:highlight={onChartHighlight}
    on:zoom={onChartPanOrZoom}
    on:pan={onChartPanOrZoom} />
