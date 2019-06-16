import { MapBounds, MapPos, ScreenBounds } from 'nativescript-carto/core/core';
import { ScreenMetrics } from 'tns-core-modules/platform/platform';

const TO_RAD = Math.PI / 180;
const TO_DEG = 180 / Math.PI;
const PI_X2 = Math.PI * 2;
const PI_DIV4 = Math.PI / 4;

/**
 * Calculates the center of a collection of geo coordinates
 *
 * @param        array       Collection of coords [{lat: 51.510, lon: 7.1321} {lat: 49.1238, lon: "8° 30' W"} ...]
 * @return       object      {lat: centerLat, lon: centerLng}
 */
export function getCenter(...coords: MapPos[]) {
    if (!coords.length) {
        return undefined;
    }

    let X = 0.0;
    let Y = 0.0;
    let Z = 0.0;
    let lat, lon, hyp, coord;

    for (let i = 0, l = coords.length; i < l; ++i) {
        coord = coords[i];
        lat = coord.lat * TO_RAD;
        lon = coord.lon * TO_RAD;

        X += Math.cos(lat) * Math.cos(lon);
        Y += Math.cos(lat) * Math.sin(lon);
        Z += Math.sin(lat);
    }

    const nb_coords = coords.length;
    X = X / nb_coords;
    Y = Y / nb_coords;
    Z = Z / nb_coords;

    lon = Math.atan2(Y, X);
    hyp = Math.sqrt(X * X + Y * Y);
    lat = Math.atan2(Z, hyp);

    return {
        lat: (lat * TO_DEG),
        lon: (lon * TO_DEG)
    } as MapPos;
}

export function getBoundsZoomLevel(bounds: MapBounds, mapDim: { width: number; height: number }, worldDim = 256) {
    const zoomMax = 24;

    function latRad(lat) {
        const sin = Math.sin((lat * Math.PI) / 180);
        const radX2 = Math.log((1 + sin) / (1 - sin)) / 2;
        return Math.max(Math.min(radX2, Math.PI), -Math.PI) / 2;
    }

    function zoom(mapPx, worldPx, fraction) {
        return Math.round(Math.log(mapPx / worldPx / fraction) / Math.LN2);
    }

    const ne = bounds.northeast;
    const sw = bounds.southwest;

    const latFraction = (latRad(ne.lat) - latRad(sw.lat)) / Math.PI;

    const lngDiff = ne.lon - sw.lon;
    const lngFraction = (lngDiff < 0 ? lngDiff + 360 : lngDiff) / 360;

    const latZoom = zoom(mapDim.height, worldDim, latFraction);
    const lngZoom = zoom(mapDim.width, worldDim, lngFraction);

    return Math.min(Math.min(latZoom, lngZoom), zoomMax);
}
