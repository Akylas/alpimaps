import { describe, expect, it } from 'vitest';
import { sampleRoute } from '~/routeFeatures/weather/data/samples';

/** A vertex every 100 m. */
function route(km: number, altitudeAt: (meters: number) => number = () => 500) {
    const count = Math.round(km * 10) + 1;
    const distances = Float64Array.from({ length: count }, (_, index) => index * 100);
    return { distances, altitudes: Float64Array.from(distances, altitudeAt) };
}
const at = (samples: { d: number }[]) => samples.map((sample) => sample.d);

describe('sampleRoute', () => {
    it('has nothing to sample on an empty route', () => {
        expect(sampleRoute({ distances: [] })).toEqual([]);
    });

    it('samples a single point once', () => {
        expect(sampleRoute({ distances: [0], altitudes: [812] })).toEqual([{ i: 0, d: 0, alt: 812 }]);
    });

    it('always has the start and the finish', () => {
        const samples = sampleRoute(route(3));
        expect(samples[0]).toEqual({ i: 0, d: 0, alt: 500 });
        expect(samples[samples.length - 1]).toEqual({ i: 30, d: 3000, alt: 500 });
        expect(samples).toHaveLength(2);
    });

    it('asks every 10 km, whatever the way it is ridden: a weather system is wider', () => {
        expect(at(sampleRoute(route(27)))).toEqual([0, 10000, 20000, 27000]);
        expect(at(sampleRoute(route(60)))).toEqual([0, 10000, 20000, 30000, 40000, 50000, 60000]);
    });

    it('keeps indexes in order and without twins', () => {
        const samples = sampleRoute(route(60, (meters) => 500 + 600 * Math.sin(meters / 3000)));
        samples.slice(1).forEach((sample, position) => expect(sample.i).toBeGreaterThan(samples[position].i));
    });

    it('stays within 40 samples by spacing them further apart', () => {
        const samples = sampleRoute(route(1000));
        expect(samples.length).toBeLessThanOrEqual(40);
        expect(samples[samples.length - 1].d).toBe(1000000);
    });

    it('adds a sample each time the route has climbed 400 m since the one before', () => {
        // 1000 m up over the first 5 km, then flat
        const climb = (meters: number) => Math.min(1000, meters / 5);
        const samples = sampleRoute(route(27, climb));
        expect(at(samples)).toEqual([0, 2000, 4000, 10000, 20000, 27000]);
        expect(samples.map((sample) => sample.alt)).toEqual([0, 400, 800, 1000, 1000, 1000]);
    });

    it('adds them on the way down too', () => {
        const descent = (meters: number) => 1500 - Math.min(1000, meters / 5);
        expect(at(sampleRoute(route(12, descent)))).toEqual([0, 2000, 4000, 10000, 12000]);
    });

    it('does not add one for a climb of less than 400 m between the samples', () => {
        expect(at(sampleRoute(route(27, (meters) => meters / 70)))).toEqual([0, 10000, 20000, 27000]);
    });

    it('merges samples closer than 2 km at the same height, and keeps the finish', () => {
        expect(at(sampleRoute(route(10.5)))).toEqual([0, 10500]);
    });

    it('keeps two samples close together when their heights differ by 150 m or more', () => {
        expect(at(sampleRoute(route(10.5, (meters) => (meters > 10000 ? 700 : 500))))).toEqual([0, 10000, 10500]);
    });

    it('rounds the altitudes', () => {
        expect(sampleRoute({ distances: [0, 5000], altitudes: [812.4, 1000.6] }).map((sample) => sample.alt)).toEqual([812, 1001]);
    });

    it('has no altitude to give when the route has none, and no sample for the height', () => {
        const samples = sampleRoute({ distances: [0, 5000, 10000, 15000] });
        expect(samples[0].alt).toBeNaN();
        expect(at(samples)).toEqual([0, 10000, 15000]);
    });
});
