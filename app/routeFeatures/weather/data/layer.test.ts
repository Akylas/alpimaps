import { describe, expect, it } from 'vitest';
import { layerInputsHash, weatherCoverage } from '~/utils/routeAnalysis/freshness';
import { StageError } from '~/utils/routeAnalysis/pipeline';
import { DEFAULT_PACE } from '~/utils/routeAnalysis/storage';
import type { AnalysisInputs } from '~/utils/routeAnalysis/types';
import type { WeatherQuery, WeatherResponse } from '~/routeFeatures/weather/providers/provider';
import { MISSING } from '~/routeFeatures/weather/data/series';
import { type WeatherFetcher, computeWeatherLayer, weatherExtras } from '~/routeFeatures/weather/data/layer';

const HOUR = 3600;
const DAY = 86400;
const NOW = Date.UTC(2026, 5, 1, 12, 0, 0);
const DEPART = NOW + 2 * HOUR * 1000;

// 20 km north from 45.1234 / 6.4321, a vertex every 100 m, climbing from 1000 m to 1400 m; routed in 5 h
const COUNT = 201;
const coordinates = Array.from({ length: COUNT }, (_, index) => [6.4321, 45.1234 + (index * 100) / 111320]);
const item = {
    geometry: { type: 'LineString' as const, coordinates },
    profile: { data: coordinates.map((_, index) => ({ d: index * 100, a: 1000 + index * 2 })) },
    route: { totalTime: 5 * HOUR }
};
const inputs: AnalysisInputs = { activity: { kind: 'hike', subtype: 'walk', origin: 'user' }, departure: { mode: 'planned', at: DEPART }, pace: { ...DEFAULT_PACE }, geometryKey: 'k' };

/** What a provider answers: the window asked, the temperature at 12.3 °C. */
function answer(query: WeatherQuery, overrides: Partial<WeatherResponse> = {}): WeatherResponse {
    const n = (query.to - query.from) / HOUR + 1;
    const hours = (value: number) => Array<number>(n).fill(value);
    return {
        t0: query.from,
        n,
        series: query.points.map(() => ({ temp: hours(12.34), precip: hours(0.25), wind: hours(18.26), dir: hours(270) })),
        tz: 'Europe/Paris',
        utcOffset: 120,
        vars: ['temperature_2m'],
        models: 'best_match',
        ...overrides
    };
}

function fetcher(overrides: Partial<WeatherResponse> | ((query: WeatherQuery) => Partial<WeatherResponse>) = {}) {
    const queries: WeatherQuery[] = [];
    const fetch: WeatherFetcher = async (query) => {
        queries.push(query);
        return { provider: { id: 'open-meteo', source: 'open-meteo/forecast' }, response: answer(query, typeof overrides === 'function' ? overrides(query) : overrides) };
    };
    return { fetch, queries };
}

const compute = (fetch: WeatherFetcher, overrides: Partial<Parameters<typeof computeWeatherLayer>[0]> = {}) => computeWeatherLayer({ item, inputs, now: NOW, decimals: 2, fetch, ...overrides });

