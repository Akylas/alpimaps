import { describe, expect, it } from 'vitest';
import { SNAPSHOT_OLD_MS, STAMP_REUSE_MS, TIME_LAYERS, departurePassed, fixedStart, floatsWithClock, isSnapshot, resolveStart, snapshotOutdated, stampNow } from './departure';
import { changedInputs, layerInputsHash } from './freshness';
import { DEFAULT_PACE, withDeparture, withNowStamp } from './storage';
import type { AnalysisInputs, Departure } from './types';

const NOW = Date.UTC(2026, 5, 1, 15, 0, 0);
const MINUTE = 60_000;

function inputs(departure: Departure): AnalysisInputs {
    return { departure, pace: { ...DEFAULT_PACE }, geometryKey: 'k' };
}

describe('now snapshot', () => {
    it('is a now that was stamped, not a floating one, a plan or a recording', () => {
        expect(isSnapshot({ mode: 'now', at: NOW })).toBe(true);
        expect(isSnapshot({ mode: 'now' })).toBe(false);
        expect(isSnapshot({ mode: 'planned', at: NOW })).toBe(false);
        expect(isSnapshot({ mode: 'recorded', at: NOW })).toBe(false);
    });

    it('floats with the clock only as a now that was never stamped', () => {
        expect(floatsWithClock({ mode: 'now' })).toBe(true);
        expect(floatsWithClock({ mode: 'now', at: NOW })).toBe(false);
        expect(floatsWithClock({ mode: 'planned', at: NOW })).toBe(false);
        expect(floatsWithClock({ mode: 'recorded', at: NOW })).toBe(false);
    });

    it('has a fixed start for a plan and a snapshot only', () => {
        expect(fixedStart({ mode: 'planned', at: NOW })).toBe(NOW);
        expect(fixedStart({ mode: 'now', at: NOW })).toBe(NOW);
        expect(fixedStart({ mode: 'now' })).toBeUndefined();
        expect(fixedStart({ mode: 'recorded', at: NOW })).toBeUndefined();
    });

    it('stamps a now with the time, and nothing else', () => {
        expect(stampNow({ mode: 'now' }, NOW)).toEqual({ mode: 'now', at: NOW });
        expect(stampNow({ mode: 'now', tz: 'Europe/Paris', utcOffset: 120 }, NOW)).toEqual({ mode: 'now', at: NOW, tz: 'Europe/Paris', utcOffset: 120 });
        const planned: Departure = { mode: 'planned', at: NOW + 1 };
        expect(stampNow(planned, NOW)).toBe(planned);
        const recorded: Departure = { mode: 'recorded', at: NOW - 1 };
        expect(stampNow(recorded, NOW)).toBe(recorded);
    });

    it('stamps again once the stamp is old, and keeps a recent one so layers computed together share it', () => {
        const stamped: Departure = { mode: 'now', at: NOW };
        expect(stampNow(stamped, NOW + STAMP_REUSE_MS - 1)).toBe(stamped);
        expect(stampNow(stamped, NOW + STAMP_REUSE_MS)).toEqual({ mode: 'now', at: NOW + STAMP_REUSE_MS });
        // a clock set back is not a recent stamp
        expect(stampNow(stamped, NOW - 1)).toEqual({ mode: 'now', at: NOW - 1 });
    });

    it('is outdated once it is older than a quarter of an hour, never a floating now or a plan', () => {
        expect(snapshotOutdated({ mode: 'now', at: NOW }, NOW + SNAPSHOT_OLD_MS - 1)).toBe(false);
        expect(snapshotOutdated({ mode: 'now', at: NOW }, NOW + SNAPSHOT_OLD_MS)).toBe(true);
        expect(snapshotOutdated({ mode: 'now' }, NOW + 5 * SNAPSHOT_OLD_MS)).toBe(false);
        expect(snapshotOutdated({ mode: 'planned', at: NOW }, NOW + 5 * SNAPSHOT_OLD_MS)).toBe(false);
    });

    it('stamps the analysis, keeping the object when there is nothing to change', () => {
        const analysis = { v: 1 as const, inputs: inputs({ mode: 'now' }), layers: {} };
        const stamped = withNowStamp(analysis, NOW);
        expect(stamped.inputs.departure).toEqual({ mode: 'now', at: NOW });
        expect(withNowStamp(stamped, NOW + MINUTE)).not.toBe(stamped);
        expect(withNowStamp(stamped, NOW + 1)).toBe(stamped);
        const planned = { ...analysis, inputs: inputs({ mode: 'planned', at: NOW + MINUTE }) };
        expect(withNowStamp(planned, NOW)).toBe(planned);
    });

    it('stamps the layers that read the time of the ride, not the ones of the ground', () => {
        expect(TIME_LAYERS).toEqual(['weather', 'sun']);
    });

    it('hashes the layers that depend on the departure per stamp', () => {
        const first = inputs({ mode: 'now', at: NOW });
        const second = inputs({ mode: 'now', at: NOW + MINUTE });
        expect(changedInputs(first, second)).toEqual(['departure']);
        expect(layerInputsHash('sun', first)).not.toBe(layerInputsHash('sun', second));
        expect(layerInputsHash('terrain', first)).toBe(layerInputsHash('terrain', second));
        expect(changedInputs(inputs({ mode: 'now' }), first)).toEqual(['departure']);
    });
});

describe('a plan that went by and was kept', () => {
    const kept: Departure = { mode: 'planned', at: NOW - 2 * 3600000, keepPast: true };

    it('is read at its own time, not moved to now', () => {
        expect(resolveStart(kept, NOW)).toBe(NOW - 2 * 3600000);
        expect(resolveStart({ ...kept, keepPast: undefined }, NOW)).toBe(NOW);
    });

    it('has not passed: nothing to offer', () => {
        expect(departurePassed(kept, NOW)).toBe(false);
        expect(departurePassed({ ...kept, keepPast: false }, NOW)).toBe(true);
    });

    it('changes what layers are hashed with, the time being read otherwise', () => {
        const plain = inputs({ mode: 'planned', at: NOW - 2 * 3600000 });
        expect(changedInputs(plain, inputs(kept))).toEqual(['departure']);
        expect(layerInputsHash('sun', plain)).not.toBe(layerInputsHash('sun', inputs(kept)));
    });

    it("keeps its flag through the user's new departure only when it says so", () => {
        const analysis = { v: 1 as const, inputs: inputs({ mode: 'planned', at: NOW + 3600000 }), layers: {} };
        const geometry = { type: 'LineString' as const, coordinates: [] };
        expect(withDeparture(analysis, geometry, kept).inputs.departure.keepPast).toBe(true);
        expect(withDeparture(withDeparture(analysis, geometry, kept), geometry, { mode: 'planned', at: NOW + 7200000 }).inputs.departure.keepPast).toBeUndefined();
    });
});
