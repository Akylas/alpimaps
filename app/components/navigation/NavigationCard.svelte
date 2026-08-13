<script context="module" lang="ts">
    import { isEInk } from '~/helpers/theme';

    export const CARD_RADIUS = isEInk ? 4 : 14;
    export const CARD_BORDER_WIDTH = isEInk ? 1 : 0;
    /** height of one widget card, so a wrapped flex line cannot stretch it over both rows */
    export const NAVWIDGET_CARD_HEIGHT = 52;
</script>

<script lang="ts">
    import { colors } from '~/variables';

    $: ({ colorOutlineVariant, colorWidgetBackground } = $colors);
</script>

<!-- the rounded surface every navigation widget floats on, so the map shows through between them -->
<gridlayout backgroundColor={colorWidgetBackground} borderRadius={CARD_RADIUS} {...$$restProps}>
    <slot />
</gridlayout>
