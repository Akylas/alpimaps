<script context="module" lang="ts">
    import { CollectionView } from '@nativescript-community/ui-collectionview';
    import { showSnack } from '@nativescript-community/ui-material-snackbar';
    import { Page, View } from '@nativescript/core';
    import { openUrl } from '@nativescript/core/utils';
    import dayjs, { Dayjs } from 'dayjs';
    import { onMount } from 'svelte';
    import { Template } from 'svelte-native/components';
    import { NativeViewElementNode, navigate } from 'svelte-native/dom';
    import CActionBar from '~/components/common/CActionBar.svelte';
    import { formatTime, lc } from '~/helpers/locale';
    import { onThemeChanged } from '~/helpers/theme';
    import { onNetworkChanged } from '~/services/NetworkService';
    import { MetroTimesheet, MetroTripStop, TransitRoute, transitService } from '~/services/TransitService';
    import { NoNetworkError, showError } from '~/utils/error';
    import { pickDate, pickTime } from '~/utils/utils';
    import { colors, fonts, navigationBarHeight } from '~/variables';
    import IconButton from '../common/IconButton.svelte';
    import { Canvas, CanvasView, LayoutAlignment, Paint, StaticLayout } from '@nativescript-community/ui-canvas';

    const timePaint = new Paint();
    timePaint.textSize = 12;
</script>

