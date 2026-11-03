<script context="module" lang="ts">
    import { Canvas, CanvasView, LayoutAlignment, Paint, StaticLayout } from '@nativescript-community/ui-canvas';
    import type { MapPos } from '~/utils/geo';
    import { CollectionView } from '@nativescript-community/ui-collectionview';
    import { Page } from '@nativescript/core';
    import dayjs, { Dayjs } from 'dayjs';
    import { onMount } from 'svelte';
    import { Template } from '@nativescript-community/svelte-native/components';
    import { NativeViewElementNode } from '@nativescript-community/svelte-native/dom';
    import CActionBar from '@shared/components/CActionBar.svelte';
    import { formatTime, lc } from '~/helpers/locale';
    import { onThemeChanged } from '~/helpers/theme';
    import { onNetworkChanged } from '~/services/NetworkService';
    import { type StopLine, type TimesheetPage, type TimesheetStop, getLineTimesheet } from '~/features/trains/lines';
    import { NoNetworkError } from '@akylas/nativescript-app-utils/error';
    import { showError } from '@shared/utils/showError';
    import { navigate } from '@shared/utils/svelte/ui';
    import { showSnack } from '~/utils/ui';
    import { pickDate, pickTime } from '~/utils/utils';
    import { colors, fonts, windowInset } from '~/variables';
    import IconButton from '~/components/common/IconButton.svelte';

    const timePaint = new Paint();
    timePaint.textSize = 12;
</script>

