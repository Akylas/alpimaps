<script lang="ts">
    // what the colours of the profile's fill mean, in the line under the chart: a swatch and a word for each. The grade
    // legend is for a fill that is the grade's
    import { isEInk } from '~/helpers/theme';
    import type { ProfileLegendEntry } from '~/routeFeatures/registry';
    import { colors } from '~/variables';

    export let entries: ProfileLegendEntry[] = [];

    let { colorOnSurface, colorOnSurfaceVariant } = $colors;
    $: ({ colorOnSurface, colorOnSurfaceVariant } = $colors);
</script>

<stacklayout orientation="horizontal" padding="0 12" verticalAlignment="center" {...$$restProps}>
    {#each entries as entry}
        <absolutelayout
            backgroundColor={isEInk ? (entry.eink ?? entry.color) : entry.color}
            borderColor={colorOnSurface}
            borderRadius={5}
            borderWidth={isEInk ? 0.5 : 0}
            height={10}
            marginRight={5}
            verticalAlignment="middle"
            width={10} />
        <label color={colorOnSurfaceVariant} fontSize={11} lineBreak="end" marginRight={12} maxLines={1} text={entry.label} verticalAlignment="middle" />
    {/each}
</stacklayout>
