<script lang="ts">
    import ElevationChart from '~/components/chart/ElevationChart.svelte';
    import NavigationCard, { NAVWIDGET_CARD_HEIGHT } from '~/components/navigation/NavigationCard.svelte';
    import { convertElevation } from '~/helpers/formatter';
    import { lc } from '~/helpers/locale';
    import { isEInk } from '~/helpers/theme';
    import { navigationChartCurrentAscent, navigationGradeLookAhead, navigationItem, navigationProgress } from '~/stores/navigationStore';
    import { gradeAhead, gradeColor } from '~/utils/grade';
    import { getCurrentAscent } from '~/utils/navigation';
    import { colors, fontScaleMaxed } from '~/variables';

    export let height = NAVWIDGET_CARD_HEIGHT;

    $: ({ colorOnSurface, colorOnSurfaceVariant } = $colors);

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
    // the road ahead, not the vertex underfoot: a single point grade jumps around far too much to read
    $: grade = available ? gradeAhead(profile.data, $navigationProgress?.onPathIndex ?? -1, $navigationGradeLookAhead) : null;
    // the section colour under the position dot, so the figure and the chart agree
    $: gradeText = grade === null || grade === undefined ? '-' : (grade > 0 ? '+' : '') + grade.toFixed(grade > -10 && grade < 10 ? 1 : 0);
    // the eink screen collapses every bucket to the same grey, so the figure carries the meaning there
    $: gradeValueColor = isEInk || grade === null || grade === undefined ? colorOnSurface : gradeColor(grade);
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
        <!-- the chart keeps the space it can use, the grade takes the fixed width a figure needs -->
        <gridlayout columns="*,auto">
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
            <stacklayout col={1} paddingLeft={6} paddingRight={8} verticalAlignment="center">
                <label color={colorOnSurfaceVariant} fontSize={11 * $fontScaleMaxed} text={lc('grade')} />
                <label>
                    <cspan color={gradeValueColor} fontSize={20 * $fontScaleMaxed} fontWeight="bold" text={gradeText} />
                    <cspan color={colorOnSurfaceVariant} fontSize={13 * $fontScaleMaxed} text=" %" />
                </label>
            </stacklayout>
        </gridlayout>
    </NavigationCard>
{/if}
