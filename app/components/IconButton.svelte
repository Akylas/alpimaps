<script lang="ts" context="module">
    import { profile } from '@nativescript/core';
    import { Align, Canvas, CanvasView, LayoutAlignment, Paint, StaticLayout } from '@nativescript-community/ui-canvas';
    import { showToolTip } from '~/utils/utils';
    import { actionBarButtonHeight, mdiFontFamily, primaryColor, subtitleColor, textColor } from '~/variables';
    const iconPaint = new Paint();
    iconPaint.fontFamily = mdiFontFamily;
    // iconPaint.setTextAlign(Align.CENTER);
</script>

<script lang="ts">
    export let isVisible = true;
    export let isHidden = false;
    export let white = false;
    export let isEnabled = true;
    export let small = false;
    export let gray = false;
    export let isSelected = false;
    export let text = null;
    export let fontFamily = mdiFontFamily;
    export let selectedColor = white ? 'white' : primaryColor;
    export let color = null;
    export let onLongPress: Function = null;
    export let fontSize = 0;
    export let size: any = small ? 30 : actionBarButtonHeight;
    export let tooltip = null;
    export let rounded = true;
    export let shape = null;
    export let height = null;
    export let width = null;

    // let actualColor = null;
    // $: actualColor = white ? 'white' : !isEnabled || gray ? $subtitleColor : color;
    $: actualColor = color || (!isEnabled || gray ? $subtitleColor : $textColor);
    $: actualLongPress =
        onLongPress || tooltip
            ? (event) => {
                  if (event.ios && event.ios.state !== 3) {
                      return;
                  }
                  if (onLongPress) {
                      onLongPress(event);
                  } else {
                      showToolTip(tooltip);
                  }
              }
            : null;

    function onCanvasDraw({ canvas, object }: { canvas: Canvas; object: CanvasView }) {
        iconPaint.fontFamily = fontFamily;
        iconPaint.textSize = fontSize ? fontSize : small ? 16 : 24;
        iconPaint.color = isEnabled ? (isSelected ? selectedColor : actualColor) : 'lightgray';
        let w = canvas.getWidth();
        let w2 = w / 2;
        let h2 = canvas.getHeight() / 2;
        const staticLayout = new StaticLayout(text, iconPaint, w, LayoutAlignment.ALIGN_CENTER, 1, 0, true);
        canvas.translate(0, h2 - staticLayout.getHeight() / 2);
        staticLayout.draw(canvas);
        // canvas.drawText(text, w2, w2+ textSize/3, iconPaint);
    }

    function conditionalEvent(node, { condition, event, callback }) {
        let toRemove
        if (condition) {
            toRemove = callback;
            node.addEventListener(event, callback);
        }

        return {
            destroy() {
                if (toRemove) {
                    node.removeEventListener(event, toRemove);
                }
            }
        };
    }
</script>

<canvas
    on:draw={onCanvasDraw}
    borderRadius={shape === 'round' || (rounded && !shape) ? size / 2 : null}
    disableCss={true}
    rippleColor={actualColor}
    visibility={isVisible ? 'visible' : isHidden ? 'hidden' : 'collapsed'}
    {...$$restProps}
    on:tap
    use:conditionalEvent={{ condition: !!actualLongPress, event: 'longPress', callback: actualLongPress }}
    width={width || size}
    height={height || size}
/>
<!-- <mdbutton
    {isEnabled}
    {text}
    variant="text"
    shape={shape || (rounded ? 'round' : null)}
    disableCss={true}
    rippleColor={actualColor}
    {fontFamily}
    visibility={isVisible ? 'visible' : isHidden ? 'hidden' : 'collapsed'}
    color={isSelected ? selectedColor : actualColor}
    {...$$restProps}
    on:tap
    on:longPress={actualLongPress}
    width={width || size}
    height={height || size}
    fontSize={fontSize ? fontSize : small ? 16 : 24}
/> -->
