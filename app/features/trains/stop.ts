import type { Page } from '@nativescript/core';
import type { NativeViewElementNode } from '@nativescript-community/svelte-native/dom';
import { showBottomSheet } from '@nativescript-community/ui-bottomsheet/svelte';
import { showError } from '@shared/utils/showError';
import { TRANSIT_SHEET_DETENTS } from '~/features/trains/transitSheet';
import { lc } from '~/helpers/locale';
import { formatter } from '~/mapModules/ItemFormatter';
import { getMapContext } from '~/mapModules/MapModule';
import { registerMapFeature } from '~/mapModules/mapFeatures';
import type { IItem } from '~/models/Item';
import type { MapPos } from '~/utils/geo';

/** Vector tiles say class/subclass. */
function itemIsBusStop(item: IItem) {
    return !item.route && (item.properties?.class === 'bus' || item.properties?.subclass === 'tram_stop');
}

/** The lines of a stop, each with its stops and timesheet; `parent`: the page to show it over, the one on top when missing. */
export async function showStopLines(name: string, position: MapPos, parent?: NativeViewElementNode<Page>) {
    try {
        const StopLinesBottomSheet = (await import('~/features/trains/StopLinesBottomSheet.svelte')).default;
        await showBottomSheet({
            ...(parent ? { parent } : {}),
            trackingScrollView: 'scrollView',
            detents: TRANSIT_SHEET_DETENTS,
            initialDetentIndex: 0,
            view: StopLinesBottomSheet,
            props: { name, position }
        });
    } catch (error) {
        showError(error);
    }
}

function showItemStopLines(item: IItem) {
    if (item.geometry.type === 'Point') {
        const [lon, lat] = item.geometry.coordinates;
        return showStopLines(formatter.getItemName(item), { lat, lon }, getMapContext().getMainPage());
    }
}

registerMapFeature({
    id: 'stop',
    showsItemButtons: itemIsBusStop,
    // the lines of a stop, then adding it
    leadingActions: (item) => (itemIsBusStop(item) ? ['transit', 'save'] : []),
    itemActions: (item) => (itemIsBusStop(item) ? [{ id: 'transit', text: 'mdi-bus', tooltip: lc('bus_stop_infos'), order: 100, leavesSearch: false, onTap: () => showItemStopLines(item) }] : [])
});
