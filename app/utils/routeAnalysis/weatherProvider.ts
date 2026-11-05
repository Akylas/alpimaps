/** What the app asks of a weather source, so another can stand in for it. Pure: nothing here may import NativeScript. */
import type { LayerReason } from './freshness';
import type { WeatherVar } from './weatherSeries';

export interface WeatherPoint {
    lat: number;
    lon: number;
    /** metres, NaN when the route has none: the source then uses its own terrain model */
    alt: number;
}

/** The hours to give, epoch seconds on the hour. The source may give more or, at the end of its horizon, less. */
export interface WeatherQuery {
    points: WeatherPoint[];
    from: number;
    to: number;
}

/** What a source gives for a query, in real units, null for an hour it has no value for. Every point has the same hours. */
export interface WeatherResponse {
    /** the first hour, epoch seconds, and how many hours follow */
    t0: number;
    n: number;
    series: Partial<Record<WeatherVar, (number | null)[]>>[];
    /** the zone of the first point and its offset then, in minutes east of UTC */
    tz?: string;
    utcOffset?: number;
    /** what was asked of the source, kept with the layer to tell what it was computed from */
    vars: string[];
    models: string;
}

/** Gets a JSON document. The source does not know how: the app has its own network layer. */
export type WeatherHttp = (url: string) => Promise<unknown>;

export interface WeatherAttribution {
    text: string;
    url: string;
    license: string;
}

export interface WeatherProvider {
    id: string;
    name: string;
    /** the layer's `provenance.provider` */
    source: string;
    attribution: WeatherAttribution;
    /** points in one query */
    maxPoints: number;
    /** Throws `WeatherProviderError` for what it understands: a window out of its range, a limit reached. */
    fetch(query: WeatherQuery, http: WeatherHttp): Promise<WeatherResponse>;
}

/** The reason is what the layer's status says. */
export class WeatherProviderError extends Error {
    constructor(
        public reason: LayerReason,
        message?: string
    ) {
        super(message ?? reason);
    }
}

export const DEFAULT_WEATHER_PROVIDER = 'open-meteo';

const providers = new Map<string, WeatherProvider>();

export function registerWeatherProvider(provider: WeatherProvider) {
    providers.set(provider.id, provider);
}

/** The provider asked for, else the default one. */
export function getWeatherProvider(id?: string): WeatherProvider | undefined {
    return providers.get(id) ?? providers.get(DEFAULT_WEATHER_PROVIDER);
}

export function weatherProviders(): WeatherProvider[] {
    return [...providers.values()];
}

/** A coordinate rounded to `decimals`: 2 is about a kilometer, finer than any forecast model. */
export function roundCoordinate(value: number, decimals: number) {
    const scale = 10 ** decimals;
    return Math.round(value * scale) / scale;
}
