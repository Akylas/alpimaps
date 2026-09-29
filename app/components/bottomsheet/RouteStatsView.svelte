<script context="module" lang="ts">
    import { Align, Canvas, CanvasView, Direction, Paint, Path, Style } from '@nativescript-community/ui-canvas';
    import { ApplicationSettings } from '@nativescript/core';

    const barPaint = new Paint();
    barPaint.strokeWidth = 2;
    const textPaint = new Paint();
    textPaint.textSize = 12;
    const valuePaint = new Paint();
    valuePaint.textSize = 12;
    valuePaint.fontWeight = 'bold';
    valuePaint.setTextAlign(Align.RIGHT);
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

    const BAR_TOP = 38;
    const BAR_HEIGHT = 10;
    const LEGEND_TOP = 58;
    const LEGEND_ROW = 20;
    const PADDING = 16;

    // a stacked bar with a gap between segments, then a two column legend read in rows: dot, name, length
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
            const maxRows = Math.max(1, Math.floor((h - LEGEND_TOP) / LEGEND_ROW));
            stats.forEach((stat, index) => {
                const column = index % 2;
                const row = Math.floor(index / 2);
                if (row >= maxRows) {
                    return;
                }
                const left = PADDING + column * columnWidth + (column ? 12 : 0);
                const right = PADDING + (column + 1) * columnWidth - (column ? 0 : 12);
                const baseline = LEGEND_TOP + row * LEGEND_ROW + 13;
                barPaint.color = surfaceColors[stat.id] || '#000000';
                if (patterned) {
                    drawSurfaceBand(canvas, { id: stat.id, left, right: left + 9, top: baseline - 9, bottom: baseline, fillColor: colorSurfaceContainerHigh, patternColor: colorOnSurface });
                } else {
                    canvas.drawCircle(left + 4.5, baseline - 4.5, 4.5, barPaint);
                }
                textPaint.color = colorOnSurfaceVariant;
                canvas.drawText(lc(stat.id), left + 15, baseline, textPaint);
                valuePaint.color = colorOnSurface;
                canvas.drawText(formatDistance(stat.dist * 1000), right, baseline, valuePaint);
            });
        } catch (error) {
            console.error(error, error.stack);
        }
    }
</script>

<canvasview bind:this={statsCanvas} {...$$restProps} on:draw={drawStats}>
    <IconButton
        fontSize={18}
        horizontalAlignment="right"
        isEnabled={statsKey === 'waytypes'}
        marginRight={4}
        marginTop={4}
        size={36}
        text="mdi-chevron-right"
        verticalAlignment="top"
        on:tap={() => setStatsKey('surfaces')} />
    <IconButton
        fontSize={18}
        horizontalAlignment="right"
        isEnabled={statsKey === 'surfaces'}
        marginRight={40}
        marginTop={4}
        size={36}
        text="mdi-chevron-left"
        verticalAlignment="top"
        on:tap={() => setStatsKey('waytypes')} />
</canvasview>
