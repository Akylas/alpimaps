import SphericalMercator from './SphericalMercator';

export function getBaseLog(base, result) {
    return Math.log(result) / Math.log(base);
}

export function slashify(input) {
    return input.join('/');
}

export function deslash(input) {
    return input.split('/').map(function (str) {
        return parseInt(str, 10);
    });
}

const basePlaneDimension = 65024;
const mercator = new SphericalMercator({ size: basePlaneDimension });
export function unproject(pt: { x: number; y: number }) {
    const lngLat = mercator.ll([pt.x + basePlaneDimension / 2, pt.y + basePlaneDimension / 2], 0);
    return lngLat;
}
export function degToRad(v) {
    return v * (Math.PI / 180);
}
export function radToDeg(v) {
    return (180 * v) / Math.PI;
}
export const MIN_LAT = degToRad(-90);
export const MAX_LAT = degToRad(90);
export const MIN_LON = degToRad(-180);
export const MAX_LON = degToRad(180);
export const PI_X2 = Math.PI * 2;

export const R = 6378137;
export function fmod(a, b) {
    return Number((a - Math.floor(a / b) * b).toPrecision(8));
}
export function mPerPixel(latitude, tileSize, zoom) {
    return Math.abs((40075000 * Math.cos((latitude * Math.PI) / 180)) / (Math.pow(2, zoom) * tileSize));
}

const totalCount = 49152;
const rowCount = 384;
//above, left, below, right
const neighborTiles = [
    [0, 0, -1],
    [0, -1, 0],
    [0, 0, 1],
    [0, 1, 0]
];
const row = [[], [], [], []];

//get specific pixel indices of each edge
for (let c = 0; c < rowCount; c += 3) {
    //top, left, bottom, right
    row[0].push(c + 1);
    row[1].push((c / 3) * rowCount + 1);
    row[2].push(c + 1 + totalCount - rowCount);
    row[3].push((c / 3 + 1) * rowCount - 2);
}

//fill seam between elevation tiles by adopting the edge of neighboring tiles
export function resolveSeams(scene, data: number[], [z, x, y]) {
    //iterate through neighbors
    neighborTiles.forEach(function (tile, index) {
        //figure out neighbor tile coordinate
        const targetTile = tile.map(function (coord, index) {
            return coord + [z, x, y][index];
        });

        //if neighbor exists,
        const neighbor = scene.getObjectByProperty('coords', slashify(targetTile));
        if (neighbor) {
            // indices that need to be overwritten
            const indicesToChange = row[index];
            //indices of neighbor vertices to copy
            const neighborIndices = row[(index + 2) % 4];
            const neighborVertices = neighbor.geometry.attributes.position.array;

            for (let a = 0; a < 128; a++) {
                data[indicesToChange[a]] = neighborVertices[neighborIndices[a]];
            }
        }
    });
    return data;
}
