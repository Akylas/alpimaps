<script lang="ts" context="module">
    import { Align, Canvas, CanvasView, LayoutAlignment, Paint, StaticLayout } from '@nativescript-community/ui-canvas';
    import { NativeViewElementNode } from 'svelte-native/dom';
    import { mdiFontFamily, subtitleColor, textColor, widgetBackgroundColor } from '~/variables';
    let iconPaint: Paint;
    let textPaint: Paint;
</script>

<script lang="ts">
    export let icon: string = null;
    export let title: string = null;
    export let subtitle: string = null;
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
                canvas.drawText(icon, leftPadding, topPadding + 5, iconPaint);
                leftPadding += 40;
            }
            if (!textPaint) {
                textPaint = new Paint();
                textPaint.textSize = 15;
            }
            textPaint.color = $textColor;
            textPaint.setTextAlign(Align.LEFT);

            const valueText = valueFormatter(value);

            if (title) {
                const staticLayout = new StaticLayout(title, textPaint, canvas.getWidth(), LayoutAlignment.ALIGN_NORMAL, 1, 0, true);
                canvas.save();
                canvas.translate(leftPadding, topPadding);
                staticLayout.draw(canvas);
                canvas.restore();
                // canvas.drawText(title, leftPadding, topPadding, textPaint);
            }
            canvas.drawText(formatter(min), 10, h - 20, textPaint);
            textPaint.setTextAlign(Align.RIGHT);
            canvas.drawText(valueFormatter(value), w - 10, topPadding, textPaint);
            canvas.drawText(formatter(max), w - 10, h - 20, textPaint);
        } catch (err) {
            console.error(err);
        }
    }
</script>

<gridLayout {...$$restProps} height="auto" rows="auto,auto, auto" columns="auto,*,auto" padding="10 10 10 10">
    <!-- <canvas bind:this={canvas} on:draw={onDraw} /> -->

    <label visibility={icon ? 'visible' : 'collapsed'} color={$textColor} fontSize={24} text={icon} verticalTextAlignment="center" fontFamily={mdiFontFamily} />
    <label color={$textColor} fontSize={15} text={title} textWrap={true} verticalTextAlignment="center" maxLines={2} lineBreak="end" col={1} padding="0 10 0 10"/>
    <label
        row={1}
        col={1}
        color={$subtitleColor}
        visibility={subtitle && subtitle.length > 0 ? 'visible' : 'collapsed'}
        fontSize={14}
        text={subtitle}
        verticalTextAlignment="center"
        maxLines={2}
        lineBreak="end"
    />
    <label color={$textColor} fontSize={15} text={valueFormatter(value)} verticalTextAlignment="center" col={2}  textAlignment="right"/>
    <label color={$textColor} fontSize={15} text={formatter(max)} verticalTextAlignment="center" row={2} col={2} textAlignment="right"/>
    <label color={$textColor} fontSize={15} text={formatter(min)} verticalTextAlignment="center" row={2} />
    <slider row={2} col={1} {value} on:valueChange={onValueChange} minValue={min} maxValue={max} stepSize={step} verticalAlignment="bottom" />
</gridLayout>
