<script lang="ts">
    import ElevationChart from '~/components/chart/ElevationChart.svelte';
    import NavigationCard, { NAVWIDGET_CARD_HEIGHT } from '~/components/navigation/NavigationCard.svelte';
    import { convertElevation } from '~/helpers/formatter';
    import { isEInk } from '~/helpers/theme';
    import { navigationChartCurrentAscent, navigationItem, navigationProgress } from '~/stores/navigationStore';
    import { getCurrentAscent } from '~/utils/navigation';
    import { colors, fontScaleMaxed } from '~/variables';

    export let height = NAVWIDGET_CARD_HEIGHT;

    $: ({ colorOnSurfaceVariant } = $colors);

    /**
     * The item sheet's chart in its `mini` variant rather than a second implementation: it already
     * filters the points down and draws the curve, and rolling our own is what left this widget blank.
     */
    let elevationChart: ElevationChart;

    $: profile = $navigationItem?.profile;
    // nothing to silhouette without a profile, so the widget simply does not appear
    $: available = !!profile?.data?.length;

    // while climbing, the whole-route silhouette is unreadable: scope it to the climb being climbed
    $: currentAscent = $navigationChartCurrentAscent ? getCurrentAscent(profile, $navigationProgress?.onPathIndex ?? -1) : null;
    $: range = currentAscent ? { fromIndex: currentAscent.ascent.startIndex, toIndex: currentAscent.ascent.endIndex } : null;
    // the service already walked the polyline for this fix, so the chart just follows its result
    $: if ($navigationProgress && available) {
        highlight($navigationProgress);
    }

    function highlight(progress) {
        elevationChart?.hilghlightPathIndex(
            {
                onPathIndex: progress.onPathIndex,
                remainingDistance: progress.remainingDistance,
                remainingDistanceToStep: progress.remainingDistanceToStep,
                remainingTime: progress.remainingTime,
                dplus: profile?.dplus,
                dmin: profile?.dmin
            },
            undefined,
            false
        );
    }
</script>

{#if available}
    <NavigationCard {height} {...$$restProps}>
        <gridlayout>
            <ElevationChart bind:this={elevationChart} filled={!isEInk} item={$navigationItem} mini={true} {range} showAscents={false} showProfileGrades={false} showWaypoints={false} />
            <!-- in a climb the number the user wants is the summit they are heading for -->
            {#if currentAscent}
                <label
                    color={colorOnSurfaceVariant}
                    fontSize={10 * $fontScaleMaxed}
                    horizontalAlignment="right"
                    marginRight={4}
                    text={convertElevation(currentAscent.summitElevation)}
                    verticalAlignment="top" />
            {/if}
        </gridlayout>
    </NavigationCard>
{/if}
