# weather-core: plan

Shared pure-TypeScript package between alpimaps and oss-weather: sun/moon, unit conversion, WMO weather-code semantics, Open-Meteo wire layer. Plan only: nothing created, no app code touched. Read on 2026-11-06 against alpimaps `feat/route-page-when-weather-polish` and oss-weather `main`.

## 0. What is really there

| | alpimaps | oss-weather |
|---|---|---|
| suncalc | **2.1.1** (`package.json:139`): degrees, azimuth from north, ships own types | **1.9.0** (`package.json:105`): radians, azimuth from south; `@types/suncalc` |
| moon | `app/utils/astronomy/moon.ts` (+test): 8 MDI glyphs, `isNight`, `nightMoon`. No hemisphere flip. Branch only, not on `master` | `app/helpers/moon.ts` (+test): `getMoonPhase` 0..28, degrees (Gadgetbridge), illumination %. `moonIcon` in `app/helpers/formatter.ts:297-411` = 29 `wi-moon-*` names, flips for `lat < 0` |
| astronomy UI | `AstronomyView.svelte`: own `getMoonPhaseIcon` with `Math.round(phase * 7)` over 8 icons (uneven buckets, a latent bug) | `AstronomyView.svelte`: `* TO_DEG + 180` on every suncalc-1 azimuth; phase names via `getMoonPhaseName(age)` fed a 0..28 index against day-of-cycle thresholds |
| sun | `getTimes` in `departureStrip.ts`, `WhenPanel.svelte`; `getPosition` in `CompassView.svelte`, `peakFinderSun.ts` (`sunPositionAt`), `peakFinderMoon.ts` (`moonPositionAt`) | `getTimes` `services/api.ts:334`, `getTimes/getMoonTimes` `services/gadgetbridge.ts` |
| units | `app/helpers/units.ts` (enum, **runtime registry** `registerUnitFamily`), conversion in `app/helpers/formatter.ts:101-285`, weather families + `weatherFormat` in `routeFeatures/weather/ui/format.ts`, pure `METRIC_FORMAT` in `data/format.ts` | `app/helpers/units.ts` (enum, static `AVAILABLE_UINTS`), `convertValueToUnit` `app/helpers/formatter.ts:42-260`, `app/utils/weather/valueUnit.ts` (only `splitValueUnit`) |
| icons | `wxGlyph` in `routeFeatures/weather/data/read.ts:45`: WMO code (+cloud %, +moon glyph) to **MDI glyph** (map labels have MDI). `css/weather-icons/` scss is unreferenced | WMO to **OWM id** (200..804) in `services/providers/omIcons.ts`; the id picks an **image pack** (SVG/PNG/Lottie, `svgs/weather-conditions`, remap chain in `services/icon.ts`). Fonts `ossweather*.ttf` (iconotype, `codepoints.lock`) are **UI/data glyphs, not weather conditions**; the `wi` font only serves moon + wind |
| forecast | `routeFeatures/weather/providers/openMeteo.ts` (129 lines, pure, tested): multi-point, 10 hourly vars, `WeatherProvider` contract in `provider.ts` | `app/modules/providers/openmeteo/om.ts` (756 lines): single location, hourly/daily/current/minutely/AQI/marine, **imports `ApplicationSettings`, `lc`, `weatherDataService`, `request`**; wire types `openmeteo.d.ts`; only `tideExtremes`/`openMeteoMarineData` are testable (the test mocks 10 modules) |
| `tools` | submodule `Akylas/app-tools`, **pinned at different commits** (`2adedf1` vs `5b776bf`); both `"@akylas/nativescript-app-tools": "portal:tools"`; UI-heavy, imports back `~/`; also carries the toolchain deps and `release_*.yml` reusable workflows | same |

### Drift that matters

