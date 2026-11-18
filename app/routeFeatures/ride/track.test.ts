import { describe, expect, it } from 'vitest';
import { MIN_RIDE_METERS, MIN_RIDE_MS, rideOutcome, rideTrack } from '~/routeFeatures/ride/track';

const START = Date.UTC(2026, 10, 2, 8, 12);
const NOW = Date.UTC(2026, 10, 18, 12);
/** metres of latitude */
const METER = 1 / 111320;

/** A fix every `step` seconds, `meters` apart going north. */
function fixes(count: number, { meters, step }: { meters: number; step: number }) {
    return Array.from({ length: count }, (_, index) => ({ lat: 45 + index * meters * METER, lon: 6, timestamp: START + index * step * 1000 }));
}

describe('rideTrack', () => {
    // 4 km in 10 min
    const ride = fixes(41, { meters: 100, step: 15 });

    it('gives the coordinates as lon / lat and the recording of the same fixes', () => {
        const track = rideTrack(ride, NOW);
        expect(track?.coordinates).toHaveLength(41);
        expect(track?.coordinates[0]).toEqual([6, 45]);
        expect(track?.recorded.startedAt).toBe(START);
        expect(track?.recorded.t).toHaveLength(41);
        expect(track?.recorded.t[40]).toBe(600);
    });
    it('measures the ride', () => {
        expect(rideTrack(ride, NOW)?.distance).toBeCloseTo(4000, -1);
    });
    it('leaves out the fixes that did not move: the recording stays one time per coordinate', () => {
        const stopped = [...ride.slice(0, 20), ...Array.from({ length: 10 }, (_, index) => ({ ...ride[19], timestamp: ride[19].timestamp + (index + 1) * 5000 })), ...ride.slice(20)];
        const track = rideTrack(stopped, NOW);
        expect(track?.coordinates).toHaveLength(41);
        expect(track?.recorded.t).toHaveLength(41);
    });
    it('leaves out the fixes the gps itself doubts: a bad accuracy, a speed of a stopped rider', () => {
        // jitter while stopped, 4 m apart: the step filter alone would take it for riding
        const jitter = Array.from({ length: 200 }, (_, index) => ({
            lat: 45.5 + (index % 2) * 4 * METER,
            lon: 6,
            timestamp: ride[40].timestamp + (index + 1) * 1000,
            speed: 0.1,
            horizontalAccuracy: 5
        }));
        expect(rideTrack([...ride, ...jitter], NOW)?.coordinates).toHaveLength(41);
        const vague = ride.map((fix) => ({ ...fix, horizontalAccuracy: 80 }));
        expect(rideTrack(vague, NOW)).toBeNull();
    });
    it('keeps the fixes that carry no speed or accuracy', () => {
        expect(
            rideTrack(
                ride.map((fix) => ({ ...fix, speed: -1 })),
                NOW
            )?.coordinates
        ).toHaveLength(41);
    });
    it('leaves out a fix with no position or no time', () => {
        const track = rideTrack([{ lat: NaN, lon: 6, timestamp: START }, ...ride, { lat: 45.5, lon: 6, timestamp: NaN }], NOW);
        expect(track?.coordinates).toHaveLength(41);
    });
    it(`is none under ${MIN_RIDE_METERS} m`, () => {
        expect(rideTrack(fixes(41, { meters: 10, step: 15 }), NOW)).toBeNull();
    });
    it(`is none under ${MIN_RIDE_MS / 60000} min`, () => {
        expect(rideTrack(fixes(41, { meters: 100, step: 5 }), NOW)).toBeNull();
    });
    it('is none for a session with no fixes, or one', () => {
        expect(rideTrack([], NOW)).toBeNull();
        expect(rideTrack(ride.slice(0, 1), NOW)).toBeNull();
    });
});

describe('rideOutcome', () => {
    it('gives the track of a ride that is kept', () => {
        const outcome = rideOutcome(fixes(41, { meters: 100, step: 15 }), NOW);
        expect('track' in outcome && outcome.track.coordinates).toHaveLength(41);
    });
    it('says no movement when nothing but stopped fixes came: a simulator that sends a speed of 0', () => {
        const stopped = fixes(41, { meters: 100, step: 15 }).map((fix) => ({ ...fix, speed: 0 }));
        expect(rideOutcome(stopped, NOW)).toEqual({ reason: 'no_movement', distance: 0, elapsed: 0 });
        expect(rideOutcome([], NOW)).toEqual({ reason: 'no_movement', distance: 0, elapsed: 0 });
    });
    it('says too short, with what was ridden', () => {
        const outcome = rideOutcome(fixes(41, { meters: 10, step: 15 }), NOW);
        expect(outcome).toMatchObject({ reason: 'too_short', elapsed: 600 });
        expect('distance' in outcome && outcome.distance).toBeCloseTo(400, -1);
    });
    it('says too brief when the distance is there but not the time', () => {
        expect(rideOutcome(fixes(41, { meters: 100, step: 5 }), NOW)).toMatchObject({ reason: 'too_brief', elapsed: 200 });
    });
    it('tells too short before too brief when both fail', () => {
        expect(rideOutcome(fixes(41, { meters: 10, step: 5 }), NOW)).toMatchObject({ reason: 'too_short' });
    });
});
