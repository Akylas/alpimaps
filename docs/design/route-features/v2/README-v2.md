# Route features v2: lenses, Route page, one map language

Design only, no app code changed. Supersedes the UI parts of [`../00-unified-design.md`](../00-unified-design.md)
(the first pass). Its data model (`RouteAnalysis`, layers with provenance, `RouteTimeline`, pipeline, TTL table,
providers) **stays**: v2 changes how it is shown, not how it is computed.
Product decisions: [`../DECISIONS.md`](../DECISIONS.md) + the v2 decisions in section 11 (from the user's review).

Mockups (fake data, light / dark / e-ink toggle; `#dark` / `#eink` in the URL opens a theme):

| File | Shows |
| --- | --- |
| [`bottom-sheet.html`](bottom-sheet.html) | peek / half, lens bar, focus, point readout, entry points to the Route page, data states, GPX ask, small screens |
| [`route-page.html`](route-page.html) | the Route page: hero map (collapsing), When panel, every lens section, departure passed, opened from navigation, done ride, tablet |
| [`map-styles.html`](map-styles.html) | route anatomy, every lens, light / dark / e-ink, symbols, focus, navigation layers + alert overlay, base-style changes, palette |
| [`navigation.html`](navigation.html) | navigation dock with swipeable data pages, alert overlay on the map, risk banner, Route page access, travel-mode capsule, junction chips |

Paths are relative to the repo root. "Verify" marks what I did not run.

---

## 0. The design in ten moves

1. **One concept: the lens.** `Overview`, `Climbs`, `Road`, `Weather`, `Sun`, `Surface`. Picking a lens recolours the
   map line, refills the profile and sets the insight line at once. The first pass had four switches for this
   (map colour-mode button + popover, profile ribbon chips, Insights card, tiles opening the page); v2 has one.
   The lens is **remembered globally** and **shared with navigation**.
2. **The lens bar is the insights.** Each chip carries its headline value (`Climbs 4`, `Road 9.8 km ⚠`,
   `Weather 3 mm`, `Sun 62 %`). The sheet needs no extra card.
3. **The Route page is a page of its own** (items list, sheet, navigation all open it). Its hero is a small
   second map view showing the route in the active lens, scrubbable from the profile; it collapses from 240 to
   120 dp while scrolling so the map always shows the focused section.
4. **The sheet stops at half**: peek (title + tiles) and half (actions + lens card). Depth is on the page.
5. **Profile as the spine.** Scrubbing moves the map cursor; the point readout replaces the insight row (no
   overlay on the chart); tap the readout or the cursor to clear. Weather and Sun lenses keep the grade profile,
   faded, under their data.
6. **Section focus, both ways.** A climb row, risky section, weather sample, attention mark or the line on the map
   focuses that section everywhere; ◀ ▶ step through the others with the thumb.
7. **Four tiles**: Distance, Time (+ arrival clock), Elevation (D+, with D− under it in a smaller font), Risk (bike,
   computed; decision 01.9). An attention track under the profile shows only what needs attention.
8. **"When" is one pill** on the Route page; it opens a departure strip of 13 half-hour cells scored for the ride.
9. **Map: one route anatomy, palettes as data.** Casing + lens core + marks + plates, one `routelens.mss`, colours
   from a `lens_pal` table style parameter written by the app per theme. While navigating or following a route an
   **alert overlay** always marks steep (chevrons + grade plate) and fast roads (red outer casing + speed sign);
   weather shows on the map only in the Weather lens.
10. **Navigation dock**: one 40 dp summary row + one **swipeable data page** (Climb, Profile, Ahead, Trip), like a GPS
    computer, with the map still visible; ~96 dp of map back vs today. A rail button opens the Route page on the
    remaining route. Road risk = outlined banner only. Travel mode = a capsule on the GPS button with a speed dial.

---

## 1. Principles

- **One selection drives everything.** Lens + focus is global state (`routeLensStore`, `routeFocusStore`) read by
  sheet, page, both maps, profile and navigation. No surface has its own colour switch.
- **Glance first, depth on a page.** Peek answers "how long / how hard / is it safe"; half answers "what is special";
  the Route page answers everything and is where you plan and update.
- **Safety marks are not a lens.** Steep and fast roads are always marked while following a route; what the lens
  chooses is the reading on top.
- **Honest data.** Outdated data stays visible but looks outdated; nothing blocks; one tap updates.
- **No hidden gestures** unless they replace a worse control; each one is in section 9.
- **Design chart rules hold**: theme accent = selection, no lens uses it; neutral surfaces; round map controls,
  `colorMapControl`, hairline, no elevation; 48 dp targets; e-ink never relies on colour.

---

## 2. What changed vs the first pass, and why

| First pass | v2 | Why |
| --- | --- | --- |
| Colour-mode map button + popover; ribbon chips (max 3); Insights card; tiles open the page | **Lens bar** on the profile card; the lens sets map line, profile and insight line | four entry points for one idea; ribbons stacked up to 34 dp and needed their own legend |
| 7 colour modes (Plain, Surface, Grade, Steep, Risk, Sun, Weather) | 6 lenses; **Climbs = grade + steep + categories** | Grade and Steep were one reading at two resolutions |
| 5 tiles with width-dependent icon/unit dropping and spill-to-chip | 4 tiles; Elevation shows D+ and, smaller, D− | predictable row |
| Route page with an `image_path` snapshot hero | **hero = small second map view**, collapsing 240 → 120 dp | the user asked for a scrubbable map preview in the active lens; a snapshot cannot scrub or recolour |
| Plan card always expanded at the top | **When pill** in the app bar, panel with a departure strip | plan matters for weather / sun only; it should not push analysis below the fold |
| ±3 h slider + early / on time / late table + best-departure callout | **departure strip** scoring 13 departures | one control answers "when should I leave" |
| Selected-point strip over the top of the chart | **readout in the insight row**; tap it to clear | the strip hid a big part of the chart |
| 10 freshness chip texts | 3 tiers: fresh (nothing), **outdated** (amber + age + ↻), **unavailable** (grey) | users need "can I trust it, can I fix it" |
| "What is this track?" modal | inline 2-button card | non-blocking, says why it asks |
| Navigation: bar 112 + trip 72 + ahead 80 dp; outlook squeezed into the ahead row | **dock**: summary 40 + one swipeable data page, Climb page first | grade / steep matter more than weather while riding; remaining km and ascent took too much room |
| Lens colours only (steep / risk depended on the mode) | **alert overlay** in navigation: steep + fast roads always marked | they are safety, not a reading |
| Travel-mode tab above the GPS button, tap cycles, long press options | **capsule** + 4-option speed dial | cycling blind picks the wrong mode; no new long press |
| `rt` slices with palette variables per style file | `lens` slices + **`lens_pal` table style parameter** | legend and map cannot drift; dark and e-ink without new styles |
| Speed badge as text with halo | **speed sign plate** (`text-background-*`) | the fork supports plates; recognisable from the road |
| Straight-on continuation (decision 04.4) unexplained | **"No entry"** chip only as an exception | knowing you *cannot* go straight is the useful case |

Kept: `RouteAnalysis`, provenance, `RouteTimeline` + re-anchoring, pipeline and ordering, weather TTL by lead
time, providers, done-ride policy (Historical Forecast / ERA5), settings page structure, `junctions` layer, the
"navigation emits slices into the `navigation` layer" rule.

---

## 3. Information architecture

### 3.1 Surfaces

```
 main map + sheet                        Route page (pushed)                   navigation
 ┌───────────────────┐                   ┌───────────────────┐                 ┌───────────────────┐
 │ map: route in lens│                   │ ← name   When ⋮   │ app bar 56      │ maneuver card     │
 │ + alert symbols   │                   ├───────────────────┤                 │ [risk banner]     │
 ├───────────────────┤   Plan / › /      │ hero map 240→120  │ 2nd map view    │ map + alert       │
 │ peek: title+tiles │   Time tile /     ├───────────────────┤                 │ overlay     [rail]│
 │ half: actions,    │ ─ items list ───► │ lens bar (sticky) │                 ├───────────────────┤
 │ lens card, profile│   nav rail        │ silhouette 28     │ ◄── rail ────── │ dock: summary 40  │
 └───────────────────┘                   │ tiles, profile,   │                 │ data page (swipe) │
                                         │ sections…         │                 └───────────────────┘
                                         └───────────────────┘
```

| Surface | Steps / layout | Content |
| --- | --- | --- |
| Sheet, **Peek** | 118 dp (70 title band + 48 tiles; unchanged) | name, subtitle, 4 tiles |
| Sheet, **Half** | 118 + 60 actions + 246 lens card = **424 dp** (last step) | actions, lens bar, insight / readout line, profile, attention track |
| **Route page** | pushed page; app bar 56, hero 240 → 120, sticky lens bar (+ silhouette) | tiles, profile, banners, one section per lens, surface, details, saved data |
| **Navigation** | maneuver card, banner slot, map, rail, dock (summary + data page) | section 7 |

- Steps still follow the item (`docs/design/README.md` decision): a route gets `[0, 118, 424]`. The old per-card steps
  (profile 215, stats 164, OSM card) go: stats and OSM details move to the page.
- Small windows: at 640 dp tall the half step leaves 216 dp of map; nothing else changes (`bottom-sheet.html` 4.2).
- **Tablet / wide window (≥ 600 dp)**: the page opens as a 400 dp pane beside the main map instead of a pushed page;
  there is no second map view, the route is framed in the main map's free area. Uses the existing
  `sheetWidth` / `innerWidth` props (`BottomSheetInner.svelte:493-495`) for the pane.

### 3.2 Entry points to the Route page

| From | Action | Opens at |
| --- | --- | --- |
| Sheet actions row **Plan** (tonal labelled, `mdi-calendar-clock`) | tap | top, When panel open the first time |
| Insight line `›` | tap | the active lens' section, expanded |
| **Time** tile | tap | top, When panel open |
| Items list route row ⋮ → `Plan` / row tap on a route with analysis | tap | top |
| Navigation rail **Route** button (`mdi-chart-timeline-variant`) | tap | top, *remaining-route* mode (5.6) |
| Directions result (unsaved item) | `Plan` | transient analysis, persisted on save |
| End of a recording ("Ride saved") | `See ride` | done-ride variant (5.7) |

Tiles **Elevation** / **Risk** only switch the lens (Climbs / Road) and raise the sheet to half.
The first pass' round `analysis` action is dropped: **Plan** is labelled and sits where `information` / `address`
sit for a place (`layoutActions`, `BottomSheetInner.svelte:117-136`).

### 3.3 The hero map (second map view)

- `RoutePage.svelte` hosts a small `<massifmap>`: offline base layer, the inner style (own
  `MBVectorTileDecoder`, since `selected_id` / focus / lens params differ from the main map), and one local GeoJSON
  source with the route + lens features + cursor. No hillshade, buildings, 3D, POI search, user location layer
  (except in remaining-route mode). Tile cache small (e.g. 16 MB). Created on page open, disposed on close.
- Verify: whether a base `TileDataSource` (offline package / MBTiles) can be shared between the two map views or
  must be opened twice; whether the SDK renders on demand (no frame loop while nothing changes). Measure memory on
  a low-end Android before committing (the main map stays alive under the pushed page).
- Framing: `camera.fitBounds(bounds, { screen })` (as `zoomToItem`, `Map.svelte:1003-1040`) into the hero size,
  re-run on focus change and on collapse 240 ↔ 120 (animated 200 ms; e-ink snaps).
- Hero tools: `⤢` closes the page and shows the route on the main map at half, same lens and focus (no third map);
  `3D` (Sun lens) does the same and turns on route sun mode with the cursor's time (decision 05).
- **No still-image fallback** (decided): the hero is always a live map. If the spike shows the cost is too high, the
  answer is a lighter hero map (lower tile cache, no labels below z12, render on demand), not a snapshot. If map
  creation fails, the hero row collapses and the page works without it (the main map is one ⤢ away).

---

## 4. The lens system

### 4.1 Lenses

| Lens | Available when | Map line (slices) | Map symbols | Profile | Chip value | Insight line (example) |
| --- | --- | --- | --- | --- | --- | --- |
| **Overview** | always | item colour (today's look) | speed signs (bike), km shields | today's grade fill | none | `62.4 km · 3 h 41 · 4 climbs · 3 fast sections` |
| **Climbs** | profile with grades | 8 grade buckets (`app/utils/grade.ts:47`) | chevrons ≥ 9 % (denser ≥ 12 %), category plate at each summit | grade fill + climb brackets with Cat | `4` | `4 climbs · Cat 1 to the col at km 52 · max 16 %` |
| **Road** | bike + computed + risk layer (01.2) | neutral grey core; fast runs amber (s2) / red (s3) | speed sign per risky run (also < 200 m, 01.5) | grey fill + risk bands with speed | `9.8 km ⚠` | `9.8 km on fast roads without a separated lane` |
| **Weather** | weather layer | rain class (dry neutral, purple ramp) | weather plate per sample, wind arrow relative to travel | **grade profile at 38 %** + temperature line + rain bars + glyphs | `3 mm` | `8–17 °C · rain 3 mm around km 38 · headwind 40 %` |
| **Sun** | timeline (astronomy), `lit` adds terrain | sun / shade / overcast / dark | sunrise / sunset plate, glare ticks | **grade profile at 38 %** + sun bands + sunset tick | `62 %` | `Sun 62 % · sunset 17:07 at km 53 · 34 min dark` |
| **Surface** | stats | `surfaceColors` (`app/utils/routing.ts:180`) | none | surface fill | `80 % paved` | `80 % paved · 14 % gravel · 6 % path` |

- Missing data: dashed chip with `+`; selecting it turns the insight line into a compute card
  (`Sends 20 points, rounded to 2 decimals, to Open-Meteo` `[Fetch]`). Unavailable lenses (Road on a hike) are absent.
- **Persistence (decided)**: the lens is **global**, last used (`route_lens`, `settingsStore`), applied to any
  selected route; a route that cannot show it (Road on a hike) falls back to Overview without changing the setting.
- **Navigation (decided)**: uses the same lens. The alert overlay (6.6) is added on top whatever the lens.

### 4.2 Lens bar (`LensBar.svelte`)

- Row 44 dp, horizontal scroll, padding `0 10`, gap 6. Chip 32 dp (inside a 44 dp row), radius 16,
  `colorOutlineSoft` hairline, glyph 16 + label 13 + value 13 bold.
- Selected: `colorAccentContainer` fill + 1 dp `colorPrimary` outline. E-ink: 2.5 dp black outline + bold.
- Marks: alert dot 6 dp `colorError` (lens has an s3 item); `↻` + amber outline when outdated; cloud-off when
  offline-cached; 2 dp indeterminate underline while running; dashed + `+` when not computed.
- Fixed order: Overview, Climbs, Road, Weather, Sun, Surface; the selected chip is scrolled into view.
- Same component in the sheet (inside the lens card) and on the page (sticky under the hero).

### 4.3 Insight line, readout, focus (`LensInsight.svelte`)

One 40 dp row under the lens bar, three states:

| State | Content | Leaves by |
| --- | --- | --- |
| headline | one sentence (14, ellipsized) + `›` or a 32 dp tonal button (`Fetch`, `Update`, `Retry`) | - |
| **readout** (a cursor exists) | `📍 26.2 km · 559 m · −1.7 % · 15:33` + the lens value (`9° · rain 1.2 mm`), `colorAccentContainer` tint, `✕` | tap the row, tap `✕`, tap the cursor on the chart again |
| focus (a section is focused) | `◀  Cat 1 · Col du Granier · 7.7 km · 5.2 %  ▶  ✕` | `✕`, tap empty map, change lens |

The chart is never covered: the old selected-point strip (`rows="46,*,auto"`, `ElevationChart.svelte:700`) goes;
on the chart only the cursor line and dot remain. On the route (GPS on route) the readout shows your position.

### 4.4 Attention track

6 dp row under the profile x range (same content rect, offsets from `ElevationChart.svelte:461`). Marks: fast run
(red), rain ≥ 0.5 mm/h (purple), very steep ≥ 12 % (dark red), dark (navy). Tap a mark (hit slop 24 dp) → its lens +
that section focused. E-ink: black boxes. Not drawn when empty.

### 4.5 Selection model

```ts
// app/stores/routeFocusStore.ts (pure store, no NativeScript import)
export interface RouteFocus {
    itemKey: string;
    cursor?: { index: number; distance: number };                    // scrubbing / GPS on route
    section?: { lens: LensId; id: number; i0: number; i1: number };  // focused section
}
// the lens itself is the global `routeLensStore` (settingsStore 'route_lens')
```

| Source | Sets | Effect |
| --- | --- | --- |
| Drag / tap on the profile or the silhouette | `cursor` | cursor dot on whichever map shows the route (existing `user_onroute_data` path), readout row; Sun lens + 3D: light time = ETA at cursor. Maps pan only if the cursor leaves the visible area |
| Section row, attention mark, ◀ ▶, the route line on a map | `section` | map fits the section, other slices fade (e-ink: thinner), focus halo; profile zooms to the section ± 10 % (`range` prop, `ElevationChart.svelte:107`); the page scrolls the row into view |
| `✕`, tap empty map, lens change | clears | - |

Map → sheet / page: the route line is tappable (`onVectorTileElementClicked`, `BottomSheetInner.svelte:189`); the
click resolves to the nearest slice of the active lens.

---

## 5. Sheet and Route page: component specs

Sizes in dp at font scale 1 (`fontScaleMaxed` as today). Tokens are `app/variables.ts` names.

### 5.1 Peek: title band + tiles (118)

- Title band 70: handle 32×4 (`colorOutline`, 60 %), icon tile 40 r12 `colorAccentContainer`, title 17 bold,
  subtitle 13 `colorOnSurfaceVariant` (`Cycling · road · loop · saved`), ⋮ 40.
- Tiles 48 (tile 40 high, r10, `colorSurfaceFill`, row padding `0 8`, gap 4, tile padding `0 5`; e-ink 1 dp border):

| Tile | Weight | Line 1 (13 bold) | Line 2 (10.5) |
| --- | --- | --- | --- |
| Distance | 1 | `↔ 62.4 km` | accent `⚑ 36.2 km` on the route |
| Time | 1 | `⏱ 3 h 41` | `→ 17:41` (muted) when a departure is set; accent `⚑` left on the route |
| Elevation | 1.15 | `↗ 1 180 m` | `↘ 1 175 m` (muted); on the route: accent `⚑ +612 m` (ascent left) |
| Risk | 1 | `⚠ 9.8 km` | `3 sections` |

  Risk: 1.5 dp `colorError` outline, value `colorError`; e-ink 2 dp black; only bike + computed + risk layer + > 0.
  Hiking: three tiles, Elevation weight 1.5. Below 360 dp Distance and Time drop their icon; the row never wraps.
  At font scale ≥ 1.3 the second lines drop first. No profile / steepness drawing in the tile.

### 5.2 Half: actions + lens card (306)

- Actions 60: `Start` filled, `Plan` tonal labelled, round `Edit`, `Share`, `…`.
- Lens card (`RouteLensCard.svelte`), `.panel`, r20, margin `4 6 0`, 246: lens bar 44 · insight / readout / focus
  40 · chart 122 · attention 6 (+4) · axis 22 (km; clock time under every second tick when a timeline exists) · 8.
- **GPX ask** (decision 02.2): when the activity is unknown and a lens needs it, the insight row becomes a 56 dp
  card `Hiking or cycling? Climbs, pace and sun depend on it.` `[Hike]` `[Bike ▾]` (road / gravel / MTB), stored in
  `analysis.inputs.activity`; until answered Climbs uses the hiking preset, labelled.

### 5.3 Route page layout

| Part | Height | Content |
| --- | --- | --- |
| App bar | 56 | back, name 15.5 bold + subtitle 11.5 (`Cycling · road · saved`), **When pill** (`14:00 → 17:41`, 36 high, r18; accent when set by the user; amber + `passed` when past), ⋮ |
| Hero map | 240 → 120 | 3.3. Legend chip bottom-left (`Fast ≥ 70 · context on`), tools top-right |
| Lens bar | 44, sticky | 4.2 |
| Silhouette | 28, sticky once the profile card is scrolled out | profile outline + lens band 4 dp + cursor + focused range; drag = scrub |
| Scroll (page background `colorCanvas`, cards `colorCard`) | - | tiles 48 · banners · profile card (insight 40, chart 150, attention, axis) · sections · footer |

Collapse rule: the hero shrinks linearly from 240 to 120 over the first 120 dp of scroll, then stays (Svelte scroll
handler sets one height, throttled to animation frames; e-ink: two states only).

Sections, one card each (`.panel` r16, margin `8 6 0`), header 56: icon tile 36, title 14.5 bold, summary 12 (1
line), freshness chip, chevron. Collapsed = header only; state persisted per section (`route_page_sections`).
Default open: the active lens' section + any section with an s3 item. Fixed order:

- **Climbs**: preset pill (`Road preset ▾` + thresholds), climb rows 54 (category plate 40×22, name + `km 12`,
  `6.6 km · 5.8 % avg · +382 m`, sparkline 56×18 in grade colours); `Steep sections · 5` sub-list collapsed by default
  (02.6); descents listed, never warned (02.4).
- **Road safety** (bike, computed): stacked bar (no lane / painted / separated / slower), rows with a 30 dp speed
  sign, km range, length, infrastructure; note "Based on the tagged max speed in the offline map…" + gear.
- **Weather**: along-the-ride rows (km, ETA, glyph, temp, rain, wind relative to travel `head 18`), wind share bar,
  provenance + Open-Meteo attribution (CC BY 4.0).
- **Sun & shade**: bar, facts (sunset at km, dark minutes, glare km, sun side), "terrain only" note, `See it in 3D`.
- **Road & surface**: the existing `RouteStatsView`. **Details**: the existing OSM card. **Saved data**: layers,
  sizes, `Pin`, `Remove data`, `Share with data`. Footer: attributions.

### 5.4 When panel (`WhenPanel.svelte`)

Opens in place under the lens bar (pushes content). Activity pills (`Hike` `Road` `Gravel` `MTB`); day chip + `Now`;
**departure strip** (13 cells 46×66, −3 h … +3 h by 30 min, the chosen cell centred; clock, 6 dp score bar, worst
factor glyph; ★ best). Score, derived on read: `rain mm × 3 + headwind share × 2 + minutes after sunset / 15`, cells by
tertile (good teal / fair amber / poor red; e-ink empty / hatched / solid); without weather the score is darkness
only, said in the strip; cells outside the fetched coverage are dashed with `↻`. Pace ×0.8–1.3 and stops min/h
sliders; `Split days` switch (03.4). Result line `Arrive 17:41 · sunset 17:07 · 34 min dark`. Long press on the When
pill = back to now (as the transit pill, `DirectionsPanel.svelte:896-905`).

### 5.5 Freshness, as the user sees it

| Tier | Internal states (first pass 3.1) | Chip / lens chip | Map |
| --- | --- | --- | --- |
| Fresh | fresh, aging, pinned | none; footer `Updated 09:05 · 2 h ago` | normal |
| **Outdated** | stale, inputs-changed, departure passed | amber outline `↻ 3 h old` / `↻ departure changed`; tap = update that layer | that lens' plates at 55 %, dashed border (`stale=1`); e-ink: dashed border only |
| **Unavailable** | absent, offline-cached, failed, running | grey `+ Not computed`, `☁̸ Offline · 09:05`, `Couldn't update · Retry`, spinner | offline-cached draws normally |

Pull-to-refresh on the page refreshes every outdated layer. Departure passed: amber When pill + one banner
`Planned departure passed (08:00)` `[Use now]` `[Keep]`.

### 5.6 Remaining-route mode (opened from navigation)

Rail button while navigating (or following a route). The same page with: subtitle `Navigating · 26.2 km done`; When
pill `now → 17:41` (re-anchored timeline, first pass 3.4); hero framing the remaining route, done part grey, your
position; tiles with the "left" values; a banner `Remaining route from km 26.2 · forecast from 09:05 (5 h)` `[Update]`
that refetches the remaining samples; profile zoomed to what is left. Back returns to navigation; navigation never
stops (the service runs under the page; verify the navigation camera re-engages on return).

### 5.7 Done ride

App bar `Granier ride · Sat 2 Nov`, `Ridden · 08:12 – 12:03`; When pill → `Recorded`; tiles with recorded moving
time and average speed; weather section titled `Weather you had`, chip `reconstructed`, note "Reconstructed from model
data (historical forecast, ~2 km), not measured. Pinned." Policy unchanged from first pass 1.6.

---

## 6. Map style system

### 6.1 Route anatomy (items, directions results, navigation, hero map)

```
  alert casing      ── red outer casing on fast runs (navigation / following, and the Road lens)
  casing (border)   ── `lens_case`, 1.5 dp per side (2 dp in navigation)
  core              ── lens slice colour (Overview: item colour; navigation Overview: accent)
  focus halo        ── accent at 45 %, core + 10 dp, under the core (only the focused section)
  marks             ── white arrows every 50 dp at z ≥ 13; chevrons on steep (Climbs lens, and always in navigation)
  plates            ── speed signs, grade plate (navigation), climb categories, weather, sun events, km shields
```

States: unselected (today); selected = `@bicycle_line_width + 3`; navigating = navigation widths, slices in the
`navigation` layer under `maneuver`. Dark: `lens_case #101316` and a lifted palette (white casing on a dark map
glares). E-ink: white casing 2 dp, black core.

### 6.2 Z-order (bottom → top)

| # | What | Where |
| --- | --- | --- |
| 1 | base map; fast-road context (optional, B2); one-way chevrons (B3) | massif base style |
| 2 | `routes` network overlay, 35 % while a lens ≠ Overview is active (B1) | `inner/shared/route.mss` |
| 3 | `items` (unselected look) | `items.mss` |
| 4 | `directions` | existing |
| 5 | `navigation`: alert casing → route → lens slices → passed (if enabled) → detour / original | `navigation.mss` + `routelens.mss` |
| 6 | `maneuver` | existing |
| 7 | `junctions` (04) | new layer, first pass 4.6 |
| 8 | `poi`: focus halo → slices (planning) → chevrons → km shields → plates | `items.mss` + `routelens.mss` |
| 9 | search, selection, user location | code layers |

### 6.3 Feature contract (`app/utils/routeAnalysis/lensFeatures.ts`, one pure builder for all sinks)

```ts
type LensId = 'climbs' | 'road' | 'weather' | 'sun' | 'surface';
interface LensSlice {                // LineString = slice [i0..i1] of the route geometry
    class: 'lens';
    lens: LensId;
    k: string;                       // palette key: 'g0'..'g7', 'r0'..'r3', 'w0'..'w3', 's0'..'s3', 'f_<surface>'
    s: 0 | 1 | 2 | 3;                // severity: e-ink ticks, width bump, sort
    f: 0 | 1;                        // 0 = outside the focused section
    id: number; i0: number; i1: number;
}
interface LensFocus { class: 'lensfocus'; id: number }                  // LineString
interface NavAlert {                 // LineString, navigation / following only, whatever the lens
    class: 'navalert';
    kind: 'fast' | 'steep';
    s: 2 | 3;
}
interface LensSymbol {               // Point
    class: 'lsym';
    sym: 'speed' | 'grade' | 'climb' | 'wx' | 'wind' | 'sunset' | 'sunrise' | 'night';
    t: string; t2?: string; icon?: string; rot?: number;
    s: 0 | 1 | 2 | 3; stale?: 0 | 1;
    p: number;                       // placement priority, higher wins
}
```

Budget: ≤ 200 slices + ≤ 60 symbols + ≤ 40 alerts; rebuilt on lens / data / focus / reroute change, never per fix.
Overview emits no slices (the item draws itself), only speed symbols.

### 6.4 Palettes as a table style parameter

`inner/voyager.json` `styleparameters`:

```json
"lens_pal": { "default": { "g0": "#1B4E9B", "g1": "#3B7DD8", "g2": "#7FB2E8", "g3": "#7BC96F", "g4": "#F2D14B",
                           "g5": "#F0902B", "g6": "#E34A33", "g7": "#9E1B18",
                           "r0": "#8D96A3", "r2": "#F29D38", "r3": "#D7263D",
                           "w0": "#8D96A3", "w1": "#B39DDB", "w2": "#7E57C2", "w3": "#4527A0",
                           "s0": "#7C93B0", "s1": "#F5B82E", "s2": "#B0B7BF", "s3": "#243049",
                           "sign": "#D7263D", "plate": "#2B2F33" } },
"lens_case": { "default": "#ffffff" },
"route_focus": { "default": 0 },
"fast_context": { "default": 0 }
```

The app writes the table from `app/utils/routeAnalysis/lensPalette.ts` (`setStyleParameter('lens_pal', JSON)` via the
`Map.svelte:1390` helper, inner decoder; the hero map's decoder gets the same) on theme change: light, dark (lifted
steps, e.g. `r0 #5C6570`, `s3 #8FA3D9`), e-ink (all `#000`). The legend reads the same module. `get([param::lens_pal],[k])`
reads a field, so a palette change re-decodes the inner layers' visible tiles once (`style-parameters.md`, "What a
change costs") — only on theme change. Full table with dark / e-ink values: `map-styles.html` section 8.

### 6.5 Rules (`dev_assets/styles/inner/shared/routelens.mss`, in both `voyager.json` and `eink.json`)

```css
@lens_w: @bicycle_line_width + 3;
@lens_case_w: linear([view::zoom], (10, 1), (16, 1.5), (18, 2));

#poi['mapnik::geometry_type'=2][class='lensfocus'] {
  line-color: [param::main_color]; line-opacity: 0.45; line-width: @lens_w + 10;
  line-cap: round; line-join: round;
}
#poi['mapnik::geometry_type'=2][class='lens'],
#navigation['mapnik::geometry_type'=2][class='lens'] {
  line-border-color: [param::lens_case]; line-border-width: @lens_case_w;
  line-color: get([param::lens_pal], [k], #8D96A3);
  line-width: @lens_w + ([s] = 3 ? 1.5 : 0);
  line-opacity: [f] = 1 ? 1 : 0.35;
  line-cap: round; line-join: round;               // round: slices meeting at a bend leave no wedge
}
#navigation['mapnik::geometry_type'=2][class='lens'] {
  line-width: @directions_line_width;
  line-occlusion-opacity: @nav_occlusion_opacity;  // only here: it costs a pass per rule (navigation.mss)
}
// alert overlay: under the route line, so it reads as an outer casing
#navigation['mapnik::geometry_type'=2][class='navalert'][kind='fast'] {
  line-color: get([param::lens_pal], 'r3', #D7263D);
  line-width: @directions_line_width + 2 * @nav_border_width + 5;
  line-cap: round; line-join: round;
}
#navigation['mapnik::geometry_type'=2][class='navalert'][kind='steep'][zoom>=13]::chev,
#poi['mapnik::geometry_type'=2][class='lens'][lens='climbs'][s>=2][zoom>=13]::chev {
  marker-placement: line; marker-type: arrow; marker-line-width: 0;
  marker-width: 8; marker-height: 7; marker-fill: #ffffff; marker-allow-overlap: true;
  marker-spacing: [s] = 3 ? 13 : 26;               // the slice is oriented along the route: chevrons point the way
}
#poi[class='lsym'][sym='speed'][zoom>=12] {
  text-name: [t]; text-face-name: @mont_bd; text-size: 10; text-fill: #1b1c1d;
  text-background-fill: #ffffff; text-background-width: 22; text-background-height: 22; text-background-radius: 11;
  text-background-border-fill: get([param::lens_pal], 'sign', #D7263D); text-background-border-width: 3;
  text-placement: billboard; text-placement-priority: [p]; text-clip: false;
  [zoom>=16] { text-size: 12; text-background-width: 28; text-background-height: 28; text-background-radius: 14; }
}
#poi[class='lsym'][sym='grade'][zoom>=14] {        // navigation: '11 %' at the start of a very steep run
  text-name: [t]; text-face-name: @mont_bd; text-size: 10; text-fill: #ffffff;
  text-background-fill: get([param::lens_pal], [s] = 3 ? 'g7' : 'g6', #E34A33); text-background-radius: 5;
  text-background-padding-x: 4; text-dx: 22; text-placement: billboard; text-placement-priority: [p];
}
#poi[class='lsym'][sym='climb'][zoom>=11] {
  text-name: [t]; text-secondary-name: [t2]; text-secondary-scale: 0.8;
  text-face-name: @mont_bd; text-size: 10; text-fill: #ffffff;
  text-background-fill: get([param::lens_pal], 'plate', #2B2F33); text-background-radius: 4;
  text-background-padding-x: 5; text-background-padding-y: 2;
  text-vertical-alignment: bottom; text-dy: -6; text-placement: billboard; text-placement-priority: [p];
}
#poi[class='lsym'][sym='wx'][zoom>=9] {
  shield-icon-name: [icon]; shield-icon-face-name: [style.mapFontFamily] ?? @osm; shield-icon-size: 14;
  shield-icon-fill: get([param::lens_pal], 'w3', #4527A0);
  shield-name: [t]; shield-face-name: @mont_bd; shield-size: 11; shield-fill: #1b1c1d;
  shield-background-fill: #ffffff; shield-background-radius: 10; shield-background-padding-x: 6;
  shield-background-border-fill: [stale] = 1 ? #9aa0a6 : #ffffff; shield-background-border-width: 1;
  shield-placement: point; shield-placement-priority: [p];
  shield-text-opacity: [stale] = 1 ? 0.55 : 1; shield-icon-opacity: [stale] = 1 ? 0.55 : 1;
}
#poi[class='lsym'][sym='wind'][zoom>=11] {
  text-name: '↑'; text-orientation: [rot]; text-size: 14; text-face-name: @mont_bd;
  text-fill: #1b1c1d; text-halo-fill: #ffffff; text-halo-radius: 1.5; text-dx: 18;
}
```

The `navalert` and the navigation symbols live in the navigation layer's GeoJSON (emitted by
`NavigationRouteModule.draw`); for following a route without navigating they go to the items `poi` sub-layer with
the same rules (`#poi` duplicate of the two `navalert` selectors).

E-ink (`eink/style.mss` + an `::tick` attachment, empty on voyager): core black `@lens_w + 2`, ticks white 1.2
(`2, 7` s1 · `2, 3` s2 · `6, 2` s3; short, so never read as the long status dashes `20,12` / `8,8` / `3,9`); fast
alert casing = black dashed `3, 3`; plates black / white. Focus: no translucency (it dithers into noise, as
`eink/style.mss` notes for directions): `f = 0` slices 2 dp thinner without ticks, halo = dotted black band. Legends
show the tick patterns.

Verify list: comma selector across two layers in `css2xml`; `text-orientation` for a point label;
`shield-icon-face-name` with `[style.mapFontFamily]`; dasharray from an expression; `marker-spacing` reading a field.

### 6.6 Navigation layers and the alert overlay

- Slices go to `#navigation` under `#maneuver` in the shared lens. The maneuver arrow keeps its white fill + accent
  casing (no lens uses the accent). Speed signs grow to 28 dp at z ≥ 16.
- **Alert overlay** (decided): while navigating or following a route, whatever the lens, fast runs get the red
  outer casing + speed sign and steep runs ≥ 9 % (s ≥ 2) get chevrons + a grade plate at their start (`11 %`).
  Weather plates only with the Weather lens.
- **Travelled part greyed (decision: depends on perf)**: `NavigationRouteModule.draw` would split the route at
  `onPathIndex` and emit the part behind as `class='passed'` (grey `#9AA0A6`, 60 %, no arrows). Gate: re-split at most
  every 100 m of progress (not per fix); measure `setGeoJSON` + redraw on a low-end Android for a 100 km route with
  slices; ship only if the median cost is < 4 ms per update and no visible frame drop at 1 update / 20 s;
  otherwise drop it (the user arrow and the dock already say where you are).

### 6.7 Base style changes (massif style + `alpimaps-rules.mss`)

| # | Change | Why | Where / how | Cost |
| --- | --- | --- | --- | --- |
| B1 | Route focus: `routes` network lines 35 %, labels hidden while a lens ≠ Overview is active | its reds / purples / dashes compete with lens colours | `inner/shared/route.mss`: `line-opacity: [param::route_focus] = 1 ? 0.35 : 1` (param only: live) | none |
| B2 | **Fast-road context, optional** (decided): roads with `maxspeed ≥ fast_speed` get a 1 dp red outer casing at z ≥ 11 | shows where else fast roads are, to pick a detour; `maxspeed` is in the tiles (decision 01) | `roads.py`: `road-fast-casing` before `road` (not motorway, `param::fast_context = 1`). Toggle in map options and in the Road legend chip; default off | one re-decode per toggle |
| B3 | One-way chevrons from z15 (was 16), spacing 120 at z ≥ 17 (was 200), opacity 1 (was 0.8), `oneway_emphasis` 0/1/2; contraflow (hollow arrow) for bikes when tiles carry `oneway_bicycle = no` | decision 04 | `roads.py:373-386`; contraflow needs a cairn attribute | none / data PR |
| B4 | Separated cycleways teal (`#65AAA2`, as `surfaceColors.cycleway`), 1.5× at z ≥ 12 under the Road lens and in bike free follow | "separated" is the safe answer of the Road lens | `roads.py` `cycleway()` width × `param::cycle_focus` | re-decode on toggle (`line-width` is baked) |
| B5 | Dark map: dark casing, lifted palette | white casing glare | inner params | none |

---

## 7. Navigation and follow

### 7.1 Layout while navigating (phone, top → bottom)

1. Maneuver card (existing `ManeuverView`).
2. **Road-risk banner** (only within 400 m of a risky run or on it): 58 dp, r16, `colorPanel`, 2 dp `colorError`
   outline, 38 dp speed sign, title 15 bold `Fast road in 400 m` → `On a fast road`, sub 12.5
   `80 km/h · no cycle lane · 1.2 km left`, `✕` until the next run. Banner only (01.8): no sound, no vibration.
3. Junction chips when the travel-mode option is on (7.5).
4. Map with the **alert overlay** (6.6) and the lens.
5. Rail (existing `NavigationRail`) + **Route** button (`mdi-chart-timeline-variant`, 44 dp) → Route page in
   remaining-route mode (5.6).
6. **Dock** (replaces bar + trip + ahead as the collapsed state of the navigation sheet).

### 7.2 The dock

```
 ┌──────────────────────────────────────────┐
 │                  ───                     │ handle (drag up = existing sheet: actions, full profile, stats)
 │ 36.2 km │ +612 m │ 17:41 arr.      (⏸)  │ summary 40: remaining, ascent left, arrival, pause (tap / long press as today)
 ├──────────────────────────────────────────┤
 │ CLIMB · CAT 3 · CÔTE DU DÉSERT   1.8 km · +142 m to the top
 │ 7.4 %        ▁▂▃▅▆▇█  (climb, you are here)  │ data page 108, swipe ← →
 │ grade now                                │
 │ 11 % in 300 m                            │
 │                 ▬ • • •                  │ page dots 14
 └──────────────────────────────────────────┘    total 168 dp (today bar + trip + ahead = 264 dp)
```

- Summary row 40: three figures (19 bold + 12 unit) separated by hairlines, pause 40 dp (`colorPrimary`). The live
  line of today (`liveText`, `NavigationView.svelte`) moves into the pages (Climb shows "this climb", Profile the next
  event).
- **Data pages** (108 dp), swipe horizontally or tap the dots:

| Page | Content |
| --- | --- |
| **Climb** | grade now (30 bold, coloured by grade bucket), the current / next climb as a mini profile with your position, `1.8 km · +142 m to the top`, next steep `11 % in 300 m` |
| **Profile** | next 15 km: grade-coloured profile, attention marks (fast road, very steep, rain, dark), cursor at you, headline `↗ 455 m · 2 climbs · fast road at km 55.8` |
| **Ahead** | Next 2 h: 6 cells of 20 min (time, glyph, temp, wind relative to travel `↓18`, rain mm) + sun ribbon; freshness on the page title (`↻ 5 h old · tap to update`) |
| **Trip** | moving, done, average, climbed (today's trip card) |
| Surface (optional) | today's `NavigationSurface` |

- **Manual only for now** (decided): pages change only on swipe / dot tap; the last page is remembered
  (`navigationPage`). Auto-switching (Climb near a climb, Ahead before rain) is a possible later addition.
  Order and on/off in navigation settings (`NavigationSection.Display`), replacing `navigationShowElevationChart` /
  `navigationShowSurface` (`stores/navigationStore.ts:163-164`) with `navigationPages` (ordered list).
- Sizes: `navigationSections` (`utils/navigation.ts:44-54`) gets `dock = round((40 + 108 + 14 + 6) × scale)`
  replacing `bar` / `trip` / `ahead` as the first step; the next steps (actions, profile, stats) are unchanged.
- E-ink: no page-slide animation (snap), dots as outlined / filled squares.

### 7.3 Stale data while riding

Ahead page title `↻ 5 h old · tap to update` (refetch the remaining samples when online, else snack
`Offline: showing the 09:05 forecast`); the Route page (rail) offers the same update with more context. Weather plates
on the map (Weather lens only) fade. Navigation start never blocks. After a full reroute: index-keyed layers (risk
banner, climbs, alerts) are rebuilt from the new geometry when its profile exists, else hidden; weather / sun use
position lookup; the Ahead page shows `Route changed`.

### 7.4 GPS button with travel mode: the capsule

- Hidden when not watching / following. When watching, the round `#location` button (`MapScrollingWidgets.svelte:217-232`)
  grows a 46 dp **mode segment** on top: a 56×100 capsule, `colorMapControl`, hairline, elevation 0; e-ink 1.5 dp black.
- Tap the mode segment → **speed dial**: Walk, Bike, Car, `Auto · from route` (44 dp round, labels left), current one
  filled, plus a `Show turn options` switch; tap selects and closes; tap outside closes.
- The crosshair keeps its gestures exactly (tutorial zone `follow` unchanged).
- Navigating: the segment shows the route profile with a lock; tap → snack `Travel mode follows the route (bike)`.
- `Auto` = route profile when a route is selected, else `default_direction_profile`. Persisted `travel_mode`.
  Consumers: junction chips, contraflow look (B3), cycleway emphasis (B4), fast-road context if the user enabled it
  (B2), presets for a route-less "plan from here".

### 7.5 Free follow (no route) and junction chips

No analysis, no alert overlay (nothing to align it to). Capsule + junction chips (decision 04.5, chips only):
`◄ 90 m` `60 m ►` = next junction where turning is legal for the travel mode; a middle chip **only as an exception**:
`✋ No entry · 140 m` when the way ahead becomes one-way against you or ends (decision 04.4 made useful). Map stubs:
enterable = accent stub, forbidden = hatched stub + bar. Ship left / right first, the exception chip with the free-ride
look-ahead (R8c).

---

## 8. E-ink and accessibility

- **Never colour alone**: severity = colour + width + e-ink ticks; Road adds the speed sign; steep adds chevrons and
  the grade plate; weather plates carry numbers; the attention marks carry glyphs. Profile on e-ink uses the hatch
  helper (`utils/surfacePattern.ts`): diagonal = climb, cross = descent, dense = s3.
- **E-ink motion**: no hero collapse animation (two states), no dock page slide, cursor / hero update on release.
- **Font scale**: tiles drop second lines then icons; the lens bar scrolls; the insight row ellipsizes; the dock
  figures use `navigationScale` like today.
- **Screen readers**: lens chip `Road, 9.8 kilometres on fast roads, alert`; readout row reads all its figures; a
  departure cell `15:00, poor, rain 2 millimetres`; dock pages are a pager with page names.
- **Colour blindness**: Road amber / red differ in lightness and width; steepness also by chevrons and the profile.

---

## 9. Gestures and the tutorial (repo rule)

| Gesture | New? | Tutorial |
| --- | --- | --- |
| Drag on the profile / silhouette = scrub (map cursor + ETA + lens value) | extends the existing chart drag (`zone('chart', 'drag', …)`, place page) | update `gesture_chart_desc` (en + fr): "Drag along the profile: the map shows that point and when you get there. Tap the readout to clear it." |
| **Swipe the navigation dock** = next / previous data page | new | `navigation` page (`tutorialPages.ts:181-209`): replace the bottom card parts with the dock (summary row + a Climb page), add `zone('nav_pages', 'swipe', …)`; strings `gesture_nav_pages_title` / `gesture_nav_pages_desc` |
| Long press on the When pill = back to now | new on this screen (same as transit) | new page `route_page`: `zone('when_now', 'longPress', …)`, `gesture_when_now_title` / `_desc`, `tutorial_page_route_page` |
| Pull down on the Route page = update outdated data | platform idiom, purpose not obvious | `route_page`: `zone('refresh', 'drag', …)`, `gesture_refresh_title` / `_desc` |
| Taps (lens chip, readout clear, attention mark, ◀ ▶, Route rail button, capsule dial) | visible taps | none (`GestureKind` has no tap, `tutorialPages.ts:3`); the `navigation` page illustration gains the Route rail button and the `map` page the capsule (parts only) |

Strings in `app/i18n/en.json` + `fr.json`: `tutorial_page_route_page`, `gesture_when_now_title`, `gesture_when_now_desc`,
`gesture_refresh_title`, `gesture_refresh_desc`, `gesture_nav_pages_title`, `gesture_nav_pages_desc`; updated
`gesture_chart_desc`. The navigation page's existing `end_navigation` long-press zone moves with the pause button
into the dock summary row (same gesture, new position).

---

## 10. Implementation implications

### 10.1 New and changed pieces

| Piece | File | Notes |
| --- | --- | --- |
| Lens registry | `app/utils/routeAnalysis/lens.ts` | per lens: `available`, `chipValue`, `headline`, `sections`, `features`, `legend` — pure TS |
| Palette | `app/utils/routeAnalysis/lensPalette.ts` | light / dark / e-ink tables → `lens_pal`; legend |
| Feature builder | `app/utils/routeAnalysis/lensFeatures.ts` | slices, focus, symbols, nav alerts |
| Stores | `app/stores/routeLensStore.ts` (`route_lens`), `routeFocusStore.ts` | |
| Sheet | `app/components/bottomsheet/{LensBar,LensInsight,RouteLensCard}.svelte`; `RouteStatTiles.svelte` (4 tiles, D− line); `BottomSheetInner.svelte` `updateSteps` (`:536`) → `[0, 118, 424]`, Plan action | stats / OSM card rows leave the sheet grid |
| Route page | `app/components/routeanalysis/{RoutePage,RouteHeroMap,WhenPanel,DepartureStrip,ClimbsSection,RoadSection,WeatherSection,SunSection,SavedDataSection}.svelte` | pushed with `navigate({ page })` as `showItemsList` does (`MapScrollingWidgets.svelte`); pane on tablet |
| Chart | `ElevationChart.svelte` | `lens` fill modes (weather / sun: grade at 38 %), attention track, clock axis, silhouette mode; selected-point strip removed (readout lives in `LensInsight`) |
| Navigation | `NavigationView.svelte` (dock), `NavigationDock.svelte`, `pages/{Climb,Profile,Ahead,Trip}Page.svelte`, `RiskBanner.svelte`, rail button in `NavigationRail.svelte`, `utils/navigation.ts` sections | the trip card and the ahead row become pages |
| Navigation layer | `NavigationRouteModule.draw` (`:289-310`) | emits lens slices + `navalert` + symbols; `passed` behind the perf gate |
| Follow | `TravelModeCapsule.svelte`, `JunctionChips.svelte` | |
| Style | `inner/shared/routelens.mss`, `voyager.json` / `eink.json` (styles + params), `eink/style.mss`, `shared/route.mss` (B1) | one pass, rules per lens as they land |
| Base style | `massif-sdk/styles/massif/layers/roads.py` (B2–B4), cairn `oneway_bicycle` | other repos |
| Tutorial | `tutorialPages.ts`, `en.json`, `fr.json` | section 9 |

Nothing goes into `tools/` (`@shared`).

### 10.2 Roadmap vs first pass

| Release | First pass | v2 |
| --- | --- | --- |
| R1 Climbs | climbs + 5 tiles + GPX ask | climbs + **4 tiles** + **lens shell** (lens bar, insight / readout row, attention track) with Overview / Climbs / Surface, `routelens.mss` contract + palettes, GPX ask card, **navigation alert overlay for steep** |
| R2 | Route page + timeline + sun tier 0 | **Route page** (pushed, live hero map view, sections, When panel) + timeline + Sun lens (astronomy). Spike first: second map view memory / shared datasource (3.3) |
| R3 Weather | section + slider + table | Weather lens + section + departure strip |
| R4 Road risk | tile + section + banner data | Road lens + tile + section + speed signs + nav fast alert + B2 (optional) / B4 |
| R5 Map colour modes | one big style pass | **gone as a release**: each lens ships with its rules |
| R6 Navigation | outlook + banner + re-anchor | **dock + data pages** (Climb / Profile / Trip can ship before R3, Ahead after), risk banner, re-anchor, Route page remaining-route mode, `passed` behind the perf gate |
| R8b | tab on the GPS button | capsule + speed dial |

The dock (R6) does not depend on weather: Climb, Profile and Trip use data that exists today, so it can ship right
after R1.

---

## 11. Decisions from the review, and what is still open

Decided by the user on the first v2 draft:

1. **The Route page is a page of its own** (it opens from the items list). → hero = second map view (3.3).
2. **Default lens = last lens used.** → global `route_lens`.
3. **Navigation uses the same lens.**
4. **Fast-road context (B2): yes, optional.** → map option + legend chip, default off.
5. **Travelled part greyed: depends on perf.** → gate in 6.6.
6. Navigation must show grade / steep before weather, and use less room for remaining km / ascent → dock (7.2).
7. Elevation tile: D− under D+ in a smaller font, no profile drawing in the tile (5.1).
8. Weather (and Sun) lens: keep the profile visible, fainter (4.1).
9. The point highlight must not cover the chart, and tapping it clears it → readout row (4.3).
10. While following / navigating, steep and fast roads are marked on the map, weather only in its lens (6.6).
11. Navigation needs a quick way to the route page → rail button + remaining-route mode (5.6).

12. **No still-image hero**: the hero is always a live map (3.3).
13. **Dock pages are manual for now** (7.2).

Still open, from the first pass, unchanged: road-risk speed source order (8.1), navigation ETA switch (8.2), weather
   auto-refresh default (8.3).
