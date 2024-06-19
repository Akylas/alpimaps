<script context="module" lang="ts">
    import { GetMoonIlluminationResult, GetTimesResult, getMoonIllumination, getMoonPosition, getPosition, getTimes } from 'suncalc';
    // import { moon, MoonPhase, MoonPosition, sun, SunPosition, SunTimes } from '@modern-dev/daylight/lib/es6';
    import { Align, Canvas, DashPathEffect, LayoutAlignment, Paint, StaticLayout, Style } from '@nativescript-community/ui-canvas';
    import { CanvasLabel } from '@nativescript-community/ui-canvaslabel/canvaslabel.common';
    import { LineChart } from '@nativescript-community/ui-chart/charts';
    import { AxisBase } from '@nativescript-community/ui-chart/components/AxisBase';
    import { XAxisPosition } from '@nativescript-community/ui-chart/components/XAxis';
    import { Entry } from '@nativescript-community/ui-chart/data/Entry';
    import { LineData } from '@nativescript-community/ui-chart/data/LineData';
    import { LineDataSet } from '@nativescript-community/ui-chart/data/LineDataSet';
    import { Highlight } from '@nativescript-community/ui-chart/highlight/Highlight';
    import { Utils } from '@nativescript-community/ui-chart/utils/Utils';
    import { ViewPortHandler } from '@nativescript-community/ui-chart/utils/ViewPortHandler';
    import dayjs, { Dayjs } from 'dayjs';
    import { NativeViewElementNode } from 'svelte-native/dom';
    import type { GeoLocation } from '~/handlers/GeoHandler';
    import { CompassInfo, getCompassInfo } from '~/helpers/geolib';
    import { formatTime, getLocalTime, lc } from '~/helpers/locale';
    import { showError } from '~/utils/error';
    import { PI_DIV2, TO_DEG, TO_RAD } from '~/utils/geo';
    import { pickDate } from '~/utils/utils';
    import { colors, fonts } from '~/variables';
    import CompassView from '../compass/CompassView.svelte';
    import { packageService } from '~/services/PackageService';
    import { onDestroy } from 'svelte';
    import { clearInterval } from '~/utils/utils/index.ios';
    import { createNativeAttributedString } from '@nativescript-community/text';

    const nightPaint = new Paint();
    nightPaint.color = '#00000099';
    const nightLiinePaint = new Paint();
    nightLiinePaint.color = '#dddddd66';

    const subCanvasTextPaint = new Paint();
</script>

