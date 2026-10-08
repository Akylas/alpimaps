import { ApplicationSettings } from '@nativescript/core';
import { get, writable } from 'svelte/store';
import { settingsStore } from '~/stores/settingsStore';

/** The Massif projects the app ships (dev_assets/styles/massif): both draw every variant and every ranking. */
export const MASSIF_PACKAGE = 'massif';
export const MASSIF_VARIANTS = ['streets', 'outdoor', 'topo', 'hybrid', 'eink'] as const;
export const MASSIF_RANKINGS = ['default', 'activities', 'sports', 'alpimaps'] as const;
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

/** The variant the map draws, null on any other style: `hybrid` needs imagery under the map. */
export const massifVariant = writable<string>(null);

export function isMassifStyle(layerStyle: string) {
    return !!layerStyle && layerStyle.split('~')[0].replace(/\.zip$/, '') === MASSIF_PACKAGE;
}

/** The icon fonts a Massif map can draw POIs with: Massif's own, or the osm glyphs on its codepoints
 * (scripts/massif-iconfont.mjs). Both are `MassifIcons` to the map, told apart by file name in the UI. */
export const MASSIF_ICON_FONTS = ['osm', 'massif'] as const;
export type MassifIconFont = (typeof MASSIF_ICON_FONTS)[number];
const ICON_FONTS: Record<MassifIconFont, { family: string; glyphs: Record<string, string> }> = {
    osm: { family: 'MassifIconsOsm', glyphs: require('./massifIconsOsm.json') },
    massif: { family: 'MassifIcons', glyphs: require('./massifIconsMassif.json') }
};
export const massifIconFont = settingsStore<MassifIconFont>('massifIconFont', 'osm');

/** The font family the UI draws a Massif glyph with, and the file the map loads. */
export function massifIconFontFamily() {
    return ICON_FONTS[get(massifIconFont)].family;
}

// a class the map draws with another's glyph (pois.py ALIAS), which the font has no glyph under
const CLASS_GLYPH_ALIAS: Record<string, string> = { border_control: 'barrier', national_park: 'park', sally_port: 'barrier', spring: 'water' };
// the glyph the map draws for a feature outside the `poi` layer, where its class names none: `mountain_peak`
// and `aerodrome_label` (class international, military...) are drawn with a sprite of the layer's own
export const LAYER_GLYPHS: Record<string, string[]> = {
    aerodrome_label: ['airport'],
    mountain_peak: ['peak', 'mountain'],
    park: ['park'],
    place: ['place'],
    water_name: ['water']
};

/** What a clicked feature is called in the icon font, most specific first: osm value, subclass, class (aliased), then its layer's glyph. */
export function featureIconNames(properties: { osm_value?: string; subclass?: string; class?: string; layer?: string } = {}) {
    const className = properties.class;
    return [properties.osm_value, ...(properties.subclass?.split(';') ?? []), CLASS_GLYPH_ALIAS[className] ?? className, ...(LAYER_GLYPHS[properties.layer] ?? [])].filter(Boolean);
}

/** The glyph a Massif map draws for the first of `names` it has one for (subclass before class), else its `default`. */
export function massifIcon(names: string[]) {
    const glyphs = ICON_FONTS[get(massifIconFont)].glyphs;
    return glyphs[names.find((name) => glyphs[name])] ?? glyphs.default;
}

