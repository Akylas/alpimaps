import { showBottomSheet } from '@nativescript-community/ui-bottomsheet/svelte';
import { showError } from '@shared/utils/showError';
import { lc } from '~/helpers/locale';
import { formatter } from '~/mapModules/ItemFormatter';
import { getMapContext } from '~/mapModules/MapModule';
import { registerMapFeature } from '~/mapModules/mapFeatures';
import type { IItem } from '~/models/Item';

/** Vector tiles say class/subclass. */
function itemIsBusStop(item: IItem) {
    return !item.route && (item.properties?.class === 'bus' || item.properties?.subclass === 'tram_stop');
}

/** The lines of a stop, each with its stops and timesheet. */
async function showItemStopLines(item: IItem) {
    try {
        if (item.geometry.type !== 'Point') {
            return;
        }
        const StopLinesBottomSheet = (await import('~/features/trains/StopLinesBottomSheet.svelte')).default;
        const [lon, lat] = item.geometry.coordinates;
        await showBottomSheet({
            parent: getMapContext().getMainPage(),
            trackingScrollView: 'scrollView',
            view: StopLinesBottomSheet,
            props: { name: formatter.getItemName(item), position: { lat, lon } }
        });
    } catch (error) {
        showError(error);
    }
}

registerMapFeature({
    id: 'stop',
    showsItemButtons: itemIsBusStop,
    // the lines of a stop, then adding it
    leadingActions: (item) => (itemIsBusStop(item) ? ['transit', 'save'] : []),
    itemActions: (item) => (itemIsBusStop(item) ? [{ id: 'transit', text: 'mdi-bus', tooltip: lc('bus_stop_infos'), order: 100, leavesSearch: false, onTap: () => showItemStopLines(item) }] : [])
});
