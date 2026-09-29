<script context="module" lang="ts">
    import { Align, Canvas, CanvasView, Direction, Paint, Path, Style } from '@nativescript-community/ui-canvas';
    import { ApplicationSettings } from '@nativescript/core';

    const barPaint = new Paint();
    barPaint.strokeWidth = 2;
    const textPaint = new Paint();
    textPaint.textSize = 13;
    // the .sectionHeader look
    const bigTextPaint = new Paint();
    bigTextPaint.textSize = 13;
    bigTextPaint.fontWeight = 'bold';
</script>

<script lang="ts">
    import { NativeViewElementNode } from '@nativescript-community/svelte-native/dom';
    import { formatDistance } from '~/helpers/formatter';
    import { lc } from '~/helpers/locale';
    import { isEInk, onThemeChanged } from '~/helpers/theme';
    import type { IItem } from '~/models/Item';
    import { surfaceColors } from '~/utils/routing';
    import { drawSurfaceBand } from '~/utils/surfacePattern';
    import { colors } from '~/variables';
    import IconButton from '../common/IconButton.svelte';

    export let item: IItem;

    $: ({ colorOnSurface, colorOnSurfaceVariant, colorPrimary, colorSurfaceContainerHigh } = $colors);

    let statsCanvas: NativeViewElementNode<CanvasView>;
    let statsKey = ApplicationSettings.getString('stats_key', 'waytypes');

    $: if (item) {
        statsCanvas?.nativeView?.invalidate();
    }
    onThemeChanged(() => statsCanvas?.nativeView?.invalidate());

    function setStatsKey(value) {
        statsKey = value;
        ApplicationSettings.setString('stats_key', value);
        statsCanvas?.nativeView?.invalidate();
    }

    const BAR_TOP = 40;
    const BAR_HEIGHT = 12;
    const LEGEND_TOP = 72;
    const LEGEND_ROW = 22;
    const PADDING = 16;

    // a stacked bar with a gap between segments, then a two column legend: dot, name, length
    function drawStats({ canvas }: { canvas: Canvas; object: CanvasView }) {
        try {
            if (!item?.stats) {
                return;
            }
            const w = canvas.getWidth();
            const h = canvas.getHeight();
            const stats = item.stats[statsKey];
            // On eink the surface palette renders as indistinguishable greys, so surfaces are hatched.
            // Not reactive: `setStatsKey` invalidates the canvas before svelte flushes derived values.
            const patterned = isEInk && statsKey === 'surfaces';

            bigTextPaint.color = isEInk ? colorOnSurface : colorPrimary;
            canvas.drawText(lc(statsKey), PADDING, 26, bigTextPaint);

            const usedWidth = w - PADDING * 2;
            const barClip = new Path();
            barClip.addRoundRect(PADDING, BAR_TOP, w - PADDING, BAR_TOP + BAR_HEIGHT, BAR_HEIGHT / 2, BAR_HEIGHT / 2, Direction.CW);
            canvas.save();
            canvas.clipPath(barClip);
            let x = PADDING;
            stats.forEach((stat, index) => {
                const right = index === stats.length - 1 ? w - PADDING : x + stat.perc * usedWidth;
                // the gap, so neighbouring greys stay apart
                const segmentRight = index === stats.length - 1 ? right : Math.max(x, right - 2);
                barPaint.style = Style.FILL;
                barPaint.color = surfaceColors[stat.id] || '#000000';
                if (patterned) {
                    drawSurfaceBand(canvas, {
                        id: stat.id,
                        left: x,
                        right: segmentRight,
                        top: BAR_TOP,
                        bottom: BAR_TOP + BAR_HEIGHT,
                        fillColor: colorSurfaceContainerHigh,
                        patternColor: colorOnSurface
                    });
                } else {
                    canvas.drawRect(x, BAR_TOP, segmentRight, BAR_TOP + BAR_HEIGHT, barPaint);
                }
                x = right;
            });
            canvas.restore();

            const columnWidth = usedWidth / 2;
            const rowsPerColumn = Math.max(1, Math.floor((h - LEGEND_TOP) / LEGEND_ROW));
            stats.forEach((stat, index) => {
                const column = index < rowsPerColumn ? 0 : 1;
                const row = index - column * rowsPerColumn;
                if (column > 1 || row >= rowsPerColumn) {
                    return;
                }
                const left = PADDING + column * columnWidth + (column ? 12 : 0);
                const right = PADDING + (column + 1) * columnWidth - (column ? 0 : 12);
                const baseline = LEGEND_TOP + row * LEGEND_ROW + 14;
                barPaint.color = surfaceColors[stat.id] || '#000000';
                if (patterned) {
                    drawSurfaceBand(canvas, { id: stat.id, left, right: left + 10, top: baseline - 10, bottom: baseline, fillColor: colorSurfaceContainerHigh, patternColor: colorOnSurface });
                } else {
                    canvas.drawCircle(left + 5, baseline - 5, 5, barPaint);
                }
                textPaint.setTextAlign(Align.LEFT);
                textPaint.fontWeight = 'normal';
                textPaint.color = colorOnSurfaceVariant;
                canvas.drawText(lc(stat.id), left + 16, baseline, textPaint);
                textPaint.setTextAlign(Align.RIGHT);
                textPaint.fontWeight = 'bold';
                textPaint.color = colorOnSurface;
                canvas.drawText(formatDistance(stat.dist * 1000), right, baseline, textPaint);
            });
        } catch (error) {
            console.error(error, error.stack);
        }
    }
</script>

<canvasview bind:this={statsCanvas} {...$$restProps} on:draw={drawStats}>
    <IconButton
        fontSize={20}
        horizontalAlignment="right"
        isEnabled={statsKey === 'waytypes'}
        marginRight={4}
        size={40}
        text="mdi-chevron-right"
        verticalAlignment="top"
        on:tap={() => setStatsKey('surfaces')} />
    <IconButton
        fontSize={20}
        horizontalAlignment="right"
        isEnabled={statsKey === 'surfaces'}
        marginRight={44}
        size={40}
        text="mdi-chevron-left"
        verticalAlignment="top"
        on:tap={() => setStatsKey('waytypes')} />
</canvasview>
