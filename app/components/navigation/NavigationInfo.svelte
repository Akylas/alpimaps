<script lang="ts">
    import NavigationCard, { NAVWIDGET_CARD_HEIGHT } from '~/components/navigation/NavigationCard.svelte';
    import { colors, fontScaleMaxed } from '~/variables';

    $: ({ colorOnSurface, colorOnSurfaceVariant } = $colors);

    export let caption: string = null;
    export let value: string = '-';
    /** rendered smaller than the value: the number is what the user reads at a glance */
    export let unit: string = null;
    export let valueFontSize = 22;
    /** explicit, else the flex line stretches the card over both widget rows */
    export let height = NAVWIDGET_CARD_HEIGHT;
</script>

<NavigationCard {height} horizontalAlignment="left" padding="3 10 3 10" {...$$restProps}>
    <stacklayout verticalAlignment="center">
        <label color={colorOnSurfaceVariant} fontSize={11 * $fontScaleMaxed} text={caption} visibility={caption ? 'visible' : 'collapse'} />
        <label>
            <cspan color={colorOnSurface} fontSize={valueFontSize * $fontScaleMaxed} fontWeight="bold" text={value} />
            <cspan color={colorOnSurfaceVariant} fontSize={13 * $fontScaleMaxed} text={unit ? ' ' + unit : ''} />
        </label>
    </stacklayout>
</NavigationCard>
