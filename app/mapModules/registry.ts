import type { MassifMap } from '@nativescript-community/ui-massifmaps/api';
import { executeOnMainThread } from '@nativescript/core/utils';
import { globalObservable } from '@shared/utils/svelte/ui';
import type { GeoHandler } from '~/handlers/GeoHandler';
import type { IItem } from '~/models/Item';
import type { ElementClickData, FeatureClickData, MapClickData, MapDecoder, MapInteraction, MapMoveReason } from '~/mapModules/MapModule';

/**
 * Every hook the map dispatches, with the arguments it dispatches them with.
 *
 * This is the contract `runOnModules` is checked against — adding a hook here is what makes it
 * callable. It used to be a bare `functionName: string`, which let four hooks (`onMapIdle`,
 * `onMapStable`, `reloadMapStyle`, `vectorTileDecoderChanged`) be dispatched for a long time without
 * ever being declared on the module base class.
 *
 * A hook returning a truthy value means "handled, stop" — see `runOnModules`.
 */
export interface MapModuleHooks {
    onMapReady: [MassifMap];
    onMapDestroyed: [];
    onServiceLoaded: [GeoHandler];
    onServiceUnloaded: [GeoHandler];
    onMapMove: [{ data: { reason: MapMoveReason } }];
    onMapInteraction: [{ data: MapInteraction }];
    onMapClicked: [{ data: MapClickData }];
    onMapIdle: [unknown];
    onMapStable: [{ data: { reason: MapMoveReason } }];
    onSelectedItem: [IItem, IItem];
    onVectorTileClicked: [FeatureClickData];
    onVectorElementClicked: [ElementClickData];
    onVectorTileElementClicked: [FeatureClickData];
    reloadMapStyle: [];
    vectorTileDecoderChanged: [MapDecoder, MapDecoder];
}

export type MapModuleHook = keyof MapModuleHooks;

/**
 * The modules the map dispatches to, keyed by id.
 *
 * Deliberately open: a feature adds its own key by augmenting this interface from its own file, so
 * registering a module does not mean editing this one.
 *
 *     declare module '~/mapModules/registry' {
 *         interface MapModules {
 *             transit: TransitModule;
 *         }
 *     }
 *
 * Values are heterogeneous on purpose — some are `MapModule` subclasses, others are svelte components
 * that happen to export matching hook functions.
 */
// intentionally empty: it exists purely as a seam for `declare module` augmentation, and every key
// comes from a feature declaring its own
// eslint-disable-next-line @typescript-eslint/no-empty-object-type
export interface MapModules {}

/** Anything registered here only has to implement the hooks it cares about. */
export type MapModuleLike = Partial<{ [K in MapModuleHook]: (...args: MapModuleHooks[K]) => unknown }>;

const modules = new Map<string, MapModuleLike>();

/**
 * Registers a module under `id`, replacing any previous one.
 *
 * Modules register themselves rather than being collected into a literal at map mount: a component
 * rendered lazily (behind an `{#if}`) is `undefined` at that moment, and capturing it by value meant
 * its hooks were silently never dispatched, for the whole life of the app.
 */
export function registerMapModule<T extends keyof MapModules>(id: T, mapModule: MapModules[T]): void;
export function registerMapModule(id: string, mapModule: MapModuleLike): void;
export function registerMapModule(id: string, mapModule: MapModuleLike) {
    modules.set(id, mapModule);
}

/** Call from `onDestroy` for anything registered from a component. */
export function unregisterMapModule(id: string) {
    modules.delete(id);
}

export function getMapModule<T extends keyof MapModules>(id: T): MapModules[T] {
    return modules.get(id as string) as MapModules[T];
}

/** Live view of the registered modules. */
export function getMapModules(): Readonly<Record<string, MapModuleLike>> {
    return Object.fromEntries(modules);
}

/**
 * Dispatches `hook` to every registered module in registration order, stopping at the first one that
 * returns truthy. Click hooks use the result to mean "handled — do not fall through to the default
 * behaviour". When no module handles it, the same event goes out on the global observable so
 * non-module listeners get a chance, and their `result` is honoured instead.
 *
 * Returns a boolean for the module path (matching the `Array.some` this replaced), or whatever the
 * observable listener put in `result` when nothing handled it.
 */
export function runOnModules<K extends MapModuleHook>(hook: K, ...args: MapModuleHooks[K]) {
    let handledByModule = false;
    for (const mapModule of modules.values()) {
        const handler = mapModule?.[hook];
        if (typeof handler === 'function') {
            if ((handler as (...hookArgs: MapModuleHooks[K]) => unknown).apply(mapModule, args)) {
                handledByModule = true;
                break;
            }
        }
    }
    if (handledByModule) {
        return true;
    }
    const event: { eventName: string; data: unknown[]; result?: unknown } = { eventName: hook, data: args };
    globalObservable.notify(event);
    return event.result;
}

export function runOnModulesOnMainThread<K extends MapModuleHook>(hook: K, ...args: MapModuleHooks[K]) {
    executeOnMainThread(() => {
        runOnModules(hook, ...args);
    });
}
