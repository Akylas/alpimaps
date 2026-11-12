# Route feature 02: very steep sections (cycling)

Research and plan only. No app code was changed. Companion mockups: [`02-steep-sections.html`](02-steep-sections.html).

Conventions: `file:line` refs were read on branch `feat/suncalc-2` (HEAD `b5bcf4cb`). Anything marked **(unverified)** comes
from memory or inference and needs a spike. Numbers marked **(synthetic)** come from a throwaway Node script run on
generated profiles (`/private/tmp/steep/proto.mts`, outside the repo, imports the real `app/utils/grade.ts`), not from real
routes or a device.

## Verdict

**Feasible and cheap. Most of the pipeline already exists.** The app already:

- samples a DEM profile for every route (`PackageService.getElevationProfile`),
- derives a robust per-vertex grade `g` (fixed 10 m resample, 60 m smoothing, 100 m baseline) and stores it on the item,
- colours the profile by 8 grade buckets, and shows a "grade ahead" figure while navigating.

What is missing is a **detector** that turns `profile.data[].g` into discrete steep sections (up and down), plus the
surfaces: a stat tile, a list, chart markers, a map overlay and a navigation heads-up.

Key design call: **derive steep sections on read from the stored `data[].g`, do not persist them.** A pure function
(`app/utils/steep.ts`, no NativeScript import, like `grade.ts`) means: no DB migration, old saved routes work at once,
thresholds can change per bike type or setting without recomputing the DEM profile.

Smallest valuable slice: detector + "steep" stat tile + sheet list card (S+S, about 2 days). Map overlay and navigation
warning are the two features that change what the user sees while riding; they come next.

## Existing code

### Grade pipeline (all in place)

| What | Where |
| --- | --- |
| Pure grade maths, no NS imports | `app/utils/grade.ts` |
| Options: step 10 m, smooth 60 m, baseline 100 m, min section 150 m, hysteresis 0.5 %, clamp ±45 % | `grade.ts:19-26`, defaults mirrored in `app/utils/constants.ts:160-163` |
| 8 colour buckets, thresholds -9 / -6 / -3 / +3 / +6 / +9 / +12 % | `grade.ts:47-56` |
| `computeGrades`: resample to fixed step, moving average, centred finite difference over `baseline` | `grade.ts:116-147` |
| `buildGradeSections`: bucket runs with hysteresis, then merge any run shorter than `minSectionLength` into the closest neighbour | `grade.ts:161-224` |
| `gradeAhead`: length-weighted mean of `g` over the next N m | `grade.ts:232-` |
| Profile built from unrounded DEM heights; `data[]` = `{d, a (rounded m), g (0.1 %), dp, dm}` per route vertex | `PackageService.ts:585-746`, grades at `:727-744` |
| Stored result: `sections`, `colors` (gradient stops as indices into `data`), `ascents` | `PackageService.ts:738-744`, type `Item.ts:69-79` |
| Profile persisted as JSON in `Items.profile`, parsed lazily on first read | `Item.ts:272`, `:445-450` |
| DEM source: `hillshadeLayer.getElevations` on a worker, else Valhalla `/height` online | `PackageService.ts:571-576`, `:765-787`, `NetworkService.ts:540-555` |

`profile.sections` is **written but never read** anywhere except to derive `colors` (grep `\.sections` finds only the writer,
`PackageService.ts:741`). So per-section data is already stored and free to reuse.

### Chart

- `ElevationChart.svelte` colours the fill by `profile.colors` when `showProfileGrades` is on (`:581-590`), with a heavier
  fill alpha (225) so buckets are distinguishable; e-ink keeps the pale default alpha and so shows no grade signal
  (`:588`). The chart also draws "ascent" callouts as dashed x-axis limit lines (`:655-678`).
- `GradeLegend.svelte` is a bar of the 8 bucket colours with the threshold numbers. It is hidden on e-ink
  (`ElevationChart.svelte:743`).
- The chart's only custom render hook on the line chart is `drawHighlight` (ui-chart `charts/LineChart.d.ts:14`).
  There is no "draw behind data" hook, so steep **bands** cannot be painted with a renderer callback. See Integration.
- Existing "ascents" (`PackageService.ts:588-725`) are mountain-pass style climbs: default min gain 100 m with an 80 m dip
  tolerance (`constants.ts:154-155`). Too coarse for cycling steep ramps, but usable for Tour-style climb scoring.

### Where grade shows today

