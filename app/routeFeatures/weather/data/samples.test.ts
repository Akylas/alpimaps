import { describe, expect, it } from 'vitest';
import { sampleRoute } from '~/routeFeatures/weather/data/samples';

/** A vertex every 100 m. */
function route(km: number, altitudeAt: (meters: number) => number = () => 500) {
    const count = Math.round(km * 10) + 1;
    const distances = Float64Array.from({ length: count }, (_, index) => index * 100);
    return { distances, altitudes: Float64Array.from(distances, altitudeAt) };
}

describe('sampleRoute', () => {
    it('has nothing to sample on an empty route', () => {
        expect(sampleRoute({ distances: [], speedKmh: 4 })).toEqual([]);
    });

    it('samples a single point once', () => {
        expect(sampleRoute({ distances: [0], altitudes: [812], speedKmh: 4 })).toEqual([{ i: 0, d: 0, alt: 812 }]);
    });

    it('always has the start and the finish', () => {
        const samples = sampleRoute({ ...route(23), speedKmh: 4 });
        expect(samples[0]).toEqual({ i: 0, d: 0, alt: 500 });
        expect(samples[samples.length - 1]).toEqual({ i: 230, d: 23000, alt: 500 });
    });

    it('takes a sample every 3 km on foot, 30 min of walking being less', () => {
        const samples = sampleRoute({ ...route(12), speedKmh: 4 });
        expect(samples.map((sample) => sample.d)).toEqual([0, 3000, 6000, 9000, 12000]);
    });

    it('takes a sample every half hour of riding, 10 km at 20 km/h', () => {
        const samples = sampleRoute({ ...route(50), speedKmh: 20 });
        expect(samples.map((sample) => sample.d)).toEqual([0, 10000, 20000, 30000, 40000, 50000]);
    });

    it('never goes over 15 km between two samples', () => {
        const samples = sampleRoute({ ...route(90), speedKmh: 50 });
        expect(samples.map((sample) => sample.d)).toEqual([0, 15000, 30000, 45000, 60000, 75000, 90000]);
    });

    it('keeps indexes in order and without twins', () => {
        const samples = sampleRoute({ ...route(60, (meters) => 500 + 600 * Math.sin(meters / 3000)), speedKmh: 4 });
        samples.slice(1).forEach((sample, position) => expect(sample.i).toBeGreaterThan(samples[position].i));
    });

    it('stays within 40 samples by spacing them further apart', () => {
        const samples = sampleRoute({ ...route(300), speedKmh: 4 });
        expect(samples.length).toBeLessThanOrEqual(40);
        expect(samples[samples.length - 1].d).toBe(300000);
    });

    it('adds the summit between two samples when it stands 400 m over them', () => {
        // flat at 500 m with a pass of 1100 m at 12.5 km, between the samples of 10 and 15 km
        const peak = (meters: number) => 500 + Math.max(0, 600 - Math.abs(meters - 12500) * 0.5);
        const samples = sampleRoute({ ...route(25, peak), speedKmh: 20 });
        const summit = samples.find((sample) => sample.d === 12500);
        expect(summit?.alt).toBe(1100);
    });

    it('does not add a bump of less than 400 m', () => {
        const bump = (meters: number) => 500 + Math.max(0, 300 - Math.abs(meters - 12500) * 0.5);
        const samples = sampleRoute({ ...route(25, bump), speedKmh: 20 });
        expect(samples.map((sample) => sample.d)).toEqual([0, 10000, 20000, 25000]);
    });

    it('merges samples closer than 2 km at the same height, and keeps the finish', () => {
        // 10.5 km at 20 km/h: the sample at 10 km is 500 m from the finish
        const samples = sampleRoute({ ...route(10.5), speedKmh: 20 });
        expect(samples.map((sample) => sample.d)).toEqual([0, 10500]);
    });

    it('keeps two samples close together when their heights differ by 150 m or more', () => {
        const samples = sampleRoute({ ...route(10.5, (meters) => (meters > 10000 ? 700 : 500)), speedKmh: 20 });
        expect(samples.map((sample) => sample.d)).toEqual([0, 10000, 10500]);
    });

    it('rounds the altitudes', () => {
        const samples = sampleRoute({ distances: [0, 5000], altitudes: [812.4, 1000.6], speedKmh: 4 });
        expect(samples.map((sample) => sample.alt)).toEqual([812, 1001]);
    });

    it('has no altitude to give when the route has none', () => {
        const [first] = sampleRoute({ distances: [0, 5000], speedKmh: 4 });
        expect(first.alt).toBeNaN();
    });
});
