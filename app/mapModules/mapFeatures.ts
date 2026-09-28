import { type Readable, derived, readable } from 'svelte/store';
import type { IItem } from '~/models/Item';

/** Matches what `ButtonBar` consumes. */
export interface MapSideButton {
    id?: string;
    text: string;
    tooltip?: string;
    /** Lower sorts earlier. */
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

export interface MapMenuItem {
    id: string;
    title: string;
    icon?: string;
    color?: string;
    /** `main`: behind the top-right button, `overflow`: behind the side bar's dots. Defaults to `main`. */
    menu?: 'main' | 'overflow';
    /** Lower sorts earlier; the built-in entries sit at 0. */
    order?: number;
    run: () => void | Promise<void>;
    onLongPress?: () => void | Promise<void>;
}

export interface MapItemAction {
    id: string;
    text: string;
    tooltip?: string;
    /** Lower sorts earlier; the sheet's own actions are spaced 10 apart from 0. */
    order?: number;
    onTap: () => void | Promise<void>;
    onLongPress?: (event?) => void | Promise<void>;
}

/** `sideButtons`/`menuItems` are stores: their content depends on state that changes long after startup. */
export interface MapFeature {
    id: string;
    /** Build-flag or platform gate. Checked once at registration. */
    enabled?: () => boolean;
    sideButtons?: Readable<MapSideButton[]>;
    menuItems?: Readable<MapMenuItem[]>;
    /** A function, not a store: the sheet already re-evaluates it on every selection. */
    itemActions?: (item: IItem) => MapItemAction[];
}

const features: MapFeature[] = [];

/** Called at module load, so every feature is registered before the stores below are first read. */
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

/** Read once, after registration. */
export function featureSideButtons(): Readable<MapSideButton[]> {
    return derived(
        combine<MapSideButton>((feature) => feature.sideButtons),
        (buttons) => buttons.slice().sort((first, second) => (first.order ?? 0) - (second.order ?? 0))
    );
}

export function featureItemActions(item: IItem): MapItemAction[] {
    return features.flatMap((feature) => feature.itemActions?.(item) ?? []).sort((first, second) => (first.order ?? 0) - (second.order ?? 0));
}

export function featureMenuItems(menu: 'main' | 'overflow' = 'main'): Readable<MapMenuItem[]> {
    return derived(
        combine<MapMenuItem>((feature) => feature.menuItems),
        (items) => items.filter((item) => (item.menu ?? 'main') === menu).sort((first, second) => (first.order ?? 0) - (second.order ?? 0))
    );
}
