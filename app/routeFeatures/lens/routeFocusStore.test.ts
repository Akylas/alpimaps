import { get } from 'svelte/store';
import { beforeEach, describe, expect, it } from 'vitest';
import { clearCursor, clearFocus, clearSection, focusSection, routeFocus, setCursor } from './routeFocusStore';

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
