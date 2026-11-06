import { describe, expect, it } from 'vitest';
import type { WeatherData } from '~/utils/routeAnalysis/types';
import { MISSING, bearingAt, quantise, rainClass, readRide, readSample, windRelative } from '~/routeFeatures/weather/data/series';

const HOUR = 3600;
const T0 = 1_800_000_000 - (1_800_000_000 % HOUR);
const at = (hours: number) => (T0 + hours * HOUR) * 1000;

/** One sample, five hours. Values are already quantised. */
function layer(overrides: Partial<WeatherData['v']> = {}): WeatherData {
    const zeros = [[0, 0, 0, 0, 0]];
    return {
        samples: [{ i: 0, d: 0, alt: 1000 }],
        t0: T0,
        n: 5,
        v: { temp: zeros, precip: zeros, precipProb: zeros, wind: zeros, gust: zeros, dir: zeros, cloud: zeros, code: zeros, fl: zeros, dni: zeros, ...overrides },
        request: { decimals: 2, vars: [], models: '' }
    };
}

describe('quantise', () => {
    it('keeps a tenth of a degree, of a millimeter and of a km/h', () => {
        expect(quantise('temp', [3.34, -0.06])).toEqual([33, -1]);
        expect(quantise('precip', [0.25, 12.04])).toEqual([3, 120]);
        expect(quantise('wind', [18.26])).toEqual([183]);
        expect(quantise('gust', [41.9])).toEqual([419]);
    });

    it('keeps the others to the unit', () => {
        expect(quantise('dir', [271.6])).toEqual([272]);
        expect(quantise('cloud', [88.2])).toEqual([88]);
        expect(quantise('fl', [2301.7])).toEqual([2302]);
    });

    it('marks an hour the provider has no value for', () => {
        expect(quantise('precipProb', [null, 40, undefined])).toEqual([MISSING, 40, MISSING]);
    });
});

describe('readSample', () => {
    const data = layer({ temp: [[100, 120, 80, 80, 80]], dir: [[350, 10, 0, 0, 0]], code: [[1, 61, 61, 3, 3]], precip: [[0, 20, 0, 0, 0]], precipProb: [[MISSING, 30, 30, 30, 30]] });

    it('reads a time on the hour as its value in real units', () => {
        expect(readSample(data, 0, at(1))?.temp).toBe(12);
    });

    it('interpolates between two hours', () => {
        expect(readSample(data, 0, at(0.5))?.temp).toBeCloseTo(11, 5);
        expect(readSample(data, 0, at(1.5))?.temp).toBeCloseTo(10, 5);
    });

    it('turns the short way round for a direction', () => {
        // 350 to 10 passes through north, not through south
        expect(readSample(data, 0, at(0.5))?.dir).toBeCloseTo(0, 5);
    });

    it('takes the weather code of the nearest hour', () => {
        expect(readSample(data, 0, at(0.4))?.code).toBe(1);
        expect(readSample(data, 0, at(0.6))?.code).toBe(61);
    });

    it('reads the rain of the hour a time is in: the value stamped at the end of it', () => {
        // the 2 mm stamped at +1 h fell between 0 h and +1 h
        expect(readSample(data, 0, at(0.5))?.precip).toBe(2);
        expect(readSample(data, 0, at(1.5))?.precip).toBe(0);
    });

    it('is blank where the hour has no value, and keeps the neighbour when there is one', () => {
        expect(readSample(data, 0, at(0))?.precipProb).toBeUndefined();
        expect(readSample(data, 0, at(0.5))?.precipProb).toBe(30);
    });

    it('has nothing outside the fetched hours', () => {
        expect(readSample(data, 0, at(-0.5))).toBeUndefined();
        expect(readSample(data, 0, at(4.5))).toBeUndefined();
        expect(readSample(data, 1, at(1))).toBeUndefined();
    });
});

