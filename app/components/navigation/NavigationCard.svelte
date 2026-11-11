<script context="module" lang="ts">
    export const CARD_RADIUS = 20;
    export const CARD_BORDER_WIDTH = 1;
</script>

<script lang="ts">
    import { colors } from '~/variables';

    $: ({ colorHairline, colorPanel } = $colors);
</script>

<gridlayout backgroundColor={colorPanel} borderColor={colorHairline} borderRadius={CARD_RADIUS} borderWidth={CARD_BORDER_WIDTH} {...$$restProps} on:tap>
    <slot />
</gridlayout>
