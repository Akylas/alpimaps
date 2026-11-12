import { describe, expect, it } from 'vitest';
import { type SyncableList, syncList } from './syncList';

interface Row {
    id: string;
    value: number;
}

/** An array that tells what was done to it. */
function recorded(rows: Row[]): SyncableList<Row> & { items: Row[]; calls: string[] } {
    const items = [...rows];
    const calls: string[] = [];
    return {
        items,
        calls,
        get length() {
            return items.length;
        },
        getItem: (index) => items[index],
        setItem: (index, item) => {
            calls.push('set ' + index);
            items[index] = item;
        },
        splice: (start, deleteCount = 0, ...added) => {
            calls.push(`splice ${start},${deleteCount},${added.length}`);
            return items.splice(start, deleteCount, ...added);
        }
    };
}
const row = (id: string, value = 0): Row => ({ id, value });
const key = (item: Row) => item.id;

describe('syncList', () => {
    it('does nothing when nothing changed', () => {
        const list = recorded([row('a'), row('b')]);
        syncList(list, 0, 2, [row('a'), row('b')]);
        expect(list.calls).toEqual([]);
    });

    it('changes a row in place when it is matched by place', () => {
        const list = recorded([row('a'), row('b'), row('c')]);
        syncList(list, 0, 3, [row('a'), row('x', 1), row('c')]);
        expect(list.calls).toEqual(['set 1']);
        expect(list.items.map(key)).toEqual(['a', 'x', 'c']);
    });

    it('changes a row with the same key in place', () => {
        const list = recorded([row('a'), row('b')]);
        syncList(list, 0, 2, [row('a'), row('b', 5)], { key });
        expect(list.calls).toEqual(['set 1']);
        expect(list.items[1].value).toBe(5);
    });

    it('adds the rows past the end only', () => {
        const list = recorded([row('a')]);
        syncList(list, 0, 1, [row('a'), row('b'), row('c')]);
        expect(list.calls).toEqual(['splice 1,0,2']);
        expect(list.items.map(key)).toEqual(['a', 'b', 'c']);
    });

    it('removes the rows past the end only', () => {
        const list = recorded([row('a'), row('b'), row('c')]);
        syncList(list, 0, 3, [row('a')]);
        expect(list.calls).toEqual(['splice 1,2,0']);
        expect(list.items.map(key)).toEqual(['a']);
    });

    it('replaces everything from the first row with another key', () => {
        const list = recorded([row('a'), row('b'), row('c')]);
        syncList(list, 0, 3, [row('a'), row('x'), row('c')], { key });
        expect(list.calls).toEqual(['splice 1,2,2']);
        expect(list.items.map(key)).toEqual(['a', 'x', 'c']);
    });

    it('stays inside its window', () => {
        const list = recorded([row('head'), row('a'), row('b'), row('tail')]);
        syncList(list, 1, 2, [row('a'), row('b', 1), row('c')], { key });
        expect(list.items.map(key)).toEqual(['head', 'a', 'b', 'c', 'tail']);
        expect(list.items[2].value).toBe(1);
    });

    it('fills an empty window', () => {
        const list = recorded([row('head'), row('tail')]);
        syncList(list, 1, 0, [row('a')]);
        expect(list.items.map(key)).toEqual(['head', 'a', 'tail']);
    });

    it('empties a window', () => {
        const list = recorded([row('head'), row('a'), row('tail')]);
        syncList(list, 1, 1, []);
        expect(list.items.map(key)).toEqual(['head', 'tail']);
    });

    it("takes the caller's word on what is the same", () => {
        const list = recorded([row('a', 1)]);
        syncList(list, 0, 1, [row('a', 2)], { key, same: (shown, next) => shown.id === next.id });
        expect(list.calls).toEqual([]);
    });
});
