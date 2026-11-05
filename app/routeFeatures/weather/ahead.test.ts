import { describe, expect, it } from 'vitest';
import { DEFAULT_PACE } from '~/utils/routeAnalysis/storage';
import type { RouteAnalysis, WeatherData } from '~/utils/routeAnalysis/types';
import { type WeatherVar, quantise } from '~/utils/routeAnalysis/weatherSeries';
import { weatherAhead } from './ahead';

const HOUR = 3600;
const T0 = Date.UTC(2026, 5, 1) / 1000;
const DEPART = (T0 + 6 * HOUR) * 1000;
// the ride is half an hour under way
const NOW = DEPART + 30 * 60 * 1000;
const HOURS = 24;

// 10 km north in 101 vertices, routed in 2 h; the three samples are at vertexes 0, 50 and 100
const coordinates = Array.from({ length: 101 }, (_, index) => [6, 45 + (index * 100) / 111320]);
const geometry = { type: 'LineString' as const, coordinates };
const samples = [0, 50, 100].map((index) => ({ i: index, d: index * 100, alt: 1000 }));

type Series = Partial<Record<WeatherVar, number[]>>;
function layer(bySample: Series[]): WeatherData {
    const column = (variable: WeatherVar, fallback: number) => bySample.map((sample) => quantise(variable, sample[variable] ?? Array<number>(HOURS).fill(fallback)));
    return {
        samples,
        t0: T0,
        n: HOURS,
        v: {
            temp: column('temp', 10),
            precip: column('precip', 0),
            precipProb: column('precipProb', 0),
            wind: column('wind', 0),
            gust: column('gust', 0),
            dir: column('dir', 0),
            cloud: column('cloud', 0),
            code: column('code', 0),
            fl: column('fl', 2500),
            dni: column('dni', 0)
        },
        request: { decimals: 2, vars: [], models: 'best_match' }
    };
}
const constant = (value: number) => Array<number>(HOURS).fill(value);
/** 3 mm/h in the hours before 7 h and 8 h: the middle of the route */
const rainy = layer([{}, { precip: Array.from({ length: HOURS }, (_, hour) => (hour === 7 || hour === 8 ? 3 : 0)) }, {}]);

function item(data: WeatherData | null) {
    const analysis: RouteAnalysis = {
        v: 1,
        inputs: { departure: { mode: 'planned', at: DEPART }, pace: { ...DEFAULT_PACE }, geometryKey: 'k' },
        layers: data ? { weather: { prov: { computedAt: NOW, inputsHash: 'h', provider: 'open-meteo/forecast', quality: 'ok' }, data } } : {}
    };
    return { geometry, route: { totalTime: 2 * HOUR }, analysis };
}

describe('weatherAhead', () => {
    it('has nothing without a forecast', () => {
        expect(weatherAhead(item(null), NOW, { fromIndex: 10 })).toBeNull();
    });

    it('says when and where the next rain starts, how hard and for how long, timed from now', () => {
        const ahead = weatherAhead(item(rainy), NOW, { fromIndex: 10 });
        expect(ahead?.raining).toBe(false);
        // 15 vertexes of 1.2 min, 1.5 km
        expect(ahead?.rain?.inMinutes).toBeCloseTo(18, 0);
        expect(ahead?.rain?.ahead).toBeCloseTo(1500, 0);
        expect(ahead?.rain?.mmPerHour).toBe(3);
        expect(ahead?.rain?.lastsMinutes).toBeCloseTo(60, 0);
    });

    it('says it is raining, and for how much longer, from inside the rain', () => {
        const ahead = weatherAhead(item(rainy), NOW, { fromIndex: 40 });
        expect(ahead?.raining).toBe(true);
        expect(ahead?.rain?.inMinutes).toBe(0);
        // 35 vertexes to the end of it
        expect(ahead?.rain?.lastsMinutes).toBeCloseTo(42, 0);
    });

    it('has no rain once it is behind', () => {
        const ahead = weatherAhead(item(rainy), NOW, { fromIndex: 80 });
        expect(ahead?.raining).toBe(false);
        expect(ahead?.rain).toBeUndefined();
    });

    it('is dry on a dry route', () => {
        expect(weatherAhead(item(layer([{}, {}, {}])), NOW, { fromIndex: 10 })?.rain).toBeUndefined();
    });

    it('reads the time from the speed the rider really goes: a rider twice as fast gets there in half the time', () => {
        const ahead = weatherAhead(item(rainy), NOW, { fromIndex: 10, speedFactor: 1.5 });
        expect(ahead?.rain?.inMinutes).toBeCloseTo(12, 0);
    });

    it('says the temperature here and at the finish', () => {
        const ahead = weatherAhead(item(layer([{ temp: constant(4) }, {}, { temp: constant(17) }])), NOW, { fromIndex: 10 });
        expect(ahead?.temp).toEqual({ here: 4, finish: 17 });
    });

    it('is the share of what is left that is against the wind', () => {
        const headwind = layer([{}, { wind: constant(20), dir: constant(0) }, {}]);
        expect(weatherAhead(item(headwind), NOW, { fromIndex: 0 })?.headShare).toBeCloseTo(0.5, 2);
        expect(weatherAhead(item(headwind), NOW, { fromIndex: 50 })?.headShare).toBeCloseTo(0.5, 2);
        expect(weatherAhead(item(headwind), NOW, { fromIndex: 75 })?.headShare).toBe(0);
    });

    it('knows a thunderstorm ahead, not one behind', () => {
        const storm = layer([{}, { code: constant(95) }, {}]);
        expect(weatherAhead(item(storm), NOW, { fromIndex: 10 })?.thunder).toBe(true);
        expect(weatherAhead(item(storm), NOW, { fromIndex: 80 })?.thunder).toBe(false);
    });
});
