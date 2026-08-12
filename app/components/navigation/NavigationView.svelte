<script context="module" lang="ts">
    import { Align, Canvas, CanvasView, LayoutAlignment, Paint, StaticLayout } from '@nativescript-community/ui-canvas';

    /** the row of info cards plus the controls */
    export const NAVBAR_HEIGHT = 58;
    /** the estimates strip below it, shown at the same step so nothing is hidden by default */
    export const NAVSTATS_HEIGHT = 30;
    export const NAVVIEW_HEIGHT = NAVBAR_HEIGHT + NAVSTATS_HEIGHT;

    const stripPaint = new Paint();
    stripPaint.setTextAlign(Align.LEFT);
</script>

<script lang="ts">
    import { lc } from '@nativescript-community/l';
    import { createNativeAttributedString } from '@nativescript-community/text';
    import { NativeViewElementNode } from '@nativescript-community/svelte-native/dom';
    import NavigationCard from '~/components/navigation/NavigationCard.svelte';
    import NavigationControls from '~/components/navigation/NavigationControls.svelte';
    import NavigationInfo from '~/components/navigation/NavigationInfo.svelte';
    import { convertElevation, formatDistance } from '~/helpers/formatter';
    import { formatTime } from '~/helpers/locale';
    import { onThemeChanged } from '~/helpers/theme';
    import { NavigationState, navigationItem, navigationProgress, navigationState, navigationStats } from '~/stores/navigationStore';
    import { formatNavigationDuration, formatSpeed, splitDistance, splitDuration, splitElevation } from '~/utils/navigation';
    import { colors, fontScaleMaxed, fonts } from '~/variables';

    $: ({ colorOnSurfaceVariant, colorPrimary } = $colors);

    $: paused = $navigationState === NavigationState.PAUSED;
    $: offRoute = !paused && $navigationProgress?.onPathIndex === -1;

    $: remainingDistance = $navigationProgress?.remainingDistance;
    $: remainingTime = $navigationProgress?.remainingTime;
    // arrival time is what a user actually plans around, more than a duration
    $: eta = remainingTime > 0 ? formatTime(Date.now() + remainingTime * 1000) : null;

    // the profile stores the ascent accumulated up to each point, so what is left is the difference
    $: profile = $navigationItem?.profile;
    $: pointData = profile?.data?.[$navigationProgress?.onPathIndex];
    $: remainingAscent = profile && pointData && !isNaN(pointData.dp) ? profile.dplus - pointData.dp : null;

    $: elapsed = $navigationStats?.duration;
    $: distanceParts = remainingDistance > 0 ? splitDistance(remainingDistance) : null;
    $: ascentParts = remainingAscent > 0 ? splitElevation(remainingAscent) : null;
    $: durationParts = $navigationStats ? splitDuration((elapsed || 0) / 1000) : null;

    let stripCanvas: NativeViewElementNode<CanvasView>;
    let stripString;

    // a single attributed string on one canvas rather than a label per figure, like BottomSheetInfoView
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
        stripPaint.textSize = 12 * $fontScaleMaxed;
        const staticLayout = new StaticLayout(stripString, stripPaint, canvas.getWidth(), LayoutAlignment.ALIGN_NORMAL, 1, 0, true);
        canvas.save();
        canvas.translate(0, (canvas.getHeight() - staticLayout.getHeight()) / 2);
        staticLayout.draw(canvas);
        canvas.restore();
    }
</script>

<!-- transparent like the top banner, so the map shows between the cards -->
<gridlayout columns="*,auto" rows={`${NAVBAR_HEIGHT},${NAVSTATS_HEIGHT}`} {...$$restProps}>
    {#if paused || offRoute}
        <NavigationCard marginLeft={8} padding="4 12 4 12" verticalAlignment="center">
            <label
                color={colorOnSurfaceVariant}
                fontSize={15 * $fontScaleMaxed}
                horizontalAlignment="left"
                text={paused ? lc('navigation_paused') : lc('navigation_off_route')}
                verticalTextAlignment="center" />
        </NavigationCard>
    {:else}
        <!-- measured figures, one card each; the estimates sit in the strip below.
             flex rather than a horizontal stack: a stack stretches its first child over the whole width -->
        <flexlayout alignItems="center" flexDirection="row" marginLeft={8} verticalAlignment="center">
            <NavigationInfo caption={lc('remaining_distance')} marginRight={8} unit={distanceParts?.[1]} value={distanceParts ? distanceParts[0] + '' : '-'} />
            <NavigationInfo caption={lc('duration')} marginRight={8} unit={durationParts?.[1]} value={durationParts?.[0] ?? '-'} visibility={$navigationStats ? 'visible' : 'collapse'} />
            <NavigationInfo caption={lc('remaining_ascent')} unit={ascentParts?.[1]} value={ascentParts ? ascentParts[0] + '' : '-'} visibility={ascentParts ? 'visible' : 'collapse'} />
        </flexlayout>
    {/if}

    {#if !paused}
        <!-- one full width strip for the approximate figures, kept small on purpose -->
        <NavigationCard colSpan={2} margin="4 8 0 8" padding="2 10 2 10" row={1}>
            <canvasview bind:this={stripCanvas} on:draw={onDrawStrip} />
        </NavigationCard>
    {/if}

    <NavigationControls col={1} marginRight={8} verticalAlignment="center" />
</gridlayout>
