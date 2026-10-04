import { ApplicationSettings } from '@nativescript/core';

/** The Massif projects the app ships (dev_assets/styles/massif): both draw every variant and every ranking. */
export const MASSIF_PACKAGE = 'massif';
export const MASSIF_VARIANTS = ['streets', 'outdoor', 'topo', 'hybrid', 'eink'] as const;
export const MASSIF_RANKINGS = ['default', 'activities', 'sports', 'classic'] as const;
export type MassifVariant = (typeof MASSIF_VARIANTS)[number];
export type MassifRanking = (typeof MASSIF_RANKINGS)[number];

// the package's own variant projects: what each sets besides `variant`, applied as style parameters
const VARIANT_PROJECTS: Record<MassifVariant, { styleparameters: Record<string, unknown> }> = {
    streets: require('@massif-maps/styles/cartocss-iconfont/streets.json'),
    outdoor: require('@massif-maps/styles/cartocss-iconfont/outdoor.json'),
    topo: require('@massif-maps/styles/cartocss-iconfont/topo.json'),
    hybrid: require('@massif-maps/styles/cartocss-iconfont/hybrid.json'),
    eink: require('@massif-maps/styles/cartocss-iconfont/eink.json')
};

export function isMassifStyle(layerStyle: string) {
    return !!layerStyle && layerStyle.split('~')[0].replace(/\.zip$/, '') === MASSIF_PACKAGE;
}

export function variantParameters(variant: string): Record<string, string> {
    const params = VARIANT_PROJECTS[variant]?.styleparameters ?? {};
    return Object.keys(params).reduce((acc, key) => {
        if (key !== 'variant' && typeof params[key] !== 'object') {
            acc[key] = params[key] + '';
        }
        return acc;
    }, {});
}

/** Every parameter some variant project sets: switching variant resets them to the style's values first. */
export const VARIANT_PARAMETER_KEYS = [...new Set(MASSIF_VARIANTS.flatMap((variant) => Object.keys(variantParameters(variant))))];

// Which POI wins a collision: added to Massif's placement priority per class (`poi-boost-<class>` style
// parameters, a re-decode). POIs span 18.8M-21.0M, 100k a ladder band, road names from 21.1M.
const PROMOTE = 1000000;
const FAVOUR = 500000;
const DEMOTE = -1000000;
const ERRANDS = ['clothing_store', 'shop', 'furniture', 'gift', 'florist', 'hairdresser', 'laundry', 'bank', 'car', 'dentist', 'doctors', 'pharmacy', 'veterinary', 'embassy', 'post'];
const boosts = (promote: string[], favour: string[]) =>
    Object.fromEntries([...ERRANDS.map((name) => [name, DEMOTE]), ...favour.map((name) => [name, FAVOUR]), ...promote.map((name) => [name, PROMOTE])]) as Record<string, number>;
export const RANKING_BOOSTS: Record<MassifRanking, Record<string, number>> = {
    default: {},
    activities: boosts(
        ['alpine_hut', 'wilderness_hut', 'shelter', 'viewpoint', 'waterfall', 'cave_entrance', 'drinking_water', 'spring'],
        ['picnic_site', 'ranger_station', 'lodging', 'toilets', 'parking', 'bicycle_rental', 'campsite', 'water_point']
    ),
    sports: boosts(
        ['skiing', 'alpine_hut', 'wilderness_hut', 'viewpoint'],
        ['stadium', 'swimming', 'golf', 'pitch', 'shelter', 'tennis', 'soccer', 'basketball', 'bicycle', 'bicycle_rental', 'playground']
    ),
    // the planetiler fork's CLASS_RANKS order over upstream ranks: a ladder band (100k) per step it moves a class
    classic: { pharmacy: 200000, bakery: 200000, pitch: 100000, bank: 100000, beer: 100000, biergarten: 100000, bar: 100000, restaurant: 100000, grocery: 100000, library: -100000 }
};
const BOOSTED_NAMES = [...new Set(Object.values(RANKING_BOOSTS).flatMap((table) => Object.keys(table)))];

/** The style parameters of a ranking: its name, and every boost any ranking sets, 0 where this one sets none. */
export function rankingParameters(ranking: MassifRanking): Record<string, string> {
    const table = RANKING_BOOSTS[ranking] ?? {};
    const params: Record<string, string> = { ranking };
    BOOSTED_NAMES.forEach((name) => (params['poi-boost-' + name] = (table[name] ?? 0) + ''));
    return params;
}

/** `look` is a variant, or the id of a project of its own (`alpimaps`). */
const DEFAULT_RANKING: Record<string, MassifRanking> = { streets: 'default', hybrid: 'default', outdoor: 'activities', topo: 'sports', eink: 'sports', alpimaps: 'sports' };

/** The ranking key of a style: its variant on the variant row, else its own project. */
export function massifLook(layerStyle: string, variant: string) {
    const project = layerStyle.split('~')[1];
    return project === MASSIF_PACKAGE ? variant || 'streets' : project;
}

export function rankingFor(look: string): MassifRanking {
    return ApplicationSettings.getString('massifRanking.' + look, DEFAULT_RANKING[look] ?? 'default') as MassifRanking;
}

export function setRankingFor(look: string, ranking: MassifRanking) {
    ApplicationSettings.setString('massifRanking.' + look, ranking);
}

// what a tap on a Massif map may pick, layer::attachment: its labels and the routes, not every bin and tree under them
const MASSIF_CLICK_FILTER = '(poi|mountain_peak|transportation_name|route|aerodrome_label|water_name|place|landcover_name)::.*';

/** The user's filter when set, else Massif's own on a Massif style. */
export function clickFilterFor(userFilter: string) {
    return userFilter || (isMassifStyle(ApplicationSettings.getString('mapStyle', '')) ? MASSIF_CLICK_FILTER : '');
}