<script lang="ts">
    $: ({ colorOutlineVariant, colorOnSurface, colorOnSurfaceVariant, colorPrimary } = $colors);

    export let line: TransitRoute;
    const lineColor = line.color || transitService.defaultTransitLineColor;
    let loading = false;
    let page: NativeViewElementNode<Page>;
    let collectionView: NativeViewElementNode<CollectionView>;
    let noNetworkAndNoData = false;
    let timelineItems: MetroTripStop[] = null;
    let lineData: MetroTimesheet = null;
    let lineDataIndex: 0 | 1 = 0;
    let directionText: string;
    let currentTime = dayjs().set('s', 0).set('ms', 0);
    let currentStopId: string = null;
    DEV_LOG && console.log('line', line);

    async function fetchLineTimeline(time?: Dayjs, scrollToItem = false) {
        try {
            loading = true;
            currentTime = time;
            lineData = await transitService.getLineTimeline(line.id, time?.utc(true).valueOf());
            DEV_LOG && console.log('lineData', line.id, JSON.stringify(lineData));
            // prevTime = lineData[lineDataIndex].prevTime;
            // nextTime = lineData[lineDataIndex].nextTime;
            timelineItems = lineData[lineDataIndex].arrets;
            if (timelineItems.length === 0) {
                showSnack({ message: lc('no_timesheet_data') });
                return;
            }
            // console.log('fetchLineTimeline', time.valueOf(), lineData[lineDataIndex].prevTime, lineData[lineDataIndex].nextTime);
            directionText = timelineItems[0].stopName + '\n' + timelineItems[timelineItems.length - 1].stopName;
            if (line.stopIds) {
                currentStopId = line.stopIds[lineDataIndex];
                const index = timelineItems.findIndex((a) => a.stopId === currentStopId);
                DEV_LOG && console.log('currentStopId', currentStopId, index);
                if (index === -1) {
                    line.stopIds = line.stopIds.reverse();
                    currentStopId = line.stopIds[lineDataIndex];
                }
                if (scrollToItem) {
                    const scrollIndex = timelineItems.findIndex((s) => s.stopId === currentStopId);
                    collectionView.nativeView.scrollToIndex(scrollIndex, false);
                }
            }
            noNetworkAndNoData = false;
        } catch (error) {
            if (error instanceof NoNetworkError && !timelineItems) {
                noNetworkAndNoData = true;
            }
            showError(error);
        } finally {
            loading = false;
        }
    }

    onNetworkChanged((connected) => {
        if (connected && noNetworkAndNoData) {
            fetchLineTimeline(undefined, true);
        }
    });
    function reverseTimesheet() {
        lineDataIndex = 1 - lineDataIndex;
        timelineItems = lineData[lineDataIndex].arrets;
        directionText = timelineItems[0].stopName + '\n' + timelineItems[timelineItems.length - 1].stopName;
        if (line.stopIds) {
            currentStopId = line.stopIds[lineDataIndex];
            const index = timelineItems.findIndex((a) => a.stopId === currentStopId);
            if (index === -1) {
                line.stopIds = line.stopIds.reverse();
                currentStopId = line.stopIds[lineDataIndex];
            }
            const scrollIndex = timelineItems.findIndex((s) => s.stopId === currentStopId);
            collectionView.nativeView.scrollToIndex(scrollIndex, false);
        }
    }

    function getTripTime(item, index) {
        const data = item.trips[index];
        if (typeof data === 'string') {
            return data;
        }
        if (index !== undefined) {
            return formatTime(dayjs().startOf('d').add(data, 's'));
        }
        return '|';
    }

    async function selectDate() {
        try {
            const dayStart = currentTime.startOf('d');
            const date = await pickDate(currentTime);
            if (date && dayStart.valueOf() !== date) {
                fetchLineTimeline(dayjs(date).set('h', currentTime.get('h')).set('m', currentTime.get('m')));
            }
        } catch (error) {
            showError(error);
        }
    }
    async function selectTime() {
        try {
            const currentMinute = currentTime.get('h');
            const currentHour = currentTime.get('m');
            const [minute, hour] = await pickTime(currentTime);

            if (currentMinute !== minute && currentHour !== hour) {
                fetchLineTimeline(currentTime.set('h', hour).set('m', minute));
            }
        } catch (error) {
            showError(error);
        }
    }
    async function previousDates() {
        if (lineData[lineDataIndex].prevTime) {
            fetchLineTimeline(dayjs.utc(lineData[lineDataIndex].prevTime));
        }
    }
    async function nextDates() {
        if (lineData[lineDataIndex].nextTime) {
            fetchLineTimeline(dayjs.utc(lineData[lineDataIndex].nextTime));
        }
    }

    async function downloadPDF() {
        try {
            openUrl(`https://data.mobilites-m.fr/api/ficheHoraires/pdf?route=${line.id.replace('_', ':')}`);
        } catch (error) {
            showError(error);
        }
    }

    async function showDetails() {
        try {
            const component = (await import('~/components/transit/TransitLineDetails.svelte')).default;
            navigate({
                page: component,
                props: {
                    line
                }
            });
        } catch (error) {
            showError(error);
        }
    }

    function drawTripTime(item: MetroTripStop, { canvas, object }: { canvas: Canvas; object: CanvasView }) {
        try {
            const w = canvas.getWidth();
            const h = canvas.getHeight();
            const w5 = w / 5;
            timePaint.color = item.stopId === currentStopId ? colorPrimary : colorOnSurface;
            for (let index = 0; index < 4; index++) {
                const staticLayout = new StaticLayout(getTripTime(item, index), timePaint, w5 - 10, LayoutAlignment.ALIGN_CENTER, 1, 0, true);
                canvas.save();
                canvas.translate(w5 * (index + 1), (h - staticLayout.getHeight()) / 2);
                staticLayout.draw(canvas);
                canvas.restore();
            }
        } catch (err) {
            console.error('onCanvas2Draw', err, err.stack);
        }
    }
    function onSwipe(event) {
        console.log('onSwipe', event.direction);
        switch (event.direction) {
            case 1:
                previousDates();
                break;
            case 2:
                nextDates();
                break;
        }
    }

    onMount(() => {
        fetchLineTimeline(currentTime, true);
    });

    onThemeChanged(() => collectionView?.nativeView.refreshVisibleItems());

    function onItemLoading({ index, view }) {
        if (view) {
            try {
                const canvasView: CanvasView = (view as View).getViewById('canvas');
                canvasView?.invalidate();
            } catch (error) {
                console.error(error);
            }
        }
    }
</script>

