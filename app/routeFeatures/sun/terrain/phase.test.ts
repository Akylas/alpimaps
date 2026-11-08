import { describe, expect, it } from 'vitest';
import { terrainPhase } from '~/routeFeatures/sun/terrain/phase';

const base = { available: true, enabled: true, hasLayer: false };

describe('terrainPhase', () => {
    it('is off where the SDK cannot read the terrain, or the user left it out', () => {
        expect(terrainPhase({ ...base, available: false, state: 'absent' })).toBe('off');
        expect(terrainPhase({ ...base, enabled: false, state: 'fresh', hasLayer: true })).toBe('off');
    });

    it('offers to compute before there is a layer', () => {
        expect(terrainPhase({ ...base, state: 'absent' })).toBe('compute');
    });

    it('offers to update a layer whose departure or pace went by', () => {
        expect(terrainPhase({ ...base, state: 'inputs-changed', hasLayer: true })).toBe('update');
    });

    it('is running while a run is queued or on its way, whatever the layer was', () => {
        expect(terrainPhase({ ...base, state: 'queued', hasLayer: true })).toBe('running');
        expect(terrainPhase({ ...base, state: 'running' })).toBe('running');
    });

    it('is failed after a failed run, and fresh for a layer that is of the ride as it is timed', () => {
        expect(terrainPhase({ ...base, state: 'failed' })).toBe('failed');
        expect(terrainPhase({ ...base, state: 'fresh', hasLayer: true })).toBe('fresh');
        expect(terrainPhase({ ...base, state: 'pinned', hasLayer: true })).toBe('fresh');
    });
});
