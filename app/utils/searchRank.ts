// Plain data in, number out: no NativeScript import. Tile results carry class/subclass/layer,
// geocoders osm_key/osm_value (and Photon a `type`).
export interface SearchRankProperties {
    [k: string]: any;
}

/** `station`: a train station, `transit`: any other stop */
export type SearchResultKind = 'station' | 'transit' | 'poi' | 'settlement' | 'other';
/** `poi`: the plain search, places of interest first. `journey`: picking where a journey starts or ends. */
export type SearchRankMode = 'poi' | 'journey';

const STATION_VALUES = ['station', 'halt'];
const STOP_VALUES = ['bus_stop', 'bus_station', 'tram_stop'];
const SETTLEMENT_VALUES = ['city', 'town', 'village', 'hamlet', 'suburb', 'neighbourhood', 'municipality', 'locality', 'borough', 'quarter', 'administrative'];
const POI_OSM_KEYS = ['amenity', 'shop', 'tourism', 'leisure', 'historic', 'natural', 'man_made', 'office', 'craft', 'sport', 'aeroway', 'healthcare', 'emergency', 'mountain_pass'];
const POI_LAYERS = ['poi', 'mountain_peak', 'aerodrome_label'];

export function searchResultKind(props: SearchRankProperties): SearchResultKind {
    if (!props) {
        return 'other';
    }
    const { class: itemClass, layer, osm_key: osmKey, osm_value: osmValue, provider, subclass, type } = props;
    if ((itemClass === 'railway' && STATION_VALUES.includes(subclass)) || (osmKey === 'railway' && STATION_VALUES.includes(osmValue)) || (osmKey === 'building' && osmValue === 'train_station')) {
        return 'station';
    }
    if (
        itemClass === 'bus' ||
        STOP_VALUES.includes(subclass) ||
        STOP_VALUES.includes(osmValue) ||
        osmKey === 'public_transport'
    ) {
        return 'transit';
    }
    if (SETTLEMENT_VALUES.includes(itemClass) || layer === 'place' || (osmKey === 'place' && SETTLEMENT_VALUES.includes(osmValue)) || (osmKey === 'boundary' && osmValue === 'administrative') || type === 'city') {
        return 'settlement';
    }
    if (POI_LAYERS.includes(layer) || POI_OSM_KEYS.includes(osmKey) || provider === 'here') {
        return 'poi';
    }
    return 'other';
}

/** lower first */
export function searchRank(props: SearchRankProperties, mode: SearchRankMode) {
    const kind = searchResultKind(props);
    if (mode === 'journey') {
        // a far station before the bus stops named after the same town
        return kind === 'station' ? 0 : kind === 'settlement' ? 1 : kind === 'transit' ? 2 : kind === 'poi' ? 3 : 4;
    }
    return kind === 'station' || kind === 'transit' || kind === 'poi' ? 0 : kind === 'settlement' ? 1 : 2;
}