- Nav "ahead" card: grade over the next 100 m, in bucket colour (`NavigationElevationChart.svelte:27-35`,
  default `constants.ts:131`).
- Selected point strip: grade as a figure (`ElevationChart.svelte:368`, `infoStrip` branch).
- Nothing on the map and nothing in the route header. No steep concept anywhere (grep "steep" across `app/` finds nothing).

### Map line

- Saved items are `LineString` features in the `source.items` GeoJSON datasource, one feature per route, styled by the
  `inner` style (`ItemsModule.ts:235-251`, `:266-292`). Style source is `dev_assets/styles/inner/shared/items.mss`
  (`#items['mapnik::geometry_type'=2]`), compiled by `massif-style css2xml` into `app/assets/styles/inner.zip`
  (`app.webpack.config.js:906-941`). The route colour is a single `line-color: @lineColor` per feature, so **per-segment
  colour in the item line itself is not possible** without splitting the feature (which would break selection and click
  handling by `id`).
- Sub-layer 2 of the same datasource is the `poi` layer: waypoints, km shields and ascent summit dots are rebuilt on every
  selection by `ItemsModule.onItemSelected` (`ItemsModule.ts:549-612`). Layer order in `inner/voyager.json` puts `poi`
  above `items`, `directions` and `navigation`, so features added there draw over the route line.
- During navigation a separate `navigation` layer draws the followed route with `lineFeature('route', geometry)`
  (`NavigationRouteModule.ts:289-312`, style `inner/shared/navigation.mss:20-`), and the selected item is greyed via the
  `navigating` style parameter.
- The directions preview uses its own datasource (`DirectionsPanel.svelte:1058-1065`) and gets `route.profile` at `:824`.

### UI idioms

- Route header stat tiles: `RouteStatTiles.svelte` (4 tiles: distance, time, ascent, descent; `tilesFor` at `:42-58`). Layout
  is `gridlayout` with one `*` column per tile, height 40, `colorSurfaceFill`, 1 px hairline on e-ink only, icon + bold value,
  optional second accent line after a flag icon (`:61-90`).
- Chart options popover with switches and sliders: `BottomSheetInner.svelte:996-1110`. Persisted through
  `showGradeColors` / `showAscents` stores (`mapStore.ts:39-41`) and `ApplicationSettings`.
- Surface/way-type bands use `drawSurfaceBand` hatching on e-ink (`app/utils/surfacePattern.ts`, `RouteStatsView.svelte`,
  `NavigationSurface.svelte`). **This is the only place the "hatching on e-ink" rule is implemented.** The profile does
  not hatch grades even though `docs/design/README.md:13` and `mockups.html:173-174` say it should. That gap is part of this
  feature's e-ink work.
- Navigation: fixed-height cards, scale-aware (`navigationScale`); sheet section heights are fixed in
  `navigationSections` (`app/utils/navigation.ts:44-`), `ahead` row is 80 * scale. A transient message idiom exists
  (`showSnack` in `NavigationView.svelte:43-48`). No TTS or vibration in the navigation service (grep of
  `NavigationService.ts` finds only comments).
- Route type is on the item: `properties.route.type` (`ValhallaProfile`) and `properties.route.subtype`, set from
  `bicycle_type` = `enduro | road | normal | gravel | mountain` (`DirectionsPanel.svelte:134`, `:864`, `Item.ts:108-110`).
  Imported tracks have no such info (unverified for GPX import, check `route.type` absence).

## Algorithm

### What the stored grade already gives

`g` is a 100 m centred baseline over elevation smoothed with a 60 m window, so its effective resolution is about
150-160 m. Measured on a synthetic 120 m, 22 % wall in flat terrain **(synthetic)**:

| DEM model | settings | peak `g` | max false `|g|` on flat |
| --- | --- | --- | --- |
| clean | 60 / 100 (default) | 20.1 % | 0 |
| clean | 30 / 50 | 22.0 % | 0 |
| sigma 1.5 m, 30 m cells | 60 / 100 (default) | 19.0 % | 3.9 % |
| sigma 1.5 m, 30 m cells | 30 / 50 | 21.3 % | **9.7 %** |

Reading: the default window already recovers a 120 m wall within about 10 % of its true grade, and a sharper window
mostly buys false positives (9.7 % on flat). **Keep the default window; do not make a second, sharper pass the default.**
Short walls under about 100 m will be under-reported. That is acceptable for "sections", and the stat is labelled
"max over 100 m".

