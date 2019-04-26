import { Address, GeocodingResult, GeocodingResultVector, GeocodingService, PackageManagerGeocodingService } from 'nativescript-carto/geocoding/service';
import BaseVueComponent from './BaseVueComponent';
import { Component, Prop } from 'vue-property-decorator';
import { device, isAndroid } from 'tns-core-modules/platform';
import { TextField } from 'tns-core-modules/ui/text-field';
import { getJSON } from 'tns-core-modules/http';
import { queryString } from '../utils/http';
import { Feature, FeatureCollection, VectorTileFeatureCollection } from 'nativescript-carto/geometry/feature';
import { VectorTileLayer } from 'nativescript-carto/layers/vector';
import { Projection } from 'nativescript-carto/projections/projection';
import { fromNativeMapPos, MapPos } from 'nativescript-carto/core/core';
import { ItemEventData } from 'tns-core-modules/ui/list-view/list-view';
import { clog } from '~/utils/logging';
const deburr = require('deburr');
function cleanUpString(s) {
    return new deburr.Deburr(s)
        .toString()
        .toLowerCase()
        .replace(/^(the|le|la|el)\s/, '')
        .trim();
}

class VectorTileArray {
    length: number;
    constructor(private collection?: VectorTileFeatureCollection) {
        this.length = collection ? collection.getFeatureCount() : 0;
    }
    getItem(index: number) {
        return this.collection.getFeature(index);
    }
}

class GeocodingResultArray {
    length: number;
    constructor(private vector?: GeocodingResultVector) {
        this.length = vector ? vector.size() : 0;
    }
    getItem(index: number): GeocodingResult {
        return this.vector.get(index);
    }
}

class PhotonAddress {
    categories = [];
    constructor(private properties) {
        if (properties['osm_value']) {
            this.categories.push(properties['osm_value']);
        }
        if (properties['osm_key']) {
            this.categories.push(properties['osm_key']);
        }
    }
    getStreet() {
        if (this.properties['osm_key'] === 'highway') {
            return this.properties.name;
        }
        return this.properties.street;
    }
    getCountry() {
        return this.properties.country;
    }
    getCounty() {
        return this.properties.county;
    }
    getName() {
        return this.properties.name;
    }
    getCategories() {
        return this.categories;
    }
    getNeighbourhood() {
        return this.properties.neighbourhood;
    }
    getPostcode() {
        return this.properties.postcode;
    }
    getHouseNumber() {
        return this.properties.housenumber;
    }
    getRegion() {
        return this.properties.region;
    }
    getLocality() {
        return this.properties.city;
    }
}
class PhotonFeature {
    properties: { [k: string]: any };
    geometry: MapPos;
    address: PhotonAddress;
    constructor(private data) {
        clog('PhotonFeature', data);
        this.properties = data.properties;
        this.geometry = { latitude: data.geometry.coordinates[1], longitude: data.geometry.coordinates[0] };
        this.address = new PhotonAddress(data.properties);
    }
}

interface SearchItem {
    properties: { [k: string]: any };
    geometry: MapPos;
    address: Address;
}

@Component({})
export default class Search extends BaseVueComponent {
    @Prop()
    searchLayer: VectorTileLayer;
    @Prop()
    projection: Projection;

    get textField() {
        return this.$refs.textField.nativeView as TextField;
    }

    _offlineSearchService: PackageManagerGeocodingService;
    // searchService: MapBoxOnlineGeocodingService;
    searchAsTypeTimer;
    dataItems: SearchItem[] = [];
    loading = false;

    currentSearchText: string = null;

    get searchResultsVisible() {
        return (this.loading || this.hasFocus) && this.searchResultsCount > 0;
    }
    getItemAddress(item: SearchItem) {
        let result: string;
        const address = item.address;
        // console.log('getItemAddress', item);
        if (address) {
            const street = address.getStreet();
            if (street && street !== this.getItemName(item)) {
                result = street;
            }
            const city = address.getLocality();
            if (city) {
                result = (result ? result + ', ' : '') + city;
            }
            const county = address.getCounty();
            if (county && county !== city) {
                result = (result ? result + ' ' : '') + county;
            }
            const postcode = address.getPostcode();
            if (postcode) {
                result = (result ? result + ' ' : '') + postcode;
            }
            const country = address.getCountry();
            if (country) {
                result = (result ? result + ' ' : '') + country;
            }
            return result;
        }

        return item.address && item.address.getStreet();
    }
    getItemName(item: SearchItem) {
        return (item.properties && item.properties.name) || (item.address && item.address.getName());
    }
    getItemIcon(item: SearchItem) {
        const result = [];
        if (item.properties['osm_value']) {
            result.push('maki-' + item.properties['osm_value']);
        }
        if (item.properties['osm_key']) {
            result.push('maki-' + item.properties['osm_key']);
        }
        return result;
    }
    get offlineSearchService() {
        if (!this._offlineSearchService) {
            this._offlineSearchService = new PackageManagerGeocodingService({
                packageManager: this.$packageService.geoPackageManager,
                language: 'fr'
            });
        }
        return this._offlineSearchService;
    }

