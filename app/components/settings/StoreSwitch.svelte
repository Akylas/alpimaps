<script lang="ts">
    /**
     * A switch row bound straight to a store.
     *
     * `SettingsSwitch` takes an `item` out of the settings screen's list machinery; this one takes the
     * store itself, which is what the terrain and peak-finder sheets have — and it is the SAME store
     * the app settings screen binds, so there is nothing to keep in sync.
     */
    import type { Writable } from 'svelte/store';
    import { colors } from '~/variables';

    export let title: string;
    export let description: string = null;
    export let store: Writable<boolean>;

    $: ({ colorOnSurface, colorOnSurfaceVariant } = $colors);
</script>

<gridlayout columns="*,auto" padding="6 16 6 16" rows="auto,auto" {...$$restProps}>
    <label color={colorOnSurface} fontSize={16} text={title} verticalTextAlignment="center" />
    {#if description}
        <label col={0} color={colorOnSurfaceVariant} fontSize={13} row={1} text={description} textWrap={true} />
    {/if}
    <switch checked={$store} col={1} marginLeft={10} rowSpan={2} verticalAlignment="center" on:checkedChange={(event) => store.set(event['value'])} />
</gridlayout>