The existing `sections` are **not** the right input for steep detection: the 150 m minimum-section merge absorbs a short
wall into its neighbour (the same 120 m wall is absent from the sections list on the clean profile, **synthetic**).
Detect on `data[].g` directly.

### Detector (`findSteepSections`)

Input: `profile.data` (`d`, `g`), thresholds. Output: sections `{startIndex, endIndex, startDistance, endDistance, length,
direction: 'up'|'down', level: 1|2, avgGrade, maxGrade, gain}`. Linear in the number of vertices.

1. **Seed**: a vertex is steep-up if `g >= steepUp`, steep-down if `g <= -steepDown`. Two levels: `steep` (level 1) and
   `very steep` (level 2).
2. **Grow with hysteresis**: extend while `g >= threshold - exit`, `exit` about 1 %. Larger exits absorb the flank. With
   `exit = 1.5` on a clean profile a 16 % wall merged into the following 7 % leg and flagged 1.3 km as one 8 % section
   **(synthetic)**; so use 1.0, and re-check on real data.
3. **Merge**: join two same-direction runs separated by less than `mergeGap` (100 m) whose gap mean is still at least
   `threshold - 3`. Stops a single noisy vertex splitting a climb in two.
4. **Length filter**: a run counts if `length >= minLength(level)`. Proposed 150 m for level 1 and 100 m for level 2
   (short walls matter more when they are steeper).
5. **Stats**: `gain = sum(g * dd) / 100` (integral of the stored grade, not `a` end points, because `a` is meter-rounded:
   worth about 0.5 % on 200 m), `avgGrade = gain / length`, `maxGrade = max g` in the run (the "max over 100 m" figure),
   `level` from the maximum of the average and a length-weighted 80th percentile of `g` (to be tuned).
6. **Route stats**: total steep length per direction, share of route, steepest section, longest steep climb.

