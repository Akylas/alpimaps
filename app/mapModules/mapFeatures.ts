import { type Readable, derived, readable } from 'svelte/store';
import type { IItem } from '~/models/Item';

/**
 * One button in the map's side bar. Matches what `ButtonBar` already consumes, so a feature can
 * contribute one without the bar knowing anything about the feature.
 */
export interface MapSideButton {
    id?: string;
    text: string;
    tooltip?: string;
    /** Position in the bar, low first. Lets a feature slot itself between buttons it does not own. */
    order?: number;
    visible?: boolean;
    isSelected?: boolean;
    selectedColor?: string;
    color?: string;
    gray?: boolean;
    fontFamily?: string;
    onTap?: (event?, button?) => void;
    onLongPress?: (event?, button?) => void;
}

/**
 * One entry in one of the map's two menus. `run` replaces the switch statements this used to need.
 *
 * The map has a main menu behind the top-right button and an overflow menu behind the side bar's dots,
 * so an entry has to say which one it belongs to.
 */
export interface MapMenuItem {
    id: string;
    title: string;
    icon?: string;
    color?: string;
    /** Defaults to the main menu. */
    menu?: 'main' | 'overflow';
    /** Lower sorts earlier; the built-in entries sit at 0. */
    order?: number;
    run: () => void | Promise<void>;
    onLongPress?: () => void | Promise<void>;
}

/** One button in the selected item's action row. */
export interface MapItemAction {
    id: string;
    text: string;
    tooltip?: string;
    /** Lower sorts earlier; the sheet's own actions are spaced 10 apart from 0. */
    order?: number;
    onTap: () => void | Promise<void>;
    onLongPress?: (event?) => void | Promise<void>;
}

/**
 * A self-contained piece of map functionality: its layers, its controls and its menu entries live
 * together in one file instead of being spread across the map component.
 *
 * `sideButtons` and `menuItems` are stores because what they contain depends on state that changes
 * long after startup — offline data finishing its scan, a toggle flipping. Returning plain arrays
 * would mean the map having to know when to ask again, which is exactly the coupling this removes.
 */
export interface MapFeature {
    id: string;
    /** Build-flag or platform gate. Checked once at registration. */
    enabled?: () => boolean;
    sideButtons?: Readable<MapSideButton[]>;
    menuItems?: Readable<MapMenuItem[]>;
    /**
     * Actions for the selected item. A function rather than a store because it depends on the item,
     * which the sheet already re-evaluates on every selection.
     */
    itemActions?: (item: IItem) => MapItemAction[];
}

const features: MapFeature[] = [];

/**
 * Features register at module load (a static import from the map), so everything is in place before
 * the stores below are first read.
 */
export function registerMapFeature(feature: MapFeature) {
    if (feature.enabled && !feature.enabled()) {
        return;
    }
    if (features.some((registered) => registered.id === feature.id)) {
        return;
    }
    features.push(feature);
}

export function getMapFeatures(): readonly MapFeature[] {
    return features;
}

const EMPTY = readable([]);

function combine<T>(pick: (feature: MapFeature) => Readable<T[]> | undefined): Readable<T[]> {
    const stores: Readable<T[]>[] = [];
    for (const feature of features) {
        const store = pick(feature);
        if (store) {
            stores.push(store);
        }
    }
    if (!stores.length) {
        return EMPTY;
    }
    return derived(stores, (lists) => lists.flat());
}

/** All registered features' side buttons, flattened and ordered. Read once, after registration. */
export function featureSideButtons(): Readable<MapSideButton[]> {
    return derived(
        combine<MapSideButton>((feature) => feature.sideButtons),
        (buttons) => buttons.slice().sort((first, second) => (first.order ?? 0) - (second.order ?? 0))
    );
}

/** Actions every registered feature offers for `item`, ordered. */
export function featureItemActions(item: IItem): MapItemAction[] {
    return features.flatMap((feature) => feature.itemActions?.(item) ?? []).sort((first, second) => (first.order ?? 0) - (second.order ?? 0));
}

/** Registered features' entries for one of the two menus, ordered. */
export function featureMenuItems(menu: 'main' | 'overflow' = 'main'): Readable<MapMenuItem[]> {
    return derived(
        combine<MapMenuItem>((feature) => feature.menuItems),
        (items) => items.filter((item) => (item.menu ?? 'main') === menu).sort((first, second) => (first.order ?? 0) - (second.order ?? 0))
    );
}
