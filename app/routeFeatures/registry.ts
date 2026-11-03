import { type Readable, type Writable, derived, writable } from 'svelte/store';
import type { IItem } from '~/models/Item';

/** What every contribution is asked about. */
export interface RouteCtx {
    item: IItem;
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
    setting?: { title: string; store: Writable<boolean> };
    /** Fires when a contribution depends on something other than the item (a setting, the network...). */
    changes?: Readable<unknown>;
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
