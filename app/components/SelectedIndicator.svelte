<script context="module" lang="ts">
    import { Align, Canvas, CanvasView, Paint } from '@nativescript-community/ui-canvas';
    import { mdiFontFamily, primaryColor } from '~/variables';
    const paint = new Paint();
    paint.color = primaryColor;
    const iconPaint = new Paint();
    iconPaint.fontFamily = mdiFontFamily;
    iconPaint.color = 'white';
    iconPaint.textSize = 16;
    iconPaint.setTextAlign(Align.CENTER);
    const radius = 10;
    const text = 'mdi-check';
</script>

<script lang="ts">
    export let selected: boolean = false;

    function onCanvasDraw({ canvas, object }: { canvas: Canvas; object: CanvasView }) {
        const w2 = canvas.getWidth() / 2;
        canvas.drawCircle(radius, radius, radius, paint);
        canvas.drawText(text, radius, radius + 6, iconPaint);
    }
</script>

<canvas disableCss={true} height={40} horizontalAlignment="left" verticalAlignment="top" visibility={selected ? 'visible' : 'hidden'} width={40} on:draw={onCanvasDraw} {...$$restProps} />
