<script lang="ts">
    // when the ride leaves and how: the activity, the departure, picked or from a strip of the departures around it scored
    // for the ride, the pace and the stops. Every change goes up as the route's new analysis
    import { Template } from '@nativescript-community/svelte-native/components';
    import { NativeViewElementNode } from '@nativescript-community/svelte-native/dom';
    import type { CollectionView } from '@nativescript-community/ui-collectionview';
    import { pickDateTime } from '@nativescript-community/ui-datetimepicker';
    import { Color } from '@nativescript/core';
    import { showError } from '@shared/utils/showError';
    import { createEventDispatcher } from '@shared/utils/svelte/ui';
    import { getTimes } from 'suncalc';
    import { onDestroy } from 'svelte';
    import Pill from '~/components/common/Pill.svelte';
    import { formatTime, lc } from '~/helpers/locale';
    import { isEInk } from '~/helpers/theme';
    import type { IItem } from '~/models/Item';
    import { computeLayers, layerStatuses, routeAnalysisChanges } from '~/routeFeatures/analysisRunner';
    import { routeCoordinates } from '~/routeFeatures/lens/sections';
    import { type StripCell, departureStrip } from '~/routeFeatures/page/departureStrip';
    import { routeFeatureWeather } from '~/routeFeatures/weather/settings';
    import { networkService } from '~/services/NetworkService';
    import { activityOf } from '~/utils/routeAnalysis/activity';
    import { resolveStart, routeTimeZone } from '~/utils/routeAnalysis/departure';
    import { createAnalysis, withActivity, withDeparture, withPace } from '~/utils/routeAnalysis/storage';
    import { timelineSource } from '~/utils/routeAnalysis/timeline';
    import type { Activity, RouteAnalysis } from '~/utils/routeAnalysis/types';
    import { colors, fonts } from '~/variables';

    export let item: IItem;
    /** the page bumps it when it changed the item's analysis in place */
    export let version = 0;

    interface $$Events {
        /** `full`: what the whole page reads changed (the activity sets the climbs' preset), not only the times */
        change: { analysis: RouteAnalysis; full?: boolean };
    }
    const dispatch = createEventDispatcher<$$Events>();

    let { colorError, colorOnSurface, colorOnSurfaceVariant, colorOutlineVariant, colorPrimary } = $colors;
    $: ({ colorError, colorOnSurface, colorOnSurfaceVariant, colorOutlineVariant, colorPrimary } = $colors);

    const ACTIVITIES: { id: string; icon: string; label: string; activity: Omit<Activity, 'origin'> }[] = [
        { id: 'hike', icon: 'mdi-hiking', label: lc('climbs_preset_hiking'), activity: { kind: 'hike', subtype: 'walk' } },
        { id: 'road', icon: 'mdi-bike', label: lc('climbs_preset_road'), activity: { kind: 'bike', subtype: 'road' } },
        { id: 'gravel', icon: 'mdi-bike', label: lc('climbs_preset_gravel'), activity: { kind: 'bike', subtype: 'gravel' } },
        { id: 'mtb', icon: 'mdi-bike', label: lc('climbs_preset_mtb'), activity: { kind: 'bike', subtype: 'mountain' } }
    ];
    const PACE_MIN = 0.8;
    const PACE_MAX = 1.3;
    const STOPS_MAX = 20;
    const SLIDER_SAVE_DELAY = 400;
    const STRIP_SCROLL_DELAY = 300;

    // the clock moves the strip on: a departure that was ahead may have gone
    let now = Date.now();
    const clockTimer = setInterval(() => (now = Date.now()), 60000);
    onDestroy(() => clearInterval(clockTimer));

    // `version >= 0` is always true: it reruns this when the page changed the analysis in place
    $: analysis = version >= 0 ? (item?.analysis ?? null) : null;
    // an imported track has no routing profile to tell what it is: the user says. A computed route is what it was routed for
    $: imported = !!item?.properties?.imported;
    $: inputs = (analysis ?? createAnalysis(item.geometry)).inputs;
    $: activity = activityOf(item, analysis);
    $: [lon, lat] = routeCoordinates(item.geometry)[0] ?? [0, 0];
    $: chosenAt = resolveStart(inputs.departure, now);
    $: cells = departureStrip({ chosenAt, now, source: timelineSource(item), inputs, lat, lon });
    $: chosen = cells.find((cell) => cell.chosen);
    // the sunset of the day the ride leaves
    $: sunset = chosen ? nextSunset(chosen.at) : NaN;
    // the sunset the ride rides towards: a late departure is past today's
    function nextSunset(at: number) {
        const today = getTimes(new Date(at), lat, lon).sunset.getTime();
        return today >= at ? today : getTimes(new Date(at + 24 * 3600 * 1000), lat, lon).sunset.getTime();
    }

    // the chosen departure in the middle of the strip, the earlier ones left of it
    let strip: NativeViewElementNode<CollectionView>;
    let shownAt: number;
    let scrollTimer: ReturnType<typeof setTimeout>;
    onDestroy(() => clearTimeout(scrollTimer));
    function showChosen() {
        if (strip?.nativeView && shownAt !== chosenAt) {
            shownAt = chosenAt;
            // once the cells are laid out: the list gets its items after it is bound, and before that there is nothing to scroll to
            clearTimeout(scrollTimer);
            scrollTimer = setTimeout(() => strip?.nativeView?.scrollToIndex(Math.max(0, cells.findIndex((cell) => cell.chosen) - 3), false), STRIP_SCROLL_DELAY);
        }
    }
    $: if (strip && chosenAt !== shownAt) {
        showChosen();
    }
    $: zone = routeTimeZone(inputs.departure);

    function clock(at: number) {
        return formatTime(at, 'LT', zone.offset);
    }

    // the forecast is read again from the hours fetched when the departure moves, and fetched again only when asked
    $: weather = $routeAnalysisChanges >= 0 && analysis ? layerStatuses(item).weather : null;
    $: weatherBusy = weather?.state === 'running' || weather?.state === 'queued';
    $: forecastText =
        weather?.state === 'running' || weather?.state === 'queued'
            ? lc('weather_fetching')
            : weather?.reason === 'out-of-coverage'
              ? lc('weather_out_of_coverage')
              : analysis?.layers.weather
                ? lc('weather_forecast_updated', clock(analysis.layers.weather.prov.computedAt))
                : lc('weather_forecast_none');
    function isSelected(entry: (typeof ACTIVITIES)[number], activity: Activity | undefined) {
        return activity?.kind === entry.activity.kind && (entry.activity.kind === 'hike' || activity?.subtype === entry.activity.subtype);
    }

    function setActivity(entry: (typeof ACTIVITIES)[number]) {
        dispatch('change', { analysis: withActivity(analysis, item.geometry, { ...entry.activity, origin: 'user' }), full: true });
    }
    function setDeparture(at: number | null) {
        dispatch('change', { analysis: withDeparture(analysis, item.geometry, at === null ? { mode: 'now' } : { mode: 'planned', at }) });
    }
    async function pickDeparture() {
        try {
            const picked = await pickDateTime({ date: new Date(chosenAt), title: lc('depart_at'), is24Hour: true });
            if (picked) {
                setDeparture(picked.getTime());
            }
        } catch (error) {
            showError(error);
        }
    }

    // a slider moves in steps while dragged: the analysis is saved once it settles
    let paceTimer: ReturnType<typeof setTimeout>;
    // what the sliders show while dragged, before it is saved
    let multiplier: number;
    let stops: number;
    $: multiplier = inputs.pace.multiplier;
    $: stops = inputs.pace.stopsMinPerHour;
    let pendingPace: { multiplier?: number; stopsMinPerHour?: number } = null;
    function savePace() {
        clearTimeout(paceTimer);
        if (pendingPace) {
            const pace = pendingPace;
            pendingPace = null;
            dispatch('change', { analysis: withPace(analysis, item.geometry, pace) });
        }
    }
    function setPace(pace: { multiplier?: number; stopsMinPerHour?: number }) {
        multiplier = pace.multiplier ?? multiplier;
        stops = pace.stopsMinPerHour ?? stops;
        pendingPace = { ...pendingPace, ...pace };
        clearTimeout(paceTimer);
        paceTimer = setTimeout(savePace, SLIDER_SAVE_DELAY);
    }
    // a change still waiting when the panel closes is saved, not lost
    onDestroy(savePace);

    const LEVEL_COLORS = { good: '#1D9E75', fair: '#EF9F27', poor: '#E24B4A' };
    // e-ink: empty, grey, black
    const LEVEL_SHADES = { good: 0, fair: 110, poor: 255 };
    function levelColor(cell: StripCell) {
        return isEInk ? new Color('#000000').setAlpha(LEVEL_SHADES[cell.level]).hex : LEVEL_COLORS[cell.level];
    }
    const multiplierText = (value: number) => '×' + value.toFixed(2);
