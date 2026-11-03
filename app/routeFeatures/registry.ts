import type { Feature } from 'geojson';
import type { ComponentType } from 'svelte';
import { type Readable, type Writable, derived, writable } from 'svelte/store';
import type { IItem } from '~/models/Item';

/** What every contribution is asked about. */
export interface RouteCtx {
    item: IItem;
}

/** A compact stat of the sheet's header. */
export interface RouteTile {
    key: string;
    icon: string;
    /** Spoken by the long press tooltip. */
    label: string;
    value: string;
    /** A smaller line under the value; a selected point's remaining figure takes its place. */
    sub?: { icon: string; text: string };
}

/**
 * A card of the item sheet. Its component gets the sheet's layout props and `item`. It may export
 * `highlightPathIndex(params, highlight?, sendEvent?)` and `reload()` for the sheet to drive, and dispatch
 * `highlight` with `{ lat, lon, highlight }` when a point of the route is picked in it.
 */
export interface RouteSheetCard {
    /** Loaded the first time the card has a height, so its code stays out of the startup graph. */
    component: () => Promise<{ default: ComponentType }>;
    /** dp the card takes, the gap above it included. 0: nothing to show, so no step. */
    height: (ctx: RouteCtx, gap: number) => number;
    /** The sheet works out the user's progress along the route, for a card that shows it. */
    followsPosition?: boolean;
    /** Runs whenever the item, the layout or the sheet's step change; `shown`: the sheet has reached the card. */
    watch?: (ctx: RouteCtx & { shown: boolean }) => void;
}

export interface RouteSheetCardLayout {
    id: string;
    card: RouteSheetCard;
    height: number;
}

/**
 * A block of the navigation sheet. Its component gets the card props the view passes: `item`, the
 * background and border for a `details` card, `height` and `marginRight` for an `ahead` widget.
 */
export interface RouteNavSection {
    id: string;
    /** `ahead`: a widget of the one row above the actions; `details`: a card of its own under them. */
    slot: 'ahead' | 'details';
    /** Loaded the first time the section has a height, the navigation ui is not part of the startup graph. */
    component: () => Promise<{ default: ComponentType }>;
    /** dp at the navigation scale. 0: nothing to show, so no row. */
    height: (scale: number, ctx: RouteCtx) => number;
    /** The share of the ahead row's width. */
    weight?: number;
}

export interface RouteNavSectionLayout {
    id: string;
    section: RouteNavSection;
    height: number;
}

/**
 * One route-analysis feature: it plugs its pieces into the sheet, the navigation and the map, and can be
 * switched off without any other code changing. Contribution points are added with their consumer.
 */
export interface RouteFeature {
    id: string;
    /** Lower sorts earlier, in every surface. */
    order: number;
    /** Build-flag or platform gate. Checked once at registration. */
    enabled?: () => boolean;
    /** The user's switch, listed in Settings > Routing > Route analysis. A store, so existing settings are reused. */
    setting?: { title: () => string; store: Writable<boolean> };
    /** Fires when a contribution depends on something other than the item (a setting, the network...). */
    changes?: Readable<unknown>;
    /** The header's tiles, in the feature's order. */
    tiles?: (ctx: RouteCtx) => RouteTile[];
    /** A card under the sheet's actions. */
    sheetCard?: RouteSheetCard;
    /** Blocks of the navigation sheet. */
    navSections?: RouteNavSection[];
    /**
     * GeoJSON features drawn with the route: the selected one, or the one being navigated. Rebuilt when the item,
     * the route or a feature switch changes, never per GPS fix, so keep it to what the route itself needs.
     */
    mapFeatures?: (ctx: RouteCtx & { navigating: boolean }) => Feature[];
}

const registered = writable<RouteFeature[]>([]);

/** Called at module load, so every feature is registered before the first surface renders. */
export function registerRouteFeature(feature: RouteFeature) {
    if (feature.enabled && !feature.enabled()) {
        return;
    }
    registered.update((features) => {
        if (features.some((existing) => existing.id === feature.id)) {
            return features;
        }
        return [...features, feature].sort((first, second) => first.order - second.order);
    });
}

/** Every registered feature, switched on or not: the settings page lists these. */
export const allRouteFeatures: Readable<RouteFeature[]> = registered;

/** The registered features whose user switch is on. */
export const routeFeatures: Readable<RouteFeature[]> = derived(
    registered,
    (features, set) => {
        const on = features.map(() => true);
        const emit = () => set(features.filter((_, index) => on[index]));
        const unsubscribers = features.map((feature, index) =>
            feature.setting?.store.subscribe((value) => {
                on[index] = value;
                emit();
            })
        );
        emit();
        return () => unsubscribers.forEach((unsubscribe) => unsubscribe?.());
    },
    [] as RouteFeature[]
);

/** Ticks whenever an enabled feature says its contributions changed. */
export const routeFeatureChanges: Readable<number> = derived(
    routeFeatures,
    (features, set) => {
        let count = 0;
        const unsubscribers = features.map((feature) => feature.changes?.subscribe(() => set(++count)));
        return () => unsubscribers.forEach((unsubscribe) => unsubscribe?.());
    },
    0
);

export function routeTiles(features: RouteFeature[], ctx: RouteCtx): RouteTile[] {
    return features.flatMap((feature) => feature.tiles?.(ctx) ?? []);
}

/** Every enabled card, in order, with its height now; a height of 0 is kept so the card stays mounted. */
export function routeSheetCards(features: RouteFeature[], ctx: RouteCtx, gap: number): RouteSheetCardLayout[] {
    return features.filter((feature) => feature.sheetCard).map((feature) => ({ id: feature.id, card: feature.sheetCard, height: feature.sheetCard.height(ctx, gap) }));
}

/** The navigation sections that have something to show, in feature order. */
export function routeNavSections(features: RouteFeature[], ctx: RouteCtx, scale: number): RouteNavSectionLayout[] {
    return features
        .flatMap((feature) => feature.navSections ?? [])
        .map((section) => ({ id: section.id, section, height: section.height(scale, ctx) }))
        .filter((layout) => layout.height > 0);
}

/** Lazy components, loaded once and kept. A store, so the view renders a component when it arrives. */
export function lazyComponents() {
    const { subscribe, update } = writable<Record<string, ComponentType>>({});
    const requested = new Set<string>();
    return {
        subscribe,
        async load(id: string, loader: () => Promise<{ default: ComponentType }>) {
            if (requested.has(id)) {
                return;
            }
            requested.add(id);
            try {
                const component = (await loader()).default;
                update((components) => ({ ...components, [id]: component }));
            } catch (error) {
                requested.delete(id);
                console.error('lazyComponents', id, error);
            }
        }
    };
}

/** What the enabled features add to the route's layer. */
export function routeMapFeatures(features: RouteFeature[], ctx: RouteCtx & { navigating: boolean }): Feature[] {
    return features.flatMap((feature) => feature.mapFeatures?.(ctx) ?? []);
}
