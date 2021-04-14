import BaseWorker from './BaseWorker';
import SphericalMercator from '~/three/SphericalMercator';
// import { getTiles } from './TileCover';
import { deslash, mPerPixel, slashify } from '~/three/utils';
import { arrayoNativeArray } from './';
require('globals');
const context: Worker = self as any;

const basePlaneDimension = 65024;
const size = 128;
const tilePixels = new SphericalMercator({ size });

const cols = 512;
const rows = 512;
const scaleFactor = 4;

const sixteenthPixelRanges = [];

for (let c = 0; c < scaleFactor; c++) {
    for (let r = 0; r < scaleFactor; r++) {
        //pixel ranges
        sixteenthPixelRanges.push([
            [r * (rows / scaleFactor - 1) + r, ((r + 1) * rows) / scaleFactor],
            [c * (cols / scaleFactor - 1) + c, ((c + 1) * cols) / scaleFactor]
        ]);
    }
}
export default class ParseElevationWorker extends BaseWorker {
    updateTiles({ coords, tiles, parserIndex }: { parserIndex: number; coords: [number, number, number]; tiles: any }) {
        const z = coords[0];
        const x = coords[1];
        const y = coords[2];

        let pixels;
        if (global.isAndroid) {
            const dataSource = akylas.alpi.maps.WorkersContext.getValue('dataSource');
            const data = dataSource.loadTile(new com.carto.core.MapTile(coords[1], coords[2], coords[0], 0));
            const binaryData = (data as com.carto.datasources.components.TileData).getData();
            const bmp = android.graphics.BitmapFactory.decodeByteArray(binaryData.getData(), 0, binaryData.size());
            const w = bmp.getWidth();
            const h = bmp.getHeight();
            pixels = Array.create('int', w * h);
            bmp.getPixels(pixels, 0, w, 0, 0, w, h);
            bmp.recycle();
        }

        //console.log(time+' started #'+parserIndex)

        let elevations = [];

        if (pixels) {
            //colors => elevations
            const length = pixels.length;
            for (let e = 0; e < length; e += 1) {
                const pix = pixels[e];
                const R = (pix >> 16) & 0xff;
                const G = (pix >> 8) & 0xff;
                const B = pix & 0xff;
                elevations.push(-10000 + (R * 256 * 256 + G * 256 + B) * 0.1);
                // elevations.push((R * 256 + G + B / 256) - 32768)
            }
        } else elevations = new Array(1048576).fill(0);
        // figure out tile coordinates of the 16 grandchildren of this tile
        const sixteenths = [];
        for (let c = 0; c < scaleFactor; c++) {
            for (let r = 0; r < scaleFactor; r++) {
                //tile coordinates
                sixteenths.push(slashify([z + 2, x * scaleFactor + c, y * scaleFactor + r]));
            }
        }

        //iterate through sixteenths...

        const tileSize = basePlaneDimension / Math.pow(2, z + 2);
        const vertices = size;
        const segments = vertices - 1;
        const segmentLength = tileSize / segments;

        const meshes = [];
        //check 16 grandchildren of this terrain tile
        sixteenths.forEach(function (s, i) {
            //if this grandchild is actually in view, proceed...
            if (tiles.indexOf(s) > -1) {
                // imagesDownloaded++;
                const d = deslash(s);
                const pxRange = sixteenthPixelRanges[i];
                const elev = [];

                const xOffset = (d[1] + 0.5) * tileSize - basePlaneDimension / 2;
                const yOffset = (d[2] + 0.5) * tileSize - basePlaneDimension / 2;

                //grab its elevations from the 4x4 grid
                for (let r = pxRange[0][0]; r < pxRange[0][1]; r++) {
                    for (let c = pxRange[1][0]; c < pxRange[1][1]; c++) {
                        const currentPixelIndex = r * cols + c;
                        elev.push(elevations[currentPixelIndex]);
                    }
                }
                const array = [];
                let dataIndex = 0;

                //iterate through rows
                for (let r = 0; r < vertices; r++) {
                    const yPx = d[2] * size + r;
                    const pixelLat = tilePixels.ll([x * tileSize, yPx], d[0])[1]; //latitude of this pixel
                    const metersPerPixel = mPerPixel(pixelLat, tileSize, d[0]); //real-world distance this pixel represents

                    // y position of vertex in world pixel coordinates
                    const yPos = -r * segmentLength + tileSize / 2;

                    //iterate through columns
                    for (let c = 0; c < vertices; c++) {
                        const xPos = c * segmentLength - tileSize / 2;
                        array.push(xPos + xOffset, elev[dataIndex] / metersPerPixel, -yPos + yOffset);
                        dataIndex++;
                    }
                }
                console.log('array2', s, array.length);
                akylas.alpi.maps.WorkersContext.setValue(s, arrayoNativeArray(array));
                meshes.push(s);
            }
        });
        // return meshes;
        context.postMessage({ meshes });
    }
}

const worker = new ParseElevationWorker();
context.onmessage = ((event: {
    data: {
        pixels: any;
        coords: [number, number, number];
        tiles: any;
        parserIndex: number;
        position: [number, number, number];
    };
}) => {
    worker.updateTiles(event.data);
}) as any;