<script lang="ts">
    $: ({ colorOnSurface, colorOutline } = $colors);
    let chart: NativeViewElementNode<LineChart>;

    let chartInitialized = false;
    export let location: GeoLocation;
    export let timezone: string = null;
    export let name: string = null;
    export let subtitle: string = null;
    let timezoneOffset;

    if (!timezone) {
        const result = packageService.getTimezone(location);
        if (result?.getFeatureCount() > 0) {
            timezone = result?.getFeature(0).properties['tzid'];
        }
    }
    if (timezone) {
        if (__ANDROID__) {
            const nTimezone = java.util.TimeZone.getTimeZone(timezone);
            timezoneOffset = nTimezone.getOffset(Date.now()) / 3600000;
        } else {
            timezoneOffset = NSTimeZone.alloc().initWithName(timezone).daylightSavingTimeOffsetForDate(new Date()) / 3600;
        }
    }
    export let startTime = getLocalTime(undefined, timezoneOffset);
    let currentTime = startTime;
    let timeInterval;
    if (name) {
        timeInterval = setInterval(() => {
            currentTime = currentTime.add(1, 'm');
        }, 60000);
    }
    onDestroy(() => {
        if (timeInterval) {
            clearInterval(timeInterval);
            timeInterval = null;
        }
    });
    // let limitLine: LimitLine;
    let illumination: GetMoonIlluminationResult; // MoonPhase;
    let sunTimes: GetTimesResult; // SunTimes;
    let sunriseEndAzimuth: CompassInfo; // SunTimes;
    let sunsetStartAzimuth: CompassInfo; // SunTimes;
    let moonAzimuth: CompassInfo;
    let sunAzimuth: CompassInfo; // SunTimes;
    let sunriseEnd: number;
    let sunsetStart: number;
    let sunPoses: any[]; // SunPosition[];
    let moonPoses: any[]; // MoonPosition[];

    const moonPaint = new Paint();
    moonPaint.strokeWidth = 1.5;

    const highlightPaint = new Paint();
    highlightPaint.setColor('white');
    highlightPaint.setStrokeWidth(2);
    highlightPaint.setPathEffect(new DashPathEffect([3, 3], 0));
    highlightPaint.setTextAlign(Align.LEFT);
    highlightPaint.setTextSize(10);

    let bottomLabel: NativeViewElementNode<CanvasLabel>;
    function updateChartData() {
        if (!chart) {
            return;
        }

        const computeStartTime = getLocalTime(startTime.startOf('d').valueOf(), timezoneOffset);
        const chartView = chart.nativeView;
        const sets = [];
        sunPoses = [];
        moonPoses = [];
        for (let index = 0; index <= 24 * 60; index += 10) {
            const date = computeStartTime.add(index, 'minutes').toDate();
            sunPoses.push(getPosition(date, location.lat, location.lon));
            moonPoses.push(getMoonPosition(date, location.lat, location.lon));
        }
        if (!chartInitialized) {
            chartInitialized = true;
            const leftAxis = chartView.leftAxis;
            const xAxis = chartView.xAxis;
            chartView.setExtraOffsets(0, 0, 0, 0);
            chartView.minOffset = 0;
            chartView.clipDataToContent = false;
            chartView.highlightPerTapEnabled = true;
            chartView.highlightPerDragEnabled = true;
            chartView.customRenderer = {
                drawHighlight(c: Canvas, h: Highlight<Entry>, set: LineDataSet, paint: Paint) {
                    const w = c.getWidth();
                    const height = c.getHeight();
                    c.drawRect(0, height / 2, w, height, nightPaint);
                    c.drawLine(0, height / 2, w, height / 2, nightLiinePaint);
                    const hours = Math.min(Math.floor(h.x / 6), 23);
                    const minutes = (h.x * 10) % 60;
                    startTime = startTime.set('h', hours).set('m', minutes);
                    c.drawLine(h.drawX, 0, h.drawX, c.getHeight(), highlightPaint);
                    highlightPaint.setTextAlign(Align.LEFT);
                    let x = h.drawX + 4;
                    const text = formatTime(startTime);
                    const size = Utils.calcTextSize(highlightPaint, text);
                    if (x > c.getWidth() - size.width) {
                        x = h.drawX - 4;
                        highlightPaint.setTextAlign(Align.RIGHT);
                    }
                    c.drawText(text, x, 14, highlightPaint);
                    bottomLabel?.nativeView?.redraw();
                }
            };
            leftAxis.labelCount = 0;
            leftAxis.drawGridLines = false;
            leftAxis.drawAxisLine = false;
            leftAxis.drawLabels = false;
            leftAxis.axisMinimum = -PI_DIV2;
            leftAxis.axisMaximum = PI_DIV2;
            xAxis.position = XAxisPosition.BOTTOM_INSIDE;
            xAxis.forcedInterval = 24;
            xAxis.textColor = 'white';
            xAxis.drawAxisLine = false;
            xAxis.drawGridLines = false;
            xAxis.ensureVisible = true;
            xAxis.labelTextAlign = Align.CENTER;
            xAxis.drawLabels = true;
            xAxis.valueFormatter = {
                getAxisLabel(value: any, axis: AxisBase) {
                    const time = computeStartTime.add(value * 10, 'minutes');
                    return formatTime(time);
                }
            };
        }
        const chartData = chartView.data;
        if (!chartData) {
            let set = new LineDataSet(sunPoses, 'sun', undefined, 'altitude');
            set.fillFormatter = {
                getFillLinePosition: (dataSet, dataProvider) => 0
            };
            set.fillColor = set.color = '#ffdd55';
            set.fillAlpha = 50;
            set.drawFilledEnabled = true;
            set.lineWidth = 3;
            sets.push(set);
            set = new LineDataSet(moonPoses, 'moon', undefined, 'altitude');
            set.color = '#bbb';
            set.lineWidth = 1;
            sets.unshift(set);

            const lineData = new LineData(sets);
            chartView.data = lineData;

            const nowMinutes = startTime.diff(computeStartTime, 'minutes');
            const h = chartView.getHighlightByXValue(nowMinutes / 10);
            chartView.highlight(h[0]);
        } else {
            chartData.getDataSetByIndex(1).values = sunPoses;
            chartData.getDataSetByIndex(1).notifyDataSetChanged();
            chartData.getDataSetByIndex(0).values = moonPoses;
            chartData.getDataSetByIndex(0).notifyDataSetChanged();
            chartData.notifyDataChanged();
            chartView.notifyDataSetChanged();
            chartView.invalidate();
        }
    }

    async function selectDate() {
        try {
            const date = await pickDate(startTime);
            if (date && startTime.valueOf() !== date) {
                updateStartTime(getLocalTime(date, timezoneOffset));
            }
        } catch (error) {
            showError(error);
        }
    }

    $: {
        try {
            if (chart) {
                updateChartData();
            }
        } catch (err) {
            showError(err);
        }
    }

    function updateStartTime(time: Dayjs) {
        startTime = time;
        updateChartData();
    }

    function getMoonPhaseIcon(illumination: any /* MoonPhase */) {
        switch (Math.round(illumination.phase * 7)) {
            case 0:
                return 'mdi-moon-new';
            case 1:
                return 'mdi-moon-waxing-crescent';
            case 2:
                return 'mdi-moon-first-quarter';
            case 3:
                return 'mdi-moon-waxing-gibbous';
            case 4:
                return 'mdi-moon-full';
            case 5:
                return 'mdi-moon-waning-gibbous';
            case 6:
                return 'mdi-moon-last-quarter';
            case 7:
                return 'mdi-moon-waning-crescent';
        }
    }
    $: {
        try {
            const date = startTime.toDate();
            illumination = getMoonIllumination(date);
            moonAzimuth = getCompassInfo(getMoonPosition(date, location.lat, location.lon).azimuth * TO_DEG + 180);
            sunTimes = getTimes(date, location.lat, location.lon);
            sunriseEnd = dayjs.utc(sunTimes.sunriseEnd.valueOf()).valueOf();
            sunsetStart = dayjs.utc(sunTimes.sunsetStart.valueOf()).valueOf();
            sunAzimuth = getCompassInfo(getPosition(date, location.lat, location.lon).azimuth * TO_DEG + 180);
            // sunriseEndAzimuth = getCompassInfo(getPosition(sunTimes.sunriseEnd, undefined, timezoneOffset, location.lat, location.lon).azimuth * TO_DEG + 180);
            // sunsetStartAzimuth = getCompassInfo(getPosition(sunTimes.sunsetStart, undefined, timezoneOffset, location.lat, location.lon).azimuth * TO_DEG + 180);
        } catch (err) {
            console.error(err, err.stack);
        }
    }

    // async function setDateTime() {
    //     try {
    //         const SliderPopover = (await import('~/components/SliderPopover.svelte')).default;
    //         const nowMinutes = startTime.diff(startTime.startOf('d'), 'minutes');
    //         showPopover({
    //             view: SliderPopover,
    //             anchor: bottomLabel,
    //             vertPos: VerticalPosition.ABOVE,
    //             props: {
    //                 backgroundColor: new Color(colorOnSurfaceContainer).setAlpha(200).hex,
    //                 min: 0,
    //                 max: 24 * 60 - 1,
    //                 step: 1,
    //                 value: nowMinutes,
    //                 formatter(value) {
    //                     const hours = Math.floor(value / 60);
    //                     const minutes = value % 60;
    //                     return formatTime(dayjs().set('h', hours).set('m', minutes));
    //                 },
    //                 valueFormatter(value) {
    //                     const hours = Math.floor(value / 60);
    //                     const minutes = value % 60;
    //                     return formatTime(dayjs().set('h', hours).set('m', minutes));
    //                 },
    //                 onChange(value) {
    //                     const hours = Math.floor(value / 60);
    //                     const minutes = value % 60;
    //                     startTime = startTime.set('h', hours).set('m', minutes);
    //                 }
    //             }
    //         });
    //     } catch (err) {
    //         showError(err);
    //     }
    // }
    function drawMoonPosition({ canvas }: { canvas: Canvas }) {
        const w = canvas.getWidth();
        const h = canvas.getHeight();

        moonPaint.setColor(colorOnSurface);

        const cx = w - 60;
        const cy = h / 2;
        const cr = 14;

        function getCenter(bearing, altitude?) {
            const rad = TO_RAD * ((bearing - 90) % 360);
            // const ryd = (cr) * (1 - Math.max(0, altitude) / 90);
            const ryd = cr;
            const result = [cx + Math.cos(rad) * ryd, cy + +Math.sin(rad) * ryd];
            return result;
        }
        moonPaint.setColor('darkgray');
        moonPaint.style = Style.STROKE;
        canvas.drawCircle(cx, cy, cr, moonPaint);
        moonPaint.style = Style.FILL;
        moonPaint.setColor('gray');
        let center = getCenter(moonAzimuth.bearing);
        canvas.drawCircle(center[0], center[1], 5, moonPaint);
        moonPaint.setColor('#ffdd55');
        center = getCenter(sunAzimuth.bearing);
        canvas.drawCircle(center[0], center[1], 5, moonPaint);
    }
    function onSubCanvasDraw({ canvas }: { canvas: Canvas }) {
        const w = canvas.getWidth();
        const h = canvas.getHeight();
        const padding = 10;

        subCanvasTextPaint.setTextAlign(Align.LEFT);
        subCanvasTextPaint.textSize = 13;
        subCanvasTextPaint.color = colorOnSurface;
        function drawOnSubCanvas(spans, paddingTop) {
            const nString = createNativeAttributedString({
                spans
            });
            const staticLayout = new StaticLayout(nString, subCanvasTextPaint, w, LayoutAlignment.ALIGN_NORMAL, 1, 0, true);
            canvas.translate(padding, 2 * padding + paddingTop);
            staticLayout.draw(canvas);
        }

        // canvas.save();
        // drawOnSubCanvas(
        //     [
        //         {
        //             color: '#ffa500',
        //             fontFamily: $fonts.mdi,
        //             text: 'mdi-weather-sunset-up',
        //             verticalAlignment: 'center'
        //         },
        //         {
        //             text: ' ' + lc('sunrise') + ':',
        //             verticalAlignment: 'center'
        //         }
        //     ],
        //     0
        // );
        // subCanvasTextPaint.setTextAlign(Align.RIGHT);
        // canvas.drawText(formatTime(sunriseEnd, undefined, timezoneOffset), w - 2 * padding, 13, subCanvasTextPaint);
        // subCanvasTextPaint.setTextAlign(Align.LEFT);
        // canvas.restore();
        // canvas.save();
        // drawOnSubCanvas(
        //     [
        //         {
        //             color: '#ff7200',
        //             fontFamily: $fonts.mdi,
        //             text: 'mdi-weather-sunset-down',
        //             verticalAlignment: 'center'
        //         },
        //         {
        //             text: ' ' + lc('sunset') + ':',
        //             verticalAlignment: 'center'
        //         }
        //     ],
        //     30
        // );
        // subCanvasTextPaint.setTextAlign(Align.RIGHT);
        // canvas.drawText(formatTime(sunsetStart, undefined, timezoneOffset), w - 2 * padding, 13, subCanvasTextPaint);
        // canvas.restore();

        (
            [
                [
                    [
                        {
                            color: '#ffa500',
                            fontFamily: $fonts.mdi,
                            text: 'mdi-weather-sunset-up',
                            verticalAlignment: 'center'
                        },
                        {
                            text: ' ' + lc('sunrise') + ':',
                            verticalAlignment: 'center'
                        }
                    ],
                    formatTime(sunriseEnd, undefined, timezoneOffset)
                ],
                [
                    [
                        {
                            color: '#ff7200',
                            fontFamily: $fonts.mdi,
                            text: 'mdi-weather-sunset-down',
                            verticalAlignment: 'center'
                        },
                        {
                            text: ' ' + lc('sunset') + ':',
                            verticalAlignment: 'center'
                        }
                    ],
                    formatTime(sunsetStart, undefined, timezoneOffset)
                ],
                [lc('daylight_duration'), dayjs.duration({ milliseconds: sunsetStart - sunriseEnd }).humanize()],
                [lc('daylight_left'), dayjs.duration({ milliseconds: sunsetStart - Date.now() }).humanize()]
            ] as [any, string][]
        ).forEach((e, index) => {
            const y = 30 + 30 * index;
            subCanvasTextPaint.setTextAlign(Align.LEFT);
            if (Array.isArray(e[0])) {
                canvas.save();
                drawOnSubCanvas(e[0], y - 35);
                canvas.restore();
            } else {
                canvas.drawText(e[0] + ':', padding, y, subCanvasTextPaint);
            }
            subCanvasTextPaint.setTextAlign(Align.RIGHT);
            canvas.drawText(e[1], w - padding, y, subCanvasTextPaint);
        });
    }