<script lang="ts">
    $: ({ colorOnBackground, colorOnSurfaceVariant, colorOutlineVariant, colorPrimary } = $colors);
    $: ({ bottom: windowInsetBottom } = $windowInset);

    export let line: StopLine;
    let loading = false;
    let page: NativeViewElementNode<Page>;
    let collectionView: NativeViewElementNode<CollectionView>;
    let noNetworkAndNoData = false;
    let timelineItems: TimesheetStop[] = null;
    let timesheet: TimesheetPage = null;
    let directionIndex = 0;
    let directionText: string;
    let currentTime = dayjs().set('s', 0).set('ms', 0);
    // where the pages before this one started, to go back to them
    let previousStarts: Dayjs[] = [];
    DEV_LOG && console.log('line', line);

    async function fetchTimesheet(time: Dayjs, scrollToItem = false) {
        try {
            loading = true;
            const result = await getLineTimesheet(line, line.directions[directionIndex].directionId, time.toDate());
            currentTime = time;
            timesheet = result;
            timelineItems = result.stops;
            directionText = line.directions[directionIndex].headsign;
            if (timelineItems.length === 0) {
                showSnack({ message: lc('no_timesheet_data') });
                return;
            }
            if (scrollToItem) {
                const scrollIndex = timelineItems.findIndex((stop) => isCurrentStop(stop));
                if (scrollIndex >= 0) {
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
    function isCurrentStop(stop: TimesheetStop) {
        return line.stopIds.includes(stop.stopId);
    }

    onNetworkChanged((connected) => {
        if (connected && noNetworkAndNoData) {
            fetchTimesheet(currentTime, true);
        }
    });
    function reverseTimesheet() {
        if (line.directions.length > 1) {
            directionIndex = (directionIndex + 1) % line.directions.length;
            previousStarts = [];
            fetchTimesheet(currentTime, true);
        }
    }

    function getTripTime(item: TimesheetStop, index: number) {
        const time = item.times[index];
        return time ? formatTime(dayjs(time)) : '|';
    }

    async function selectDate() {
        try {
            const dayStart = currentTime.startOf('d');
            const date = await pickDate(currentTime);
            if (date && dayStart.valueOf() !== date) {
                fetchTimesheet(dayjs(date).set('h', currentTime.get('h')).set('m', currentTime.get('m')));
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
                fetchTimesheet(currentTime.set('h', hour).set('m', minute));
            }
        } catch (error) {
            showError(error);
        }
    }
    async function previousDates() {
        const previous = previousStarts.pop();
        if (previous) {
            fetchTimesheet(previous);
        }
    }
    async function nextDates() {
        if (timesheet?.nextTime) {
            previousStarts.push(currentTime);
            fetchTimesheet(dayjs(timesheet.nextTime));
        }
    }

    async function showDetails() {
        try {
            const component = (await import('~/features/trains/LineDetails.svelte')).default;
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

    function drawTripTime(item: TimesheetStop, { canvas, object }: { canvas: Canvas; object: CanvasView }) {
        try {
            const w = canvas.getWidth();
            const h = canvas.getHeight();
            const w5 = w / 5;
            timePaint.color = isCurrentStop(item) ? colorPrimary : colorOnBackground;
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
        DEV_LOG && console.log('onSwipe', event.direction);
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
        fetchTimesheet(currentTime, true);
    });

    onThemeChanged(() => collectionView?.nativeView.refreshVisibleItems());

    // function onItemLoading({ index, view }) {
    //     if (view) {
    //         try {
    //             const canvasView: CanvasView = (view as View).getViewById('canvas');
    //             canvasView?.invalidate();
    //         } catch (error) {
    //             console.error(error);
    //         }
    //     }
    // }
</script>

<page bind:this={page} actionBarHidden={true}>
    <gridlayout columns="auto,*,auto" paddingLeft={$windowInset.left} paddingRight={$windowInset.right} rows="auto,auto,auto,*">
        <label
            autoFontSize={true}
            colSpan={3}
            fontSize={20}
            fontWeight="bold"
            maxFontSize={20}
            maxLines={3}
            padding="15 10 15 10"
            row={1}
            text={(line.longName || directionText)?.replace(' / ', '\n')}
            textAlignment="center"
            verticalTextAlignment="center"
            visibility={line.longName || directionText ? 'visible' : 'collapse'} />
        <gridlayout colSpan={3} columns="*,40,*" row={2} rows="50,auto" visibility={noNetworkAndNoData ? 'hidden' : 'visible'} on:swipe={onSwipe}>
            <canvaslabel borderBottomColor={colorOutlineVariant} borderBottomWidth={1} marginLeft={20} rippleColor={colorOnBackground} on:tap={() => selectDate()}>
                <cspan color={colorOnSurfaceVariant} fontSize={11} text={lc('date')} verticalAlignment="top" />
                <cspan fontFamily={$fonts.mdi} fontSize={22} text="mdi-calendar-today" textAlignment="right" verticalAlignment="middle" />
                <cspan fontSize={14} text={currentTime.format('L')} verticalAlignment="middle" />
            </canvaslabel>
            <canvaslabel borderBottomColor={colorOutlineVariant} borderBottomWidth={1} col={2} marginRight={20} rippleColor={colorOnBackground} on:tap={() => selectTime()}>
                <cspan color={colorOnSurfaceVariant} fontSize={11} text={lc('time')} verticalAlignment="top" />
                <cspan fontFamily={$fonts.mdi} fontSize={22} text="mdi-calendar-clock" textAlignment="right" verticalAlignment="middle" />
                <cspan fontSize={14} text={formatTime(currentTime)} verticalAlignment="middle" />
            </canvaslabel>
            <stacklayout colSpan={3} horizontalAlignment="center" margin={20} orientation="horizontal" rippleColor={colorOnBackground} row={1} on:tap={reverseTimesheet}>
                <label fontFamily={$fonts.mdi} fontSize={22} text="mdi-swap-vertical" verticalTextAlignment="center" />
                <label fontSize={14} text={directionText} />
            </stacklayout>
            <IconButton colSpan={3} horizontalAlignment="left" row={1} text="mdi-chevron-left" on:tap={previousDates} />
            <IconButton colSpan={3} horizontalAlignment="right" row={1} text="mdi-chevron-right" on:tap={nextDates} />
        </gridlayout>

        <collectionview bind:this={collectionView} colSpan={3} items={timelineItems} row={3} android:marginBottom={windowInsetBottom} rowHeight={56} on:swipe={onSwipe}>
            <Template let:item>
                <gridlayout borderBottomColor={colorOutlineVariant} borderBottomWidth={1} columns="*,200" padding="0 10 0 10" rippleColor={line.color}>
                    <label
                        id="test"
                        autoFontSize={true}
                        color={isCurrentStop(item) ? colorPrimary : colorOnBackground}
                        fontSize={13}
                        maxFontSize={13}
                        maxLines={3}
                        padding="4 10 4 0"
                        text={item.name}
                        verticalTextAlignment="center" />
                    <canvasview id="canvas" col={1} on:draw={(e) => drawTripTime(item, e)} />
                </gridlayout>
            </Template>
        </collectionview>
        <activityindicator busy={true} colSpan={3} horizontalAlignment="center" row={3} verticalAlignment="middle" visibility={loading ? 'visible' : 'hidden'} />
        {#if noNetworkAndNoData}
            <canvaslabel colSpan={3} row={2} rowSpan={2}>
                <cgroup textAlignment="center" verticalAlignment="middle">
                    <cspan fontFamily={$fonts.mdi} fontSize={50} text="mdi-alert-circle-outline" />
                    <cspan fontSize={20} text={'\n' + lc('no_network')} />
                </cgroup>
            </canvaslabel>
        {/if}
        <CActionBar backgroundColor="transparent" buttonsDefaultVisualState="transparent" colSpan={3} labelsDefaultVisualState="transparent">
            <label
                slot="center"
                class="transitIconLabel"
                autoFontSize={true}
                backgroundColor={line.color}
                colSpan={3}
                color={line.textColor}
                horizontalAlignment="center"
                text={line.shortName || line.longName} />
            <IconButton text="mdi-information-outline" on:tap={showDetails} />
        </CActionBar>
    </gridlayout>
</page>
