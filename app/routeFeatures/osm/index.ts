import { derived, get } from 'svelte/store';
import { OSM_DETAILS_FRESH_DURATION, canLookupOSMDetails, networkOnline, osmDetailsStates, osmItemKey } from '~/helpers/osmDetails';
import { lc } from '~/helpers/locale';
import { getMapContext } from '~/mapModules/MapModule';
import type { Item } from '~/models/Item';
import { osmCardHeight, osmCardLayout, osmFacts } from '~/routeFeatures/osm/layout';
import { registerRouteFeature } from '~/routeFeatures/registry';
import { osmItemDetails } from '~/stores/mapStore';
import { fontScaleMaxed } from '~/variables';

// looked up on use: the items module registers after this file is loaded
const getItemsModule = () => getMapContext().mapModule('items');
let lookupKey: string = null;
let savedKey: string = null;

// what the places we looked up before already tell: the hours show right away, offline too
async function loadSavedDetails(selected: Item, enabled: boolean) {
    if (!enabled) {
        savedKey = null;
        return;
    }
    const key = osmItemKey(selected);
    if (key === savedKey) {
        return;
    }
    savedKey = key;
    try {
        const saved = await getItemsModule().getCachedOSMDetails(selected);
        if (saved && !selected.properties.opening_hours) {
            await getItemsModule().mergeSelectedItemProperties(selected, saved.properties);
        }
    } catch (error) {
        DEV_LOG && console.error('loadSavedOSMDetails', error);
    }
}

// once per selection, when the card is on show: a lookup less than a day old is left alone
async function startLookup(selected: Item) {
    const key = osmItemKey(selected);
    if (key === lookupKey) {
        return;
    }
    lookupKey = key;
    if (!get(networkOnline)) {
        return;
    }
    try {
        const fetchedAt = get(osmDetailsStates)[key]?.fetchedAt;
        if (fetchedAt === undefined || Date.now() - fetchedAt >= OSM_DETAILS_FRESH_DURATION) {
            await getItemsModule().loadOSMDetails(selected, fetchedAt !== undefined);
        }
    } catch (error) {
        DEV_LOG && console.error('startOSMDetails', error);
    }
}

registerRouteFeature({
    id: 'osm',
    order: 30,
    setting: { title: () => lc('osm_item_details'), store: osmItemDetails },
    // the height follows the connection, the font scale and what the lookup found
    changes: derived([networkOnline, osmDetailsStates, fontScaleMaxed], (values) => values),
    sheetCard: {
        component: () => import('~/routeFeatures/osm/SheetCard.svelte'),
        // a place we can match, whatever the connection, or one with facts to show
        height: ({ item }, gap) => {
            if (!canLookupOSMDetails(item) && osmFacts(item).length === 0) {
                return 0;
            }
            return osmCardHeight(osmCardLayout(item, get(networkOnline), get(osmDetailsStates)[osmItemKey(item)]), get(fontScaleMaxed), gap);
        },
        watch: ({ item, shown }) => {
            const allowed = canLookupOSMDetails(item);
            loadSavedDetails(item, allowed);
            if (allowed && shown) {
                startLookup(item);
            } else if (!allowed) {
                lookupKey = null;
            }
        }
    }
});