Edge cases to handle: `MultiLineString` (profile `data` is flat across parts; `ElevationChart.svelte:204` and
`ItemsModule.ts:586-` already assume a LineString index to coordinate mapping, so slicing coordinates by index must flatten
with the same helper as `getRouteItemPoses`, `PackageService.ts:753-761`); duplicated vertices (`d` equal, handled by
`computeGrades`'s resample); routes without `g` (profile computed before the grade commit, or `g` missing): skip, the
profile refresh action recomputes.

### Thresholds by profile (proposal, to be confirmed)

Percent grade. Down thresholds are higher because descending at the same grade is easier to ride but harder to brake.

| Profile (`route.type` / `subtype`) | steep up | very steep up | steep down | very steep down |
| --- | --- | --- | --- | --- |
| bicycle / road | 8 | 12 | 10 | 14 |
| bicycle / normal, gravel | 9 | 13 | 11 | 15 |
| bicycle / mountain, enduro | 12 | 18 | 14 | 20 |
| e-bike (not an app profile today) | 12 | 16 | 12 | 16 |
| pedestrian | 15 | 25 | 20 | 30 |

These line up with the existing legend buckets (+9 and +12 are bucket edges), so no new colour scale is needed. Sources
for the numbers are cycling convention from memory, not looked up **(unverified)**; they are defaults, user-overridable.

### Climb categorisation (optional extra)

Reuse `profile.ascents` (start, end, gain are stored) and apply the usual length times average-grade score. The
Strava-style cut-offs I remember are 8 000 for cat 4, 16 000 / 32 000 / 64 000 for cat 3 / 2 / 1 and 80 000 for HC, with a
minimum average of about 3 % **(unverified, check before shipping)**. Caveat: stored ascents use a 100 m minimum gain and an
80 m dip tolerance, so a 50 m hill never ranks. A separate cycling-oriented climb detection (min gain 40 m, dip tolerance
15 m, min avg 3 %) would be a few more lines in the same module. Output is a pill ("Cat 3") on the list row, not a map
feature.

### Own DEM profile vs Valhalla grade

| | Own profile (`g`) | Valhalla edge attributes |
| --- | --- | --- |
| Works for imported GPX / drawn tracks | yes (positions only) | only after map matching (`getStats`, on demand, `PackageService.ts:789-830`) |
| Resolution | about 150 m effective, configurable | per edge (10 m to several km); `weighted_grade` is a coarse class **(unverified)** |
| Offline | yes, DEM layer | yes if the offline routing tiles carry elevation **(unverified)** |
| Consistent with the chart the user sees | yes | no, would disagree |
| Bridges and tunnels | wrong (bare-earth DEM) | Valhalla flags them, `edge.bridge` / `edge.tunnel` **(unverified)** |
| Cost | none, already computed | one more map-match request, only fetched on demand today |

Use our own profile as the source of truth. A later, optional refinement: add `edge.bridge` / `edge.tunnel` (and
`use: steps`) to the `getStats` attribute list (`PackageService.ts:790`), store their shape-index ranges next to
`surfaceSegments`, and suppress steep detections that overlap them. Until then, show a one-line caveat in the settings
description.

Online path note: Valhalla `/height` rounds heights to whole meters unless a precision parameter is passed
(**unverified**, from memory of the API). `grade.ts:9-11` says rounded elevations stairstep the grade, so the online path
(`PackageService.ts:779-784`) may produce noisier `g` than offline. Spike: request `height_precision: 2`.

## Integration points

Ordered by value; effort S / M / L.

| # | Surface | Change | Files | Effort |
| --- | --- | --- | --- | --- |
| 1 | Detector | New pure module with `findSteepSections`, `steepStats`, threshold presets, memoised per `profile` object (WeakMap) | new `app/utils/steep.ts` | S |
| 2 | Route header tile | One extra `tilesFor` entry: `mdi-slope-uphill`, value = total km above the very-steep-up threshold (or above steep if none), long-press tooltip text. Tiles are `*` columns, so the 5th tile narrows the others; hide it when 0 | `RouteStatTiles.svelte:42-58` | S |
| 3 | Sheet list card | New card under the chart (same `panel` card idiom as `RouteStatsView`): header "Steep sections", summary line, rows with direction icon, km range, length, avg / max, tap to select that range on the chart and map | new `app/components/bottomsheet/SteepSectionsView.svelte`, slot in `BottomSheetInner.svelte` near `:1240` | M |
| 4 | Chart | Bands for steep spans. Two options: (a) extra `LineDataSet`s, one per steep section, thicker line in the steep colour, over the bucket-coloured fill (works with ui-chart's per-set arrays; NaN-gap behaviour is unverified so use one set per section); (b) x-axis `LimitLine`s with a custom `drawLabel` marker at each section start, the way ascents do (`ElevationChart.svelte:655-678`). (b) is the cheap first step. Add a threshold marker row to `GradeLegend` | `ElevationChart.svelte`, `GradeLegend.svelte` | S (b), M (a) |
| 5 | E-ink | Hatch the steep spans (diagonal for up, cross for down) and draw the legend on e-ink too; today bucket colours collapse to grey and the legend is hidden (`ElevationChart.svelte:588`, `:743`). Implementation can reuse the hatching helper in `surfacePattern.ts` | `ElevationChart.svelte`, `surfacePattern.ts` | M |
| 6 | Map overlay (selected route) | In `onItemSelected` add one LineString feature per steep section to sub-layer 2: `class: 'steep'`, `level`, `dir`, geometry = coordinate slice `[startIndex..endIndex]`. Add a rule to the `poi` selector in `inner/shared/items.mss` (colour per level and direction, round caps, a chevron `marker-type: arrow` for up, plus a casing) for both `voyager` and `eink`; rebuild `inner.zip` with the webpack hook | `ItemsModule.ts:549-612`, `dev_assets/styles/inner/shared/items.mss`, `app.webpack.config.js:939-941` | M |
| 7 | Map overlay (navigation) | Same features in the `navigation` data source, so the overlay follows reroutes (the item's own layer-2 features go stale when navigation reroutes, because navigation runs on a copy of the item) | `NavigationRouteModule.ts:289-312`, `navigation.mss` | M |
| 8 | Directions preview | Optional: the preview already has `route.profile` (`DirectionsPanel.svelte:824`); show the same stat in the preview card | `DirectionsPanel.svelte` | S |
| 9 | Navigation heads-up | Pure function `nextSteep(sections, data, onPathIndex)` (binary search on `startDistance`, recomputed only when `onPathIndex` changes, like `highlightIfMoved` in `NavigationElevationChart.svelte:37-54`). Show in the existing "ahead" card header instead of the generic "elevation ahead" label, tinted and with a direction icon. States: approaching ("in 400 m"), inside ("600 m left"), none. Trigger distance `max(300 m, 30 s * speed)`, descents earlier (braking). Optional snack once per section | `NavigationElevationChart.svelte`, `utils/navigation.ts`, i18n | M |
| 10 | Settings | Preset (auto from route type), threshold sliders, min length, toggles; in the chart options popover (`BottomSheetInner.svelte:996-1110`) for chart-level switches, and a grouped section in settings for the numbers | `mapStore.ts`, `constants.ts`, settings screen | S |
| 11 | Tutorial | Any new tap / long-press (tap a row to zoom, long-press the tile) must update `app/components/tutorial/tutorialPages.ts` and `gesture_<id>_*` / `tutorial_page_<id>` in `en.json` and `fr.json` in the same change (project rule) | `tutorialPages.ts`, `app/i18n/en.json`, `fr.json` | S |
| 12 | Climb categories | Pill on rows for ascents that score a category | `steep.ts` | S |
| 13 | Bridge / tunnel filter | See Algorithm | `PackageService.ts:789-830`, `Item.ts` `RouteStats` | M |

Not recommended: splitting the saved route feature into per-grade pieces in `source.items` (breaks `selected_id` /
click handling and doubles features), or persisting steep sections on the item (needs a migration for no benefit).

## UI

All mockups are in [`02-steep-sections.html`](02-steep-sections.html), light and dark, plus an e-ink frame. Design rules
applied (`docs/design/README.md`): theme colour stays the accent, neutral surfaces with hairlines, no elevation on the map,
stat tiles for figures, outlined danger label for warnings (not a filled colour block), **colour never the only signal**.

- **Tile**: one compact tile `slope icon + 3.4 km`, danger-tinted text only when very steep length is above 0; long-press
  tooltip "Steep sections: 3.4 km above 8 %, max 16 %".
- **Profile**: keep the existing 8-colour fill. Steep spans get a bracket above the curve with `▲ 12 %` / `▼ 14 %` and a
  heavier line; a legend row under the chart ("Steep ≥ 8 %", "Very steep ≥ 12 %", "Steep descent ≥ 10 %"). Direction is a
  glyph (triangle) so the signal survives without colour.
- **Map**: steep spans painted over the route in the same colour family (orange level 1, deep red level 2, blue for
  descents to match the existing bucket scale), with arrow markers for up and a hollow marker for down, so it reads in
  e-ink. A single label at the steepest point (`16 %`) from zoom 13.
- **List**: card in the sheet with a summary line ("5 sections, 3.4 km, 14 % of the route") and rows (direction icon, km
  range, length, avg and max, gain). Sort by position; optional pill to sort by steepness.
- **Navigation heads-up**: replaces the label in the "ahead" card; warning is an outlined danger pill ("Steep 12 % in
  400 m"), not a filled block. Descents use a stronger wording ("Steep descent, brake early").
- **Settings**: grouped cards, accent icon tiles, preset pills (Auto / Road / Gravel / MTB / Walk), sliders with the
  current value on the right.
- **E-ink**: no colour dependence. Hatching for spans on the profile, black outline on the tile when active, hollow vs
  filled triangles for down / up.

## Perf

- `computeGrades` (resample + prefix-sum smoothing + finite difference) ran in about 2 ms for 20 000 vertices on Node
  **(synthetic, desktop)**; device cost is likely 10 to 30 times that, still well under a frame budget per route and not on
  the render path. It already runs once per profile build.
- The detector is one linear pass plus a merge pass over `data`. Expected sub-millisecond to a few milliseconds on device
  **(unverified on device)**. Memoise per profile object so rebuilds on sheet open are free.
- Map: tens of extra LineString features per selected route, re-set with the existing `setGeoJSON(2, ...)` call that already
  runs on each selection. Slicing coordinates is O(n). Not on the frame path.
- Chart: option (a) adds up to about 10 datasets; ui-chart redraws them on every highlight move, so cap the count (merge
  levels) and keep them as plain arrays (no per-draw allocation). Option (b) adds only limit lines like ascents do today.
- Navigation: recompute only when `onPathIndex` changes; binary search over sections.
- Storage: nothing extra persisted.

## Risks

1. **DEM artefacts on bridges and tunnels** produce phantom steep sections (a bridge reads as the valley it spans, a tunnel
   as the hill over it). This is the biggest risk to trust in a safety-related feature. Mitigation: Valhalla `bridge` /
   `tunnel` flags as a later filter, an honest caveat in settings, and a minimum length that drops 30 to 50 m glitches.
2. **Under-reporting short walls**: effective grade resolution is about 150 m, so a 60 m, 20 % ramp reads closer to 10 %.
   Say "max over 100 m", never promise exact peak grades. Tell the user why in the settings description.
3. **Noise-driven false positives** if the user lowers `baseline` / `smoothDistance` in the existing options
   (`BottomSheetInner.svelte:1060-1086`): 9.7 % phantom grade on flat at 30 / 50 **(synthetic)**. Either clamp those sliders
   or warn.
4. **Online elevation is rounded** (see above) and may need `height_precision`. Unverified.
5. **Thresholds are subjective**; wrong defaults make the feature feel noisy (everything is steep) or useless. Needs a
   per-bike preset and a way to see it work on the user's own routes before defaulting on.
6. **Stale overlays** on the map after a navigation reroute if overlays live only in the item's sub-layer.
7. **Style pipeline**: a map overlay needs an `inner` style edit, a `massif-style css2xml` rebuild of `inner.zip` for both
   `voyager` and `eink`, and a device run. `app/components/three/**` is not involved. No test runner exists; verification is
   `yarn svelte-check`, `./node_modules/.bin/eslint`, and running on device, so the detector should stay a pure module that
   can be exercised from Node like the prototype.
8. **Index mapping** between `profile.data` and `geometry.coordinates` assumes one entry per coordinate and a LineString;
   `MultiLineString` routes would misalign (existing assumption in `ElevationChart.svelte:204`).
9. **`app/` vs `tools/app` drift**: if any shared component under `app/components/common` is touched, check both copies
   (project rule). Planned changes avoid `tools/`.
10. The design doc and the code disagree on e-ink hatching (README says grades are hatched, the profile is not). Fixing it is
    in scope here and should be reflected in `docs/design/README.md`.

## Phased plan

| Phase | Content | Effort | Done when |
| --- | --- | --- | --- |
| 0 spike (0.5 d) | Run `findSteepSections` in Node on 3 to 5 real saved routes (export `profile` JSON from the DB). Tune exit, merge gap, min length. Confirm bridge / tunnel false positives. Check online `/height` precision | S | Defaults agreed on real data |
| 1 smallest valuable (1.5 to 2 d) | `steep.ts` + route-header tile + sheet list card (rows only, no tap actions) + i18n en / fr | S + S | `yarn svelte-check` clean; tile and list verified on device for a road route |
| 2 chart (1 to 2 d) | Limit-line markers (option b), legend row, tap row to zoom the chart range (reuse `range` prop, `ElevationChart.svelte:107`), e-ink hatching, tutorial update | M | Visible in light, dark and e-ink |
| 3 map (2 to 3 d) | Layer-2 features, `items.mss` + eink rules, rebuild `inner.zip`, label at steepest point, same in `navigation` layer | M | Overlay on a saved route and during navigation, survives a reroute |
| 4 navigation heads-up (2 d) | `nextSteep`, "ahead" card state, optional snack, setting | M | Warning appears at the right distance on a simulated route (`RouteSimulatorPanel.svelte`) |
| 5 settings + presets (1 d) | Preset from `route.subtype`, sliders, defaults per profile | S | Threshold changes update tile, chart, map, nav live |
| 6 extras | Climb categories pill; Valhalla bridge / tunnel filter; directions preview stat | S / M / S | Per item |

Total for the full feature: about 8 to 11 working days; phases 0 and 1 stand alone.

## Open questions for you

1. **Default thresholds**: are 8 / 12 up and 10 / 14 down right for the road preset; and for `normal`, `gravel`, `mountain`,
   `enduro`? Should hiking ("pedestrian") get the feature at all?
2. **Tracks without a route type** (imported GPX): assume `bicycle / normal`, or ask once on the sheet, or follow the item's
   icon?
3. **Tile**: add a 5th tile (narrower tiles), replace one, or show the figure only in the list card?
4. **Descents**: same colour family as climbs or a distinct one (blue as drawn)? Should a steep descent trigger a warning in
   navigation by default?
5. **Navigation warning form**: label in the "ahead" card only, plus a snack, plus vibration / sound (there is no TTS or
   vibration in navigation today)?
6. **Map**: overlay always on for the selected route, or a toggle in the chart / map options? During navigation too?
7. **E-ink**: hatch spans on the profile, in scope for this feature (also fixes the README gap)?
8. **Climb categories**: wanted in this feature, or a separate one? If yes, are Strava-style cut-offs fine?
9. **Bridge / tunnel filtering** via Valhalla stats: worth the extra map-match request, or accept the caveat for now?
10. Should `elevation_profile_grade_baseline` and `smooth` sliders be limited (noise risk) now that steep detection depends
    on them?
