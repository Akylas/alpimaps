import type { MassifMap } from '@nativescript-community/ui-massifmaps/api';
import { executeOnMainThread } from '@nativescript/core/utils';
import { globalObservable } from '@shared/utils/svelte/ui';
import type { GeoHandler } from '~/handlers/GeoHandler';
import type { IItem } from '~/models/Item';
import type { ElementClickData, FeatureClickData, MapClickData, MapDecoder, MapInteraction, MapMoveReason } from '~/mapModules/MapModule';

/** The contract `runOnModules` is checked against. A hook returning truthy means "handled, stop". */
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
 * Open on purpose: each feature adds its key via `declare module` augmentation from its own file. Values are
 * heterogeneous: `MapModule` subclasses or svelte components exporting hook functions.
 */
// eslint-disable-next-line @typescript-eslint/no-empty-object-type
export interface MapModules {}

/** Anything registered here only has to implement the hooks it cares about. */
export type MapModuleLike = Partial<{ [K in MapModuleHook]: (...args: MapModuleHooks[K]) => unknown }>;

const modules = new Map<string, MapModuleLike>();

/**
 * Modules register themselves: a lazily rendered component is `undefined` at map mount, so collecting
 * them into a literal silently dropped its hooks.
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

export function getMapModules(): Readonly<Record<string, MapModuleLike>> {
    return Object.fromEntries(modules);
}

/**
 * Stops at the first module returning truthy ("handled"). Unhandled, the event goes out on the global
 * observable and the listener's `result` is returned instead.
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
