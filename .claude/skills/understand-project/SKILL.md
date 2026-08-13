---
name: understand-project
description: Ground a feature or fix in existing code before planning or building — find a similar pattern, identify reusable assets, map the touch surface. Internal helper invoked by feat / fix (both modes) — not meant to be run on its own.
disable-model-invocation: true
---

Ground every plan and implementation in code that already exists. A plan that says "follows the same pattern as `app/components/items/ItemEdit.svelte`" beats one describing an abstraction in the abstract — the executor gets low cognitive load and a working reference. This is the _method_; the calling skill says what to build.

## Steps

1. **Learn the layout that applies.** App code is under `app/`: `.svelte` screens/components/modals live in `app/components/<feature>/` (feature dirs: `map`, `bottomsheet`, `navigation`, `directions`, `search`, `items`, `layers`, `transit`, `compass`, `astronomy`, `chart`, `gps`, `peaks`, `3d`, `three`, `routes`, `settings`, `common`); map behaviour lives in `app/mapModules/` (`MapModule.ts` holds the `mapContext` singleton and the module base class, plus `CustomLayersModule`, `ItemsModule`, `UserLocationModule`); domain logic lives in service singletons under `app/services/` (`PackageService.ts`, `NavigationService.ts`, `NetworkService.ts`, `TransitService.ts`, …); the data model is `app/models/Item.ts`; state in `app/stores/`; helpers in `app/utils/`, `app/helpers/`; strings in `app/i18n/`; SCSS themes in `app/themes/`. Platform splits use `.android.ts` / `.ios.ts`.
2. **Find a similar existing implementation.** Glob/Grep for a `.svelte` component, a map module or a service that solves a comparable problem. Read 1-2 end-to-end so you can point at them by path.
3. **Identify reusable assets** — existing components in `app/components/common/` and their `@shared/components/` counterparts, svelte stores (`app/stores/`, and `settingsStore()` for anything persisted), map modules, service singletons, and utils/helpers. Reuse these by name rather than inventing new ones. Check whether a component exists in **both** `app/components/common/` and `@shared/components/` before adding to either — several are drifted forks.
4. **Map the touch surface** — every file, component, map module, service, i18n key that needs to change. Trace data flow and callers (the `mapContext` singleton and the service singletons are shared, so a change ripples) so nothing is missed. Anything reached through `mapContext` is worth checking against the real implementation in `Map.svelte`, not just the interface.
5. **Check third-party libraries** — when a library is involved (`@nativescript-community/*` especially `ui-carto`, `@akylas/*`, svelte-native, sqlite/kiss-orm, …), use Context7 for version-matched docs before assuming an API. For the carto SDK and the Akylas forks, prefer the local typings under `node_modules/` — published docs lag well behind.

## Bias

Pick the simplest, cleanest solution: reuse existing patterns/components/hooks, fewest files touched, smallest new surface. If a clever approach and a boring approach reach the same outcome, choose the boring one.
