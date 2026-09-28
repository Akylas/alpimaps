<script context="module" lang="ts">
    import { Align, Canvas, CanvasView, LayoutAlignment, Paint, StaticLayout } from '@nativescript-community/ui-canvas';

    const stripPaint = new Paint();
    stripPaint.setTextAlign(Align.LEFT);
</script>

<script lang="ts">
    import { lc } from '@nativescript-community/l';
    import { createNativeAttributedString } from '@nativescript-community/text';
    import { NativeViewElementNode } from '@nativescript-community/svelte-native/dom';
    import NavigationCard from '~/components/navigation/NavigationCard.svelte';
    import NavigationControls from '~/components/navigation/NavigationControls.svelte';
    import NavigationElevationChart from '~/components/navigation/NavigationElevationChart.svelte';
    import NavigationActions from '~/components/navigation/NavigationActions.svelte';
    import NavigationInfo from '~/components/navigation/NavigationInfo.svelte';
    import NavigationSurface from '~/components/navigation/NavigationSurface.svelte';
    import { convertElevation, formatDistance } from '~/helpers/formatter';
    import { formatTime } from '~/helpers/locale';
    import { onThemeChanged } from '~/helpers/theme';
    import { DismissReasons } from '@nativescript-community/ui-material-snackbar';
    import type { EventData } from '@nativescript/core';
    import { onDestroy } from 'svelte';
    import { NavigationReroutedEvent, navigationService } from '~/services/NavigationService';
    import {
        NavigationState,
        navigationHasPreviewWidgets,
        navigationItem,
        navigationProgress,
        navigationScale,
        navigationShowElevationChart,
        navigationShowSurface,
        navigationState,
        navigationStats
    } from '~/stores/navigationStore';
    import { showSnack } from '~/utils/ui';
    import {
        NAVACTIONS_HEIGHT,
        NAVSTATS_HEIGHT,
        NAVWIDGET_ROW_HEIGHT,
        ROUTE_PROFILE_HEIGHT,
        ROUTE_STATS_HEIGHT,
        type RouteProgress,
        formatNavigationDuration,
        formatSpeed,
        getCurrentAscent,
        splitDistance,
        splitDuration,
        splitElevation
    } from '~/utils/navigation';
    import ElevationChart from '~/components/chart/ElevationChart.svelte';
    import RouteStatsView from '~/components/bottomsheet/RouteStatsView.svelte';
    import { CARD_RADIUS } from '~/components/navigation/NavigationCard.svelte';
    import { chartShowWaypoints, showAscents, showGradeColors } from '~/stores/mapStore';
    import { colors, fonts } from '~/variables';

    $: ({ colorOnSurfaceVariant, colorOutlineVariant, colorPrimary, colorWidgetBackground } = $colors);

    $: paused = $navigationState === NavigationState.PAUSED;

    async function onRerouted(event: EventData & { data?: { auto: boolean } }) {
        if (!event.data?.auto) {
            return;
        }
        const result = await showSnack({ message: lc('navigation_rerouted'), actionText: lc('navigation_undo_reroute'), hideDelay: 10000 });
        if (result?.reason === DismissReasons.ACTION) {
            navigationService.undoReroute();
        }
    }
    navigationService.on(NavigationReroutedEvent, onRerouted);
    onDestroy(() => navigationService.off(NavigationReroutedEvent, onRerouted));
    $: secondRow = !paused && $navigationHasPreviewWidgets;
    // off route keeps every row: the sheet steps are fixed
    $: compact = paused;
    // must scale like the sheet steps, else the bar clips or leaves a gap over the map
    $: widgetRowHeight = Math.round(NAVWIDGET_ROW_HEIGHT * $navigationScale);
    $: barRows = compact ? '0,0,*' : `${widgetRowHeight},${secondRow ? widgetRowHeight : 0},${Math.round(NAVSTATS_HEIGHT * $navigationScale)}`;
    /** the actions step, sized exactly like the sheet reserves it (see `navigationSheetSteps`) */
    $: actionsHeight = Math.round(NAVACTIONS_HEIGHT * $navigationScale);
    $: contentRow = compact ? 2 : secondRow ? 1 : 0;

    $: remainingDistance = $navigationProgress?.remainingDistance;
    $: remainingTime = $navigationProgress?.remainingTime;
    $: eta = remainingTime > 0 ? formatTime(Date.now() + remainingTime * 1000) : null;

    // profile dp is the ascent accumulated up to each point
    $: profile = $navigationItem?.profile;
    $: pointData = profile?.data?.[$navigationProgress?.onPathIndex];
    $: remainingAscent = profile && pointData && !isNaN(pointData.dp) ? profile.dplus - pointData.dp : null;
    $: currentAscent = getCurrentAscent(profile, $navigationProgress?.onPathIndex ?? -1);

    $: elapsed = $navigationStats?.duration;
    $: distanceParts = remainingDistance > 0 ? splitDistance(remainingDistance) : null;
    $: ascentParts = remainingAscent > 0 ? splitElevation(remainingAscent) : null;
    $: currentAscentParts = currentAscent?.remainingGain > 0 ? splitElevation(currentAscent.remainingGain) : null;
    $: durationParts = $navigationStats ? splitDuration((elapsed || 0) / 1000) : null;

    let stripCanvas: NativeViewElementNode<CanvasView>;
    let stripString;
    let elevationChart: ElevationChart;

    $: profileAvailable = !!profile?.data?.length;
    $: statsAvailable = !!$navigationItem?.stats;
    $: if ($navigationProgress && profileAvailable) {
        highlightChart($navigationProgress);
    }

    function highlightChart(progress: RouteProgress) {
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

    $: stripString = buildStripString(remainingTime, eta, $navigationStats, colorPrimary, $fonts);
    $: if (stripString !== undefined) {
        stripCanvas?.nativeView?.invalidate();
    }
    onThemeChanged(() => stripCanvas?.nativeView?.invalidate());

    function buildStripString(remainingTime, eta, stats, colorPrimary, fonts) {
        const spans = [];
        const addIcon = (icon: string) => spans.push({ fontFamily: fonts.mdi, color: colorPrimary, text: icon });
        if (remainingTime > 0) {
            addIcon('mdi-timer-outline');
            spans.push({ text: ' ' + formatNavigationDuration(remainingTime) + '   ' });
        }
        if (eta) {
            addIcon('mdi-flag-checkered');
            spans.push({ text: ' ' + eta + '   ' });
        }
        if (stats) {
            addIcon('mdi-arrow-left-right');
            spans.push({ text: ' ' + formatDistance(stats.distance) + '   ' });
            addIcon('mdi-speedometer');
            spans.push({ text: ' ' + formatSpeed(stats.averageSpeed) + '   ' });
            addIcon('mdi-arrow-top-right');
            spans.push({ text: ' ' + convertElevation(stats.altitudeGain) });
        }
        return spans.length ? createNativeAttributedString({ spans }) : null;
    }

    function onDrawStrip({ canvas }: { canvas: Canvas; object: CanvasView }) {
        if (!stripString) {
            return;
        }
        stripPaint.color = colorOnSurfaceVariant;
        stripPaint.textSize = 12 * $navigationScale;
        const staticLayout = new StaticLayout(stripString, stripPaint, canvas.getWidth(), LayoutAlignment.ALIGN_NORMAL, 1, 0, true);
        canvas.save();
        canvas.translate(0, (canvas.getHeight() - staticLayout.getHeight()) / 2);
        staticLayout.draw(canvas);
        canvas.restore();
    }
</script>

<gridlayout columns="*,auto" rows={`${barRows},${actionsHeight},${profileAvailable ? ROUTE_PROFILE_HEIGHT : 0},${statsAvailable ? ROUTE_STATS_HEIGHT : 0}`} {...$$restProps}>
    {#if compact}
        <NavigationCard horizontalAlignment="left" marginBottom={6} marginLeft={8} padding="4 12 4 12" row={contentRow} verticalAlignment="bottom">
            <label color={colorOnSurfaceVariant} fontSize={15 * $navigationScale} text={lc('navigation_paused')} verticalTextAlignment="center" />
        </NavigationCard>
    {:else}
        <flexlayout alignItems="flex-end" colSpan={secondRow ? 2 : 1} flexDirection="row" marginLeft={8}>
            <NavigationInfo icon="mdi-map-marker-distance" marginBottom={6} marginRight={8} unit={distanceParts?.[1]} value={distanceParts ? distanceParts[0] + '' : '-'} />
            <NavigationInfo
                icon="mdi-timer-outline"
                marginBottom={6}
                marginRight={8}
                unit={durationParts?.[1]}
                value={durationParts?.[0] ?? '-'}
                visibility={$navigationStats ? 'visible' : 'collapse'} />
            <NavigationInfo
                icon="mdi-arrow-top-right"
                marginBottom={6}
                marginRight={8}
                unit={ascentParts?.[1]}
                value={ascentParts ? ascentParts[0] + '' : '-'}
                visibility={ascentParts ? 'visible' : 'collapse'} />
            <NavigationInfo
                icon="mdi-summit"
                marginBottom={6}
                marginRight={8}
                unit={(currentAscentParts?.[1] ?? '') + (currentAscent ? ' · ' + formatDistance(currentAscent.remainingDistance) : '')}
                value={currentAscentParts ? currentAscentParts[0] + '' : '-'}
                visibility={currentAscentParts ? 'visible' : 'collapse'} />
        </flexlayout>

        {#if secondRow}
            <gridlayout columns="3*,2*" marginLeft={8} row={1}>
                {#if $navigationShowElevationChart}
                    <NavigationElevationChart marginBottom={6} marginRight={8} />
                {/if}
                {#if $navigationShowSurface}
                    <NavigationSurface col={$navigationShowElevationChart ? 1 : 0} marginBottom={6} marginRight={8} />
                {/if}
            </gridlayout>
        {/if}
    {/if}

    {#if !paused}
        <NavigationCard colSpan={2} margin="4 8 0 8" padding="2 10 2 10" row={2}>
            <canvasview bind:this={stripCanvas} on:draw={onDrawStrip} />
        </NavigationCard>
    {/if}

    <NavigationControls col={1} marginBottom={6} marginRight={8} row={contentRow} verticalAlignment="bottom" />

    <NavigationActions colSpan={2} margin="4 8 0 8" row={3} />
    {#if profileAvailable}
        <ElevationChart
            bind:this={elevationChart}
            backgroundColor={colorWidgetBackground}
            borderColor={colorOutlineVariant}
            borderRadius={CARD_RADIUS}
            {chartShowWaypoints}
            colSpan={2}
            item={$navigationItem}
            margin="4 8 0 8"
            row={4}
            showAscents={$showAscents}
            showProfileGrades={$showGradeColors} />
    {/if}
    {#if statsAvailable}
        <RouteStatsView backgroundColor={colorWidgetBackground} borderColor={colorOutlineVariant} borderRadius={CARD_RADIUS} colSpan={2} item={$navigationItem} margin="4 8 0 8" row={5} />
    {/if}
</gridlayout>
