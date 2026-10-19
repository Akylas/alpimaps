<script lang="ts">
    import { NoNetworkError } from '@akylas/nativescript-app-utils/error';
    import { Template } from '@nativescript-community/svelte-native/components';
    import { Color } from '@nativescript/core';
    import { showError } from '@shared/utils/showError';
    import dayjs from 'dayjs';
    import { onDestroy, onMount } from 'svelte';
    import { lc } from '~/helpers/locale';
    import { showRailTrip } from '~/mapModules/itemActions';
    import { onNetworkChanged } from '~/services/NetworkService';
    import { type TransitousStop, type TransitousStopTime, transitousService } from '~/services/TransitousService';
    import type { MapPos } from '~/utils/geo';
    import { openURL } from '~/utils/ui/index.common';
    import { colors, fonts, windowInset } from '~/variables';
    import IconButton from '../common/IconButton.svelte';
    import PanelHeader from '../common/PanelHeader.svelte';
    import Pill from '../common/Pill.svelte';

    export let position: MapPos;
    export let name: string;

    // a board that is minutes old is wrong: keep it live while the sheet is open
    const REFRESH_INTERVAL = 60 * 1000;

    $: ({ bottom: windowInsetBottom } = $windowInset);
    let { colorError, colorOnSurface, colorOnSurfaceVariant, colorOutlineVariant, colorPrimary } = $colors;
    $: ({ colorError, colorOnSurface, colorOnSurfaceVariant, colorOutlineVariant, colorPrimary } = $colors);

    let arrivals = false;
    let loading = false;
    let stops: TransitousStop[] = null;
    let times: TransitousStopTime[] = null;
    let noNetworkAndNoData = false;
    let refreshTimer: ReturnType<typeof setInterval>;

    async function refresh() {
        try {
            loading = true;
            stops ??= await transitousService.findRailStops(position);
            times = stops.length ? await transitousService.getStationTimes(stops, { arrivals }) : [];
            noNetworkAndNoData = false;
        } catch (error) {
            if (error instanceof NoNetworkError && !times) {
                noNetworkAndNoData = true;
            }
            showError(error);
        } finally {
            loading = false;
        }
    }
    function selectBoard(showArrivals: boolean) {
        if (arrivals !== showArrivals) {
            arrivals = showArrivals;
            times = null;
            refresh();
        }
    }
    onNetworkChanged((connected) => {
        if (connected && noNetworkAndNoData) {
            refresh();
        }
    });
    onMount(() => {
        refresh();
        refreshTimer = setInterval(refresh, REFRESH_INTERVAL);
    });
    onDestroy(() => clearInterval(refreshTimer));

    function actualTime(stopTime: TransitousStopTime) {
        return arrivals ? (stopTime.place.arrival ?? stopTime.place.departure) : (stopTime.place.departure ?? stopTime.place.arrival);
    }
    function scheduledTime(stopTime: TransitousStopTime) {
        return arrivals ? (stopTime.place.scheduledArrival ?? stopTime.place.scheduledDeparture) : (stopTime.place.scheduledDeparture ?? stopTime.place.scheduledArrival);
    }
    function delayMinutes(stopTime: TransitousStopTime) {
        return Math.round((Date.parse(actualTime(stopTime)) - Date.parse(scheduledTime(stopTime))) / 60000);
    }
    function trainName(stopTime: TransitousStopTime) {
        return stopTime.routeShortName || stopTime.displayName || stopTime.mode;
    }
    function otherEnd(stopTime: TransitousStopTime) {
        return (arrivals ? stopTime.tripFrom?.name : stopTime.headsign || stopTime.tripTo?.name) || '';
    }
    function trainColor(stopTime: TransitousStopTime) {
        return stopTime.routeColor ? `#${stopTime.routeColor}` : new Color(colorPrimary).setAlpha(36).hex;
    }
    function trainTextColor(stopTime: TransitousStopTime) {
        return stopTime.routeTextColor ? `#${stopTime.routeTextColor}` : colorOnSurface;
    }
    $: anyRealTime = !!times?.some((stopTime) => stopTime.realTime);
