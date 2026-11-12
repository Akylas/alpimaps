<script lang="ts">
    // the climbs of a route, each with its sparkline, and under them the steep sections, folded away until asked for.
    // A descent is listed like the rest and never warned about. A tap on a row focuses it on the route.
    // One collectionview whatever the rows: its rows are built as they come into view
    import { Template } from '@nativescript-community/svelte-native/components';
    import { closeBottomSheet } from '@nativescript-community/ui-bottomsheet/svelte';
    import PanelHeader from '~/components/common/PanelHeader.svelte';
    import { lc } from '~/helpers/locale';
    import type { IItem } from '~/models/Item';
    import ClimbsRow from '~/routeFeatures/climbs/ClimbsRow.svelte';
    import { type ClimbsRowData, climbsRows, readClimbs } from '~/routeFeatures/climbs/data';
    import { climbsSteepOpen } from '~/routeFeatures/climbs/settings';
    import { focusKeyOf } from '~/routeFeatures/lens/routeFocusStore';
    import { focusLensSection } from '~/routeFeatures/lens/routeLensStore';
    import { type LensSection, endVisit } from '~/routeFeatures/registry';
    import { onDestroy } from 'svelte';
    import { windowInset } from '~/variables';

    export let item: IItem;
    // the steep list is folded again the next time
    onDestroy(endVisit);

    $: rows = climbsRows(readClimbs(item), $climbsSteepOpen);
    function itemTemplateSelector(row: ClimbsRowData) {
        return row.type;
    }

    function focus(section: LensSection) {
        if (!section) {
            return;
        }
        focusLensSection(focusKeyOf(item), 'climbs', section);
        // the map is behind the sheet, and that is where the section is shown
        closeBottomSheet();
    }
</script>

<gesturerootview class="bottomsheet" rows="auto,*">
    <PanelHeader icon="mdi-slope-uphill" title={lc('lens_climbs')} />
    <!-- the inset goes on the content: the collectionview scrolls under it -->
    <collectionview id="scrollView" {itemTemplateSelector} items={rows} paddingBottom={10 + (__ANDROID__ ? $windowInset.bottom : 0)} row={1} ios:contentInsetAdjustmentBehavior={2}>
        <Template key="climb" let:item={row}>
            <ClimbsRow data={row} {item} on:focus={(section) => focus(section)} />
        </Template>
        <Template key="header" let:item={row}>
            <ClimbsRow data={row} {item} />
        </Template>
        <Template key="steep" let:item={row}>
            <ClimbsRow data={row} {item} on:focus={(section) => focus(section)} />
        </Template>
    </collectionview>
</gesturerootview>
