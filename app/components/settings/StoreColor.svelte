<script lang="ts">
    import { Color } from '@nativescript/core';
    import { showError } from '@shared/utils/showError';
    import type { Writable } from 'svelte/store';
    import { pickColor } from '~/utils/utils';
    import { colors } from '~/variables';

    export let title: string;
    export let description: string = null;
    export let store: Writable<string> & { reset?: () => void };

    $: ({ colorHairline, colorOnSurface, colorOnSurfaceVariant } = $colors);

    // a value the layer answers that is not a colour draws no swatch
    $: color = toColor($store);
    function toColor(value: string) {
        if (!value) {
            return null;
        }
        try {
            return new Color(value);
        } catch (error) {
            return null;
        }
    }

    async function pick() {
        try {
            const newColor = await pickColor(color);
            if (newColor) {
                store.set(newColor.hex);
            }
        } catch (error) {
            showError(error);
        }
    }
</script>

<gridlayout columns="*,auto" padding="6 16 6 16" rippleColor={colorOnSurface} rows="auto,auto" {...$$restProps} on:longPress={() => store.reset?.()} on:tap={pick}>
    <label color={colorOnSurface} fontSize={16} text={title} verticalTextAlignment="center" />
    {#if description}
        <label color={colorOnSurfaceVariant} fontSize={13} row={1} text={description} textWrap={true} />
    {/if}
    <stacklayout col={1} orientation="horizontal" rowSpan={2} verticalAlignment="center">
        <label color={colorOnSurfaceVariant} fontSize={13} marginRight={10} text={color?.hex.toUpperCase()} verticalAlignment="middle" />
        <absolutelayout backgroundColor={color} borderColor={colorHairline} borderRadius={16} borderWidth={1} height={32} width={32} />
    </stacklayout>
</gridlayout>
