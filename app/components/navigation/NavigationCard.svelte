<script context="module" lang="ts">
    import { isEInk } from '~/helpers/theme';

    export const CARD_RADIUS = isEInk ? 4 : 14;
    export const CARD_BORDER_WIDTH = isEInk ? 1 : 0;
</script>

<script lang="ts">
    import { colors } from '~/variables';

    $: ({ colorOutlineVariant, colorWidgetBackground } = $colors);
</script>

<!-- the rounded surface every navigation widget floats on, so the map shows through between them -->
<gridlayout backgroundColor={colorWidgetBackground} borderColor={colorOutlineVariant} borderRadius={CARD_RADIUS} borderWidth={CARD_BORDER_WIDTH} {...$$restProps}>
    <slot />
</gridlayout>
