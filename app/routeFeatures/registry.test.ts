import { get, writable } from 'svelte/store';
import { describe, expect, it } from 'vitest';
import {
    type LensId,
    type RouteFeature,
    type RouteLens,
    migrateNavPages,
    nextLens,
    parseNavPages,
    registerRouteFeature,
    resolveLens,
    routeFeatures,
    routeLenses,
    routeNavBanners,
    routeNavPageChoices,
    routeNavPages,
    routeStages,
    routeStatViews,
    routeTrip,
    tellDeparture
} from './registry';

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
    const lens = (id: LensId, available = true): RouteLens => ({ id, icon: '', label: () => id, available: () => available, chip: () => ({}), headline: () => ({ facts: [{ text: id }] }) });
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

describe('routeNavBanners', () => {
    it('collects the banners of the features, in feature order', () => {
        const component = () => Promise.resolve({ default: null });
        const features: RouteFeature[] = [
            {
                id: 'one',
                order: 1,
                navBanners: [
                    { id: 'a', component },
                    { id: 'b', component }
                ]
            },
            { id: 'none', order: 2 },
            { id: 'two', order: 3, navBanners: [{ id: 'c', component }] }
        ];
        expect(routeNavBanners(features).map(({ id }) => id)).toEqual(['a', 'b', 'c']);
    });
});

describe('routeStatViews', () => {
    const row = { id: 'a', label: 'a', dist: 1, perc: 1, color: '#000000', eink: '#000000' };

    it('lists the views of the features that have rows for this route', () => {
        const features: RouteFeature[] = [
            {
                id: 'one',
                order: 1,
                statViews: [
                    { id: 'full', title: () => 'full', rows: () => [row] },
                    { id: 'empty', title: () => 'empty', rows: () => [] }
                ]
            },
            { id: 'none', order: 2 }
        ];
        expect(routeStatViews(features, { item: null }).map(({ id }) => id)).toEqual(['full']);
    });
});

describe('routeTrip', () => {
    const ctx = { item: null };

    it('collects the chips of the features in order and joins their notes', () => {
        const features: RouteFeature[] = [
            { id: 'first', order: 1, trip: () => ({ chips: [{ key: 'a', icon: 'mdi-a', text: '1' }], note: 'one' }) },
            { id: 'none', order: 2 },
            { id: 'second', order: 3, trip: () => ({ chips: [{ key: 'b', icon: 'mdi-b', text: '2' }], note: 'two' }) }
        ];
        const trip = routeTrip(features, ctx);
        expect(trip.chips.map((chip) => chip.key)).toEqual(['a', 'b']);
        expect(trip.note).toBe('one · two');
    });

    it('leaves out the feature that has chips and no line', () => {
        const features: RouteFeature[] = [
            { id: 'first', order: 1, trip: () => ({ note: 'one' }) },
            { id: 'quiet', order: 2, trip: () => ({ chips: [{ key: 'a', icon: 'mdi-a', text: '1' }] }) },
            { id: 'last', order: 3, trip: () => ({ note: 'two' }) }
        ];
        expect(routeTrip(features, ctx).note).toBe('one · two');
    });

    it('has nothing to say when no feature does', () => {
        expect(
            routeTrip(
                [
                    { id: 'none', order: 1 },
                    { id: 'quiet', order: 2, trip: () => ({}) }
                ],
                ctx
            )
        ).toEqual({ chips: [], note: '' });
    });
});

describe('tellDeparture', () => {
    const ctx = { item: null };
    const indicators = {};
    const assess = () => undefined;

    it('says it to the features that listen, in feature order', () => {
        const heard: string[] = [];
        const features: RouteFeature[] = [
            { id: 'one', order: 1, departure: { indicators, assess, taken: () => heard.push('one') } },
            { id: 'none', order: 2 },
            { id: 'deaf', order: 3, departure: { indicators, assess } },
            { id: 'two', order: 4, departure: { indicators, assess, taken: () => heard.push('two') } }
        ];
        tellDeparture(features, ctx, 'taken');
        expect(heard).toEqual(['one', 'two']);
    });

    it('says a pace change to the ones that asked for it, not to the ones that listen to departures', () => {
        const heard: string[] = [];
        const features: RouteFeature[] = [
            { id: 'one', order: 1, departure: { indicators, assess, taken: () => heard.push('taken'), restamped: () => heard.push('restamped') } },
            { id: 'two', order: 2, departure: { indicators, assess, paced: () => heard.push('paced') } }
        ];
        tellDeparture(features, ctx, 'paced');
        expect(heard).toEqual(['paced']);
    });

    it('says a now moved to the clock to the ones that read it, else as a departure taken', () => {
        const heard: string[] = [];
        const features: RouteFeature[] = [
            { id: 'one', order: 1, departure: { indicators, assess, taken: () => heard.push('one taken') } },
            { id: 'two', order: 2, departure: { indicators, assess, taken: () => heard.push('two taken'), restamped: () => heard.push('two restamped') } }
        ];
        tellDeparture(features, ctx, 'restamped');
        expect(heard).toEqual(['one taken', 'two restamped']);
    });
});

describe('dock pages', () => {
    const page = (id: string, available = true) => ({ id, label: () => id, component: () => Promise.resolve({ default: null }), available: () => available });
    const features: RouteFeature[] = [
        { id: 'one', order: 1, navPages: [page('climb'), page('profile', false)] },
        { id: 'two', order: 2, navPages: [page('trip'), page('surface')] },
        { id: 'none', order: 3 }
    ];

    it('shows the pages that are on, available, in the order of the setting', () => {
        expect(routeNavPages(features, { item: null }, ['trip', 'profile', 'climb', 'gone']).map(({ id }) => id)).toEqual(['trip', 'climb']);
    });

    it('lists every page for the settings: the ones on first, in order, then the rest', () => {
        expect(routeNavPageChoices(features, ['trip', 'climb']).map(({ id }) => id)).toEqual(['trip', 'climb', 'profile', 'surface']);
    });

    it('reads the setting, dropping blanks and doubles', () => {
        expect(parseNavPages('climb, trip,,climb')).toEqual(['climb', 'trip']);
        expect(parseNavPages('')).toEqual([]);
    });

    it('keeps what was chosen with the switches the pages replaced', () => {
        const defaults = ['climb', 'profile', 'ahead', 'trip'];
        expect(migrateNavPages(defaults, { chart: false })).toEqual(['climb', 'ahead', 'trip']);
        expect(migrateNavPages(defaults, { surface: true })).toEqual(['climb', 'profile', 'surface', 'ahead', 'trip']);
        expect(migrateNavPages(defaults, { chart: false, surface: true })).toEqual(['surface', 'climb', 'ahead', 'trip']);
        expect(migrateNavPages(defaults, { chart: true, surface: false })).toEqual(defaults);
    });
});

describe('nextLens', () => {
    const lenses = ['overview', 'climbs', 'weather'].map((id) => ({ id }) as RouteLens);
    it('goes to the lens after the active one, round to the first', () => {
        expect(nextLens(lenses, 'overview')).toBe('climbs');
        expect(nextLens(lenses, 'weather')).toBe('overview');
    });
    it('starts from the first when the active lens is not offered, and says nothing without lenses', () => {
        expect(nextLens(lenses, 'sun')).toBe('overview');
        expect(nextLens([], 'overview')).toBeUndefined();
    });
});
