# Map & Layers

## Map Styles

Alpi Maps supports more than 50 different map styles. Styles are divided into categories:

| Category | Examples |
|---|---|
| **Vector (OSM)** | OSM Outdoor, AmericanaOSM |
| **Topo** | Refuges.info, OpenTopoMap, IGN (France) |
| **Cycling** | CyclOSM, OpenCycleMap, Waymarked Cycling |
| **Hiking** | Waymarked Hiking, Swiss Topo |
| **Satellite** | ESRI Satellite, Google Hybrid |
| **Ski** | OpenSkiMap |
| **Custom** | Any XYZ tile URL or local MBTiles file |

To switch styles:

1. Tap the **Layers** button (stack icon, bottom-left)
2. Browse the list and tap a style to activate it
3. **Long-press the Layers button** to jump directly to the style picker

### AmericanaOSM (Default Vector Map)

AlpiMaps uses [AmericanaOSM](https://tile.ourmap.us) as its default vector style. This is a high-quality OpenStreetMap-based style optimised for outdoor use.

Because the public shared instance has usage limits, you are encouraged to set up **your own free instance** on AWS. This takes about 5 minutes:

1. Follow the [Protomaps CloudFormation guide](https://docs.protomaps.com/deploy/aws#_2-cloudformation-template)
2. Use `BucketName = osmus-tile` and create your stack in the **`us-east-2` region**
3. Copy the `LambdaFunctionUrl` from the stack Outputs (it will be a `https://SUBDOMAIN.cloudfront.net` URL)
4. In AlpiMaps go to **Settings → API Keys** and set that URL for the `americanaosm` key

## Overlays

Overlays are transparent layers drawn on top of the base map. Available overlays include:

| Overlay | Description |
|---|---|
| **Hillshade** | Shaded relief from elevation data |
| **Slope percentages** | Colour-coded slope angles (requires terrain data) |
| **Contour lines** | Elevation contours (requires local data) |
| **Routes** | Hiking and cycling routes from OSM |
| **Ski trails** | OpenSkiMap ski piste overlay |
| **ElevationTiles** | Terrarium elevation data (remote) |
| **Mapterhorn** | Hillshade via Mapterhorn tiles |
| **Transit** | Public transport lines (requires local transit data) |
| **Admin boundaries** | Country/region administrative borders |

Each overlay has an **opacity slider** so you can blend it with the base map at any strength.

## Layer Management

The **Layers panel** (tap the stack icon) shows all active layers:

- **Drag** layers to reorder them (Android: long-press the ⋮ handle to start dragging; iOS: use the reorder handle)
- **Swipe left** on a layer to reveal the delete button
- **Tap ⋮** on a layer to open its options (opacity, clear cache, etc.)
- **Tap +** to add a new map source (URL, local file, or from the built-in catalogue)

### Layer Opacity

Each layer shows an opacity slider directly in the list. Slide it to 0 to hide the layer without removing it.

## Map Controls

### Globe / Spherical Projection

Toggle the globe icon to switch between flat (Mercator) projection and a spherical globe view. Useful for world-scale overviews.

### Map Rotation

Rotation is disabled by default to prevent accidental map spins. Enable it in the Map Options (⋮ menu) with the **Rotation** toggle. Once enabled, use a two-finger rotation gesture to rotate the map.

### Map Tilt / Pitch

Similarly, tilt (pitch) is off by default. Enable it in Map Options. Once on, use a two-finger drag up/down to tilt the map. Useful during navigation for a perspective view.

### Tile Preloading

When preloading is enabled the map fetches tiles slightly beyond the current viewport. This makes panning smoother at the cost of slightly more data usage.

### Show/Hide Saved Items Layer

The **Show items/routes** toggle in Map Options controls whether your saved markers and routes are drawn on the map.

## Map Options Quick Reference

Access via the **⋮ button** at the top-right of the search bar (long-press for full panel).

| Option | Description |
|---|---|
| Globe mode | Toggle spherical projection |
| Map rotation | Enable/disable two-finger rotation |
| Map pitch | Enable/disable map tilt |
| Preloading | Toggle tile pre-fetch |
| Show items/routes | Toggle saved markers layer |
| Contour lines | Toggle offline contour overlay |
| 3D Buildings | Toggle extruded building rendering |
| Slope percentages | Toggle slope colour overlay |
| Show routes | Toggle hiking/cycling route overlay |

## Slope Overlay Details

When slope percentages are visible, areas are colour-coded:

| Colour | Slope |
|---|---|
| Yellow | ≥ 30° |
| Orange | ≥ 35° |
| Red | ≥ 40° |
| Purple | ≥ 45° |

**Long-press the slope toggle button** to open the slopes legend popover.

## Contour Lines

When offline terrain data is present, contour lines can be toggled on/off. **Long-press the contour toggle** to adjust contour opacity with a slider.

## Route Overlays

When offline route data (routes MBTiles) is loaded, the route overlay shows hiking and cycling networks at all zoom levels.

**Long-press the routes toggle** to open the route-type picker:

| Type | Shows |
|---|---|
| All | All hiking and cycling routes |
| Bicycle | Cycling routes only |
| Hiking | Hiking routes only |
