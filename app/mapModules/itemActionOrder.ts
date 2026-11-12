// Where the actions of an item go, in the search result menu and in the selected-item sheet.
// The built-in actions are ordered here; an action a feature adds carries its own `order`, and a feature can
// put actions first for an item with `leadingActions`.

/** Lower comes first. Spaced by 10 so an action can slot between two others. */
export const ITEM_ACTION_ORDER: Record<string, number> = {
    information: 0,
    plan: 5,
    edit: 6,
    save: 10,
    navigate: 20,
    directions: 30,
    directions_from: 40,
    instructions: 50,
    profile: 60,
    stats: 70,
    hide: 90,
    wikipedia: 120,
    weather: 130,
    astronomy: 140,
    peaks: 145,
    compass: 150,
    address: 160,
    web: 200,
    share: 1000
};

const UNKNOWN_ORDER = 500;
// above any index of the leading ids, below nothing: the table's order comes after them
const TABLE_OFFSET = 1000;

export function sortItemActions<T extends { id: string; order?: number }>(actions: T[], first: string[]): T[] {
    function rank(action: T) {
        const index = first.indexOf(action.id);
        return index >= 0 ? index : TABLE_OFFSET + (ITEM_ACTION_ORDER[action.id] ?? action.order ?? UNKNOWN_ORDER);
    }
    return actions.slice().sort((firstAction, secondAction) => rank(firstAction) - rank(secondAction));
}
