<script lang="ts">
    // when the ride leaves and how: the activity, the departure, picked or from a strip of the departures around it scored
    // for the ride, the pace and the stops. Every change goes up as the route's new analysis
    import { Template } from '@nativescript-community/svelte-native/components';
    import { NativeViewElementNode } from '@nativescript-community/svelte-native/dom';
    import { type CollectionView, SnapPosition } from '@nativescript-community/ui-collectionview';
    import { pickDateTime } from '@nativescript-community/ui-datetimepicker';
    import { Color, ObservableArray } from '@nativescript/core';
    import { showError } from '@shared/utils/showError';
    import { createEventDispatcher } from '@shared/utils/svelte/ui';
    import { getTimes } from 'suncalc';
    import { nightMoon } from '~/utils/astronomy/moon';
    import { onDestroy, tick } from 'svelte';
    import Chip from '~/components/common/Chip.svelte';
    import Pill from '~/components/common/Pill.svelte';
    import { formatTime, lc } from '~/helpers/locale';
    import { isEInk } from '~/helpers/theme';
    import type { IItem } from '~/models/Item';
    import { routeAnalysisChanges } from '~/routeFeatures/analysisRunner';
    import { routeCoordinates } from '~/routeFeatures/lens/sections';
    import { type DepartureAssessor, type StripCell, departureStrip, stripScroll } from '~/routeFeatures/page/departureStrip';
    import { routeFeatures, tellDeparture } from '~/routeFeatures/registry';
    import { activityOf } from '~/utils/routeAnalysis/activity';
    import { fixedStart, isSnapshot, resolveStart, routeTimeZone, stampNow } from '~/utils/routeAnalysis/departure';
    import { createAnalysis, withActivity, withDeparture, withPace } from '~/utils/routeAnalysis/storage';
    import { timelineSource } from '~/utils/routeAnalysis/timeline';
    import type { Activity, RouteAnalysis } from '~/utils/routeAnalysis/types';
    import { colors, fonts } from '~/variables';

    export let item: IItem;
    /** the page bumps it when it changed the item's analysis in place */
    export let version = 0;
    /** while a departure is looked at, what the route had before: the departure the strip is read from. `undefined`: the item's */
    export let committed: RouteAnalysis | null | undefined;
    /** changes each time the panel is opened: the list keeps the panel's view when it is closed, so it is not made again */
    export let opened = 0;

    interface $$Events {
        /** `full`: what the whole page reads changed (the activity sets the climbs' preset), not only the times */
        change: { analysis: RouteAnalysis; full?: boolean; /** looked at, not kept: the page shows it and takes it back */ preview?: boolean };
        /** the departure looked at is not taken: the page goes back to the one it had */
        revert: void;
    }
    const dispatch = createEventDispatcher<$$Events>();

    let { colorOnSurface, colorOnSurfaceVariant, colorOutlineVariant, colorPrimary, colorSurfaceFill } = $colors;
    $: ({ colorOnSurface, colorOnSurfaceVariant, colorOutlineVariant, colorPrimary, colorSurfaceFill } = $colors);

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
    /** dp a cell takes in the strip, margins included */
    const STRIP_CELL = 66;
    /** how much of its bar a departure's level fills: longer is better, which no colour has to say */
    const LEVEL_SHARE = { good: 1, fair: 0.6, poor: 0.25, unknown: 0 };
    const SUNSET_COLOR = '#E8832A';
    const DARK_COLOR = '#7F77DD';
    const MOON_COLOR = '#7F77DD';

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
                const assessment = feature.departure.assess({ item, analysis, at, now: stripNow });
                return assessment && { ...assessment, indicators: assessment.indicators.map((id) => `${feature.id}.${id}`) };
            }
    );
    // a plan kept at its own time is looked at in its own day: nothing in the strip is gone, whatever the clock says
    $: kept = !!inputs.departure.keepPast;
    $: stripNow = kept ? 0 : now;
    $: cells = departureStrip({ chosenAt, anchorAt, now: stripNow, source: timelineSource(item), inputs, lat, lon, assessors });
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
        dispatch('change', { analysis: withDeparture(analysis, item.geometry, { mode: 'planned', at: cell.at, ...(kept ? { keepPast: true } : {}) }), preview: true });
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
        takenHere = true;
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

    // the strip's items are changed in place: a new array resets the list's scroll to its start
    const stripItems = new ObservableArray<(typeof listCells)[number]>([]);
    function syncStrip(next: typeof listCells) {
        if (stripItems.length !== next.length) {
            stripItems.splice(0, stripItems.length, ...next);
            return;
        }
        next.forEach((cell, index) => {
            if (JSON.stringify(stripItems.getItem(index)) !== JSON.stringify(cell)) {
                stripItems.setItem(index, cell);
            }
        });
    }
    $: syncStrip(listCells);

    // where the strip is looked at from: asked for when the panel opens and when the departure is not the strip's own doing (picked in
    // the dialog, `now`). Not as the clock goes, nor as a departure is looked at in the strip: it is in view already
    let strip: NativeViewElementNode<CollectionView>;
    $: departureKey = String(fixedStart(inputs.departure) ?? 'now');
    let showPending = false;
    let takenHere = false;
    // the cells are in the strip once the page has changed the analysis and the list holds them
    function requestShow() {
        showPending = true;
        tick().then(showChosen);
    }
    // these run when their value changes only, and at start
    $: opened, requestShow();
    $: departureKey, onDepartureChange();
    function onDepartureChange() {
        if (takenHere) {
            takenHere = false;
        } else {
            requestShow();
        }
    }
    // also asked by the strip, which is not always there yet when the departure is: once it is loaded and laid out
    function showChosen() {
        const view = strip?.nativeView;
        if (!showPending || !view?.isLoaded || !view.getMeasuredWidth()) {
            return;
        }
        showPending = false;
        const { center, index } = stripScroll(cells, isSnapshot(inputs.departure) ? 'planned' : inputs.departure.mode);
        view.scrollToIndex(index, false, center ? SnapPosition.CENTER : SnapPosition.START);
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
    // the moon over the dark part of the ride: its phase, and how long it is up to light the way
    $: moon = selected && selected.darkMinutes > 0 ? nightMoon(selected.at, selected.arrival, lat, lon) : null;
    $: updatedAt = statuses.find((status) => status.updatedAt)?.updatedAt;
    function isSelected(entry: (typeof ACTIVITIES)[number], activity: Activity | undefined) {
        return activity?.kind === entry.activity.kind && (entry.activity.kind === 'hike' || activity?.subtype === entry.activity.subtype);
    }

    function setActivity(entry: (typeof ACTIVITIES)[number]) {
        previewAt = null;
        dispatch('change', { analysis: withActivity(analysis, item.geometry, { ...entry.activity, origin: 'user' }), full: true });
    }
    function setDeparture(at: number | null) {
        previewAt = null;
        // now is a snapshot: it keeps the time it was taken at, and what is read at a time is read again for it
        // a plan kept at its own time stays so as another is taken in the same day
        dispatch('change', { analysis: withDeparture(analysis, item.geometry, at === null ? stampNow({ mode: 'now' }, Date.now()) : { mode: 'planned', at, ...(kept ? { keepPast: true } : {}) }) });
        // the route has the departure now: what a feature needs for it, it asks for
        tellDeparture(departureFeatures, { item }, at === null ? 'restamped' : 'taken');
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
            // the weather reads the same hours at another pace: only what reads the ride's times again has to hear it
            tellDeparture(departureFeatures, { item }, 'paced');
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

    // the best departure is told by its star and a faint wash of the accent: the colours are the ride's, not the choice's
    function fillOf(cell: StripCell & { selected: boolean }) {
        return cell.selected ? colorSurfaceFill : cell.best && !isEInk ? new Color(colorPrimary).setAlpha(28).hex : null;
    }
    const levelPercent = (level: StripCell['level']) => Math.round(LEVEL_SHARE[level] * 100);
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
            label={inputs.departure.mode === 'planned' ? `${formatTime(chosenAt, 'ddd D MMM', zone.offset)} ${clock(chosenAt)}` : isSnapshot(inputs.departure) ? lc('when_now_at', clock(chosenAt)) : lc('now')}
            marginRight={6}
            selected={inputs.departure.mode === 'planned'}
            on:tap={pickDeparture} />
        {#if inputs.departure.mode === 'planned' || isSnapshot(inputs.departure)}
            <Pill col={1} height={32} label={lc('now')} on:tap={() => setDeparture(null)} />
        {/if}
        <!-- what a feature asks to be done: fetch its data again... -->
        {#if action}
            <Pill col={3} height={32} icon={action.icon} on:tap={() => runAction(action.run)} />
        {/if}
    </gridlayout>
    <collectionview
        bind:this={strip}
        colWidth={STRIP_CELL}
        height={88}
        items={stripItems}
        marginTop={10}
        orientation="horizontal"
        on:dataPopulated={showChosen}
        on:layoutChanged={showChosen}
        on:loaded={showChosen}>
        <!-- no condition block in a cell: the views are reused from one cell to the next, what a cell does not show is collapsed -->
        <Template let:item={cell}>
            <gridlayout
                backgroundColor={fillOf(cell)}
                borderColor={cell.selected ? colorOnSurface : cell.chosen ? colorOnSurfaceVariant : 'transparent'}
                borderRadius={12}
                borderWidth={cell.selected ? 1.5 : 1}
                margin="0 2"
                opacity={cell.past ? 0.35 : cell.uncovered ? 0.7 : 1}
                padding="6 0 7 0"
                rippleColor={colorPrimary}
                rows="auto,auto,*,3"
                on:tap={() => look(cell)}>
                <label color={colorOnSurface} fontSize={11.5} fontWeight={cell.selected || cell.chosen ? 'bold' : 'normal'} text={clock(cell.at)} textAlignment="center" />
                <!-- what the ride is worth a mark for: the best one's star, then the features' marks, the dark, a feature knowing nothing of it -->
                <!-- always the same three spans: a label's children that come and go break the recycled cell -->
                <label fontSize={15} horizontalAlignment="center" marginTop={4} row={1} visibility={cell.best || cell.marks.length ? 'visible' : 'collapse'}>
                    <span color={colorPrimary} fontFamily={$fonts.mdi} fontSize={15} text={cell.best ? 'mdi-star' : ''} />
                    <span color={isEInk ? colorOnSurface : (cell.marks[0]?.color ?? colorOnSurfaceVariant)} fontFamily={$fonts.mdi} fontSize={15} text={cell.marks[0]?.icon ?? ''} />
                    <span color={isEInk ? colorOnSurface : (cell.marks[1]?.color ?? colorOnSurfaceVariant)} fontFamily={$fonts.mdi} fontSize={15} text={cell.marks[1]?.icon ?? ''} />
                </label>
                <!-- what a feature says of the ride in a figure, as a chip with its bar when it has a share: as oss-weather shows the rain of an hour -->
                <Chip
                    bar={cell.figure?.share > 0 ? cell.figure.share : null}
                    color={cell.figure?.color}
                    height={22}
                    horizontalAlignment="center"
                    marginRight={0}
                    marginTop={0}
                    padding="0 8"
                    row={2}
                    value={cell.figure?.text}
                    verticalAlignment="middle"
                    visibility={cell.figure?.share > 0 ? 'visible' : 'collapse'} />
                <label
                    color={colorOnSurfaceVariant}
                    fontSize={12}
                    row={2}
                    text={cell.figure?.text ?? ''}
                    textAlignment="center"
                    verticalAlignment="middle"
                    visibility={cell.figure && !(cell.figure.share > 0) ? 'visible' : 'collapse'} />
                <!-- the score, longer the better: the star says which is best, the colours stay the weather's -->
                <gridlayout
                    backgroundColor={colorOutlineVariant}
                    backgroundImage={`linear-gradient(to right, ${colorOnSurfaceVariant} ${levelPercent(cell.level)}%, transparent ${levelPercent(cell.level)}%)`}
                    borderRadius={1.5}
                    margin="0 12"
                    row={3} />
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
        <gridlayout columns="auto,*,auto" rows="auto,auto">
            <label color={colorOnSurface} fontSize={13} text={lc('when_pace')} verticalAlignment="middle" />
            <slider
                col={1}
                maxValue={PACE_MAX * 100}
                minValue={PACE_MIN * 100}
                stepSize={5}
                value={inputs.pace.multiplier * 100}
                on:valueChange={(event) => setPace({ multiplier: Math.round(event.value) / 100 })} />
            <label col={2} color={colorOnSurfaceVariant} fontSize={13} text={multiplierText(multiplier)} verticalAlignment="middle" />
            <label color={colorOnSurface} fontSize={13} row={1} text={lc('when_stops')} verticalAlignment="middle" />
            <slider col={1} maxValue={STOPS_MAX} minValue={0} row={1} stepSize={1} value={inputs.pace.stopsMinPerHour} on:valueChange={(event) => setPace({ stopsMinPerHour: Math.round(event.value) })} />
            <label col={2} color={colorOnSurfaceVariant} fontSize={13} row={1} text={lc('when_stops_value', stops)} verticalAlignment="middle" />
        </gridlayout>
    {/if}
    {#if selected}
        <!-- the ride of the departure looked at, as oss-weather tops its page: the figure, then what goes with it -->
        <gridlayout borderTopColor={colorOutlineVariant} borderTopWidth={0.5} columns="*,auto" marginTop={8} paddingTop={8} rows="auto,auto">
            <label color={colorOnSurface} fontSize={20} fontWeight="bold" text={`${clock(selected.at)} → ${clock(selected.arrival)}`} verticalAlignment="bottom" />
            {#if updatedAt}
                <label col={1} color={colorOnSurfaceVariant} fontSize={11.5} text={lc('when_updated', clock(updatedAt))} verticalAlignment="bottom" />
            {/if}
            <!-- always the same spans, empty when there is nothing to say: the gaps are spaces -->
            <label
                color={colorOnSurface}
                colSpan={2}
                fontSize={13}
                marginTop={4}
                row={1}
                verticalAlignment="middle"
                visibility={!isNaN(sunset) || selected.darkMinutes > 0 || moon ? 'visible' : 'collapse'}>
                <span color={isEInk ? colorOnSurface : SUNSET_COLOR} fontFamily={$fonts.mdi} fontSize={17} text={isNaN(sunset) ? '' : 'mdi-weather-sunset-down'} />
                <span text={isNaN(sunset) ? '' : ' ' + clock(sunset) + '    '} />
                <span color={isEInk ? colorOnSurface : DARK_COLOR} fontFamily={$fonts.mdi} fontSize={17} text={selected.darkMinutes > 0 ? 'mdi-weather-night' : ''} />
                <span text={selected.darkMinutes > 0 ? ' ' + lc('when_dark', Math.round(selected.darkMinutes)) : ''} />
                <span text={moon ? '    ' : ''} />
                <span color={isEInk ? colorOnSurface : MOON_COLOR} fontFamily={$fonts.mdi} fontSize={17} text={moon ? moon.glyph : ''} />
                <span text={moon ? ' ' + moon.illumination + ' %' + (moon.moonlitMinutes > 0 ? ' · ' + lc('when_moon_up', moon.moonlitMinutes) : '') : ''} />
            </label>
        </gridlayout>
    {/if}
    {#if previewAt !== null}
        <stacklayout marginTop={4} orientation="horizontal">
            <Pill height={32} icon="mdi-check" label={lc('when_leave_at', clock(previewAt))} marginRight={6} primary={true} on:tap={() => leaveAt(previewAt)} />
            <Pill height={32} label={lc('cancel')} on:tap={cancelLook} />
        </stacklayout>
    {/if}
</stacklayout>
