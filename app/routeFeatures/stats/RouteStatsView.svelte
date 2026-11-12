<script context="module" lang="ts">
    import { Align, Canvas, CanvasView, Direction, Paint, Path, Style } from '@nativescript-community/ui-canvas';
    import { ApplicationSettings } from '@nativescript/core';

    const barPaint = new Paint();
    barPaint.strokeWidth = 2;
    const outlinePaint = new Paint();
    outlinePaint.style = Style.STROKE;
    outlinePaint.strokeWidth = 1;
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
    import { colors } from '~/variables';
    import IconButton from '~/components/common/IconButton.svelte';
    import { shadeGrey } from '~/routeFeatures/lens/shades';
    import { STATS_LEGEND_ROW, STATS_LEGEND_TOP, surfaceShade } from '~/routeFeatures/stats/surfaces';
    import { liveRouteFeatures, routeStatViews } from '~/routeFeatures/registry';

    export let item: IItem;

    $: ({ colorOnSurface, colorOnSurfaceVariant, colorPrimary } = $colors);

    let statsCanvas: NativeViewElementNode<CanvasView>;
    let savedKey = ApplicationSettings.getString('stats_key', 'waytypes');

    // the way types and the surfaces, then what the features have to say of the route
    $: extraViews = routeStatViews($liveRouteFeatures, { item });
    $: viewIds = ['waytypes', 'surfaces', ...extraViews.map((view) => view.id)];
    // a view that is gone (another route, a feature switched off) leaves the first one
    $: statsKey = viewIds.includes(savedKey) ? savedKey : 'waytypes';
    $: viewIndex = viewIds.indexOf(statsKey);

    $: if (item || extraViews) {
        statsCanvas?.nativeView?.invalidate();
    }
    onThemeChanged(() => statsCanvas?.nativeView?.invalidate());

    function setStatsKey(value: string) {
        savedKey = value;
        statsKey = value;
        ApplicationSettings.setString('stats_key', value);
        statsCanvas?.nativeView?.invalidate();
    }

    /** a line of the view being read: the way types and surfaces carry their id, a feature's view the whole of it */
    interface StatLine {
        id: string;
        perc: number;
        dist: number;
        label: string;
        color: string;
        eink: string;
    }
    function linesOf(key: string): StatLine[] {
        const extra = extraViews.find((view) => view.id === key);
        if (extra) {
            return extra.rows({ item });
        }
        return (item.stats[key] ?? []).map((stat) => ({ ...stat, label: lc(stat.id), color: surfaceColors[stat.id] || '#000000', eink: shadeGrey(surfaceShade(stat.id)) }));
    }
    const titleOf = (key: string) => extraViews.find((view) => view.id === key)?.title() ?? lc(key);

    const BAR_TOP = 38;
    const BAR_HEIGHT = 10;
    const LEGEND_TOP = STATS_LEGEND_TOP;
    const LEGEND_ROW = STATS_LEGEND_ROW;
    const PADDING = 16;

    // a stacked bar with a gap between segments, then a two column legend read in rows: dot, name, length
    function drawStats({ canvas }: { canvas: Canvas; object: CanvasView }) {
        try {
            if (!item?.stats) {
                return;
            }
            const w = canvas.getWidth();
            const h = canvas.getHeight();
            const stats = linesOf(statsKey);

            bigTextPaint.color = isEInk ? colorOnSurface : colorPrimary;
            canvas.drawText(titleOf(statsKey), PADDING, 26, bigTextPaint);

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
                // on e-ink a kind is a shade of grey, as it is under the profile
                barPaint.color = isEInk ? stat.eink : stat.color;
                canvas.drawRect(x, BAR_TOP, segmentRight, BAR_TOP + BAR_HEIGHT, barPaint);
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
                barPaint.color = isEInk ? stat.eink : stat.color;
                canvas.drawCircle(left + 4.5, baseline - 4.5, 4.5, barPaint);
                if (isEInk) {
                    // a light grey would vanish on the paper: its outline stays
                    outlinePaint.color = colorOnSurface;
                    canvas.drawCircle(left + 4.5, baseline - 4.5, 4.5, outlinePaint);
                }
                textPaint.color = colorOnSurfaceVariant;
                canvas.drawText(stat.label, left + 15, baseline, textPaint);
                valuePaint.color = colorOnSurface;
                canvas.drawText(formatDistance(stat.dist * 1000), right, baseline, valuePaint);
            });
        } catch (error) {
            console.error(error, error.stack);
        }
    }
</script>

<canvasview bind:this={statsCanvas} {...$$restProps} on:draw={drawStats}>
    <!-- a button that has nothing to go to is gone, not disabled: one disabled while it is pressed keeps its pressed look -->
    {#if viewIndex < viewIds.length - 1}
        <IconButton fontSize={18} horizontalAlignment="right" marginRight={4} marginTop={4} size={36} text="mdi-chevron-right" verticalAlignment="top" on:tap={() => setStatsKey(viewIds[viewIndex + 1])} />
    {/if}
    {#if viewIndex > 0}
        <IconButton fontSize={18} horizontalAlignment="right" marginRight={40} marginTop={4} size={36} text="mdi-chevron-left" verticalAlignment="top" on:tap={() => setStatsKey(viewIds[viewIndex - 1])} />
    {/if}
</canvasview>
