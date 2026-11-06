/** The weather layer of a route: where to ask, what to keep. Pure: nothing here may import NativeScript. */
import { routeCoordinates } from '~/routeFeatures/lens/sections';
import { type LayerExtra, layerInputsHash, weatherCoverage } from '~/utils/routeAnalysis/freshness';
import { StageError, type StageItem } from '~/utils/routeAnalysis/pipeline';
import { flatSpeedKmh } from '~/utils/routeAnalysis/speeds';
import { buildTimeline, timelineSource } from '~/utils/routeAnalysis/timeline';
import type { AnalysisInputs, Layer, WeatherData } from '~/utils/routeAnalysis/types';
import { type WeatherProvider, type WeatherQuery, type WeatherResponse, roundCoordinate } from '~/routeFeatures/weather/providers/provider';
import { sampleRoute } from '~/routeFeatures/weather/data/samples';
import { quantiseSeries } from '~/routeFeatures/weather/data/series';

const HOUR = 3600;

/** What the layer is hashed with beyond the route: another provider or coarser points give another layer. */
export function weatherExtras(providerId: string, decimals: number): LayerExtra {
    return { provider: providerId, decimals };
}

export type WeatherFetcher = (query: WeatherQuery) => Promise<{ provider: Pick<WeatherProvider, 'id' | 'source'>; response: WeatherResponse }>;

/**
 * Samples the route, asks the provider for the hours the ride is under way and 3 h either side, and keeps
 * them. The provider's coordinates are rounded: the route never leaves the phone more exactly than that.
 */
export async function computeWeatherLayer({
    decimals,
    fetch,
    inputs,
    item,
    now
}: {
    item: StageItem;
    inputs: AnalysisInputs;
    now: number;
    decimals: 1 | 2;
    fetch: WeatherFetcher;
}): Promise<Layer<WeatherData>> {
    const coordinates = routeCoordinates(item.geometry);
    if (coordinates.length < 2) {
        throw new StageError('error', 'no route to ask the weather of');
    }
    const source = timelineSource(item);
    const timeline = buildTimeline(source, inputs, now);
    const window = weatherCoverage(timeline.startAt, timeline.totalSec);
    const samples = sampleRoute({ distances: source.distances, altitudes: source.altitudes, speedKmh: flatSpeedKmh(inputs.activity) });
    const points = samples.map(({ alt, i: index }) => ({ lat: roundCoordinate(coordinates[index][1], decimals), lon: roundCoordinate(coordinates[index][0], decimals), alt }));

    const { provider, response } = await fetch({ points, from: window.from, to: window.to });

    const coverage = { from: response.t0, to: response.t0 + (response.n - 1) * HOUR };
    const rideFrom = timeline.startAt / 1000;
    const complete = coverage.from <= rideFrom && coverage.to >= rideFrom + timeline.totalSec;
    return {
        prov: {
            computedAt: now,
            inputsHash: layerInputsHash('weather', inputs, weatherExtras(provider.id, decimals)),
            provider: provider.source,
            source: 'forecast',
            coverage,
            quality: complete ? 'ok' : 'partial'
        },
        data: {
            // an altitude the route did not have is not known: 0 stands for it, the provider used its own terrain
            samples: samples.map(({ alt, d, i: index }) => ({ i: index, d, alt: Number.isFinite(alt) ? alt : 0 })),
            t0: response.t0,
            n: response.n,
            v: quantiseSeries(response.series, response.n),
            request: { decimals, vars: response.vars, models: response.models },
            tz: response.tz,
            utcOffset: response.utcOffset
        }
    };
}
