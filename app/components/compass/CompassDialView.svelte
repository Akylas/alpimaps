<script context="module" lang="ts">
    import { Align, Canvas, CanvasView, Paint, Path, Rect, Style } from '@nativescript-community/ui-canvas';
    import { NativeViewElementNode } from 'svelte-native/dom';
    import { lu } from '~/helpers/locale';
    import { onThemeChanged } from '~/helpers/theme';
    import { TO_RAD } from '~/utils/geo';
    import { colors } from '~/variables';
    function dialTicks(center: { x; y }, radius: number, tickLength: number, spacing: number, start: number = 0, end: number = 360, path: Path = new Path()): Path {
        path.reset();
        for (let angle = start; angle <= end; angle += spacing) {
            if (angle === end && start === end) {
                continue;
            }
            const tickX = Math.cos(TO_RAD * angle);
            const tickY = Math.sin(TO_RAD * angle);
            path.moveTo(center.x + tickX * (radius - tickLength), center.y + tickY * (radius - tickLength));
            path.lineTo(center.x + tickX * radius, center.y + tickY * radius);
        }
        return path;
    }

    const textSize = 24;
    const paint = new Paint();
    paint.setStyle(Style.FILL);
    const textPaint = new Paint();
    textPaint.textSize = textSize;
    textPaint.setTextAlign(Align.CENTER);
    const rect = new Rect(0, 0, 0, 0);
    let textHeight = 0;
    let textWidth = 0;
    let fontMetrics;

    // $: {
    textPaint.textSize = textSize;
    textPaint.getTextBounds('W', 0, 1, rect);
    textHeight = rect.height();
    textWidth = rect.width();
    fontMetrics = textPaint.getFontMetrics();
    textPaint.color = '#bbb';
    // }
</script>

<script lang="ts">
    let { colorBackground, colorOnSurface, colorOutlineVariant, colorPrimary, colorSurfaceContainerHighest } = $colors;
    $: ({ colorBackground, colorOnSurface, colorOutlineVariant, colorPrimary, colorSurfaceContainerHighest } = $colors);
    // $: textPaint.color = colorOnSurface;
    export let drawInsideGrid = false;
    export let tickColor = '#888';
    export let cardinalTickColor = colorPrimary;
    export let rotation = 0;
    export let onDraw: (event: { canvas: Canvas; object: CanvasView; delta: number; radius: number; center: { x: number; y: number }; rotation: number }) => void = null;
    export let onDrawBeforeText: (event: { canvas: Canvas; object: CanvasView; delta: number; radius: number; center: { x: number; y: number }; rotation: number }) => void = null;

    export let canvas: NativeViewElementNode<CanvasView>;
    const tickThicknessDp = 2;
    const tickLengthPercent = 0.03;
    const tickRadiusPercent = 0.95;
    const borderStrokedWidth = 1.5;
    let ticks;
    let cardinalTicks;
    function refreshGeometries() {
        ticks = null;
        cardinalTicks = null;
        canvas?.nativeView?.invalidate();
    }

    function redraw(unusedArg) {
        canvas?.nativeView?.invalidate();
    }

    onThemeChanged(redraw);

    $: redraw(rotation);

    function drawText(canvas: Canvas, text: string, x: number, y: number, rotation: number) {
        if (rotation === 0) {
            canvas.drawText(text, x, y, textPaint);
        } else {
            canvas.save();
            canvas.translate(x, y - textHeight / 2);
            canvas.rotate(-rotation);
            canvas.drawText(text, 0, textHeight / 2, textPaint);
            canvas.restore();
        }
    }

    function draw({ canvas, object }: { canvas: Canvas; object: CanvasView }) {
        try {
            const width = canvas.getWidth();
            const height = canvas.getHeight();

            const compassSize = Math.min(height, width);
            const delta = 10;
            const radius = compassSize / 2 - delta;
            const center = { x: width / 2, y: height / 2 };
            const tickDelta = 20;

            if (!ticks) {
                ticks = dialTicks(center, tickRadiusPercent * radius, tickLengthPercent * radius, 15);
            }
            if (!cardinalTicks) {
                cardinalTicks = dialTicks(center, tickRadiusPercent * radius, tickLengthPercent * radius * 2, 45);
            }

            paint.color = colorBackground;
            paint.setStyle(Style.FILL);
            canvas.drawCircle(center.x, center.y, radius, paint);

            paint.color = colorBackground;

            paint.setStyle(Style.STROKE);
            paint.strokeWidth = 3;
            paint.color = tickColor;

            if (rotation !== 0) {
                canvas.translate(center.x, center.y);
                canvas.rotate(rotation);
                canvas.translate(-center.x, -center.y);
            }

            // canvas.drawCircle(center.x, center.y, 16, paint);
            canvas.drawCircle(center.x, center.y, radius - borderStrokedWidth, paint);

            if (drawInsideGrid) {
                paint.strokeWidth = 1;
                canvas.drawLine(center.x, center.y - radius, center.x, center.y + radius, paint);
                canvas.drawLine(center.x - radius, center.y, center.x + radius, center.y, paint);
                canvas.drawCircle(center.x, center.y, radius * 0.66, paint);
                canvas.drawCircle(center.x, center.y, radius * 0.33, paint);
            }

            paint.strokeWidth = tickThicknessDp;
            canvas.drawPath(ticks, paint);
            paint.strokeWidth = tickThicknessDp * 2;
            paint.color = cardinalTickColor;
            // paint.setStrokeCap(Cap.ROUND)
            canvas.drawPath(cardinalTicks, paint);

            onDrawBeforeText?.({ canvas, object, delta: delta + borderStrokedWidth, center, radius, rotation });
            drawText(canvas, lu('N'), center.x, center.y - radius + textHeight + tickDelta, rotation);
            drawText(canvas, lu('S'), center.x, center.y + radius - tickDelta, rotation);
            drawText(canvas, lu('W'), center.x - radius + textSize + textWidth / 2, center.y + textHeight / 2, rotation);
            drawText(canvas, lu('E'), center.x + radius - textSize - textWidth / 2, center.y + textHeight / 2, rotation);

            onDraw?.({ canvas, object, delta: delta + borderStrokedWidth, center, radius, rotation });
        } catch (error) {
            console.error(error, error.stack);
        }
    }
</script>

<canvasview bind:this={canvas} on:draw={draw} on:layoutChanged={refreshGeometries} {...$$restProps} />
