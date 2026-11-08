/** The sun layer of a route analysis: where the terrain hides the sun, asked of the SDK in calls. Pure: nothing here may import NativeScript. */
import { readSun } from '~/routeFeatures/sun/read';
import { EYE_HEIGHT, type ExposureChunk, type ExposureSample, chunkSamples, mergeExposure } from '~/routeFeatures/sun/terrain/exposure';
import { type LayerExtra, hashParts, layerInputsHash } from '~/utils/routeAnalysis/freshness';
import { type CancelSignal, StageError, type StageItem } from '~/utils/routeAnalysis/pipeline';
import type { AnalysisInputs, Layer, RouteAnalysis, SunData } from '~/utils/routeAnalysis/types';

/** What the SDK is asked beyond the points: the eyes' height, how long it may wait for tiles, and whether this call is the last of the route. */
export interface ExposureOptions {
    eyeHeight: number;
    last: boolean;
}

/** Asks the SDK for the sun at the samples of one call. */
export type ExposureAsker = (samples: ExposureSample[], options: ExposureOptions) => Promise<ExposureChunk>;

/** The version of what asks and what answers: a new one makes the layers of the old one out of date. */
const ALGORITHM = 1;
/** Which elevation model the SDK reads; the app has one. Its package date is not known to the app, so an update of it does not age the layer. */
const DEM = 'hillshade';

export function sunExtras(): LayerExtra {
    return { algo: ALGORITHM, dem: DEM };
}

export async function computeTerrainLayer({
    analysis,
    expose,
    inputs,
    item,
    now,
    progress,
    signal
}: {
    item: StageItem;
    analysis: RouteAnalysis;
    inputs: AnalysisInputs;
    now: number;
    expose: ExposureAsker;
    signal?: Pick<CancelSignal, 'aborted'>;
    progress?: (value: number) => void;
}): Promise<Layer<SunData>> {
    // the sun is read for the ride as the inputs time it: the samples are those the lens draws, so the answers fit them
    const read = readSun({ ...item, analysis: { ...analysis, inputs } }, now);
    if (!read?.samples.length) {
        throw new StageError('error', 'no route to read the terrain of');
    }
    const eyeHeight = EYE_HEIGHT[read.kind];
    const calls = chunkSamples(read.samples.map(({ altitude, azimuth, lat, lon }) => ({ lat, lon, azimuth, altitude })));
    const answers: ExposureChunk[] = [];
    for (let index = 0; index < calls.length; index++) {
        // an abandoned run is dropped: asking more would only keep the SDK busy, and what it holds is the layer's
        if (signal?.aborted) {
            throw new StageError('error', 'abandoned');
        }
        answers.push(await expose(calls[index], { eyeHeight, last: index === calls.length - 1 }));
        progress?.((index + 1) / calls.length);
    }
    const shade = mergeExposure(answers);
    const { departure, pace } = inputs;
    return {
        prov: {
            computedAt: now,
            inputsHash: layerInputsHash('sun', inputs, sunExtras()),
            provider: `massif-sdk/sunExposure@${ALGORITHM}`,
            dataVersion: DEM,
            quality: shade.coverage < 1 ? 'partial' : 'ok'
        },
        data: {
            step: read.step,
            lit: shade.lit,
            flags: shade.flags,
            coverage: shade.coverage,
            params: { kind: read.kind, eyeHeight, algo: ALGORITHM },
            basis: { departureHash: hashParts(departure.mode, departure.at, JSON.stringify(departure.days)), paceHash: hashParts(JSON.stringify(pace)) }
        }
    };
}

/** What the lens reads of the layer: its shares lit, when it is of the ride as the inputs time it now. */
export function freshTerrain(analysis: RouteAnalysis | null | undefined): { step: number; lit: number[] } | undefined {
    const layer = analysis?.layers.sun;
    if (!analysis || !layer?.data.lit || layer.prov.inputsHash !== layerInputsHash('sun', analysis.inputs, sunExtras())) {
        return undefined;
    }
    return { step: layer.data.step, lit: layer.data.lit };
}
