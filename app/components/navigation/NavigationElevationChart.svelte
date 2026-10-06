<script lang="ts">
    import { lc } from '@nativescript-community/l';
    import ElevationChart from '~/components/chart/ElevationChart.svelte';
    import NavigationCard, { NAVWIDGET_CARD_HEIGHT } from '~/components/navigation/NavigationCard.svelte';
    import { convertElevation } from '~/helpers/formatter';
    import { isEInk } from '~/helpers/theme';
    import { navigationChartCurrentAscent, navigationGradeLookAhead, navigationItem, navigationProgress, navigationScale } from '~/stores/navigationStore';
    import { gradeAhead, gradeColor } from '~/utils/grade';
    import { getCurrentAscent } from '~/utils/navigation';
    import { colors } from '~/variables';

    // follows the navigation scale: it shares a row with the other widgets
    export let height: number = null;
    $: cardHeight = height ?? Math.round(NAVWIDGET_CARD_HEIGHT * $navigationScale);

    $: ({ colorHairline, colorOnSurface, colorOnSurfaceVariant } = $colors);

    let elevationChart: ElevationChart;

    $: profile = $navigationItem?.profile;
    $: available = !!profile?.data?.length;

    // while climbing, the whole-route silhouette is unreadable: scope it to the climb being climbed
    $: currentAscent = $navigationChartCurrentAscent ? getCurrentAscent(profile, $navigationProgress?.onPathIndex ?? -1) : null;
    $: range = currentAscent ? { fromIndex: currentAscent.ascent.startIndex, toIndex: currentAscent.ascent.endIndex } : null;
    // the road ahead, not the vertex underfoot: a single point grade jumps around far too much to read
    $: grade = available ? gradeAhead(profile.data, $navigationProgress?.onPathIndex ?? -1, $navigationGradeLookAhead) : null;
    $: gradeText = grade === null || grade === undefined ? '-' : (grade > 0 ? '+' : '') + grade.toFixed(grade > -10 && grade < 10 ? 1 : 0);
    // the eink screen collapses every bucket to the same grey, so the figure carries the meaning there
    $: gradeValueColor = isEInk || grade === null || grade === undefined ? colorOnSurface : gradeColor(grade);
    // the service already walked the polyline for this fix, so the chart just follows its result. The
    // marker only moves with the index, so a fix that lands on the same vertex is not worth a redraw
    let highlightedIndex = -2;
    $: highlightIfMoved($navigationProgress, available);

    function highlightIfMoved(progress, chartAvailable: boolean) {
        if (!progress || !chartAvailable || progress.onPathIndex === highlightedIndex) {
            return;
        }
        highlightedIndex = progress.onPathIndex;
        highlight(progress);
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
    <!-- the figure first, like the bar: the grade ahead, then the chart it comes from -->
    <NavigationCard columns="auto,*" height={cardHeight} padding="6 10 6 12" {...$$restProps}>
        <stacklayout paddingRight={12} verticalAlignment="center">
            <label color={colorOnSurfaceVariant} fontSize={12 * $navigationScale} text={lc('grade')} />
            <label maxLines={1}>
                <cspan color={gradeValueColor} fontSize={28 * $navigationScale} fontWeight="bold" text={gradeText} />
                <cspan color={colorOnSurfaceVariant} fontSize={14 * $navigationScale} text=" %" />
            </label>
        </stacklayout>
        <gridlayout borderColor={colorHairline} borderLeftWidth={1} col={1} paddingLeft={10} rows="auto,*">
            <label color={colorOnSurfaceVariant} fontSize={12 * $navigationScale} lineBreak="end" maxLines={1}>
                <cspan text={currentAscent ? lc('navigation_this_climb') : lc('navigation_elevation_ahead')} />
                <cspan color={colorOnSurface} fontWeight="bold" text={currentAscent ? ' · ' + convertElevation(currentAscent.summitElevation) : ''} />
            </label>
            <ElevationChart bind:this={elevationChart} filled={!isEInk} item={$navigationItem} mini={true} {range} row={1} showAscents={false} showProfileGrades={false} showWaypoints={false} />
        </gridlayout>
    </NavigationCard>
{/if}
