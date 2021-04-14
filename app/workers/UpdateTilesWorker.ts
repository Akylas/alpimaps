import BaseWorker from './BaseWorker';
import { tiles } from '@mapbox/tile-cover';
import { R, degToRad, fmod, getBaseLog, radToDeg, slashify, unproject } from '~/three/utils';

// require('globals');
// const context: Worker = self as any;

function displaceLatLng(point, distance, radian) {
    const lat1Radians = degToRad(point[1]);
    const lon1Radians = degToRad(point[0]);
    const distanceRadians = distance / R;
    const lat = Math.asin(
        Math.sin(lat1Radians) * Math.cos(distanceRadians) + Math.cos(lat1Radians) * Math.sin(distanceRadians) * Math.cos(radian)
    );
    let lon;
    if (Math.cos(lat) === 0) {
        lon = lon1Radians;
    } else {
        lon =
            fmod(lon1Radians - Math.asin((Math.sin(radian) * Math.sin(distanceRadians)) / Math.cos(lat)) + Math.PI, 2 * Math.PI) -
            Math.PI;
    }
    return [radToDeg(lon), radToDeg(lat)];
}
export default class UpdateTilesWorker extends BaseWorker {
    updateTiles({
        zoom,
        azimuth,
        fov,
        distance,
        position
    }: {
        zoom: number;
        azimuth: number;
        fov: number;
        distance: number;
        position: { x: number; y: number };
    }) {
        distance *= 1000;
        fov /= 4;
        azimuth = radToDeg(azimuth);
        const angleDistance = distance / Math.cos(degToRad(fov / 2));
        const aroundDistance = Math.sin(degToRad(fov / 2)) * angleDistance;

        const latlon = unproject(position);
        const point1 = displaceLatLng(latlon, angleDistance, degToRad(azimuth + fov / 2));
        const point2 = displaceLatLng(latlon, angleDistance, degToRad(azimuth - fov / 2));
        // const dist = getDistanceSimple(point1, point2);
        const point3 = displaceLatLng(latlon, aroundDistance / 10, degToRad(azimuth + 90));
        const point4 = displaceLatLng(latlon, aroundDistance / 10, degToRad(azimuth - 90));
        // const bbox = getBoundsOfDistance(latlon, distance * 1000);
        const box = {
            type: 'Polygon',
            coordinates: [[point1, point2, point4, point3, point1]]
        };
        // using tile-cover, figure out which tiles are inside viewshed and put in zxy order
        const satelliteTiles: [number, number, number][] = tiles(box, { min_zoom: zoom, max_zoom: zoom }).map(function ([
            x,
            y,
            z
        ]) {
            return [z, x, y];
        });

        if (satelliteTiles.length === 0) return { imageTiles: [], elevationTiles: [] };

        const imageTiles: [number, number, number][] = [];

        for (let s = 0; s < satelliteTiles.length; s++) {
            const tile = satelliteTiles[s];
            imageTiles.push(tile);
        }

        const elevations: { [k: string]: any[] } = {};

        //assemble list of elevations, as grandparent tiles of imagery
        for (let t = 0; t < imageTiles.length; t++) {
            const deslashed = imageTiles[t];
            const grandparent = [deslashed[0] - 2, Math.floor(deslashed[1] / 4), Math.floor(deslashed[2] / 4)].join(',');
            if (elevations[grandparent]) elevations[grandparent].push(deslashed);
            else elevations[grandparent] = [deslashed];
        }

        const elevationTiles: [number, number, number][] = Object.keys(elevations).map(function (triplet) {
            return triplet.split(',').map(function (num) {
                return parseFloat(num);
            }) as [number, number, number];
        });
        return { imageTiles, elevationTiles };
        // context.postMessage({ getTiles: [imageTiles, elevationTiles] });
    }
}

// const worker = new UpdateTilesWorker();
// context.onmessage = ((event: {
//     data: { zoom: number; azimuth: number; fov: number; distance: number; position: [number, number] };
// }) => {
//     worker.updateTiles(event.data);
// }) as any;
