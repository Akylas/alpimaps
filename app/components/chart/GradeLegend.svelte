<script lang="ts">
    // the chart's grade colours with their thresholds, steepest descent to steepest climb
    import { Color } from '@nativescript/core';
    import { isEInk } from '~/helpers/theme';
    import { gradeBuckets, gradeShades } from '~/utils/grade';
    import { colors } from '~/variables';

    let { colorOnSurface, colorOnSurfaceVariant } = $colors;
    $: ({ colorOnSurface, colorOnSurfaceVariant } = $colors);

    const columns = gradeBuckets.map(() => '*').join(',');
</script>

<gridlayout {columns} padding="0 8 2 8" rows={isEInk ? '8,auto' : '6,auto'} {...$$restProps}>
    {#each gradeBuckets as bucket, index}
        <!-- the shade it is under the chart on e-ink, where its colour is a grey like the others; a hairline keeps the clear one in view -->
        <absolutelayout backgroundColor={isEInk ? new Color('#000000').setAlpha(gradeShades[index]).hex : bucket.color} borderColor={colorOnSurface} borderWidth={isEInk ? 0.5 : 0} col={index} />
        {#if index > 0}
            <label col={index} color={colorOnSurfaceVariant} fontSize={10} marginLeft={-8} row={1} text={bucket.from + ''} textAlignment="center" width={16} />
        {/if}
    {/each}
    <label col={gradeBuckets.length - 1} color={colorOnSurfaceVariant} fontSize={10} horizontalAlignment="right" row={1} text="%" />
</gridlayout>
