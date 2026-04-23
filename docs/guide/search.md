# Search

## Online Search

AlpiMaps uses the OpenStreetMap [Photon](https://photon.komoot.io) geocoder for online search. This gives you access to hundreds of millions of places worldwide:

- Cities, towns, villages
- Streets and addresses
- Points of interest (restaurants, shops, hospitals, trails, peaks…)
- Administrative areas

### How to Search

1. Tap the **search bar** at the top of the map
2. Type your query — results appear as you type
3. Tap a result to jump to it on the map

### Searching in the Current View

After searching, you can tap **Search in area** (or a similar contextual button) to restrict results to the region currently visible on the map. This is useful for finding, e.g., all restaurants in the area you are hiking.

### Search Results Panel

Results are shown in a scrollable panel. Each result shows:

- Name and type icon
- Address / region
- Distance from the current map centre

Tap a result to:

- Pan and zoom the map to that location
- Open the info panel for the place
- Save it as a marker
- Get directions to/from it

## Offline Search (Geocoding)

When NutiGeoDb offline geocoding data is present, search works without any internet connection.

Offline search supports:

- Town, city and village lookup
- Street-level addressing
- Named POIs (peaks, refuges, huts, viewpoints…)
- Trail names

### Enabling Offline Geocoding

1. Generate or download a `nutigeodb.*` file for your region (see [Data Generation](/guide/data-generation))
2. Place it in your `alpimaps_mbtiles` folder
3. Enable **Settings → Address → Use offline geocoding**

### Geocoding Settings

| Setting | Description |
|---|---|
| **Use offline geocoding** | Use local NutiGeoDb data for address lookup |
| **Use system geocoding** | Fall back to the device's built-in geocoder (Android: Google, iOS: Apple) |

Both can be active at the same time — offline results are returned first, then supplemented by the system geocoder if needed.

## Reverse Geocoding

Tap any point on the map to get its address (reverse geocoding). The info panel displays the nearest address, city and country.

Reverse geocoding also works offline when NutiGeoDb data is loaded.

## Searching Your Saved Markers

The search bar also searches your **saved markers and routes**. Results from your personal collection appear at the top of the list with a bookmark icon.

## In-App Browser

When you tap a web URL result or tap **Search web** on the info panel, the link opens in the in-app browser by default.

To open links in the system browser instead, disable **Settings → Behavior → Use in-app browser**.
