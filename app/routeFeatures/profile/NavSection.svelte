<script lang="ts">
    // the full chart of the navigation sheet: its cursor follows the progress along the route
    import ElevationChart from '~/components/chart/ElevationChart.svelte';
    import type { IItem } from '~/models/Item';
    import { navigationProgress } from '~/stores/navigationStore';
    import { showAscents, showGradeColors } from '~/stores/mapStore';
    import type { RouteProgress } from '~/utils/navigation';

    export let item: IItem;

    let chart: ElevationChart;
    $: profile = item?.profile;
    $: if (chart && $navigationProgress && profile?.data?.length) {
        highlightChart($navigationProgress);
    }
    function highlightChart(progress: RouteProgress) {
        chart.hilghlightPathIndex(
            {
                onPathIndex: progress.onPathIndex,
                remainingDistance: progress.remainingDistance,
                remainingDistanceToStep: progress.remainingDistanceToStep,
                remainingTime: progress.remainingTime,
                dplus: profile.dplus,
                dmin: profile.dmin
            },
            undefined,
            false
        );
    }
</script>

<ElevationChart bind:this={chart} {item} showAscents={$showAscents} showProfileGrades={$showGradeColors} {...$$restProps} />
