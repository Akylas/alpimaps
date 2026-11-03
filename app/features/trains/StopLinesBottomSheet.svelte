<script lang="ts">
    import { NoNetworkError } from '@akylas/nativescript-app-utils/error';
    import { closeBottomSheet } from '@nativescript-community/ui-bottomsheet/svelte';
    import { Template } from '@nativescript-community/svelte-native/components';
    import { showError } from '@shared/utils/showError';
    import { navigate } from '@shared/utils/svelte/ui';
    import dayjs from 'dayjs';
    import { onDestroy, onMount } from 'svelte';
    import IconButton from '~/components/common/IconButton.svelte';
    import PanelHeader from '~/components/common/PanelHeader.svelte';
    import LineChip from '~/features/trains/LineChip.svelte';
    import TransitousAttribution from '~/features/trains/TransitousAttribution.svelte';
    import { type LineDeparture, type LineDirection, type StopLine, getStopLines } from '~/features/trains/lines';
    import { lc } from '~/helpers/locale';
    import { onNetworkChanged } from '~/services/NetworkService';
    import type { MapPos } from '~/utils/geo';
    import { colors, fonts } from '~/variables';

    export let position: MapPos;
    export let name: string;

    // a board that is minutes old is wrong: keep it live while the sheet is open
    const REFRESH_INTERVAL = 60 * 1000;
    // the departures leaving within this many minutes read as a countdown
    const COUNTDOWN_LIMIT = 60;

    interface Row {
        line: StopLine;
        direction: LineDirection;
        directionIndex: number;
    }

    let { colorError, colorOnSurface, colorOnSurfaceVariant, colorOutlineVariant, colorPrimary } = $colors;
    $: ({ colorError, colorOnSurface, colorOnSurfaceVariant, colorOutlineVariant, colorPrimary } = $colors);

    let loading = false;
    let rows: Row[] = null;
    let noNetworkAndNoData = false;
    let refreshTimer: ReturnType<typeof setInterval>;

    // `fresh`: the refresh button asks again, the timer takes what was fetched less than a minute ago
    async function refresh(fresh = false) {
        try {
            loading = true;
            const lines = await getStopLines(position, { fresh });
            rows = lines.flatMap((line) => line.directions.map((direction, directionIndex) => ({ line, direction, directionIndex })));
            noNetworkAndNoData = false;
        } catch (error) {
            if (error instanceof NoNetworkError && !rows) {
                noNetworkAndNoData = true;
            }
            showError(error);
        } finally {
            loading = false;
        }
    }
    onNetworkChanged((connected) => {
        if (connected && noNetworkAndNoData) {
            refresh();
        }
    });
    onMount(() => {
        refresh();
        refreshTimer = setInterval(() => refresh(), REFRESH_INTERVAL);
    });
    onDestroy(() => clearInterval(refreshTimer));

    async function showTimesheet({ directionIndex, line }: Row) {
        try {
            closeBottomSheet();
            const component = (await import('~/features/trains/LineTimesheet.svelte')).default;
            navigate({ page: component, props: { line, directionIndex } });
        } catch (error) {
            showError(error);
        }
    }
    async function showDetails({ directionIndex, line }: Row) {
        try {
            closeBottomSheet();
            const component = (await import('~/features/trains/LineDetails.svelte')).default;
            navigate({ page: component, props: { line, directionIndex, position } });
        } catch (error) {
            showError(error);
        }
    }

    function minutesUntil(departure: LineDeparture) {
        return Math.round((departure.time.getTime() - Date.now()) / 60000);
    }
    function delayMinutes(departure: LineDeparture) {
        return Math.round((departure.time.getTime() - departure.scheduled.getTime()) / 60000);
    }
    function clock(departure: LineDeparture) {
        return dayjs(departure.time).format('HH:mm');
    }
    // how long to wait, as words
    function waitLabel(departure: LineDeparture) {
        const minutes = minutesUntil(departure);
        return minutes <= 0 ? lc('now') : minutes < COUNTDOWN_LIMIT ? lc('in_minutes', minutes) : '';
    }
    function laterTimes(direction: LineDirection) {
        return direction.departures.length > 1 ? lc('departures_then', direction.departures.slice(1).map(clock).join(' · ')) : '';
    }
    $: anyRealTime = !!rows?.some((row) => row.direction.departures.some((departure) => departure.realTime));
