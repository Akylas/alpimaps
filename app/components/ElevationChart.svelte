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
    import { LineDataSet } from '@nativescript-community/ui-chart/data/LineDataSet';
    import { Highlight } from '@nativescript-community/ui-chart/highlight/Highlight';
    import { Utils } from '@nativescript/core';
    import { createEventDispatcher } from 'svelte';
    import { NativeViewElementNode } from 'svelte-native/dom';
    import { convertDurationSeconds, formatDistance } from '~/helpers/formatter';
    import { getBounds } from '~/helpers/geolib';
    import { onThemeChanged } from '~/helpers/theme';
    import { getMapContext } from '~/mapModules/MapModule';
    import type { IItem as Item } from '~/models/Item';
    import { showError } from '~/utils/error';
    import { alpimapsFontFamily, borderColor, mdiFontFamily, primaryColor, textColor } from '~/variables';

    const dispatch = createEventDispatcher();
    const mapContext = getMapContext();
    const highlightPaint = new Paint();
    highlightPaint.setColor('#aaa');
    // highlightPaint.setTextAlign(Align.CENTER);
    highlightPaint.setStrokeWidth(1);
    highlightPaint.setTextSize(12);

    export let item: Item;
    let chart: NativeViewElementNode<LineChart>;
    let showProfileGrades = true;

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
            const xAxisRender = chart.nativeView.getRendererXAxis();
            const { min, max } = xAxisRender.getCurrentMinMax();
            const dataSet = chart.nativeView.getData().getDataSetByIndex(0);
            dataSet.setIgnoreFiltered(true);
            const minX = dataSet.getEntryIndexForXValue(min, NaN, Rounding.CLOSEST);
            const maxX = dataSet.getEntryIndexForXValue(max, NaN, Rounding.CLOSEST);
            dataSet.setIgnoreFiltered(false);
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
        DEV_LOG && console.log('onChartHighlight', event.highlight);
        if (!item) {
            return;
        }
        const shouldSelectItem = event.highlight.hasOwnProperty('xPx');
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

        const leftAxis = chartView.getAxisLeft();
        leftAxis.setTextColor($textColor);
        leftAxis.setGridColor($borderColor);
        const xAxis = chartView.getXAxis();
        xAxis.setTextColor($textColor);
        xAxis.setGridColor($borderColor);
        chartView.getData()?.getDataSetByIndex(0)?.setValueTextColor($textColor);
    });
    export function hilghlightPathIndex(onPathIndex: number, remainingDistance: number, remainingTime: number, highlight?: Highlight<Entry>, sendEvent = true) {
        if (!chart) {
            return;
        }
        if (!item) {
            onChartDataUpdateCallbacks.push(() => {
                hilghlightPathIndex(onPathIndex, remainingDistance, remainingTime, highlight, sendEvent);
            });
            return;
        }
        const nChart = chart?.nativeView;
        DEV_LOG && console.log('hilghlightPathIndex', !!item, onPathIndex, remainingDistance, remainingTime, highlight, nChart, new Error().stack);
        if (onPathIndex === -1) {
            if (nChart) {
                nChart.highlight(null);
            }
        } else {
            if (highlight) {
                highlightNString = createNativeAttributedString(
                    {
                        spans: [
                            {
                                fontFamily: mdiFontFamily,
                                color: primaryColor,
                                text: 'mdi-timer-outline'
                            },
                            {
                                text: convertDurationSeconds(remainingTime) + '  '
                            },
                            {
                                fontFamily: mdiFontFamily,
                                color: primaryColor,
                                text: 'mdi-arrow-expand-right'
                            },
                            {
                                text: formatDistance(remainingDistance) + '  '
                            },
                            {
                                fontFamily: mdiFontFamily,
                                color: primaryColor,
                                text: 'mdi-triangle-outline'
                            },
                            {
                                text: highlight.entry.a.toFixed() + 'm' + '  '
                            },
                            {
                                fontFamily: alpimapsFontFamily,
                                color: primaryColor,
                                text: 'alpimaps-angle'
                            },
                            {
                                text: '~' + highlight.entry.g.toFixed() + '%'
                            }
                        ]
                    },
                    null
                );
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
                    const dataSet = nChart.getData().getDataSetByIndex(0);
                    dataSet.setIgnoreFiltered(true);
                    const item = profileData[onPathIndex];
                    dataSet.setIgnoreFiltered(false);
                    DEV_LOG && console.log('highlight', onPathIndex, item.d, item);
                    const highlight = {
                        dataSetIndex: 0,
                        entryIndex: onPathIndex,
                        entry: item
                    };
                    nChart.highlightValues([highlight]);
                    sendEvent && onChartHighlight({ eventName: 'highlight', highlight, object: nChart } as any);
                }
            }
            if (nChart && nChart.getData()) {
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
        const leftAxis = chartView.getAxisLeft();
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
                chartView.zoomedPanWith2Pointers = true;
                chartView.setClipDataToContent(true);
                // chartView.setClipValuesToContent(false);

                // chartView.setExtraTopOffset(30);
                chartView.setMinOffset(0);
                chartView.setExtraOffsets(0, 24, 0, 0);
                chartView.getAxisRight().setEnabled(false);
                chartView.getLegend().setEnabled(false);
                leftAxis.setTextColor($textColor);
                leftAxis.setDrawZeroLine(true);
                leftAxis.setGridColor($borderColor);

                leftAxis.setGridDashedLine(new DashPathEffect([6, 3], 0));
                leftAxis.ensureLastLabel = true;
                // leftAxis.setLabelCount(3);

                xAxis.setPosition(XAxisPosition.TOP);
                xAxis.setLabelTextAlign(Align.CENTER);
                xAxis.ensureLastLabel = true;
                // xAxis.setLabelCount(4);
                xAxis.setTextColor($textColor);
                xAxis.setGridColor($borderColor);
                xAxis.setDrawGridLines(false);
                xAxis.setDrawMarkTicks(true);
                xAxis.setValueFormatter({
                    getAxisLabel: (value) => formatDistance(value)
                });

                chartView.setCustomRenderer({
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
                });
            } else {
                // console.log('clearing highlight')
                chartView.highlightValues(null);
                chartView.resetZoom();
            }
            const deltaA = profile.max[1] - profile.min[1];
            let spaceMin = 0;
            let spaceMax = 0;
            if (deltaA < 100) {
                const space = (100 - deltaA) / 2;
                spaceMin += space;
                spaceMax += space;
            }
            spaceMin += ((deltaA + spaceMin + spaceMax) / Utils.layout.toDeviceIndependentPixels(chart.nativeView.getMeasuredHeight())) * 30;
            leftAxis.setSpaceMin(spaceMin);
            leftAxis.setSpaceMax(spaceMax);
            const chartData = chartView.getData();
            if (!chartData) {
                const set = new LineDataSet(profileData, 'a', 'd', 'a');
                // set.setDrawValues(false);
                // set.setValueTextColor($textColor);
                // set.setValueTextSize(10);
                set.setMaxFilterNumber(50);
                set.setUseColorsForFill(true);
                set.setFillFormatter({
                    getFillLinePosition(dataSet: LineDataSet, dataProvider) {
                        return dataProvider.getYChartMin();
                    }
                });
                // set.setValueFormatter({
                //     getFormattedValue(value: number, entry: Entry, index, count, dataSetIndex: any, viewPortHandler: any) {
                //         if (index === 0 || index === count - 1 || value === profile.max[1] || value === profile.min[1]) {
                //             return convertElevation(value);
                //         }
                //     }
                // } as any);
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
                DEV_LOG && console.log('chart data set', new Error().stack);
            } else {
                // console.log('clearing highlight1')
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

            onChartDataUpdateCallbacks.forEach((c) => c());
            onChartDataUpdateCallbacks = [];
            // chartView.zoomAndCenter(7, 1, 100, 0, AxisDependency.LEFT);
        }
    }
</script>

<linechart {...$$restProps} bind:this={chart} on:highlight={onChartHighlight} on:zoom={onChartPanOrZoom} on:pan={onChartPanOrZoom} />
