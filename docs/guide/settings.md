# Settings Reference

AlpiMaps has a rich settings hierarchy. Access settings from the **⋮ menu → Settings**.

## General

| Setting | Description |
|---|---|
| **Language** | UI language. Defaults to the device language |
| **Map language** | Language used for map labels (place names). Can differ from UI language |
| **Theme** | Light / Dark / System (follows device dark mode setting) |
| **Color theme** | Visual accent color theme |
| **AMOLED black mode** | Forces a pure-black background in dark mode (saves battery on OLED screens) |
| **24-hour clock** | Toggle 12h / 24h time format |
| **Units** | Shortcut to the units sub-settings |
| **Donate** | Opens the sponsorship page |

### Units

| Setting | Options | Description |
|---|---|---|
| **Imperial units** | On/Off | Switch between metric and imperial globally |
| **Distance** | km / mi / m / ft / in | Unit for distance display |
| **Speed** | km/h / m/s / mph / ft/h / knot | Unit for speed display |

---

## Behavior

| Setting | Description |
|---|---|
| **Use in-app browser** | Open web links inside the app instead of the system browser |
| **Long-press list opens camera** | Long-pressing the item-list button opens the lock-screen camera (Android) |
| **Immersive mode** | Hides the system status bar for a full-screen map experience |
| **Map data path** | Folder path where AlpiMaps looks for MBTiles / etiles / vtiles data |
| **Items data path** | Folder path where saved markers and routes are stored |

---

## Directions

Settings for routing and navigation behaviour.

| Setting | Default | Description |
|---|---|---|
| **Start with destination** | Off | When opening directions from a selected point, add it as the **destination** rather than the origin |
| **Online routing URL** | `https://valhalla1.openstreetmap.de` | URL of the Valhalla routing server used for online routing |
| **Navigation tilt** | 45° | Map pitch angle when in navigation mode |
| **Navigation position offset** | 0.3 | Vertical position of your location marker during navigation (0 = bottom, 1 = top) |
| **Distance from route** | 15 m | If you deviate further than this from the planned route, the app considers you off-route |
| **Auto-fetch elevation profile** | Off | Automatically compute the elevation profile when a route is selected |
| **Auto-fetch road stats** | Off | Automatically compute surface statistics when a route is selected |
| **Route item image capture** | On | Capture a map screenshot thumbnail when saving a route |
| **Click handler layer filter** | (regex) | Regular expression controlling which map layers receive click events. Advanced: change to restrict or expand what you can tap on the map |

---

## Charts (Elevation Profile)

| Setting | Default | Description |
|---|---|---|
| **Smoothing window** | 3 | Moving-average kernel size for smoothing elevation data. Higher = smoother but loses detail |
| **Filter step** | 5 m | Minimum elevation difference to include a point. Filters out GPS noise |
| **Max filter** | 50 m | Maximum single-step elevation change before treating a point as an outlier |
| **Min elevation range** | 250 m | Minimum Y-axis span (prevents flat profiles from appearing too zoomed) |
| **Show ascents** | On | Draw ascent/descent segment labels on the profile |
| **Show grade colours** | On | Colour-code the profile line by slope grade |
| **Show waypoints** | On | Mark waypoints along the route on the elevation chart |
| **Ascents min gain** | 100 m | Minimum altitude gain for a segment to count as an ascent |
| **Ascents dip tolerance** | 80 m | Maximum dip within a climb before it is split into two separate ascents |

---

## Address (Geocoding)

| Setting | Default | Description |
|---|---|---|
| **Use offline geocoding** | On | Use local NutiGeoDb data for address and place lookup |
| **Use system geocoding** | On | Fall back to the device's built-in geocoder (Google on Android, Apple on iOS) |

---

## Geolocation (GPS)

These settings control how the GPS module behaves.

| Setting | Description |
|---|---|
| **Desired accuracy** | Requested location accuracy. High = best accuracy, more battery. Low = coarser but efficient |
| **Update interval** | Target time between GPS updates (milliseconds) |
| **Minimum update interval** | Minimum time between updates even if movement is detected |
| **Distance filter** | Only report position if moved at least this many metres |
| **Show accuracy marker** | Show/hide the blue accuracy circle around your position |
| **Draw on-route live data** | Draw a GPS breadcrumb trail on top of the planned route |
| **Refresh screen on background location** *(Android 9)* | Wake the screen periodically when tracking in background |
| **Background refresh delay** *(Android 9)* | Delay between background screen wakes (milliseconds, default: 100) |

---

## Offline Routing (Valhalla)

Max-distance limits for the embedded Valhalla engine. Routes longer than these limits are rejected.

| Setting | Default | Description |
|---|---|---|
| **Pedestrian max distance** | 250 km | Maximum routing distance for the pedestrian profile |
| **Bicycle max distance** | 500 km | Maximum routing distance for the bicycle profile |
| **Auto max distance** | 5000 km | Maximum routing distance for the car profile |
| **Trace max distance** | 5000 km | Maximum distance for map-matching (trace route) |

---

## Offline Data

| Setting | Description |
|---|---|
| **Map data path** | Base folder for MBTiles, etiles, vtiles and NutiGeoDb files |
| **Items data path** | Folder where saved markers and routes are stored |

---

## API Keys

Configure tokens for third-party tile providers. Each provider that requires authentication shows a field here.

| Token key | Provider |
|---|---|
| `americanaosm` | Your own AmericanaOSM CloudFront URL (see [Map & Layers guide](/guide/map-layers#americanaosm-default-vector-map)) |
| `mapbox` | Mapbox access token |
| `maptiler` | MapTiler API key |
| `thunderforest` | Thunderforest API key |
| `here_appid` / `here_appcode` | HERE Maps credentials |
| `mapquest` | MapQuest API key |
| `ign` | IGN (France) Géoportail API key |
| `carto` | CARTO API key |

See the [API Keys guide](/guide/api-keys) for how to obtain each key.

---

## Backup & Restore

| Action | Description |
|---|---|
| **Export settings** | Save all app settings to a JSON file |
| **Import settings** | Restore settings from a previously exported JSON file |

Exported files can be shared between devices or used as a backup before reinstalling the app.

---

## Tile Server

| Setting | Default | Description |
|---|---|---|
| **Auto-start tile server** | Off | Automatically start the built-in HTTP tile server on app launch |
| **Tile server port** | 8081 | Port the tile server listens on |

The tile server serves local MBTiles files as XYZ tile URLs, making them accessible to other apps on the device or local network.

---

## Advanced / Hidden Settings

Some settings are accessible only via **long-press** on certain items in Settings:

| Long-press target | Hidden setting |
|---|---|
| Version number | Developer / debug options |
| Any setting item | Reset that item to its default value |

---

## Map Layer Options

Beyond the main Settings screen, individual map layer options are accessible from the **Layers panel**:

- Tap ⋮ on any layer → Layer Options → adjust opacity, clear cache, set refresh interval
- Long-press hillshade/slope toggle icons → fine-tune shader parameters
- Long-press contours toggle → opacity slider
- Long-press routes toggle → route type selector (All / Bicycle / Hiking)
