// https://github.com/protomaps/PMTiles/blob/main/spec/v3/spec.md#3-header
export const HEADER_LENGTH = 127;
const MAGIC = 'PMTiles';
const VERSION_OFFSET = 7;
const TILE_TYPE_OFFSET = 99;

export function tileTypeFromHeader(header: ArrayLike<number>) {
    if (header.length < HEADER_LENGTH) {
        return null;
    }
    for (let index = 0; index < MAGIC.length; index++) {
        if ((header[index] & 0xff) !== MAGIC.charCodeAt(index)) {
            return null;
        }
    }
    return (header[VERSION_OFFSET] & 0xff) === 3 ? header[TILE_TYPE_OFFSET] & 0xff : null;
}
