import type { LineString, MultiLineString } from 'geojson';
import { describe, expect, it } from 'vitest';
import { activityFromRoute, activityOf, needsActivity } from './activity';
import { geometryKey } from './geometryKey';
import { createAnalysis, parseAnalysis, reconcileAnalysis, withActivity } from './storage';
import type { Layer } from './types';

function line(vertexCount: number): LineString {
    return { type: 'LineString', coordinates: Array.from({ length: vertexCount }, (_, index) => [6 + index * 0.001, 45 + Math.sin(index) * 0.001]) };
}

const weatherLayer = { prov: { computedAt: 1, inputsHash: 'h', provider: 'test', quality: 'ok' }, data: {} } as Layer<any>;

describe('geometryKey', () => {
    it('is stable for the same shape', () => {
        expect(geometryKey(line(200))).toBe(geometryKey(line(200)));
    });
    it('changes when a vertex is added, moved or dropped', () => {
        const key = geometryKey(line(200));
        expect(geometryKey(line(201))).not.toBe(key);
        const moved = line(200);
        moved.coordinates[0] = [6.5, 45.5];
        expect(geometryKey(moved)).not.toBe(key);
        const shortened = line(200);
        shortened.coordinates.pop();
        expect(geometryKey(shortened)).not.toBe(key);
    });
    it('ignores the altitude an export appends', () => {
        const withAltitude = line(200);
        withAltitude.coordinates.forEach((coordinate) => coordinate.push(1500));
        expect(geometryKey(withAltitude)).toBe(geometryKey(line(200)));
    });
    it('reads a MultiLineString as its flattened vertices', () => {
        const multi: MultiLineString = { type: 'MultiLineString', coordinates: [line(5).coordinates, line(5).coordinates] };
        expect(geometryKey(multi).startsWith('10:')).toBe(true);
    });
    it('copes with a single vertex and with no geometry', () => {
        expect(geometryKey({ type: 'Point', coordinates: [6, 45] })).toMatch(/^1:0:/);
        expect(geometryKey(undefined)).toMatch(/^0:0:/);
    });
});

describe('parseAnalysis', () => {
    it('reads old rows (null or missing) as null', () => {
        expect(parseAnalysis(null)).toBeNull();
        expect(parseAnalysis(undefined)).toBeNull();
        expect(parseAnalysis('')).toBeNull();
    });
    it('reads junk or another version as null', () => {
        expect(parseAnalysis('{nope')).toBeNull();
        expect(parseAnalysis('null')).toBeNull();
        expect(parseAnalysis(JSON.stringify({ v: 2, inputs: {}, layers: {} }))).toBeNull();
        expect(parseAnalysis(JSON.stringify({ v: 1 }))).toBeNull();
    });
    it('reads one missing what the checks read as null', () => {
        const valid = createAnalysis(line(10));
        const without = (change: (analysis: any) => void) => {
            const copy = JSON.parse(JSON.stringify(valid));
            change(copy);
            return parseAnalysis(JSON.stringify(copy));
        };
        expect(without(() => undefined)).not.toBeNull();
        expect(without((analysis) => delete analysis.inputs.departure)).toBeNull();
        expect(without((analysis) => delete analysis.inputs.pace)).toBeNull();
        expect(without((analysis) => delete analysis.inputs.geometryKey)).toBeNull();
        expect(without((analysis) => delete analysis.inputs)).toBeNull();
        expect(without((analysis) => (analysis.layers = null))).toBeNull();
    });
    it('round trips an analysis', () => {
        const analysis = createAnalysis(line(10));
        expect(parseAnalysis(JSON.stringify(analysis))).toEqual(analysis);
    });
});

describe('reconcileAnalysis', () => {
    it('returns null when there is nothing stored', () => {
        expect(reconcileAnalysis(null, line(10))).toBeNull();
    });
    it('keeps the analysis when the geometry is the same', () => {
        const analysis = createAnalysis(line(10));
        analysis.layers.weather = weatherLayer;
        expect(reconcileAnalysis(analysis, line(10))).toBe(analysis);
    });
    it('drops the layers and the recording, keeps the user choices, when the geometry changed', () => {
        const analysis = createAnalysis(line(10), { kind: 'bike', subtype: 'road', origin: 'user' });
        analysis.layers.weather = weatherLayer;
        analysis.recorded = { t: [0, 1], startedAt: 5 };
        analysis.inputs.departure = { mode: 'planned', at: 1000 };
        analysis.inputs.pace.multiplier = 1.2;
        const edited = reconcileAnalysis(analysis, line(11));
        expect(edited.layers).toEqual({});
        expect(edited.recorded).toBeUndefined();
        expect(edited.inputs.geometryKey).toBe(geometryKey(line(11)));
        expect(edited.inputs.activity).toEqual(analysis.inputs.activity);
        expect(edited.inputs.departure).toEqual({ mode: 'planned', at: 1000 });
        expect(edited.inputs.pace.multiplier).toBe(1.2);
    });
});

describe('activity', () => {
    it('is derived from a computed route', () => {
        expect(activityFromRoute({ type: 'pedestrian', subtype: 'running' })).toEqual({ kind: 'hike', subtype: 'run', origin: 'route' });
        expect(activityFromRoute({ type: 'pedestrian', subtype: 'mountainairing' })).toEqual({ kind: 'hike', subtype: 'walk', origin: 'route' });
        expect(activityFromRoute({ type: 'bicycle', subtype: 'gravel' })).toEqual({ kind: 'bike', subtype: 'gravel', origin: 'route' });
        expect(activityFromRoute({ type: 'bicycle' })).toEqual({ kind: 'bike', subtype: 'normal', origin: 'route' });
        expect(activityFromRoute({ type: 'auto' })).toEqual({ kind: 'motor', origin: 'route' });
        expect(activityFromRoute({ type: 'hiking' })).toBeUndefined();
    });
    it('is unknown for an imported track until the user picks one', () => {
        const imported = { properties: { imported: true, route: { type: 'pedestrian' } } };
        expect(activityOf(imported)).toBeUndefined();
        expect(needsActivity(imported)).toBe(true);
        const picked = withActivity(null, line(10), { kind: 'hike', subtype: 'walk', origin: 'user' });
        expect(activityOf(imported, picked)).toEqual({ kind: 'hike', subtype: 'walk', origin: 'user' });
        expect(needsActivity(imported, picked)).toBe(false);
    });
    it('prefers the user pick over the route on a computed route', () => {
        const computed = { properties: { route: { type: 'bicycle', subtype: 'road' } } };
        expect(activityOf(computed)?.subtype).toBe('road');
        const picked = withActivity(createAnalysis(line(10)), line(10), { kind: 'bike', subtype: 'mountain', origin: 'user' });
        expect(activityOf(computed, picked)?.subtype).toBe('mountain');
    });
});
