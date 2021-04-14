import Martini from '@mapbox/martini';
import { getMeshBoundingBox } from '@loaders.gl/loader-utils';
import { ImageAsset, ImageData, WebGL2RenderingContext, WebGLRenderingContext } from '@nativescript/canvas';

function getTerrain(imageData, tileSize, elevationDecoder) {
    const { rScaler, bScaler, gScaler, offset } = elevationDecoder;

    const gridSize = tileSize + 1;
    // From Martini demo
    // https://observablehq.com/@mourner/martin-real-time-rtin-terrain-mesh
    const terrain = new Float32Array(gridSize * gridSize);
    // decode terrain values
    for (let i = 0, y = 0; y < tileSize; y++) {
        for (let x = 0; x < tileSize; x++, i++) {
            const k = i * 4;
            const r = imageData[k + 0];
            const g = imageData[k + 1];
            const b = imageData[k + 2];
            terrain[i + y] = r * rScaler + g * gScaler + b * bScaler + offset;
        }
    }
    // backfill bottom border
    for (let i = gridSize * (gridSize - 1), x = 0; x < gridSize - 1; x++, i++) {
        terrain[i] = terrain[i - gridSize];
    }
    // backfill right border
    for (let i = gridSize - 1, y = 0; y < gridSize; y++, i += gridSize) {
        terrain[i] = terrain[i - 1];
    }
    return terrain;
}

function getMeshAttributes(vertices, terrain, tileSize, bounds) {
    const gridSize = tileSize + 1;
    const numOfVerticies = vertices.length / 2;
    // vec3. x, y in pixels, z in meters
    const positions = new Float32Array(numOfVerticies * 3);
    // vec2. 1 to 1 relationship with position. represents the uv on the texture image. 0,0 to 1,1.
    const texCoords = new Float32Array(numOfVerticies * 2);

    const [minX, minY, maxX, maxY] = bounds || [0, 0, tileSize, tileSize];
    const xScale = (maxX - minX) / tileSize;
    const yScale = (maxY - minY) / tileSize;

    for (let i = 0; i < numOfVerticies; i++) {
        const x = vertices[i * 2];
        const y = vertices[i * 2 + 1];
        const pixelIdx = y * gridSize + x;

        positions[3 * i + 0] = x * xScale + minX;
        positions[3 * i + 1] = -y * yScale + maxY;
        positions[3 * i + 2] = terrain[pixelIdx];

        texCoords[2 * i + 0] = x / tileSize;
        texCoords[2 * i + 1] = y / tileSize;
    }

    return {
        POSITION: { value: positions, size: 3 },
        TEXCOORD_0: { value: texCoords, size: 2 }
        // NORMAL: {}, - optional, but creates the high poly look with lighting
    };
}

function getMartiniTileMesh(terrainImage, terrainOptions) {
    if (terrainImage === null) {
        return null;
    }
    const { meshMaxError, bounds, elevationDecoder } = terrainOptions;

    const data = terrainImage.data;
    const tileSize = terrainImage.width;
    const gridSize = tileSize + 1;

    const terrain = getTerrain(data, tileSize, elevationDecoder);

    const martini = new Martini(gridSize);
    const tile = martini.createTile(terrain);
    const { vertices, triangles } = tile.getMesh(meshMaxError);

    const attributes = getMeshAttributes(vertices, terrain, tileSize, bounds);

    return {
        // Data return by this loader implementation
        loaderData: {
            header: {}
        },
        header: {
            vertexCount: triangles.length,
            boundingBox: getMeshBoundingBox(attributes)
        },
        mode: 4, // TRIANGLES
        indices: { value: triangles, size: 1 },
        attributes
    };
}

export default async function loadTerrain(arrayBuffer, options, context?) {
    //   options.image = options.image || {};
    //   options.image.type = 'data';
    //   const image = await context.parse(arrayBuffer, options, options.baseUri);
    // Extend function to support additional mesh generation options (square grid or delatin)
    return new Promise((resolve, reject) => {
        (akylas.alpi.maps as any).MartiniMesh.getMartiniTileMesh(
            arrayBuffer.nativeObject,
            JSON.stringify(options.myterrain),
            new (akylas.alpi.maps as any).MartiniMesh.Callback({
                onError(error) {
                    console.error('onError', error, Object.keys(error));
                    reject(error);
                },
                onSuccess(triangles: any[], positions: any[], texCoords: any[], boundingBox: number[][]) {
                    const trianglesData = new Uint32Array((ArrayBuffer as any).from(triangles));
                    const positionsData = new Float32Array((ArrayBuffer as any).from(positions));
                    const texCoordsData = new Float32Array((ArrayBuffer as any).from(texCoords));
                    console.log('onSuccess', trianglesData.length, trianglesData[0], positionsData[0], texCoordsData[0]);
                    const bbox = [];
                    for (let i = 0; i < boundingBox.length; i++) {
                        const subArray = boundingBox[i];
                        const sub = [];
                        for (let j = 0; j < subArray.length; j++) {
                            sub[j] = subArray[j];
                        }
                        bbox[i] = sub;
                    }
                    resolve({
                        // Data return by this loader implementation
                        loaderData: {
                            header: {}
                        },
                        header: {
                            vertexCount: trianglesData.length,
                            boundingBox: bbox
                        },
                        mode: 4, // TRIANGLES
                        indices: { value: trianglesData, size: 1 },
                        attributes: {
                            POSITION: { value: positionsData, size: 3 },
                            TEXCOORD_0: { value: texCoordsData, size: 2 }
                            // NORMAL: {}, - optional, but creates the high poly look with lighting
                        }
                    });
                }
            })
        );
    });

    // const image = new ImageAsset();
    // await image.loadFromBytesAsync(new Uint8Array(arrayBuffer));
    // const result = await createImageBitmap(image as any);
    // //@ts-ignore
    // const imageData = new ImageData(result.native);
    // console.log('loadTerrain', result, options.myterrain);
    // return getMartiniTileMesh(imageData, options.myterrain);
}
