<script context="module" lang="ts">
    import { Canvas, CanvasView, LayoutAlignment, Paint, StaticLayout } from '@nativescript-community/ui-canvas';
    import type { MapPos } from '~/utils/geo';
    import { CollectionView } from '@nativescript-community/ui-collectionview';
    import { Color, Page } from '@nativescript/core';
    import dayjs, { Dayjs } from 'dayjs';
    import { onMount } from 'svelte';
    import { Template } from '@nativescript-community/svelte-native/components';
    import { NativeViewElementNode } from '@nativescript-community/svelte-native/dom';
    import CActionBar from '@shared/components/CActionBar.svelte';
    import { formatTime, lc } from '~/helpers/locale';
    import { onThemeChanged } from '~/helpers/theme';
    import { onNetworkChanged } from '~/services/NetworkService';
    import DirectionHeader from '~/features/trains/DirectionHeader.svelte';
    import LineChip from '~/features/trains/LineChip.svelte';
    import TransitousAttribution from '~/features/trains/TransitousAttribution.svelte';
    import { showStopLines } from '~/features/trains/stop';
    import { modeIcon } from '~/features/trains/TransitousService';
    import { type StopLine, TIMESHEET_TRIPS, type TimesheetPage, type TimesheetStop, getLineTimesheet } from '~/features/trains/lines';
    import { NoNetworkError } from '@akylas/nativescript-app-utils/error';
    import { showError } from '@shared/utils/showError';
    import { navigate } from '@shared/utils/svelte/ui';
    import { showSnack } from '~/utils/ui';
    import { pickDate, pickTime } from '~/utils/utils';
    import { colors, fonts, windowInset } from '~/variables';
    import IconButton from '~/components/common/IconButton.svelte';
    import Pill from '~/components/common/Pill.svelte';

    const timePaint = new Paint();
    timePaint.textSize = 12;
</script>

<script lang="ts">
    $: ({ colorError, colorOnBackground, colorOnSurfaceVariant, colorOutlineVariant, colorPrimary } = $colors);

    export let line: StopLine;
    /** the direction to show, an index of `line.directions` */
    export let directionIndex = 0;
    let loading = false;
    let page: NativeViewElementNode<Page>;
    let collectionView: NativeViewElementNode<CollectionView>;
    let noNetworkAndNoData = false;
    let timelineItems: TimesheetStop[] = null;
    let timesheet: TimesheetPage = null;
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
    function otherModeIcons(stop: TimesheetStop) {
        return [...new Set(stop.modes.filter((mode) => mode !== line.mode).map(modeIcon))].slice(0, 3);
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
        const cell = item.times[index];
        return cell ? formatTime(dayjs(cell.time)) : '|';
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
            const w5 = w / (TIMESHEET_TRIPS + 1);
            for (let index = 0; index < TIMESHEET_TRIPS; index++) {
                timePaint.color = item.times[index]?.delay > 0 ? colorError : isCurrentStop(item) ? colorPrimary : colorOnBackground;
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
    <gridlayout paddingLeft={$windowInset.left} paddingRight={$windowInset.right} rows="auto,auto,auto,*,auto">
        <CActionBar>
            <LineChip
                name={line.shortName || line.longName}
                slot="center"
                col={0}
                colSpan={3}
                color={line.color}
                fontSize={20}
                height={38}
                horizontalAlignment="center"
                mode={line.mode}
                textColor={line.textColor} />
            <IconButton text="mdi-map-marker-path" on:tap={showDetails} />
        </CActionBar>
        <DirectionHeader
            from={timelineItems?.[0]?.name ?? line.directions[directionIndex].headsign}
            row={1}
            swappable={line.directions.length > 1}
            to={timelineItems?.[timelineItems.length - 1]?.name}
            on:tap={reverseTimesheet} />
        <gridlayout columns="auto,auto,*,auto,auto" padding="4 12 8 12" row={2} visibility={noNetworkAndNoData ? 'hidden' : 'visible'} on:swipe={onSwipe}>
            <Pill icon="mdi-calendar-today" label={currentTime.format('L')} on:tap={() => selectDate()} />
            <Pill col={1} icon="mdi-clock-outline" label={formatTime(currentTime)} marginLeft={8} on:tap={() => selectTime()} />
            <IconButton col={3} text="mdi-chevron-left" on:tap={previousDates} />
            <IconButton col={4} text="mdi-chevron-right" on:tap={nextDates} />
        </gridlayout>

        <collectionview bind:this={collectionView} items={timelineItems} row={3} rowHeight={56} on:swipe={onSwipe}>
            <Template let:item>
                <gridlayout
                    backgroundColor={isCurrentStop(item) ? new Color(colorPrimary).setAlpha(24).hex : null}
                    borderBottomColor={colorOutlineVariant}
                    borderBottomWidth={1}
                    columns="*,200"
                    padding="0 10 0 16"
                    rippleColor={colorPrimary}
                    on:tap={() => showStopLines(item.name, { lat: item.lat, lon: item.lon })}>
                    <stacklayout padding="4 10 4 0" verticalAlignment="middle">
                        <label
                            color={isCurrentStop(item) ? colorPrimary : colorOnBackground}
                            fontSize={14}
                            fontWeight={isCurrentStop(item) ? 'bold' : 'normal'}
                            lineBreak="end"
                            maxLines={2}
                            text={item.name} />
                        <stacklayout orientation="horizontal" visibility={otherModeIcons(item).length ? 'visible' : 'collapse'}>
                            {#each otherModeIcons(item) as icon}
                                <label color={colorOnSurfaceVariant} fontFamily={$fonts.mdi} fontSize={13} marginRight={4} text={icon} />
                            {/each}
                        </stacklayout>
                    </stacklayout>
                    <canvasview id="canvas" col={1} on:draw={(e) => drawTripTime(item, e)} />
                </gridlayout>
            </Template>
        </collectionview>
        <activityindicator busy={true} horizontalAlignment="center" row={3} verticalAlignment="middle" visibility={loading ? 'visible' : 'hidden'} />
        {#if noNetworkAndNoData}
            <canvaslabel row={3}>
                <cgroup textAlignment="center" verticalAlignment="middle">
                    <cspan fontFamily={$fonts.mdi} fontSize={50} text="mdi-alert-circle-outline" />
                    <cspan fontSize={20} text={'\n' + lc('no_network')} />
                </cgroup>
            </canvaslabel>
        {/if}
        <TransitousAttribution row={4} />
    </gridlayout>
</page>
