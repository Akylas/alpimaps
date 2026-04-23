# Navigation & Routing

AlpiMaps provides full turn-by-turn navigation for pedestrians, cyclists and drivers, powered by [Valhalla](https://valhalla.readthedocs.io) routing engine. Routing works both online (via a configurable Valhalla server) and fully offline (when vtiles data packs are present).

## Routing Profiles

Three transport modes are supported:

| Profile | Icon | Best for |
|---|---|---|
| **Pedestrian** | 🚶 | Walking, hiking, trail running |
| **Bicycle** | 🚴 | Cycling (with sub-types) |
| **Car / Auto** | 🚗 | Driving |

Switch between profiles using the profile icons at the top of the Directions panel.

### Bicycle Sub-types

The bicycle profile has several sub-types that adjust the default costing options:

| Sub-type | Characteristics |
|---|---|
| **Normal** | Balanced road / trail mix |
| **Road** | Prefers paved roads, avoids unpaved |
| **Gravel** | Mixed terrain, moderate hill tolerance |
| **Mountain** | Prefers trails, high hill tolerance |
| **Enduro** | Maximum trail preference |
| **Touring** | Comfort-focused, prefers flat routes |

### Pedestrian Sub-types

| Sub-type | Characteristics |
|---|---|
| **Normal** | Standard walking |
| **Mountain hiking** | Prefers trails, tolerates steep grades |
| **Running** | Optimised for running routes |

## Planning a Route

1. Tap any point on the map to open the info panel
2. Tap the **directions arrow** icon (or swipe up the bottom panel) to add it as a destination
3. Alternatively, tap the **Directions** button (compass icon, bottom-right) while a point is selected
4. Add more waypoints by tapping the **+** button in the Directions panel
5. The app computes up to three route alternatives and draws them on the map
6. Tap a route to select it and see its stats

### Route Alternatives

AlpiMaps can compute and display up to three routing alternatives simultaneously. Each alternative is drawn in a different colour so you can compare them at a glance:

- **Purple** — "adventurous" or hill-preferring variant
- **Green** — balanced variant  
- **Brown/amber** — road-preferring or flattest variant

## Costing Options (Routing Parameters)

Each profile has costing options that control how Valhalla computes routes. You can adjust them in the **route settings popover** (tap the ⚙️ / settings icon in the Directions panel).

### Accessing Settings

- Tap the **settings icon** in the Directions panel to open the options for the current profile
- **Long-press any routing toggle button** in the Directions panel to open a fine-grained slider for that specific option

### Pedestrian Costing Options

| Option | Range | Description |
|---|---|---|
| `walking_speed` | 0.5 – 25 km/h | Preferred walking speed, affects time estimates |
| `use_hills` | 0 – 1 | Preference for hilly routes. 0 = avoid hills, 1 = prefer hills |
| `max_hiking_difficulty` | 1 – 6 | Maximum allowed hiking difficulty (SAC scale equivalent) |
| `step_penalty` | 0 – 100 | Cost multiplier for routes using steps |
| `driveway_factor` | 0.1 – 100 | Cost multiplier for driveways |
| `walkway_factor` | 0.1 – 100 | Preference for dedicated walkways |
| `sidewalk_factor` | 0.1 – 100 | Preference for sidewalks vs. road edges |
| `alley_factor` | 0.1 – 100 | Cost multiplier for alleys |
| `use_roads` | 0 – 1 | Preference for using paved roads vs. trails |

### Bicycle Costing Options

| Option | Range | Description |
|---|---|---|
| `use_hills` | 0 – 1 | Preference for hilly routes. 0 = avoid hills, 1 = prefer steep climbs |
| `avoid_bad_surfaces` | 0 – 1 | Penalty for unpaved or rough surfaces |
| `use_roads` | 0 – 1 | Preference for paved roads vs. dedicated cycling paths |
| `cycling_speed` | 5 – 60 km/h | Preferred cycling speed |
| `non_network_penalty` | 0 – 1 | Extra cost for roads not part of a cycling network |
| `exclude_unpaved` | 0 / 1 | Hard exclusion of all unpaved roads |
| `weight` | 1 – 25 kg | Total weight (rider + bike) used in energy calculations |

### Car / Auto Costing Options

| Option | Range | Description |
|---|---|---|
| `use_highways` | 0 – 1 | Preference for motorways. 0 = avoid, 1 = prefer |
| `use_distance` | 0 – 1 | Whether to optimise for shortest distance vs. fastest time |
| `use_tolls` | 0 – 1 | Willingness to use toll roads. 0 = avoid tolls |
| `alley_factor` | 0.1 – 100 | Cost multiplier for alleys |

### Long-press Routing Buttons

Every routing-option button in the Directions panel supports a **long-press** action that opens a slider popover for precise control:

| Button | Long-press action |
|---|---|
| Hills preference | Fine-tune `use_hills` with a slider |
| Road preference | Fine-tune `use_roads` with a slider |
| Highway preference | Fine-tune `use_highways` with a slider |
| Toll preference | Fine-tune `use_tolls` with a slider |
| Elevation profile | Open elevation profile settings |

## Starting Navigation

Once a route is planned:

1. Tap the selected route to confirm it
2. The navigation panel appears showing the next instruction, distance and estimated time
3. Tap the **navigation arrow** on the map to enable heading-up mode
4. A chevron shows your current position on the route

### Navigation Display

During navigation the map shows:

- Turn instruction icon + street name in the navigation bar
- Distance to the next instruction
- Remaining total distance and estimated time
- Your position marker snapped to the route

### Navigation Settings

Configure in **Settings → Directions**:

| Setting | Description |
|---|---|
| **Navigation tilt** | Map tilt angle (pitch) during navigation (default: 45°) |
| **Navigation position offset** | How far from the bottom your position is displayed (0 = centre, 1 = top) |
| **Distance from route** | Maximum distance (metres) before the app considers you off-route (default: 15 m) |
| **Start with destination** | When true, adds destination first instead of origin when opening directions |

## Online vs Offline Routing

### Online Routing

By default, online routing uses the public Valhalla server at `https://valhalla1.openstreetmap.de`. You can change this URL in **Settings → Directions → Online Routing URL**.

Max distance limits also apply (configurable in **Settings → Offline Routing**):

| Profile | Default max distance |
|---|---|
| Pedestrian | 250 km |
| Bicycle | 500 km |
| Car | 5000 km |

### Offline Routing

When vtiles data packs are present, routing runs entirely on-device using the embedded Valhalla engine. No internet is needed.

Configure max distances for offline routing in **Settings → Offline Routing**:

| Setting | Default |
|---|---|
| Pedestrian max distance | 250 km |
| Bicycle max distance | 500 km |
| Car max distance | 5000 km |
| Trace max distance | 5000 km |

## Route Statistics (Surface Stats)

AlpiMaps can compute **Komoot-style surface statistics** for any route, breaking down the percentage of distance by road/path surface type (asphalt, gravel, trail, etc.) and estimating the difficulty.

Tap the **📊 chart-bar icon** in the item info panel when a route is selected to compute stats. Requires vtiles data.

## Elevation Profile

Tap the **📈 chart icon** in the info panel to compute the elevation profile for any route. See the [Elevation & Terrain guide](/guide/elevation-terrain) for details.

**Long-press the elevation profile button** to open the profile settings (smoothing, grade colours, waypoints, ascent detection).