    constructor() {
        super();
        // this.searchService = new VectorTileSearchService({
        //     dataSource: this.$packageService.getDataSource(),
        //     decoder: this.$packageService.getVectorTileDecoder(),
        //     minZoom: 10,
        //     maxZoom: 14
        // });

        // this.searchService = new MapBoxOnlineGeocodingService({
        //     apiKey: 'pk.eyJ1IjoiYWt5bGFzIiwiYSI6IkVJVFl2OXMifQ.TGtrEmByO3-99hA0EI44Ew',
        //     // language: 'fr'
        // });
    }

    get searchResultsCount() {
        return this.dataItems ? this.dataItems.length : 0;
    }
    mounted() {
        super.mounted();
    }
    onLoaded() {}
    hasFocus = false
    onFocus(e) {
        clog('onFocus')
        this.hasFocus = true;
        if (this.currentSearchText && this.searchResultsCount === 0) {
            this.instantSearch(this.currentSearchText);
        }
    }
    onBlur(e) {
        clog('onBlur')
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

    searchInGeocodingService(
        service: GeocodingService<any, any>,
        options
    ): Promise<
        Array<{
            properties: any;
            address: any;
        }>
    > {
        return new Promise((resolve, reject) => {
            service.calculateAddresses(options, (err, result) => {
                if (err) {
                    reject(err);
                    return;
                }
                console.log('found results', result.size());
                const items = [];
                // this.dataItems = new GeocodingResultArray(result);
                let geoRes: GeocodingResult, features: FeatureCollection, feature: Feature;
                for (let i = 0; i < result.size(); i++) {
                    geoRes = result.get(i);
                    const address = geoRes.getAddress();
                    features = geoRes.getFeatureCollection();
                    console.log('search features', features.getFeatureCount());
                    for (let j = 0; j < features.getFeatureCount(); j++) {
                        // geoRes = result.get(j);
                        feature = features.getFeature(j);
                        console.log('search item', feature.properties, address, feature.geometry);
                        items.push({ properties: feature.properties, address, geometry: feature.geometry ? fromNativeMapPos(feature.geometry.getCenterPos()) : undefined });
                    }
                }
                console.log('about to resolve searchInGeocodingService', items);
                resolve(items);
            });
        });
    }
    photonSearch(options: { query: string; language?: string; location?: MapPos; locationRadius?: number }) {
        console.log('photonSearch', options);
        return getJSON(
            queryString(
                {
                    q: options.query,
                    lat: options.location && options.location.latitude,
                    lon: options.location && options.location.longitude,
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
        return Promise.all([
            this.photonSearch(options),
            // this.searchInGeocodingService(this.searchService, options),
            this.searchInGeocodingService(this.offlineSearchService, options)
        ])
            .then(results => {
                if (this.hasFocus) {
                    this.dataItems = [].concat.apply([], results);
                    console.log('instantSearch done', this.dataItems.length);
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
        console.log('clearSearch');
        if (this.searchAsTypeTimer) {
            clearTimeout(this.searchAsTypeTimer);
            this.searchAsTypeTimer = null;
        }
        this.dataItems = [] as any;
        this.currentSearchText = null;
        this.textField.text = null;
        this.unfocus();
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
    public onItemTap(args: ItemEventData) {
        const item = this.dataItems[args.index];
        const extent = item.properties.extent;
        clog('Item Tapped', args.index, item.geometry, extent, item);
        this.$getMapComponent().selectPosition(
            item.geometry,
            item.properties,
            true,
            // extent
            //     ? {
            //         southwest: {
            //               latitude: extent[3],
            //               longitude: extent[0]
            //           },
            //           northeast: {
            //               latitude: extent[1],
            //               longitude: extent[2]
            //           }
            //     }
            //     : 
                undefined
        );
        this.clearSearch();
    }
}
