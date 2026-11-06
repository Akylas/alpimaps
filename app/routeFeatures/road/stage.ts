import { networkService } from '~/services/NetworkService';
import { packageService } from '~/services/PackageService';
import { RISK_EDGE_ATTRIBUTES, riskCandidates } from '~/routeFeatures/road/risk';
import { layerInputsHash } from '~/utils/routeAnalysis/freshness';
import { type AnalysisStage, StageError } from '~/utils/routeAnalysis/pipeline';

/** Matches the route on the road graph for the tagged speed and the cycle lane of each edge. Only for a bike route. */
export const riskStage: AnalysisStage = {
    layer: 'risk',
    // the offline routing service is one singleton, shared with the other stages that ask it
    resource: 'routing',
    async run({ inputs, item }) {
        if (inputs.activity?.kind !== 'bike') {
            throw new StageError('error', 'road risk is for bike routes');
        }
        if (!packageService.offlineRoutingSearchService() && !networkService.connected) {
            throw new StageError('offline');
        }
        const edges = await packageService.getStats({ item, profile: 'bicycle', attributes: RISK_EDGE_ATTRIBUTES });
        if (!edges) {
            throw new StageError('error', 'no route to match');
        }
        const { candidates, unknown } = riskCandidates(edges);
        return {
            prov: {
                computedAt: Date.now(),
                inputsHash: layerInputsHash('risk', inputs),
                provider: packageService.offlineRoutingSearchService() ? 'valhalla-offline' : 'valhalla-online',
                quality: 'ok'
            },
            data: { v: 1 as const, src: 'valhalla' as const, candidates, unknown }
        };
    }
};
