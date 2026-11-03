<script lang="ts">
    // the sheet's elevation chart: the sheet moves its cursor along the route and reloads it
    import { createEventDispatcher } from '@shared/utils/svelte/ui';
    import ElevationChart from '~/components/chart/ElevationChart.svelte';
    import type { Item } from '~/models/Item';
    import { showAscents, showGradeColors } from '~/stores/mapStore';

    export let item: Item;

    const dispatch = createEventDispatcher();
    let chart: ElevationChart;

    export function highlightPathIndex(...args: Parameters<ElevationChart['hilghlightPathIndex']>) {
        chart?.hilghlightPathIndex(...args);
    }
    export function reload() {
        chart?.updateChartData();
    }
</script>

<ElevationChart
    bind:this={chart}
    infoStrip={true}
    {item}
    padding="0 6 4 6"
    showAscents={$showAscents}
    showProfileGrades={$showGradeColors}
    {...$$restProps}
    on:highlight={(payload) => dispatch('highlight', payload)} />
