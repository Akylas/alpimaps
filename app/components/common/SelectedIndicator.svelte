<script context="module" lang="ts">
    import { Align, Canvas, CanvasView, Paint } from '@nativescript-community/ui-canvas';
    import { isEInk } from '~/helpers/theme';
    import { colors, fonts } from '~/variables';
    const ringPaint = new Paint();
    const badgePaint = new Paint();
    const iconPaint = new Paint();
    iconPaint.textSize = 16;
    iconPaint.setTextAlign(Align.CENTER);
    const size = 30;
    const center = size / 2;
    const text = 'mdi-check';
</script>

<script lang="ts">
    let { colorCard, colorOnPrimary, colorPrimary } = $colors;
    $: ({ colorCard, colorOnPrimary, colorPrimary } = $colors);

    export let selected: boolean = false;

    // a primary check badge, ringed in the card colour so it lifts off whatever it sits on
    function onCanvasDraw({ canvas }: { canvas: Canvas; object: CanvasView }) {
        ringPaint.color = colorCard;
        badgePaint.color = isEInk ? 'black' : colorPrimary;
        iconPaint.color = isEInk ? 'white' : colorOnPrimary;
        iconPaint.fontFamily = $fonts.mdi;
        canvas.drawCircle(center, center, 14, ringPaint);
        canvas.drawCircle(center, center, 11.5, badgePaint);
        canvas.drawText(text, center, center + 5.5, iconPaint);
    }
</script>

<canvasview
    disableCss={true}
    height={size}
    horizontalAlignment="left"
    isUserInteractionEnabled={false}
    margin="6 0 0 6"
    verticalAlignment="top"
    visibility={selected ? 'visible' : 'hidden'}
    width={size}
    on:draw={onCanvasDraw}
    {...$$restProps} />