describe('computeWeatherLayer', () => {
    it('asks the weather of the ride, the hours it is under way and 3 h either side', async () => {
        const { fetch, queries } = fetcher();
        await compute(fetch);
        // 5 h routed, as the pace is neutral
        expect({ from: queries[0].from, to: queries[0].to }).toEqual(weatherCoverage(DEPART, 5 * HOUR));
    });

    it('asks the points along the route with their altitude, the coordinates rounded', async () => {
        const { fetch, queries } = fetcher();
        await compute(fetch);
        const [start, ...others] = queries[0].points;
        expect(start).toEqual({ lat: 45.12, lon: 6.43, alt: 1000 });
        expect(others[others.length - 1]).toEqual({ lat: 45.3, lon: 6.43, alt: 1400 });
        expect(queries[0].points.length).toBeGreaterThan(2);
    });

    it('rounds coarser when the setting says so', async () => {
        const { fetch, queries } = fetcher();
        await compute(fetch, { decimals: 1 });
        expect(queries[0].points[0]).toEqual({ lat: 45.1, lon: 6.4, alt: 1000 });
    });

    it('keeps the sample positions of the route, not the rounded ones', async () => {
        const { fetch } = fetcher();
        const { data } = await compute(fetch);
        expect(data.samples[0]).toEqual({ i: 0, d: 0, alt: 1000 });
        expect(data.samples[data.samples.length - 1]).toEqual({ i: COUNT - 1, d: 20000, alt: 1400 });
    });

    it('stores the hours quantised, a variable the provider did not give as missing', async () => {
        const { fetch } = fetcher();
        const { data } = await compute(fetch);
        expect(data.v.temp[0][0]).toBe(123);
        expect(data.v.precip[0][0]).toBe(3);
        expect(data.v.wind[1][0]).toBe(183);
        expect(data.v.dir[0][0]).toBe(270);
        expect(data.v.dni[0][0]).toBe(MISSING);
        expect(data.v.temp).toHaveLength(data.samples.length);
        expect(data.v.temp[0]).toHaveLength(data.n);
    });

    it('keeps the hours the provider gave and what it was asked', async () => {
        const { fetch, queries } = fetcher();
        const { data } = await compute(fetch);
        expect(data.t0).toBe(queries[0].from);
        expect(data.n).toBe((queries[0].to - queries[0].from) / HOUR + 1);
        expect(data.request).toEqual({ decimals: 2, vars: ['temperature_2m'], models: 'best_match' });
    });

    it('keeps the zone the provider reported', async () => {
        const { data } = await compute(fetcher().fetch);
        expect(data.tz).toBe('Europe/Paris');
        expect(data.utcOffset).toBe(120);
    });

    it('says where it comes from and what it is good for', async () => {
        const { fetch, queries } = fetcher();
        const { prov } = await compute(fetch);
        expect(prov.provider).toBe('open-meteo/forecast');
        expect(prov.source).toBe('forecast');
        expect(prov.computedAt).toBe(NOW);
        expect(prov.quality).toBe('ok');
        expect(prov.coverage).toEqual({ from: queries[0].from, to: queries[0].to });
        expect(prov.inputsHash).toBe(layerInputsHash('weather', inputs, weatherExtras('open-meteo', 2)));
    });

    it('is another layer for another provider or coarser points', () => {
        const hash = (providerId: string, decimals: number) => layerInputsHash('weather', inputs, weatherExtras(providerId, decimals));
        expect(hash('open-meteo', 2)).not.toBe(hash('open-meteo', 1));
        expect(hash('open-meteo', 2)).not.toBe(hash('meteo-france', 2));
    });

    it('is partial when the forecast stops before the ride does', async () => {
        const { fetch } = fetcher((query) => ({ t0: query.from, n: 10 }));
        const { prov } = await compute(fetch, {});
        expect(prov.quality).toBe('partial');
        expect(prov.coverage).toEqual({ from: weatherCoverage(DEPART, 5 * HOUR).from, to: weatherCoverage(DEPART, 5 * HOUR).from + 9 * HOUR });
    });

    it('lets the provider use its own terrain when the route has no profile, the altitude kept as 0', async () => {
        const { fetch, queries } = fetcher();
        const { data } = await compute(fetch, { item: { geometry: item.geometry, route: item.route } });
        expect(Number.isNaN(queries[0].points[0].alt)).toBe(true);
        expect(data.samples[0].alt).toBe(0);
    });

    it('reads a ride that leaves now from now', async () => {
        const { fetch, queries } = fetcher();
        await compute(fetch, { inputs: { ...inputs, departure: { mode: 'now' } } });
        expect({ from: queries[0].from, to: queries[0].to }).toEqual(weatherCoverage(NOW, 5 * HOUR));
        expect(queries[0].to - queries[0].from).toBeGreaterThanOrEqual(DAY);
    });

    it('has nothing to ask on a route of one point', async () => {
        const { fetch, queries } = fetcher();
        await expect(compute(fetch, { item: { geometry: { type: 'LineString', coordinates: [[6, 45]] } } })).rejects.toBeInstanceOf(StageError);
        expect(queries).toHaveLength(0);
    });
});
