<script lang="ts">
    /**
     * A one-of-N row bound straight to a store, as a row of tappable labels.
     *
     * For the two or three-way choices the settings sheets need. Anything longer belongs in the settings
     * screen's own list, which can open a picker.
     */
    import type { Writable } from 'svelte/store';
    import { colors } from '~/variables';

    export let title: string;
    export let description: string = null;
    export let store: Writable<string>;
    /** In display order. `value` is what goes in the store, `title` is what the user reads. */
    export let options: { value: string; title: string }[];

    $: ({ colorOnSurface, colorOnSurfaceVariant, colorPrimary } = $colors);
</script>

<gridlayout columns="*" padding="6 16 6 16" rows="auto,auto,auto" {...$$restProps}>
    <label color={colorOnSurface} fontSize={16} text={title} />
    {#if description}
        <label color={colorOnSurfaceVariant} fontSize={13} row={1} text={description} textWrap={true} />
    {/if}
    <stacklayout marginTop={4} orientation="horizontal" row={2}>
        {#each options as option (option.value)}
            <label
                borderColor={$store === option.value ? colorPrimary : colorOnSurfaceVariant}
                borderRadius={14}
                borderWidth={1}
                color={$store === option.value ? colorPrimary : colorOnSurfaceVariant}
                fontSize={13}
                marginRight={6}
                padding="4 12 4 12"
                text={option.title}
                on:tap={() => store.set(option.value)} />
        {/each}
    </stacklayout>
</gridlayout>
