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
    import { routeAnalysisChanges } from '~/routeFeatures/analysisRunner';
    import { routeCoordinates } from '~/routeFeatures/lens/sections';
    import { type DepartureAssessor, type StripCell, departureStrip } from '~/routeFeatures/page/departureStrip';
    import { routeFeatures } from '~/routeFeatures/registry';
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
    // what each feature says of the ride leaving at a time, by the ids of its marks, which are the feature's own
    $: departureFeatures = $routeFeatures.filter((feature) => feature.departure);
    $: assessors = departureFeatures.map(
        (feature): DepartureAssessor =>
            (at) => {
                const assessment = feature.departure.assess({ item, analysis, at, now });
                return assessment && { ...assessment, indicators: assessment.indicators.map((id) => `${feature.id}.${id}`) };
            }
    );
    $: cells = departureStrip({ chosenAt, anchorAt, now, source: timelineSource(item), inputs, lat, lon, assessors });
    $: uncovered = cells.some((cell) => cell.uncovered);
    // the glyph and colour of each mark of a departure: the features', and the panel's own
    const OWN_MARKS = { dark: { icon: 'mdi-weather-night' }, unknown: { icon: 'mdi-help-circle-outline' } };
    $: marks = { ...OWN_MARKS, ...Object.fromEntries(departureFeatures.flatMap((feature) => Object.entries(feature.departure.indicators).map(([id, mark]) => [`${feature.id}.${id}`, mark]))) };
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
    $: listCells = cells.map((cell) => ({ ...cell, selected: cell.at === selectedAt, marks: cell.indicators.flatMap((id) => (marks[id] ? [marks[id]] : [])) }));
    // tapping a departure shows the page as it would be: everything read for it, kept only by `leaveAt`
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
    // what a feature asks of the route is asked of the route as it is, not as it is being looked at
    function runAction(action: () => void) {
        cancelLook();
        action();
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
            scrollTimer = setTimeout(() => {
                const chosenIndex = cells.findIndex((cell) => cell.chosen);
                // the past is not looked at: the strip starts at now, or at the first departure to come; a planned one has its neighbours
                const firstToCome = Math.max(0, cells.findIndex((cell) => !cell.past));
                strip?.nativeView?.scrollToIndex(inputs.departure.mode === 'now' ? firstToCome : Math.max(firstToCome, chosenIndex - 3), false);
            }, STRIP_SCROLL_DELAY);
        }
    }
    $: if (strip && anchorAt !== shownAt) {
        showChosen();
    }
    $: zone = routeTimeZone(inputs.departure);

    function clock(at: number) {
        return formatTime(at, 'LT', zone.offset);
    }

    // what the features say of themselves: a line under the strip, a button beside the departure
    $: statuses = $routeAnalysisChanges >= 0 ? departureFeatures.flatMap((feature) => feature.departure.status?.({ item }) ?? []) : [];
    $: action = statuses.find((status) => status.action)?.action;
    // one line under the strip: what it is scored on, and what the features say of their data
    $: noteText = statuses.some((status) => status.scoring)
        ? [...statuses.map((status) => status.note), uncovered ? lc('when_unknown_note') : ''].filter(Boolean).join(' · ')
        : [lc('when_darkness_only'), ...statuses.map((status) => status.note)].join(' ');
    $: summaryText = selected
        ? [lc('when_arrive', clock(selected.arrival)), !isNaN(sunset) && lc('when_sunset', clock(sunset)), selected.darkMinutes > 0 && lc('when_dark', Math.round(selected.darkMinutes)), ...selected.summaries]
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
        <!-- what a feature asks to be done: fetch its data again... -->
        {#if action}
            <Pill col={3} height={32} icon={action.icon} on:tap={() => runAction(action.run)} />
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
                <!-- the best departure, then what the ride is worth a mark for: the features' marks, the dark, a feature knowing nothing of it -->
                <stacklayout horizontalAlignment="center" orientation="horizontal" row={1} verticalAlignment="middle">
                    {#if cell.best}
                        <label color={colorPrimary} fontFamily={$fonts.mdi} fontSize={14} text="mdi-star" />
                    {/if}
                    {#each cell.marks.slice(0, cell.best ? 2 : 3) as mark}
                        <label color={isEInk ? colorOnSurface : mark.color ?? colorOnSurfaceVariant} fontFamily={$fonts.mdi} fontSize={14} text={mark.icon} />
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