describe('windRelative', () => {
    it('is a headwind when it comes from where you are going', () => {
        const { cross, head } = windRelative(20, 0, 0);
        expect(head).toBeCloseTo(20, 5);
        expect(cross).toBeCloseTo(0, 5);
    });

    it('is a tailwind when it comes from behind', () => {
        expect(windRelative(20, 180, 0).head).toBeCloseTo(-20, 5);
    });

    it('is a crosswind from the right when it comes from the right', () => {
        const { cross, head } = windRelative(20, 90, 0);
        expect(head).toBeCloseTo(0, 5);
        expect(cross).toBeCloseTo(20, 5);
        expect(windRelative(20, 270, 0).cross).toBeCloseTo(-20, 5);
    });

    it('wraps round north', () => {
        expect(windRelative(10, 350, 20).head).toBeCloseTo(10 * Math.cos((30 * Math.PI) / 180), 5);
    });
});

describe('rainClass', () => {
    it('is dry under 0.1 mm/h, then light, steady and heavy', () => {
        expect([0, 0.09, 0.1, 0.99, 1, 3.99, 4, 20].map(rainClass)).toEqual([0, 0, 1, 1, 2, 2, 3, 3]);
    });
});

describe('bearingAt', () => {
    // a route going north for 2 km, then east for 2 km: a vertex every 500 m
    const north = (index: number) => [6, 45 + (index * 0.5) / 111.32];
    const coordinates = [...[0, 1, 2, 3, 4].map(north), ...[1, 2, 3, 4].map((step) => [6 + (step * 0.5) / (111.32 * Math.cos((45 * Math.PI) / 180)), north(4)[1]])];
    const distances = coordinates.map((_, index) => index * 500);

    it('is where the route goes within 300 m of the point, not where the next vertex is', () => {
        expect(bearingAt(coordinates, distances, 1)).toBeCloseTo(0, 0);
        expect(bearingAt(coordinates, distances, 6)).toBeCloseTo(90, 0);
    });

    it('turns at the bend', () => {
        const bend = bearingAt(coordinates, distances, 4);
        expect(bend).toBeGreaterThan(30);
        expect(bend).toBeLessThan(60);
    });

    it('looks forward at the start and backward at the finish', () => {
        expect(bearingAt(coordinates, distances, 0)).toBeCloseTo(0, 0);
        expect(bearingAt(coordinates, distances, 8)).toBeCloseTo(90, 0);
    });

    it('has none on a route of one point', () => {
        expect(bearingAt([[6, 45]], [0], 0)).toBeUndefined();
    });
});

describe('readRide', () => {
    // going north, 3 samples, the wind from the north at 20 km/h from hour 1
    const coordinates = [0, 1, 2].map((index) => [6, 45 + (index * 3) / 111.32]);
    const distances = [0, 3000, 6000];
    const data: WeatherData = {
        ...layer(),
        samples: [
            { i: 0, d: 0, alt: 1000 },
            { i: 1, d: 3000, alt: 1200 },
            { i: 2, d: 6000, alt: 1400 }
        ],
        v: {
            ...layer().v,
            temp: [0, 1, 2].map(() => [100, 100, 100, 100, 100]),
            wind: [0, 1, 2].map(() => [200, 200, 200, 200, 200]),
            dir: [0, 1, 2].map(() => [0, 0, 0, 0, 0])
        }
    };

    it('reads each sample at the time the ride is there', () => {
        const ride = readRide(data, { at: (index) => at(index * 0.5), coordinates, distances });
        expect(ride.map((entry) => entry.at)).toEqual([at(0), at(0.5), at(1)]);
        expect(ride[2].reading?.temp).toBe(10);
    });

    it('works out the wind against the way the ride goes', () => {
        const [first] = readRide(data, { at: () => at(1), coordinates, distances });
        expect(first.head).toBeCloseTo(20, 3);
        expect(first.cross).toBeCloseTo(0, 3);
    });

    it('has no reading for a sample the ride reaches after the fetched hours', () => {
        const ride = readRide(data, { at: (index) => at(index * 3), coordinates, distances });
        expect(ride[0].reading).toBeDefined();
        expect(ride[2].reading).toBeUndefined();
        expect(ride[2].head).toBeUndefined();
    });
});