/** The osm glyphs Massif's font lacks (the projects' `glyph.<name>`): emptied with Massif's font, so they draw as unknown. */
export function iconFontParameters(): Record<string, string> {
    const font = get(massifIconFont);
    return Object.fromEntries(
        Object.keys(ICON_FONTS.osm.glyphs)
            .filter((name) => !ICON_FONTS.massif.glyphs[name])
            .map((name) => ['glyph.' + name, font === 'osm' ? ICON_FONTS.osm.glyphs[name] : ''])
    );
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

// Which POI wins a collision: added to Massif's placement priority per class (`poi-boost.<class>`, one
// entry of its `poi-boost` table, a re-decode). POIs span 22.1M-24.9M, 100k a ladder band, road names below.
const PROMOTE = 1000000;
const FAVOUR = 500000;
const DEMOTE = -1000000;
const ERRANDS = ['clothing_store', 'shop', 'furniture', 'gift', 'florist', 'hairdresser', 'laundry', 'bank', 'car', 'dentist', 'doctors', 'pharmacy', 'veterinary', 'embassy', 'post'];
// a sports or outdoor shop (Decathlon: class shop) and a bike shop, by subclass where its class is `shop`
const SPORT_SHOPS = ['sports', 'outdoor', 'bicycle', 'bicycle_rental'];
const boosts = (promote: string[], favour: string[]) =>
    Object.fromEntries([...ERRANDS.map((name) => [name, DEMOTE]), ...favour.map((name) => [name, FAVOUR]), ...promote.map((name) => [name, PROMOTE])]) as Record<string, number>;
// the planetiler fork's CLASS_RANKS: the lower, the more a class matters in its tile
const CLASS_RANKS: Record<string, number> = {
    hospital: 20, railway: 40, bus: 50, harbor: 70, attraction: 75, stadium: 80, zoo: 90, town_hall: 95, campsite: 100,
    pharmacy: 101, national_park: 103, aerialway: 105, cemetery: 110, park: 115, drinking_water: 121, bakery: 122,
    college: 125, school: 130, police: 135, post: 140, pitch: 152, golf: 155, bank: 156, beer: 160, biergarten: 161,
    bar: 170, restaurant: 180, grocery: 190, shop: 250, library: 300, fast_food: 600, clothing_store: 700, lodging: 800,
    bicycle_repair_station: 900, viewpoint: 1001
};
// what a cycle tourer needs, over CLASS_RANKS' order: food stores with the bakeries, bike and sports
// shops, care, and history; a community centre (town_hall to OpenMapTiles) crowds a town: demoted
const FOOD_STORES = ['bakery', 'grocery', 'supermarket', 'convenience', 'greengrocer', 'butcher', 'deli'];
const HISTORY = ['museum', 'castle', 'ruins', 'archaeological_site', 'monument', 'memorial', 'fort', 'attraction'];
// a class wins over every class ranked after it, an unlisted one (no boost) comes last
function alpimapsBoosts() {
    const boosts = Object.fromEntries(Object.entries(CLASS_RANKS).map(([name, rank]) => [name, (1100 - rank) * 1000]));
    const bakery = boosts.bakery;
    return {
        ...boosts,
        ...Object.fromEntries(FOOD_STORES.map((name) => [name, bakery])),
        ...Object.fromEntries(HISTORY.map((name) => [name, bakery - 10000])),
        ...Object.fromEntries(SPORT_SHOPS.map((name) => [name, PROMOTE])),
        community_centre: DEMOTE
    } as Record<string, number>;
}
export const RANKING_BOOSTS: Record<MassifRanking, Record<string, number>> = {
    default: {},
    activities: boosts(
        ['alpine_hut', 'wilderness_hut', 'shelter', 'viewpoint', 'waterfall', 'cave_entrance', 'drinking_water', 'spring'],
        ['picnic_site', 'ranger_station', 'lodging', 'toilets', 'parking', 'campsite', 'water_point', ...SPORT_SHOPS]
    ),
    sports: boosts(
        ['skiing', 'alpine_hut', 'wilderness_hut', 'viewpoint', ...SPORT_SHOPS],
        ['stadium', 'swimming', 'golf', 'pitch', 'shelter', 'tennis', 'soccer', 'basketball', 'playground']
    ),
    alpimaps: alpimapsBoosts()
};
const BOOSTED_NAMES = [...new Set(Object.values(RANKING_BOOSTS).flatMap((table) => Object.keys(table)))];

/** The style parameters of a ranking: its name, and every boost any ranking sets, 0 where this one sets none. */
export function rankingParameters(ranking: MassifRanking): Record<string, string> {
    const table = RANKING_BOOSTS[ranking] ?? {};
    const params: Record<string, string> = { ranking };
    BOOSTED_NAMES.forEach((name) => (params['poi-boost.' + name] = (table[name] ?? 0) + ''));
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
    const ranking = ApplicationSettings.getString('massifRanking.' + look, DEFAULT_RANKING[look] ?? 'default');
    // `classic` was the alpimaps ranking's name
    return (ranking === 'classic' ? 'alpimaps' : ranking) as MassifRanking;
}

export function setRankingFor(look: string, ranking: MassifRanking) {
    ApplicationSettings.setString('massifRanking.' + look, ranking);
}

// what a tap on a Massif map may pick, layer::attachment: its labels and the routes, not every bin and tree under them.
// `park` only for its label point and name, not the outlines drawn around it
export const MASSIF_CLICK_FILTER = '(poi|mountain_peak|transportation_name|route|aerodrome_label|water_name|place|landcover_name)::.*|park::(poi|park_label)';

/** The user's filter when set, else Massif's own on a Massif style. */
export function clickFilterFor(userFilter: string) {
    return userFilter || (isMassifStyle(ApplicationSettings.getString('mapStyle', '')) ? MASSIF_CLICK_FILTER : '');
}
