import { MapPos } from 'nativescript-carto/core/core';
import { VectorTileLayer } from 'nativescript-carto/layers/vector';
import { Projection } from 'nativescript-carto/projections/projection';
import { CartoMap } from 'nativescript-carto/ui/ui';
import { getJSON } from 'tns-core-modules/http';
import { ItemEventData } from 'tns-core-modules/ui/list-view/list-view';
import { TextField } from 'tns-core-modules/ui/text-field';
import { Component, Prop } from 'vue-property-decorator';
import Map from '~/components/Map';
import { Address, Item } from '~/mapModules/ItemsModule';
import MapModule from '~/mapModules/MapModule';
import { clog } from '~/utils/logging';
import { queryString } from '../utils/http';
import BaseVueComponent from './BaseVueComponent';
import ItemFormatter from '~/mapModules/ItemFormatter';
const addressFormatter = require('@fragaria/address-formatter'); // const OPEN_DURATION = 200;
const deburr = require('deburr');
function cleanUpString(s) {
    return new deburr.Deburr(s)
        .toString()
        .toLowerCase()
        .replace(/^(the|le|la|el)\s/, '')
        .trim();
}

// class VectorTileArray {
//     length: number;
//     constructor(private collection?: VectorTileFeatureCollection) {
//         this.length = collection ? collection.getFeatureCount() : 0;
//     }
//     getItem(index: number) {
//         return this.collection.getFeature(index);
//     }
// }

// class GeocodingResultArray {
//     length: number;
//     constructor(private vector?: GeocodingResultVector) {
//         this.length = vector ? vector.size() : 0;
//     }
//     getItem(index: number): GeocodingResult {
//         return this.vector.get(index);
//     }
// }

class PhotonAddress {
    // categories = [];
    constructor(private properties) {
        // if (properties['osm_value']) {
        //     this.categories.push(properties['osm_value']);
        // }
        // if (properties['osm_key']) {
        //     this.categories.push(properties['osm_key']);
        // }
    }
    get road() {
        if (this.properties['osm_key'] === 'highway') {
            return this.properties.name;
        }
        return this.properties.street;
    }
    get country() {
        return this.properties.country;
    }
    get county() {
        return this.properties.county;
    }
    get name() {
        return this.properties.name;
    }
    // get categories() {
    //     return this.categories;
    // }
    get neighbourhood() {
        return this.properties.neighbourhood;
    }
    get postcode() {
        return this.properties.postcode;
    }
    get houseNumber() {
        return this.properties.housenumber;
    }
    get region() {
        return this.properties.region;
    }
    get locality() {
        return this.properties.city;
    }
}
class PhotonFeature {
    properties: { [k: string]: any };
    position: MapPos;
    address: PhotonAddress;
    constructor(private data) {
        clog('PhotonFeature', data);
        this.properties = data.properties || {};
        this.position = { lat: data.geometry.coordinates[1], lon: data.geometry.coordinates[0] };
        this.address = new PhotonAddress(data.properties);
    }
}

interface SearchItem extends Item {}

@Component({})
export default class Search extends BaseVueComponent implements MapModule {
    mapView: CartoMap;
    mapComp: Map;
    @Prop()
    searchLayer: VectorTileLayer;
    @Prop()
    projection: Projection;

    _formatter: ItemFormatter;
    get formatter() {
        if (!this._formatter && this.mapComp) {
            this._formatter = this.mapComp.mapModule('formatter');
        }
        return this._formatter;
    }

    get textField() {
        return this.$refs.textField.nativeView as TextField;
    }

    // searchService: MapBoxOnlineGeocodingService;
    searchAsTypeTimer;
    dataItems: SearchItem[] = [];
    loading = false;

    currentSearchText: string = null;

    get searchResultsVisible() {
        return (this.loading || this.hasFocus) && this.searchResultsCount > 0;
    }

    getItemIcon(item: SearchItem) {
        return this.formatter.geItemIcon(item);
    }
    getItemTitle(item: SearchItem) {
        return this.formatter.getItemTitle(item);
    }
    getItemSubtitle(item: SearchItem) {
        return this.formatter.getItemSubtitle(item);
    }

