<script lang="ts">
    // what a ride that was just recorded says of itself, and where to go from there: see it, or throw it away
    import { closeBottomSheet } from '@nativescript-community/ui-bottomsheet/svelte';
    import { showError } from '@shared/utils/showError';
    import PanelHeader from '~/components/common/PanelHeader.svelte';
    import Pill from '~/components/common/Pill.svelte';
    import { convertDurationSeconds, formatDistance } from '~/helpers/formatter';
    import { lc } from '~/helpers/locale';
    import { getMapContext } from '~/mapModules/MapModule';
    import type { Item } from '~/models/Item';
    import { showRoutePage } from '~/routeFeatures/page/index';
    import { colors } from '~/variables';

    export let item: Item;
    /** metres */
    export let distance: number;
    /** seconds */
    export let elapsed: number;

    let { colorOnSurfaceVariant } = $colors;
    $: ({ colorOnSurfaceVariant } = $colors);

    function seeRide() {
        closeBottomSheet();
        showRoutePage(item);
    }
    async function discard() {
        try {
            closeBottomSheet();
            await getMapContext().mapModule('items').deleteItem(item);
        } catch (error) {
            showError(error);
        }
    }
</script>

<gesturerootview class="bottomsheet" rows="auto,auto,auto">
    <PanelHeader icon="mdi-check-circle-outline" subtitle={`${formatDistance(distance)} · ${convertDurationSeconds(elapsed)}`} title={lc('ride_saved')} />
    <label color={colorOnSurfaceVariant} fontSize={13} lineBreak="end" maxLines={1} padding="0 16" row={1} text={item.properties?.name || ''} />
    <stacklayout margin="12 16 16 16" orientation="horizontal" row={2}>
        <Pill height={36} icon="mdi-map-marker-path" label={lc('ride_see')} marginRight={8} primary={true} on:tap={seeRide} />
        <Pill danger={true} height={36} icon="mdi-delete-outline" label={lc('ride_discard')} on:tap={discard} />
    </stacklayout>
</gesturerootview>
