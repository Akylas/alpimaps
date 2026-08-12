<script lang="ts">
    import NavigationCard from '~/components/navigation/NavigationCard.svelte';
    import { colors, fontScaleMaxed } from '~/variables';

    $: ({ colorOnSurface, colorOnSurfaceVariant } = $colors);

    export let caption: string = null;
    export let value: string = '-';
    /** rendered smaller than the value: the number is what the user reads at a glance */
    export let unit: string = null;
    export let valueFontSize = 19;
</script>

<NavigationCard horizontalAlignment="left" padding="3 10 3 10" {...$$restProps}>
    <stacklayout verticalAlignment="center">
        <label color={colorOnSurfaceVariant} fontSize={10 * $fontScaleMaxed} text={caption} visibility={caption ? 'visible' : 'collapse'} />
        <label>
            <cspan color={colorOnSurface} fontSize={valueFontSize * $fontScaleMaxed} fontWeight="bold" text={value} />
            <cspan color={colorOnSurfaceVariant} fontSize={11 * $fontScaleMaxed} text={unit ? ' ' + unit : ''} />
        </label>
    </stacklayout>
</NavigationCard>
