# Weather along the route, with time windows

Research and plan only. No app code was changed. Companion mockups: [`03-weather-along-route.html`](03-weather-along-route.html).
Repo state read: branch `feat/suncalc-2`, HEAD `b5bcf4cb`. Web facts are dated 2026-11-01; anything not read on a primary page is marked **(unverified)**.

## Verdict

**Feasible, medium effort, no new native code.** Everything the feature needs already exists in the app except a weather source and a time model:

- the route polyline, its elevation profile (`item.profile.data[].d/.a`) and Valhalla maneuver times are stored on the item;
- a departure date-time picker exists (transit mode);
- the route sheet is a stack of cards, so a weather card slots in;
- `bearingBetween` / `computeDistanceBetween` exist for wind-vs-heading maths;
- the HTTP layer, an offline flag and a file-backed LRU cache pattern exist.

**Recommended provider: Open-Meteo** (no key, one request for ~20 locations, hourly, per-point `elevation`, and it re-serves AROME, ICON-D2 and MeteoSwiss ICON-CH1 at 1-2.5 km). Hide it behind a `WeatherProvider` interface.

The one real blocker is licence, not engineering: Open-Meteo's free API is **non-commercial only**, and its terms count apps with subscriptions or ads as commercial. Alpi Maps is MIT and donation funded, but `@akylas/nativescript-inapp-purchase` is in `package.json` (`package.json:53`). The owner must confirm which side the store builds fall on (see Open questions).

**Smallest valuable slice:** an on-demand "Weather" action on a route that opens one card: departure pill, a -3h..+3h shift slider, three stat tiles, a per-sample table showing "early / on time / late", and a "leave 45 min earlier" suggestion. No map or chart change. Effort M.

## Existing code

### Weather today
- Weather is **only an external-app launcher for single places**. Nothing fetches a forecast.
- `app/mapModules/itemActions.ts:122-132` `weatherUrl()` returns `null` unless the geometry is a `Point`.
- `itemActions.ts:134-150` `openItemWeather`: Android opens `weather://query?lat&lon&name` (com.akylas.weather); iOS opens `https://weather.apple.com/?lat&lng`.
- `itemActions.ts:152-163` `openItemWeatherAlternate`: Android `ossweather://`.
- `app/services/NetworkService.ts:411,420` `canCheckWeather` is set from `appavailability.available(...)` at start. It means "a weather app is installed", not "we can fetch weather".
- `app/components/bottomsheet/BottomSheetInner.svelte:317` (handlers) and `:344` (`when: networkService.canCheckWeather && !itemIsRoute`): the action is explicitly hidden for routes. `itemActions.ts:279-281` (search results actions) is the same, and it returns early for routes at `:272-274`.
- Gesture tutorial has a zone `weather` (`app/components/tutorial/tutorialPages.ts:150`) plus strings `gesture_weather_*` in `en.json:1275` and `fr.json:1037`. Per the repo rule, a new gesture needs the tutorial entry and the `en` and `fr` strings in the same change.
- mdi weather glyphs are already used (`mdi-weather-partly-cloudy`, `mdi-weather-sunset-*`) through `$fonts.mdi`, so rain, snow, lightning and fog glyphs need no new font.

