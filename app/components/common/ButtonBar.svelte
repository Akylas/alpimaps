<script lang="ts">
    import { Align, Canvas, CanvasView, Paint } from '@nativescript-community/ui-canvas';
    import { AbsoluteLayout } from '@nativescript/core';
    import { NativeViewElementNode } from 'svelte-native/dom';
    import { showToolTip } from '~/utils/ui';
    import { actionBarButtonHeight, colors, fonts } from '~/variables';

    let { colorOnSurface, colorOnSurfaceVariant, colorPrimary } = $colors;
    $: ({ colorOnSurface, colorOnSurfaceVariant, colorPrimary } = $colors);

    export let orientation = 'vertical';
    export let buttons = [];

    export let fontFamily = $fonts.mdi;

    export let small = false;
    export let gray = false;
    export let white = false;
    export let color = null;
    export let fontSize = null;
    export let buttonSize = small ? 30 : $actionBarButtonHeight;
    export let selectedColor = white ? 'white' : undefined;

    let canvas: NativeViewElementNode<CanvasView>;
    let ripple: NativeViewElementNode<AbsoluteLayout>;
    let width = 0;
    let height = 0;
    let buttonsLength = 0;
    let rippleColor = colorOnSurface;
    let defaultFontSize;

    $: defaultFontSize = small ? 16 : 24;

    $: {
        buttonsLength = visibleButtons(buttons).length;
        canvas?.nativeView.invalidate();
    }
    $: width = orientation === 'vertical' ? buttonSize : buttonsLength * buttonSize;
    $: height = orientation === 'vertical' ? buttonsLength * buttonSize : buttonSize;
    $: rippleColor = color || gray ? colorOnSurfaceVariant : colorOnSurface;

    let iconPaint: Paint;

    function visibleButtons(but = buttons) {
        return but.filter((b) => b.visible !== false);
    }

    function onDraw({ canvas, object }: { canvas: Canvas; object: CanvasView }) {
        try {
            const buttonsFontSize = fontSize || defaultFontSize;
            if (!iconPaint) {
                iconPaint = new Paint();
                iconPaint.fontFamily = fontFamily || $fonts.mdi;
                iconPaint.textSize = buttonsFontSize;
                iconPaint.setTextAlign(Align.CENTER);
            }
            const metrics = iconPaint.getFontMetrics();
            let deltaX = buttonSize / 2;
            let deltaY = (metrics.descent - metrics.ascent) / 2 - buttonSize / 2 - 3;
            const offsetX = orientation === 'vertical' ? 0 : buttonSize;
            const offsetY = orientation === 'vertical' ? buttonSize : 0;

            for (let index = 0; index < buttons.length; index++) {
                const button = buttons[index];
                if (button.visible === false) {
                    continue;
                }
                if (button.fontFamily) {
                    iconPaint.fontFamily = button.fontFamily;
                } else {
                    iconPaint.fontFamily = fontFamily || $fonts.mdi;
                }
                let btcolor;
                if (button.isSelected) {
                    btcolor = button.selectedColor || selectedColor || colorPrimary;
                } else {
                    btcolor = button.color || color || (!button.isEnabled || button.gray || gray ? colorOnSurfaceVariant : colorOnSurface);
                }
                iconPaint.color = btcolor;
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
        if (index >= 0) {
            visibleButtons()[index].onTap?.(event);
        }
    }
    function onLongPress(event) {
        let index;
        if (orientation === 'vertical') {
            index = Math.floor(event.getY() / buttonSize);
        } else {
            index = Math.floor(event.getX() / buttonSize);
        }
        // DEV_LOG && console.log('onLongPress', Object.keys(event), index);
        if (index >= 0) {
            const button = visibleButtons()[index];
            if (button.onLongPress) {
                button.onLongPress(event);
            } else if (button.tooltip) {
                showToolTip(button.tooltip);
            }
        }
    }
    function onTouch(event) {
        if (event.action === 'down') {
            ripple.nativeView.marginLeft = Math.floor(event.getX() / buttonSize) * buttonSize;
            ripple.nativeView.marginTop = Math.floor(event.getY() / buttonSize) * buttonSize;
            if (__ANDROID__) {
                ripple.nativeView.nativeView.dispatchTouchEvent(event.android);
            } else if (__IOS__) {
                ripple.nativeView.nativeView.touchesBeganWithEvent(event.ios.touches, event.ios.event);
            }
            // console.log('onTouch', event.getX(), event.getY(), rippleX, rippleY);
        }
    }
    const rippleX = 0;
    const rippleY = 0;
</script>

<canvasview bind:this={canvas} {height} {width} on:draw={onDraw} {...$$restProps} on:tap={() => {}} on:touch={onTouch} on:tap={onTap} on:longPress={onLongPress}>
    <absolutelayout
        bind:this={ripple}
        borderRadius="{buttonSize / 2}}"
        height={buttonSize}
        horizontalAlignment="left"
        marginLeft={rippleX}
        marginTop={rippleY}
        {rippleColor}
        verticalAlignment="top"
        width={buttonSize} />
</canvasview>
