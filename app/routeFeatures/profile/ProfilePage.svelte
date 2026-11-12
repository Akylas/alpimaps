<script lang="ts">
    // dock page: the next stretch of route as a profile, graded, with what needs attention marked under it
    import { lc } from '@nativescript-community/l';
    import ElevationChart from '~/components/chart/ElevationChart.svelte';
    import NavigationPageHeader from '~/components/navigation/NavigationPageHeader.svelte';
    import { convertElevation, formatDistance } from '~/helpers/formatter';
    import { isEInk } from '~/helpers/theme';
    import { dockLens, nextDockLens, progressFollower } from '~/routeFeatures/lens/dockLens';
    import { PROFILE_AHEAD_SPAN, profileAhead } from '~/routeFeatures/profile/ahead';
    import { type ProfileMark, liveRouteFeatures, routeAttention } from '~/routeFeatures/registry';
    import { navigationItem, navigationProgress } from '~/stores/navigationStore';

    export let height: number = null;

    /** meters the stretch has to move by before the chart is cut again: it is cut to the stretch, a fix does not move it */
    const RANGE_STEP = 100;

    let elevationChart: ElevationChart;

    $: profile = $navigationItem?.profile;
    $: available = !!profile?.data?.length;
    $: onPathIndex = $navigationProgress?.onPathIndex ?? -1;
    $: ahead = profileAhead(profile, onPathIndex);

    let range: { fromIndex: number; toIndex: number } = null;
    $: moveRange(ahead);
    function moveRange(next: typeof ahead) {
        if (!next) {
            range = null;
            return;
        }
        const data = profile.data;
        if (!range || Math.abs(data[next.fromIndex].d - data[Math.min(range.fromIndex, data.length - 1)].d) >= RANGE_STEP || next.toIndex < range.toIndex) {
            range = { fromIndex: next.fromIndex, toIndex: next.toIndex };
        }
    }

    // the profile is read in the lens the map is in; a tap goes to the next one
    $: ({ activeLens, fade, fill, overlay } = $dockLens);

    // the marks, the same array until what is marked changes: the chart redraws for a new one
    const NO_MARKS: ProfileMark[] = [];
    $: attention = routeAttention($liveRouteFeatures, { item: $navigationItem });
    $: marksKey = `${profile?.data?.length}|` + attention.map(({ color, kind, section }) => `${kind}:${color}:${section.i0}:${section.i1}`).join();
    let marks = NO_MARKS;
    // reads `attention` and `profile` untracked: only the key says they changed
    $: if (marksKey) {
        marks = cutMarks();
    }
    function cutMarks() {
        const data = profile?.data;
        return data && attention.length ? attention.map(({ color, kind, section }) => ({ from: data[section.i0].d, to: data[section.i1].d, kind, color })) : NO_MARKS;
    }

    // the first thing to watch in the stretch
    $: next = ahead && attention.map(({ kind, section }) => ({ kind, i0: Math.max(section.i0, ahead.fromIndex), i1: section.i1 })).filter(({ i0, i1 }) => i1 > ahead.fromIndex && i0 <= ahead.toIndex).sort((first, second) => first.i0 - second.i0)[0];
    $: title = [activeLens && activeLens.id !== 'overview' ? activeLens.label() : null, lc('navigation_next_distance', formatDistance(PROFILE_AHEAD_SPAN))].filter(Boolean).join(' · ');
    $: headline = ahead
        ? [
              ahead.ascent > 0 ? '↗ ' + convertElevation(ahead.ascent) : null,
              ahead.climbs > 0 ? (ahead.climbs === 1 ? lc('navigation_climb_one') : lc('navigation_climbs_n', ahead.climbs)) : null,
              next ? lc(next.kind === 'fast' ? 'navigation_attention_fast' : 'navigation_attention_steep', (profile.data[next.i0].d / 1000).toFixed(1)) : null
          ]
              .filter(Boolean)
              .join(' · ')
        : '';

    const followProgress = progressFollower();
    $: followProgress(elevationChart, $navigationProgress, profile, available);
</script>

{#if available}
    <gridlayout {height} rows="auto,*" {...$$restProps}>
        <NavigationPageHeader detail={headline} {title} />
        <ElevationChart
            bind:this={elevationChart}
            {fade}
            {fill}
            filled={!isEInk}
            item={$navigationItem}
            {marks}
            mini={true}
            {overlay}
            {range}
            row={1}
            showAscents={false}
            showProfileGrades={true}
            showWaypoints={false} />
        <!-- over the chart, which a tap would not reach: the lens changes -->
        <gridlayout row={1} on:tap={nextDockLens} />
    </gridlayout>
{/if}