### Route data available for ETA and samples
- `app/models/Item.ts:143-151` `Route { totalTime, totalDistance, waypoints, steps }`.
- `Item.ts:49-58` `RouteInstruction { index (polyline point index), dist, time, az, ... }`, mapped from Valhalla in `app/utils/routing.ts:22-41` (`time: instruction.time`). Whether `time` is per-maneuver seconds or cumulative is not documented in the repo. **Verify before use** (Valhalla maneuvers carry per-maneuver time, so likely per-maneuver).
- `Item.ts:69-79` `RouteProfile.data[] { d (m from start), a (altitude), dp, dm }`, `ascents[]` with `highestPointIndex`.
- The only ETA maths today is a **constant average speed**: `app/utils/navigation.ts:669-671` (`remainingTime = totalTime * remainingDistance / totalDistance`), also in `app/services/navigation/NavigationRoute.ts:103-104`. The comment at `navigation.ts:668` says an imported GPX has **no timings**, so ETA must be modelled for GPX (no `totalTime`).
- Navigation ETA is `Date.now() + remainingTime*1000` (`app/components/navigation/NavigationView.svelte:56-57`).
- Profile speeds live as component-local functions in `DirectionsPanel.svelte:701-720` (`walkingSpeed()` 4 / 12 km/h running; `getBicycleSpeed()` enduro 10, mountain 12, normal 15, gravel 18, road 20) with `bicycle_type` / `pedestrian_type` read from `ApplicationSettings` (`:134-135`). They must be extracted to a shared util to reuse them.
- Departure time: `DirectionsPanel.svelte:132` `departureTime: Date = null` ("null: leave now"), `:896-905` `pickDepartureTime()` using `pickDateTime` from `@nativescript-community/ui-datetimepicker`, UI at `:1588-1594` (a `Pill`, label `dayjs(...).format('ddd D MMM HH:mm')` or `lc('now')`, long press clears). It is **only used for transit**. Valhalla routes ignore it, so a weather departure time has no existing home. A new session-level store is needed.
- `RouteSimulator.ts` only drives a fake GPS along the route at a chosen speed (`SIMULATED_SPEEDS`). It is a dev tool and useless for planning ETAs.

### UI hosts
- Route sheet: `BottomSheetInner.svelte:1124` is a grid with rows `header, actions, profile, stats, osm`.
  - `:1156` `<RouteStatTiles>` (header, `ROUTE_TILES_HEIGHT = 48`, `:91-93`, `headerHeight()` at `:137`).
  - `:1240-1252` `<ElevationChart infoStrip>`.
  - `:1255` `<RouteStatsView>`.
  - A weather card would be a new row between profile and stats.
- On-demand pattern: `profile` and `stats` are actions on a route (`:338-339`) that compute on tap. `weather` for routes should do the same (also saves requests and respects privacy).
- `app/components/bottomsheet/RouteStatTiles.svelte:49-66` `tilesFor()` builds distance, time, ascent, descent from `route`/`profile`; each tile shows a second accent line (flag) from `user_onroute_data`.
- `app/components/chart/ElevationChart.svelte`:
  - `:431` `updateChartData`; `:482` `leftAxis.customRenderer`; `:508` `chartView.customRenderer` (only `drawHighlight`).
  - Layout is a grid `rows={infoStrip ? '46,*,auto' : '*'}` (`:700`), with the `auto` row hosting `GradeLegend` (`:744`). A ribbon can be one more row.
  - `on:zoom` and `on:pan` are already wired to `onChartPanOrZoom` (`:169-190`), which reads `chart.xAxisRenderer.getCurrentMinMax()`. The ribbon can reuse that to stay aligned.
  - The chart's `setExtraOffsets` (`:461`) and `minOffset = 0` define the content rect the ribbon must match.
- Map: `app/mapModules/ItemsModule.ts:548-609` `onItemSelected` builds route extras into `getLocalVectorDataSource().setGeoJSON(2, ...)` from `route.waypoints` (class `waypoint`), `route.steps` (class `step`, km shields) and ascent summits. Weather markers are one more feature class here.
- Map style is in zips (`app/assets/styles/inner.zip` → `voyager.xml`, `eink.xml`). Rules key on `[{'class'}]='step'` and `='waypoint'`; the waypoint glyph comes from `[{'style.icon'}] ?? [{'icon'}]` with `face-name` `[{'style.mapFontFamily'}] ?? 'osm'` and fill `[{'color'}]`. A new `weather` class needs rules in both xml files (the zip is a binary diff).
- Fixed-interval "steps" exist: `DirectionsPanel.svelte:64-95` `computeStepsOnePass(coords, stepKm, totalKm)` (gated by `route_compute_steps`, `:880`). This is the closest existing "samples along the route" code, but it is km-based, only runs at route creation, and is not stored for saved or GPX routes. Do not reuse; write a time-based sampler.

