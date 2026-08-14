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
    import { NativeViewElementNode } from '@nativescript-community/svelte-native/dom';
    import { convertDurationSeconds, convertElevation, formatDistance } from '~/helpers/formatter';
    import { getBounds } from '~/helpers/geolib';
    import { isEInk, onThemeChanged } from '~/helpers/theme';
    import { getMapContext } from '~/mapModules/MapModule';
    import type { AscentSegment, IItem as Item } from '~/models/Item';
    import { showError } from '@shared/utils/showError';
    import { gradeColor } from '~/utils/grade';
    import { colors, fontScale, fonts } from '~/variables';
    import { SDK_VERSION } from '@akylas/nativescript/utils';
    let { colorOnPrimary, colorOnSurface, colorOutline, colorOutlineVariant, colorPrimary } = $colors;
    $: ({ colorOnPrimary, colorOnSurface, colorOutline, colorOutlineVariant, colorPrimary } = $colors);

    /** what ui-chart fills a line set with by default, out of 255 */
    const DEFAULT_FILL_ALPHA = 85;
    /** grade sections are read by colour, so their fill has to actually carry one */
    const GRADE_FILL_ALPHA = 180;

    const xintervals = [1, 2, 5, 10, 20, 50, 100];
    function closestUpper(arr: number[], target: number): number | undefined {
        return arr.filter((x) => x >= target).sort((a, b) => a - b)[0];
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
    /**
     * Widget sized variant used by the navigation bar: no axes, no labels, no limit lines and no
     * gestures, just the silhouette and where you are on it. Same chart underneath, so it keeps the
     * point filtering and the curve rendering.
     */
    export let mini = false;
    /** the fill dithers into noise on eink, where the silhouette alone reads better */
    export let filled = true;
    /** profile index range to zoom on, eg the climb underway. Whole route when null */
    export let range: { fromIndex: number; toIndex: number } = null;

    $: if (chart?.nativeView?.data && range !== undefined) {
        applyRange(range);
    }

    /** Windows the chart onto part of the profile through the axis bounds, values left untouched. */
    function applyRange(range: { fromIndex: number; toIndex: number }) {
        const chartView = chart?.nativeView;
        const data = item?.profile?.data;
        if (!chartView || !data?.length) {
            return;
        }
        const leftAxis = chartView.leftAxis;
        const xAxis = chartView.xAxis;
        if (!range) {
            xAxis.resetAxisMinimum();
            xAxis.resetAxisMaximum();
            leftAxis.resetAxisMinimum();
            leftAxis.resetAxisMaximum();
        } else {
            const from = Math.max(Math.min(range.fromIndex, data.length - 1), 0);
            const to = Math.max(Math.min(range.toIndex, data.length - 1), from);
            xAxis.axisMinimum = data[from].d;
            xAxis.axisMaximum = data[to].d;
            // the whole route's altitude range would flatten a single climb into a straight line
            let min = Infinity;
            let max = -Infinity;
            for (let index = from; index <= to; index++) {
                min = Math.min(min, data[index].a);
                max = Math.max(max, data[index].a);
            }
            leftAxis.axisMinimum = min;
            leftAxis.axisMaximum = max;
        }
        chartView.invalidate();
    }

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
    $: if (chart?.nativeView?.data && (showProfileGrades !== undefined || showAscents !== undefined)) {
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
    export function hilghlightPathIndex(
        params: { onPathIndex: number; remainingDistance: number; remainingDistanceToStep: number; remainingTime: number; dplus?: number; dmin?: number },
        highlight?: Highlight<Entry>,
        sendEvent = true
    ) {
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
        // DEV_LOG && console.log('hilghlightPathIndex', !!item, JSON.stringify(params), JSON.stringify(highlight), nChart);
        const onPathIndex = params.onPathIndex;
        if (onPathIndex === -1) {
            if (nChart) {
                nChart.highlight(null);
            }
            // the widget is a second chart on the same route: letting it emit too would fight the
            // item sheet's own live data
            !mini &&
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
                        // one decimal, and the section colour, so this agrees with the fill under it
                        color: gradeColor(itemData.g || 0),
                        text: (itemData.g || 0).toFixed(1) + '% '
                    }
                ];
                if (!isNaN(itemData.dp) && params.dplus - itemData.dp > 0) {
                    spans.push(
                        {
                            fontFamily: $fonts.mdi,
                            color: colorPrimary,
                            text: 'mdi-arrow-top-right'
                        },
                        {
                            text: convertElevation(params.dplus - itemData.dp) + ' '
                        }
                    );
                }
                if (!isNaN(itemData.dm) && Math.abs(params.dmin - itemData.dm) > 0) {
                    spans.push(
                        {
                            fontFamily: $fonts.mdi,
                            color: colorPrimary,
                            text: 'mdi-arrow-bottom-right'
                        },
                        {
                            text: convertElevation(-(params.dmin - itemData.dm)) + ' '
                        }
                    );
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
                !mini &&
                    mapContext.mapModule('items').notify({
                        eventName: 'user_onroute_data',
                        itemData,
                        ...params
                    });
            } else {
                !mini &&
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
                    // DEV_LOG && console.log('highlight', onPathIndex, sendEvent, entry.d, JSON.stringify(entry));
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
                // the navigation bar owns the drag here, and there is no room for labels anyway. The
                // axes stay enabled and are only made invisible: calcMinMax skips a disabled axis, and
                // the y transformer is built from the range it computes, so disabling draws nothing
                chartView.highlightPerDragEnabled = !mini;
                chartView.highlightPerTapEnabled = !mini;
                chartView.scaleXEnabled = !mini;
                chartView.doubleTapToZoomEnabled = !mini;
                chartView.dragEnabled = !mini;
                chartView.clipHighlightToContent = false;
                chartView.zoomedPanWith2Pointers = !mini;
                chartView.clipDataToContent = true;

                chartView.minOffset = 0;
                // the mini chart is drawn under the widget's own labels — the summit elevation sits in
                // its top right corner — so the curve needs headroom rather than the whole card
                chartView.setExtraOffsets(0, mini ? 14 : 24, mini ? 4 : 10, mini ? 2 : 10);
                if (mini) {
                    chartView.legend.enabled = false;
                    [leftAxis, xAxis].forEach((axis) => {
                        axis.drawLabels = false;
                        axis.drawGridLines = false;
                        axis.drawAxisLine = false;
                    });
                }
                leftAxis.textColor = colorOnSurface;
                leftAxis.drawZeroLine = true;
                leftAxis.gridColor = new Color(colorOutlineVariant).setAlpha(70).hex;

                leftAxis.gridDashPathEffect = new DashPathEffect([6, 3], 0);
                leftAxis.ensureLastLabel = true;
                leftAxis.drawLimitLinesBehindData = false;

                xAxis.position = XAxisPosition.BOTTOM;
                xAxis.labelTextAlign = Align.CENTER;
                xAxis.ensureLastLabel = true;
                xAxis.textColor = colorOnSurface;
                xAxis.drawGridLines = false;
                xAxis.drawMarkTicks = true;
                xAxis.drawLimitLinesBehindData = false;
                xAxis.valueFormatter = {
                    getAxisLabel: (value) => formatDistance(value)
                };

                chartView.customRenderer = {
                    drawHighlight(c: Canvas, h: Highlight<Entry>, set: LineDataSet, paint: Paint) {
                        const x = h.drawX;
                        if (mini) {
                            // a dot riding the profile reads as "you are here"; the full height line
                            // cuts a widget sized chart in two and leaves nothing readable
                            c.drawCircle(x, h.drawY, 4, highlightPaint);
                            return;
                        }
                        if (highlightNString) {
                            const staticLayout = new StaticLayout(highlightNString, nstringPaint, c.getWidth(), LayoutAlignment.ALIGN_NORMAL, 1, 0, true);
                            c.save();
                            c.translate(10, 0);
                            staticLayout.draw(c);
                            c.restore();
                        }
                        c.drawLine(x, 20, x, c.getHeight(), highlightPaint);
                        c.drawCircle(x, 20, 4, highlightPaint);
                        c.drawText(formatDistance(h.entry['d']), x + 6, 23, highlightPaint);
                    }
                };
            } else {
                chartView.highlightValues(null);
                chartView.resetZoom();
            }
            const deltaA = profile.max[1] - profile.min[1];
            const spaceMin = 100;
            let spaceMax = 0;
            const chartElevationMinRange = ApplicationSettings.getNumber('chart_elevation_min_range', 250);
            if (deltaA < chartElevationMinRange) {
                //   const space = (chartElevationMinRange - deltaA) / 2;
                //    spaceMin += space;
                spaceMax += chartElevationMinRange - deltaA;
            }
            const labelCount = 5;
            const step = Math.max(chartElevationMinRange, deltaA) / labelCount < 100 ? 50 : 100;
            const interval = Math.round(Math.max(chartElevationMinRange, deltaA) / labelCount / step) * step;
            leftAxis.forcedInterval = interval;
            leftAxis.labelCount = labelCount;
            leftAxis.spaceMin = spaceMin;
            leftAxis.spaceMax = spaceMax;
            leftAxis.textSize = 9 * $fontScale;

            const totalDistance = it.route.totalDistance;
            const xLabelCount = 6;
            xinterval = closestUpper(xintervals, totalDistance / xLabelCount / 1000) * 1000;
            xAxis.forcedInterval = xinterval;
            xAxis.labelCount = xLabelCount;
            xAxis.textSize = 9 * $fontScale;
            xAxis.clipLimitLinesToContent = false;
            const chartData = chartView.data;
            let set: LineDataSet;
            // thicker in the widget: the same hairline that reads fine on a full chart nearly disappears
            // at a glance on a card the height of a line of text
            const lineWidth = mini ? 2 : 1;
            function updateSetColors() {
                if (showProfileGrades && profile.colors && profile.colors.length > 1) {
                    set.lineWidth = lineWidth;
                    set.colors = profile.colors as any;
                    // the grade buckets only mean something if they can be told apart, and the chart's
                    // default fill alpha washes them out. Eink keeps that default: there the fill is a
                    // grey wedge behind the curve, and darkening it buries the line in it
                    set.fillAlpha = isEInk ? DEFAULT_FILL_ALPHA : GRADE_FILL_ALPHA;
                } else {
                    set.lineWidth = lineWidth;
                    set.resetColors();
                    set.color = '#60B3FC';
                    set.fillAlpha = DEFAULT_FILL_ALPHA;
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
                set.drawFilledEnabled = filled;
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
                set = chartData.getDataSetByIndex(0);
                updateSetColors();
                set.values = profileData;
                set.notifyDataSetChanged();
                chartData.notifyDataChanged();
                chartView.notifyDataSetChanged();
            }

            if (mini) {
                // limit lines, ascent callouts and waypoint pins all carry labels that have nowhere to
                // go at this size, so the widget stops here
                set.drawFilledEnabled = filled;
                applyRange(range);
                onChartDataUpdateCallbacks.forEach((c) => c());
                onChartDataUpdateCallbacks = [];
                return;
            }

            leftAxis.removeAllLimitLines();
            let limitLine = new LimitLine(profile.min[1], convertElevation(profile.min[1]));
            limitLine.lineColor = colorOutline;
            limitLine.enableDashedLine(4, 3, 0);
            limitLine.lineWidth = 0.5;
            limitLine.yOffset = -1;
            limitLine.textSize = 9 * $fontScale;
            limitLine.textColor = colorOnSurface;
            // limitLine.ensureVisible = true;
            limitLine.labelPosition = LimitLabelPosition.RIGHT_BOTTOM;
            leftAxis.addLimitLine(limitLine);

            limitLine = new LimitLine(profile.max[1], convertElevation(profile.max[1]));
            limitLine.lineColor = colorOutline;
            limitLine.enableDashedLine(4, 3, 0);
            limitLine.lineWidth = 0.5;
            limitLine.yOffset = 1;
            limitLine.textSize = 9 * $fontScale;
            limitLine.textColor = colorOnSurface;
            limitLine.ensureVisible = true;
            leftAxis.addLimitLine(limitLine);

            xAxis.removeAllLimitLines();
            if (showAscents && profile.ascents) {
                profile.ascents.forEach((ascent: AscentSegment) => {
                    const text = convertElevation(ascent.highestElevation) + '\n+' + convertElevation(ascent.gain);
                    limitLine = new LimitLine(profileData[ascent.highestPointIndex].d, text);
                    limitLine.lineColor = colorOutline;
                    limitLine.enableDashedLine(6, 3, 0);
                    limitLine.lineWidth = 0.5;
                    limitLine.textSize = 7 * $fontScale;
                    limitLine.xOffset = 0;
                    limitLine.textColor = colorOnSurface;
                    limitLine.ensureVisible = true;
                    limitLine.drawLabel = (c: Canvas, label: string, x: number, y: number, paint: Paint) => {
                        c.drawCircle(x, y - 6, 6, waypointsBackPaint);
                        waypointsPaint.textSize = 7 * $fontScale;
                        c.drawText('', x, y - 5 + 1, waypointsPaint);
                        //   paint.setTextAlign(Align.CENTER);
                        const staticLayout = new StaticLayout(label, paint, c.getWidth(), LayoutAlignment.ALIGN_NORMAL, 1, 0, true);
                        c.save();
                        c.translate(x, y + 6);
                        staticLayout.draw(c);
                        c.restore();
                    };
                    xAxis.addLimitLine(limitLine);
                });
            }
            if (showWaypoints && it.route.waypoints) {
                it.route.waypoints.forEach((p) => {
                    if (p.properties.showOnMap && p.properties.index > 0) {
                        limitLine = new LimitLine(profileData[p.properties.index].d, ' ');
                        limitLine.lineColor = colorOutline;
                        limitLine.enableDashedLine(6, 3, 0);
                        limitLine.lineWidth = 0.5;
                        limitLine.ensureVisible = true;
                        limitLine.drawLabel = (c: Canvas, label: string, x: number, y: number, paint: Paint) => {
                            c.drawCircle(x - 5, y + 0, 6, waypointsBackPaint);
                            waypointsPaint.textSize = 8 * $fontScale;
                            c.drawText('', x - 5, y + 4 - 1, waypointsPaint);
                        };
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
