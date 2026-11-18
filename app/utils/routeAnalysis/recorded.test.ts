import { DOMParser } from '@xmldom/xmldom';
import { gpx } from '@tmcw/togeojson';
import { describe, expect, it } from 'vitest';
import { buildRecorded, recordedFromGpx, recordedFromLocations, rideFigures } from './recorded';

const NOW = Date.UTC(2026, 10, 18, 12);
const START = Date.UTC(2026, 10, 2, 8, 12);

function gpxProperties(xml: string) {
    return gpx(new DOMParser().parseFromString(xml, 'application/xml')).features[0].properties;
}

const point = (second: number, withTime = true) => `<trkpt lat="45" lon="6">${withTime ? `<time>${new Date(START + second * 1000).toISOString()}</time>` : ''}</trkpt>`;

describe('buildRecorded', () => {
    it('gives seconds from the first fix', () => {
        expect(buildRecorded([START, START + 10_000, START + 25_500], NOW)).toEqual({ startedAt: START, t: [0, 10, 25.5] });
    });
    it('interpolates the fixes with no time, by position', () => {
        const times = Array.from({ length: 11 }, (_, index) => START + index * 10_000);
        times[4] = NaN;
        expect(buildRecorded(times, NOW)?.t).toEqual([0, 10, 20, 30, 40, 50, 60, 70, 80, 90, 100]);
    });
    it('gives the edge fixes with no time the time of their neighbour', () => {
        const timed = Array.from({ length: 10 }, (_, index) => START + index * 10_000);
        expect(buildRecorded([NaN, ...timed], NOW)?.t[0]).toBe(0);
        expect(buildRecorded([NaN, ...timed], NOW)?.t[1]).toBe(0);
        expect(buildRecorded([...timed, NaN], NOW)?.t[10]).toBe(90);
    });
    it('never goes back in time', () => {
        expect(buildRecorded([START, START + 10_000, START + 5_000, START + 20_000], NOW)?.t).toEqual([0, 10, 10, 20]);
    });
    it('is none for a track with too few times', () => {
        const times = [START, START + 1000, NaN, NaN, NaN, NaN, NaN, NaN, NaN, NaN];
        expect(buildRecorded(times, NOW)).toBeNull();
    });
    it('is none for a track that does not last', () => {
        expect(buildRecorded([START, START, START], NOW)).toBeNull();
        expect(buildRecorded([START], NOW)).toBeNull();
        expect(buildRecorded([], NOW)).toBeNull();
    });
    it('is none for a ride that starts in the future', () => {
        expect(buildRecorded([NOW + 60_000, NOW + 120_000], NOW)).toBeNull();
    });
});

describe('recordedFromGpx', () => {
    it('reads the times @tmcw/togeojson gives a track', () => {
        const properties = gpxProperties(`<gpx><trk><trkseg>${point(0)}${point(10)}${point(30)}</trkseg></trk></gpx>`);
        expect(recordedFromGpx(properties, 3, NOW)).toEqual({ startedAt: START, t: [0, 10, 30] });
    });
    it('reads a track in several segments as one', () => {
        const properties = gpxProperties(`<gpx><trk><trkseg>${point(0)}${point(10)}</trkseg><trkseg>${point(600)}${point(610)}</trkseg></trk></gpx>`);
        expect(recordedFromGpx(properties, 4, NOW)?.t).toEqual([0, 10, 600, 610]);
    });
    it('is none for a track without times', () => {
        const properties = gpxProperties(`<gpx><trk><trkseg>${point(0, false)}${point(10, false)}</trkseg></trk></gpx>`);
        expect(recordedFromGpx(properties, 2, NOW)).toBeNull();
    });
    it('is none when a time is missing: the togeojson times no longer line up with the vertexes', () => {
        const properties = gpxProperties(`<gpx><trk><trkseg>${point(0)}${point(10)}${point(20, false)}</trkseg></trk></gpx>`);
        expect(recordedFromGpx(properties, 3, NOW)).toBeNull();
    });
    it('is none for times that are not dates', () => {
        expect(recordedFromGpx({ coordinateProperties: { times: ['x', 'y'] } }, 2, NOW)).toBeNull();
        expect(recordedFromGpx(undefined, 2, NOW)).toBeNull();
    });
});

describe('recordedFromLocations', () => {
    it('reads the fixes of a session', () => {
        expect(recordedFromLocations([{ timestamp: START }, { timestamp: START + 5000 }], NOW)).toEqual({ startedAt: START, t: [0, 5] });
    });
});

describe('rideFigures', () => {
    // 100 m every 10 s, a 5 min stop, then 100 m in 10 s
    const distances = [0, 100, 200, 200, 300];
    const t = [0, 10, 20, 320, 330];
    it('leaves the stops out of the moving time', () => {
        const figures = rideFigures(t, distances);
        expect(figures.elapsedSec).toBe(330);
        expect(figures.movingSec).toBe(30);
    });
    it('averages the speed over the moving time, km/h', () => {
        expect(rideFigures(t, distances).avgSpeed).toBeCloseTo(36, 5);
    });
    it('has no speed for a ride that did not move', () => {
        expect(rideFigures([0, 10], [0, 0])).toEqual({ elapsedSec: 10, movingSec: 0, avgSpeed: 0 });
    });
    it('copes with no fixes', () => {
        expect(rideFigures([], [])).toEqual({ elapsedSec: 0, movingSec: 0, avgSpeed: 0 });
    });
});
