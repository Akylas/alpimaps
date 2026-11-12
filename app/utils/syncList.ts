/** What a list view's items must offer: an ObservableArray does. Pure: nothing here may import NativeScript. */
export interface SyncableList<Item> {
    length: number;
    getItem(index: number): Item;
    setItem(index: number, item: Item): void;
    splice(start: number, deleteCount?: number, ...items: Item[]): unknown;
}

export interface SyncOptions<Item> {
    /** two items with another key are not the same row: from there on the rows are replaced. Without it, the rows are matched by place. */
    key?: (item: Item) => string;
    /** what tells a row that did not change from one that did. By default, what they serialize to. */
    same?: (shown: Item, next: Item) => boolean;
}

/** Changes the `count` items of the list from `start` into `next`, as little as it can: a new array would rebuild every row. */
export function syncList<Item>(
    list: SyncableList<Item>,
    start: number,
    count: number,
    next: Item[],
    { key, same = (shown, wanted) => JSON.stringify(shown) === JSON.stringify(wanted) }: SyncOptions<Item> = {}
) {
    let kept = 0;
    while (kept < count && kept < next.length) {
        const shown = list.getItem(start + kept);
        if (key && key(shown) !== key(next[kept])) {
            break;
        }
        if (!same(shown, next[kept])) {
            list.setItem(start + kept, next[kept]);
        }
        kept++;
    }
    if (count > kept || next.length > kept) {
        list.splice(start + kept, count - kept, ...next.slice(kept));
    }
}
