<script lang="ts">
    import { Color } from '@nativescript/core';
    import SharedIconButton from '@shared/components/IconButton.svelte';
    import { isEInk } from '~/helpers/theme';
    import { colors, fontScaleMaxed } from '~/variables';

    let { colorAccentContainer, colorOnSurfaceVariant2, colorPrimary } = $colors;
    $: ({ colorAccentContainer, colorOnSurfaceVariant2, colorPrimary } = $colors);
    export let white = false;
    export let toggable = false;
    export let gray = toggable;
    export let isSelected = false;
    export let borderRadius = 4;
    export let selectedColor = white ? 'white' : undefined;
    export let color: string | Color = toggable ? (isEInk ? '#C4C7C8' : null) : null;
    export let maxFontScale = null;

    $: sizeScale = maxFontScale ?? Math.min($fontScaleMaxed, 1.4);
    // the sky toggles' on state; e-ink already greys the off state
    $: selectedBackgroundColor = toggable && isSelected && !isEInk ? colorAccentContainer : undefined;
</script>

<SharedIconButton
    {borderRadius}
    {color}
    disabledColor={isEInk ? '#ccc' : 'lightgray'}
    {gray}
    grayColor={colorOnSurfaceVariant2}
    {isSelected}
    {selectedBackgroundColor}
    selectedColor={selectedColor || colorPrimary}
    {sizeScale}
    {white}
    {...$$restProps}
    on:tap
    on:loaded />