<page bind:this={page} actionBarHidden={true}>
    <gridlayout columns="auto,*,auto" rows="auto,auto,auto,*">
        <label
            autoFontSize={true}
            colSpan={3}
            fontSize={20}
            fontWeight="bold"
            maxFontSize={20}
            maxLines={3}
            padding="15 10 15 10"
            row={1}
            text={(line.longName || line.name)?.replace(' / ', '\n')}
            textAlignment="center"
            verticalTextAlignment="center"
            visibility={line.longName ? 'visible' : 'collapse'} />
        <gridlayout colSpan={3} columns="*,40,*" row={2} rows="50,auto" visibility={noNetworkAndNoData ? 'hidden' : 'visible'} on:swipe={onSwipe}>
            <canvaslabel borderBottomColor={colorOutlineVariant} borderBottomWidth={1} marginLeft={20} rippleColor={colorOnSurface} on:tap={() => selectDate()}>
                <cspan color={colorOnSurfaceVariant} fontSize={11} text={lc('date')} verticalAlignment="top" />
                <cspan fontFamily={$fonts.mdi} fontSize={22} text="mdi-calendar-today" textAlignment="right" verticalAlignment="middle" />
                <cspan fontSize={14} text={currentTime.format('L')} verticalAlignment="middle" />
            </canvaslabel>
            <canvaslabel borderBottomColor={colorOutlineVariant} borderBottomWidth={1} col={2} marginRight={20} rippleColor={colorOnSurface} on:tap={() => selectTime()}>
                <cspan color={colorOnSurfaceVariant} fontSize={11} text={lc('time')} verticalAlignment="top" />
                <cspan fontFamily={$fonts.mdi} fontSize={22} text="mdi-calendar-clock" textAlignment="right" verticalAlignment="middle" />
                <cspan fontSize={14} text={formatTime(currentTime)} verticalAlignment="middle" />
            </canvaslabel>
            <stacklayout colSpan={3} horizontalAlignment="center" margin={20} orientation="horizontal" rippleColor={colorOnSurface} row={1} on:tap={reverseTimesheet}>
                <label fontFamily={$fonts.mdi} fontSize={22} text="mdi-swap-vertical" verticalTextAlignment="center" />
                <label fontSize={14} text={directionText} />
            </stacklayout>
            <IconButton colSpan={3} horizontalAlignment="left" row={1} text="mdi-chevron-left" on:tap={previousDates} />
            <IconButton colSpan={3} horizontalAlignment="right" row={1} text="mdi-chevron-right" on:tap={nextDates} />
        </gridlayout>

        <collectionview bind:this={collectionView} colSpan={3} items={timelineItems} row={3} android:marginBottom={$navigationBarHeight} rowHeight={56} on:swipe={onSwipe}>
            <Template let:item>
                <gridlayout borderBottomColor={colorOutlineVariant} borderBottomWidth={1} columns="*,200" padding="0 10 0 10" rippleColor={item.color}>
                    <label
                        id="test"
                        autoFontSize={true}
                        color={item.stopId === currentStopId ? colorPrimary : colorOnSurface}
                        fontSize={13}
                        maxFontSize={13}
                        maxLines={3}
                        padding="4 10 4 0"
                        text={item.stopName}
                        verticalTextAlignment="center" />
                    <canvasview id="canvas" col={1} on:draw={(e) => drawTripTime(item, e)} />
                </gridlayout>
            </Template>
        </collectionview>
        <mdactivityindicator busy={true} colSpan={3} horizontalAlignment="center" row={3} verticalAlignment="middle" visibility={loading ? 'visible' : 'hidden'} />
        {#if noNetworkAndNoData}
            <canvaslabel colSpan={3} row={2} rowSpan={2}>
                <cgroup textAlignment="center" verticalAlignment="middle">
                    <cspan fontFamily={$fonts.mdi} fontSize={50} text="mdi-alert-circle-outline" />
                    <cspan fontSize={20} text={'\n' + lc('no_network')} />
                </cgroup>
            </canvaslabel>
        {/if}
        <CActionBar backgroundColor="transparent" buttonsDefaultVisualState="transparent" colSpan={3} labelsDefaultVisualState="transparent">
            <label slot="center" class="transitIconLabel" autoFontSize={true} backgroundColor={lineColor} colSpan={3} color={line.textColor} marginLeft={5} text={line.shortName || line.name} />
            <IconButton text="mdi-file-pdf-box" on:tap={downloadPDF} />
            <IconButton text="mdi-information-outline" on:tap={showDetails} />
        </CActionBar>
    </gridlayout>
</page>
