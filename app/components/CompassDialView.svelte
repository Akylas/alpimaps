<script lang="ts" context="module">
    import { Align, Canvas, CanvasView, Paint, Path, Rect, Style } from '@nativescript-community/ui-canvas';
    import { NativeViewElementNode } from 'svelte-native/dom';
    import { lu } from '~/helpers/locale';
    import { TO_RAD } from '~/utils/geo';
    import { primaryColor } from '~/variables';
    function dialTicks(center: { x; y }, radius: number, tickLength: number, spacing: number, start: number = 0, end: number = 360, path: Path = new Path()): Path {
        path.reset();
        for (let angle = start; angle <= end; angle += spacing) {
            if (angle == end && start == end) {
                continue;
            }
            const tickX = Math.cos(TO_RAD * angle);
            const tickY = Math.sin(TO_RAD * angle);
            path.moveTo(center.x + tickX * (radius - tickLength), center.y + tickY * (radius - tickLength));
            path.lineTo(center.x + tickX * radius, center.y + tickY * radius);
        }
        return path;
    }

    const textSize = 30;
    const paint = new Paint();
    paint.setStyle(Style.FILL);
    const textPaint = new Paint();
    textPaint.color = 'white';
    textPaint.textSize = textSize;
    textPaint.setTextAlign(Align.CENTER);
    const rect = new Rect(0, 0, 0, 0);
    textPaint.getTextBounds('N', 0, 1, rect);
    const textHeight = rect.height();
</script>

<script lang="ts">
    export let backgroundColor = '#171717';
    export let tickColor = 'white';
    export let cardinalTickColor = primaryColor;
    export let onDraw: (event: { canvas: Canvas; object: CanvasView; delta: number }) => void = null;

    let canvas: NativeViewElementNode<CanvasView>;
    const tickThicknessDp = 1;
    const tickLengthPercent = 0.03;
    const tickRadiusPercent = 0.9;
    const borderStrokedWidth = 1.5;
    let ticks;
    let cardinalTicks;

    function refreshGeometries() {
        ticks = null;
        cardinalTicks = null;
        canvas?.nativeView?.invalidate();
    }

    function draw({ canvas, object }: { canvas: Canvas; object: CanvasView }) {
        try {
            const width = canvas.getWidth();
            const height = canvas.getHeight();

            const compassSize = Math.min(height, width);
            const delta = 10;
            const radius = compassSize / 2 - delta;
            const center = { x: width / 2, y: height / 2 };
            const tickDelta = 30;
            if (!ticks) {
                ticks = dialTicks(center, tickRadiusPercent * radius, tickLengthPercent * radius, 15);
            }
            if (!cardinalTicks) {
                cardinalTicks = dialTicks(center, tickRadiusPercent * radius, tickLengthPercent * radius * 2, 45);
            }

            paint.color = backgroundColor;
            paint.setStyle(Style.FILL);
            canvas.drawCircle(center.x, center.y, radius, paint);
            paint.color = backgroundColor;

            paint.setStyle(Style.STROKE);
            paint.strokeWidth = 3;
            paint.color = tickColor;

            paint.setAlpha(100);

            // canvas.drawCircle(center.x, center.y, 16, paint);
            canvas.drawCircle(center.x, center.y, radius - borderStrokedWidth, paint);

            paint.strokeWidth = tickThicknessDp;
            paint.setAlpha(255);
            canvas.drawPath(ticks, paint);
            paint.strokeWidth = tickThicknessDp * 2;
            paint.color = cardinalTickColor;
            // paint.setStrokeCap(Cap.ROUND)
            canvas.drawPath(cardinalTicks, paint);

            textPaint.setTextAlign(Align.CENTER);

            // canvas.drawRect(center.x - 10, center.y - radius, center.x + 10, center.y - radius + tickDelta, textPaint);

            canvas.drawText(lu('N'), center.x, center.y - radius + textHeight + tickDelta, textPaint);

            // canvas.drawRect(center.x - 10, center.y + radius  - tickDelta, center.x + 10, center.y + radius, textPaint);

            canvas.drawText(lu('S'), center.x, center.y + radius - tickDelta, textPaint);
            textPaint.setTextAlign(Align.LEFT);
            canvas.drawText(lu('W'), center.x - radius + textSize, center.y + textHeight / 2, textPaint);
            textPaint.setTextAlign(Align.RIGHT);
            canvas.drawText(lu('E'), center.x + radius - textSize, center.y + textHeight / 2, textPaint);

            onDraw?.({ canvas, object, delta: delta + borderStrokedWidth });
        } catch (error) {
            console.error(error);
        }
    }
</script>

<canvas bind:this={canvas} on:draw={draw} on:layoutChanged={refreshGeometries} {...$$restProps} />
