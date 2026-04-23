# GPS & Location

## Location Button

The GPS/location button is in the bottom-right corner of the map.

| Interaction | Action |
|---|---|
| **Tap** | Centre the map on your current location (single fix) |
| **Long-press** | Start/stop **continuous location tracking** |

When tracking is active the button turns blue/themed and the map stays centred on your position as you move.

## Navigation Mode

When location tracking is active, a **navigation arrow** button appears to the left of the GPS button.

| State | Behaviour |
|---|---|
| Off | Map north is always up |
| On | Map rotates so your heading is always up (compass mode) |

Tap the navigation arrow to toggle heading-up mode.

## GPS Accuracy & Battery

Continued GPS use in the background can dramatically reduce battery life. AlpiMaps gives you fine-grained control:

### GPS Settings (Settings → Geolocation)

These settings correspond to the underlying platform GPS provider:

| Setting | Description |
|---|---|
| **Desired accuracy** | Requested location accuracy (high/medium/low). Lower accuracy = less GPS radio use = better battery |
| **Update interval** | How often the GPS refreshes the location |
| **Minimum update interval** | Minimum time between location updates |
| **Distance filter** | Only report a new location if moved at least this many metres |

> **Tip:** For casual map browsing where you just want to see roughly where you are, set accuracy to "low" and distance filter to 50+ metres. For turn-by-turn navigation, use "high" accuracy.

### Show Accuracy Circle

Toggle the **accuracy marker** (blue circle showing GPS uncertainty radius) via **Settings → Geolocation → Show accuracy marker**.

### Live Data on Route

When **Draw on-route live data** is enabled (Settings → Geolocation) your actual GPS track is drawn on top of the planned route, giving a real-time "bread crumb" trail.

## Background Location (Android)

On Android 9 (API 28) devices you can configure the app to refresh the screen at a set interval while tracking in background mode:

- **Settings → Geolocation → Refresh screen on background location** — enables the periodic screen wake
- **Settings → Geolocation → Background refresh delay** — delay between wakes (milliseconds, default: 100)

This is useful when using the app as a cycling computer mounted on handlebars — the screen refreshes automatically as you move even when locked.

## Lock Screen Display

Enable **show on lock screen** to keep the map visible on the device lock screen without unlocking. Useful for cycling.

Access this via the main map menu (⋮ button) or the keep-awake notification.

## Keep Screen Awake

Enable **keep screen awake** from the main map menu. This prevents the screen from dimming or turning off while the app is in use. A notification appears so you can turn it off from the notification shade.

**Long-press the keep-awake notification** to also enable **full brightness mode**, which forces maximum brightness regardless of auto-brightness settings.

## Location Info Panel

When location tracking is active, a floating info card near the map shows:

- Current **altitude** (from GPS or from elevation data if more accurate)
- Current **speed**
- Compass **bearing**
- **Sunrise / sunset** times for your current location

Tap the card to expand it for more details.

## Sharing Your Location

From the main ⋮ menu or the item info panel, tap **Share** to share:

- A screenshot of the current map with your location marked
- Coordinates in text form
- A deep-link URL that opens the location in AlpiMaps or a compatible map app

## Compass Integration

The GPS and compass work together:

- The location marker on the map shows a direction cone when your heading is known
- The compass tool can aim at any selected waypoint and shows live bearing relative to your current heading

See [Tools → Compass](/guide/tools#compass) for more.
