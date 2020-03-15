import { Address, Item } from '~/mapModules/ItemsModule';
import Map from '~/components/Map';
import { Projection } from 'nativescript-carto/projections';
import { CartoMap } from 'nativescript-carto/ui';
import { getJSON } from '@nativescript/core/http';
import { ItemEventData } from '@nativescript/core/ui/list-view/list-view';
import { TextField } from 'nativescript-material-textfield';
import { Component, Prop, Watch } from 'vue-property-decorator';
import { ClusteredVectorLayer, VectorTileLayer } from 'nativescript-carto/layers/vector';
import { MapPos } from 'nativescript-carto/core';
import { IMapModule } from '~/mapModules/MapModule';
import { clog } from '~/utils/logging';
import { queryString } from '../utils/http';
import BaseVueComponent from './BaseVueComponent';
import ItemFormatter from '~/mapModules/ItemFormatter';
import { LocalVectorDataSource } from 'nativescript-carto/datasources/vector';
import { ClusterElementBuilder } from 'nativescript-carto/layers/cluster';
import { VectorElementVector } from 'nativescript-carto/vectorelements';
import { Marker, MarkerStyleBuilder } from 'nativescript-carto/vectorelements/marker';
import { Point, PointStyleBuilder } from 'nativescript-carto/vectorelements/point';
import { ObservableArray } from '@nativescript/core/data/observable-array/observable-array';
import { statusBarHeight } from '~/variables';
import { layout } from '@nativescript/core/utils/utils';
import { enumerable } from '~/utils';
// const addressFormatter = require('@fragaria/address-formatter'); // const OPEN_DURATION = 200;
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
        if (this.properties.name === this.properties.city && !!this.properties.stret) {
            return undefined;
        }
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
    // searchItem = true;
    properties: { [k: string]: any };
    position: MapPos<LatLonKeys>;
    address: Address;
    provider = 'photon';
    // @enumerable(false) private data;
    constructor(data) {
        // clog('PhotonFeature', data);
        // this.data = data;
        const properties = data.properties || {};

        // TODO: extent to zoomBounds

        const actualName = properties.name === properties.city ? undefined : properties.name;
        const { region, name, state, street, housenumber, postcode, city, country, neighbourhood, ...actualProperties } = properties;
        this.address = {
            // name: actualName,
            region,
            // locality: properties.city,
            houseNumber: housenumber,
            postcode,
            county: city,
            country,
            state,
            road: properties['osm_key'] === 'highway' ? name : street,
            neighbourhood
        };
        this.properties = actualProperties;
        this.properties.name = actualName;
        this.position = { lat: data.geometry.coordinates[1], lon: data.geometry.coordinates[0] };
    }
}
// class GoogleFeature {
//     searchItem = true;
//     properties: { [k: string]: any };
//     position: MapPos;
//     address: PhotonAddress;
//     constructor(private data) {
//         // latitude: value.geometry.location.lat,
//         //                     longitude: value.geometry.location.lng,
//         //                     name: value.name,
//         //                     vicinity: value.vicinity,
//         //                     placeid: value.place_id,
//         //                     types: value.types
//         clog('GoogleFeature', data);
//         this.properties = {
//             id: data.place_id,
//             name: data.name,
//             vicinity: data.vicinity,
//             categories: data.types
//         };
//         this.position = { lat: data.geometry.location.lat, lon: data.geometry.location.lng };
//         this.address = new PhotonAddress(data.properties);
//     }
// }

class HereFeature {
    // searchItem = true;
    showOnMap = true;
    properties: { [k: string]: any };
    position: MapPos<LatLonKeys>;
    address: Address;
    categories?: string[];
    provider = 'here';
    // @enumerable(false) private data;
    constructor(data) {
        // latitude: value.geometry.location.lat,
        //                     longitude: value.geometry.location.lng,
        //                     name: value.name,
        //                     vicinity: value.vicinity,
        //                     placeid: value.place_id,
        //                     types: value.types
        // clog('HereFeature', data);
        // this.data = data;
        this.properties = {
            id: data.id,
            name: data.title,
            osm_key:data.category.id ? data.category.id.split('-')[0] : undefined,
            vicinity: data.vicinity,
            // url: data.href,
            averageRating: data.averageRating
        };
        this.categories = [data.category.id];
        this.position = { lat: data.position[0], lon: data.position[1] };
        this.address = { name: data.vicinity };
    }
}

interface SearchItem extends Item {
    showOnMap?: boolean;
}

@Component({})
export default class Search extends BaseVueComponent implements IMapModule {
    mapView: CartoMap<LatLonKeys>;
    mapComp: Map;
    _searchDataSource: LocalVectorDataSource;
    _searchLayer: ClusteredVectorLayer;
    @Prop()
    projection: Projection;
    @Prop({ type: Number, default: 1 })
    defaultElevation: number;
    @Prop({ type: String })
    text: string;

