<script lang="ts">
    // where a line goes: the first and last stops of the way shown, and a tap to go the other way
    import { colors, fonts } from '~/variables';

    export let from: string = null;
    export let to: string = null;
    /** the line runs both ways */
    export let swappable = false;

    let { colorOnBackground, colorOnSurfaceVariant, colorPrimary } = $colors;
    $: ({ colorOnBackground, colorOnSurfaceVariant, colorPrimary } = $colors);
</script>

<stacklayout horizontalAlignment="center" orientation="horizontal" padding="8 16" rippleColor={colorPrimary} {...$$restProps} on:tap>
    <label color={colorPrimary} fontFamily={$fonts.mdi} fontSize={26} text="mdi-swap-vertical" verticalAlignment="middle" visibility={swappable ? 'visible' : 'collapse'} />
    <stacklayout paddingLeft={swappable ? 12 : 0} verticalAlignment="middle">
        <label color={colorOnSurfaceVariant} fontSize={14} lineBreak="end" maxLines={1} text={from} />
        <label color={colorOnBackground} fontSize={17} fontWeight="bold" lineBreak="end" maxLines={1} text={to} />
    </stacklayout>
</stacklayout>