- **suncalc major version** is the first blocker: sharing any sun/moon code means oss-weather moves to 2.1.1 and its radians math is rewritten.
- Units: `UNITS.Celcius` is `'°C'` (alpimaps) vs `'°'` (oss). Family ids differ (`temperature`/`precipitation` vs `temp`/`prec`) and **are persisted** in `SETTINGS_UNITS` JSON on devices. oss has `UV`, `IconId`, `FPS`, `SpeedMS`, `forceUnit`, `digits`, `unitCMToMM`, `metricDecimalTemp`, 0.5° temperature rounding, `join = ''` for Celsius; alpimaps has none of them. Same code, different results: MM to CM threshold `value < 1` vs `value < 100`; metres to feet rounds to **2 decimals** in alpimaps (`digits = 100`) vs integer in oss. alpimaps registers families at **import time** of `units.ts` and `weather/ui/format.ts`; oss has static tables. oss `helpers/` has no unit test, alpimaps `units.test.ts` covers the registry only.
- Weather codes: alpimaps 1 (mainly clear) is *partly cloudy*, oss 1 is clear (800). alpimaps 56/57/66/67 (freezing) is *snowy-rainy*, oss maps them to plain rain ids (300/310/502/504). alpimaps lets cloud cover override codes 0..3.
- Moon: 8 northern-style glyphs everywhere vs 29 steps flipped in the south.
- Forecast: different shapes on purpose (route sampling vs a place's page); only the wire layer is common.

## 1. Where it lives and how it is consumed

**Decision: a new public repo `Akylas/weather-core`, added as a submodule at `weather-core/` (next to `tools/`) in both apps. Consumed by alias on the source, no Yarn dependency.**

Why a new repo:
- `tools/` is rejected. Its content is UI + build toolchain; its `tsconfig`/`package.json` are app-oriented and `sync.mjs` merges fields into the consumer's `package.json`; it is pinned by apps beyond these two, so every core change would travel to all of them. A pure boundary cannot be held inside a tree whose files import `~/`.
- npm package is rejected. Each change would need version, publish, bump, `yarn install` (lock churn) in two apps, and local iteration still needs a `portal:`. Revisit only if a consumer outside this family appears.
- Repo public: oss-weather builds in the `ossappscollective` org via `ossappscollective/app-tools` reusable workflows, whose `actions/checkout` uses `submodules: recursive` with the default token. A private repo would break checkout there. (oss-weather's `tools` already points at `Akylas/app-tools` publicly.) CI needs no change: the new submodule is fetched by the existing `recursive`.

Wiring, same pattern as `@shared`:
- `tsconfig.json` `paths`: `"@weather-core/*": ["./weather-core/src/*"]`; `include` gets `weather-core/src/**/*`. (oss `exclude` already drops `app/**/*.test.ts`; add `weather-core/src/**/*.test.ts`.)
- webpack: `config.resolve.alias['@weather-core'] = resolve(__dirname, 'weather-core/src')` next to `@shared` (`alpimaps/app.webpack.config.js:399-400`, `oss-weather/app.webpack.config.js:241-242`). The TS rule only excludes `/node_modules/` (`:554` in alpimaps), so a folder outside it is compiled like `tools/app`; confirm in step 1 with a device build.
- vitest: alias `@weather-core` + add `weather-core/src/**/*.test.ts` to `include` in both `vitest.config.mts`. Run from either app: `./node_modules/.bin/vitest run weather-core`.
- **No `portal:` dependency.** `portal:tools` exists to install tools' deps; weather-core has none (suncalc is a `peerDependency`, `^2.1.1`, so one copy, the app's). Not adding it means no `yarn.lock` entry, no `yarn install` per bump, and the "Yarn rewrites `yarn.lock`" trap is not triggered. Resolution of `suncalc` from `weather-core/src` walks up to the app's `node_modules` because the submodule sits inside the app tree.
- Traps: never run `yarn install` inside `weather-core/` (Yarn 4 would claim the parent project or create a second `node_modules` with a second suncalc). The repo ships an empty `yarn.lock` + `.yarnrc.yml` (`nodeLinker: node-modules`) so its *own* CI can install; locally always test through an app. `./node_modules/.bin/<tool>`, never `npx` (repo rule). Drop `@types/suncalc` in both apps when they reach 2.1.1 (2.x ships `index.d.ts`).

Release and pickup:
1. Commit + push in `weather-core` (`main`, tag `vX.Y.Z` for humans, the submodule pointer is what counts).
2. In each app, the **pointer bump and the code using it go in one commit** (`git add weather-core`), pushed *after* the core commit exists on the remote, or CI cannot fetch it.
3. Additive changes: apps may sit on different pointers (as with `tools` today). Breaking change: core change + one PR per app, merged together; say so in the core commit body. Core PRs run its vitest + boundary test (below) in its own GitHub Action.
4. Core commits follow the repo's Conventional Commits; the app commit that bumps it is `chore(weather-core): …` or the feature commit itself.

## 2. Boundary, injection, tests

Rule: files in `weather-core/src` may import **only** relative files of the package, `suncalc`, and standard JS. Never `@nativescript/*`, `svelte*`, `~/`, `@shared/`, `dayjs`, `ApplicationSettings`, `lc`. Time is epoch ms / `Date`; zones are an offset in minutes passed in (suncalc 2 `getTimes(date, lat, lon, height, utcOffset)` supports it). No `DEV_LOG`/`PRODUCTION` globals, no module-level reads of settings, **no import-time side effects** (the registry is created by a factory, not filled on import).

Enforced by (a) `eslint no-restricted-imports` in the package's config, (b) `boundary.test.ts` that reads every `src/**/*.ts`, extracts import specifiers and fails on anything off the allow-list or any `vi.mock` in a core test (a needed mock means the boundary leaked). Both run from either app.

Injection, by example:
- Words: core returns **keys** (`'waxing_crescent'`), the app does `lc(key)`. No strings for users in core, except unit symbols, which are data.
- Units: `createUnits({ unitOf: (family) => UNITS })`. The app owns persistence (`unitsSettings`, `imperialUnits`) and passes a resolver; core never reads settings.
- Format hooks: `{ join?: string, decimals?: …, tempRoundTo05?: boolean }` options on the converter instead of the globals `metricDecimalTemp` / `unitCMToMM`.
- Tests: core has its own `*.test.ts` next to the code (repo's "tests next to the module" rule). Red-first per step; characterization tests are copied from **both** apps before any adoption.

## 3. Modules

### 3.1 moon / sun (`src/astro/`)

Moves: `moon.ts` as is (`MOON_GLYPHS`, `moonPhaseGlyph`, `moonIllumination`, `isNight`, `nightMoon`), plus new neutral API:
- `moonPhase(date): { phase, fraction, key }` (`key` among the 8 names; thresholds on `phase`, **not** the day-count mix oss has today),
- `moonPhaseIndex(date, steps, lat?)` (steps 8 or 29; flip when `lat < 0`),
- `moonPhaseDegrees(date)` (Gadgetbridge), `sunTimesAt`/`moonTimesAt` thin wrappers over suncalc 2 (`utcOffset`, `rise`/`set` possibly missing), `sunPosition`/`moonPosition` (already identical `{azimuth, altitude}` in `peakFinderSun.ts`, `peakFinderMoon.ts`).

Apps keep: MDI glyph strings (`MOON_GLYPHS` is an alpimaps font concern; core exports indexes, alpimaps keeps its 8 code points), oss's 29 `wi-moon-*` table and `moonIcon`, all drawing (`AstronomyView`, charts, `CompassView`), and the Massif sky layers (`peakFinder*`, `sky/astronomy.ts` is sky-sphere math, not weather: stays).
Who wins: alpimaps' suncalc 2 degrees semantics; oss adapts. Hemisphere flip taken from oss (alpimaps gets it: behaviour change, intended). alpimaps `getMoonPhaseIcon` (`phase * 7`) is replaced by the core index.
Risks: oss suncalc upgrade touches `AstronomyView.svelte` (altitudes were radians: `highlight.entry['altitude'] * TO_DEG` at line 356, the chart datasets, `+ 180` azimuths), `services/api.ts:334`, `services/gadgetbridge.ts` (`getMoonTimes(date, lat, lon, true)`: check the 2.x signature). `gadgetbridge.test.ts` and `moon.test.ts` exist and must stay green; AstronomyView needs a side-by-side visual check.

### 3.2 units (`src/units/`)

Moves: `UNITS`, `UNIT_FAMILIES`, `celsiusToFahrenheit`, `convertValueToUnit` + `defaultUnitForUnit` + `toImperialUnit` as a **superset** (oss's options, default-off so alpimaps keeps its output), `formatValueToUnit`, `createUnitRegistry()` (the alpimaps `registerUnitFamily` shape, as an instance), `splitValueUnit`.
Stays in apps: persistence/settings (`variables.ts`: `unitsSettings`, `imperialUnits`, `onUnitsChanged`), `unitOfFamily` binding, `weatherFormat` (alpimaps: bound to the app's settings, plus `METRIC_FORMAT` could move to core as the default).
Decisions needed (see Q3, Q4): `'°'` vs `'°C'`; family ids; feet decimals; MM to CM threshold. Default proposal: enum values = alpimaps' (`'°C'`), oss display keeps `'°'` through its adapter (`join ''`, symbol) and migrates the stored value on read; family ids are **opaque strings registered by each app** so persisted ids never change (core's shared factories take the ids as arguments).
Risks: silent output changes (feet, cm). Mitigation: characterization tests pin each app's current output over a value grid before the swap, and the core options reproduce both.

### 3.3 icons (`src/weather/conditions.ts`)

Not a font: neither a shared codepoint table nor shared font files. oss's weather icons are an **image pack by OWM id**; alpimaps needs **MDI** (in the map's own font). A shared font would force alpimaps to embed another TTF and break the "labels have MDI for sure" rule; the oss `codepoints.lock`/iconotype is append-only for **UI glyphs** and unrelated.
Decision: core owns the semantics, each app owns the picture.
- `wmoCondition(code): { sky, intensity, freezing, thunder }`, distinct for every WMO code Open-Meteo returns (0,1,2,3,45,48,51..57,61..67,71..77,80..82,85,86,95,96,99),
- `skyFromCloud(code, cloudPct, thresholds)` (alpimaps' cloud override, thresholds 20/60 as parameters),
- adapters: oss `omIcons.ts` = condition to OWM id (unchanged outputs, including code 1 to 800 and freezing to rain), alpimaps `wxGlyph` = condition to MDI (unchanged outputs, 1 to partly, freezing to snowy-rainy, moon glyph taking the sun's place).
Who wins: nobody; the neutral type is finer than both and each adapter reproduces its current output. Convergence (e.g. oss showing freezing as sleet) is a later, separate choice.
Risks: a missed code silently falls to default; `icon.test.ts` and `read.test.ts` (`wxGlyph`) stay untouched and green as acceptance. oss `metar/report.ts` also calls `convertWeatherCodeToIcon`.

### 3.4 forecast (`src/openmeteo/`)

Smallest and riskiest; **wire layer only**: Open-Meteo hourly/daily/current/minutely wire types (from `openmeteo.d.ts`), `OpenMeteoModels` list, the URL builder for a variable list and N points (the alpimaps `openMeteoUrl` generalised), the pure response sanity checks (`isLocation`, same-hours check), `tideExtremes`, `keptDayCount`.
Not moved: alpimaps' `WeatherProvider` contract (route sampling, quantised int series) and oss's `OMProvider` (settings, `lc`, services, AQI, marine). They have different consumers; merging them would drag NativeScript or the route pipeline into core.
Each app keeps its mapper to its own model (`WeatherResponse` / `Currently, DailyData, Hourly`).
Risks: oss `om.ts` is long and its test mocks ten modules; extraction = moving pure functions out, then deleting those mocks. Free-quota behaviour (429/400) stays in the app that does the fetching.

## 4. Migration order

Each step is one PR per app, shippable alone. Acceptance in **both** apps unless stated: `yarn svelte-check`; `./node_modules/.bin/vitest run` (all, plus `weather-core`); eslint on touched files; manual device run (alpimaps: emulator per the repo's run notes; oss-weather: `ns run android`).

| # | Step | Needs user | Safe first? | Acceptance beyond the common checks |
|---|---|---|---|---|
| 0 | Create `Akylas/weather-core` (skeleton: `package.json` with `suncalc` peer, `tsconfig`, eslint restriction, `boundary.test.ts`, README, CI that runs vitest). Done by the user or on request | Q1 | yes | `boundary.test.ts` green in a throw-away alias checkout |
| 1a | alpimaps: add submodule + aliases (tsconfig, webpack, vitest) and **move** `moon.ts` + test (needs that branch merged first, it is not on `master`). Keep a one-line re-export at the old path until callers are updated, then delete | none | yes | svelte-check, vitest, **device build proves the webpack alias**; manual: When panel moon header, weather plates after dark, strip, profile unchanged |
| 1b | oss-weather: add submodule + aliases; upgrade suncalc to 2.1.1; rewrite `AstronomyView`, `api.ts`, `gadgetbridge.ts` to degrees/north-azimuth; `helpers/moon.ts` re-exports core + keeps `getMoonPhase` 0..28 as `moonPhaseIndex(date, 29, lat)` | Q2 | after 1a | `gadgetbridge.test.ts`, `moon.test.ts` green; manual: Astronomy page compared before/after (sun/moon curves, azimuth labels, rise/set), Gadgetbridge payload diff over a few dates and a southern location |
| 1c | alpimaps `AstronomyView`: use core phase index (fixes `phase * 7`), add hemisphere flip | none (small behaviour change, flagged) | after 1a | manual: icon at known new/quarter/full dates; southern location mirrored |
| 2a | core `units/`: write **characterization tests from both apps first (red/green rule)**, then the superset converter and registry factory | Q3, Q4 | tests only: yes | tests pin both apps' current outputs over a value grid (mm/cm/in, m/ft/mi/km, km/h/mph/kn/ft/s/m/s, °C/°F) |
| 2b | alpimaps adopts units (`helpers/units.ts`, `formatter.ts` wrappers, `weather/ui/format.ts` register through the factory) | Q3, Q4 | no | its `units.test.ts` and weather format tests untouched; manual: Settings units screen, weather plates in °F/mph/in, elevation in ft |
| 2c | oss adopts units; settings migration for `'°'` if chosen | Q3, Q4 | no | manual: every units option in Settings, hourly/daily cards, chart labels, stored settings from an existing install keep working |
| 3a | core `weather/conditions.ts` with a table test over every WMO code; add an oss `omIcons` test first (none today) | Q5 | tests only: yes | table test; adapters' outputs equal the old ones for all codes |
| 3b | alpimaps `wxGlyph` and oss `omIcons.ts` become adapters | Q5 | no | `read.test.ts`, `icon.test.ts` unchanged and green; manual: icons on the route page and weather page |
| 4 | forecast wire layer: types + model list + URL builder + pure helpers | Q6 | optional, after 3 | `openMeteo.test.ts`, `om.test.ts` green; **delete** `om.test.ts`'s `vi.mock` list as far as the moved code allows; manual: fetch once in each app |
| 5 | Issue #218 moon items on top of core (below) | none | after 1a | per item |

Each core change: bump pointers in the same commit as the first caller. Keep steps 1a-1c separate from 2: units carry the only real regression risk.

## 5. Akylas/alpimaps#218 (route analysis 8/11: sun & shade)

Lives in weather-core (pure, suncalc only):
- `[x]` `app/utils/astronomy/moon.ts` (phase glyph, illumination, `isNight`, `nightMoon`): step 1a moves it.
- `[ ]` "moonlit" level between dark and sun: a pure classifier `skyLight(at, lat, lon, { moonMinAltitude, moonMinIllumination })` (moon up and bright enough). The *setting* and the lens colour stay in alpimaps.
- `[ ]` moonrise / moonset next to sunrise / sunset, moon azimuth for the "sun side" row: `moonTimesAt`, `moonPosition`, `sunTimesAt` wrappers (3.1). The sunset plate and the section UI stay in alpimaps.
- `[ ]` 3D night light from the moon: pure `moonlight(phase/fraction, altitude): 0..1`; the rendering (SDK/three) stays in alpimaps.
- `[ ]` "Share the moon / sun helpers with oss-weather": this plan.
- Tier 0 sun along the timeline (dark, glare, sun side, sunrise/sunset vs ETA): the per-sample sun maths (`sunPosition`, glare as angle between a bearing and the azimuth) can be core; the timeline (`utils/routeAnalysis/timeline`) and lens are alpimaps. Add only if oss-weather will use them: otherwise keep in alpimaps.

Stays in alpimaps: massif-sdk batch API / `SunData.lit`, sun lens, profile bands, route sun mode, settings, tutorial strings.

## 6. Open questions

1. **Org and visibility**: `Akylas/weather-core`, public (recommended: oss-weather CI is in another org and checks out submodules with the default token). Or `ossappscollective/weather-core`? Or private with a deploy key (changes both release workflows in `app-tools`)?
2. **oss-weather suncalc 1.9.0 to 2.1.1**: OK to upgrade and rewrite its astronomy maths (recommended, nothing sun/moon can be shared otherwise), or should core wrap suncalc 1 semantics (no: alpimaps would lose its degrees)?
3. **Which behaviour wins in the unit converter**: alpimaps' (feet to 2 decimals, MM to CM at `< 1`) or oss's (integer feet, `< 100`)? Elevation in feet would visibly change in one of the apps.
4. **Persisted ids**: oss family ids `temp`/`prec` and unit `'°'` are stored on devices. Keep each app's ids (opaque, no migration; recommended) or unify on alpimaps' with a one-time migration in oss?
5. **Icons**: confirm the sharing stops at weather semantics (`wmoCondition`) with each app mapping to its own picture (oss image pack by OWM id, alpimaps MDI), and that no shared font or codepoint file is wanted.
6. **Forecast**: wire layer only (recommended), or also converge the two provider shapes later (alpimaps route sampling vs oss place page)? Decide after step 3.
7. **Moon glyph in alpimaps**: accept the southern-hemisphere flip and the 8-bucket fix (small visible change), or keep today's rendering?
