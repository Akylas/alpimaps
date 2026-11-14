<script lang="ts">
    // the next side streets that may be entered, for the travel mode: `◄ 90 m` on the left, `60 m ►` on the right,
    // and in the middle a no-entry or a dead end ahead
    import Pill from '~/components/common/Pill.svelte';
    import { formatDistance } from '~/helpers/formatter';
    import { lc } from '~/helpers/locale';
    import { junctionChips } from '~/mapModules/JunctionOptionsModule';

    $: left = $junctionChips?.left;
    $: right = $junctionChips?.right;
    $: ahead = $junctionChips?.ahead;
</script>

{#if left || right || ahead}
    <gridlayout columns="auto,*,auto" {...$$restProps}>
        {#if left}
            <Pill col={0} icon="mdi-arrow-left-top" label={formatDistance(left.distance)} />
        {/if}
        {#if ahead}
            <Pill
                col={1}
                horizontalAlignment="center"
                icon="mdi-hand-back-right"
                label={`${lc(ahead.kind === 'noEntry' ? 'junction_no_entry' : 'junction_road_ends')} · ${formatDistance(ahead.distance)}`} />
        {/if}
        {#if right}
            <Pill col={2} horizontalAlignment="right" icon="mdi-arrow-right-top" label={formatDistance(right.distance)} />
        {/if}
    </gridlayout>
{/if}