</script>

<gesturerootview columns="3*,4*" rows={'auto,50,200,50,200'}>
    {#if name}
        <gridlayout borderBottomColor={colorOutline} borderBottomWidth={1} colSpan={2} columns="*,130" height={50}>
            <label marginLeft={16} verticalTextAlignment="center">
                <cspan fontSize={17} fontWeight="600" text={name} />
                <cspan fontSize={14} text={subtitle ? '\n' + subtitle : null} />
            </label>
            <label col={1} fontSize={20} fontWeight="500" marginRight={16} text={formatTime(currentTime, 'LT')} textAlignment="right" verticalTextAlignment="center" />
        </gridlayout>
    {/if}
    <mdbutton class="icon-btn" horizontalAlignment="left" row={1} text="mdi-chevron-left" variant="text" on:tap={() => updateStartTime(startTime.subtract(1, 'd'))} />
    <label colSpan={2} fontSize={17} marginLeft={50} marginRight={50} row={1} text={startTime.format('LL')} textAlignment="center" verticalTextAlignment="center" on:tap={selectDate} />
    <mdbutton class="icon-btn" col={1} horizontalAlignment="right" row={1} text="mdi-chevron-right" variant="text" on:tap={() => updateStartTime(startTime.add(1, 'd'))} />
    <linechart bind:this={chart} backgroundColor="#222222" colSpan={3} row={2}>
        <!-- <rectangle fillColor="#a0caff" height="50%" width="100%" /> -->
    </linechart>
    {#if sunTimes}
        <canvaslabel bind:this={bottomLabel} colSpan={3} fontSize={18} padding="0 10 0 10" row={3} on:draw={drawMoonPosition}>
            <cgroup color="#ffa500" verticalAlignment="middle">
                <cspan fontFamily={$fonts.mdi} text="mdi-weather-sunset-up" />
                <cspan text={' ' + formatTime(sunriseEnd, undefined, timezoneOffset)} />
            </cgroup>
            <cgroup color="#ff7200" textAlignment="center" verticalAlignment="middle">
                <cspan fontFamily={$fonts.mdi} text="mdi-weather-sunset-down" />
                <cspan text={' ' + formatTime(sunsetStart, undefined, timezoneOffset)} />
            </cgroup>
            <cgroup textAlignment="right" verticalAlignment="middle">
                <!-- <cspan text={moonAzimuth.exact + '(' + Math.round(illumination.fraction * 100) + '%) '} /> -->
                <cspan fontFamily={$fonts.mdi} text={getMoonPhaseIcon(illumination)} />
            </cgroup>
        </canvaslabel>
    {/if}

    <CompassView date={startTime} {location} row={4} updateWithSensor={false} />
    <canvasview col={1} fontSize={13} padding={10} row={4} on:draw={onSubCanvasDraw}>
        <!-- <cgroup paddingTop={10}>
            <cspan color="#ffa500" fontFamily={$fonts.mdi} text="mdi-weather-sunset-up" />
            <cspan text={lc('sunrise')} />
        </cgroup>
        <cspan paddingTop={10} text={formatTime(sunriseEnd, undefined, timezoneOffset)} textAlignment="right" />
        <cgroup paddingTop={40}>
            <cspan color="#ff7200" fontFamily={$fonts.mdi} text="mdi-weather-sunset-down" />
            <cspan text={lc('sunset')} />
        </cgroup>
        <cspan paddingTop={40} text={formatTime(sunsetStart, undefined, timezoneOffset)} textAlignment="right" /> -->
    </canvasview>
</gesturerootview>
