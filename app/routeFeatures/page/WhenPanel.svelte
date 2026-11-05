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
    import { type StripCell, type WeatherFactors, departureStrip } from '~/routeFeatures/page/departureStrip';
    import { readWeather } from '~/routeFeatures/weather/read';
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
    /** while a departure is looked at, what the route had before: the departure the strip is read from. `undefined`: the item's */
    export let committed: RouteAnalysis | null | undefined = undefined;

    interface $$Events {
        /** `full`: what the whole page reads changed (the activity sets the climbs' preset), not only the times */
        change: { analysis: RouteAnalysis; full?: boolean; /** looked at, not kept: the page shows it and takes it back */ preview?: boolean };
        /** the departure looked at is not taken: the page goes back to the one it had */
        revert: void;
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
    $: analysis = version >= 0 ? (committed !== undefined ? committed : (item?.analysis ?? null)) : null;
    // an imported track has no routing profile to tell what it is: the user says. A computed route is what it was routed for
    $: imported = !!item?.properties?.imported;
    $: inputs = (analysis ?? createAnalysis(item.geometry)).inputs;
    $: activity = activityOf(item, analysis);
    $: [lon, lat] = routeCoordinates(item.geometry)[0] ?? [0, 0];
    $: chosenAt = resolveStart(inputs.departure, now);
    // the strip keeps its window when another departure is chosen in it, so the choice moves along the strip: it is
    // set again only when the departure is off it (picked in the dialog, or `now` going by)
    const STRIP_STEP = 30 * 60000;
    const STRIP_SPAN = 3 * 3600000;
    let anchorAt: number = null;
    // (never while one is looked at: the strip it is looked at in must stay)
    $: if (previewAt === null && (anchorAt === null || Math.abs(chosenAt - anchorAt) > STRIP_SPAN || (chosenAt - anchorAt) % STRIP_STEP !== 0)) {
        anchorAt = chosenAt;
    }
    // what the forecast fetched says of the ride leaving at a time: the same hours read for another departure
    $: weatherLayer = $routeFeatureWeather ? analysis?.layers.weather : undefined;
    function weatherAt(at: number): WeatherFactors | undefined {
        const shifted = { geometry: item.geometry, profile: item.profile, route: item.route, instructions: item.instructions, analysis: { ...analysis, inputs: { ...inputs, departure: { ...inputs.departure, mode: 'planned' as const, at } } } };
        const read = readWeather(shifted, Math.min(now, at));
        return read ? { rainMm: read.summary.rainTotal, headShare: read.summary.headShare, cloud: read.summary.cloud, covered: read.ride.every((entry) => !!entry.reading) } : undefined;
    }
    $: cells = departureStrip({ chosenAt, anchorAt, now, source: timelineSource(item), inputs, lat, lon, weather: weatherLayer ? weatherAt : undefined });
    $: uncovered = cells.some((cell) => cell.uncovered);
    // a departure looked at in the strip is not the ride's until it is taken: tapping one shows its figures, the button leaves then
    let previewAt: number = null;
    // given up when the page took it, or had it given back for a fetch: nothing to revert then. Only once the page has said it is looking:
    // it says so a flush after the tap
    let sawLook = false;
    $: if (committed !== undefined) {
        sawLook = true;
    } else if (sawLook) {
        sawLook = false;
        previewAt = null;
    }
    $: if (previewAt !== null && previewAt === chosenAt) {
        previewAt = null;
    }
    $: selectedAt = previewAt ?? chosenAt;
    $: selected = cells.find((cell) => cell.at === selectedAt) ?? chosen;
    // what a cell shows is in the list's items: the template does not follow the panel's own variables
    $: listCells = cells.map((cell) => ({ ...cell, selected: cell.at === selectedAt }));
    // tapping a departure shows the page as it would be: the forecast, the profile and the times read for it, kept only by `leaveAt`
    function look(cell: StripCell) {
        if (cell.past) {
            return;
        }
        if (cell.chosen) {
            cancelLook();
            return;
        }
        previewAt = cell.at;
        dispatch('change', { analysis: withDeparture(analysis, item.geometry, { mode: 'planned', at: cell.at }), preview: true });
    }
    function cancelLook() {
        if (previewAt !== null) {
            previewAt = null;
            dispatch('revert');
        }
    }
    // a forecast is kept with the route as it is, not as it is being looked at
    function updateForecast() {
        if (networkService.connected && !weatherBusy) {
            cancelLook();
            computeLayers(item, ['weather']);
        }
    }
    function leaveAt(at: number) {
        previewAt = null;
        setDeparture(at);
    }
    // a departure looked at and not taken is given back with the panel
    onDestroy(cancelLook);
    // the pace and the stops take room the strip is read with: folded away until asked for
    let paceOpen = false;
    $: chosen = cells.find((cell) => cell.chosen);
    // the sunset of the day the ride leaves
    $: sunset = selected ? nextSunset(selected.at) : NaN;
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
        if (strip?.nativeView && shownAt !== anchorAt) {
            shownAt = anchorAt;
            // once the cells are laid out: the list gets its items after it is bound, and before that there is nothing to scroll to
            clearTimeout(scrollTimer);
            scrollTimer = setTimeout(() => strip?.nativeView?.scrollToIndex(Math.max(0, cells.findIndex((cell) => cell.chosen) - 3), false), STRIP_SCROLL_DELAY);
        }
    }
    $: if (strip && anchorAt !== shownAt) {
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
    // one line under the strip: when the forecast is from, and what the strip is scored on
    $: noteText = weatherLayer
        ? `${forecastText} · ${lc(uncovered ? 'when_scored_short_uncovered' : 'when_scored_short')}`
        : $routeFeatureWeather
          ? `${lc('when_darkness_only')} ${forecastText}`
          : lc('when_darkness_only');
    $: summaryText = selected
        ? [
              lc('when_arrive', clock(selected.arrival)),
              !isNaN(sunset) && lc('when_sunset', clock(sunset)),
              selected.darkMinutes > 0 && lc('when_dark', Math.round(selected.darkMinutes)),
              selected.rainMm !== undefined && (selected.rainMm >= 0.1 ? `${selected.rainMm.toFixed(1)} mm` : lc('weather_dry')),
              selected.headShare >= 0.1 && lc('weather_headwind', Math.round(selected.headShare * 100) + ' %')
          ]
              .filter(Boolean)
              .join(' · ')
        : '';
    function isSelected(entry: (typeof ACTIVITIES)[number], activity: Activity | undefined) {
        return activity?.kind === entry.activity.kind && (entry.activity.kind === 'hike' || activity?.subtype === entry.activity.subtype);
    }

    function setActivity(entry: (typeof ACTIVITIES)[number]) {
        previewAt = null;
        dispatch('change', { analysis: withActivity(analysis, item.geometry, { ...entry.activity, origin: 'user' }), full: true });
    }
    function setDeparture(at: number | null) {
        previewAt = null;
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
            previewAt = null;
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

    const INDICATOR_ICONS = { rain: 'mdi-weather-rainy', wind: 'mdi-weather-windy', sun: 'mdi-weather-sunny', dark: 'mdi-weather-night', unknown: 'mdi-cloud-sync-outline' };
    const INDICATOR_COLORS: Record<string, string> = { rain: '#4A90D9', wind: '#F29D38', sun: '#F2B72E' };
    const LEVEL_COLORS = { good: '#1D9E75', fair: '#EF9F27', poor: '#E24B4A', unknown: '#9AA0A6' };
    // e-ink: empty, grey, black
    const LEVEL_SHADES = { good: 0, fair: 110, poor: 255, unknown: 60 };
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
    <gridlayout columns="auto,auto,*,auto" marginTop={4}>
        <Pill
            height={32}
            icon="mdi-calendar-clock"
            label={inputs.departure.mode === 'planned' ? `${formatTime(chosenAt, 'ddd D MMM', zone.offset)} ${clock(chosenAt)}` : lc('now')}
            marginRight={6}
            selected={inputs.departure.mode === 'planned'}
            on:tap={pickDeparture} />
        {#if inputs.departure.mode === 'planned'}
            <Pill col={1} height={32} label={lc('now')} on:tap={() => setDeparture(null)} />
        {/if}
        <!-- the forecast is fetched again only when asked -->
        {#if $routeFeatureWeather}
            <Pill col={3} height={32} icon={weatherBusy ? 'mdi-cloud-sync-outline' : 'mdi-cloud-refresh-outline'} on:tap={updateForecast} />
        {/if}
    </gridlayout>
    <collectionview bind:this={strip} colWidth={54} height={72} items={listCells} marginTop={10} orientation="horizontal">
        <Template let:item={cell}>
            <gridlayout
                borderColor={cell.selected ? colorPrimary : cell.chosen ? colorOnSurfaceVariant : colorOutlineVariant}
                borderRadius={10}
                borderWidth={cell.selected || cell.chosen ? 2 : 1}
                margin="0 2"
                opacity={cell.past ? 0.35 : cell.uncovered ? 0.7 : 1}
                padding="4 2"
                rippleColor={colorPrimary}
                rows="auto,*,6"
                on:tap={() => look(cell)}>
                <label color={colorOnSurface} fontSize={11} fontWeight={cell.selected || cell.chosen ? 'bold' : 'normal'} text={clock(cell.at)} textAlignment="center" />
                <!-- the best departure, then what the ride is worth a mark for: the rain, the wind, the sun, the dark, the forecast not reaching it -->
                <stacklayout horizontalAlignment="center" orientation="horizontal" row={1} verticalAlignment="middle">
                    {#if cell.best}
                        <label color={colorPrimary} fontFamily={$fonts.mdi} fontSize={14} text="mdi-star" />
                    {/if}
                    {#each cell.indicators.slice(0, cell.best ? 2 : 3) as indicator}
                        <label color={isEInk ? colorOnSurface : INDICATOR_COLORS[indicator] ?? colorOnSurfaceVariant} fontFamily={$fonts.mdi} fontSize={14} text={INDICATOR_ICONS[indicator]} />
                    {/each}
                </stacklayout>
                <gridlayout backgroundColor={levelColor(cell)} borderColor={isEInk ? '#000000' : null} borderRadius={3} borderWidth={isEInk ? 1 : 0} row={2} />
            </gridlayout>
        </Template>
    </collectionview>
    <label color={colorOnSurfaceVariant} fontSize={11} marginTop={4} text={noteText} />
    <!-- the pace and the stops, folded: what they are is on the header -->
    <gridlayout columns="*,auto" marginTop={2} rippleColor={colorPrimary} on:tap={() => (paceOpen = !paceOpen)}>
        <label color={colorOnSurface} fontSize={12} text={`${lc('when_pace_stops')} · ${multiplierText(multiplier)} · ${lc('when_stops_value', stops)}`} verticalAlignment="middle" />
        <label col={1} color={colorOnSurfaceVariant} fontFamily={$fonts.mdi} fontSize={20} text={paceOpen ? 'mdi-chevron-up' : 'mdi-chevron-down'} verticalAlignment="middle" />
    </gridlayout>
    {#if paceOpen}
        <gridlayout columns="auto,*,auto">
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
    {/if}
    {#if selected}
        <label color={selected.darkMinutes > 0 && !isEInk ? colorError : colorOnSurface} fontSize={12} fontWeight="bold" marginTop={4} text={summaryText} />
    {/if}
    {#if previewAt !== null}
        <stacklayout marginTop={4} orientation="horizontal">
            <Pill height={32} icon="mdi-check" label={lc('when_leave_at', clock(previewAt))} marginRight={6} primary={true} on:tap={() => leaveAt(previewAt)} />
            <Pill height={32} label={lc('cancel')} on:tap={cancelLook} />
        </stacklayout>
    {/if}
</stacklayout>
