# 05 - Time in sun vs shade along a route

Research and design only, nothing implemented. Mockups: [`05-sun-shade.html`](05-sun-shade.html) (light, dark, e-ink; fake data; scene Sun 1 Nov, departure 14:20 CET).
Rules followed: `docs/design/README.md`, `.claude/CLAUDE.md`. Fits the model of [`00-unified-design.md`](00-unified-design.md) (`RouteAnalysis`, `Layer<SunData>`, `RouteTimeline`, freshness chips).
Branch read: `master` (suncalc 2.1.1 in `package.json:135`). SDK read: `/Volumes/dev/massif/massif-sdk` at `bf31a68b0`.

Labels used below: **measured** = I ran it (prototype, this Mac: Apple M5 Pro, 1 thread, 2026-11-01); **estimated** = arithmetic or extrapolation, not run; **read** = I read the code, did not run it; **unverified** = not checked.

## Decisions (box)

From the user (`DECISIONS.md`, "Sun / shade"): shadows drawn in the 3D view are wanted (tier 1b); a **map mode that sets date / time / shadow from the computed route**, **cloud cover sets shadow strength**; **SDK addition accepted** to compute mountain shadows (no buildings) offline for the route, **fast**, departure + ETA aware; sun is a **separate section, not a tile**; time model **proportional to distance** for now; everything computed is **persisted**; **hiking and cycling** with different thresholds; **route's time zone**.

Design decisions taken in this update (each can be flipped; reasons in the sections):

