# Migrating to the MassifMaps surface API

The app talks to the map through **one** import — `@nativescript-community/ui-massifmaps/api`.
Nothing else from the plugin is imported: no `core`, no `layers`, no `datasources`, no
`geometry`, no `vectorelements`, no `routing`, no `search`, no `geocoding`, no `utils`, no `ui`.

This page is the log of what that migration changed, what it made possible, and what is still
worth doing. It is written for the next person who has to touch this code, so it records the
*reasons*, not just the diffs.

## Building it: the SDK has to be a local one

The facade API is **not in any released MassifMaps**, so the `massifSDKVersion = "6.0.0"` in
`App_Resources/Android/before-plugins.gradle` cannot serve it — the app starts and the plugin says
*"this MassifMaps build has no surface API"*, which reads like a broken build and is not. Build
against the checkout instead; `settings.gradle` already has the wiring:

```sh
DEBUGMASSIF=1 MASSIF_SDK_HOME=/Volumes/dev/carto/mobile-sdk ns build android
```

Drop both variables once an SDK carrying `all/native/api` is published and bump `massifSDKVersion`.

## The three rules everything below follows

1. **A position is a plain object or a plain array.** `{ lat, lon }` inside the app,
   `[lng, lat]` at the API boundary. There is no `MapPos` proxy, no `MapPosVector`, no
   `fromNativeMapPos`. Conversion helpers live in [`app/utils/geo.ts`](../app/utils/geo.ts).
2. **One crossing, not one per element.** Anything the app used to walk element by element —
   route maneuvers, geocoding results, a feature's geometry — comes back as one JSON or one flat
   number array. Where the SDK could not do that yet, the SDK gained a method rather than the app
   gaining a loop.
3. **A source is a spec until it is built.** Composing sources (merge, order, cache, multi) is
   nesting JSON, not constructing objects and holding handles. Only what the app must reach again
   later — a cache it downloads into, a decoder it writes parameters on — gets an id.

## What moved from the app into the SDK

Each of these was app code walking a native object one property at a time, or doing by hand what
the SDK could do in one call. They are SDK methods now, so every binding gets them and the app got
shorter:

| Was, in the app | Is now |
|---|---|
| `instructionsFromResult` looping `getInstruction(i)` and reading 8 fields off each | `routingResult.get('instructionsJSON')` — one read for the whole maneuver list |
| `convertGeoCodingResult(s)` walking results → feature collections → features, then merging `address` and `rank` in by hand | `service.call('calculateAddresses', request)` returns a **GeoJSON FeatureCollection** whose features already carry `address` and `rank` |
| `new GeoJSONGeometryWriter(...).writeGeometry(geometry)` | `geometry.get('geoJSON')` — the writer is not something a string API can construct |
| `isLocationOnPath` / `distanceToEnd` from the plugin's platform "Additions" | plain JavaScript in `utils/geo.ts` — the positions were already in JavaScript, so crossing to native only paid for the conversion |
| `LayerStack` reaching `massifMap.getLayers().insert/set/count` | `map.layers().insert/replace/at/count` — facade calls, no native list |
| a `TileDownloadListener` object with four callbacks | `source.on('download.started' \| 'download.progress' \| 'download.completed')` |
| `setJSONStyleParameters({...})` | `decoder.call('setStyleParameters', {...})` — one crossing, one repaintability check |
| rebuilding the whole GeoJSON document to add or drop one item | `source.addFeature/updateFeature/removeFeature` |
| `_nativeGeometry`, a cached SDK geometry per item | gone — the item already carries GeoJSON, and building a geometry to read its points back was two crossings and a proxy per point |

## Things that got genuinely better, not just different

- **The navigation recentre is one camera move.** It used to be four (`setFocusPos`, `setZoom`,
  `setBearing`, `setTilt`) with the same duration, and four animations over one camera visibly
  fight each other. `camera().moveTo(pos, { zoom, rotation, tilt, duration })` is one flight.
- **The admin-boundary overlay shares the base map's source** instead of opening the same files a
  second time: `baseLayer.child('dataSource')` hands the source over, and a spec takes that handle.
