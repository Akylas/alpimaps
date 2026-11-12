# Route features — investigation summary

Five separate investigations, one report + one HTML mockup each (open the `.html` in a browser).
Nothing here is implemented. Performance figures are estimates unless stated.

| # | Feature | Verdict | First slice |
| --- | --- | --- | --- |
| 01 | [Road risk](01-road-risk.md) ([mockup](01-road-risk.html)) | Feasible, M | Spike on offline `speed_limit` coverage, then `roadRisk.ts` + header tile |
| 02 | [Steep sections](02-steep-sections.md) ([mockup](02-steep-sections.html)) | Feasible, cheap (8-11 d total) | `steep.ts` detector on existing `profile.data[].g` + stat tile + list card (~2 d) |
| 03 | [Weather along route](03-weather-along-route.md) ([mockup](03-weather-along-route.html)) | Feasible, M, no native code | One "weather" card: departure pill, ±3 h slider, early/on-time/late table |
| 04 | [Wrong-way roads](04-wrong-way-roads.md) ([mockup](04-wrong-way-roads.html)) | Feasible, but style alone can't do "first junction I can turn left" | Bolder one-way chevrons from z15 (S), then nav-mode entry overlay (M) |
| 05 | [Sun / shade](05-sun-shade.md) ([mockup](05-sun-shade.html)) | Tiered | Tier 0: sunrise/sunset, dark, glare (S) |

## Cross-cutting findings

- **Shared departure time + per-point ETA model** (03, 05, 01/02 navigation warnings). Today ETA is a
  constant average speed (`utils/navigation.ts:669`), GPX routes have no timings, and the departure picker
  exists only for transit. Build one `RouteTimeline` (distance → ETA) and one departure control first.
- **Shared sampling pipeline** (03, 05): per-point samples along the route with bearing, elevation, ETA.
- **Valhalla `trace_attributes`** feeds 01 and 04 (offline = same JSON as online). `PackageService.getStats`
  already calls it; the existing fetch has defects to fix first: web path hard-codes `costing: 'pedestrian'`
  (`NetworkService.ts:564`), sheet/navigation fetches pass no profile, `max_shape` 16000, and stats are
  opt-in (`auto_fetch_stats` false).
- **Map overlays need rules in the `inner` styles** (01, 02, 03). Source is in-repo:
  `dev_assets/styles/inner/{shared,voyager,eink}` (01's report says it is not in the repo — it is; verify
  the zip rebuild path). 04's one-way chevrons live in `massif-sdk/styles/massif/layers/roads.py:373` /
  `alpimaps-rules.mss` instead. Do all overlay rules in one pass, including e-ink variants.
- **Derive on read, don't persist** (01, 02): pure `app/utils/*.ts` modules, no migration, thresholds
  re-apply. This also fits the repo advice to keep logic testable outside NativeScript.
- **Header space**: 01, 02, 05 each want a stat tile. The route header is 86 + 48 dp; a 5th/6th tile or a
  second row breaks it. Decide one pattern (e.g. a "route insights" card behind a single tile).
- **E-ink**: hatching for profile bands is promised in the design README but not implemented for the profile.
  02, 01, 05 all need it — build once.
- **Gestures tutorial rule** applies if 04 adds long-press on chips.

## Risks that need a decision

1. **Open-Meteo licence (03)**: free tier is non-commercial; the app has `nativescript-inapp-purchase`.
2. **SDK / other repos**: 01 `default_speed` patch (3 lines), 04 free-ride graph look-ahead (L),
   05 batch horizon method. All in `massif-sdk`.
3. **Accuracy honesty**: 01 untagged roads are estimates; 04 graph ignores turn restrictions (wrong
   "allowed" hint is worse than none); 05 terrain-only shadows overstate sun in forests.
4. **Privacy (03)**: route geometry sent to third party; proposed round to 2 decimals, send on tap.

## Suggested order

1. **02 steep** — all data exists, ~2 d, proves the "derive on read + stat tile + chart band" pattern.
2. **Foundation**: `RouteTimeline` + departure control + fix stats-fetch defects.
3. **05 Tier 0** (sun position only) and **03 weather card** on that foundation.
4. **01 road risk**: spike offline coverage first; go/no-go on the numbers.
5. **04 slice 1** (style chevrons) any time — independent; nav overlay later.
6. Map overlays for 01/02/03 in one style pass; then 05 Tier 1 (terrain shadows, needs SDK batch method).

## Open questions (consolidated)

**Product**
- Thresholds: steep (road 8/12 up, 10/14 down proposed), road risk (70 km/h, 200 m proposed). Per bike type?
- Imported GPX/tracks: which profile preset? Include in 01?
- Count estimated (untagged) speeds as risk? Painted lane = medium?
- Default departure time; persist the ±shift? Pace/stop multiplier? Multi-day routes in v1?
- Bike only for 04 v1, or walk/bike/car? Free-ride (no route) required in v1?
- "Wrong way" banner in 04? Straight-on exits too, or only left/right?
- Hiking or cycling first for 05? Forest estimate: native landcover query or skip?
- Navigation warnings: banner + haptic only, or sound? (No sound/vibration in navigation today.)

**Technical / policy**
- Is the store build "commercial" for Open-Meteo? Else proxy/other provider.
- OK to plan changes in massif-sdk / cairn (01 patch, 04 look-ahead, 05 batch horizon)?
- Header: 5th tile, second row, or a single "insights" tile?
- Descent colour (02 used violet); hatching on e-ink profile in scope?
- Filter bridges/tunnels via Valhalla for steep detection?
- Time zone for sun display; time model proportional vs grade-aware pace.
