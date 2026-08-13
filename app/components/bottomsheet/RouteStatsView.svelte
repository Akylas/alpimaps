<script context="module" lang="ts">
    import { createNativeAttributedString } from '@nativescript-community/text';
    import { Canvas, CanvasView, LayoutAlignment, Paint, StaticLayout, Style } from '@nativescript-community/ui-canvas';
    import { ApplicationSettings } from '@nativescript/core';

    const barPaint = new Paint();
    barPaint.strokeWidth = 2;
    const textPaint = new Paint();
    textPaint.textSize = 13;
    const bigTextPaint = new Paint();
    bigTextPaint.textSize = 16;
    bigTextPaint.fontWeight = 'bold';
</script>

<script lang="ts">
    import { NativeViewElementNode } from '@nativescript-community/svelte-native/dom';
    import { formatDistance } from '~/helpers/formatter';
    import { lc } from '~/helpers/locale';
    import { onThemeChanged } from '~/helpers/theme';
    import type { IItem } from '~/models/Item';
    import { surfaceColors } from '~/utils/routing';
    import { colors } from '~/variables';
    import IconButton from '../common/IconButton.svelte';

    /** The waytype/surface breakdown of a route, shared by the item sheet and the navigation one. */
    export let item: IItem;

    $: ({ colorOnSurface, colorOnSurfaceVariant } = $colors);

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

    function drawStats({ canvas }: { canvas: Canvas; object: CanvasView }) {
        try {
            if (!item?.stats) {
                return;
            }
            const w = canvas.getWidth();
            const h = canvas.getHeight();

            bigTextPaint.color = colorOnSurfaceVariant;
            textPaint.color = colorOnSurface;

            const usedWidth = w - 20;
            let x = 10;
            let labelx = 13;
            let labely = 95;
            const stats = item.stats[statsKey];
            canvas.drawText(lc(statsKey), labelx, 20, bigTextPaint);
            const nbColumns = Math.max(1, Math.round(stats.length / Math.floor((h - 95) / 20)));
            const availableWidth = usedWidth / nbColumns - 15;
            let nString, text, text2, layoutHeight, staticLayout;
            stats.forEach((s) => {
                const rigthX = x + s.perc * usedWidth;
                barPaint.color = 'white';
                barPaint.style = Style.STROKE;
                canvas.drawRect(x, 35, rigthX, 75, barPaint);
                barPaint.color = surfaceColors[s.id] || '#000000';
                barPaint.style = Style.FILL;
                canvas.drawRect(x, 35, rigthX, 75, barPaint);
                x = rigthX;
                text = lc(s.id);
                text2 = formatDistance(s.dist * 1000);
                canvas.drawCircle(labelx + 3, labely - 4, 6, barPaint);
                nString = createNativeAttributedString({
                    spans: [
                        {
                            fontWeight: 'bold',
                            text: text + ': '
                        },
                        {
                            text: text2,
                            color: colorOnSurfaceVariant,
                            fontSize: 12
                        }
                    ]
                });
                staticLayout = new StaticLayout(nString, textPaint, availableWidth, LayoutAlignment.ALIGN_NORMAL, 1, 0, true);
                layoutHeight = staticLayout.getHeight();
                canvas.save();
                canvas.translate(labelx + 15, labely - 14);
                staticLayout.draw(canvas);
                canvas.restore();
                if (labely < h - layoutHeight) {
                    labely += layoutHeight;
                } else {
                    labely = 95;
                    labelx += usedWidth / nbColumns;
                }
            });
        } catch (error) {
            console.error(error, error.stack);
        }
    }
</script>

<canvasview bind:this={statsCanvas} {...$$restProps} on:draw={drawStats}>
    <IconButton fontSize={20} horizontalAlignment="right" isEnabled={statsKey === 'waytypes'} small={true} text="mdi-chevron-right" verticalAlignment="top" on:tap={() => setStatsKey('surfaces')} />
    <IconButton
        fontSize={20}
        horizontalAlignment="right"
        isEnabled={statsKey === 'surfaces'}
        marginRight={25}
        small={true}
        text="mdi-chevron-left"
        verticalAlignment="top"
        on:tap={() => setStatsKey('waytypes')} />
</canvasview>
