/** The PMTiles v3 `tile_type` byte (1 vector, 2-5 images), null when the file is no PMTiles v3. */
export function readPMTilesTileType(filePath: string): number | null;
