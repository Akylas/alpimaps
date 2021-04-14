export function createParserWorker() {
    return new Worker('~/workers/ParseElevationWorker');
}
export function createArrayBuffer(length: number) {
    const bb = java.nio.ByteBuffer.allocateDirect(length);

    // var bb = java.nio.ByteBuffer.allocateDirect(length * 4).order(java.nio.ByteOrder.LITTLE_ENDIAN);
    const result = (ArrayBuffer as any).from(bb);
    // result.bb = bb;
    return result;
}
export function pointsFromBuffer(buffer: ArrayBuffer, useInts = false) {
    return ((buffer as any).nativeObject as java.nio.ByteBuffer).array();
}
export function arrayoNativeArray(array) {
    if (!Array.isArray(array)) {
        return array;
    }
    const length = array.length;
    const buffer = createArrayBuffer(length);
    const arrayBuffer = new Int8Array(buffer);
    arrayBuffer.set(array);

    return pointsFromBuffer(buffer);
}
