<script lang="ts">
    import { VerticalPosition } from '@nativescript-community/ui-popover';
    import { EventData, ObservableArray, Utils, View } from '@nativescript/core';
    import type { OptionType } from '@shared/components/OptionSelect.svelte';
    import { slide } from '@shared/utils/svelte/ui';
    import { showPopoverMenu } from '~/utils/ui';
    import { actionBarButtonHeight, colors, windowInset } from '~/variables';

    export let options: OptionType[] = [];
    export let onAction: (event, option: OptionType) => void | Promise<void> = null;
    let visibleOptions: OptionType[] = [];
    let overflowOptions: OptionType[] = [];
    let hasOverflow = false;
    $: ({ colorOnSurface } = $colors);

    async function handleAction(event, option: OptionType) {
        if (onAction) {
            await onAction(event, option);
        }
    }

    async function showMoreOptions(event) {
        await showPopoverMenu({
            anchor: event.object,
            options: new ObservableArray(overflowOptions),
            vertPos: VerticalPosition.ABOVE,
            onClose: async (item) => {
                if (item) {
                    await handleAction(event, item);
                }
            }
        });
    }
    function updateVisibleOptions(availableWidth: number, allOptions: OptionType[]) {
        // the room left once the margins are out, the overflow button taking one slot when needed
        const nbVisibleButtons = Math.max(2, Math.floor((availableWidth - 32) / $actionBarButtonHeight));
        if (allOptions.length > nbVisibleButtons) {
            visibleOptions = allOptions.slice(0, nbVisibleButtons - 1);
            overflowOptions = allOptions.slice(nbVisibleButtons - 1);
            hasOverflow = true;
        } else {
            hasOverflow = false;
            visibleOptions = allOptions;
            overflowOptions = [];
        }
    }
    let width = 0;
    function onLayoutChanged(event: EventData) {
        width = Utils.layout.toDeviceIndependentPixels((event.object as View).getMeasuredWidth());
    }
    $: if (width) {
        updateVisibleOptions(width, options);
    }
</script>

<gridlayout
    class="selectionToolbar"
    columns={hasOverflow ? 'auto,*,auto' : '*'}
    marginBottom={$windowInset.bottom + 8}
    marginLeft={8}
    marginRight={8}
    marginTop={8}
    {...$$restProps}
    on:layoutChanged={onLayoutChanged}
    transition:slide={{ duration: 200 }}>
    <stacklayout col={hasOverflow ? 1 : 0} horizontalAlignment="center" orientation="horizontal">
        {#each visibleOptions as option}
            {@const color = typeof option.color === 'function' ? option['color'](options) : option.color}
            <mdbutton class="selectionToolbarButton" color={color || colorOnSurface} text={option.icon} variant="text" on:tap={(event) => handleAction(event, option)} />
        {/each}
    </stacklayout>
    {#if hasOverflow}
        <mdbutton class="selectionToolbarButton" col={2} color={colorOnSurface} text="mdi-dots-vertical" variant="text" on:tap={showMoreOptions} />
    {/if}
</gridlayout>
