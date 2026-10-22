// Where the actions of an item go, in the search result menu and in the selected-item sheet.
// This is the one place to edit: nothing else orders them.
export type ItemKind = 'default' | 'busStop' | 'railStation' | 'itinerary';

/** Lower comes first. Spaced by 10 so an action can slot between two others. */
export const ITEM_ACTION_ORDER: Record<string, number> = {
    itineraries: 5,
    information: 0,
    save: 10,
    navigate: 20,
    directions: 30,
    directions_from: 40,
    instructions: 50,
    profile: 60,
    stats: 70,
    edit: 80,
    hide: 90,
    transit: 100,
    rail: 110,
    wikipedia: 120,
    weather: 130,
    astronomy: 140,
    peaks: 145,
    compass: 150,
    address: 160,
    web: 200,
    share: 1000
};

/** Per kind of item, these come first in this order, whatever the table says. */
export const ITEM_ACTION_FIRST: Record<ItemKind, string[]> = {
    default: [],
    // the next trains of a station, the lines of a stop, then adding it
    railStation: ['rail', 'save'],
    busStop: ['transit', 'save'],
    itinerary: ['itineraries']
};

const UNKNOWN_ORDER = 500;
// above any index of ITEM_ACTION_FIRST, below nothing: the table's order comes after the firsts
const TABLE_OFFSET = 1000;

export function sortItemActions<T extends { id: string; order?: number }>(actions: T[], kind: ItemKind): T[] {
    const first = ITEM_ACTION_FIRST[kind];
    function rank(action: T) {
        const index = first.indexOf(action.id);
        return index >= 0 ? index : TABLE_OFFSET + (ITEM_ACTION_ORDER[action.id] ?? action.order ?? UNKNOWN_ORDER);
    }
    return actions.slice().sort((firstAction, secondAction) => rank(firstAction) - rank(secondAction));
}