    @Watch('text')
    onTextPropChange(value) {
        this.log('onTextPropChange', value, !!this.textField);
        if (this.textField) {
            this.textField.text = value;
            this.onTextChange({
                value
            });
            setTimeout(() => {
                this.textField.requestFocus();
            }, 100);
        }
    }

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

    get searchDataSource() {
        if (!this._searchDataSource) {
            const projection = this.mapView.projection;
            this._searchDataSource = new LocalVectorDataSource({ projection });
        }
        return this._searchDataSource;
    }
    searchMarkerStyle;
    searchClusterStyle;
    buildClusterElement(position: MapPos, elements: VectorElementVector) {
        // console.log('buildClusterElement', position, elements.size());
        if (!this.searchClusterStyle) {
            this.searchClusterStyle = new PointStyleBuilder({
                // hideIfOverlapped: false,
                size: 20,
                color: 'red'
            }).buildStyle();
        }

        return new Point({
            position,
            style: this.searchClusterStyle
        });
    }
    itemToMetaData(item: Item) {
        const result = {};
        Object.keys(item).forEach(k => {
            if (item[k] !== null && item[k] !== undefined && k !== 'data') {
                result[k] = JSON.stringify(item[k]);
            }
        });
        return result;
    }
    createSearchMarker(item: SearchItem) {
        // if (!this.searchMarkerStyle) {
        //     this.searchMarkerStyle = new MarkerStyleBuilder({
        //         hideIfOverlapped: false,
        //         size: 15,
        //         color: item.provider === 'here' ? 'blue' : 'red'
        //     });
        // }
        const metaData = this.itemToMetaData(item);
        // this.log('createSearchMarker', item.provider, metaData);
        return new Marker({
            position: item.position,
            projection: this.mapComp.mapProjection,
            styleBuilder: {
                hideIfOverlapped: false,
                size: 15,
                color: item.provider === 'here' ? 'blue' : 'red'
            },
            metaData
        });
    }
    get searchLayer() {
        if (!this._searchLayer) {
            this._searchLayer = new ClusteredVectorLayer({
                visibleZoomRange: [0, 24],
                dataSource: this.searchDataSource,
                minimumClusterDistance: 20,
                builder: new ClusterElementBuilder({
                    color: 'black',
                    size: 15
                    // buildClusterElement: this.buildClusterElement
                }),
                animatedClusters: true
            });
            this._searchLayer.setVectorElementEventListener(this.mapComp);
            this.mapComp.addLayer(this._searchLayer, 'search');
        }
        return this._searchLayer;
    }
    ensureSearchLayer() {
        return this.searchLayer !== null;
    }

    // searchService: MapBoxOnlineGeocodingService;
    searchAsTypeTimer;
    dataItems: ObservableArray<SearchItem> = new ObservableArray([] as any);
    loading = false;

    currentSearchText: string = null;

    get searchResultsVisible() {
        return this.hasFocus && this.searchResultsCount > 0;
    }

    getItemIcon(item: SearchItem) {
        return this.formatter.geItemIcon(item);
    }
    getItemIconColor(item: SearchItem) {
        switch (item.provider) {
            case 'here':
                return 'blue';
            case 'photon':
                return 'red';
            default:
                return 'black';
        }
    }
    getItemTitle(item: SearchItem) {
        return this.formatter.getItemTitle(item);
    }
    getItemSubtitle(item: SearchItem) {
        return this.formatter.getItemSubtitle(item);
    }

    onMapReady(mapComp: Map, mapView: CartoMap<LatLonKeys>) {
        // this.log('onMapReady');
        this.mapView = mapView;
        this.mapComp = mapComp;
        this._formatter = this.mapComp.mapModule('formatter');
    }
    onMapDestroyed() {
        this.mapView = null;
        this.mapComp = null;
        if (this._searchDataSource) {
            this._searchDataSource.clear();
            this._searchDataSource = null;
        }
        if (this._searchLayer) {
            this._searchLayer.setVectorElementEventListener(null);
            this._searchLayer = null;
        }
    }
    get searchResultsCount() {
        return this.dataItems ? this.dataItems.length : 0;
    }
    mounted() {
        super.mounted();
        if (gVars.isAndroid) {
            this.nativeView.marginTop = layout.toDevicePixels(statusBarHeight);
        }
        if (this.text) {
            this.onTextPropChange(this.text);
        }
    }
    onLoaded() {}
    hasFocus = false;
    onFocus(e) {
        // clog('onFocus');
        this.hasFocus = true;
        if (this.currentSearchText && this.searchResultsCount === 0) {
            this.instantSearch(this.currentSearchText);
        }
    }
    onBlur(e) {
        // clog('onBlur');
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
        return this.$packageService.searchInPackageGeocodingService(options).then(result => {
            // this.log('searchInGeocodingService', result.length);
            return result.map(this.$packageService.prepareGeoCodingResult);
        });
    }

