import { get, writable } from 'svelte/store';
import { describe, expect, it } from 'vitest';
import { type RouteFeature, registerRouteFeature, routeFeatures, routeStages } from './registry';

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
