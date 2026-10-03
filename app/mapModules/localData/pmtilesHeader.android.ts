import { HEADER_LENGTH, tileTypeFromHeader } from './pmtilesHeader.common';

// streams core already uses: a class absent from the metadata whitelist is not callable
export function readPMTilesTileType(filePath: string) {
    let stream: java.io.DataInputStream;
    try {
        stream = new java.io.DataInputStream(new java.io.FileInputStream(filePath));
        const header = Array.create('byte', HEADER_LENGTH);
        stream.readFully(header);
        return tileTypeFromHeader(header);
    } catch (error) {
        DEV_LOG && console.log('readPMTilesTileType', filePath, error);
        return null;
    } finally {
        stream?.close();
    }
}
