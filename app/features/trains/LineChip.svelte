<script lang="ts">
    // a line as the journey results draw it: the mode's icon and the line's name on the line's own colour
    import { Color } from '@nativescript/core';
    import { modeIcon } from '~/features/trains/TransitousService';
    import { colors, fonts } from '~/variables';

    export let name: string;
    export let mode: string = null;
    /** `#rrggbb`, null when the feed has none: a tint of the app's colour then */
    export let color: string = null;
    export let textColor: string = null;
    /** no background, eg walking */
    export let plain = false;
    export let height = 24;
    export let fontSize = 13;

    let { colorOnSurface, colorOnSurfaceVariant, colorPrimary } = $colors;
    $: ({ colorOnSurface, colorOnSurfaceVariant, colorPrimary } = $colors);

    $: background = plain ? null : (color ?? new Color(colorPrimary).setAlpha(36).hex);
    $: foreground = plain ? colorOnSurfaceVariant : color ? (textColor ?? (new Color(color).getBrightness() >= 170 ? '#000000' : '#ffffff')) : colorOnSurface;
</script>

<stacklayout backgroundColor={background} borderRadius={4} {height} horizontalAlignment="left" orientation="horizontal" padding="0 6" verticalAlignment="middle" {...$$restProps}>
    {#if mode}
        <label color={foreground} fontFamily={$fonts.mdi} fontSize={fontSize + 1} text={modeIcon(mode)} verticalAlignment="middle" />
    {/if}
    <label color={foreground} {fontSize} lineBreak="end" maxLines={1} paddingLeft={mode ? 3 : 0} text={name} verticalAlignment="middle" />
</stacklayout>
