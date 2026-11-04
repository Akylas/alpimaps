<script lang="ts">
    // the sheet's profile card: the lens bar, its insight line and the elevation chart, which the lens reads.
    // The sheet moves the chart's cursor along the route and reloads it
    import type { ComponentEvents } from 'svelte';
    import { onDestroy } from 'svelte';
    import { createEventDispatcher } from '@shared/utils/svelte/ui';
    import ElevationChart from '~/components/chart/ElevationChart.svelte';
    import GradeLegend from '~/components/chart/GradeLegend.svelte';
    import { isEInk } from '~/helpers/theme';
    import { getMapContext } from '~/mapModules/MapModule';
    import type { IItem } from '~/models/Item';
    import LensBar from '~/routeFeatures/lens/LensBar.svelte';
    import LensInsight from '~/routeFeatures/lens/LensInsight.svelte';
    import { clearCursor, clearFocus, clearSection, focusKeyOf, focusSection, routeFocus, setCursor } from '~/routeFeatures/lens/routeFocusStore';
    import { routeLensStore, selectLens } from '~/routeFeatures/lens/routeLensStore';
    import { nearestIndex, paddedRange, routeCoordinates, sectionAt, stepSection } from '~/routeFeatures/lens/sections';
    import { type LensId, type LensSection, type ProfileBracket, type ProfileMark, resolveLens, routeAttention, routeFeatureChanges, routeFeatures, routeLenses } from '~/routeFeatures/registry';
    import { showAscents, showGradeColors } from '~/stores/mapStore';

    export let item: IItem;

    const dispatch = createEventDispatcher();
    const mapContext = getMapContext();
    let chart: ElevationChart;

    export function highlightPathIndex(...args: Parameters<ElevationChart['hilghlightPathIndex']>) {
        chart?.hilghlightPathIndex(...args);
    }
    export function reload() {
        chart?.updateChartData();
    }

    $: itemKey = focusKeyOf(item);
    // a point picked on another route means nothing here
    let shownKey: string;
    $: if (itemKey !== shownKey) {
        shownKey = itemKey;
        clearCursor();
    }

    $: lenses = $routeFeatureChanges >= 0 ? routeLenses($routeFeatures, { item }) : [];
    $: active = resolveLens($routeLensStore, lenses);
    $: activeLens = lenses.find((lens) => lens.id === active);
    $: entries = lenses.map((lens) => ({ id: lens.id, icon: lens.icon, label: lens.label(), chip: lens.chip({ item }) }));
    $: headline = activeLens?.headline({ item });
    $: openSection = activeLens?.openSection?.({ item });
    // the same arrays for the lens' whole stay, so the chart is not rebuilt for nothing
    const NO_BRACKETS: ProfileBracket[] = [];
    const NO_SECTIONS: LensSection[] = [];
    $: profileOptions = activeLens?.profile?.({ item });
    $: brackets = profileOptions?.brackets ?? NO_BRACKETS;
    $: fill = profileOptions?.fill ?? null;

    // what needs attention is marked whatever the lens. The same array until it changes: the chart redraws for a new one
    const NO_MARKS: ProfileMark[] = [];
    $: attention = $routeFeatureChanges >= 0 ? routeAttention($routeFeatures, { item }) : [];
    let marks = NO_MARKS;
    let marksKey = '';
    $: {
        const key = attention.map(({ kind, section }) => `${kind}:${section.i0}:${section.i1}`).join();
        if (key !== marksKey) {
            marksKey = key;
            const data = item?.profile?.data;
            marks = data && attention.length ? attention.map(({ kind, section }) => ({ from: data[section.i0].d, to: data[section.i1].d, kind })) : NO_MARKS;
        }
    }

    // a section of the lens in use, focused on this route
    $: sections = activeLens?.sections?.({ item }) ?? NO_SECTIONS;
    $: focused = $routeFocus?.itemKey === itemKey && $routeFocus.section?.lens === active ? $routeFocus.section : null;
    $: range = focused ? paddedRange(focused, item?.profile?.data?.length ?? 0) : null;
    // the map follows the section once, not on every update of the route
    let fittedKey = '';
    $: sectionKey = focused ? `${focused.lens}:${focused.i0}:${focused.i1}` : '';
    $: if (sectionKey !== fittedKey) {
        fittedKey = sectionKey;
        if (focused) {
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
    // a tap on the route line focuses the section it is in
    mapContext.onVectorTileElementClicked(({ featureData, position }) => {
        if (item?.id !== undefined && featureData?.route && featureData.id === item.id && sections.length) {
            focusOn(sectionAt(sections, nearestIndex(routeCoordinates(item.geometry), position.lat, position.lon)));
        }
    });
    onDestroy(clearFocus);

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
        {brackets}
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
        on:cursor={onCursor}
        on:mark={onMark}
        on:highlight={(payload) => dispatch('highlight', payload)} />
    {#if $showGradeColors && !isEInk && (active === 'overview' || active === 'climbs')}
        <GradeLegend row={3} />
    {/if}
</gridlayout>
