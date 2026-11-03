<script lang="ts">
    import { NoNetworkError } from '@akylas/nativescript-app-utils/error';
    import { Template } from '@nativescript-community/svelte-native/components';
    import { showError } from '@shared/utils/showError';
    import dayjs from 'dayjs';
    import { onDestroy, onMount } from 'svelte';
    import { lc } from '~/helpers/locale';
    import { showRailTrip } from '~/features/trains/rail';
    import { onNetworkChanged } from '~/services/NetworkService';
    import { type TransitousStop, type TransitousStopTime, splitTrainName, transitousService } from '~/features/trains/TransitousService';
    import { trainFollowService, trainFollowSupported } from '~/features/trains/TrainFollowService';
    import type { MapPos } from '~/utils/geo';
    import { followIdOf } from '~/features/trains/trainFollow';
    import { showSnack } from '~/utils/ui';
    import { colors, fonts } from '~/variables';
    import IconButton from '~/components/common/IconButton.svelte';
    import PanelHeader from '~/components/common/PanelHeader.svelte';
    import Pill from '~/components/common/Pill.svelte';
    import LineChip from '~/features/trains/LineChip.svelte';
    import TransitousAttribution from '~/features/trains/TransitousAttribution.svelte';

    export let position: MapPos;
    export let name: string;

    // a board that is minutes old is wrong: keep it live while the sheet is open
    const REFRESH_INTERVAL = 60 * 1000;

    let { colorError, colorOnSurface, colorOnSurfaceVariant, colorOutlineVariant, colorPrimary } = $colors;
    $: ({ colorError, colorOnSurface, colorOnSurfaceVariant, colorOutlineVariant, colorPrimary } = $colors);

    let arrivals = false;
    let loading = false;
    let stops: TransitousStop[] = null;
    let times: TransitousStopTime[] = null;
    let noNetworkAndNoData = false;
    let refreshTimer: ReturnType<typeof setInterval>;
    const { followedIds } = trainFollowService;
    // the widget follows an arrival, so departures have nothing to follow
    $: showBell = arrivals && trainFollowSupported;

    // `fresh`: the refresh button asks again, the timer takes what was fetched less than 30 seconds ago
    async function refresh(fresh = false) {
        try {
            loading = true;
            stops ??= await transitousService.findRailStops(position);
            times = stops.length ? await transitousService.getStationTimes(stops, { arrivals, fresh }) : [];
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
    async function toggleFollow(stopTime: TransitousStopTime) {
        try {
            if ($followedIds.includes(followIdOf(stopTime))) {
                trainFollowService.unfollow(followIdOf(stopTime));
            } else if ((await trainFollowService.followArrival(stopTime, name)) === 'full') {
                showSnack({ message: lc('train_follow_limit') });
            }
        } catch (error) {
            showError(error);
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
        refreshTimer = setInterval(() => refresh(), REFRESH_INTERVAL);
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
    // the chip says what kind of train it is, the number goes with the operator under the destination
    // a coach's line (K21) is its short name, a train's "TER 96601" is a product and a number
    function trainParts(stopTime: TransitousStopTime) {
        const { number, product } = splitTrainName(stopTime.displayName || stopTime.routeShortName);
        return { product: stopTime.routeShortName || product || stopTime.mode, number: stopTime.tripShortName || number };
    }
    function otherEnd(stopTime: TransitousStopTime) {
        return (arrivals ? stopTime.tripFrom?.name : stopTime.headsign || stopTime.tripTo?.name) || '';
    }
    $: anyRealTime = !!times?.some((stopTime) => stopTime.realTime);
</script>

<gesturerootview class="bottomsheet" rows="auto,auto,*,auto">
    <PanelHeader icon="mdi-train" title={name}>
        <IconButton text="mdi-refresh" on:tap={() => refresh(true)} />
    </PanelHeader>
    <stacklayout marginBottom={6} orientation="horizontal" paddingLeft={16} row={1}>
        <Pill icon="mdi-arrow-top-right" label={lc('departures')} selected={!arrivals} on:tap={() => selectBoard(false)} />
        <Pill icon="mdi-arrow-bottom-left" label={lc('arrivals')} marginLeft={8} selected={arrivals} on:tap={() => selectBoard(true)} />
    </stacklayout>
    <collectionview id="scrollView" itemIdGenerator={(item, index) => index} items={times} row={2} rowHeight={78}>
        <Template let:item>
            <gridlayout
                borderBottomColor={colorOutlineVariant}
                borderBottomWidth={1}
                columns={showBell ? '104,*,auto,auto' : '104,*,auto'}
                padding="0 16"
                rippleColor={colorPrimary}
                on:tap={() => showRailTrip(item)}>
                <stacklayout verticalAlignment="middle">
                    <stacklayout orientation="horizontal">
                        <label
                            color={item.cancelled ? colorError : colorOnSurface}
                            fontSize={17}
                            fontWeight="bold"
                            text={dayjs(actualTime(item)).format('HH:mm')}
                            textDecoration={item.cancelled ? 'line-through' : 'none'} />
                        <label
                            color={colorError}
                            fontSize={12}
                            paddingLeft={6}
                            text={delayMinutes(item) > 0 ? `+${delayMinutes(item)}` : null}
                            verticalAlignment="middle"
                            visibility={delayMinutes(item) > 0 ? 'visible' : 'collapse'} />
                    </stacklayout>
                    <LineChip
                        name={trainParts(item).product}
                        color={item.routeColor ? `#${item.routeColor}` : null}
                        fontSize={12}
                        height={22}
                        marginTop={4}
                        textColor={item.routeTextColor ? `#${item.routeTextColor}` : null} />
                </stacklayout>
                <canvaslabel col={1} paddingLeft={10}>
                    <cgroup lineBreak="end" verticalAlignment="middle">
                        <cspan color={colorOnSurface} fontSize={17} text={otherEnd(item)} />
                        <cspan color={item.cancelled ? colorError : colorOnSurface} fontSize={14} text={'\n' + (item.cancelled ? lc('cancelled') : (trainParts(item).number ?? ''))} />
                        <cspan color={colorOnSurfaceVariant} fontSize={11} text={(item.cancelled || trainParts(item).number ? ' ' : '') + (item.agencyName ?? '')} />
                    </cgroup>
                </canvaslabel>
                <stacklayout col={2} horizontalAlignment="right" verticalAlignment="middle">
                    <label color={colorOnSurface} fontSize={15} fontWeight="bold" horizontalAlignment="right" text={item.place.track} visibility={item.place.track ? 'visible' : 'collapse'} />
                    <label
                        color={item.realTime ? colorPrimary : colorOnSurfaceVariant}
                        fontFamily={$fonts.mdi}
                        fontSize={14}
                        horizontalAlignment="right"
                        text={item.realTime ? 'mdi-access-point' : 'mdi-clock-outline'} />
                </stacklayout>
                {#if showBell}
                    <IconButton col={3} text={$followedIds.includes(followIdOf(item)) ? 'mdi-bell-ring' : 'mdi-bell-plus-outline'} on:tap={() => toggleFollow(item)} />
                {/if}
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
    <TransitousAttribution note={times?.length && !anyRealTime ? lc('scheduled_times_only') : null} row={3} />
    <activityindicator busy={true} horizontalAlignment="right" row={2} verticalAlignment="middle" visibility={loading && !times ? 'visible' : 'hidden'} />
</gesturerootview>
