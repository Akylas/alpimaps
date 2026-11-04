/** What the user points at on the route: a cursor, a focused section. Pure: nothing here may import NativeScript. */
import { writable } from 'svelte/store';
import type { IItem } from '~/models/Item';
import type { LensId, LensSection } from '~/routeFeatures/registry';
import { geometryKey } from '~/utils/routeAnalysis/geometryKey';

export interface RouteFocus {
    itemKey: string;
    /** Scrubbing the profile, or the position on the route. `index` is into the profile data. */
    cursor?: { index: number; distance: number };
    /** A section of the lens, `i0`..`i1` being profile data indexes. */
    section?: LensSection & { lens: LensId };
}

export const routeFocus = writable<RouteFocus | null>(null);

// an unsaved route has no id: its shape tells it from another
const shapeKeys = new WeakMap<object, string>();

/** What `RouteFocus.itemKey` is for a route. */
export function focusKeyOf(item: IItem): string {
    if (item?.id !== undefined) {
        return String(item.id);
    }
    if (!item?.geometry) {
        return '';
    }
    if (!shapeKeys.has(item.geometry)) {
        shapeKeys.set(item.geometry, geometryKey(item.geometry));
    }
    return shapeKeys.get(item.geometry);
}

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
