# Markers & Items

AlpiMaps lets you save any map location, route or polygon as a **marker** (also called an "item"). All data is stored locally on your device.

## Saving a Location

1. Tap any point on the map to open the info panel
2. Tap the **🔖 save / bookmark icon** in the panel button bar
3. Give the marker a name (optional) and tap Save

Alternatively, long-press any location on the map to immediately add it as a marker.

## Saving a Route

After computing a routing result:

1. The route appears in the info panel
2. Tap the **save icon** to store it as a named route marker

You can also import GPX / GeoJSON routes via the import function (see below).

## The Items List

Tap the **📋 list icon** (bottom-left of the map) to open the full items list.

**Long-press the list icon** to open the camera app directly from the lock screen (Android only — requires enabling **Settings → Behavior → Long-press list opens camera**). This is useful on cycling helmets: mount your phone, open the camera with a long-press without unlocking.

### List Actions

From the items list you can:

- **Tap** an item to jump to it on the map
- **Long-press** an item to open a context menu (edit, delete, share, duplicate…)
- **Swipe** left/right on an item to reveal quick-action buttons (delete, share)

### Filtering & Sorting

Use the filter bar at the top to search within your markers. Items can be sorted by name, date added or distance from current location.

## Editing a Marker

Tap a marker on the map or in the list, then tap the **✏️ pencil icon** in the info panel to open the editor:

- **Name** — free text
- **Description** — notes, HTML supported
- **Icon** — choose from hundreds of icons
- **Colour** — custom colour for the icon and route line
- **Properties** — add arbitrary key/value metadata

## Marker Categories (Lists)

Markers can be organised into named categories/lists. When saving a new marker, choose an existing list or create a new one.

## Import & Export

### Exporting

From the items list or the info panel share button, you can export markers as:

- **GeoJSON** — standard open format, compatible with QGIS, uMap and others
- **GPX** — compatible with Garmin, Komoot and most other outdoor apps
- **KML** — compatible with Google Earth / Google Maps

### Importing

Tap the **import** button in the items list and select a file. Supported formats:

- GeoJSON
- GPX
- KML

Imported items are added to your local collection and appear on the map immediately.

## Locking the Item Layer

Tap the **🔒 lock icon** that appears in the bottom action bar when an item is selected to lock the item. Locked items cannot be accidentally moved when panning the map.

## Hiding/Showing Items on the Map

Toggle the **"Show items/routes"** option in Map Options (⋮ button) to hide or show all saved markers and routes on the map without deleting them.

## Items Data Path

By default items are stored in the app's private storage. You can point AlpiMaps to a custom folder via **Settings → Offline Data → Items Data Path** — useful if you want to sync items via a cloud folder.