</script>

<stacklayout padding="8 12 12 12" {...$$restProps}>
    {#if imported}
        <wraplayout>
            {#each ACTIVITIES as entry}
                <Pill height={32} icon={entry.icon} label={entry.label} margin="0 6 6 0" selected={isSelected(entry, activity)} on:tap={() => setActivity(entry)} />
            {/each}
        </wraplayout>
    {/if}
    <stacklayout marginTop={4} orientation="horizontal">
        <Pill
            height={32}
            icon="mdi-calendar-clock"
            label={inputs.departure.mode === 'planned' ? `${formatTime(chosenAt, 'ddd D MMM', zone.offset)} ${clock(chosenAt)}` : lc('now')}
            marginRight={6}
            selected={inputs.departure.mode === 'planned'}
            on:tap={pickDeparture} />
        {#if inputs.departure.mode === 'planned'}
            <Pill height={32} label={lc('now')} on:tap={() => setDeparture(null)} />
        {/if}
    </stacklayout>
    <collectionview bind:this={strip} colWidth={54} height={72} items={cells} marginTop={10} orientation="horizontal">
        <Template let:item={cell}>
            <gridlayout
                borderColor={cell.chosen ? colorPrimary : colorOutlineVariant}
                borderRadius={10}
                borderWidth={cell.chosen ? 2 : 1}
                margin="0 2"
                opacity={cell.past ? 0.35 : 1}
                padding="4 2"
                rippleColor={colorPrimary}
                rows="auto,*,6"
                on:tap={() => !cell.past && setDeparture(cell.at)}>
                <label color={colorOnSurface} fontSize={11} fontWeight={cell.chosen ? 'bold' : 'normal'} text={clock(cell.at)} textAlignment="center" />
                <!-- the best departure, else what makes this one worse: the dark -->
                <label
                    color={cell.best ? colorPrimary : colorOnSurfaceVariant}
                    fontFamily={$fonts.mdi}
                    fontSize={16}
                    row={1}
                    text={cell.best ? 'mdi-star' : cell.darkMinutes > 0 ? 'mdi-weather-night' : ''}
                    textAlignment="center"
                    verticalAlignment="middle" />
                <gridlayout backgroundColor={levelColor(cell)} borderColor={isEInk ? '#000000' : null} borderRadius={3} borderWidth={isEInk ? 1 : 0} row={2} />
            </gridlayout>
        </Template>
    </collectionview>
    <label color={colorOnSurfaceVariant} fontSize={11} marginTop={4} text={lc('when_darkness_only')} />
    <gridlayout columns="auto,*,auto" marginTop={8}>
        <label color={colorOnSurface} fontSize={13} text={lc('when_pace')} verticalAlignment="middle" />
        <slider
            col={1}
            maxValue={PACE_MAX * 100}
            minValue={PACE_MIN * 100}
            stepSize={5}
            value={inputs.pace.multiplier * 100}
            on:valueChange={(event) => setPace({ multiplier: Math.round(event.value) / 100 })} />
        <label col={2} color={colorOnSurfaceVariant} fontSize={13} text={multiplierText(multiplier)} verticalAlignment="middle" />
    </gridlayout>
    <gridlayout columns="auto,*,auto">
        <label color={colorOnSurface} fontSize={13} text={lc('when_stops')} verticalAlignment="middle" />
        <slider col={1} maxValue={STOPS_MAX} minValue={0} stepSize={1} value={inputs.pace.stopsMinPerHour} on:valueChange={(event) => setPace({ stopsMinPerHour: Math.round(event.value) })} />
        <label col={2} color={colorOnSurfaceVariant} fontSize={13} text={lc('when_stops_value', stops)} verticalAlignment="middle" />
    </gridlayout>
    {#if $routeFeatureWeather}
        <gridlayout columns="*,auto" marginTop={8}>
            <label color={colorOnSurfaceVariant} fontSize={12} text={forecastText} verticalAlignment="middle" />
            {#if networkService.connected && !weatherBusy}
                <Pill col={1} height={32} icon="mdi-cloud-refresh-outline" label={analysis?.layers.weather ? lc('weather_update') : lc('weather_fetch')} on:tap={() => computeLayers(item, ['weather'])} />
            {/if}
        </gridlayout>
    {/if}
    {#if chosen}
        <label
            color={chosen.darkMinutes > 0 && !isEInk ? colorError : colorOnSurface}
            fontSize={13}
            fontWeight="bold"
            marginTop={6}
            text={[lc('when_arrive', clock(chosen.arrival)), !isNaN(sunset) && lc('when_sunset', clock(sunset)), chosen.darkMinutes > 0 && lc('when_dark', Math.round(chosen.darkMinutes))]
                .filter(Boolean)
                .join(' · ')} />
    {/if}
</stacklayout>
