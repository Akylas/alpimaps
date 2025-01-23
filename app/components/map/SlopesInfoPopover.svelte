<script context="module" lang="ts">
    import { lc } from '@nativescript-community/l';
    import { RoutesType, SLOPE_COLORS, SLOPE_STEPS } from '~/mapModules/CustomLayersModule';
    import { routesType } from '~/stores/mapStore';
    import { colors, fontScale, fonts } from '~/variables';
    import PopoverBackgroundView from '../common/PopoverBackgroundView.svelte';
    import { Paint } from '@nativescript-community/ui-canvas';
</script>

<script lang="ts">
    const paint = new Paint();
    const textPaint = new Paint();
    let { colorOnSurface } = $colors;
    $: ({ colorOnSurface } = $colors);
    // let { colorSurfaceContainer } = $colors;
    // $: ({ colorSurfaceContainer } = $colors);
    // export let backgroundColor = colorSurfaceContainer;
    function onDraw({ canvas, object }: { canvas: Canvas; object: CanvasView }) {
        const dx = 10;
        let dy = 16;
        textPaint.color = colorOnSurface;
        const textSize = 16 * $fontScale;
        textPaint.textSize = textSize;
        SLOPE_STEPS.forEach((s, index) => {
            paint.color = SLOPE_COLORS[index];
            canvas.drawRect(dx, dy, dx + 20, dy + 20, paint);
            canvas.drawText(`${s}${index < SLOPE_STEPS.length - 1 ? `-${SLOPE_STEPS[index + 1]}` : ''}°`, dx + 30, dy + 10 + textSize / 2, textPaint);
            dy += 30;
        });
    }
</script>

<PopoverBackgroundView columns="auto">
    <!-- <gesturerootview columns="auto"> -->
    <canvasview height={150 * $fontScale} width={100 * $fontScale} on:draw={onDraw}> </canvasview>
</PopoverBackgroundView>
