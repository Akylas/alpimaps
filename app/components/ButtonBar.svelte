<script lang="ts">
    import { Align, Canvas, CanvasView, Paint } from '@nativescript-community/ui-canvas';
    import { showSnack } from '@nativescript-community/ui-material-snackbar';
    import { AbsoluteLayout, Utils } from '@nativescript/core';
    import { NativeViewElementNode } from 'svelte-native/dom';
    import { actionBarButtonHeight, mdiFontFamily, primaryColor, subtitleColor, textColor } from '~/variables';
    export let orientation = 'vertical';
    export let buttons = [];

    export let fontFamily = mdiFontFamily;

    export let small = false;
    export let gray = false;
    export let white = false;
    export let fontSize = null;
    export let buttonSize = small ? 30 : actionBarButtonHeight;
    export let selectedColor = white ? 'white' : primaryColor;

    let canvas: NativeViewElementNode<CanvasView>;
    let ripple: NativeViewElementNode<AbsoluteLayout>;
    let width = 0;
    let height = 0;
    let buttonsLength = 0;
    let rippleColor = $textColor;
    let defaultFontSize;

    $: defaultFontSize = small ? 16 : 24;

    $: {
        buttonsLength = buttons.length;
        // console.log('buttonsLength', buttonsLength);
        canvas?.nativeView.invalidate();
    }
    $: width = orientation === 'vertical' ? buttonSize : buttonsLength * buttonSize;
    $: height = orientation === 'vertical' ? buttonsLength * buttonSize : buttonSize;
    $: rippleColor = gray ? $subtitleColor : $textColor;

    let iconPaint: Paint;

    function onDraw({ canvas, object }: { canvas: Canvas; object: CanvasView }) {
        try {
            let w = canvas.getWidth();
            let h = canvas.getHeight();
            // console.log('onDraw', w, h, buttons);
            const buttonsFontSize = fontSize || defaultFontSize;
            if (!iconPaint) {
                iconPaint = new Paint();
                iconPaint.fontFamily = mdiFontFamily;
                iconPaint.textSize = buttonsFontSize;
                iconPaint.setTextAlign(Align.CENTER);
            }
            const metrics = iconPaint.getFontMetrics();
            let deltaX = buttonSize / 2;
            let deltaY = (metrics.descent - metrics.ascent) / 2 - buttonSize / 2 - 3;
            const offsetX = orientation === 'vertical' ? 0 : buttonSize;
            const offsetY = orientation === 'vertical' ? buttonSize : 0;

            for (let index = 0; index < buttonsLength; index++) {
                const button = buttons[index];
                if (button.fontFamily) {
                    iconPaint.fontFamily = button.fontFamily;
                } else {
                    iconPaint.fontFamily = fontFamily;
                }
                let color;
                if (button.isSelected) {
                    color = button.selectedColor || selectedColor;
                } else {
                    color = button.color || (!button.isEnabled || button.gray || gray ? $subtitleColor : $textColor);
                }
                iconPaint.color = color;
                deltaX += offsetX;
                deltaY += offsetY;
                canvas.drawText(button.text, deltaX, deltaY, iconPaint);
            }
        } catch (err) {
            console.error(err, err.stack);
        }
    }
    function onTap(event) {
        let index;
        if (orientation === 'vertical') {
            index = Math.floor(event.getY() / buttonSize);
        } else {
            index = Math.floor(event.getX() / buttonSize);
        }
        // console.log('onTap', event.getX(), event.getY(), index);
        if (index >= 0) {
            buttons[index].onTap?.(event);
        }
    }
    function onLongPress(event) {
        // console.log('onLongPress', Object.keys(event));
        let index;
        if (orientation === 'vertical') {
            index = Math.floor(event.getY() / buttonSize);
        } else {
            index = Math.floor(event.getX() / buttonSize);
        }
        if (index >= 0) {
            buttons[index].onLongPress?.(event);
        }
    }
    function onTouch(event) {
        if (event.action === 'down') {
            ripple.nativeView.left = Math.floor(event.getX() / buttonSize) * buttonSize;
            ripple.nativeView.top = Math.floor(event.getY() / buttonSize) * buttonSize;

            if (__ANDROID__) {
                ripple.nativeView.nativeView.dispatchTouchEvent(event.android)
            } else if (__IOS__) {
                ripple.nativeView.nativeView.touchesBeganWithEvent(event.ios.touches, event.ios.event);
            }
            // console.log('onTouch', event.getX(), event.getY(), rippleX, rippleY);
        }
    }
    let rippleX = 0;
    let rippleY = 0;
</script>

<absolutelayout {width} {height} {...$$restProps} on:tap={() => {}} on:touch={onTouch} on:tap={onTap} on:longPress={onLongPress}>
    <canvas bind:this={canvas} width="100%" height="100%" on:draw={onDraw} />
    <absolutelayout bind:this={ripple} left={rippleX} top={rippleY} width={buttonSize} height={buttonSize} {rippleColor} borderRadius="{buttonSize / 2}}" />
</absolutelayout>