</script>

<gesturerootview class="bottomsheet" rows="auto,auto,*,auto">
    <PanelHeader icon="mdi-train" title={name}>
        <IconButton text="mdi-refresh" on:tap={refresh} />
    </PanelHeader>
    <stacklayout marginBottom={6} orientation="horizontal" paddingLeft={16} row={1}>
        <Pill icon="mdi-arrow-top-right" label={lc('departures')} selected={!arrivals} on:tap={() => selectBoard(false)} />
        <Pill icon="mdi-arrow-bottom-left" label={lc('arrivals')} marginLeft={8} selected={arrivals} on:tap={() => selectBoard(true)} />
    </stacklayout>
    <collectionview id="scrollView" itemIdGenerator={(item, index) => index} items={times} row={2} rowHeight={64}>
        <Template let:item>
            <gridlayout borderBottomColor={colorOutlineVariant} borderBottomWidth={1} columns="56,auto,*,auto" padding="0 16" rippleColor={colorPrimary} on:tap={() => showRailTrip(item)}>
                <stacklayout verticalAlignment="middle">
                    <label
                        color={item.cancelled ? colorError : colorOnSurface}
                        fontSize={17}
                        fontWeight="bold"
                        text={dayjs(actualTime(item)).format('HH:mm')}
                        textDecoration={item.cancelled ? 'line-through' : 'none'} />
                    <label color={colorError} fontSize={12} text={delayMinutes(item) > 0 ? `+${delayMinutes(item)} min` : null} visibility={delayMinutes(item) > 0 ? 'visible' : 'collapse'} />
                </stacklayout>
                <label
                    backgroundColor={trainColor(item)}
                    borderRadius={4}
                    col={1}
                    color={trainTextColor(item)}
                    fontSize={13}
                    fontWeight="bold"
                    maxLines={1}
                    padding="2 6"
                    text={trainName(item)}
                    verticalAlignment="middle" />
                <stacklayout col={2} paddingLeft={10} verticalAlignment="middle">
                    <label color={colorOnSurface} fontSize={15} lineBreak="end" maxLines={1} text={otherEnd(item)} />
                    <label color={colorOnSurfaceVariant} fontSize={12} lineBreak="end" maxLines={1} text={item.cancelled ? lc('cancelled') : item.agencyName} />
                </stacklayout>
                <stacklayout col={3} horizontalAlignment="right" verticalAlignment="middle">
                    <label color={colorOnSurface} fontSize={15} fontWeight="bold" horizontalAlignment="right" text={item.place.track} visibility={item.place.track ? 'visible' : 'collapse'} />
                    <label
                        color={item.realTime ? colorPrimary : colorOnSurfaceVariant}
                        fontFamily={$fonts.mdi}
                        fontSize={14}
                        horizontalAlignment="right"
                        text={item.realTime ? 'mdi-access-point' : 'mdi-clock-outline'} />
                </stacklayout>
            </gridlayout>
        </Template>
    </collectionview>
    {#if noNetworkAndNoData}
        <canvaslabel row={2}>
            <cgroup textAlignment="center" verticalAlignment="middle">
                <cspan fontFamily={$fonts.mdi} fontSize={50} text="mdi-alert-circle-outline" />
                <cspan fontSize={20} text={'\n' + lc('no_network')} />
            </cgroup>
        </canvaslabel>
    {:else if times && !times.length}
        <label color={colorOnSurfaceVariant} fontSize={16} horizontalAlignment="center" row={2} text={lc('no_trains_found')} verticalAlignment="middle" />
    {/if}
    <label
        color={colorOnSurfaceVariant}
        fontSize={11}
        marginBottom={windowInsetBottom}
        padding="4 16"
        row={3}
        text={(times?.length && !anyRealTime ? lc('scheduled_times_only') + ' · ' : '') + lc('transitous_attribution')}
        on:tap={() => openURL('https://transitous.org')} />
    <activityindicator busy={true} horizontalAlignment="right" row={2} verticalAlignment="middle" visibility={loading && !times ? 'visible' : 'hidden'} />
</gesturerootview>
