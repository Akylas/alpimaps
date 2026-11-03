import { closeBottomSheet, showBottomSheet } from '@nativescript-community/ui-bottomsheet/svelte';
import { showError } from '@shared/utils/showError';
import { TRANSIT_SHEET_DETENTS } from '~/features/trains/transitSheet';
import type { TransitousStopTime } from '~/features/trains/TransitousService';
import { transitousService } from '~/features/trains/TransitousService';
import { lc } from '~/helpers/locale';
import { formatter } from '~/mapModules/ItemFormatter';
import { getMapContext } from '~/mapModules/MapModule';
import { registerMapFeature } from '~/mapModules/mapFeatures';
import type { IItem } from '~/models/Item';
import { decompress } from '~/services/NetworkService';

const RAIL_STATION_VALUES = ['station', 'halt'];

/** vector tiles say class/subclass, the geocoders osm_key/osm_value */
function itemIsRailStation(item: IItem) {
    const props = item.properties;
    return (props?.class === 'railway' && RAIL_STATION_VALUES.includes(props.subclass)) || (props?.osm_key === 'railway' && RAIL_STATION_VALUES.includes(props.osm_value));
}

async function showItemRailStation(item: IItem) {
    try {
        const RailStationBottomSheet = (await import('~/features/trains/RailStationBottomSheet.svelte')).default;
        if (item.geometry.type === 'Point') {
            const [lon, lat] = item.geometry.coordinates;
            await showBottomSheet({
                parent: getMapContext().getMainPage(),
                trackingScrollView: 'scrollView',
                detents: TRANSIT_SHEET_DETENTS,
                initialDetentIndex: 0,
                view: RailStationBottomSheet,
                props: { name: formatter.getItemName(item), position: { lat, lon } }
            });
        }
    } catch (err) {
        showError(err);
    }
}

/** a train's whole path, selected on the map like any line */
export async function showRailTrip(stopTime: TransitousStopTime) {
    try {
        const leg = await transitousService.getTrip(stopTime.tripId);
        if (!leg?.legGeometry) {
            return;
        }
        const coordinates = decompress(leg.legGeometry.points, leg.legGeometry.precision ?? 6).map(({ lat, lon }) => [lon, lat]);
        closeBottomSheet();
        await getMapContext().selectItem({
            item: {
                geometry: { type: 'LineString', coordinates },
                properties: {
                    class: 'railway',
                    name: [leg.displayName, leg.tripTo?.name].filter(Boolean).join(' → '),
                    subtitle: leg.agencyName,
                    color: leg.routeColor ? `#${leg.routeColor}` : undefined
                },
                route: { osmid: leg.tripId, type: 'rail' }
            },
            isFeatureInteresting: true,
            showButtons: true
        });
    } catch (err) {
        showError(err);
    }
}

registerMapFeature({
    id: 'rail',
    showsItemButtons: itemIsRailStation,
    // the next trains of a station, then adding it
    leadingActions: (item) => (itemIsRailStation(item) ? ['rail', 'save'] : []),
    itemActions: (item) =>
        itemIsRailStation(item) ? [{ id: 'rail', text: 'mdi-train', tooltip: lc('rail_station_infos'), order: 110, leavesSearch: false, onTap: () => showItemRailStation(item) }] : []
});
