# Features Overview

AlpiMaps is the map app for real outdoor adventures — built for hikers, cyclists, travelers and explorers who need reliable maps, navigation and terrain tools whether online or deep in the backcountry.

## Map & Layers

- **50+ map styles** including OSM Outdoor, AmericanaOSM vector, satellite, topo, ski maps and more
- **20+ overlay styles** — ski trails, hillshade, slope percentages, contour lines, routes and more
- **HD tiles** toggle per style for crisp high-resolution rendering
- **Layer opacity** — combine any map with any overlay at custom opacity
- **Globe / spherical projection** mode for world-scale views
- **Rotate & tilt** the map freely, with optional lock to prevent accidental rotation
- **Tile preloading** for smoother panning
- **Attribution display** for all active tile providers

## Offline Maps

- Full offline vector maps in MBTiles format
- Automatic detection and loading of data packs from `alpimaps_mbtiles` folder (Android) or app Documents (iOS)
- Supports map tiles, elevation/hillshade, contour lines, routing data and geocoding data
- Visual download progress indicator
- Generate your own data with the [AlpiMaps data generator](https://github.com/Akylas/alpimaps_data_generator)

## Navigation & Routing

- **Turn-by-turn directions** for pedestrian, cycling (multiple subtypes) and car
- **Three routing profiles simultaneously** displayed on the map for quick comparison
- **Per-profile costing options**: hills preference, road usage, surface avoidance, speed, ferries, tolls, highways and more
- **Long-press any routing button** to fine-tune that specific parameter with a slider
- **Route snapback**: shows your current position relative to the planned route
- **Navigation tilt & position offset** configurable for best viewing during navigation
- **Surface stats** (Komoot-style) — percentage breakdown of road surfaces
- **Online Valhalla routing** with a configurable server URL, or fully offline with vtiles data packs

## Elevation & Terrain

- **Elevation profiles** for any route — tap or drag to inspect specific points
- **Ascent/descent detection** with configurable minimum gain and dip tolerance
- **Grade colour-coding** on the elevation chart
- **Hillshade rendering** with customisable light direction, contrast and height scale
- **Slope percentage overlay** — shows dangerous slopes in colour steps (yellow › orange › red)
- **3D terrain view** (Android) powered by terrarium elevation data
- **Per-point elevation query** from any map tap

## GPS & Location

- One-tap location centering; **long-press** to start continuous location tracking
- **Navigation mode** — keeps your heading at the top of the map while moving
- **Background tracking** option for logging while the screen is off
- **GPS accuracy/frequency settings** to balance precision and battery life
- Accuracy circle overlay toggle
- Lock-screen display option for cyclists
- **Force full-brightness** option
- Satellite signal view for troubleshooting reception

## Search

- **As-you-type search** across your saved markers and the whole OpenStreetMap database
- **Nearby search** — find businesses, trails and POIs in the current map view
- **Offline geocoding** using NutiGeoDb data packs
- **Reverse geocoding** — tap any map point for its address
- System geocoder fallback (configurable)

## Markers & Items

- Save any point, line or polygon as a marker
- Organise markers into named lists
- Edit marker name, icon, colour and description
- Offline storage — all markers are local
- Import/export markers
- Long-press a list item to open camera (Android, if enabled in settings)

## Tools

### Compass
Displays bearing and distance to any selected location or marker. The compass needle tracks the real magnetic north and can aim at multiple saved locations simultaneously.

### Astronomy View
- Sunrise, sunset, moonrise and moonset times with bearings
- Moon phase and illumination percentage
- Daylight chart for any location and date
- Local time display for any timezone (offline timezone detection)

### GPS Satellite View
Visual sky-plot showing all detected GNSS satellites (GPS, GLONASS, Galileo, BeiDou). Signal strength bars and constellation colour-coding help diagnose poor reception.

### Peak Finder (Android)
Augmented-reality overlay that labels all visible peaks in the camera view with name, altitude and bearing — powered by offline elevation data.

### Transit Lines
Browse public transport lines when offline transit data is loaded. Tap stops for departure times and full timetables.

### 3D Map (Android)
Full 3D terrain render of the current map area using local hillshade and vector tile data.

## Settings Highlights

- **Units**: choose metric or imperial for distances, speed and altitude
- **Language & Map Language**: separate settings for UI and map label language
- **Theme**: light, dark or system-follow; optional AMOLED black mode
- **API Keys**: configure provider tokens (IGN, MapBox, MapTiler, etc.)
- **Offline Routing**: max-distance limits per profile, custom Valhalla server URL
- **Elevation Chart**: smoothing window and filter step for cleaner profiles
- **Tile Server**: built-in local tile server with configurable port
- Export and import all settings as a file

[→ Full Settings Reference](/guide/settings)
