# Risky road sections for cycling routes

Research and plan only, no app, SDK or cairn code touched. Mockups: [`01-road-risk.html`](01-road-risk.html) (fake data, light + dark + e-ink).
Paths are relative to `/Volumes/dev/nativescript/alpimaps` unless they start with `massif-sdk/` (`/Volumes/dev/massif/massif-sdk`) or
`cairn/` (`/Volumes/dev/massif/cairn`). "Unverified" marks what I could not confirm from source or a real run (nothing was executed on a
device or emulator, and no shipped basemap archive was available locally, only `cairn/output/world.mbtiles` at low zoom).
Round 2 of this report. [`DECISIONS.md`](DECISIONS.md) "Road risk" is the source of truth.

## Decisions (from DECISIONS.md) and what round 2 changes

| Decision | Status in this plan |
| --- | --- |
| Risk = bicycle on a road with speed >= threshold (default **70 km/h**, configurable) and **no hard separation** (no lane, shared, or painted lane) | Applied. Only a physically separated track (or a separate path) is safe. |
| Speed = tagged limit only, no estimation table | Applied. Untagged = "not evaluated", counted separately, never flagged. |
| Short sections still count | Applied. Default minimum length 30 m (setting 0-500 m), not 200 m. |
| Computed routes only, bicycle only, selected route only, with the stats fetch | Applied. |
| Navigation warning: banner only | Applied. No haptic, no sound. |
| 5th stat tile, D+ and D- merged into one tile | Applied (mockup). Counting ascent and descent separately risk is the 5th tile; merged, the row stays at four (distance, time, ascent/descent, risk). |
| Max-speed indicator on the route "style" | Designed (section "Route style"). |
| "Speed comes from the offline tiles" (decision 3) | **Needs your confirmation**: the facts below say the routing edges carry the same tagged limit with less work. Details in "Read path". |
| cairn PR OK, SDK patch OK if better | Change list in "cairn and SDK changes". |

## Verdict

**Feasible; medium effort. One decision to confirm: where the app reads speed and lane from.**

1. **The tiles do carry `maxspeed`, but lossy and without any cycle infrastructure.** Verified in the generator
   (`cairn/planetiler/planetiler-openmaptiles/.../layers/Transportation.java`): an integer `maxspeed` from z12, no `cycleway`, no
   `lanes`, no `shoulder`, `bicycle` only when it is `yes`. A "55 mph" tag comes out as 55 (unit lost). So the tiles alone cannot say
   "painted lane" versus "separated track" until cairn changes and every region is re-tiled.
2. **The route's own Valhalla edges already carry both, with no geometric matching.** `trace_attributes` (already called for the surface
   stats) returns per edge `speed_limit` (the tagged `maxspeed`, omitted when untagged, `"unlimited"` for `none`), `cycle_lane`
   (`none | shared | dedicated | separated`), `use`, `road_class`, and the OSM `way_id`. The earlier plan failed to say that
   `speed_limit` *is* the tagged limit and needs no estimate table once estimates are dropped.
3. **Same OSM tag, so the same coverage.** Tiles and Valhalla both read only a numeric `maxspeed`; implicit zone values (`FR:urban`) are
   dropped by both. Neither source is "more complete". Valhalla parses it better (mph converted, `none` kept).
4. **Valhalla's `cycle_lane` has one real hole**: it ignores `cycleway:both` (`cairn/valhalla/lua/graph.lua:1693-1699`). Roads tagged
   `cycleway:both=lane|track` read as `none`, which would flag lanes that exist. Fix in cairn's Valhalla fork, then rebuild routing tiles.

**Recommendation: read speed and lane from the route's Valhalla edges (extend the existing stats call), patch cairn's Valhalla lua for
`cycleway:both`, and ship the tile attributes as a second cairn PR** (map display, GPX tracks later, cross-check). If you still want tiles as the
primary source it works, see "Option B" for the cost.

## Data

### What the app requests today

- `app/services/PackageService.ts:789-830` `getStats()`. Default attributes (L791): `edge.surface, edge.road_class, edge.sac_scale,
  edge.use, edge.length, edge.begin_shape_index, edge.end_shape_index`. Offline it builds a `match-request` and reads
  `JSON.parse(rawResult).edges` (L805-820). `shape_match` defaults to `walk_or_snap`.
