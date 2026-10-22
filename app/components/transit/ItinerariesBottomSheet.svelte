<script lang="ts">
    import { NoNetworkError } from '@akylas/nativescript-app-utils/error';
    import { Template } from '@nativescript-community/svelte-native/components';
    import { Color } from '@nativescript/core';
    import { showError } from '@shared/utils/showError';
    import dayjs from 'dayjs';
    import { onMount } from 'svelte';
    import { formatDistance, formatDuration } from '~/helpers/formatter';
    import { lc } from '~/helpers/locale';
    import { focusItinerary, rememberItinerarySession, showItineraryOnMap } from '~/mapModules/features/itinerary';
    import { onNetworkChanged } from '~/services/NetworkService';
    import { trainFollowService, trainFollowSupported } from '~/services/TrainFollowService';
    import { type TransitousItinerary, type TransitousLeg, type TransitousPlace, isRailMode, itineraryTicketUrl, modeIcon, transitousService } from '~/services/TransitousService';
    import { transitHistory } from '~/stores/historyStore';
    import type { MapPos } from '~/utils/geo';
    import { itineraryFollowId } from '~/utils/trainFollow';
    import { showSnack } from '~/utils/ui';
    import { openURL, showPopoverMenu } from '~/utils/ui/index.common';
    import { colors, fonts, windowInset } from '~/variables';
    import IconButton from '../common/IconButton.svelte';
    import PanelHeader from '../common/PanelHeader.svelte';
    import Pill from '../common/Pill.svelte';

    export let from: { name: string; position: MapPos };
    export let to: { name: string; position: MapPos };
    /** null: now */
    export let time: Date = null;
    export let arriveBy = false;
    /** set when coming back from the map: nothing to fetch again */
    export let initialItineraries: TransitousItinerary[] = null;
    export let initialSelected: TransitousItinerary = null;

    // x of the vertical line, after the times column
    const LINE_X = 84;
    const WALK_COLOR = '#808080';
    // every chip the same height, whatever its glyph or text
    const CHIP_HEIGHT = 24;
    // a connection shorter than this is risky
    const SHORT_CONNECTION = 5 * 60;
    // `intervals… phase`; a dash that never stops is a plain line, there is no way to unset it
    const DASHED = '8 8 0';
    const SOLID = '1000 0 0';

    $: ({ bottom: windowInsetBottom } = $windowInset);
    let { colorBackground, colorError, colorOnSurface, colorOnSurfaceVariant, colorOutlineVariant, colorPrimary } = $colors;
    $: ({ colorBackground, colorError, colorOnSurface, colorOnSurfaceVariant, colorOutlineVariant, colorPrimary } = $colors);

    let loading = false;
    let itineraries: TransitousItinerary[] = initialItineraries;
    let selected: TransitousItinerary = initialSelected;
    let noNetworkAndNoData = false;
    /** the legs whose intermediate stops are listed, by index */
    let expandedLegs: Record<number, boolean> = {};
    const { followedIds } = trainFollowService;

    // the trains of a trip can be followed on the home screen and in notifications; walking only has none
    function canFollow(itinerary: TransitousItinerary) {
        return trainFollowSupported && !!itineraryFollowId(itinerary);
    }
    function isFollowed(itinerary: TransitousItinerary, followed: string[]) {
        return followed.includes(itineraryFollowId(itinerary));
    }
    async function toggleFollow(itinerary: TransitousItinerary) {
        try {
            if (isFollowed(itinerary, $followedIds)) {
                trainFollowService.unfollow(itineraryFollowId(itinerary));
            } else if ((await trainFollowService.followItinerary(itinerary, `${from.name} → ${to.name}`)) === 'full') {
                showSnack({ message: lc('train_follow_limit') });
            }
        } catch (error) {
            showError(error);
        }
    }

    async function refresh() {
        try {
            loading = true;
            itineraries = (await transitousService.plan({ from: from.position, to: to.position, time: time ?? undefined, arriveBy })).itineraries;
            selected = null;
            remember();
            if (itineraries.length > 0) {
                transitHistory.add({ from: { name: from.name, position: from.position }, to: { name: to.name, position: to.position }, time: time?.toISOString() ?? null, arriveBy });
            }
            noNetworkAndNoData = false;
        } catch (error) {
            if (error instanceof NoNetworkError && !itineraries) {
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
        if (itineraries) {
            remember();
        } else {
            refresh();
        }
    });
    function remember() {
        rememberItinerarySession({ from, to, time, arriveBy, itineraries, selected });
    }

    function select(itinerary: TransitousItinerary) {
        selected = itinerary;
        expandedLegs = {};
        remember();
        showItineraryOnMap(itinerary, { title: `${from.name} → ${to.name}`, subtitle: formatDuration(itinerary.duration) });
    }
    function toggleLeg(index: number) {
        expandedLegs = { ...expandedLegs, [index]: !expandedLegs[index] };
    }
    async function showItineraryMenu(itinerary: TransitousItinerary, event) {
        try {
            const url = itineraryTicketUrl(itinerary);
            const options = [
                { id: 'open', name: lc('open'), icon: 'mdi-timeline-text-outline' },
                { id: 'map', name: lc('show_on_map'), icon: 'mdi-map-marker-path' },
                ...(url ? [{ id: 'ticket', name: lc('get_tickets'), subtitle: url, icon: 'mdi-ticket-outline' }] : []),
                ...(canFollow(itinerary)
                    ? [
                          isFollowed(itinerary, $followedIds)
                              ? { id: 'follow', name: lc('train_unfollow'), icon: 'mdi-bell-off-outline' }
                              : { id: 'follow', name: lc('train_follow'), icon: 'mdi-bell-plus-outline' }
                      ]
                    : [])
            ];
            await showPopoverMenu({
                options,
                anchor: event.object,
                props: { autoSizeListItem: true },
                onClose: (option) => {
                    switch (option?.id) {
                        case 'open':
                            select(itinerary);
                            break;
                        case 'map':
                            focusItinerary(itinerary, `${from.name} → ${to.name}`, formatDuration(itinerary.duration));
                            break;
                        case 'ticket':
                            openTicket(itinerary);
                            break;
                        case 'follow':
                            toggleFollow(itinerary);
                            break;
                    }
                }
            });
        } catch (error) {
            showError(error);
        }
    }
    function openTicket(itinerary: TransitousItinerary) {
        const url = itineraryTicketUrl(itinerary);
        if (url) {
            openURL(url);
        }
    }
    function formatTime(iso: string) {
        return dayjs(iso).format('HH:mm');
    }

    // a point of the journey: where one leg ends and the next starts
    interface Stop {
        name: string;
        arrival?: string;
        departure?: string;
        before?: TransitousLeg;
        after?: TransitousLeg;
        afterIndex?: number;
    }
    function buildStops(itinerary: TransitousItinerary): Stop[] {
        const result: Stop[] = [];
        itinerary.legs.forEach((leg, index) => {
            if (index === 0) {
                result.push({ name: from.name, departure: leg.startTime, after: leg, afterIndex: index });
            } else {
                const previous = result[result.length - 1];
                previous.departure = leg.startTime;
                previous.after = leg;
                previous.afterIndex = index;
            }
            result.push({ name: index === itinerary.legs.length - 1 ? to.name : leg.to.name, arrival: leg.endTime, before: leg });
        });
        return result;
    }
    $: stops = selected ? buildStops(selected) : [];

    function isWalk(leg: TransitousLeg) {
        return leg.mode === 'WALK' || leg.mode === 'BIKE' || leg.mode === 'CAR';
    }
    // only the transports: walking is in the details
    function summaryLegs(itinerary: TransitousItinerary) {
        return itinerary.legs.filter((leg) => !isWalk(leg));
    }
    // the product, not the trip: "TER", not "TER 857773", "FlixBus", not "FlixBus N1709"
    function legName(leg: TransitousLeg) {
        if (isWalk(leg)) {
            return '';
        }
        const product = leg.mode === 'COACH' || isRailMode(leg.mode) ? leg.displayName?.replace(/\s+[A-Za-z]{0,2}\d+$/, '') : null;
        return product || leg.routeShortName || leg.displayName || leg.agencyName || '';
    }
    function legColor(leg: TransitousLeg) {
        return isWalk(leg) ? WALK_COLOR : leg.routeColor ? `#${leg.routeColor}` : colorPrimary;
    }
    function legChipColor(leg: TransitousLeg) {
        return isWalk(leg) ? null : leg.routeColor ? `#${leg.routeColor}` : new Color(colorPrimary).setAlpha(36).hex;
    }
    function legTextColor(leg: TransitousLeg) {
        return isWalk(leg) ? colorOnSurfaceVariant : leg.routeTextColor ? `#${leg.routeTextColor}` : colorOnSurface;
    }
    function legTitle(leg: TransitousLeg) {
        return isWalk(leg) ? lc('walk') : [leg.displayName || leg.routeShortName, leg.headsign].filter(Boolean).join(' → ');
    }
    // walking is not timed: what matters is the time left to make the connection (see layover)
    function legDetails(leg: TransitousLeg) {
        return isWalk(leg) ? (leg.distance ? formatDistance(leg.distance) : '') : [formatDuration(leg.duration), leg.agencyName].filter(Boolean).join(' · ');
    }
    function seconds(from: string, to: string) {
        return (Date.parse(to) - Date.parse(from)) / 1000;
    }
    // the time between getting off one transport and the next one leaving, walking included
    function layover(stop: Stop) {
        if (stop.before && stop.after && !isWalk(stop.before) && !isWalk(stop.after)) {
            return seconds(stop.before.endTime, stop.after.startTime);
        }
        if (stop.after && isWalk(stop.after)) {
            const legs = selected.legs;
            const previous = legs[stop.afterIndex - 1];
            const next = legs[stop.afterIndex + 1];
            if (previous && next && !isWalk(previous) && !isWalk(next)) {
                return seconds(previous.endTime, next.startTime);
            }
        }
        return null;
    }
    function layoverColor(duration: number) {
        return duration < SHORT_CONNECTION ? colorError : colorOnSurfaceVariant;
    }
    function stopTime(place: TransitousPlace) {
        return formatTime(place.departure ?? place.arrival);
    }
    function showLegOnMap(leg: TransitousLeg) {
        focusItinerary({ ...selected, legs: [leg] }, legTitle(leg), legDetails(leg));
    }
    function showSelectedOnMap() {
        focusItinerary(selected, `${from.name} → ${to.name}`, formatDuration(selected.duration));
    }
    function departureShown(stop: Stop) {
        return !!stop.departure && (!stop.arrival || formatTime(stop.departure) !== formatTime(stop.arrival));
    }
    $: selectedTicketUrl = selected ? itineraryTicketUrl(selected) : undefined;
</script>

<gesturerootview class="bottomsheet" rows="auto,*,auto">
    <PanelHeader icon="mdi-transit-connection-variant" subtitle={`${from.name} → ${to.name}`} title={lc('itineraries')}>
        <IconButton
            isVisible={!!selected}
            text="mdi-arrow-left"
            on:tap={() => {
                selected = null;
                remember();
            }} />
        <IconButton
            isVisible={!!selected && canFollow(selected)}
            text={selected && isFollowed(selected, $followedIds) ? 'mdi-bell-ring' : 'mdi-bell-plus-outline'}
            on:tap={() => toggleFollow(selected)} />
        <IconButton isVisible={!!selected} text="mdi-map-marker-path" on:tap={showSelectedOnMap} />
        <IconButton text="mdi-refresh" on:tap={refresh} />
    </PanelHeader>
    {#if selected}
        <scrollview id="scrollView" row={1}>
            <stacklayout>
                {#each stops as stop, stopIndex}
                    <!-- the place: times on the left, the line passes through a dot -->
                    <canvasview height={64}>
                        <line
                            dash={stop.before && isWalk(stop.before) ? DASHED : SOLID}
                            startX={LINE_X}
                            startY={0}
                            stopX={LINE_X}
                            stopY="50%"
                            strokeColor={stop.before ? legColor(stop.before) : 'transparent'}
                            strokeWidth={4} />
                        <line
                            dash={stop.after && isWalk(stop.after) ? DASHED : SOLID}
                            startX={LINE_X}
                            startY="50%"
                            stopX={LINE_X}
                            stopY="100%"
                            strokeColor={stop.after ? legColor(stop.after) : 'transparent'}
                            strokeWidth={4} />
                        <circle
                            antiAlias={true}
                            fillColor={stopIndex === 0 || stopIndex === stops.length - 1 ? legColor(stop.after ?? stop.before) : colorBackground}
                            horizontalAlignment="left"
                            paddingLeft={LINE_X}
                            radius={11}
                            strokeColor={legColor(stop.after ?? stop.before)}
                            strokeWidth={3}
                            verticalAlignment="middle"
                            width={0} />
                        <stacklayout horizontalAlignment="left" verticalAlignment="middle" width={LINE_X - 18}>
                            <label
                                color={colorOnSurface}
                                fontSize={15}
                                fontWeight="bold"
                                horizontalAlignment="right"
                                text={stop.arrival ? formatTime(stop.arrival) : null}
                                visibility={stop.arrival ? 'visible' : 'collapse'} />
                            <label
                                color={stop.arrival ? colorOnSurfaceVariant : colorOnSurface}
                                fontSize={stop.arrival ? 13 : 15}
                                fontWeight={stop.arrival ? 'normal' : 'bold'}
                                horizontalAlignment="right"
                                text={departureShown(stop) ? formatTime(stop.departure) : null}
                                visibility={departureShown(stop) ? 'visible' : 'collapse'} />
                            {#if stop.after && !isWalk(stop.after) && layover(stop) !== null}
                                <label color={layoverColor(layover(stop))} fontSize={12} fontWeight="bold" horizontalAlignment="right" text={formatDuration(layover(stop))} />
                            {/if}
                        </stacklayout>
                        <label
                            color={colorOnSurface}
                            fontSize={16}
                            fontWeight="bold"
                            lineBreak="end"
                            marginLeft={LINE_X + 24}
                            marginRight={16}
                            maxLines={2}
                            text={stop.name}
                            verticalTextAlignment="center" />
                    </canvasview>
                    {#if stop.after}
                        <!-- the leg: the line goes on, dashed when walking -->
                        <canvasview>
                            <line dash={isWalk(stop.after) ? DASHED : SOLID} startX={LINE_X} startY={0} stopX={LINE_X} stopY="100%" strokeColor={legColor(stop.after)} strokeWidth={4} />
                            {#if isWalk(stop.after) && layover(stop) !== null}
                                <!-- the time between the two transports, to see at a glance if it is short -->
                                <label
                                    color={layoverColor(layover(stop))}
                                    fontSize={13}
                                    fontWeight="bold"
                                    horizontalAlignment="left"
                                    text={formatDuration(layover(stop))}
                                    textAlignment="right"
                                    verticalAlignment="middle"
                                    width={LINE_X - 18} />
                            {/if}
                            <stacklayout marginLeft={LINE_X + 24} marginRight={16} padding="4 0 4 0">
                                <stacklayout orientation="horizontal">
                                    <stacklayout
                                        backgroundColor={legChipColor(stop.after)}
                                        borderRadius={4}
                                        height={CHIP_HEIGHT}
                                        marginRight={8}
                                        orientation="horizontal"
                                        padding="0 6"
                                        verticalAlignment="middle">
                                        <label color={legTextColor(stop.after)} fontFamily={$fonts.mdi} fontSize={16} text={modeIcon(stop.after.mode)} verticalAlignment="middle" />
                                        <label
                                            color={legTextColor(stop.after)}
                                            fontSize={13}
                                            fontWeight="bold"
                                            paddingLeft={3}
                                            text={legName(stop.after)}
                                            verticalAlignment="middle"
                                            visibility={isWalk(stop.after) ? 'collapse' : 'visible'} />
                                    </stacklayout>
                                    <label color={colorOnSurface} fontSize={14} lineBreak="end" maxLines={2} text={legTitle(stop.after)} verticalAlignment="middle" />
                                </stacklayout>
                                <label color={colorOnSurfaceVariant} fontSize={12} text={legDetails(stop.after)} />
                                {#if stop.after.intermediateStops?.length}
                                    <stacklayout orientation="horizontal" padding="4 0" on:tap={() => toggleLeg(stop.afterIndex)}>
                                        <label
                                            color={colorPrimary}
                                            fontFamily={$fonts.mdi}
                                            fontSize={18}
                                            text={expandedLegs[stop.afterIndex] ? 'mdi-chevron-up' : 'mdi-chevron-down'}
                                            verticalAlignment="middle" />
                                        <label color={colorPrimary} fontSize={13} paddingLeft={4} text={`${stop.after.intermediateStops.length} ${lc('stops')}`} verticalAlignment="middle" />
                                    </stacklayout>
                                    {#if expandedLegs[stop.afterIndex]}
                                        {#each stop.after.intermediateStops as intermediate}
                                            <gridlayout columns="48,*" padding="2 0">
                                                <label color={colorOnSurfaceVariant} fontSize={13} text={stopTime(intermediate)} />
                                                <label col={1} color={colorOnSurface} fontSize={13} lineBreak="end" maxLines={1} text={intermediate.name} />
                                            </gridlayout>
                                        {/each}
                                    {/if}
                                {/if}
                                {#if !isWalk(stop.after)}
                                    <stacklayout orientation="horizontal" padding="4 0" on:tap={() => showLegOnMap(stop.after)}>
                                        <label color={colorPrimary} fontFamily={$fonts.mdi} fontSize={18} text="mdi-map-marker-path" verticalAlignment="middle" />
                                        <label color={colorPrimary} fontSize={13} paddingLeft={4} text={lc('show_on_map')} verticalAlignment="middle" />
                                    </stacklayout>
                                {/if}
                            </stacklayout>
                        </canvasview>
                    {/if}
                {/each}
            </stacklayout>
        </scrollview>
    {:else}
        <collectionview id="scrollView" itemIdGenerator={(item, index) => index} items={itineraries} row={1} rowHeight={92}>
            <Template let:item>
                <gridlayout borderBottomColor={colorOutlineVariant} borderBottomWidth={1} columns="*,auto,auto" padding="6 16" rippleColor={colorPrimary} on:tap={() => select(item)}>
                    <stacklayout verticalAlignment="middle">
                        <label color={colorOnSurface} fontSize={17} fontWeight="bold" text={`${formatTime(item.startTime)} → ${formatTime(item.endTime)}`} />
                        <wraplayout marginTop={2}>
                            {#each summaryLegs(item) as leg}
                                <stacklayout backgroundColor={legChipColor(leg)} borderRadius={4} height={CHIP_HEIGHT} marginRight={6} marginTop={4} orientation="horizontal" padding="0 6">
                                    <label color={legTextColor(leg)} fontFamily={$fonts.mdi} fontSize={14} text={modeIcon(leg.mode)} verticalAlignment="middle" />
                                    <label color={legTextColor(leg)} fontSize={13} lineBreak="end" maxLines={1} paddingLeft={3} text={legName(leg)} verticalAlignment="middle" />
                                </stacklayout>
                            {/each}
                        </wraplayout>
                    </stacklayout>
                    <stacklayout col={1} horizontalAlignment="right" verticalAlignment="middle">
                        <label color={colorOnSurface} fontSize={15} fontWeight="bold" horizontalAlignment="right" text={formatDuration(item.duration)} />
                        <label color={colorOnSurfaceVariant} fontSize={12} horizontalAlignment="right" text={`${item.transfers} ⇄`} />
                    </stacklayout>
                    <IconButton col={2} gray={true} text="mdi-dots-vertical" on:tap={(event) => showItineraryMenu(item, event)} />
                </gridlayout>
            </Template>
        </collectionview>
    {/if}
    {#if noNetworkAndNoData}
        <canvaslabel row={1}>
            <cgroup textAlignment="center" verticalAlignment="middle">
                <cspan fontFamily={$fonts.mdi} fontSize={50} text="mdi-alert-circle-outline" />
                <cspan fontSize={20} text={'\n' + lc('no_network')} />
            </cgroup>
        </canvaslabel>
    {:else if itineraries && !itineraries.length}
        <label color={colorOnSurfaceVariant} fontSize={16} horizontalAlignment="center" row={1} text={lc('no_itinerary_found')} verticalAlignment="middle" />
    {/if}
    <stacklayout marginBottom={windowInsetBottom} row={2}>
        {#if selected && selectedTicketUrl}
            <Pill horizontalAlignment="stretch" icon="mdi-ticket-outline" label={lc('get_tickets')} margin="4 16" primary={true} on:tap={() => openTicket(selected)} />
        {/if}
        <label color={colorOnSurfaceVariant} fontSize={11} padding="4 16" text={lc('transitous_attribution')} on:tap={() => openURL('https://transitous.org')} />
    </stacklayout>
    <activityindicator busy={true} horizontalAlignment="right" row={1} verticalAlignment="middle" visibility={loading && !itineraries ? 'visible' : 'hidden'} />
</gesturerootview>
