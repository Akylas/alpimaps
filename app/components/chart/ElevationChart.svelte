<script lang="ts">
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
    import type { IItem as Item } from '~/models/Item';
    import { showError } from '@shared/utils/showError';
    import { colors, fonts } from '~/variables';
    import { SDK_VERSION } from '@akylas/nativescript/utils';
    $: ({ colorOnSurface, colorOutline, colorOutlineVariant, colorPrimary } = $colors);

    const dispatch = createEventDispatcher();
    const mapContext = getMapContext();
    const highlightPaint = new Paint();
    highlightPaint.setColor('#aaa');
    // highlightPaint.setTextAlign(Align.CENTER);
    highlightPaint.setStrokeWidth(1);
    highlightPaint.setTextSize(12);

    export let item: Item;
    let chart: NativeViewElementNode<LineChart>;
    const showProfileGrades = true;

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
        const entryIndex = event.highlight.entryIndex;
        const positions = item.geometry?.['coordinates'];
        const actualIndex = Math.max(0, Math.min(entryIndex, positions.length - 1));
        const position = positions[actualIndex];
        // DEV_LOG && console.log('onChartHighlight', entryIndex, position, shouldSelectItem);

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
    export function hilghlightPathIndex(params:{onPathIndex: number, remainingDistance: number, remainingTime: number, dplus?: number, dmin?: number}, highlight?: Highlight<Entry>, sendEvent = true) {
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
        // DEV_LOG && console.log('hilghlightPathIndex', !!item, onPathIndex, remainingDistance, remainingTime, JSON.stringify(highlight), nChart);
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
                    const item = profileData[onPathIndex];
                    dataSet.ignoreFiltered = false;
                    // DEV_LOG && console.log('highlight', onPathIndex, item.d, JSON.stringify(item));
                    const highlight = {
                        dataSetIndex: 0,
                        entryIndex: onPathIndex,
                        entry: item
                    };
                    nChart.highlightValues([highlight]);
                    sendEvent && onChartHighlight({ eventName: 'highlight', highlight, object: nChart } as any);
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
                leftAxis.gridColor = new Color(colorOutlineVariant).setAlpha(100).hex;

                leftAxis.gridDashPathEffect = new DashPathEffect([6, 3], 0);
                leftAxis.ensureLastLabel = true;

                xAxis.position = XAxisPosition.TOP;
                xAxis.labelTextAlign = Align.CENTER;
                xAxis.ensureLastLabel = true;
                xAxis.textColor = colorOnSurface;
                xAxis.drawGridLines = false;
                xAxis.drawMarkTicks = true;
                xAxis.valueFormatter = {
                    getAxisLabel: (value) => formatDistance(value, xinterval < 1000 ? 1 : 0)
                };

                chartView.customRenderer = {
                    drawHighlight(c: Canvas, h: Highlight<Entry>, set: LineDataSet, paint: Paint) {
                        const x = h.drawX;
                        if (highlightNString) {
                            const staticLayout = new StaticLayout(highlightNString, highlightPaint, c.getWidth(), LayoutAlignment.ALIGN_NORMAL, 1, 0, true);
                            c.save();
                            c.translate(10, 0);
                            staticLayout.draw(c);
                            c.restore();
                        }
                        c.drawLine(x, 20, x, c.getHeight(), highlightPaint);
                        c.drawCircle(x, 20, 4, highlightPaint);
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
            const interval = deltaA / labelCount < 100 ? 50 : Math.round(deltaA / labelCount / 100) * 100;
            leftAxis.forcedInterval = interval;
            leftAxis.labelCount = labelCount;
            leftAxis.spaceMin = spaceMin;
            leftAxis.spaceMax = spaceMax;
            
            const totalDistance = it.route.totalDistance;
            const xLabelCount = 6; 
            xinterval = totalDistance / xLabelCount < 1000 ? 100 : Math.round(totalDistance / xLabelCount / 1000) * 1000;
            xAxis.forcedInterval = xinterval;
            xAxis.labelCount = xLabelCount;
            
            const chartData = chartView.data;
            if (!chartData) {
                const set = new LineDataSet(profileData, 'a', 'd', 'a');
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
                if (showProfileGrades && profile.colors && profile.colors.length > 1) {
                    set.lineWidth = 2;
                    set.colors = profile.colors as any;
                }
                sets.push(set);
                const lineData = new LineData(sets);
                chartView.data = lineData;
            } else {
                // console.log('clearing highlight1')
                chartView.highlightValues(null);
                const set = chartData.getDataSetByIndex(0);
                if (showProfileGrades && profile.colors && profile.colors.length > 1) {
                    set.lineWidth = 2;
                    set.colors = profile.colors as any;
                } else {
                    set.lineWidth = 1;
                    set.color = '#60B3FC';
                }
                set.values = profileData;
                set.notifyDataSetChanged();
                chartData.notifyDataChanged();
                chartView.notifyDataSetChanged();
            }
            leftAxis.removeAllLimitLines();
            let limitLine = new LimitLine(profile.min[1], convertElevation(profile.min[1]));
            limitLine.lineColor = colorOutline;
            limitLine.enableDashedLine(4, 3, 0);
            limitLine.lineWidth = 1;
            limitLine.yOffset = -2;
            limitLine.textColor= colorOnSurface;
           // limitLine.ensureVisible = true;
            limitLine.labelPosition = LimitLabelPosition.RIGHT_BOTTOM;
            leftAxis.addLimitLine(limitLine);
            
            limitLine = new LimitLine(profile.max[1], convertElevation(profile.max[1]));
            limitLine.lineColor = colorOutline;
            limitLine.enableDashedLine(4, 3, 0);
            limitLine.lineWidth = 1;
            limitLine.yOffset = 0;
            limitLine.textColor= colorOnSurface;
            limitLine.ensureVisible = true;
            leftAxis.addLimitLine(limitLine);

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