- Online path `app/services/NetworkService.ts:557-573` **hard-codes `costing: 'pedestrian'`** and `getStats` does not forward `profile` there.
- `fetchStats()` L832-896 folds edges into `waytypes`, `surfaces`, `surfaceSegments` (L868-873, merges consecutive edges when
  `previous.end === begin_shape_index`). Stored in `RouteStats` (`app/models/Item.ts:153-170`), one JSON column, no migration.
- Edge `length` is in km. `begin/end_shape_index` index the *matched* shape; the existing code treats them as indices of the item polyline
  (unverified they are identical). For the map overlay, slice by cumulative edge length instead (see "Route style").

### What the tiles really contain (transportation layer)

Verified in `cairn/planetiler/planetiler-openmaptiles/src/main/java/org/openmaptiles/layers/Transportation.java` (call site
`process(OsmHighwayLinestring)`, L564-643). Reference build flags (`cairn/docs/pipeline-reference.md:44`) include
`--transportation_z13_paths --transportation_surface_detail=true`; the shipped tiles are unverified against this.

| Attribute | Line | From zoom | Format | Notes for risk |
| --- | --- | --- | --- | --- |
| `class` | L596 | all | `motorway trunk primary secondary tertiary minor service track path raceway busway` (+ `_construction`) | `minor` = unclassified/residential/living_street/road (`OpenMapTilesSchema.java:1155`). `path` = pedestrian/path/footway/cycleway/steps/bridleway. |
| `subclass` | L597 | all | only for `path`: the highway value (`cycleway`, `footway`, `path`...) | A separate cycleway is `class=path, subclass=cycleway`: never a car road. |
| `maxspeed` | L621 | **z12** | integer, `0 -> null` | See parsing below. Undirected. |
| `oneway` | L622 | z12 | `1` / `-1` | Relative to line direction; oneway lines are not merged (L837-843). |
| `bicycle` | L606 | z9 | `1` only when `bicycle=yes` | `no`, `designated`, `use_sidepath`, `dismount` are not emitted. |
| `foot` | L607 | z9 | `0` only when `foot=no` | |
| `surface` / `surface_detail` | L627-629 | z12 / z14 | `paved` for path/track only; raw OSM value with the flag | Not needed. |
| `access`, `toll`, `ramp`, `layer`, `brunnel`, `service`, `expressway`, `tracktype`, `sac_scale`, `mtb_scale`, `official` | L600-620 | z8-z12 | | Not needed. |
| `cycleway`, `cycleway:left/right/both`, `segregated`, `lanes`, `shoulder`, `sidewalk`, `motor_vehicle`, `maxspeed:forward/backward` | **absent** | | | The gap. |

**`maxspeed` parsing.** `element.source().getLong("maxspeed")` (L621) goes through `Parse.parseLong`
(`planetiler-core/.../util/Parse.java`, L40-69): `Long.parseLong`, else a `NumberFormat` *prefix* parse. Consequences, derived from the
code (not run):

| OSM value | Tile value | Correct |
| --- | --- | --- |
| `50` | 50 | 50 km/h |
| `55 mph` | **55** (unit lost; the test fixture at `TransportationTest.java:408` never asserts it) | 89 km/h |
| `30;50` | 30 | ambiguous |
| `none`, `walk`, `signals`, `FR:urban`, `DE:rural` | absent | `none` = no limit |
| `maxspeed:forward` / `:backward` only | absent | |

