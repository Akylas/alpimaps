<script lang="ts">
    // Transitous asks to be credited wherever its data is shown: every screen that uses it ends with this line
    import { lc } from '~/helpers/locale';
    import { openURL } from '~/utils/ui/index.common';
    import { colors, windowInset } from '~/variables';

    /** said before the credit, eg that the times are only the schedule */
    export let note: string = null;

    $: ({ colorOnSurfaceVariant } = $colors);
</script>

<label
    color={colorOnSurfaceVariant}
    fontSize={11}
    marginBottom={$windowInset.bottom}
    padding="4 16"
    text={(note ? note + ' · ' : '') + lc('transitous_attribution')}
    {...$$restProps}
    on:tap={() => openURL('https://transitous.org')} />
