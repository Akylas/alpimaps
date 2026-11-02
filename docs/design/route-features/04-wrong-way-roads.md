# 04 - Wrong-way roads for the current travel mode

Research and plan only. Nothing in the app was changed. Mockups: [`04-wrong-way-roads.html`](04-wrong-way-roads.html).
Paths are absolute under `/Volumes/dev/nativescript/alpimaps` (`app`) or `/Volumes/dev/massif/...` (SDK repos).
"Unverified" marks anything read from code but not run, or estimated.

## Verdict

Feasible, in three independent layers of increasing cost. The answer to the use case ("first junction where I
can turn left") is **not reachable with the style alone**: the tiles carry one `oneway` flag, no per travel
mode data, and a style cannot know the user's heading nor which end of a street meets the road they ride.
The routing graph already linked into the app does know, per mode, and its `trace_attributes` call exposes it.

| Layer | What the user gets | Effort | Needs |
| --- | --- | --- | --- |
| 1. Bolder one-way style | arrows readable at navigation zoom, optional band | S | app style child only |
| 2. Entry overlay, **route known** (navigation) | enterable / forbidden exit stubs at the next junctions, "next left / right" chips | M | app only, offline routing data |
| 3. Entry overlay, **free ride** (follow mode, no route) | same without a route | L | one SDK addition (graph lookahead), or a heuristic prototype |
| 4. Contraflow in the tiles (optional) | style can show "bikes may ride both ways" without routing data | M + a re-tile | tile generator change |

Recommended: 1 then 2 (with the chips), then 3 once the SDK call exists. Skip 4 unless the style must be
self-sufficient without routing packages.

## Current rendering

- Style source is generated, not hand-written. `massif-sdk/styles/massif/layers/roads.py:373-386` `oneway()`
  makes four symbol layers (ink and e-ink arrow, forward and `-reverse`), `minzoom=16`, `symbol-spacing 200`,
  `icon-size` ramp 0.6 at z16 to 1 at z18, `icon-opacity 0.8`. Classes: `CLASSES` (`roads.py:4`) minus
  `motorway`. Paths, cycleways and tracks never get an arrow. README: `styles/massif/README.md:97`.
- The app bundles the compiled result. In `app/assets/styles/massif.zip` (read via an unzipped copy)
  `massif.xml:1868-1899`: `MarkersSymbolizer` with `placement="line"`, `spacing="200"`,
  `width=linear(zoom,16,0.6,18,1)*16`, so an arrow is 10 to 16 px wide, one per 200 px, only from z16. The
  filter is `[oneway]=1` or `-1` and class in service/minor/tertiary/secondary/primary/trunk.
- How it is built: `app.webpack.config.js:901-945` runs `massif-style css2xml` over
  `dev_assets/styles/massif_cleaned/src/{massif,alpimaps}.json` and zips to `massif.zip`. The app's own layer
  on top is `dev_assets/styles/massif/alpimaps.json` + `alpimaps-rules.mss` (CartoCSS, listed after the
  package's `style.mss`, see its header comment: new attachments draw with their source layer's topmost entry).
- Legacy OSM styles (`osm.zip`, `dev_assets/styles/osm/shared/labels.less:316`) also draw `marker-type: arrow`
  from z16 on `oneway!=0`.
- Why it does not "jump to the eye" in navigation: the navigation zoom range is 12 to 17
  (`app/utils/constants.ts:96-97`, `DEFAULT_NAVIGATION_ZOOM_MIN/MAX`), the arrow only exists from z16, is
  small, grey-on-white, and sparse. At the usual look-ahead zoom there is no arrow at all.
- Nothing in the legend: `massif-sdk/styles/massif/legend.py:65-76` lists roads, unpaved, no-access,
  cycleway, path; no one-way entry. The app side is `app/mapModules/features/legend.ts` and `showLegend`.

## Data availability

### Tiles (static)

- Generator: `/Volumes/dev/massif/cairn/planetiler/planetiler-openmaptiles/src/main/java/org/openmaptiles/layers/Transportation.java`.
  `line 622`: `.setAttrWithMinzoom(Fields.ONEWAY, nullIfInt(element.isOneway(), 0), 12)`, i.e. `oneway` is 1 or -1,
  from z12, relative to the way's geometry direction. Schema doc: `generated/OpenMapTilesSchema.java:948-957`.
  Segments with `oneway` are deliberately not merged (`Transportation.java:835-841`) so the direction
  survives.
- Same file, `line 606`: `bicycle` is emitted only as 1 for `bicycle=yes`. **There is no `oneway:bicycle`, no
  `cycleway=opposite*`, no contraflow flag, no `oneway:foot`.** Nor `junction=roundabout` handling (roundabout
  arrows are probably absent, unverified).
- So from tiles alone one cannot say "wrong way for a cyclist" on a street that is `oneway=yes` +
  `oneway:bicycle=no`: it is drawn like any one-way.
- Adding the data (layer 4): a tag read in `Transportation.java` next to `tracktype` (`element.source().getTag`
  is already used for raw tags there) and a new attribute such as `contraflow=1`. Needs a tile rebuild
  (cairn build, hours for a region, unverified) and tile size grows slightly.

### Routing graph (dynamic, already offline)

- The app has an offline valhalla: `app/services/PackageService.ts:206` `MultiValhallaOfflineRoutingService`,
  created at `:981` `offlineRoutingSearchService()`, gated by `hasOfflineRouting`.
- Exposed engine calls are only `calculateRoute` and `matchRoute`
  (`massif-sdk/all/native/routing/MultiValhallaOfflineRoutingService.h:53,55`). `matchRoute` is valhalla's
  `trace_attributes` (loki trace + thor `trace_attributes`, `all/native/routing/utils/ValhallaRoutingProxy.cpp:197-219`).
  **There is no `locate` equivalent exposed**, though valhalla's `locate` is linked
  (`libs-external/valhalla/valhalla/src/tyr/locate_serializer.cc`, `Options::locate` in `tyr/actor.cc`).
- The app already calls `matchRoute` with free-form filters and reads `rawResult`:
  `PackageService.ts:789-830` `getStats`, filters via `request.call('setCustomParameter', 'filters', {attributes, action:'include'})`
  (`:812-813`). Online fallback `networkService.getValhallaTraceAttributes` (`:824`), which sends the track to a server.
- `trace_attributes` can return, for every node on the matched path, the **intersecting edges** with
  `begin_heading`, `cyclability`, `walkability`, `driveability`, `use`, `road_class`, names
  (`libs-external/valhalla/valhalla/valhalla/baldr/attributes_controller.h:133-144`).
- Per-mode traversability is computed from the directed edge's forward/reverse access bits
  (`src/thor/triplegbuilder.cc:842-862`, `forward / backward / both / none`). Bicycle contraflow is baked into
  those bits at graph build: `lua/graph.lua:1195-1207` (`oneway:bicycle`), `:1356`, `:1481`,
  `:1661-1687` (`cycleway*=opposite*`). So `cyclability` of a one-way side street where bikes may go both ways
  is `both`, exactly the contraflow answer. Reading of source: `forward` for an intersecting edge means leaving
  the node along it, to confirm with one real call (slice 0).
- What it ignores: turn restrictions, time windows, `access=destination`, gates; "enterable" means "the routing
  graph allows travelling that edge away from this node in that mode".

## Approaches compared

| | a. Restyle | b. Dynamic overlay | c. Hybrid (recommended) |
| --- | --- | --- | --- |
| Answers "can I turn left here" | no: direction-agnostic | yes, per mode | yes |
| Knows heading | no (a style parameter changed per fix would restyle tiles, unverified cost) | yes (from fix and route) | yes |
| Contraflow | only after a re-tile | yes (valhalla) | yes |
| Data | tiles `oneway` | offline routing package | both |
| Perf | free | one async call per window | free + small |
| E-ink | static, fine | redraw only on step | fine |
| Works without routing package | yes | no | partly (style part) |
| Effort | S | M (route) / L (free ride) | M then L |

### a. Restyle

What a static style can honestly do (slice 1):
- Show one-way from z15 not z16, 1.5 to 2x size, an edge so it reads on every road colour (already done for ink
  arrow), spacing 80 to 100 px instead of 200, and an optional tinted band (dark at 16% alpha, drawn under the
  chevrons) so a one-way street is recognisable as a street, not as a dotted line. E-ink: no band, black
  chevrons with a white edge, denser.
- Extend to cycleways and paths that carry `oneway` (today excluded by class). Unverified: tile has the attr
  on class `path`; cairn sets it on the path branch only if `oneway` is mapped for those rows.
- A "travel mode" style parameter cannot recolour by heading. It can switch emphasis (cycling mode: bolder,
  from z15; car: from z16), but the contraflow distinction needs layer 4.
- Cannot place a marker at the junction end of a street: the SDK marker placements are point/line only
  (`libs-massif/mapnikvt/src/mapnikvt/MarkersSymbolizer.cpp:39-48`; no `vertex-first/last`, grep found none).
- Mechanics: add a style parameter (for example `oneway_emphasis` 0/1/2) to `alpimaps.json` `styleparameters`
  and new attachments in `alpimaps-rules.mss`; the old attachments `transportation::oneway*` stay and are
  hidden through the parameter. Whether CartoCSS in the child can restyle an attachment of the parent in place
  is unverified; the safe way is a new attachment plus a parent-side switch (massif-sdk `params.py` + `roads.py`,
  your repo, then `@massif-maps/styles` rebuild). The app exposes it with a `nutiProps` entry
  (`app/stores/mapStore.ts:155` `show_routes` is the model: `settingsOptionsType`, `defaultValue`, `icon`,
  `visible`), listed only if the style declares it (`styleHasParameter`, `mapStore.ts:48`).

### b. Dynamic overlay

Two data paths, same drawing code.

**b1. Route known (navigation).** The route polyline is the "ahead". Once, when navigation starts (and after a
reroute), run `getStats`-style `matchRoute` over the route with `shape_match: 'edge_walk'` (exact, cheap) and
node attributes: `node.intersecting_edge.begin_heading / cyclability / walkability / driveability / use /
road_class` plus `edge.begin_shape_index / end_shape_index` (already requested at `PackageService.ts:791`), so a
node maps to a route vertex. Chunk by about 2 km windows to bound the JSON. Result: a sorted table
`{distanceAlongRoute, position, userHeading, exits: [{headingDelta, side, enterable, contraflow}]}` held in a
store. Per fix, `navigationProgress` (`app/stores/navigationStore.ts`, `RouteProgress` in
`app/utils/navigation.ts:244`) says where the user is on the route; the next N junctions within the look-ahead
are the visible set. No heavy call per fix.

**b2. Free ride (follow mode, no route).** Nothing ahead is known. Options:
1. **SDK addition (recommended):** a graph walk from the matched edge along the travel direction for `L` metres,
   returning junctions with their outgoing edges and per-mode access. All the pieces (GraphReader, loki
   trace/locate, tile access) already sit in `ValhallaRoutingProxy.cpp`; it is a new method on
   `MultiValhallaOfflineRoutingService` plus the generated bindings (`api/schema.js`, typings) and new native
   builds. Effort L, owner: massif-sdk.
2. **Prototype, app only:** `calculateRoute` from the user to a point 400 to 600 m ahead along the heading, then
   `matchRoute` with node attributes on that polyline. Cheap to try, fragile where the road bends or forks (the
   route may leave the road the user is on). Good enough to validate the UX before the SDK work.
3. **Tile geometry heuristic:** `packageService` already has a vector tile feature search over the local base
   archives (`PackageService.ts:492 findFeatures`, `setLocalVectorData`); build junctions from road lines
   near the user in JS and use `oneway` only. No contraflow, no turn logic, topology from shared vertices is
   error prone. Not recommended beyond a fallback without routing data.

**Drawing.** Stub geometry needs no edge shape: from the node position, along `begin_heading`, length
`max(6 m, ~26 dp in metres at the current zoom)`, the same idea as `arrowSizesAt` in `NavigationRouteModule.ts:44-56`.
Per exit: enterable = solid stub with arrowhead pointing out; forbidden = hatched stub with a perpendicular
bar; contraflow = enterable plus a small bike badge. Put them on a GeoJSON vector layer like the maneuver
arrows (`NavigationRouteModule.ts:187-210` `getOrCreateManeuverLayer`: `map.source(..., {type:'geojson'})`,
`createLayer`, `buildLayer` with `style: mapContext.innerDecoder.id`, `setGeoJSON`). Style classes live in the
inner style `dev_assets/styles/inner/voyager.json` + `eink.json` (compiled to `inner.zip`, `maneuver::*` styles
at `inner/voyager.xml:104-128` are the model), so e-ink gets its own black/hatch variant for free. Alternative:
marker elements on a local vector layer as `UserLocationModule.getOrCreateLocalVectorLayer`
(`UserLocationModule.ts:169`) does; rejected because hatch and per-zoom sizing are easier in the style.

Update rate, battery: see Perf.

### c. Hybrid

Slice 1 always on (no cost), overlay only while `userFollowStore` or `isNavigating`
(`UserLocationModule.ts:82-84`, `navigationStore`) and a routing package is present.

### "Next left / right option" HUD

Derived store from the junction table and the user heading: for each side, the first junction ahead whose exit
on that side (heading delta between 20 and 160 degrees to that side of the travel direction) is enterable for
the mode. Chips show distance, update on step (not per fix), fade when stale. Optional extension with the same
data: a "wrong way" banner when the matched current edge is not enterable in the travel direction for the mode.

## Integration points

- New map module `JunctionOptionsModule` (name open) registered with `registerMapModule`
  (`app/mapModules/registry.ts:47-49`, pattern at the end of `NavigationRouteModule.ts`, `registerNavigationRouteModule`).
  Hooks: `onMapReady`, `onMapMove`/`onMapStable` (zoom-dependent stub size, as `NavigationRouteModule.ts:134-141`),
  `vectorTileDecoderChanged` (rebuild the layer when the style changes, `:152-174`), `onMapDestroyed`.
- Layer slot: reuse `'navigation'` in `app/mapModules/layerStack.ts:4,7` (or add one id to `LayerType` and
  `LAYERS_ORDER`, rule in the comment at `:3`).
- Location: `UserLocationModule.updateUserLocation` (`:220`) already gets heading (`lastKnownBearing`,
  `:261-275`) and fires `location` events; navigation publishes `navigationLocation` / `navigationProgress`.
  Subscribe to the stores, as `NavigationRouteModule` does, so a map recreate misses nothing.
- Travel mode: in navigation `NavigationService.routeProfile` (`NavigationService.ts:173`, `'pedestrian'`
  default, cached by `profileTuning`). In follow mode there is no profile: add a setting defaulting to the last
  directions profile (`DirectionsPanel.svelte:51,128` key `default_direction_profile`). Map `ValhallaProfile`
  (`app/utils/routing.ts:4`) to the `cyclability / walkability / driveability` field.
- Engine call: new `PackageService` method next to `getStats` (`:789`), using `offlineRoutingSearchService()`;
  keep it off the online service (it would ship positions).
- Style toggle: `mapStore.ts` `nutiProps` entry + `app/mapModules/features/styleToggles.ts` side button only if
  a quick toggle is wanted (the file shows `styleHasParameter` gating); otherwise the map options list is
  enough (`settingsOptionsType: 'boolean'`).
- Settings: a navigation section entry like `SETTINGS_NAVIGATION_ARROW_MARKER`
  (`app/utils/constants.ts:59`, `navigationStore.ts:133,658-668`, rendered by `Settings.svelte:704-707`);
  strings in `en.json` + `fr.json`.
- Legend: add three lines in `legend.py` (one-way, entry allowed, entry forbidden) so `legend.json` in the zip
  carries them; the overlay entries come from the app, not from the tiles, so they may need an app-side legend row.
- **Gestures tutorial rule (`.claude/CLAUDE.md`)**: a long press on the mode chip (opens the option) or on a
  chip (jump to the junction) is a non-obvious gesture. If either ships, update
  `app/components/tutorial/tutorialPages.ts` (navigation page, `zones` at about `:181-210`) and the
  `gesture_<id>_*` / `tutorial_page_<id>` strings in `en.json` + `fr.json` in the same change. Plain taps need
  nothing.
- Verification reminder (`CLAUDE.md`): `yarn svelte-check` is the only gate, there is no test runner; the
  junction maths (heading delta, side, windowing) is pure logic: write it as a plain `.ts` with no NativeScript
  imports so it can be exercised later, and state that a native run is still required.

## UI

Follows `docs/design/README.md`: round semi-transparent map controls (`colorMapControl`, hairline, 40 dp, 48 dp
minimum width), pills for toggles, accent as the only hue, no elevation on the map. Mockups in the html file.

- **Chips**: left chip on the left edge, right chip on the right edge ("next left 190 m", "next right 60 m"),
  travel-mode chip in the middle. Dashed outline and a dash when nothing is enterable within the look-ahead.
- **Stubs**: shape carries the meaning, colour is a bonus. Enterable: solid accent stub + arrowhead. Forbidden:
  hatched stub (the README's hatching idiom for grades) + a perpendicular bar. Contraflow: bike badge.
  E-ink: black solid vs black hatch, route as a dotted line.
- **Settings**: map option "One-way streets" (look: standard / bold / bold + band), switches "Show entries I
  may take" and "Next left / right chips", travel mode pills (walk, bike, car, auto = route profile), look-ahead
  slider.
- **Legend**: three swatches plus contraflow.
- Pedestrian mode: one-ways seldom matter; default overlay off for walk, chips off.

## Perf

All figures are estimates until slice 0 measures them (the `DEV_LOG` timing in `PackageService.ts:818` is the
tool).

- Style (layer 1): no runtime cost beyond a few more markers per tile.
- Route (b1): one `trace_attributes` per 2 km window with `edge_walk`; expected tens of ms on a worker thread
  (`callAsync`, already used so the JS thread is free). Prefetch the next window at 50% of the current one.
  Memory: tens to hundreds of KB per 50 km of table.
- Free ride (b2): re-query when the user moved more than about 100 m or turned more than 45 degrees, at most
  every 5 s; skip in background (`getBGServiceInstance().appInBackground`, used at `UserLocationModule.ts:249`)
  and when speed is under walking pace. No extra GPS, no network.
- Drawing: at most 6 junctions x 4 exits = about 24 small features in one `setGeoJSON`, same order of cost as
  the maneuver arrows that already redraw on `onMapMove`. Key the redraw (as `arrowKey` does) so an unchanged
  set costs nothing.
- E-ink: update on junction passage or look-ahead change only, never per fix.

## Risks

1. **A wrong "allowed" is worse than nothing.** The graph is not the law (restrictions, gates, time windows,
   bad tagging). Copy says "per map data", the overlay hides when accuracy is poor (over about 30 m), off route,
   or the match is ambiguous (parallel roads).
2. Free-ride data path needs an SDK change in another repo plus native rebuilds; until then it is a prototype.
3. Routing packages are optional (`hasOfflineRouting`): the feature must degrade to the style only, silently.
4. Heading noise at low speed flips left/right; use the route heading in navigation and a smoothed course
   (speed over a threshold) in follow mode.
5. Clutter: driveways, parking aisles, alleys produce many exits. Filter on `use` and `road_class`; keep
   footways and cycleways only for walk and bike.
6. Style rebuild chain: `css2xml` over two repos' sources (`@massif-maps/styles` is a symlink to the SDK repo);
   a new style parameter touches both sides. The inner style change touches `inner.zip` (e-ink variant needed).
7. `tools/` submodule is shared with other apps: nothing proposed lives there. Do not put the module in
   `tools/app`.
8. Root `Map.svelte` is on the startup path: register the module lazily, load nothing until follow/navigation.
9. Tile `oneway` direction semantics at tile merges and on roundabouts unverified.
10. Online-only fallback sends the position to a server; keep it off.

## Phased plan

| Slice | Content | Size | Done when |
| --- | --- | --- | --- |
| 0 | Spike: one `matchRoute` with node intersecting-edge filters on a real bike route; log JSON shape, time, `cyclability` on a contraflow street, `forward` meaning | S | numbers and a sample JSON in the PR description |
| 1 | Style: bolder one-way (`oneway_emphasis`), z15 start, denser, band, e-ink variant, legend lines, option in map options, en/fr strings | S | `yarn svelte-check` clean, visual check on device in light/dark/e-ink |
| 2 | Junction table for a route (PackageService method + pure `.ts` for heading/side/window), overlay layer in inner style, module, stores | M | stubs and correct side/enterable on a navigated route, bike and car |
| 3 | Chips (next left/right), travel-mode chip and setting, settings section, stale/none states | S to M | chips match the overlay; gestures tutorial updated if a long press ships |
| 4 | Free ride: SDK graph lookahead (massif-sdk), bindings, then module path b2 | L | works with no route, throttled, background-safe |
| 5 | Optional: tile contraflow attribute in cairn + style use; "you are going the wrong way" banner | M | style shows contraflow without routing data |

Smallest valuable slice: slice 1 alone, shippable in a day, improves legibility but does not answer the left
turn question. Smallest slice that answers it: slice 0 + 2 + 3 in navigation mode.

## Open questions

1. Primary mode for v1: bike only, or all of walk/bike/car? (changes defaults and the clutter filter)
2. Is the free-ride follow mode (no route) required for v1, or is navigation-only acceptable? It decides whether
   the SDK work is on the critical path.
3. May I plan SDK changes in `massif-sdk` (new routing call + bindings) and `cairn` (contraflow attribute)?
4. Should the overlay show only left/right, or also the straight-on continuation?
5. Chips only, or also a "wrong way" warning when riding against a one-way?
6. Is contraflow in the static style (needs a re-tile) worth it, or is the overlay enough?
7. Offline routing packages are not installed by every user: acceptable that the overlay is simply absent then?
8. Default travel mode in follow mode: last directions profile, or an explicit setting?
