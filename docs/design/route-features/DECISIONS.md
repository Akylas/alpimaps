# Decisions from the user (verbatim answers, after round 1 of investigation)

Numbers refer to the numbered open-questions lists the user was shown (final messages of each agent;
see also the "Open questions" sections of each report). Where the numbering is ambiguous, map by meaning.
Source of truth = this file. Written by the user in chat; everything else in this folder is model output.

## Road risk (01)
Opening remark: the offline generated vector tiles used in the app **already carry `maxspeed` on the
transportation layer**. Use that to base the risk really on speed. Also add a **max-speed indicator on the
route "style"** for sections whose speed is too fast.

1. Compute together with the stats fetch.
2. Only on a computed route (not GPX/tracks). Meaningful only for bicycle for now.
3. Speed from the offline tiles as said; otherwise only the tagged limit (no estimation table).
4. "Painted lane counts as medium?" -> the user means: lanes where there is **no hard separation** between
   cars and bicycles are the risk. OK to **add data to the tiles**; we can create a PR on **cairn**.
5. Thresholds configurable. Default speed 70 km/h. Sections < 200 m are still dangerous (do not drop them
   at 200 m; min length should be much smaller / configurable).
6. SDK `default_speed` patch: if it is better than what the tiles give, why not.
7. Only for the **selected route**. The `inner` style source is in `dev_assets` (in this repo).
8. Navigation warning: **banner only**.
9. **5th stat tile**. D+ and D- can be merged into one tile (seen in the mockups) to free room.

## Steep sections (02)
1. Yes, pedestrian too, with different thresholds. Make them configurable.
2. Imported tracks (GPX) have no route type: **ask the user** (hiking / cycling) when the analysis needs a
   preset, then remember the choice on the route; switchable later on the route page.
3. See if it can be merged with D+ / D- in one tile.
4. No warning for descents. Show only on profile, or even only in the list of sections.
5. No navigation warning at all.
6. Overlay over the selected route, also in navigation, as designed (grade / profile / steep ...). Visible
   on the profile. Step sections must be **collapsible**.
7. Yes.
8. Yes, we want people coming from Strava to understand (climb categories etc.).
9. Yes.
10. Yes.

## Sun / shade (05)
Likes tier 1b (draw shadows in the 3D view). Wants: a **map mode that automatically sets date/time/shadow
from the computed route** (departure + ETA); with the weather forecast job, use **cloud cover to set shadow
strength**. Also wants to **add features to massif (SDK) to actually compute shadows (mountains only, no
buildings) offline for the route**, giving stats and a profile ribbon. **Must be fast** and take departure +
ETA into account.

1. Yes (SDK addition acceptable).
2. Sun stat as a **separate section only** (not a tile) unless the unified-design agent finds a nice way to
   fit all tiles.
3. Time model: proportional to distance for now; see if the weather job can add something reusable.
4. SDK.
5. Not sure: do whatever is best.
6. Everything computed is **persisted**, for offline use afterwards.
7. Not wanted for now.
8. Both hiking and cycling, with different thresholds.
9. Use the **route's time zone**.

## Weather (03)
1. Follow Open-Meteo terms fully. The in-app purchase is **only a donation** (iOS forces it).
2. Departure: last chosen per route, or "now" if that is in the past.
3. Yes (pace/stop multiplier).
4. Yes, multi-day... (user answered "yes add it" to the item).
5. Out of scope for v1.
6. Yes: round to 2 decimals + a setting.
7. Route sheet only **plus a new route page** (not designed yet).
8. Add **dedicated** weather map style rules.
9. For now everything in-app. Later the user will make an npm plugin for the weather fetching, shared by
   their `ossweather` and alpimaps -> keep the provider behind a clean interface.

## Wrong-way roads (04)
1. All modes (walk / bike / car).
2. Free-ride required if not too big (yes if not too big).
3. Yes (planning changes in massif-sdk and cairn is OK).
4. Does not understand "straight-on continuation" (= showing whether you can also continue straight / which
   exits besides left and right are enterable). Needs an explanation + recommendation.
5. Chips only.
6. No banner needed ("no, we can add it" = can be added later).
7. Yes.
8. Travel mode: **explicit and easy to switch**; could be useful for other features. Try to **augment the
   GPS follow button** to carry it.

## Cross-feature requests (new agents)
- One agent must take all features into account and design **how everything mixes in the app design**,
  including **map style**.
- Think about **usage of all data while navigating / following a route**: the user may have saved/computed the
  data earlier and left hours later. Still show timely data but make **clear when data is out of date**, with
  a way to **update**.
- Idea: a **new page for a route** with departure etc. where one computes/sees all stats. It could also
  **save a route you did with its data attached** (weather, ...) — done afterwards, past weather can be
  fetched.
