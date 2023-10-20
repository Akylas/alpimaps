<script context="module" lang="ts">
    import { Align, Canvas, CanvasView, LayoutAlignment, Paint, StaticLayout } from '@nativescript-community/ui-canvas';
    import { NativeViewElementNode } from 'svelte-native/dom';
    import { colorSecondary, mdiFontFamily, subtitleColor, textColor } from '~/variables';
    let iconPaint: Paint;
    let textPaint: Paint;
</script>

<script lang="ts">
    import { primaryColor } from '~/variables';

    export let icon: string = null;
    export let title: string = null;
    export let subtitle: string = null;
    export let min = 0;
    export let max = 1;
    export let step = null;
    export let value = 0;
    export let defaultValue = 0;
    export let onChange = null;
    export let formatter = (value) => value + '';
    export let valueFormatter = (value) => value.toFixed(1);
    let canvas: NativeViewElementNode<CanvasView>;
    let actualValue;
    $: actualValue = value ?? defaultValue;
    function onValueChange(event) {
        value = event.value;
        if (onChange) {
            onChange(event.value);
        }
        canvas?.nativeView.invalidate();
    }
    function onDraw({ canvas, object }: { canvas: Canvas; object: CanvasView }) {
        try {
            const w = canvas.getWidth();
            const h = canvas.getHeight();
            let leftPadding = 10;
            const topPadding = 30;
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
            console.error(err, err.stack);
        }
    }
</script>

<gridlayout {...$$restProps} columns="auto,*,auto" height="auto" padding="10 10 10 10" rows="auto,auto, auto">
    <!-- <canvas bind:this={canvas} on:draw={onDraw} /> -->

    <label color={$textColor} fontFamily={mdiFontFamily} fontSize={24} text={icon} verticalTextAlignment="center" visibility={icon ? 'visible' : 'collapsed'} />
    <label col={1} color={$textColor} fontSize={15} lineBreak="end" maxLines={2} padding="0 10 0 10" text={title} textWrap={true} verticalTextAlignment="center" />
    <label
        col={1}
        color={$subtitleColor}
        fontSize={14}
        lineBreak="end"
        maxLines={2}
        row={1}
        text={subtitle}
        verticalTextAlignment="center"
        visibility={subtitle && subtitle.length > 0 ? 'visible' : 'collapsed'} />
    <label col={2} color={$textColor} fontSize={15} text={valueFormatter(actualValue)} textAlignment="right" verticalTextAlignment="center" />
    <label col={2} color={$textColor} fontSize={15} row={2} text={formatter(max)} textAlignment="right" verticalTextAlignment="center" />
    <label color={$textColor} fontSize={15} row={2} text={formatter(min)} verticalTextAlignment="center" />
    <slider
        col={1}
        color={actualValue === defaultValue ? colorSecondary : primaryColor}
        maxValue={max}
        minValue={min}
        row={2}
        stepSize={step}
        trackBackgroundColor="#aaaaaa88"
        value={actualValue}
        verticalAlignment="bottom"
        on:valueChange={onValueChange} />
</gridlayout>
