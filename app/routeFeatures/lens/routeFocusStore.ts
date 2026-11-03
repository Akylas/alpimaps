/** What the user points at on the route: a cursor, a focused section. Pure: nothing here may import NativeScript. */
import { writable } from 'svelte/store';
import type { LensId } from '~/routeFeatures/registry';

export interface RouteFocus {
    itemKey: string;
    /** Scrubbing the profile, or the position on the route. `index` is into the profile data. */
    cursor?: { index: number; distance: number };
    /** A section of the active lens, `i0`..`i1` being profile data indexes. */
    section?: { lens: LensId; id: number; i0: number; i1: number };
}

export const routeFocus = writable<RouteFocus | null>(null);

type Cursor = RouteFocus['cursor'];
type Section = RouteFocus['section'];

/** What the store holds for this route: a state about another route is not carried over. */
function forItem(current: RouteFocus | null, itemKey: string): RouteFocus {
    return current?.itemKey === itemKey ? current : { itemKey };
}

export function setCursor(itemKey: string, cursor: Cursor) {
    routeFocus.update((current) => ({ ...forItem(current, itemKey), cursor }));
}

export function focusSection(itemKey: string, section: Section) {
    routeFocus.update((current) => ({ ...forItem(current, itemKey), section }));
}

export function clearCursor() {
    routeFocus.update((current) => {
        if (!current) {
            return current;
        }
        const { cursor: _cursor, ...rest } = current;
        return rest;
    });
}

export function clearSection() {
    routeFocus.update((current) => {
        if (!current) {
            return current;
        }
        const { section: _section, ...rest } = current;
        return rest;
    });
}

export function clearFocus() {
    routeFocus.set(null);
}