</script>

<gesturerootview class="bottomsheet" rows="auto,*,auto">
    <PanelHeader icon="mdi-bus" title={name}>
        <IconButton text="mdi-refresh" on:tap={() => refresh(true)} />
    </PanelHeader>
    <collectionview id="scrollView" itemIdGenerator={(item, index) => index} items={rows} row={1} rowHeight={72}>
        <Template let:item>
            <gridlayout borderBottomColor={colorOutlineVariant} borderBottomWidth={1} columns="72,*,auto,auto" padding="0 8 0 16" rippleColor={colorPrimary} on:tap={() => showTimesheet(item)}>
                <LineChip name={item.line.shortName || item.line.longName} color={item.line.color} mode={item.line.mode} textColor={item.line.textColor} />
                <stacklayout col={1} paddingLeft={8} verticalAlignment="middle">
                    <label color={colorOnSurface} fontSize={15} lineBreak="end" maxLines={1} text={item.direction.headsign} />
                    <label
                        color={colorOnSurfaceVariant}
                        fontSize={12}
                        lineBreak="end"
                        maxLines={1}
                        text={laterTimes(item.direction)}
                        visibility={item.direction.departures.length > 1 ? 'visible' : 'collapse'} />
                </stacklayout>
                <stacklayout col={2} horizontalAlignment="right" paddingRight={4} verticalAlignment="middle">
                    <label color={colorOnSurface} fontSize={17} fontWeight="bold" horizontalAlignment="right" text={clock(item.direction.departures[0])} />
                    <stacklayout horizontalAlignment="right" orientation="horizontal">
                        <label
                            color={colorPrimary}
                            fontFamily={$fonts.mdi}
                            fontSize={13}
                            text="mdi-access-point"
                            verticalAlignment="middle"
                            visibility={item.direction.departures[0].realTime ? 'visible' : 'collapse'} />
                        <label color={colorOnSurfaceVariant} fontSize={12} text={waitLabel(item.direction.departures[0])} verticalAlignment="middle" />
                        <label
                            color={colorError}
                            fontSize={12}
                            paddingLeft={4}
                            text={`+${delayMinutes(item.direction.departures[0])}`}
                            verticalAlignment="middle"
                            visibility={delayMinutes(item.direction.departures[0]) > 0 ? 'visible' : 'collapse'} />
                    </stacklayout>
                </stacklayout>
                <IconButton col={3} text="mdi-map-marker-path" on:tap={() => showDetails(item)} />
            </gridlayout>
        </Template>
    </collectionview>
    {#if noNetworkAndNoData}
        <canvaslabel row={1}>
            <cgroup textAlignment="center" verticalAlignment="middle">
                <cspan fontFamily={$fonts.mdi} fontSize={50} text="mdi-alert-circle-outline" />
                <cspan fontSize={20} text={'\n' + lc('no_network')} />
            </cgroup>
        </canvaslabel>
    {:else if rows && !rows.length}
        <label color={colorOnSurfaceVariant} fontSize={16} horizontalAlignment="center" row={1} text={lc('no_departures_found')} verticalAlignment="middle" />
    {/if}
    <TransitousAttribution note={rows?.length && !anyRealTime ? lc('scheduled_times_only') : null} row={2} />
    <activityindicator busy={true} horizontalAlignment="right" row={1} verticalAlignment="middle" visibility={loading && !rows ? 'visible' : 'hidden'} />
</gesturerootview>
