<script context="module" lang="ts">
    export const HISTORY_ROW_HEIGHT = 60;
    export const HISTORY_HEADER_HEIGHT = 40;
    export const NO_RESULT_HEIGHT = 40;
</script>

<script lang="ts">
    import { createEventDispatcher } from '@shared/utils/svelte/ui';
    import { lc } from '~/helpers/locale';
    import type { SearchHistoryItem } from '~/stores/historyStore';
    import { colors } from '~/variables';
    import Pill from '~/components/common/Pill.svelte';
    import SearchRow from '~/components/search/SearchRow.svelte';

    $: ({ colorOnSurfaceVariant } = $colors);

    const dispatch = createEventDispatcher();
    export let items: SearchHistoryItem[];
    /** the last search found nothing */
    export let noResult = false;
</script>

<stacklayout {...$$restProps}>
    {#if noResult}
        <label color={colorOnSurfaceVariant} fontSize={14} height={NO_RESULT_HEIGHT} paddingLeft={16} text={lc('no_result_found')} verticalTextAlignment="middle" />
    {/if}
    {#if items.length > 0}
        <gridlayout columns="*,auto" height={HISTORY_HEADER_HEIGHT} padding="0 8 0 16">
            <label color={colorOnSurfaceVariant} fontSize={12} text={lc('search_history')} verticalAlignment="middle" />
            <Pill col={1} label={lc('clear_history')} on:tap={() => dispatch('clear')} />
        </gridlayout>
        {#each items as item (`${item.title}${item.geometry.coordinates.join()}`)}
            <SearchRow actionIcon="mdi-dots-vertical" height={HISTORY_ROW_HEIGHT} {item} on:tap={() => dispatch('tap', item)} on:action={(payload) => dispatch('menu', payload)} />
        {/each}
    {/if}
</stacklayout>
