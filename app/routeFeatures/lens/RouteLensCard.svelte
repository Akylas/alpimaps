<script lang="ts">
    // the sheet's profile card: the lens bar, its insight line and the elevation chart, which the lens reads.
    // The sheet moves the chart's cursor along the route and reloads it
    import type { ComponentEvents } from 'svelte';
    import { createEventDispatcher } from '@shared/utils/svelte/ui';
    import ElevationChart from '~/components/chart/ElevationChart.svelte';
    import GradeLegend from '~/components/chart/GradeLegend.svelte';
    import { convertElevation, formatDistance } from '~/helpers/formatter';
    import { isEInk } from '~/helpers/theme';
    import type { IItem } from '~/models/Item';
    import LensBar from '~/routeFeatures/lens/LensBar.svelte';
    import LensInsight from '~/routeFeatures/lens/LensInsight.svelte';
    import { clearCursor, setCursor } from '~/routeFeatures/lens/routeFocusStore';
    import { routeLensStore, selectLens } from '~/routeFeatures/lens/routeLensStore';
    import { type LensId, resolveLens, routeFeatureChanges, routeFeatures, routeLenses } from '~/routeFeatures/registry';
    import { showAscents, showGradeColors } from '~/stores/mapStore';
    import { geometryKey } from '~/utils/routeAnalysis/geometryKey';

    export let item: IItem;

    const dispatch = createEventDispatcher();
    let chart: ElevationChart;
    let readout: { text: string } = null;

    export function highlightPathIndex(...args: Parameters<ElevationChart['hilghlightPathIndex']>) {
        chart?.hilghlightPathIndex(...args);
    }
    export function reload() {
        chart?.updateChartData();
    }

    // an unsaved route has no id: its shape tells it from another
    const shapeKeys = new WeakMap<object, string>();
    function keyOf(it: IItem) {
        if (it?.id !== undefined) {
            return String(it.id);
        }
        if (!it?.geometry) {
            return '';
        }
        if (!shapeKeys.has(it.geometry)) {
            shapeKeys.set(it.geometry, geometryKey(it.geometry));
        }
        return shapeKeys.get(it.geometry);
    }
    $: itemKey = keyOf(item);
    // a point picked on another route means nothing here
    let shownKey: string;
    $: if (itemKey !== shownKey) {
        shownKey = itemKey;
        readout = null;
        clearCursor();
    }

    $: lenses = $routeFeatureChanges >= 0 ? routeLenses($routeFeatures, { item }) : [];
    $: active = resolveLens($routeLensStore, lenses);
    $: entries = lenses.map((lens) => ({ id: lens.id, icon: lens.icon, label: lens.label(), chip: lens.chip({ item }) }));
    $: headline = lenses.find((lens) => lens.id === active)?.headline({ item });

    function onSelect({ id }: { id: LensId }) {
        selectLens(id);
    }
    function onCursor(event: ComponentEvents<ElevationChart>['cursor']) {
        if (!event) {
            readout = null;
            clearCursor();
            return;
        }
        const { entry, index } = event;
        readout = { text: [formatDistance(entry.d), convertElevation(entry.a || 0), (entry.g || 0).toFixed(1) + ' %'].join(' · ') };
        setCursor(itemKey, { index, distance: entry.d });
    }
</script>

<gridlayout rows="44,40,*,auto" {...$$restProps}>
    <LensBar {entries} selected={active} on:select={onSelect} />
    <LensInsight {headline} {readout} row={1} on:clearReadout={() => chart?.clearHighlight()} />
    <ElevationChart
        bind:this={chart}
        inCard={true}
        {item}
        padding="0 6 4 6"
        row={2}
        showAscents={$showAscents}
        showProfileGrades={$showGradeColors}
        on:cursor={onCursor}
        on:highlight={(payload) => dispatch('highlight', payload)} />
    {#if $showGradeColors && !isEInk && (active === 'overview' || active === 'climbs')}
        <GradeLegend row={3} />
    {/if}
</gridlayout>
