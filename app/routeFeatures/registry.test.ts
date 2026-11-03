import { get, writable } from 'svelte/store';
import { describe, expect, it } from 'vitest';
import { type LensId, type RouteFeature, type RouteLens, registerRouteFeature, resolveLens, routeFeatures, routeLenses, routeStages } from './registry';

describe('routeStages', () => {
    const stage = (layer: 'weather' | 'sun') => ({ layer, run: () => Promise.resolve({ prov: { computedAt: 0, inputsHash: '', provider: '', quality: 'ok' as const }, data: null }) });

    it('collects the stages of the enabled features, in feature order', () => {
        const switchedOn = writable(true);
        const switchedOff = writable(false);
        const weather = stage('weather');
        const sun = stage('sun');
        registerRouteFeature({ id: 'test-sun', order: 2, compute: sun, setting: { title: () => 'sun', store: switchedOn as never } });
        registerRouteFeature({ id: 'test-weather', order: 1, compute: weather });
        registerRouteFeature({ id: 'test-off', order: 3, compute: stage('sun'), setting: { title: () => 'off', store: switchedOff as never } });
        registerRouteFeature({ id: 'test-none', order: 4 });
        expect(routeStages(get(routeFeatures).filter((feature: RouteFeature) => feature.id.startsWith('test-')))).toEqual([weather, sun]);
        switchedOn.set(false);
        expect(routeStages(get(routeFeatures).filter((feature: RouteFeature) => feature.id.startsWith('test-')))).toEqual([weather]);
    });
});

describe('lenses', () => {
    const lens = (id: LensId, available = true): RouteLens => ({ id, icon: '', label: () => id, available: () => available, chip: () => ({}), headline: () => ({ text: id }) });
    const ctx = { item: null };

    it('lists the available lenses in the bar order, not the registration order', () => {
        const features: RouteFeature[] = [
            { id: 'surface', order: 1, lenses: [lens('surface')] },
            { id: 'overview', order: 2, lenses: [lens('overview'), lens('road', false)] },
            { id: 'climbs', order: 3, lenses: [lens('climbs')] },
            { id: 'none', order: 4 }
        ];
        expect(routeLenses(features, ctx).map(({ id }) => id)).toEqual(['overview', 'climbs', 'surface']);
    });

    it('resolves to the lens asked for, else to the overview', () => {
        const lenses = [lens('overview'), lens('climbs')];
        expect(resolveLens('climbs', lenses)).toBe('climbs');
        expect(resolveLens('road', lenses)).toBe('overview');
    });
});
