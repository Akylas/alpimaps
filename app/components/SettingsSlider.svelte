<script lang="ts" context="module">
    import { Align, Canvas, CanvasView, Paint } from '@nativescript-community/ui-canvas';
    import { NativeViewElementNode } from 'svelte-native/dom';
    import { mdiFontFamily, textColor, widgetBackgroundColor } from '~/variables';
    let iconPaint: Paint;
    let textPaint: Paint;
</script>

<script lang="ts">
    export let icon: string = null;
    export let title: string = null;
    export let min = 0;
    export let max = 1;
    export let step = null;
    export let value = 0;
    export let onChange = null;
    export let formatter = (value) => value + '';
    export let valueFormatter = (value) => value.toFixed(1);
    let canvas: NativeViewElementNode<CanvasView>;

    function onValueChange(event) {
        value = event.value;
        if (onChange) {
            onChange(event.value);
        }
        canvas?.nativeView.invalidate();
    }
    function onDraw({ canvas, object }: { canvas: Canvas; object: CanvasView }) {
        try {
            let w = canvas.getWidth();
            let h = canvas.getHeight();
            let leftPadding = 10;
            let topPadding = 30;
            if (icon) {
                if (!iconPaint) {
                    iconPaint = new Paint();
                    iconPaint.textSize = 24;
                    iconPaint.fontFamily = mdiFontFamily;
                }
                iconPaint.color = $textColor;
                canvas.drawText(icon, leftPadding, topPadding+ 5, iconPaint);
                leftPadding += 40;
            }
            if (!textPaint) {
                textPaint = new Paint();
                textPaint.textSize = 15;
            }
            textPaint.color = $textColor;
            textPaint.setTextAlign(Align.LEFT);
            if (title) {
                canvas.drawText(title, leftPadding, topPadding, textPaint);
            }
            canvas.drawText(formatter(min), 10, h - 20, textPaint);
            textPaint.setTextAlign(Align.RIGHT);
            canvas.drawText(valueFormatter(value), w-10, topPadding, textPaint);
            canvas.drawText(formatter(max), w-10, h - 20, textPaint);
        } catch (err) {
            console.error(err);
        }
    }
</script>

<gridLayout {...$$restProps} height={80}>
    <canvas bind:this={canvas} on:draw={onDraw} />
    <slider {value} on:valueChange={onValueChange} minValue={min} maxValue={max} stepSize={step} verticalAlignment="bottom" margin="0 60 0 60" />
</gridLayout>
