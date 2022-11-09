export function createParserWorker() {
    return new Worker('~/workers/ParseElevationWorker');
}