- **A polygon style carries its border inline.** Nested specs work on any writable object property
  now, so `{ type: 'polygon', lineStyle: { type: 'line', … } }` is one create, not two.
- **`isLocationOnPath`'s non-geodesic branch was broken** — it indexed a `MapPosVector` as an array
  and read `.lat`/`.lon` off a native point. On plain arrays it is simply correct.
- **`setOnlineRoutingUrl` had a `+ +` typo** that stringified `NaN` into the URL. Fixed in passing.

## Still worth doing

Ranked by what they would actually buy.

### 1. `VectorTileSearchService` settings are still mutated and restored around each search

`searchInVectorTiles` saves `minZoom`/`maxZoom`/`maxResults`/… off the service, overwrites them,
searches, and puts them back. That is a race if two searches ever overlap. The honest fix is a
per-request override on the SDK's search service; until then the save/restore stays and the
comment says why. Callers keep searches sequential.

### 2. The elevation profile is still a hot JavaScript loop

`computeProfileFromHeights` walks thousands of points computing grades, ascents and smoothing. The
elevations themselves now arrive in one crossing, so the loop is pure JavaScript — but it is still
the most expensive thing the item sheet does. If a trace ever says so, it belongs in the SDK, where
every binding would get it.

### 3. The item model still stores geometry as a string

`Item._geometry` is JSON text that gets parsed on nearly every read. That predates this migration
and is orthogonal to it, but it is now the single biggest source of `JSON.parse` in the app.

### 4. Style parameters are written as whole maps

`setStyleParameters` takes the whole object each time one key changes. Harmless today (the maps are
small), worth remembering if the parameter set grows.

### 5. `getStats` and `getElevationProfile` had duplicate position-building branches

One for an item with a cached native geometry, one for an item with GeoJSON — and after this
migration they produced the same thing. Collapsed into `getRouteItemPoses`. Anything else still
carrying that shape should go the same way.

## What the SDK and the plugin gained for this

Listed here so a future upgrade knows what to keep. All of it is upstream, not in the app:

**SDK — new verbs and values**

- `Geometry.geoJSON` — serialise any shape without constructing a writer.
- `RoutingResult.instructionsJSON` — every maneuver in one read.
- `GeocodingResult.getGeoJSON()`, and `calculateAddresses` returning GeoJSON.
- `MassifApi.getObject(handle, path)` / `mm_get_object` — read an object property AS an object.
  The read counterpart of `setObject`, and the only way to share a child.
- `Layers.insert/set/get/clear`, `MultiTileDataSource.add/remove`,
  `MultiValhallaOfflineRoutingService.add/remove/addLocale/setConfigurationParameter`,
  `MultiOSMOfflineGeocodingService.add/remove`, `RoutingService.matchRoute`,
  `MBVectorTileDecoder.setStyleParameters`,
  `GeoJSONVectorTileDataSource.addFeature/updateFeature/removeFeature`,
  `PersistentCacheTileDataSource.startDownloadArea/stopAllDownloads/clear` + the `download.*` events.
- `MassifInterop.getSourceByHandle/getLayerByHandle` — the escape hatch for handing an SDK object
  to the app's own native code when it has no id.

**SDK — new specs**

`line`/`polygon` geometries; `point`/`line`/`polygon`/`text` elements and their style builders;
`merged-mbvt` and `maptiler` sources; `multi-valhalla-offline` routing; the whole `geocoding` kind;
a `bitmap` kind; `match-request` for map matching.

**SDK — spec rules**

- A nested spec works on any writable **object property**, not only on a constructor argument.
- A **number** where an object is expected is a **handle**, which is how an app shares an object it
  already holds.
- A `std::vector<MapPos>` / `std::vector<std::vector<MapPos>>` constructor argument is a list of
  positions / rings, so lines and polygons build from their own constructors.

**Plugin**

`api.mapViewClass()` (so the app registers the view element without importing `ui`), `map.layers()`,
`map.buildLayer()`, `map.size()`, `map.capture()`, `camera.bounds()`, `MassifObject.child()`,
`MassifLayer.source()`, and `toPosition` accepting `lon` as well as `lng`.