    onMapReady(mapComp: Map, mapView: CartoMap) {
        this.mapView = mapView;
        this.mapComp = mapComp;
    }
    onMapDestroyed() {
        this.mapView = null;
        this.mapComp = null;
    }
    get searchResultsCount() {
        return this.dataItems ? this.dataItems.length : 0;
    }
    mounted() {
        super.mounted();
    }
    onLoaded() {}
    hasFocus = false;
    onFocus(e) {
        clog('onFocus');
        this.hasFocus = true;
        if (this.currentSearchText && this.searchResultsCount === 0) {
            this.instantSearch(this.currentSearchText);
        }
    }
    onBlur(e) {
        clog('onBlur');
        this.hasFocus = false;
    }
    onTextChange(e) {
        const query = e.value;
        if (this.searchAsTypeTimer) {
            clearTimeout(this.searchAsTypeTimer);
            this.searchAsTypeTimer = null;
        }
        if (query && query.length > 2) {
            this.searchAsTypeTimer = setTimeout(() => {
                this.searchAsTypeTimer = null;
                this.instantSearch(query);
            }, 500);
        } else if (this.currentSearchText && this.currentSearchText.length > 2) {
            this.unfocus();
        }
        this.currentSearchText = query;
    }

    searchInGeocodingService(options) {
        return this.$packageService.searchInPackageGeocodingService(options).then(result => result.map(this.$packageService.prepareGeoCodingResult));
    }
    photonSearch(options: { query: string; language?: string; location?: MapPos; locationRadius?: number }) {
        if (!this.$networkService.connected) {
            return Promise.resolve([]);
        }
        console.log('photonSearch', options);
        return getJSON(
            queryString(
                {
                    q: options.query,
                    lat: options.location && options.location.lat,
                    lon: options.location && options.location.lon,
                    lang: options.language,
                    limit: 40
                },
                'http://photon.komoot.de/api'
            )
        ).then(function(results: any) {
            return results.features.map(f => new PhotonFeature(f));
        });
    }
    instantSearch(_query) {
        this.loading = true;
        const options = {
            query: cleanUpString(_query),
            projection: this.projection,
            // regexFilter: `.*${cleanUpString(_query)}.*`,
            // filterExpression: `layer::name='transportation_name'`,
            // filterExpression: "layer::name='place' OR layer::name='poi'",
            // `REGEXP_LIKE(name, '${_query}')`
            location: this.$getMapComponent().cartoMap.focusPos
            // locationRadius: 1000
        };
        console.log('instantSearch', _query, options);

        // TODO: dont fail when offline!!!
        return Promise.all([this.photonSearch(options), this.searchInGeocodingService(options)])
            .then(results => {
                const items = [].concat.apply([], results);
                if (items.length === 0) {
                    this.$showToast(this.$t('no_result_found'));
                }
                if (this.hasFocus) {
                    this.dataItems = items;
                    console.log('instantSearch done', this.dataItems.length, this.dataItems);
                }
            })
            .catch(err => {
                console.log('instantSearch error', err);
                this.dataItems = [];
            })
            .then(() => {
                this.loading = false;
            });
    }
    clearSearch() {
        if (this.searchAsTypeTimer) {
            clearTimeout(this.searchAsTypeTimer);
            this.searchAsTypeTimer = null;
        }
        this.dataItems = [] as any;
        this.currentSearchText = null;
        this.textField.text = null;
        // this.unfocus();
    }
    unfocus() {
        if (this.searchAsTypeTimer) {
            clearTimeout(this.searchAsTypeTimer);
            this.searchAsTypeTimer = null;
        }
        if (gVars.isAndroid) {
            (this.textField.nativeViewProtected as android.view.View).clearFocus();
        }
        this.textField.dismissSoftInput();
    }

    showMenu(side = 'left') {
        this.log('showMenu', side);
        this.$getAppComponent().drawer.open(side);
    }
    public onItemTap(args: ItemEventData) {
        const item = this.dataItems[args.index];
        const extent = item.properties.extent;
        clog('Item Tapped', args.index, item.position, extent, item);
        this.mapComp.selectItem(item, true);
        this.unfocus();
    }
}
