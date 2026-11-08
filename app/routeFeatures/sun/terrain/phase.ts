/** Where the terrain shade of a route stands, for the lens to say and to offer. Pure: nothing here may import NativeScript. */
import type { LayerState } from '~/utils/routeAnalysis/freshness';

export type TerrainPhase = 'off' | 'compute' | 'update' | 'running' | 'failed' | 'fresh';

/**
 * `off`: the SDK cannot read the terrain here, or the user left it out. `compute`, `update`: nothing, or something out of date, to read it
 * from; a layer is out of date when the departure or the pace went by.
 */
export function terrainPhase({ available, enabled, hasLayer, state }: { available: boolean; enabled: boolean; state: LayerState; hasLayer: boolean }): TerrainPhase {
    if (!available || !enabled) {
        return 'off';
    }
    if (state === 'queued' || state === 'running') {
        return 'running';
    }
    if (state === 'failed') {
        return 'failed';
    }
    if (state === 'fresh' || state === 'pinned') {
        return 'fresh';
    }
    return hasLayer ? 'update' : 'compute';
}
