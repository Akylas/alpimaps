<script lang="ts">
    import NavigationCard, { NAVWIDGET_CARD_HEIGHT } from '~/components/navigation/NavigationCard.svelte';
    import { navigationScale } from '~/stores/navigationStore';
    import { colors, fonts } from '~/variables';

    $: ({ colorOnSurface, colorOnSurfaceVariant } = $colors);

    // mdi glyph drawn on its own line above the value: cards share one flex row, so an inline
    // icon widens them, wrapping units and shrinking the figures
    export let icon: string = null;
    export let caption: string = null;
    export let value: string = '-';
    export let unit: string = null;
    export let valueFontSize = 22;
    // explicit, else the flex line stretches the card over both widget rows
    export let height: number = null;
    $: cardHeight = height ?? Math.round(NAVWIDGET_CARD_HEIGHT * $navigationScale);
</script>

<NavigationCard height={cardHeight} horizontalAlignment="left" padding="3 10 3 10" {...$$restProps}>
    <stacklayout verticalAlignment="center">
        <!-- negative margin: both lines carry their own leading, which at large scale pushed the unit off the card -->
        <label color={colorOnSurfaceVariant} fontFamily={$fonts.mdi} fontSize={11 * $navigationScale} marginBottom={-4 * $navigationScale} text={icon} visibility={icon ? 'visible' : 'collapse'} />
        <label color={colorOnSurfaceVariant} fontSize={11 * $navigationScale} text={caption} visibility={!icon && caption ? 'visible' : 'collapse'} />
        <label>
            <cspan color={colorOnSurface} fontSize={valueFontSize * $navigationScale} fontWeight="bold" text={value} />
            <cspan color={colorOnSurfaceVariant} fontSize={11 * $navigationScale} text={unit ? ' ' + unit : ''} />
        </label>
    </stacklayout>
</NavigationCard>