    // googlePlaceSearch(options: { query: string; language?: string; location?: MapPos; locationRadius?: number }) {
    //     return getJSON(
    //         queryString(
    //             {
    //                 key: gVars.GOOGLE_TOKEN,
    //                 radius: options.locationRadius,
    //                 // rankby: 'distance',
    //                 location: options.location ? options.location.lat + ',' + options.location.lon : undefined
    //             },
    //             'https://maps.googleapis.com/maps/api/place/nearbysearch/json'
    //         )
    //     ).then((result: any) => {
    //         return result.results.filter(v => v.type[0] !== 'route' && v.type[0] !== 'neighborhood').map(f => new GoogleFeature(f));
    //     });
    // }
    herePlaceSearch(options: { query: string; language?: string; location?: MapPos<LatLonKeys>; locationRadius?: number }) {
        if (!this.$networkService.connected) {
            return Promise.resolve([]);
        }
        console.log('herePlaceSearch', options);
        return getJSON(
            queryString(
                {
                    q: options.query,
                    app_id: gVars.HER_APP_ID,
                    app_code: gVars.HER_APP_CODE,
                    radius: options.locationRadius,
                    tf: 'plain',
                    show_content: 'wikipedia',
                    lang: options.language,
                    // rankby: 'distance',
                    limit: 40,
                    at: !options.locationRadius ? options.location.lat + ',' + options.location.lon + ';' + options.locationRadius : undefined,
                    in: options.locationRadius ? options.location.lat + ',' + options.location.lon + ';' + options.locationRadius : undefined
                },
                'https://places.cit.api.here.com/places/v1/discover/search'
            )
        ).then((result: any) => {
            // this.log('herePlaceSearch', result.results.items.length);
            return result.results.items.map(f => new HereFeature(f));
        });
    }
    photonSearch(options: { query: string; language?: string; location?: MapPos<LatLonKeys>; locationRadius?: number }) {
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
            return results.features.filter(r=>r.properties.osm_type !== 'R').map(f => new PhotonFeature(f));
        });
    }
    instantSearch(_query) {
        this.loading = true;
        const options = {
            query: cleanUpString(_query),
            projection: this.projection,
            language: this.$packageService.currentLanguage,
            // regexFilter: `.*${cleanUpString(_query)}.*`,
            // filterExpression: `layer::name='transportation_name'`,
            // filterExpression: "layer::name='place' OR layer::name='poi'",
            // `REGEXP_LIKE(name, '${_query}')`
            location: this.$getMapComponent().cartoMap.focusPos
            // locationRadius: 1000
        };
        // console.log('instantSearch', _query, options);

        // TODO: dont fail when offline!!!
        this.dataItems = new ObservableArray([] as any);
        return Promise.all([
            this.searchInGeocodingService(options).then(r => {
                this.log('found geocoding result', JSON.stringify(r));
                this.dataItems.push(r);
            }),
            this.herePlaceSearch(options).then(r => {
                this.log('found here result', JSON.stringify(r));
                this.dataItems.push(r);
            }),
            this.photonSearch(options).then(r => {
                this.log('found photon result', JSON.stringify(r));
                this.dataItems.push(r);
            })
        ])
            .then(results => {
                // const items = [].concat.apply([], results);
                // console.log('instantSearch done', this.dataItems.length);
                if (this.dataItems.length === 0) {
                    this.$showToast(this.$t('no_result_found'));
                }
                if (this.hasFocus) {
                    // this.dataItems = items;
                    // console.log('instantSearch done', this.dataItems.length);
                }
            })
            .catch(err => {
                // console.log('instantSearch error', err);
                // this.dataItems = [];
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
        if (this._searchDataSource) {
            this.mapComp.unselectItem(); // TODO: only if selected one!
            this._searchDataSource.clear();
            this._searchDataSource = null;
        }
        if (this._searchLayer) {
            this.mapComp.removeLayer(this._searchLayer, 'search');
            this._searchLayer.setVectorElementEventListener(null);
            this._searchLayer = null;
        }
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

    focus() {
        this.textField.focus();
    }

    showMenu(side = 'left') {
        // this.log('showMenu', side);
        this.unfocus();
        this.$getAppComponent().drawer.open(side);
    }
    public onItemTap(item: SearchItem) {
        // const item = this.dataItems[args.index];
        if (!item) {
            return;
        }
        // const extent = item.properties.extent;
        // clog('Item Tapped', item.position, extent, item);
        this.mapComp.selectItem(item, true);
        this.unfocus();
    }

    public showResultsOnMap() {
        const dataSource = this.searchDataSource;
        // this.log('showResultsOnMap', this.dataItems.length);
        this.dataItems
            .filter(d => !!d && (d.provider === 'here' || (d.provider === 'carto' && d.properties.layer === 'poi')))
            .forEach(d => {
                dataSource.add(this.createSearchMarker(d));
            });
        this.ensureSearchLayer();
        this.unfocus();
    }
}