### Network and cache plumbing
- `networkService.request()` (`NetworkService.ts:459-520`) handles JSON, errors, `queryParams`. `networkService.connected` (`:370`) already folds in the user's forced-offline switch (`forceOffline`, `:369`).
- `https.setCache` 40 MB disk and 10 MB memory is configured at start (`NetworkService.ts:424`); helper `getCacheControl(maxAge, stale)` (`:26`).
- Precedent for a persisted LRU: `app/helpers/osmDetails.ts:100-175` (Map saved as one JSON file in `knownFolders.documents()`, debounced write).
- Precedent for polite third-party use: `TransitousService.ts:6-9` sets a `User-Agent` of `${__APP_ID__}/${__APP_VERSION__} (repo url)`.

## Providers comparison

All figures verified on the cited pages unless marked.

| | Open-Meteo | MET Norway locationforecast | Meteoblue | Windy Point Forecast | Apple WeatherKit |
|---|---|---|---|---|---|
| Key | none (free); `apikey` only on paid `customer-api` | none, but unique User-Agent required (else 403) | key required | key required, free tier is shuffled test data | developer key + JWT, needs a backend to keep the secret |
| Locations per request | many, comma-separated (up to 1000 per a third-party summary of GitHub #438, **unverified**); each counts as a call | one (`lat`/`lon` single) | one (multi-location = multiple calls) | one, rounded to 2 decimals | one |
| Hourly vars | temp, apparent temp, precip, precip probability, weather code, cloud cover, wind 10 m, direction, gusts, UV, freezing level, CAPE, snowfall | temp, wind, cloud, precip, thunder prob. (**unverified**: the docs page I fetched does not list variables) | temp, wind, precip, clouds in packages (basic-1h, wind-1h) | temp, wind, gust, precip, CAPE, clouds, cloud base (no UV) | temp, precip, wind, UV (REST variable names not read) |
| Resolution / horizon | 1h (15 min in central Europe/N. America). Best-match picks the finest model; up to 16 days (`forecast_days` 0-16) | 9 days, resolution not stated on the page I fetched | 7 days, 1h (basic-1h) | model dependent (AROME, ICON, GFS ...); ECMWF excluded | 10 days hourly |
| Spatial resolution | AROME France ~1.5-2.5 km (2 days), ICON-D2 ~2 km (2 days, 15 min), MeteoSwiss ICON-CH1 ~1 km (33 h) / CH2 ~2 km (120 h), ICON-EU ~7 km (5 days), ARPEGE ~11 km (4 days) | ~2.5 km Nordic blend, coarser elsewhere (**unverified**) | NMM 4 km class, strong in mountains (**unverified**) | as the model | ~1 km class in some regions (**unverified**) |
| Elevation input | `elevation=` per location, downscaling (default 90 m DEM) | `altitude=` whole metres | per request | no | no |
| Cost | free < 10 000 calls/day, 5 000/h, 600/min per IP, non-commercial; paid Standard 1 M calls/month (price not retrieved) | free, CC BY 4.0, 20 req/s per application | free year 10 M credits (page conflicts with an older "5 000 calls, non-commercial" page); then prepaid/commercial, premium €2 400/yr | €990/yr Professional; free is dev-only | 500 000 calls/month free with Apple Developer Program, then US$49.99/month per 1 M |
| Licence / ToS for a store app | CC BY 4.0 data, attribution "Weather data by Open-Meteo.com"; apps with ads or subscriptions need a paid plan | CC BY 4.0, attribute; the ToS says **mobile apps should not call directly, use a caching proxy**; truncate to 4 decimals | key in the binary is extractable; trial terms differ | production needs the paid plan; "added value" rule for weather apps (old forum post) | Apple trademark and legal link mandatory; alerts unmodifiable |
| Offline | none | none | none | none | none |

Sources: <https://open-meteo.com/en/terms>, <https://open-meteo.com/en/pricing>, <https://open-meteo.com/en/docs>, <https://open-meteo.com/en/docs/meteofrance-api>, <https://open-meteo.com/en/docs/dwd-api>, <https://open-meteo.com/en/docs/meteoswiss-api> (via search snippet), <https://github.com/open-meteo/open-meteo/issues/438>, <https://api.met.no/doc/TermsOfService>, <https://api.met.no/weatherapi/locationforecast/2.0/documentation>, <https://business.meteoblue.com/products/weather-apis/free-weather-api>, <https://business.meteoblue.com/pricing>, <https://api.windy.com/point-forecast/docs>, <https://api.windy.com/point-forecast/pricing>, <https://developer.apple.com/weatherkit/get-started/>.

Not evaluated in depth (no primary page read): DWD Bright Sky (Germany only, **unverified**) and the Météo-France AROME portal (account and key needed, **unverified**). Open-Meteo already re-serves AROME, ICON-D2 and ICON-CH1/CH2, so going direct to the national services buys little.

### Why Open-Meteo
1. Only option that is one anonymous GET for a whole route.
2. Per-location `elevation` fixes the biggest mountain error (temperature and freezing level at the true altitude, not the 2 km cell mean).
3. Hourly values for exactly the variables a ride needs, including `freezing_level_height` and gusts.
4. No secret to ship (the repo already ships an `API_KEYS.json`, which I did not read).
5. Models: `best_match` (default) already prefers AROME / ICON-D2 / CH1 where they cover. The model chosen per point is not echoed in the response I read (**unverified**), so the UI should say "Open-Meteo, best available model".

Open-Meteo weak points: the commercial clause, no SLA ("no uptime guarantee"), and a free limit shared per IP (carrier NAT can share an IP; 429s must be handled).
Fallback: behind the interface, MET Norway through a tiny caching proxy, or paid Open-Meteo `customer-api`, with no UI change.

### Variables to request (10 hourly = weight 1.0)
`temperature_2m, precipitation, precipitation_probability, weather_code, cloud_cover, wind_speed_10m, wind_direction_10m, wind_gusts_10m, freezing_level_height, uv_index`.

- Pricing page says more than 10 variables or more than 2 weeks of data counts as several calls, fractionally. Staying at 10 keeps weight 1 (exact formula **unverified**).
- Thunder: derive from `weather_code` 95-99 first; add `cape` as an optional 11th later.
- Apparent temperature: compute client-side (wind chill) to stay at 10.
- Params: `latitude=..,..&longitude=..,..&elevation=..,..&timezone=UTC&timeformat=unixtime&wind_speed_unit=kmh&start_date=&end_date=`. UTC avoids the documented "DST changes are ignored" caveat.
- Precipitation is a **preceding-hour sum** (docs): the value stamped H covers (H-1, H]. Align ETA buckets accordingly.

## Sampling & time-window model

### Time model (ETA per polyline point)
`etaSeconds(pointIndex)` = seconds since departure, in this order:
1. **Valhalla route** (`route.totalTime > 0` and `instructions` present): build cumulative time at each `instructions[i].index` from `instruction.time` (once verified as per-maneuver), linearly interpolate by distance between maneuver indices, and rescale so the end equals `route.totalTime`.
2. **Valhalla route without usable maneuver times**: `totalTime * d / totalDistance` (the app's current convention).
3. **GPX / no timings**: speed by profile and slope. Walking: Tobler `v = 6 e^(-3.5 |slope + 0.05|)` km/h scaled so the flat speed equals the user setting. Bicycle: flat speed from the extracted `getBicycleSpeed()`, with a simple climb and descent penalty from `profile.data` (**sketch**, tune on real tracks).
4. **While navigating**: `now + navigationProgress.remainingTime` for points ahead (`NavigationView.svelte:57`); samples behind are dropped.

Add a user "pace" multiplier (0.8-1.3, default 1) and optional "stops" (minutes per hour) as part of the departure control, because the biggest ETA error for hiking is rest time, not speed.

ETA depends on wind (cycling), which depends on ETA. Do **one** pass in v1 (ignore the feedback), mention it in the UI as "estimate".

### Spatial sampling
```
step = clamp(speedKmh * 0.5h, 3 km, 15 km)      // ~30 min of travel
samples = points at cumulative distance 0, step, 2*step ... end
        + relief samples: summits/passes/valley floors (profile.ascents[].highestPointIndex and local minima)
          whenever |altitude - altitude of previous sample| >= 400 m
        capped at 40 samples (increase step if exceeded)
```
Reasoning:
- Hi-res grids are 1.5-2.5 km, but weather systems are 10-30 km. Below 3 km you re-read the same cell. Above 15 km a front can fall between samples.
- Altitude matters more than distance in the Alps (temperature -6.5 °C/km, snow line, freezing level), hence the relief samples and the per-sample `elevation`. The altitude comes from `item.profile.data[].a`, or `packageService.getElevations()` (`PackageService.ts:571`) when the profile is missing.
- Merge samples closer than 2 km and within 150 m altitude of each other.
- Always include start and finish.

### Time window per sample
- Request covers the departure date through the last ETA date, `start_date` to `end_date`, one request per calendar day of the ride if the ride spans midnight. Rows per location are 24 per day.
- Client holds hourly series for window `ETA ± 3 h`. "Early / late" columns are **t = ETA - 1 h, ETA, ETA + 1 h**. Chips could also show -2/+2.
- The shift slider (-3 h .. +3 h, 15 min snap) moves the whole departure; each sample's ETA shifts by the same amount and values are re-read **locally**. No new request.
- Interpolation: temperature, wind, direction (circular), cloud, freezing level linear. Precipitation as per-hour buckets, time-weighted. Weather code: nearest hour.
- Horizon: show detail up to 3 days (hi-res models), a "low confidence" badge up to 7 days, refuse beyond (the API allows 16 days but skill is poor).

### Wind relative to travel direction
Per sample, route bearing from the points about +/-300 m along the path (not the neighbouring vertices, which can zig-zag): `theta = bearingBetween(pBefore, pAfter)` (`app/utils/geo.ts:345`, degrees clockwise from north).

Open-Meteo `wind_direction_10m` is the direction the wind comes **from**, so with `delta = windFrom - theta` (normalised to -180..180):
```
head  =  W * cos(delta)        // >0 headwind, <0 tailwind (km/h, ground-relative)
cross =  W * sin(delta)        // >0 wind from the right
```
- Classification (cycling): head > 10 km/h headwind, head < -10 tailwind, |cross| > 20 cross wind, gust > 50 flagged.
- Apparent wind for cold and comfort is `W` plus the rider's speed in the facing direction. Not needed in v1.
- "Headwind share" tile = share of distance where head > 10 km/h.
- Arrow glyph: a mdi arrow rotated to `windFrom + 180` (blows toward). Label always has the number, so it is readable on e-ink.
- 10 m model wind understates ridge wind; label "model wind at 10 m".

### "Better departure time"
Evaluate offsets `o` from -3 h to +3 h every 15 min (skip offsets before `now`), all local maths:
```
cost(o) = sum_over_segments( dt * ( 3*rainClass + 5*thunder + headwind/10 + coldPenalty + heatPenalty + 2*(gust>50) ) )
```
- `rainClass` from precipitation mm/h: 0 = <0.1, 1 = <1, 2 = <4, 3 = more.
- `coldPenalty`: temp < 2 °C (or precipitation falling as snow when temp is near the freezing level).
- Weights depend on the profile: cycling raises headwind, hiking raises thunder and cold exposure above the freezing level.
- Suggest only when `best` improves `cost(0)` by >= 25 % and at least one rain class. Otherwise say "departure time doesn't matter".
- A cheap, honest label: "Leave 45 min earlier: 0.4 mm instead of 3.1 mm of rain on route". Never a promise.

## Integration points with file:line refs

| Slice | Where | Change |
|---|---|---|
| New util `app/utils/routeTiming.ts` | new | `etaSeconds`, sampler, no UI imports (pure and testable later, per repo guidance). Reads `Item.ts:49-79`, `geo.ts:341-352` |
| Speeds | `DirectionsPanel.svelte:701-720` | extract `walkingSpeed` / `getBicycleSpeed` to a util; the panel imports them back. Touching the panel = drive-by risk, keep minimal |
| New `app/services/WeatherService.ts` | new, modelled on `TransitousService.ts:1-10` | `fetchRouteWeather(samples, dates)`; User-Agent; uses `networkService.request` (`NetworkService.ts:459`); returns hourly series |
| Cache | new `app/helpers/weatherCache.ts` modelled on `osmDetails.ts:100-175` | key = hash(rounded coords + dates + variable set); TTL below |
| Departure store | new in `app/stores/` | `weatherDeparture` writable, session scoped; the picker is `pickDateTime` as in `DirectionsPanel.svelte:896-905` |
| Action | `BottomSheetInner.svelte:317,344` | add `weatherRoute` action `when: itemIsRoute && !offline`, after `stats`; ordering in `itemActionOrder.ts` (not read) |
| Card | `BottomSheetInner.svelte:1124` (rows), near `:1255` | new `RouteWeatherCard.svelte` row + height const next to `:89-93` |
| Header tiles | `RouteStatTiles.svelte:49-66` | optional 5th/6th tiles only while weather is loaded; header is 48 dp tall with 4 tiles, so prefer swapping tile content (worst rain, temp range, headwind share) over adding more |
| Profile ribbon | `ElevationChart.svelte:700` (grid rows) and `:169` (zoom/pan) | new `auto` row with a canvas view, x-range from `getCurrentMinMax()` |
| Map markers | `ItemsModule.ts:548-609` | add `class: 'weather'` features at sample positions; update on shift-slider change by re-calling `setGeoJSON(2, ...)` (the whole collection is replaced there, which is already how steps work) |
| Map style | `app/assets/styles/inner.zip` (`voyager.xml`, `eink.xml`) | text rules for `class='weather'`: glyph via `[{'icon'}]` and `style.mapFontFamily`, label temp |
| Strings and tutorial | `en.json` + `fr.json`, `tutorialPages.ts:150` | tutorial zone for the shift slider, long press on a marker, any new gesture (repo rule) |
| Navigation (later) | `NavigationView.svelte:56-57`, `navigationProgress` | recompute ETAs from `remainingTime`, show "rain in 40 min at km 62" |

Repo-rule notes: Svelte 4 only (no runes); gate logs with `DEV_LOG &&`; `app/` vs `tools/app` fork drift is irrelevant here as long as nothing is added under `tools/`; gate verification with `yarn svelte-check` and a device run (no test runner exists).

## UI

See the mockups. Principles from `docs/design/README.md`: theme colour as accent; neutral panels with hairlines; stat tiles as the idiom for figures; sheets open with a panel header; **colour is never the only signal** (hatching, numbers, thicker outlines on e-ink).

1. **Departure control** (card header): a `Pill` `Leave 08:00` (tap = `pickDateTime`, long press = "now", same as transit) and a slider "Shift departure" from -3 h to +3 h in 15 min steps. A reset chip appears when the shift is not 0. The state "what if I leave +1 h" is explicit in the header: `Leave 09:00 (+1 h)`.
2. **Route header tiles** (while weather is on): worst rain `3.1 mm/h at km 62`, temperature range `4..17 °C`, headwind share `38 %`, best start `-45 min`. Each tile = icon + value, like the existing four; tooltip on long press.
3. **Map**: a marker per sample = condition icon + temperature, a small precip number, wind arrow. Under each, a 3-cell strip (ETA -1 h, ETA, ETA + 1 h) shows whether it changes; the cells use pattern and darkness, not hue alone. A floating map control (the `.mapControl` idiom, round, semi-transparent) shows the shift slider while a route with weather is selected. Tap a marker = jump the table and the elevation cursor to that sample.
4. **Elevation profile**: a weather ribbon under the chart sharing the x axis: precip bars (height = mm/h, with the value on the tallest), a temperature line, and a wind-effect band (hatched for headwind, dotted for tailwind, label with km/h). A freezing-level line over the profile is optional (**phase 3**).
5. **Per-sample table** (the "if late/early" view): rows = samples (km, ETA, altitude); columns = `-1 h`, `on time`, `+1 h`, each with icon, temperature, precipitation; a row whose three cells differ by one rain class or more is marked with a bold left bar. Sorted by distance; tap row = locate.
6. **Best departure** card: bar chart of cost per offset, best offset highlighted, one sentence.
7. **States**: loading, offline-with-cache ("updated 3 h ago", amber outlined label, not a filled block), offline-without-cache (a disabled action explains why), rate limited (retry later), out of horizon.

E-ink: icons plus numbers in each cell, patterns instead of tints (the mockup includes an e-ink panel), no animations in the slider (step on release).

## Perf & request budget

| Case | Samples | HTTP requests | Weighted calls (Open-Meteo, locations x weight) | Payload |
|---|---|---|---|---|
| **150 km ride, 8 h, 19 km/h** (step = 9.5 km) | 17 + ~3 relief = ~20 | 1 | ~20 | 20 loc x 10 vars x 24 h = 4 800 values, ~40-60 KB JSON (~10 KB gzipped) |
| 40 km hike, 12 h, 3.3 km/h (step -> 3 km) | ~14 + 3 | 1 | ~17 | ~35 KB |
| 20 km hike, 8 h | ~7 + 3 | 1 | ~10 | ~20 KB |
| Overnight / 2 calendar days | ~20 | 2 | ~20 | ~2x |
| Shift slider, best-departure search | 0 | 0 | 0 | local maths over cached series |

- Free quota: 10 000 calls/day per IP, so ~500 such route lookups a day. Fine for one user; carrier NAT could share the IP (handle 429 with a "try again" state).
- URL length: ~25 chars per location (lat, lon, elevation) -> 40 locations ~ 1 KB. No need to POST.
- Client CPU: sampling is O(N points) once (profile array, thousands of points, cumulative distance is already derivable). Interpolation of 20 x 6 series is trivial. Marker rebuild on slider moves: <= 40 features through `setGeoJSON`, debounce 100 ms. No worker needed.
- Cache: in-memory `Map` for the session plus a persisted LRU JSON file modelled on `osmDetails.ts` (not SQLite: it is transient, no migration needed, and `Item` columns are migrated via `BaseRepository.migrations` - heavy for a forecast). Key = hash of rounded coords + variable set + dates. TTL: 1 h when the ride is within 24 h; 3 h otherwise (model runs refresh every 3 h for ICON-D2 / AROME; `docs` pages). Stale entries are **shown** offline with an age label, never silently hidden (hikers fetch at the trailhead and use it later without signal).
- Also benefits from the 40 MB `https` disk cache because the URL is deterministic (rounded and stable ordering).

## Privacy

- This is the first feature that sends **route geometry** to a third party. Place search and routing providers already receive coordinates, but a route is richer.
- What goes out: up to ~40 points (lat, lon rounded to **2 decimals**, ~1.1 km north-south and ~0.8 km east-west at 46 N), an altitude per point, the dates, and the IP. No item name, no id, no title, no device id. Sent only after an explicit tap on the action (never automatically, never in background).
- 2 decimals loses nothing: the finest model grid is 1-2.5 km, and Open-Meteo snaps to the grid anyway. Windy rounds to 2 decimals (verified); MET Norway wants <= 4 (verified).
- A route's first and last sample would reveal a home within ~1 km. Mitigation: setting "Weather precision" with an option for 1 decimal (~11 km) at the cost of the hi-res benefit, and optionally pulling the first and last sample 2 km along the route (the forecast barely changes). Default to 2 decimals and say so in the card's footer, with the provider attribution.
- Respect `networkService.connected` (includes forced offline). In offline mode the action is disabled, the cache is still shown.
- No account, no key, nothing to leak in the binary (Open-Meteo). If a keyed provider is ever added, a proxy is the right place for the key, not the app.
- Attribution: "Weather data by Open-Meteo.com" (CC BY 4.0) in the card footer and the About/credits list.

## Risks

| Risk | Impact | Mitigation |
|---|---|---|
| Open-Meteo non-commercial clause vs store build (IAP package present) | blocks shipping | owner decision; paid `customer-api` or self-hosted instance behind the same interface |
| `instruction.time` semantics unknown (`routing.ts:33`) | wrong ETAs | read one real route in DEV_LOG before coding the cumulative mapping; fall back to the average speed |
| GPX has no timings (`navigation.ts:668`) | ETA guess wrong -> wrong weather | pace multiplier in the control; label "estimate"; show uncertainty window (+/-) |
| ETA error grows over 8 h | the "late/early" view helps precisely because ETAs are fuzzy | use +/-1 h as the baseline, and chips for +/-2 h |
| Mountain forecast skill at 1-2 km | local storms are missed | CAPE/thunder flag, label "model forecast, not a warning"; link to the weather app action for the point (existing `openItemWeather`) |
| Elevation ribbon x-sync under zoom/pan | visual misalignment | re-render on the existing `on:zoom`/`on:pan` (`ElevationChart.svelte:740-742`); fallback: ribbon off while zoomed |
| Style zip edit is a binary change in `inner.zip` (both styles) | merge pain | keep the rule additive; alternatively draw markers with existing `waypoint` rules and `icon`/`color` props (no zip change) in phase 2 |
| 429 shared-IP | feature unavailable at times | cache + retry with backoff + clear state |
| Multi-model seams (AROME to ARPEGE at a border) | step in the series | accept; mention "best available model" |
| `app/components/three/**` etc. | none (not touched) | - |
| No test runner | pure-logic bugs hide | keep `routeTiming.ts` and the scorer UI-free; reason through fixtures; real-device check |

## Phased plan

| Phase | Scope | Effort |
|---|---|---|
| 0 | Decisions: provider licence, default pace, units. Verify `instruction.time` and Open-Meteo `start_date`/`end_date` + multi-location in a scratch request | S |
| **1 (smallest valuable)** | `routeTiming.ts` (ETA + sampler + wind-relative), `WeatherService` + cache, route `weather` action, `RouteWeatherCard` (departure pill, shift slider, tiles, table, best departure, states), en/fr strings | **M** |
| 2 | Map markers + shift slider as a map control (`ItemsModule` + style rules, including `eink.xml`), tap-to-locate; tutorial entries | M |
| 3 | Elevation weather ribbon (zoom-synced), freezing-level line | M-L |
| 4 | Header tiles in `RouteStatTiles`, persisted snapshot per saved route, GPX pace calibration | S-M |
| 5 | Navigation: live ETAs from `remainingTime`, "weather ahead" widget (`navigationHasPreviewWidgets` hook in `NavigationView.svelte`), alerts | L |

Slice sizes: sampler/ETA S-M; provider+cache M; card M; best-departure S; map M; ribbon M-L; tutorial/i18n S per slice.

## Open questions for you

1. Is the store build "commercial" under Open-Meteo's terms (any ads, subscription, or paid feature; `nativescript-inapp-purchase` is a dependency)? If yes: paid plan, self-host, or a different provider.
2. Departure time default: "now", or last chosen per route? Persist the shift?
3. Activities: should the weights (headwind, thunder, cold) follow the route profile (`pedestrian`, `bicycle`, `auto`)? Cars and motorbikes could use rain and ice only.
4. Pace: add a user pace multiplier and stops, or trust `totalTime`?
5. Multi-day routes: stage the ride (daily start time and hours), or out of scope for v1?
6. Privacy default: 2 decimals (~1 km) with a setting for 1 decimal, or pull start/end inward by default?
7. Where should weather live first: route sheet only, or also before saving (directions panel result)?
8. Map markers: reuse the `waypoint` style (no zip change) first, or add dedicated weather rules including e-ink from the start?
9. Are the `ossweather` / system weather apps still the desired point action? A fetch-based "point weather" for markers could reuse the same service later.
