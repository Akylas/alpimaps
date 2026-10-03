import { HEADER_LENGTH, tileTypeFromHeader } from './pmtilesHeader.common';

export function readPMTilesTileType(filePath: string) {
    const handle = NSFileHandle.fileHandleForReadingAtPath(filePath);
    if (!handle) {
        return null;
    }
    try {
        const data = handle.readDataOfLength(HEADER_LENGTH);
        return tileTypeFromHeader(new Uint8Array(interop.bufferFromData(data)));
    } catch (error) {
        DEV_LOG && console.log('readPMTilesTileType', filePath, error);
        return null;
    } finally {
        handle.closeFile();
    }
}
