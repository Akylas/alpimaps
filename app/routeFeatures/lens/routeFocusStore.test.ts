import { get } from 'svelte/store';
import { beforeEach, describe, expect, it } from 'vitest';
import { clearCursor, clearFocus, clearSection, focusKeyOf, focusSection, routeFocus, setCursor } from './routeFocusStore';

const cursor = { index: 12, distance: 120 };
const section = { lens: 'climbs' as const, id: 1, i0: 10, i1: 40, title: 'cat 2' };

describe('routeFocus', () => {
    beforeEach(clearFocus);

    it('starts empty', () => {
        expect(get(routeFocus)).toBeNull();
    });

    it('keeps the section while the cursor moves on the same route', () => {
        focusSection('a', section);
        setCursor('a', cursor);
        expect(get(routeFocus)).toEqual({ itemKey: 'a', cursor, section });
    });

    it('keeps the cursor while a section is focused and cleared', () => {
        setCursor('a', cursor);
        focusSection('a', section);
        clearSection();
        expect(get(routeFocus)).toEqual({ itemKey: 'a', cursor });
    });

    it('clears the cursor alone', () => {
        setCursor('a', cursor);
        focusSection('a', section);
        clearCursor();
        expect(get(routeFocus)).toEqual({ itemKey: 'a', section });
    });

    it('drops what pointed at another route', () => {
        focusSection('a', section);
        setCursor('b', cursor);
        expect(get(routeFocus)).toEqual({ itemKey: 'b', cursor });
    });

    it('clears nothing in an empty state', () => {
        clearCursor();
        clearSection();
        expect(get(routeFocus)).toBeNull();
    });
});

describe('routeFocus notifications', () => {
    beforeEach(clearFocus);

    it('says nothing when there is nothing to clear', () => {
        setCursor('a', cursor);
        let notified = 0;
        const unsubscribe = routeFocus.subscribe(() => notified++);
        notified = 0;
        clearSection();
        clearFocus();
        unsubscribe();
        // only the last one, which has something to clear
        expect(notified).toBe(1);
        clearCursor();
        clearSection();
    });

    it('says nothing when the cursor is cleared twice', () => {
        setCursor('a', cursor);
        clearCursor();
        let notified = 0;
        const unsubscribe = routeFocus.subscribe(() => notified++);
        notified = 0;
        clearCursor();
        unsubscribe();
        expect(notified).toBe(0);
    });
});

describe('focusKeyOf', () => {
    it('keys a saved route by its id, whatever it is', () => {
        expect(focusKeyOf({ id: 7 } as never)).toBe('7');
        expect(focusKeyOf({ id: 0 } as never)).toBe('0');
    });

    it('keys a route with no id, or a null one, by its shape', () => {
        const geometry = {
            type: 'LineString' as const,
            coordinates: [
                [6, 45],
                [6.1, 45.1]
            ]
        };
        expect(focusKeyOf({ geometry } as never)).toBe(focusKeyOf({ id: null, geometry } as never));
        expect(focusKeyOf({ geometry } as never)).not.toBe('null');
    });
});
