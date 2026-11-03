import type { ComponentType } from 'svelte';
import { type Readable, derived, readable } from 'svelte/store';
import type { IItem } from '~/models/Item';
import type { MapPos } from '~/utils/geo';

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
    /** Group in the main menu. Defaults to `app`. */
    section?: 'map' | 'tools' | 'data' | 'app';
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
    /** In the search result menu: the action needs the map, so search lets go of the screen. Defaults to true. */
    leavesSearch?: boolean;
    /** The sheet's filled button, when no built-in action claims it. */
    main?: boolean;
    onTap: () => void | Promise<void>;
    onLongPress?: (event?) => void | Promise<void>;
}

/** An end of the route the directions panel asks a mode to compute. */
export interface DirectionsPlace {
    name: string;
    position: MapPos;
}

/**
 * Another way of getting from A to B than a routing profile: the directions panel offers it next to the profiles, and
 * hands it the first and last points when the user asks for the route.
 */
export interface DirectionsMode {
    id: string;
    /** The icon of the mode's pill. */
    icon: string;
    /** Lower sorts earlier. */
    order?: number;
    /** The pills of the options row while the mode is on, loaded the first time. They keep their own state. */
    options?: () => Promise<{ default: ComponentType }>;
    /** A list of the user's past requests: the panel shows its button while it is not empty. */
    history?: { items: Readable<unknown[]>; show: () => void | Promise<void> };
    /** The panel has already cleared the routes it drew. */
    compute: (context: { from: DirectionsPlace; to: DirectionsPlace }) => void | Promise<void>;
    /** The panel is cancelled: whatever the mode drew on the map goes. */
    clear?: () => void;
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
    /** Ids of the actions that come first for this item, in this order, whatever their `order`. */
    leadingActions?: (item: IItem) => string[];
    /** The feature owns this item: the sheet's built-in actions do not apply to it, only the feature's own. */
    claimsItem?: (item: IItem) => boolean;
    /** A tap on a map feature that becomes this item opens the sheet with its buttons. */
    showsItemButtons?: (item: IItem) => boolean;
    directionsModes?: DirectionsMode[];
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

export function featureLeadingActions(item: IItem): string[] {
    return features.flatMap((feature) => feature.leadingActions?.(item) ?? []);
}

export function featureClaimsItem(item: IItem): boolean {
    return features.some((feature) => feature.claimsItem?.(item));
}

export function featureShowsItemButtons(item: IItem): boolean {
    return features.some((feature) => feature.showsItemButtons?.(item));
}

export function featureDirectionsModes(): DirectionsMode[] {
    return features.flatMap((feature) => feature.directionsModes ?? []).sort((first, second) => (first.order ?? 0) - (second.order ?? 0));
}

export function featureMenuItems(menu: 'main' | 'overflow' = 'main'): Readable<MapMenuItem[]> {
    return derived(
        combine<MapMenuItem>((feature) => feature.menuItems),
        (items) => items.filter((item) => (item.menu ?? 'main') === menu).sort((first, second) => (first.order ?? 0) - (second.order ?? 0))
    );
}
