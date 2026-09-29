<script lang="ts">
    // the chart's grade colours with their thresholds, steepest descent to steepest climb
    import { gradeBuckets } from '~/utils/grade';
    import { colors } from '~/variables';

    let { colorOnSurfaceVariant } = $colors;
    $: ({ colorOnSurfaceVariant } = $colors);

    const columns = gradeBuckets.map(() => '*').join(',');
</script>

<gridlayout {columns} padding="0 8 2 8" rows="6,auto" {...$$restProps}>
    {#each gradeBuckets as bucket, index}
        <absolutelayout backgroundColor={bucket.color} col={index} />
        {#if index > 0}
            <label col={index} color={colorOnSurfaceVariant} fontSize={10} marginLeft={-8} row={1} text={bucket.from + ''} textAlignment="center" width={16} />
        {/if}
    {/each}
    <label col={gradeBuckets.length - 1} color={colorOnSurfaceVariant} fontSize={10} horizontalAlignment="right" row={1} text="%" />
</gridlayout>
