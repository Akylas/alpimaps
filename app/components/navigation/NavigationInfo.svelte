<script lang="ts">
    import NavigationCard, { NAVWIDGET_CARD_HEIGHT } from '~/components/navigation/NavigationCard.svelte';
    import { navigationScale } from '~/stores/navigationStore';
    import { colors, fonts } from '~/variables';

    $: ({ colorOnSurface, colorOnSurfaceVariant } = $colors);

    /**
     * An mdi glyph naming what the figure is. It reads at a glance where the caption it replaces did
     * not: a widget header has to be drawn small enough to fit beside the figure, which left it
     * unreadable while moving.
     *
     * Drawn on its own line above the figure, where the caption used to be, rather than in the value
     * line: the cards share one flex row, so anything that widens them takes width from their
     * neighbours — inline, the icons pushed the units onto a second line and shrank the figures.
     */
    export let icon: string = null;
    /** only drawn without an icon: naming the same figure twice would just take room */
    export let caption: string = null;
    export let value: string = '-';
    /** rendered smaller than the value: the number is what the user reads at a glance */
    export let unit: string = null;
    export let valueFontSize = 22;
    /** explicit, else the flex line stretches the card over both widget rows */
    export let height: number = null;
    $: cardHeight = height ?? Math.round(NAVWIDGET_CARD_HEIGHT * $navigationScale);
</script>

<NavigationCard height={cardHeight} horizontalAlignment="left" padding="3 10 3 10" {...$$restProps}>
    <stacklayout verticalAlignment="center">
        <!-- pulled down onto the figure: the icon line and the value line each carry their own leading,
             and at a large scale the two gaps together pushed the unit off the bottom of the card -->
        <label color={colorOnSurfaceVariant} fontFamily={$fonts.mdi} fontSize={11 * $navigationScale} marginBottom={-4 * $navigationScale} text={icon} visibility={icon ? 'visible' : 'collapse'} />
        <label color={colorOnSurfaceVariant} fontSize={11 * $navigationScale} text={caption} visibility={!icon && caption ? 'visible' : 'collapse'} />
        <label>
            <cspan color={colorOnSurface} fontSize={valueFontSize * $navigationScale} fontWeight="bold" text={value} />
            <cspan color={colorOnSurfaceVariant} fontSize={11 * $navigationScale} text={unit ? ' ' + unit : ''} />
        </label>
    </stacklayout>
</NavigationCard>
