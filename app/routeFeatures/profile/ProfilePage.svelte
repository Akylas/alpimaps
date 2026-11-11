<script lang="ts">
    // dock page: the next stretch of route as a profile, graded, with what needs attention marked under it
    import { lc } from '@nativescript-community/l';
    import ElevationChart from '~/components/chart/ElevationChart.svelte';
    import NavigationPageHeader from '~/components/navigation/NavigationPageHeader.svelte';
    import { convertElevation, formatDistance } from '~/helpers/formatter';
    import { isEInk } from '~/helpers/theme';
    import { PROFILE_AHEAD_SPAN, profileAhead } from '~/routeFeatures/profile/ahead';
    import { type ProfileMark, routeAttention, routeFeatureChanges, routeFeatures } from '~/routeFeatures/registry';
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

    // the marks, the same array until they change: the chart redraws for a new one
    const NO_MARKS: ProfileMark[] = [];
    $: attention = $routeFeatureChanges >= 0 ? routeAttention($routeFeatures, { item: $navigationItem }) : [];
    let marks = NO_MARKS;
    let marksKey = '';
    $: {
        const key = attention.map(({ color, kind, section }) => `${kind}:${color}:${section.i0}:${section.i1}`).join();
        if (key !== marksKey) {
            marksKey = key;
            const data = profile?.data;
            marks = data && attention.length ? attention.map(({ color, kind, section }) => ({ from: data[section.i0].d, to: data[section.i1].d, kind, color })) : NO_MARKS;
        }
    }

    // the first thing to watch in the stretch
    $: next = ahead && attention.map(({ kind, section }) => ({ kind, i0: Math.max(section.i0, ahead.fromIndex), i1: section.i1 })).filter(({ i0, i1 }) => i1 > ahead.fromIndex && i0 <= ahead.toIndex).sort((first, second) => first.i0 - second.i0)[0];
    $: headline = ahead
        ? [
              ahead.ascent > 0 ? '↗ ' + convertElevation(ahead.ascent) : null,
              ahead.climbs > 0 ? (ahead.climbs === 1 ? lc('navigation_climb_one') : lc('navigation_climbs_n', ahead.climbs)) : null,
              next ? lc(next.kind === 'fast' ? 'navigation_attention_fast' : 'navigation_attention_steep', (profile.data[next.i0].d / 1000).toFixed(1)) : null
          ]
              .filter(Boolean)
              .join(' · ')
        : '';

    // the service already walked the polyline for this fix, so the chart just follows its result. The
    // marker only moves with the index, so a fix that lands on the same vertex is not worth a redraw
    let highlightedIndex = -2;
    $: highlightIfMoved($navigationProgress, available);

    function highlightIfMoved(progress, chartAvailable: boolean) {
        if (!progress || !chartAvailable || progress.onPathIndex === highlightedIndex) {
            return;
        }
        highlightedIndex = progress.onPathIndex;
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
    <gridlayout {height} rows="auto,*" {...$$restProps}>
        <NavigationPageHeader detail={headline} title={lc('navigation_next_distance', formatDistance(PROFILE_AHEAD_SPAN))} />
        <ElevationChart bind:this={elevationChart} filled={!isEInk} item={$navigationItem} {marks} mini={true} {range} row={1} showAscents={false} showProfileGrades={true} showWaypoints={false} />
    </gridlayout>
{/if}
