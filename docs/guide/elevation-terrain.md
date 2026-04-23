# Elevation & Terrain

AlpiMaps has first-class support for elevation data, giving you hillshade visualisation, slope analysis, 3D terrain and detailed elevation profiles for any route.

## Requirements

Elevation features require locally stored elevation data files (`.etiles`). Generate these with the [AlpiMaps data generator](https://github.com/Akylas/alpimaps_data_generator) or use the remote ElevationTiles / Mapterhorn online overlays for a lighter alternative.

## Hillshade

Hillshade renders a shaded-relief effect over the map by simulating sunlight hitting the terrain. It makes mountains, valleys and ridgelines immediately visible.

### Enabling Hillshade

Add the **Hillshade** overlay from the Layers panel (tap the stack icon, then **+** to browse overlays, or scroll to the hillshade entries in the list).

If local etiles are loaded, the app uses them. Otherwise it can fall back to the remote ElevationTiles source.

### Hillshade Options

Long-press the hillshade layer's ⋮ button, or open Layer Options, to access:

| Option | Default | Description |
|---|---|---|
| **Contrast** | 0.5 | Shadow / highlight contrast |
| **Height scale** | 1.0 | Exaggeration factor for relief |
| **Zoom level bias** | 0 | Shifts the effective detail level |
| **Light direction** | 315° | Compass bearing of the simulated sun |
| **Shadow colour** | Dark blue | Colour of shaded areas |
| **Highlight colour** | White | Colour of lit areas |
| **Accent colour** | Warm brown | Accent colour for steep faces |

## Slope Percentage Overlay

When terrain data is present, AlpiMaps can colour the map by slope angle. This is invaluable for avalanche risk assessment or cycling difficulty planning.

Enable the slope overlay via the **slope icon** in Map Options. Slopes are colour-coded:

| Colour | Slope angle |
|---|---|
| 🟡 Yellow | ≥ 30° |
| 🟠 Orange | ≥ 35° |
| 🔴 Red | ≥ 40° |
| 🟣 Purple | ≥ 45° |

**Long-press the slope icon** to view the slope legend popover.

## Contour Lines

Contour lines require `*_contours.mbtiles` data. Toggle them with the **contours icon** in Map Options.

**Long-press the contours icon** to adjust contour line opacity with a slider — useful when combining with other overlays.

## Elevation Profiles

An elevation profile plots altitude against distance for any route or path.

### Getting a Profile

1. Select any route or compute a routing result
2. Tap the **📈 profile icon** in the bottom info panel
3. The chart appears below the map showing altitude on the Y axis and distance on the X axis

### Profile Interaction

- **Tap / drag on the chart** to inspect elevation, grade and distance at any point
- A crosshair marker appears on the map showing your position on the route

### Ascent/Descent Detection

AlpiMaps automatically detects individual ascent and descent segments within the profile. Each segment shows:

- Total gain (↑) and loss (↓)
- Start and end distance

Configurable in **Profile Settings** (long-press the profile button):

| Setting | Default | Description |
|---|---|---|
| **Show ascents** | On | Draw ascent/descent segment markers |
| **Minimum gain** | 100 m | Minimum altitude gain to count as an ascent |
| **Dip tolerance** | 80 m | Maximum dip within an ascent before splitting it |

### Grade Colours

When **grade colours** are enabled, the profile line is colour-coded by slope:

- 🟢 Green — flat / easy
- 🟡 Yellow — moderate
- 🟠 Orange — steep
- 🔴 Red — very steep

Toggle in Profile Settings (long-press profile button) or in the chart icon button.

### Waypoints on Profile

Toggle whether saved waypoints along the route appear as markers on the profile chart (Profile Settings → Show waypoints).

### Profile Data Settings

Access via **Settings → Charts** or by long-pressing the elevation profile button:

| Setting | Default | Description |
|---|---|---|
| **Smoothing window** | 3 | Moving-average window size for smoothing noisy GPS elevation data |
| **Filter step** | 5 m | Minimum elevation change to include a point (filters GPS noise) |
| **Max filter** | 50 m | Maximum elevation jump before a point is treated as an outlier |
| **Min elevation range** | 250 m | Minimum Y-axis range to prevent flat profiles looking too zoomed-in |

## Per-Point Elevation Query

Tap any location on the map and the info panel shows the **altitude** at that point (requires etiles data). This works even for arbitrary map taps, not only for route waypoints.

## 3D Terrain View (Android)

AlpiMaps includes a full 3D terrain renderer for Android, powered by local hillshade data and vector tiles.

To open the 3D view:

1. Select any point on the map
2. Tap the **🎥 3D icon** in the info panel button bar (visible only when elevation data is loaded)

In the 3D view you can:

- Pan, rotate and zoom the terrain
- See the map style draped over the terrain mesh
- Combine raster satellite/topo with 3D relief

## Terrarium Elevation (Online)

If you don't have local etiles, you can add the **ElevationTiles** or **Mapterhorn** overlays from the Layers panel. These fetch elevation tiles from a remote server and provide:

- Hillshade rendering
- Per-point elevation queries

Note: slope percentages, contour lines and offline elevation profiles require local etiles.
