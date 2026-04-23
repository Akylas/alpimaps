# Tools

AlpiMaps bundles several specialised outdoor tools beyond basic mapping.

## Compass

The compass tool shows the real magnetic north and can be aimed at any saved location or marker.

### Opening the Compass

- Select any point on the map or a saved marker
- Tap the **🧭 compass icon** in the info panel button bar

### Features

- Live magnetic north needle with smoothed animation
- **Target bearing**: when a location or item is selected, a second indicator shows the bearing to that target
- **Distance to target**: displayed numerically
- **Altitude difference**: shown when elevation data is available
- **Multiple targets**: aim at several waypoints simultaneously
- Sun and moon bearing indicators with real-time position

### How to Use

Hold your phone flat and rotate until the red needle points north. The target indicator then shows you exactly which direction to travel to reach your destination.

### Compass Accuracy

On Android the compass uses the **magnetic field + accelerometer** sensor fusion. The app applies magnetic declination correction automatically when your GPS location is known.

On some devices the compass may drift. Calibrate it by moving the phone in a figure-8 pattern.

---

## Astronomy View

The astronomy view provides detailed sun and moon data for any location and date.

### Opening Astronomy

- Select any point on the map
- Tap the **🌙 moon/night icon** in the info panel button bar

### What It Shows

| Data | Description |
|---|---|
| **Sunrise** | Time and compass bearing |
| **Sunset** | Time and compass bearing |
| **Moonrise / Moonset** | Times |
| **Moon phase** | Phase name and illumination percentage |
| **Moon bearing** | Current bearing of the moon |
| **Sun bearing** | Current bearing of the sun |
| **Daylight chart** | 24-hour arc showing daylight window |

### Changing Date / Time

Tap the date/time display to pick a different date and see predictions for any day of the year. Useful for planning shoots at golden hour or checking moonrise times for a future trip.

### Timezone

When offline timezone data is available (bundled in the app or in local data), the astronomy view shows times in the **local timezone of the selected location**, not just your device timezone. This is very useful for planning in a different country.

---

## GPS Satellite View

The satellite view shows all detected GNSS satellites in a sky-plot and signal strength bars.

### Opening Satellite View

From the main ⋮ menu, tap **GPS satellites**.

### Display

- **Sky plot**: circular view with azimuth and elevation. Each satellite is plotted at its actual position in the sky
- **Signal bars**: SNR (signal-to-noise ratio) bar for each visible satellite, colour-coded by constellation
- **Constellation colours**: GPS (red/orange), GLONASS, Galileo, BeiDou — each drawn in a different colour

### Usefulness

- Diagnose why you have poor GPS signal (e.g., building blockage visible on the sky plot)
- Check how many satellites are being used for the fix
- Identify multi-path interference

---

## Peak Finder (Android)

The peak finder overlays peak labels on the live camera view, showing the name, altitude and distance of every visible peak on the horizon.

### Requirements

- Android device
- Local elevation data (etiles) must be present
- Camera permission

### Opening Peak Finder

- Select any mountain or summit on the map
- Tap the **🏔️ peak icon** in the info panel button bar

### How It Works

AlpiMaps uses the device's compass and accelerometer combined with the local elevation model to compute which peaks are visible from your position and at what screen coordinates they should appear.

Tilt the phone to match the horizon and peak labels snap into position.

---

## Transit Lines

Browse public transport (bus, tram, metro, train) lines when offline transit data is loaded.

### Requirements

Transit data must be included in your local data packs. See [Data Generation](/guide/data-generation).

### Using Transit

- Tap any map area with transit data to see routes highlighted on the map
- Tap a line to see its route and all stops
- Tap a bus stop icon to open the **stop info panel**:
  - Tap the **🚌 bus icon** in the button bar to see all lines serving that stop
  - Open a line to see its full timetable

### Transit Data on the Map

When a transit data pack is loaded, transit lines are drawn as coloured lines on the map at zoom levels 7–24. Tap any line or stop to interact with it.

---

## 3D Map (Android)

A full 3D terrain renderer showing the current map area draped over the elevation model.

### Requirements

- Android device
- Local elevation data (etiles) must be present

### Opening the 3D Map

- Select any point on the map
- Tap the **🎥 3D icon** in the info panel (only visible when elevation data is loaded)

### Controls

Pan, rotate and pinch-zoom as on the regular map. The terrain is rendered in real time from local elevation data combined with the active map style.
