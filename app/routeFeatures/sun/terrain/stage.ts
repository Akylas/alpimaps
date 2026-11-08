import { computeTerrainLayer, sunExtras } from '~/routeFeatures/sun/terrain/layer';
import { exposeSamples, terrainShadeAvailable } from '~/routeFeatures/sun/terrain/service';
import { type AnalysisStage, StageError } from '~/utils/routeAnalysis/pipeline';

/** Where the terrain hides the sun along the ride. Runs when asked: a first compute, an update, and a departure the user took. */
export const sunStage: AnalysisStage = {
    layer: 'sun',
    extra: sunExtras,
    async run({ analysis, inputs, item, progress, signal }) {
        if (!terrainShadeAvailable()) {
            throw new StageError('no-dem');
        }
        return computeTerrainLayer({ item, analysis, inputs, now: Date.now(), expose: exposeSamples, signal, progress });
    }
};
