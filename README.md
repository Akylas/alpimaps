<p align="center"><img src="fastlane/metadata/android/en_US/images/featureGraphic.png" width="100%"></a></p>

<h1 align="center">You hiking companion</h1>
<p align="center">
<a href="https://www.gnu.org/licenses/gpl-3.0" alt="License: GPLv3"><img src="https://img.shields.io/badge/license-GPL%20v3-blue"></a> <a href="https://github.com/farfromrefug/alpimaps/releases" alt="Release version"><img src="https://img.shields.io/github/v/release/farfromrefug/alpimaps?color=ff5200"/></a>
<p align="center">
<br>You can get the <a href="https://github.com/farfromrefug/alpimaps/releases/latest">latest release on GitHub</a>
</p>
<div align="center">
<img src="https://gitlab.com/IzzyOnDroid/repo/-/raw/master/assets/IzzyOnDroid.png" height="80">
</div>

<h2 align="center">Enjoying AlpiMaps?</h2>
<p align="center">Please consider making a small donation to help fund the project. Developing an application, especially one that is open source and completely free, takes a lot of time and effort.
<br>
<br>

<div align="center">
<a href="https://github.com/sponsors/farfromrefug">:heart: Sponsor</a>
</div>

<hr>

Alpi Maps is a map application to help you prepare and enjoy your hike!
Get all the info you need before you go, then enjoy all the data offline during your hike.

Alpi Maps also helps you in managing the GPS to get your precise location when needed while keeping the battery consumption to the lowest.
Continued use of GPS running in the background can dramatically decrease battery life.

Alpi Maps data is base on OpenStreetMap, which means you can access almost anything anywhere in the world!

## Map features:

* enjoy more that 50 different map styles
* enjoy more that 20 different map overlay styles like ski trails
* enable / disable HD map for each style
* combine map styles with opacity to create your own map
* enjoy rotating and tilting map
* use the Google Maps gestures you love so much like the double tap and drag to zoom!
* query weather data for any point on the map( requires [OSS Weather](https://github.com/Akylas/oss-weather) to be installed)

## Offline Maps

*AlpiMaps* was created to be used with offline data so that you get access to everything offline.
On Android that data is expected to be found on the SDCard under `alpimaps_mbtiles`.
All the data can be generated using [alpimaps_data_generator](https://github.com/Akylas/alpimaps_data_generator). But theoretically you should be able to use mbtiles acquired through other sources
Here is an example of how it can look like
![image](https://user-images.githubusercontent.com/655344/221211543-91248580-5315-4edc-ba95-477592203771.png)
* Top level data are for world mapping. The idea is to be able to render the whole world at low zoom levels. `routes` stands for hiking/cycling routes. So you can get main hiking/cycling roads worldwide.
* each subfolder represents a zone/country:
   - france_full.mbtiles: the whole france map. Equivalent to osm maps with a few changes (removed a few things and added others). All centered around hiking/cycling
   - etiles files: elevation/hillshade data. Gives you hillshading, slope percentages, elevation profiles and any point elevation
   - *contours*.mbtiles: give you elevation contour lines
   - *routes*.mbtiles: give you hiking/cycling routes at all levels
   - vtiles files: give you full routing queries with direction instructions for car/pedestrian,cycling... It also can give you surface stats like komoot does
   - nutigeodb files: gives you geocoding/reverse geocoding. You can search for a lot of things offline. This one i am not 100% happy with yet.

If you use those data, they will automatically be loaded on start and enable a ton of offline features:
* full offline vector maps with OSM / Outdoor styles
* query and point/line/polygon on the map 
* access elevation from any point of the map
* compute routing for cycling/car/pedestrian
* compute elevation profile for any route
* compute stats profile for any route like komoot does
* hillshade / slopes rendering
* geocoding
* render vector routes for hiking/cycling

## GPS features:

* follow your location on the map
* choose wether to follow your location or only query your location when needed for the lowest battery consumption
* choose the accuracy of the GPS for even lower battery consumption
* access useful information about your position like altitude, orientation, sunset, sunrise...
* track your position on any computed itinerary to see where you are at
* see where you are from any point on the map : distance, orientation and altitude
* decide wether you want the app to track you while in background or not
* share your location with a screenshot of the map

## Markers features:

* add a marker from any point on the map
* query the adress
* manage your markers in lists for offline storage

## Search features:

* Alpi Maps use the OpenStreetMap database for its search module. Access all geo features, all businesses, cities and much more!
* use the search as you type feature to quickly look for something in your markers or anywhere in the world
* then use the search to look for businesses, restaurants, ... in the region you are currently seeing

## tools

* Compass tool allowing to find the direction to any point on the map.
* satellites viewer: see which satellites are used to query your GPS location. Useful to understand why you don't have a good signal
* option to show on lock screen: useful when cycling
* option to force full brightness

## Screenshots

| <img src="fastlane/metadata/android/en-US/images/phoneScreenshots/1_en_US.png" width=276> | <img src="fastlane/metadata/android/en-US/images/phoneScreenshots/2_en_US.png" width=276> | <img src="fastlane/metadata/android/en-US/images/phoneScreenshots/3_en_US.png" width=276> | <img src="fastlane/metadata/android/en-US/images/phoneScreenshots/4_en_US.png" width=276> | <img src="fastlane/metadata/android/en-US/images/phoneScreenshots/5_en_US.png" width=276> | <img src="fastlane/metadata/android/en-US/images/phoneScreenshots/6_en_US.png" width=276> |

### Having issues, suggestions and feedback?

You can,
- [Create an issue here](https://github.com/farfromrefug/alpimaps/issues)