| # | Decision | Why (short) |
| --- | --- | --- |
| D1 | New SDK call `computeSunExposure(positions, sunDirections, options) -> doubles` on `HillshadeRasterTileLayer` (and forwarded on `TerrainOptions`), C++ core in a header-only `SunExposure.h` | The app already holds the hillshade layer, which owns a query-only `ElevationManager` (`HillshadeRasterTileLayer.cpp:548-563`); no 3D attach needed |
| D2 | The caller passes the **sun direction per point** (azimuth, apparent altitude); the SDK does no astronomy | One sun source (suncalc 2) for ribbon, stats, 3D light and Tier 0; the SDK already has a NOAA sun (`sky-sun-shadows.md:34`) but 0.1 degree off suncalc matters against a 0.27 degree disc |
| D3 | Per-point **single-azimuth ray-march toward the sun**, growing steps, LOD by distance, tile-max skip, early exit. No horizon reuse, no corridor raster | Measured: 300-600x cheaper than 72-azimuth horizons per point; compute is milliseconds, **tile loading is the cost** |
| D4 | Async = the existing `callAsync` on **chunks of about 250 points**, no new cancellation primitive; native plan, parallel load, compute | `cancelCall` cannot abort a running call (`Context.h:239`); chunks bound latency and give progress |
| D5 | Result per point: sun fraction (penumbra aware), horizon angle, blocking distance, status bits (coarse DEM, no DEM, dark, low sun, truncated) | Partial coverage is a flag, never a silent guess |
| D6 | Persist `SunData.lit` (0-100, clear-sky, terrain only) + sparse flags on the item; **classification and clouds stay derived** | Matches `00-unified-design.md` 2.1; terrain part never ages, it is only superseded when the timeline/DEM change |
| D7 | **Route sun mode** = an explicit, transient override of the light (new store, never writes the user's persisted sun settings); one-tap exit chip; terrain 3D sun rows locked while active | Cannot fight the user's manual sun settings: nothing to restore |
| D8 | SDK: make the 15 degree **shadow floor a `LightOptions` property** (default 15) | Low sun is where route shade matters; today it is hard-coded (`MapRenderer.cpp:2512`) |
| D9 | Shadow strength = `terrainShadowStrength x clearness(t, place)`; below 8 % the shadow pass is skipped | Physical (direct share), free on overcast days |

## Verdict by tier (revised)

| Tier | What | Verdict | Effort |
| --- | --- | --- | --- |
| 0 | Sunrise / sunset vs ETA, twilight and night, glare, sun side, sky ribbon (suncalc 2 only) | **Do first.** No SDK, no DEM, offline | S |
| 1a | **Terrain shadows on the route, SDK `computeSunExposure`** (new) | **Do second.** Measured compute is ~1 ms per 1 000 points; the work is tile loading and persistence | M + SDK M |
| 1b | **Route sun mode**: 3D/map scrubber drives sun, shadow, strength | **Do with 1a**; SDK floor property optional but recommended | M + SDK S |
| 3 | Clouds from forecast: overcast band, effective sun, shadow strength | Rides on the weather layer (DNI, `sunshine_duration`, `cloud_cover`) | S-M on top of weather |
| 2a | Forest estimate (landcover `wood`) | Optional, later; label "estimated" | M-L |
| 2b | Buildings | Not recommended for hiking / cycling (unchanged) | L |

## What exists today (verified)

- **GPU shadows only, view-fitted, not readable per point.** `MapRenderer::applyShadows` + `TerrainShadowMap`; casters = exactly the terrain surfaces about to be drawn (`08-lighting-sky-fog.md` "Cast shadows"); cascades fitted to the view; no `isLit(pos)`; only `captureRendering` returns pixels. Rejected for data.
- **The shadow pass floors the sun at 15 degrees**: `MapRenderer.cpp:2509-2523` (`MIN_SHADOW_SUN_SIN = 0.2588f`, azimuth kept), documented `sky-sun-shadows.md:87` and `08-lighting-sky-fog.md:296-301`. N.L lighting keeps the true sun. Shadow strength is multiplied by the sun's share of the scene light, so shadows fade at dusk (`08-lighting-sky-fog.md` "shadowStrength is not the depth drawn"; share 0.13 at 2.5 degrees, 0.30 at 7.5 in the built-in curve).
- **CPU horizon**: `ElevationManager::calculateHorizon` (`ElevationManager.cpp:216-268`): first step 30 m, growth 1.008 (`:219-221`), refraction k = 0.13 (`:218`), curvature drop `d^2 / 2R_eff` (`:261`), returns -90 where no grid (`:225`). **Cache-only and non-blocking** (`:229-230`, `:247-257`), surface API only (`TerrainOptions.h` has no such method; exposed by the thunk at `MethodImpls.cpp:617-634`, registered `:950`, declared `TerrainOptions.i:35`). Peak finder uses it synchronously (`peakFinderSun.ts:152-190`).
- **Same DEM as 3D**: the terrain, the hillshade and the elevation queries read the same source (`terrain3d.ts:113-119`; layer from `CustomLayersModule.ts:1122`); source Mapterhorn `maxZoom: 16`, Terrarium (`tilesources.ts:101-110`). **But two `ElevationManager`s**: one in `TerrainOptions` (`TerrainOptions.cpp:22`), one lazily created inside the hillshade layer for `getElevation(s)` only (`HillshadeRasterTileLayer.cpp:548-563`). They share the tile source, not the decoded grid cache.
- **Sampling**: bilinear at texel centres, per-texel decode `h = c3 + sum c_i * byte_i` (`ElevationTileGrid.cpp:98-120`, `ElevationTileGrid.h:135-141`); tile max height available for free (`grid->getMaxHeight()`, used at `ElevationManager.cpp:498`); grids are whole decoded bitmaps (`getDataSize` = bitmap bytes + node field, `ElevationTileGrid.cpp:62-64`), so a 512 px RGBA tile is about 1 MB.
- **Cache and loading rules**: 64 MB cache that grows to **at least 192 grids** (`:35`, `:38`, `:466-474`); failed tiles are remembered 30 s (`:39`); prefetch queue capped at 384 (`:44`) with 3 worker threads (`:45`, `:645-647`); workers load with `LOAD_EXACT` (`:712`); concurrent loads of one tile are single-flight (`:436-448`). Lookups read cached ancestors up to 8 levels up (`:42`, `:406-430`). **Side finding (read, not run)**: `ALLOW_LOAD` returns a cached coarse ancestor before it loads the exact tile (`:406-430`), so `getElevations` precision depends on cache state; the new call therefore loads with `requestTileGrid` (`LOAD_EXACT`), not `ALLOW_LOAD`.
- **Async calls**: `Context::callAsync` runs on a worker, **one worker per distinct target, calls on one target are serialised** (`Context.cpp:725-745`, max 4 workers `Context.h:467`); `cancelCall` "does not abort a call in flight, the result is dropped" (`Context.h:239`). Bulk numeric results are a flat `doubles` handle (`MethodImpls.cpp:126-134`); the app's pattern is `hillshadeLayer.callAsync('getElevations', [positions.map(toPosition)])` (`PackageService.ts:571-575`).
- **App light**: `applyLight` (`terrain3d.ts:331-348`) writes `terrainLightingEnabled`, `sunOverridingStyle`, `sunAzimuth`, `sunAltitude`, `shadowStrength` from persisted stores (`terrainStore.ts:82-101`; shadows default on only on the Mac), re-applied by a store-subscription loop (`terrain3d.ts:603`). Settings rows: `terrain3dSettingRows.ts:133-198`. `LayerOptionsBottomSheet.svelte:40-41` only holds the hillshade illumination (not the terrain sun). The SDK also has `dayCycleLightsEnabled` (sun height drives the whole map's light, `day-cycle-light.md`); the app does not use it (grep: no hit).

## SDK API spec (new)

### Surface

Object API (Java / ObjC / C#, from SWIG on the public C++ method) and facade (NativeScript, web), same pair as `getElevations`:

```cpp
// layers/HillshadeRasterTileLayer.h, next to getElevations (:287-288); forwarded in components/TerrainOptions.h (:741)
std::vector<double> computeSunExposure(const std::vector<MapPos>& poses,            // WGS84, in route order
                                       const std::vector<double>& sunDirections,    // [az, alt] per pose, degrees, alt = apparent
                                       const std::shared_ptr<SunExposureOptions>& options) const;
```

```
// all/modules/layers/HillshadeRasterTileLayer.i (+ TerrainOptions.i), beside getElevations (:27-29 / :33-34)
!method(massif::HillshadeRasterTileLayer, computeSunExposure, arg(positions, positions), arg(sunDirections, json), arg(options, json), returns(doubles))
```

Plus `registerMethod("massif::HillshadeRasterTileLayer", "computeSunExposure", ...)` in `MethodImpls.cpp` (near `:112-134` and `:950-958`). `scripts/gen-api-bindings.sh` regenerates `docs/api/massif-api.json`, `bindings/typescript/massif.d.ts`, `massif_api_names.h` (`MASSIF_METHOD_COMPUTE_SUN_EXPOSURE`), ObjC/Java names; `ARG_TYPES`/`RETURN_TYPES` already cover `positions`, `json`, `doubles` (`gen-api-tables.py:150-151`). Java/ObjC/C# proxies: `scripts/swigpp-java.py`, `swigpp-objc.py`, `swigpp-csharp.py` with `/Volumes/dev/carto/mobile-swig/swig` (`CLAUDE.md` verification ladder step 3, `BUILDING.md:97-129`). NativeScript calls it through the published typings; web gets a `Float64Array` (`web/js/massif.mjs:192`) but no `callAsync` thread (chunks run synchronously there).

App call (shape only):
```ts
const doubles = await packageService.hillshadeLayer.callAsync('computeSunExposure', [positions.map(toPosition), sunDirections, options]);
```

### Options (`SunExposureOptions`, JSON on the facade)

| Key | Default | Meaning |
| --- | --- | --- |
| `eyeHeight` | 1.5 (hike), 1.2 (bike): the caller sets it | metres above ground at the point |
| `maxDistance` | 30 000 | cap on the march, m. Also bounded per point by `(zRegionMax - h0) / tan(alt - disc)` |
| `discRadius` | 0.2666 | sun disc radius, degrees: penumbra half-width |
| `darkBelow` | -0.2666 | apparent altitude under which the point is DARK and not marched (`-0.833` if the caller passes true altitude) |
| `lowSunBelow` | 2 | flag LOW_SUN (refraction and DEM far-field dominate) |
| `firstStep`, `stepGrowth` | 10 m, 0.003 | `step = max(firstStep, d * stepGrowth)` |
| `lodRatio`, `minTexel` | 1/300, 5 m | wanted DEM texel at distance d = `max(minTexel, d * lodRatio)` (zoom by the formula of `:248`) |
| `refraction` | 0.13 | as `calculateHorizon` (`:218`) |
| `load` | `"allow"` | `"allow"`: plan, load missing tiles, compute. `"cached"`: never wait, only request, flag what is missing |
| `loadTimeoutMs` | 20 000 | deadline for the load phase of **this call**; result flagged partial when hit |
| `cacheMB` | 96 | fixed cache budget for the job (`setCacheCapacity`, `:197-201`), so the 192-grid rule does not grow to ~200 MB; `releaseCache: true` clears it after |

### Result (flat `doubles`, versioned)

Header (8): `version=1, count, stride=4, tilesLoaded, tilesMissing, minZoomUsed, maxZoomUsed, flags` (bit0 deadline hit, bit1 some point truncated at `maxDistance`).
Per point (4): `sunFraction` (0..1, -1 unknown), `horizonDeg` (a lower bound when shaded: the march stops as soon as the sun is fully hidden; -90 none), `shadowDistanceM` (first sample that hid the sun centre line, -1 none), `status` bits: `1 COARSE_DEM` (answered from grids more than 2 levels coarser than wanted), `2 NO_DEM` (near field absent: fraction unknown), `4 DARK`, `8 LOW_SUN`, `16 TRUNCATED` (lit but the march stopped at `maxDistance` while the sun was < 4 degrees).

`sunFraction` is the visible fraction of the sun disc: with `x = clamp((alt - horizon) / disc, -1, 1)`, `fraction = (acos(-x) + x * sqrt(1 - x^2)) / pi` (0 shaded, 0.5 at the edge, 1 lit). **Measured**: mixed samples (0.3 <= fraction < 0.7) are only 0-1 % of the route, so the penumbra matters for the edge position, not for the totals.

### Behaviour (design)

1. **Plan** (geometry only, same step/LOD rule, no sampling): enumerate the wanted tile ids of the chunk, de-duplicated; a first coarse load gives `zRegionMax` (add +10 % because coarse grids are averaged) for the distance bound.
2. **Load**: `requestTileGrid` in batches under the queue cap (384, `:44`), ordered along the route; wait on a condition until none is pending (`isTileGridPending`, `:652`) or the deadline. Parallelism = the existing 3 prefetch workers. Offline: the data source answers from the package; a missing tile fails fast and is remembered 30 s (`:39`).
3. **Compute**: `CACHED_ONLY` reads with the thread-local memo (`:1009-1026`), exactly the data path of `calculateHorizon`. A point whose near field (< 500 m) has no grid gets `NO_DEM`; a coarse fallback gets `COARSE_DEM`. Never throws on missing data.
4. **Threads**: loads on the prefetch workers, compute on the `callAsync` worker (one thread, ~ms), UI thread untouched.
5. **Cancellation / progress**: none native. The app sends chunks of ~250 consecutive points (25 km at 100 m): each chunk is bounded by `loadTimeoutMs`, the app cancels between chunks (`cancelCalls()` drops the result) and reports progress as chunks done. Chunks also keep the working set under the cache (a 400 km route is 4-5 chunks, `releaseCache` on the last). Calls on the same layer queue behind each other (`Context.cpp:725-745`): a long chunk delays an elevation-profile call on the same layer, hence the short deadline.
6. **Header-only core** `all/native/terrain/SunExposure.h`, templated on a ground accessor like `TerrainOcclusion::isSegmentBlocked` (`TerrainOcclusion.h:34-57`), so it is host-testable with a synthetic height field: `tests/api/SunExposureTest.cpp` (flat = lit; wall of height H at distance D shades iff `alt < atan(H/D)`; fraction 0.5 at the edge; curvature term; DARK; NO_DEM; step/LOD agreement vs a fine reference). Docs owed in the same commit: a `docs/features/` page and the api reference; demo knob in `DemoLive.java` (`CLAUDE.md` rules).
7. **Not in scope**: buildings, trees, tunnels, bridges (DEM only). Whether Mapterhorn is a DTM everywhere (bare earth) or partly a DSM (tree / building tops) is **unverified**.

### Shadow floor (SDK, small)

`LightOptions.ShadowMinSunAltitude` (degrees, default 15, clamp 2-30) replaces the constant at `MapRenderer.cpp:2512`; `%attribute` in `LightOptions.i` (the facade needs nothing else, `api-facade.md` table), doc line `sky-sun-shadows.md:87` and `08-lighting-sky-fog.md:296-301`, a test of the clamp. Cost of a lower floor: the light box and caster ring grow with `relief / tan(alt)` (`08-lighting-sky-fog.md:404`: 3.7x relief at 15 degrees, 11x at 5 degrees), cascades go coarse: **not measured** (needs a GPU run). Below ~3 degrees the SDK's own share factor already fades shadows out. Useful regardless of this feature: the peak finder's realistic mode shares the light (`terrainStore.ts:249`, `:286`).

## Algorithm and cost model

### Choice

Per route point, march **one ray toward the sun's azimuth** at the sun's altitude, compare terrain angle with sun altitude. Alternatives rejected with numbers:

| Alternative | Cost for 832 points | Verdict |
| --- | --- | --- |
| 72-azimuth horizon per point (what `calculateHorizon` would need) | **measured 464-477 ms**, 47 500 steps / point | 300-600x more than the chosen path |
| Horizon reuse between neighbours | not built | Invalid: the ray origin differs by 100 m, near-field ridges decide; saving would be a few steps out of ~100 |
| Sun-aligned corridor raster sweep (O(cells)) | **estimated** 15 M cells (100 x 60 km at 20 m) x 5 ns = 75 ms per sun direction, but the sun moves 60 degrees over a ride: dozens of sweeps | Rejected |
| Fine reference (g = 0.1 %, finest DEM, no skips) | **measured** ~10 ms, 670-940 steps / point | Used as ground truth for accuracy |

Per-ray rules (all **measured** in the prototype below):

- `tan` comparison, one `atan` at the end; `h0 = ground + eyeHeight`; terrain angle `(z - d^2/(2R_eff) - h0) / d`, `R_eff = R / (1 - 0.13)`. Earth curvature and refraction kept: 0.078 degrees at 20 km, comparable to the disc.
- **Early exit, shaded**: stop when the running maximum exceeds `tan(alt + disc)`.
- **Early exit, lit**: stop when `(zRegionMax - h0) / d <= max(runningMax, tan(alt - disc))`. This is the "max distance as a function of the sun altitude" rule, evaluated at every step instead of fixed (about 21 km for a 10 degree sun over 3 700 m of relief, ~4-5 km for a 40 degree sun).
- **Tile-max skip**: if `(tileMax - h0) / d <= max(runningMax, tan(alt - disc))`, jump to the tile exit along the ray. Free (tile max is cached).
- **LOD by distance**: level from `texel(d) = max(minTexel, d / 300)`. Angular error from posting is about `tan(slope) / 300` = 0.19 degrees at 45 degree slopes, under the 0.27 disc radius.
- **Sun below the floor**: `alt < darkBelow` is DARK, not marched. `alt < 2` flagged LOW_SUN (apparent altitude near the horizon is uncertain by 0.1-0.3 degrees). Sun center apparent -0.27 is sunset on an apparent scale (true-altitude convention -0.833 includes refraction): the caller's convention decides `darkBelow`.

### Prototype (throwaway, `/private/tmp/sunproto/`)

`sunproto.cpp` (C++17) + `extract.py` (reads a window of `/Volumes/dev/massif/cairn/rhone-alpes.tif`, a 121 500 x 85 779 float32 DEM at 1/10800 degree, about 10 m; BigTIFF, deflate + float predictor, decoded by hand). Window 6.3-7.7 E, 45.55-46.45 N (Mont Blanc, 4 778 m max). Models the SDK data path: 9 pyramid levels (2x2 mean), tiled 256 or 512 texel grids, **Terrarium-encoded RGBA with per-texel decode as `ElevationTileGrid::decodeTexel`**, bilinear, thread-local tile memo + mutex/hash on a miss. Sun = NOAA low-accuracy + Bennett refraction (not suncalc). Routes: **synthetic**, straight segments between Les Houches, Chamonix, Martigny, Gd St Bernard, Aosta (83 km), so absolute shares are illustrative.

Sanity check (measured): horizon from Chamonix (1 035 m) toward the Aiguille du Midi (az 165, 5.1 km, DEM max 3 784 m nearby) = **27.8 degrees**; hand calculation with the 3 842 m summit gives 28.7. In December the sun is hidden there from the south-east until it reaches south (11:30 UTC), as expected for the valley.

Results (832 points at 100 m = 83 km; hiking 401 points at 50 m = first 20 km; M5 Pro, 1 thread, in-RAM tiles; time per whole route, 300 repetitions). "Agree" = class agreement (sun >= 0.7 / mixed / shade < 0.3) with the fine reference, 256-texel tiles:

| Config | steps / point | time | agree | mean abs error of fraction |
| --- | --- | --- | --- | --- |
| A: LOD 1/300, growth 0.5 %, first 15 m, tile skip | 68-122 (up to 203 with 512-texel tiles) | 0.4-0.8 ms | 99.6-100 % | 0.000-0.002 |
| B: A without tile skip | 197-273 | 0.9-2.7 ms | 99.6-100 % | same |
| C: B without lit/shade exit | 273-661 | 1.4-6.2 ms | 99.6-100 % | same |
| D: SDK horizon steps (30 m, 0.8 %), skip | 35-63 | 0.3-0.8 ms | 99.2-100 % | up to 0.006 (single points flip fully) |
| **E (proposed default)**: growth 0.3 %, first 10 m, skip | 102-312 | 0.6-1.5 ms | **99.8-100 %** | **<= 0.0011** |
| LOD 1/150 or 1/600 vs 1/300 | within 10 % | same | same | same |
| Reference: g 0.1 %, finest DEM | 667-939 | ~10 ms | - | - |

Per step about 12-13 ns (C: 457 K steps in 5.5-6 ms). Statistics from the proposed config: summer morning ride 18 % shade / 81 % sun; winter 48 % shade; equinox 30 %; hiking winter first 20 km 68 % shade.

**Time-model sensitivity (measured, mean sun fraction vs departure shift)**: summer 0.65 / 0.81 / 0.93 at -60 / 0 / +60 min; equinox 0.64 / 0.70 / 0.92; winter 0.46 / 0.52 / 0.45; at +-30 min the change is 1.6 to 11.5 points. A wrong pace or departure shifts the answer by tens of percent, hence the basis hash and silent recompute below.

**Spacing (measured, mean sun share vs the 12.5 m reference)**: <= 100 m: within 0.1-0.2 points; 200-400 m: up to 0.8 points. Short shade patches are the loss: at 100 m the class transitions found are 51 of 86 (winter ride), 30 of 42 (summer); at 400 m 27 / 86. So stats are robust, the ribbon wants <= 100 m (bike) / 50 m (hike).

### Spacing rule (adapts to speed, not to the sun)

The sun moves 0.25 degrees/min in azimuth on average (up to ~0.6 near a high noon sun, **estimated**), so a sample every 60 s of travel moves it at most 0.6 degrees, less than the shade-edge error. Rule: `step = clamp(pace_m_per_s * 60, 25, cap)`, `cap = 100 m` bike, `50 m` hike, `250 m` motor (the unified design's 100-250). Hiking at 4 km/h = 66 m, so 50 m; a slow 2 km/h climb = 33 m. Departure and per-point ETA enter only through `sunDirections`: each point has its own time `t_i = timeline.at(i)`, so a 6 h ride sweeps the sun 60+ degrees (measured scenarios: azimuth 72 to 135 summer, 133 to 197 winter). Optional second pass: re-query midpoints at class transitions (12.5 m) for crisper edges; adds ~5 % points, not needed for stats.

### Cost for the two reference rides (steps measured per point, scaled)

| | points | steps (A/E, **estimated** scaling) | desktop compute | phone compute |
| --- | --- | --- | --- | --- |
| 100 km @ 100 m | 1 000 | 0.10-0.20 M | **1-2 ms** (scaled from 0.6-1.5 ms / 832) | **estimated 10-40 ms** (x10-25: slower core x4-6, SDK sampler overhead x2) |
| 400 km @ 100 m | 4 000 | 0.4-0.8 M | 4-8 ms | 40-200 ms |
| 20 km hike @ 50 m | 401 | 0.06-0.12 M | 0.5-1 ms | 5-25 ms |
| Departure search, 20 candidates, tiles warm | 20 x 1 000 | - | 25-40 ms | 0.3-1 s |

The previous report's figure (0.1-0.4 s for 2 000 points at 335 steps and 0.1-0.5 us) was ~100x too pessimistic: measured per step is 12 ns and steps per point are 70-200 with exits and skips.

### Where the time really goes: DEM tiles

- **Tile working set (measured, 512-texel tiles of a 10 m DEM, 83 km route)**: A: 33-41 tiles in total (31-35 near field + 2-6 coarse); C (what a plan pass without skip would request): 57-74 in total (e.g. 41 + 18 + 10 + 5 across the four levels). **Estimated** 100 km: 45-90 tiles; 400 km: 180-360 (chunked, at most ~90 resident). The SDK 192-grid floor (`:38`, `:466-474`) holds a 100 km route; 400 km needs the chunking (and `cacheMB` fixed at ~96 MB = ~90 grids of 1 MB).
- **Decode (measured, desktop, PIL)**: 512 x 512 Terrarium of this DEM, PNG 323-437 KB / 2.9-3.4 ms; lossless WebP 215-306 KB / 2.8-3.2 ms. Phone **estimated** 15-30 ms per tile plus the grid build (min/max pass and node field, `ElevationTileGrid.cpp:21-54`, unmeasured). 45-90 tiles on 3 workers: roughly 0.5-1.5 s **estimated** offline.
- **Online**: 10-40 MB for 100 km at the measured tile sizes (real Mapterhorn encoding unverified); network-bound, tens of seconds on mobile data. Usually most of it is already in the HTTP cache from the hillshade / 3D view.
- **Offline**: offline DEM tiles come from the package (disk): the numbers above minus the network. If a tile is not in a package the call degrades and flags (below).

### Partial coverage offline

The data source decides: package tile present = loaded, absent = load fails fast, failure remembered 30 s (`:39`). The result flags per point (`NO_DEM`, `COARSE_DEM`) and in the header (`tilesMissing`, zoom range). The app computes `coverage = share of points with status 0`, stores it in provenance `quality: 'partial'` and shows the chip "Terrain 85 % · tap to download" (same area download path as offline maps); the ribbon draws a hatched "no DEM" gap, never a guess; stats say "of the part we could compute". Re-run when the package arrives; only flagged points are re-queried.

## Persistence and data model (fits `00-unified-design.md`)

`RouteAnalysis.layers.sun: Layer<SunData>` stored with the item (the unified design owns the column; `Item.ts:199-200` pattern with lazily parsed JSON, `:452-458`, `migrations` object `:213`).

```ts
interface SunData {
    step: number;                     // metres between samples (the spacing rule above)
    lit?: number[];                   // 0..100 clear-sky sun fraction per sample, terrain only (SDK sunFraction x 100); absent = astronomy-only layer
    flags?: { i: number; f: number }[]; // sparse: status bits (NO_DEM 2, COARSE_DEM 1, LOW_SUN 8, TRUNCATED 16); empty = all ok
    params: { eyeHeight: number; disc: number; maxDistance: number; lodRatio: number; algo: 1 };
    basis: { departureHash: string; paceHash: string };   // existing field of the unified SunData
    coverage: number;                 // 0..1 share of samples with status 0
}
// Provenance (unified): provider 'massif-sdk/sunExposure@1', dataVersion = demKey, quality 'ok' | 'partial', computedAt, inputsHash
```

- **Size**: 1 000 ints at 100 m is ~4 KB JSON (estimate from the unified doc); 400 km ~16 KB; flags usually empty. Per-sample sun azimuth / altitude are **not** stored (suncalc over the timeline, microseconds).
- **`inputsHash`** = `geometryKey` + timeline hash (departure instant, pace model and multiplier, stops) + `params` + `demKey`. `demKey` = DEM source id + max zoom + offline package version/date (how the app learns the package date is **unverified**, `00-unified-design.md` has the same open point).
- **Invalidation**: departure or pace change = `inputs-changed` chip "Recomputing sun…" and an automatic recompute. Compute is ms and, with tiles still cached (or on disk), the whole call is tens of ms on a phone, so it can run **live while the departure slider moves** (throttled to ~10 Hz), better than the unified design's "reuse previous lit, mark preview, recompute 300 ms after release". Tile loading is the only slow case (first run, new area). DEM update = chip "DEM updated · recompute".
- **Time zone**: store `tz` (IANA, from the route start via `packageService.getTimezone`, `PackageService.ts:527-537`, backed by `timezone.mbtiles`) in `Departure.tz` (unified); display with the offset **at the departure instant**. `AstronomyView.svelte:61-63` reads the offset at `Date.now()` / `new Date()`, which is wrong for a departure in another DST period; do not copy that. Departure is an absolute instant.
- **Clouds** are a separate layer: `weather` stores per-sample `dni` and `cloud` (`WeatherData.v`, unified 2.1); for this feature the weather job also needs `direct_radiation` or `sunshine_duration` per hour (names from the request; not verified against the Open-Meteo docs here). Nothing about clouds is stored in `SunData`. UV: the forecast `uv_index` is already cloud- and elevation-aware: show its peak, never recompute it.

### Blending clouds, stats

`clearness_i` in [0,1] at (distance_i, t_i), interpolated from the hourly series, best source first:
1. `direct_normal_irradiance / DNI_clear(alt_i, z_i)` with a simple clear-sky model (Meinel: `1353 x ((1 - 0.14 h_km) x 0.7^(AM^0.678) + 0.14 h_km)`, `AM = 1 / sin(alt)`), clamped; skipped when alt < 5 (model unreliable);
2. else `sunshine_duration / 3600` (seconds of DNI >= 120 W/m2 in the hour: a probability of sun);
3. else `1 - cloud_cover / 100` (**heuristic**, label it; raw cover is a poor proxy).
`effective_i = lit_i x clearness_i`. Both clear-sky (always available) and "with forecast" stats are shown; clear-sky is the default and the fallback.

Derived on read from `lit`, the timeline and the weather layer (no storage), with `dt_i` = half the time to each neighbour:
- `sunMs = sum dt_i x lit_i x clear_i` (daylight samples), `overcastMs = sum dt_i x lit_i x (1 - clear_i)`, `shadeMs = sum dt_i x (1 - lit_i)`, `twilightMs`, `nightMs` from the sun altitude (`> -0.27` day, `-0.27..-6` twilight, `< -6` night; cyclists need lights from the first, hikers from civil dusk).
- Per section = sums over an index range (prefix sums, O(1)): waypoint legs, grade sections, or the user's range on the profile.
- Class for ribbon / map: dark if night; overcast if `clear < 0.35 and lit >= 0.3`; sun if `lit >= 0.7`; shade if `lit < 0.3`; else mixed. Different thresholds per activity (decision 05.8): hike eye height 1.5, step 50, headlamp from civil twilight, glare below 12 degrees within +-35 degrees of heading; bike eye height 1.2, step 100, lights from sunset, glare below 15 degrees within +-25 degrees (heading from `getRhumbLineBearing`, `geolib.ts:477`). All settings, none hard-coded in the SDK.
- Staleness (see unified 3.1): sun astronomy and the sun terrain part are never "old": the terrain layer is a deterministic function of (geometry, timeline instants, DEM). It is only **superseded** (`inputs-changed`, auto-recompute). Only the cloud part ages with the weather layer ("Clouds as of 14:05 · 3 h", outlined chip when stale). The 3D shadow strength uses the same cloud layer and shows the same chip.

## Route sun mode (3D / map)

An explicit mode, entered from the Sun section ("Preview in 3D") or the map; exit with a persistent chip `Route sun · preview ×` and the 3D settings "Leave mode" button (mockup).

- **Time source**: `RouteTimeline` (unified 2.2): the scrubber is a distance along the route; `t = timeline.at(distance)` (departure + ETA). The sun is computed at the **marker position and time** with suncalc 2 (`sunPositionAt`, `peakFinderSun.ts:47`; move it to a pure `app/utils/sun.ts`, do not import the peak finder module). Segment **Ride** (scrub the ride) / **Day** (fixed point, scrub 24 h with sunrise and sunset ticks; same pipeline, optional v1.1).
- **What it drives**: `sunAzimuth`, `sunAltitude`, `shadowStrength`, forces `terrainLightingEnabled` and shadows on, optional `dayCycleLightsEnabled` ("light the map by the hour", off by default: it dims the whole map at dusk). Date and time label in the **route** zone. Camera: "Follow" keeps the marker centred at the current tilt; no automatic camera moves otherwise. "Play" advances 10 min of ride per second at 15 Hz and stops at the end or in the background.
- **Not fighting the user's sun settings**: the mode never writes `terrainSunAzimuth`, `terrainSunAltitude`, `terrainLighting`, `terrainShadows`, `terrainShadowStrength` (`terrainStore.ts:82-101`). A transient `routeSunLight` store (null when off) is read by `applyLight` (`terrain3d.ts:331-348`): `light = routeSunLight ?? stores`, and subscribed in the same loop (`:603`). Leaving the mode = set to null: the old look returns exactly, **there is nothing to restore**. Never persisted, so an app restart is out of the mode. While active, `terrain3dSettingRows.ts:133-198` marks sun / lighting / shadow rows locked with "Controlled by Route sun mode · Leave" (new `locked` argument next to `show`). Auto-exit on route deselect, on start of navigation, on item deletion. In 2D the mode still lights building shadows (`terrain-2d-3d-states.md` "Shadows follow the light"); relief shadows need 3D, so the entry offers `toggle3D`.
- **Shadow strength from clouds**: `strength = terrainShadowStrength x clearness(t, pos)` (mockup shows 100 / 45 / 0 %); smoothed over ~300 ms while scrubbing; below 0.08 set 0, which makes the SDK skip the shadow pass entirely (`MapRenderer.cpp:2533`). Physically shadow contrast is the direct share of the light, which is why DNI over clear-sky DNI is the right input. The SDK already multiplies by the sun's share at dusk (do not apply it twice).
- **Low sun**: with the SDK property, a "Low sun shadows" choice (15 degrees standard, 8, 4 = slower). Until it exists, the chip "Sun 9°: shadows drawn at 15° floor" tells the truth, and the route line coloured by the **computed** state stays correct either way (colour mode `rt: 'sun'`, unified 5). The GPU image is a preview; the data is the SDK result.
- **Perf / battery**: the shadow map is cached for a still camera, so idle costs nothing (`sky-sun-shadows.md:87-89`); a sun change re-renders the cascades. Throttle to 15 Hz while dragging, quantise to 0.1 degree, apply exactly on release. 3D itself costs +30-37 % frame time (`terrain-2d-3d-states.md` state table); shadows are on by default only on the Mac (`terrainStore.ts:95`), so the mode is the opt-in and shows a cost chip on first use. Cascades 1-2, map 1024-2048 while in the mode (existing settings, `terrain3d.ts:341-350`). Play auto-stops after a few minutes. **Not measured** on a device.
- **E-ink**: no live shadows; sun direction arrow, ribbon, stats and scrubber work; shadows applied on release only (`isEInk`, `terrain3d.ts:9`).
- **Gestures tutorial** (`.claude/CLAUDE.md`): scrubber, Ride/Day, Play are new gestures: a `tutorialPages.ts` zone and `gesture_<id>_*` / `tutorial_page_<id>` strings in `en.json` + `fr.json` in the same change.

## Tier 0 and the cheap ribbon (no SDK)

- **Inputs**: timeline + geometry + tz. Per sample (100-250 m, suncalc 2, µs each): sun azimuth, apparent altitude, heading, `sunrise / sunset / dusk` from `getTimes` (null / always-up at high latitude handled, as the Astronomy fix `b5bcf4cb`).
- **Stats** (Sun section, rows in the mockup): departure and arrival in route time; **sunset at km X vs ETA**, civil dusk; time in twilight and in the dark ("53 min after sunset" style); **glare km** (sun below 12-15 degrees and within the heading window, terrain-unaware so labelled "possible"); sun side % left / right; the section shows "terrain not counted" until the SDK layer exists.
- **Ribbon** under the profile (`ElevationChart.svelte`, grades are set at `:582-585`; add a second pass or a small aligned canvas, plot inset not checked: **unverified**): run-length rectangles from the per-sample state (a 1 000-sample route is ~20-60 rectangles, < 0.1 ms), red ticks above for glare, dashed sunset line. States: day / low sun (< 10 degrees, lighter) / twilight / night. E-ink: open, sparse hatch, horizontal lines, solid.
- With the SDK layer the same ribbon gains shade and mixed rows, with clouds an `effective` row; three rows max visible (unified decision 9).

## Data limits (unchanged)

Terrain only. Forests, buildings, walls, tunnels, bridges are not in the DEM; road cuts and cliffs below the posting are invisible; tunnel = "lit". Optimistic for wooded routes: say "Terrain only. Forests and buildings are not counted" in the section. Tier 2a (landcover `wood`) stays optional. The 10 m DEM here is representative; a 1-2 m lidar DEM (Swiss areas of Mapterhorn, unverified) would see road cuts if `minTexel` allows, at a higher tile cost.

## Integration points (updated, file:line)

- Timeline: `app/utils/routeTimeline.ts` pure TS (unified 2.2; currently only totals exist, `Item.ts:109-112`).
- Sun math: `app/utils/sun.ts` (new, pure) wrapping suncalc `getPosition` as `peakFinderSun.ts:47` does.
- Positions: `packageService.getRouteItemPoses(item)` (`PackageService.ts:748`); resample by the spacing rule.
- Service: `app/services/SunExposureService.ts` (chunks, progress, `callAsync` on `packageService.hillshadeLayer`, `CustomLayersModule.ts:1096`), implements the unified `SunTerrainProvider` (`exposure(samples, opts) -> lit[]`: add `status` and `coverage` to its return). No DEM layer (web-only users): `absent`, reason `no-dem`; the profile already falls back to Valhalla elevations (`PackageService.ts:778`).
- Section UI: separate Sun section in the route sheet / page (not a tile, decision 05.2), profile ribbon, per-section table, scrubber readout through the existing highlight event.
- Terrain light: `terrain3d.ts:331-348`, `:603`; rows `terrain3dSettingRows.ts:133-198`; stores `terrainStore.ts:82-101`.
- Map colour: sun mode of the route line is part of the unified colour modes, independent of the 3D light.

## Risks

1. **Optimistic sun in forests / cities** (data limit). Honest label.
2. **Tile loading dominates** (decode and, online, megabytes). Chunking, `cacheMB`, partial flags; measure on a device before promising times.
3. **Time model**: a 30 min error shifts the sun share by up to 12 points (measured). Show the assumption, grade-aware pace later, live re-anchor in navigation.
4. **DEM accuracy and LOD far field**: validated on one real DEM and synthetic routes only; no comparison with real-world shade observations; far-field coarse tiles are averaged (peaks smoothed) so distant ridges are slightly low. Add a slack option if field tests show it.
5. **Low sun (< 2 degrees)**: refraction and the 30 km cap; flagged.
6. **GPU vs computed mismatch** (15 degree floor, resolution, buildings): keep the "preview" wording; the ribbon is the data.
7. **Mode / settings fight**: solved by the transient store; test the exit paths.
8. **Single-target queueing** of `callAsync` delays other calls on the hillshade layer: short chunks.
9. **`ALLOW_LOAD` ancestor behaviour** (read, not run) may also affect the existing profile precision: worth a separate test.
10. **Header real estate**: no tile (decision 05.2), so none.
11. **Shared submodule rule**: keep new app code in `app/`, not `tools/app`.

## Phased plan (revised)

- **Phase 0, Tier 0 (S, 2-4 d)**: `sun.ts`, timeline use, Sun section with sunset / dusk / glare / side, sky ribbon, tz from `getTimezone`. No SDK.
- **Phase 1, SDK + terrain layer (M app 4-6 d + SDK M 4-6 d)**: SDK: `SunExposure.h`, `ElevationManager::computeSunExposure` (plan / load / compute), options + result, facade thunk and `!method` on layer and terrain, tests, doc, bindings regen, demo. App: `SunExposureService` (chunks, progress), `SunData` persistence + flags, ribbon shade row, stats, partial-coverage chip, live recompute on departure change.
- **Phase 2, Route sun mode (M 4-6 d + SDK S 1-2 d)**: `routeSunLight` store, scrubber, Ride mode, light override and locked rows, strength from clearness, tutorial entries; SDK `ShadowMinSunAltitude`; Day mode and Play as add-ons.
- **Phase 3, clouds (S-M)**: after the weather layer: clearness, overcast row, effective stats, cloud chip, shadow strength hook (Phase 2 already reads `clearness`, constant 1 until then).
- **Phase 4 (S)**: best departure search (candidate departures x one call each, 25 ms to 1 s **estimated**), then optional Tier 2a.

## Remaining open questions

1. **Object API only on `HillshadeRasterTileLayer`, or also a forwarder on `TerrainOptions`?** (D1 proposes both; the layer alone is enough for the route feature, the terrain one helps the peak finder.)
2. **Dedicated short-lived manager** (own fixed cache, freed after the job) instead of the layer's shared one? Better memory story on phones; one more class and a facade kind. Needs a decision after a device memory measurement.
3. **Sun source**: confirm suncalc 2 as the only sun (D2); the SDK would then never compute astronomy.
4. **Floor default** for Route sun mode: 15 (fast) or 8 (truer, slower)? Needs a device frame-time measurement.
5. **Which weather variable is the cloud input** when the weather job lands (`direct_normal_irradiance`, `sunshine_duration`, `cloud_cover`), and who owns the clear-sky model (`clearSky.ts`)? Unverified names.
6. **How the app learns the DEM package version** for `demKey`.
7. **Eye height and activity thresholds** (hike 1.5 / bike 1.2, glare windows, headlamp at civil dusk): defaults proposed, confirm.
8. **Day mode** (fixed place, scrub 24 h) in v1 or later?
9. **Is a physical-device timing pass wanted before the SDK work**: one run of the prototype logic through the real `ElevationManager` on an Android device (tile decode, memory, `callAsync` chunk latency)?
