<script lang="ts">
    // the sheet's profile card: the lens bar, its insight line and the elevation chart, which the lens reads.
    // The sheet moves the chart's cursor along the route and reloads it
    import type { ComponentEvents } from 'svelte';
    import { onDestroy } from 'svelte';
    import ElevationChart from '~/components/chart/ElevationChart.svelte';
    import GradeLegend from '~/components/chart/GradeLegend.svelte';
    import { formatTime } from '~/helpers/locale';
    import { getMapContext } from '~/mapModules/MapModule';
    import type { Item } from '~/models/Item';
    import LensBar from '~/routeFeatures/lens/LensBar.svelte';
    import LensInsight from '~/routeFeatures/lens/LensInsight.svelte';
    import { clearCursor, clearFocus, clearSection, focusKeyOf, focusSection, routeFocus, setCursor } from '~/routeFeatures/lens/routeFocusStore';
    import { routeLensStore, selectLens } from '~/routeFeatures/lens/routeLensStore';
    import { isLensFeature, paddedRange, routeCoordinates, sectionAt, stepSection, tappedVertex } from '~/routeFeatures/lens/sections';
    import { type LensId, type LensSection, type ProfileBracket, type ProfileMark, resolveLens, routeAttention, routeFeatureChanges, routeFeatures, routeLenses } from '~/routeFeatures/registry';
    import { packageService } from '~/services/PackageService';
    import { activityOf } from '~/utils/routeAnalysis/activity';
    import { routeTimeZone } from '~/utils/routeAnalysis/departure';
    import { createAnalysis } from '~/utils/routeAnalysis/storage';
    import { buildTimeline, timeAtDistance, timelineSource } from '~/utils/routeAnalysis/timeline';
    import { computeRouteProgress, isLocationOnRoute, isNavigableRoute } from '~/utils/navigation';
    import { showAscents, showGradeColors } from '~/stores/mapStore';

    export let item: Item;
    /** false on the route page: the main map is behind it, a focused section is not framed there */
    export let besideMap = true;
    /** what the insight line's `›` does for a lens, when not the lens' own (the route page opens its section) */
    export let moreFor: (lens: LensId) => (() => void | Promise<void>) | undefined = null;

    const mapContext = getMapContext();
    let chart: ElevationChart;

    export function highlightPathIndex(...args: Parameters<ElevationChart['hilghlightPathIndex']>) {
        chart?.hilghlightPathIndex(...args);
    }
    export function reload() {
        chart?.updateChartData();
    }

    $: itemKey = focusKeyOf(item);
    // a point picked, a section focused on another route mean nothing here
    let shownKey: string;
    $: if (itemKey !== shownKey) {
        shownKey = itemKey;
        clearCursor();
        clearSection();
    }

    // `$routeFeatureChanges >= 0` is always true: it reruns these when a feature's contributions change
    $: lenses = $routeFeatureChanges >= 0 ? routeLenses($routeFeatures, { item }) : [];
    $: active = resolveLens($routeLensStore, lenses);
    $: activeLens = lenses.find((lens) => lens.id === active);
    $: entries = lenses.map((lens) => ({ id: lens.id, icon: lens.icon, label: lens.label(), chip: lens.chip({ item }) }));
    $: headline = activeLens?.headline({ item });
    $: openSection = moreFor ? moreFor(active) : activeLens?.openSection?.({ item });
    // the same arrays for the lens' whole stay, so the chart is not rebuilt for nothing
    const NO_BRACKETS: ProfileBracket[] = [];
    const NO_SECTIONS: LensSection[] = [];
    $: profileOptions = activeLens?.profile?.({ item });
    $: brackets = profileOptions?.brackets ?? NO_BRACKETS;
    $: fill = profileOptions?.fill ?? null;
    $: fade = profileOptions?.fade ?? false;
    // the clock time of each distance of the axis, when the route has a time
    $: clockAt = $routeFeatureChanges >= 0 && item ? clockFor(item) : null;
    function clockFor(route: Item): ((meters: number) => string) | null {
        const source = timelineSource(route);
        if (source.distances.length < 2) {
            return null;
        }
        const inputs = (route.analysis ?? createAnalysis(route.geometry, activityOf(route, null))).inputs;
        const timeline = buildTimeline(source, inputs, Date.now());
        const zone = routeTimeZone(inputs.departure);
        return (meters) => formatTime(timeAtDistance(source.distances, timeline, meters), 'LT', zone.offset);
    }
    $: overlay = profileOptions?.overlay ?? null;

    // what needs attention is marked whatever the lens. The same array until it changes: the chart redraws for a new one
    const NO_MARKS: ProfileMark[] = [];
    $: attention = $routeFeatureChanges >= 0 ? routeAttention($routeFeatures, { item }) : [];
    let marks = NO_MARKS;
    let marksKey = '';
    $: {
        const key = attention.map(({ kind, section, tier }) => `${kind}:${section.i0}:${section.i1}:${tier}`).join();
        if (key !== marksKey) {
            marksKey = key;
            const data = item?.profile?.data;
            marks = data && attention.length ? attention.map(({ kind, section, tier }) => ({ from: data[section.i0].d, to: data[section.i1].d, kind, tier })) : NO_MARKS;
        }
    }

    // a section of the lens in use, focused on this route
    $: sections = activeLens?.sections?.({ item }) ?? NO_SECTIONS;
    $: focused = $routeFocus?.itemKey === itemKey && $routeFocus.section?.lens === active ? $routeFocus.section : null;
    // the chart zooms to the section and the map follows it once: not on every update of the route, nor of the cursor, which also
    // replaces `focused` and would give the chart a new range each time
    let fittedKey = '';
    let range: { fromIndex: number; toIndex: number } = null;
    $: sectionKey = focused ? `${focused.lens}:${focused.i0}:${focused.i1}` : '';
    $: if (sectionKey !== fittedKey) {
        fittedKey = sectionKey;
        // the cursor was for the route as it was: a section focused or left starts from none
        chart?.clearHighlight();
        range = focused ? paddedRange(focused, item?.profile?.data?.length ?? 0) : null;
        if (focused && besideMap) {
            fitSection(focused);
        }
    }

    function fitSection({ i0, i1 }: LensSection) {
        // the map's own zoom, which leaves the sheet's part of the screen out
        mapContext.zoomToItem({ item: { geometry: { type: 'LineString', coordinates: routeCoordinates(item.geometry).slice(i0, i1 + 1) }, route: item.route }, forceZoomOut: true });
    }
    function focusOn(section: LensSection | undefined) {
        if (section) {
            focusSection(itemKey, { ...section, lens: active });
        }
    }
    // a tap on the route line, one of its slices or a plate focuses the section it is in
    mapContext.onVectorTileElementClicked(({ featureData, position }) => {
        const onRoute = item?.id !== undefined && featureData?.route && featureData.id === item.id;
        if ((onRoute || isLensFeature(featureData)) && sections.length) {
            focusOn(sectionAt(sections, tappedVertex(featureData, routeCoordinates(item.geometry), position)));
        }
    });
    // the page's card leaves the focus to the main map it goes back to
    if (besideMap) {
        onDestroy(clearFocus);
    }

    function onMark({ index }: { index: number }) {
        const mark = attention[index];
        if (mark) {
            selectLens(mark.lens);
            focusSection(itemKey, { ...mark.section, lens: mark.lens });
        }
    }
    function onSelect({ id }: { id: LensId }) {
        selectLens(id);
    }
    function onCursor(event: ComponentEvents<ElevationChart>['cursor']) {
        if (event) {
            setCursor(itemKey, { index: event.index, distance: event.entry.d });
        } else {
            clearCursor();
        }
    }
    // a point picked on the chart: its card tells what is left to the end from there. The shared dispatcher hands the
    // payload itself, not the CustomEvent the typings say, hence the `any`
    function onChartHighlight({ highlight, lat, lon }: any) {
        if (!isNavigableRoute(item)) {
            return;
        }
        const location = { lat, lon };
        const positions = packageService.getRouteItemPoses(item);
        const onPathIndex = isLocationOnRoute(location, positions);
        if (onPathIndex === -1) {
            return;
        }
        const { remainingDistance, remainingDistanceToStep, remainingTime } = computeRouteProgress({ item, location, positions, onPathIndex, computeRemaining: true, computeInstruction: false });
        chart?.hilghlightPathIndex({ onPathIndex, remainingDistance, remainingDistanceToStep, remainingTime, dplus: item.profile?.dplus, dmin: item.profile?.dmin }, highlight, false, true);
    }
    // what the lens says of the point under the cursor, in the card that follows it
    function noteOf(index: number) {
        return activeLens?.readout?.({ item, index });
    }
</script>

<gridlayout rows="44,40,*,auto" {...$$restProps}>
    <LensBar {entries} selected={active} on:select={onSelect} />
    <LensInsight
        focus={focused && { text: focused.title }}
        {headline}
        more={!!openSection}
        row={1}
        on:clearFocus={clearSection}
        on:more={() => openSection?.()}
        on:next={() => focusOn(stepSection(sections, focused, 1))}
        on:previous={() => focusOn(stepSection(sections, focused, -1))} />
    <ElevationChart
        bind:this={chart}
        {besideMap}
        {brackets}
        {clockAt}
        {fade}
        {fill}
        inCard={true}
        {item}
        {marks}
        note={noteOf}
        padding="0 6 0 6"
        {range}
        row={2}
        showAscents={$showAscents}
        showProfileGrades={$showGradeColors}
        {overlay}
        on:cursor={onCursor}
        on:mark={onMark}
        on:highlight={onChartHighlight} />
    {#if $showGradeColors && (active === 'overview' || active === 'climbs')}
        <GradeLegend row={3} />
    {/if}
</gridlayout>