**Zoom coverage.** Roads exist from `MINZOOMS` (L223-235): motorway z4, trunk z5, primary z7, secondary z9, tertiary z11, residential and
unclassified z12 (L674), minor z13, track z13, path z13/14, service z14. `maxspeed` from z12 means tertiary is drawn at z11 without it.
**Reading at z14 (the build's max zoom) has everything.** Post-processing (L830-851) merges lines with identical attributes only, so every
`maxspeed` change splits the feature (good), but merged features lose way identity and, for two-way roads, direction.

**Feature ids.** Planetiler sets the MVT id to `wayId * 10 + 2` (`PlanetilerConfig.java:254-257`, multiplier 10), but `FeatureMerge`
keeps only the first merged feature's id with its last digit zeroed (`FeatureMerge.java:81-83, 158`). Joining tile features to Valhalla
`way_id` is therefore unreliable. The SDK decoder does pass the id through (`MBVectorTileDecoder.cpp:902`, `VectorTileFeature.h:38`);
whether JS sees it is unverified.

### What Valhalla carries (offline engine = stock Valhalla 3.8.3)

The offline path is the stock action on the `.vtiles` graph (`massif-sdk/all/native/routing/utils/ValhallaRoutingProxy.cpp:197-217`; fork
version `massif-sdk/docs/maintenance/valhalla-upgrade.md:9`). cairn builds those tiles with its own Valhalla 3.8.3
(`cairn/valhalla`, lua `cairn/valhalla/lua/graph.lua`). Serializer: `massif-sdk/libs-external/valhalla/valhalla/src/tyr/trace_serializer.cc`.

| Filter | JSON | Source / meaning |
| --- | --- | --- |
| `edge.speed_limit` | `speed_limit` km/h, omitted when 0, `"unlimited"` for 255 (L92-98) | `maxspeed`: `normalize_speed` converts mph and drops < 10 (`graph.lua:771-788`); `none` -> unlimited, `walk` -> 5 (L1764-1771). Stored on the way (`graphbuilder.cc:681, 951`), so undirected like the tile. |
| `edge.cycle_lane` | `none shared dedicated separated` (L114) | `graph.lua:1661-1731`: `shared` = shared_lane/share_busway/shared; `dedicated` = lane/opposite_lane/buffered_lane; `separated` = track/opposite_track. Per directed edge (right/left resolved). **`cycleway:both` ignored** (L1693-1699, but used for bike access at L1388). |
| `edge.use`, `edge.road_class` | strings | Off-road uses are never car roads. |
| `edge.way_id` | OSM way id (L151; `triplegbuilder.cc:1483`) | Cross-checks and debugging. |
| `edge.shoulder` | bool (L106) | Paved margin. |
| `edge.default_speed` | **never serialized** | Not needed any more (no estimates). |

Unverified: the content of the `.vtiles` the user actually has, and the version behind `DEFAULT_VALHALLA_ONLINE_URL`.

### Classification table (levels)

`T` = threshold (default 70 km/h). Tile column = the attribute values proposed in "cairn and SDK changes".

| Infrastructure on the road | Valhalla `cycle_lane` | Proposed tile `cycleway_l/r` | Level when speed >= T |
| --- | --- | --- | --- |
| Nothing | `none` | absent | **HIGH** |
| Shared lane markings, bus lane open to bikes | `shared` | 1 | **HIGH** (no protection) |
| Painted lane, advisory lane, buffered lane | `dedicated` | 2 | **MEDIUM** |
| Paved shoulder only | `shoulder=true`, lane none | `shoulder` | **MEDIUM** (a margin, still no separation) |
| Kerb-separated cycle track beside the road | `separated` | 3 | safe |
| Separate path as its own way, route rides it | `use=cycleway/path/footway...` | `class=path` | safe (not a motor road) |
| Path mapped separately but the route stays on the road (`cycleway=separate`, `use_sidepath`) | `none` | 4 | **HIGH**, plus info "a path exists" |
| Speed untagged | no `speed_limit` | no `maxspeed` | not evaluated (counted separately) |
| `maxspeed=none` | `"unlimited"` | 255 (proposed) | treated as 130: HIGH unless separated |
| Motorway/trunk without a tag | `road_class` | `class` | open question 2 |

Level applies per edge. "Motor road" = `use` in `road, ramp, turn_channel` or missing (same rule as `PackageService.ts:846-870`).

## Read path

The route is a polyline; tiles hold road features. Three ways to get speed + lane per section, compared for a 100 km ride:

| | A. Valhalla edges (recommended) | B. Tile features along the route | C. Valhalla carries more |
| --- | --- | --- | --- |
| Identity of the road | exact: the edge the route is on | geometric guess, parallel ways collide | exact |
| Extra request | none, 3-5 more attributes on the existing call | decode ~90 z14 tiles + match | none |
| Speed | `speed_limit` | `maxspeed` (mph bug until cairn) | same as A |
| Lane | `cycle_lane` (after the lua fix) | none until cairn + **full re-tile** | same as A |
| Direction aware | yes | no for merged two-way lines | yes |
| Missing data | no routing tiles = no offline route anyway; web fallback | tile not downloaded = unknown section | |
| App effort | S-M | M-L (matching in JS) or L (new SDK method) | S |
| Data work | lua patch + routing tile rebuild | Transportation.java + full basemap re-tile | |

### A. Valhalla edges (recommended)

- Extend `getStats` attributes with `edge.speed_limit, edge.cycle_lane, edge.shoulder` (+ `edge.way_id` for debugging). About 40 more bytes
  per edge, ~1-3 thousand edges per 100 km: +40-120 KB of JSON (estimate, unmeasured). One call, no new latency class.
- Requires the existing defects fixed: forward the profile (`bicycle`) and costing on both paths (`PackageService.ts:813-815`,
  `NetworkService.ts:564`) and the `max_shape` ceiling for very long routes (old report, unchanged).
- Coverage equals the tiles for speed (same tag). Cycle lane equals the tiles *after* the lua fix, and is direction aware.

### B. Tile features along the route (if you want tiles as the primary source)

What exists: `VectorTileSearchService.findFeatures` (`massif-sdk/all/native/search/VectorTileSearchService.cpp:115-170`) reads raw tiles,
unfiltered by style (`MBVectorTileDecoder.cpp:870-910`, all attributes, optional layer list), and the app already wraps it:
`PackageService.ts:361-376` (z14, `preventDuplicates`, layer list without `transportation`) and `searchInVectorTiles` L478-510. A request
accepts a `LineString` (`buildSearchRequest`, L515-518). Findings:

1. **One call for the whole route does not scale.** `SearchProxy::testBounds` (`search/utils/SearchProxy.cpp:315-330`) and `testElement`
   (L332-346) compute a boost distance against the *whole* polyline for every candidate tile and every feature: roughly
   features x vertices x route points. The app's own note says a 187 km disc at z12 "loads ~2900 tiles and stalls"
   (`app/stores/terrainStore.ts:342-345`). Chunk the route (about 3 km, ~35 calls per 100 km, ~2 tiles each, ~90 distinct tiles at
   1.7 km per z14 tile at 45 deg N; decode cost per tile unmeasured, expect low tens of ms).
2. **`preventDuplicates` must be off.** It drops features of the same layer and `name` within 1 mm (`VectorTileSearchService.cpp:146-153`),
   which deletes touching unnamed road segments.
3. **Matching is ours.** Sample every ~25 m, find the nearest car-road feature within ~15 m with a bearing check (parallel cycleway and
   road both qualify), tie-break on class. A feature appears in each tile it crosses, clipped; dedupe by geometry. Cost: ~4000 samples x
   ~50 candidates in JS, a few hundred ms (estimate). Ambiguity cannot be removed without topology.
4. **Tiles not downloaded** -> `loadTile` returns nothing; the section is "unknown". Use `packageService.localBaseArchives`
   (`PackageService.ts:194-202`) to say up front that the route is not covered; the world archive is low zoom only.
5. **A native `findAlong(line, radius, layers)` SDK method** would decode each tile once and do the distance in C++ (S-M in the SDK plus
   the API facade `all/native/api/MethodImpls.cpp`, `SpecFactories.cpp`, JS typings, an SDK release). Only worth it if B is chosen.

### C. Valhalla carries more

Nothing more is needed beyond A's attributes. `default_speed` stays unserialized (no estimates wanted). The lua `cycleway:both` patch is
the only data change; it is part of A.

### Not-downloaded and out-of-date data

A: no offline route tiles = the stats call falls back to the web service (cycle lane there depends on the server's build; unverified).
Persist what was computed with a version stamp (`risk.v`, source `valhalla|tiles`) so the cross-feature "out of date, update" rule can use it.

## Algorithm

Pure TypeScript module `app/utils/roadRisk.ts`, no NativeScript imports (same rule as `app/utils/grade.ts:1-2`). No test runner exists:
reason about it explicitly and say so.

```
motor      = use in {road, ramp, turn_channel} or use missing
speed      = speed_limit number | "unlimited" -> 130 | absent -> unknown (not evaluated)
infra      = cycle_lane: separated -> 3, dedicated -> 2, shared -> 1, none -> 0 ; shoulder -> 0.5
risky edge = motor and speed known and speed >= T and infra < 3
level      = HIGH   if infra <= 1
           = MEDIUM if infra == 2 or shoulder
```

Candidates are persisted, classification happens on read, so changing T or the minimum length re-classifies saved routes without a new fetch:

```ts
interface RouteStats { /* existing */ risk?: { v: 1; src: 'valhalla' | 'tiles'; candidates: RiskRun[]; unknown: number /* m, speed untagged on motor roads */ } }
interface RiskRun { start: number; end: number; startDist: number; length: number; speed: number; infra: 0 | 1 | 2 | 4; shoulder?: 1 }
```

Candidates = motor edges with `speed >= 50` and infra < 3 (50 floors the slider), consecutive edges with the same `(speed, infra)` merged
(valhalla splits a road at every junction). `classifyRisk(candidates, { threshold, minLength, bridge, paintedCounts })`:

1. Filter `speed >= T`. 2. Bridge gaps: a safe or unknown run shorter than `bridge` (default 50 m, was 100) between two risky runs of the same
road is absorbed; level = the higher one. 3. Drop runs shorter than `minLength` (default **30 m**, setting 0-500 m; the user's rule is that
short sections matter, so this only removes single-vertex noise). 4. Output `{level, start, end, startDist, length, speed}`; the sign
speed is the max of the run.

Complexity: one pass over edges (the loop in `fetchStats` L846-883 already does it); candidates are tens to a few hundred entries.

## Route style (max-speed indicator)

Two kinds of feature, added to the selected item's overlay layer; both are plain GeoJSON, no tile or SDK change.

- `risk` LineString slices of the item geometry, props `{ class: 'risk', level: 2|1, speed, base: 'items'|'directions' }`.
- `risk_sign` Point at the middle of each run (and every ~2 km inside a longer one), props `{ class: 'risk_sign', speed, level }`.

**Where.** The selected item draws in `#items` (saved, `dev_assets/styles/inner/shared/items.mss:5-80`) or `#directions` (computed,
`shared/directions.mss`); the navigation layer draws the followed copy (`shared/navigation.mss:20-46`). The local source already has a
second layer `poi` (`ItemsModule.ts:240-241`) that `onItemSelected` fills with steps, waypoints and ascents (`ItemsModule.ts:549-613`,
called from `app/components/map/Map.svelte:777`), and `poi` is listed after `navigation` in the style (`dev_assets/styles/inner/voyager.json:2-13`), so an overlay there
draws above both the item and the navigation route. Add the features in `onItemSelected` next to `ascents`, from `item.stats.risk`
classified with the current settings. No second data source.

**Slicing.** Slice by distance, not by `begin_shape_index` (indices are into the matched shape): walk the item polyline accumulating
segment length and cut at `startDist` and `startDist + length`. Stored `start/end` stay as a fallback only.

**Style (proposal, not compiled).** A new `shared/risk.mss` added to `styles` in both `dev_assets/styles/inner/voyager.json` and
`eink.json`; both compile through `app.webpack.config.js:939-940` into `inner.zip`. Colours as variables so `eink/style.mss` overrides them
(the existing pattern, `eink/style.mss:1-31`).

```
@risk_high: #d32f2f;  @risk_med: #e08a00;  @risk_med_dash: none;
@risk_width: [base]='directions' ? @directions_line_width : @bicycle_line_width + 2;
#poi['mapnik::geometry_type'=2][class='risk'] {
  casing/line-color: #fff;  casing/line-width: @risk_width + 3;  casing/line-join: round;
  line-color: [level]=2 ? @risk_high : @risk_med;  line-width: @risk_width;  line-join: round;
  [level=2] { tick/line-color: #fff; tick/line-width: 2; tick/line-dasharray: 2, 5; }
  [level=1] { line-dasharray: @risk_med_dash; }   // voyager: none; eink/style.mss sets @risk_med_dash: 6, 3 and black colours
}
#poi[class='risk_sign'][zoom>=11] {                       // road-sign badge: white disc, red ring, number
  text-name: [speed];  text-face-name: @mont_bd;  text-size: 11;  text-fill: #000;  text-placement: billboard;
  text-placement-priority: 25;  text-allow-overlap: false;
  text-background-fill: #fff;  text-background-border-fill: @risk_high;  text-background-border-width: 3;
  text-background-width: 24;  text-background-height: 24;  text-background-radius: 12;
}
```

Why a text plate and not an SVG shield: `text-background-width/height/radius/border` are documented and measured in
`massif-sdk/docs/features/label-styling.md:123-160` and already used by the app's other styles (`dev_assets/styles/osm/shared/route.mss`),
and a billboard label gives one sign per section with collision culling for free. `line-border-*` shares the fill's dash pattern, so
the white casing is a separate symbolizer, as `detour` does (`shared/navigation.mss:48-59`). Existing dashes to avoid: biking route
`6,6`/`10,6`, editing `12,8`, `original` `8,6` (e-ink `8,8`), `detour` `18,10` (e-ink `20,12`), `connector` `2,8` (e-ink `3,9`). The sign
shows the number in km/h; the unit setting can convert for mph users (not designed).

**Navigation.** The item stays selected while navigating (`setNavigating` only changes style parameters, `NavigationRouteModule.ts:338-340`),
so the `poi` overlay keeps drawing above the followed route. A full reroute swaps in an in-memory item without stats
(`app/services/navigation/NavigationRoute.ts:5-9`); the overlay then belongs to the planned route and the banner stops (no data for the
detour).

**Open styling choices (mockups show them):** HIGH = red with white ticks, MEDIUM = amber solid (dash `6,3` on e-ink); sign only on
risky runs, not on safe fast roads. Verify on device: `text-background-*` on a `poi` billboard with a dynamic number, and the draw order of
the casing symbolizer, are unverified in this style.

## Integration points

Computed with the stats fetch (decision 1), bicycle computed routes only (decision 2).

| Step | File | Change |
| --- | --- | --- |
| Request | `PackageService.ts:791` | add `edge.speed_limit, edge.cycle_lane, edge.shoulder` (+ `edge.way_id` under `DEV_LOG`). |
| Profile | `PackageService.ts:813-815, 824`; `NetworkService.ts:557-573` | forward `profile`/`costing` (today the web path is always `pedestrian`). Run the risk step only when `item.properties.route.type` is bicycle. |
| Compute | `PackageService.ts:846-883` | build `risk.candidates` in the same loop as `surfaceSegments`. |
| Store | `app/models/Item.ts:153-170` | `RouteStats.risk?`. Missing = "not fetched" (old saved stats). |
| Fetch triggers | `DirectionsPanel.svelte:149, 819-822` (`auto_fetch_stats`), `BottomSheetInner.svelte:675, 734-737`, `NavigationActions.svelte:36-39` | pass `{ item, profile }`. |
| Tiles | `app/components/bottomsheet/RouteStatTiles.svelte:42-60` (`tilesFor`), columns follow tile count at L63 | **merge `ascent` + `descent` into one two-line tile** (two rows, 13 dp each; a single line `1 480 / 1 480 m` is too wide at ~74 dp per tile; tooltip "Ascent / descent") and add the `risk` tile (alert icon + exposed km), only when > 0; tile also shows "unknown x km" in its tooltip. The finish-flag `remaining` sub-row (L19-34, 76-86) takes the tile's second row today, so the merged tile needs a rule for it (question 8); check 320 dp. |
| Stats card | `RouteStatsView.svelte:30-96` (`statsKey` `waytypes`/`surfaces`) | third view `risk`: stacked bar + three legend rows. Hatching reuses `drawSurfaceBand` (`app/utils/surfacePattern.ts`). |
| Profile | `app/components/chart/ElevationChart.svelte:581-600` | risk band under the axis (second flat data set). Unchanged from round 1. |
| Map overlay | `ItemsModule.ts:549-613`; `dev_assets/styles/inner/shared/risk.mss` (new) + `voyager.json`/`eink.json` | see "Route style". |
| Navigation banner | `app/components/navigation/NavigationView.svelte:69-80` (`liveText` cascade) and `:117-118` (the live row) | first branch of the cascade: "Fast road in 400 m" / "On a fast road, 1.2 km left", danger outline on the row, x to dismiss until the next run. Uses `navigationProgress.onPathIndex` and a pointer into the sorted runs. **No layout change**: `navigationSections` (`app/utils/navigation.ts:44-54`) and `navigationRailTop` (`Map.svelte:1699`, "nothing under the banner moves") stay as they are. |
| Settings | `app/stores/navigationStore.ts` (settings near L164, parameter list near L670), constants pattern `app/utils/constants.ts:55, 127`, strings `en.json` + `fr.json` | `risk_show`, `risk_warn`, `risk_threshold` (50-110, default 70), `risk_min_length` (default 30), `risk_painted` (default on), `risk_warn_lead` (default 500 m). |
| Export | `ItemsModule.ts:779` `itemsAsGeoJSON` | `stats.risk` rides along in shares. Fine. |
| Tutorial | `app/components/tutorial/tutorialPages.ts` | no new gesture in v1. A tap on the tile or sign that does something would need `gesture_<id>_*` in `en.json` + `fr.json` in the same change. |

## cairn and SDK changes

### cairn: Valhalla lua (part of the recommended path)

`cairn/valhalla/lua/graph.lua:1693-1699`: resolve the lane with `cycleway:both` as a fallback before `cycleway:right/left`
(`shared[kv["cycleway:both"]] or separated[...] or dedicated[...]`), and consider `cycleway:*=separate`/`bicycle=use_sidepath` (no lane,
flagged by a separate `kv` if the PR wants the "a path exists" note). Rebuild routing tiles (`cairn valhalla` step). Small diff, full
routing-tile rebuild for every region. Also upstream-able to Valhalla (untrusted web state not checked).

### cairn: tile attributes (second PR; needed for option B and map display)

In `Transportation.java` `process(OsmHighwayLinestring)`, next to L621, read raw tags with `element.source().getTag(...)` (no regeneration
of `Tables.java`, as `tracktype` does at L612-613):

| Attribute | Values | From zoom | Rule |
| --- | --- | --- | --- |
| `maxspeed` (fix) | km/h int, `255` = `none` | z12 | number prefix; `mph` suffix x 1.609344 rounded; `a;b` = first; `< 10` and `walk` dropped (as Valhalla `normalize_speed`). |
| `cycleway_l`, `cycleway_r` | `1` shared, `2` lane (lane, advisory, buffered, exclusive), `3` track (physically separated: `track`, or `separation` kerb/bollard/flex_post/parking), `4` separate (`separate`, `use_sidepath`), absent = none | z13 | per side: `cycleway:<side>` > `cycleway:both` > `cycleway`; `opposite*` ignored in v1. |
| `shoulder` | `1` | z13 | `shoulder` in `yes both left right`. Optional. |

Side values depend on line direction, and `mergeLineStrings` re-orients two-way lines, so give features that carry `cycleway_l/r` the same
no-merge tag as oneways (`LIMIT_MERGE_TAG`, L837-843). Gate everything behind new options modelled on `transportation_surface_detail`
(L213-222): `transportation_cycleway`, `transportation_cycleway_minzoom` (default 13), and add them to `cairn/docs/pipeline-reference.md`
and the presets (the README says tests compare that document with the defaults). Size: `surface_detail` costs +0.84% for every class
(`cairn/README.md:127`); cycleway attributes touch a small share of roads, expect well under that (unmeasured). Tests next to
`TransportationTest.java:408`.

**Re-tile needed:** yes, for every attribute above. Planetiler output changes for every region and `--area`; users re-download basemaps.
The app must treat missing attributes as "unknown" so old tiles keep working. The lua change needs only the routing tiles rebuilt.

### massif-sdk

- Recommended path (A): **nothing**. No `default_speed` patch is needed because estimates are dropped.
- Option B only: `findAlong` on `VectorTileSearchService` (above). Not recommended unless tiles become primary.
- Style only: `text-background-*` is already supported; confirm the shipped SDK version has it (used by other app styles).

## UI (mockups)

All in [`01-road-risk.html`](01-road-risk.html), tokens and classes of `docs/design/mockups.html`. Rules from `docs/design/README.md`:
theme colour stays the accent, neutral surfaces, **warnings are an outlined danger label, not a filled block**, colour is never the only
signal (hatching, dashes), 48 dp targets, e-ink variants.

- **Route sheet.** Tiles: distance, time, **ascent / descent (one two-line tile)**, **risk** (outlined danger, hidden at 0). The row stays at four
  tiles, so there is room for one more from the other features. Road safety stats view as before plus a row "speed not tagged, not evaluated".
- **Map.** Risk slices with white casing and the speed sign badge; legend card and a map button. Light, dark, e-ink.
- **Navigation.** Warning banner in the bar card's live row; sections ahead also visible on the map overlay.
- **Settings.** "Road safety (cycling)": show, warn while riding, fast from (slider 50-110, default 70), ignore sections under (default
  30 m), painted lanes count, warn lead distance. No "estimated speeds" row any more.

## Perf

- Request: same call, three more attributes; +40-120 KB for 100 km (estimate). Hard limit shared with surface stats:
  `service_limits.trace.max_shape = 16000` (`massif-sdk/all/native/assets/ValhallaDefaultConfig.h:251`); routes over ~16000 shape points
  fail the whole stats call (chunk on edge boundaries, unverified on a real long route).
- `walk_or_snap` can fall back to `map_snap` and attach edges to a parallel road: a false positive source (unmeasured).
- Classification: O(edges). Reclassify on a settings change: O(candidates), in a reactive statement.
- Map overlay: tens of LineString slices plus tens of points in `poi`; slicing is O(points).
- Navigation: a pointer into the sorted runs advanced with `onPathIndex` (binary search on a cold start).
- Option B (for comparison): ~35 `findFeatures` calls and ~90 tile decodes per 100 km plus JS matching, a few seconds on a phone,
  background thread, unmeasured.

## Risks

1. **`cycleway:both` read as no lane** until the lua fix: false HIGH on roads that have lanes. Mitigation: do the lua PR first; Phase 0 logs it.
2. **Speed coverage is as good as OSM `maxspeed`**: untagged fast roads are silently not flagged. UI copy says "based on OpenStreetMap
   tags" and shows the unevaluated length.
3. **Re-matching can pick a parallel edge** (`map_snap` fallback, web `pedestrian` costing).
4. **Web path correctness**: `costing: 'pedestrian'` hard-coded (`NetworkService.ts:564`); unverified server data version.
5. **Profile not forwarded** from the sheet and navigation fetches; the offline service keeps the last profile set on the singleton
   (`PackageService.ts:815`), a race with a concurrent route computation (unverified).
6. **Tile attribute change forces a full re-tile and re-download** (option B / PR 2). Gate with options; old tiles must degrade to unknown.
7. **Style unverified on device**: text plate behind a dynamic number on a `poi` billboard, e-ink dashes, casing symbolizer order.
8. **Scope**: pedestrians have a different risk; bicycle only for now.
9. **Max shape ceiling** for very long routes.

## Phased plan

| Phase | Content | Effort |
| --- | --- | --- |
| 0 Spike (decision gate) | `DEV_LOG` call of `getStats` with the new attributes on 3 offline routes (Alps rural, urban, GPX). Log: share of motor edges with `speed_limit`, `cycle_lane` values, a known `cycleway:both` road. Same routes through `searchInVectorTiles` chunked, to compare speed per section (confirms or refutes "same coverage"). | S (1 day) |
| 1 cairn lua | `cycleway:both` patch, routing tile rebuild for the test region. | S (+ rebuild time) |
| 2 Core | `roadRisk.ts`, `fetchStats` extension, `RouteStats.risk`, forward profile/costing, merged D+/D- tile + risk tile, Road safety view, en/fr strings, settings with defaults. | M (2-3 days) |
| 3 Map style | `risk.mss` (voyager + eink), `poi` features in `onItemSelected`, legend + toggle. Source is in this repo, so no longer a blocker. | M (2 days) |
| 4 Navigation banner + settings UI | `liveText` branch, dismissal state, pointer into runs, settings group. | S-M (1-2 days) |
| 5 Profile band | Band under the axis + "Road" cell in the strip. | S-M (1-2 days) |
| 6 cairn tiles PR (optional) | `Transportation.java` attributes + options + docs + tests; re-tile. Needed for option B, map display and GPX tracks. | M + full re-tile |
| 7 Option B (only if chosen) | JS matching, or SDK `findAlong`. | M-L |

Verification for every phase: `yarn svelte-check` (primary gate), `./node_modules/.bin/eslint <files>`, a run on the emulator. There is no test
runner; the classifier is pure but unexercised until Phase 0 data exists. `app/components/three/**` is not involved. `inner` style changes
need a visual check on device.

## Unresolved questions

1. **Confirm the read path**: Valhalla edges (recommended) with tiles as a later cairn PR, or tiles as the primary source (cost above)?
2. **Motorway and trunk with no `maxspeed`** on a bicycle route: flag regardless of speed (class implies a fast road), or stay strictly
   "tagged only"? Proposed: strictly tagged, show them in the unevaluated length.
3. **Shoulder** counts as MEDIUM (a margin is not a separation). Confirm, or treat it as safe?
4. **Speed sign scope**: only on risky runs (proposed), or also on fast roads that have a separated track (speed information only)?
5. **Banner minimum length**: same 30 m as the list, or a larger one (for example 100 m) so every junction crossing does not trigger a
   banner? Proposed: separate setting, default 100 m, the list keeps 30 m.
6. **Banner placement**: the bar's live row (proposed, no layout change) or a floating card under the maneuver card (moves nothing only if
   it overlays the map)?
7. **Imperial users**: sign in mph?
8. **Merged ascent/descent tile while following a route**: the finish-flag second row is taken by the descent line. Show remaining ascent only,
   alternate, or keep the sub-row off for this tile?
