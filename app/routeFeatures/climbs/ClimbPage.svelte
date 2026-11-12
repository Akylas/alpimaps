<script lang="ts">
    // dock page: the grade now, the climb the rider is in (or the next one) with the position on it, what is left of
    // it, and the next steep stretch
    import { lc } from '@nativescript-community/l';
    import ElevationChart from '~/components/chart/ElevationChart.svelte';
    import NavigationPageHeader from '~/components/navigation/NavigationPageHeader.svelte';
    import { convertElevation, formatDistance } from '~/helpers/formatter';
    import { isEInk } from '~/helpers/theme';
    import { categoryLabel, readClimbs } from '~/routeFeatures/climbs/data';
    import { climbNow, steepNow } from '~/routeFeatures/climbs/dock';
    import { dockLens, nextDockLens, progressFollower } from '~/routeFeatures/lens/dockLens';
    import { profileAhead } from '~/routeFeatures/profile/ahead';
    import { routeFeatureChanges } from '~/routeFeatures/registry';
    import { navigationGradeLookAhead, navigationItem, navigationProgress, navigationScale } from '~/stores/navigationStore';
    import { gradeAhead, gradeColor } from '~/utils/grade';
    import { colors } from '~/variables';

    export let height: number = null;

    /** meters of route the chart shows when there is no climb left to show */
    const NO_CLIMB_SPAN = 5000;

    $: ({ colorError, colorOnSurface, colorOnSurfaceVariant } = $colors);

    $: profile = $navigationItem?.profile;
    $: data = profile?.data;
    // the `>= 0` only makes the statement depend on the settings changing what is read
    $: read = $routeFeatureChanges >= 0 ? readClimbs($navigationItem) : null;
    $: onPathIndex = $navigationProgress?.onPathIndex ?? -1;

    $: now = read && data ? climbNow(read.climbs, data, onPathIndex) : null;
    $: steep = read && data ? steepNow(read.steep, data, onPathIndex) : null;

    // the chart is cut to the climb, and only moves for another one: the position moves on it
    let range: { fromIndex: number; toIndex: number } = null;
    let rangeKey = '';
    $: {
        const key = now ? `${now.climb.startIndex}:${now.climb.endIndex}` : 'none';
        if (key !== rangeKey || (!now && onPathIndex >= 0 && range && onPathIndex > range.toIndex)) {
            rangeKey = key;
            const ahead = now ? null : profileAhead(profile, onPathIndex, NO_CLIMB_SPAN);
            range = now ? { fromIndex: now.climb.startIndex, toIndex: now.climb.endIndex } : ahead ? { fromIndex: ahead.fromIndex, toIndex: ahead.toIndex } : null;
        }
    }

    // the road ahead, not the vertex underfoot: a single point grade jumps around far too much to read
    $: grade = data ? gradeAhead(data, onPathIndex, $navigationGradeLookAhead) : null;
    $: gradeText = grade === null || grade === undefined ? '-' : (grade > 0 ? '+' : '') + grade.toFixed(grade > -10 && grade < 10 ? 1 : 0);
    // the eink screen collapses every bucket to the same grey, so the figure carries the meaning there
    $: gradeValueColor = isEInk || grade === null || grade === undefined ? colorOnSurface : gradeColor(grade);

    $: category = now?.climb.category ? categoryLabel(now.climb.category) : null;
    $: title = [now?.mode === 'next' ? lc('navigation_next_climb') : lc('navigation_page_climb'), category].filter(Boolean).join(' · ');
    // nothing to say when there is no climb to speak of: no filler
    $: detail = !now
        ? ''
        : now.mode === 'on'
          ? `${formatDistance(now.distance)} · +${convertElevation(now.gain)} ${lc('navigation_to_the_top')}`
          : lc('navigation_value_in', `+${convertElevation(now.gain)}`, formatDistance(now.distance));
    $: steepText = steep ? (steep.inside ? lc('navigation_steep_left', `${Math.abs(steep.grade).toFixed(0)} %`, formatDistance(steep.distance)) : lc('navigation_value_in', `${Math.abs(steep.grade).toFixed(0)} %`, formatDistance(steep.distance))) : '';

    // the profile is read in the lens the map is in; a tap goes to the next one
    $: ({ fade, fill, overlay } = $dockLens);

    let elevationChart: ElevationChart;
    const followProgress = progressFollower();
    $: followProgress(elevationChart, $navigationProgress, profile, !!data?.length);
</script>

{#if data?.length}
    <gridlayout {height} rows="auto,*" {...$$restProps}>
        <NavigationPageHeader {detail} {title} />
        <gridlayout columns="auto,*" row={1}>
            <stacklayout paddingRight={12} verticalAlignment="center" width={Math.round(92 * $navigationScale)}>
                <label maxLines={1}>
                    <cspan color={gradeValueColor} fontSize={26 * $navigationScale} fontWeight="bold" text={gradeText} />
                    <cspan color={colorOnSurfaceVariant} fontSize={15 * $navigationScale} text=" %" />
                </label>
                <label color={isEInk ? colorOnSurface : colorError} fontSize={12 * $navigationScale} fontWeight="500" lineBreak="end" maxLines={1} text={steepText} />
            </stacklayout>
            <ElevationChart
                bind:this={elevationChart}
                col={1}
                {fade}
                {fill}
                filled={!isEInk}
                item={$navigationItem}
                mini={true}
                {overlay}
                {range}
                showAscents={false}
                showProfileGrades={true}
                showWaypoints={false} />
            <!-- over the chart, which a tap would not reach: the lens changes -->
            <gridlayout col={1} on:tap={nextDockLens} />
        </gridlayout>
    </gridlayout>
{/if}
