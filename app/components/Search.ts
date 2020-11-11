import { MapPos } from '@nativescript-community/ui-carto/core';
import { LocalVectorDataSource } from '@nativescript-community/ui-carto/datasources/vector';
import { ClusterElementBuilder } from '@nativescript-community/ui-carto/layers/cluster';
import { ClusteredVectorLayer } from '@nativescript-community/ui-carto/layers/vector';
import { Projection } from '@nativescript-community/ui-carto/projections';
import { CartoMap } from '@nativescript-community/ui-carto/ui';
import { VectorElementVector } from '@nativescript-community/ui-carto/vectorelements';
import { Marker } from '@nativescript-community/ui-carto/vectorelements/marker';
import { Point, PointStyleBuilder } from '@nativescript-community/ui-carto/vectorelements/point';
import { Side } from '@nativescript-community/ui-drawer';
import { showSnack } from '@nativescript-community/ui-material-snackbar';
import { TextField } from '@nativescript-community/ui-material-textfield';
import { ObservableArray } from '@nativescript/core';
import { getJSON } from '@nativescript/core/http';
import { Component, Prop, Watch } from 'vue-property-decorator';
import Map from '~/components/Map';
import ItemFormatter from '~/mapModules/ItemFormatter';
import { IMapModule } from '~/mapModules/MapModule';
import { Address, IItem as Item } from '~/models/Item';
import { statusBarHeight } from '~/variables';
import { queryString } from '../utils/http';
import BaseVueComponent from './BaseVueComponent';
// const addressFormatter = require('@fragaria/address-formatter'); // const OPEN_DURATION = 200;

const providerColors = {
    here: 'blue',
    carto: 'orange',
    photon: 'red',
};
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
        // console.log('PhotonFeature', data);
        // this.data = data;
        const properties = data.properties || {};

        // TODO: extent to zoomBounds

        const actualName = properties.name === properties.city ? undefined : properties.name;
        const {
            region,
            name,
            state,
            street,
            housenumber,
            postcode,
            city,
            country,
            neighbourhood,
            ...actualProperties
        } = properties;
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
            neighbourhood,
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
//         console.log('GoogleFeature', data);
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
        // console.log('HereFeature', data);
        // this.data = data;
        this.properties = {
            id: data.id,
            name: data.title,
            osm_key: data.category.id ? data.category.id.split('-')[0] : undefined,
            vicinity: data.vicinity,
            // url: data.href,
            averageRating: data.averageRating,
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
    _searchDataSource: LocalVectorDataSource<LatLonKeys>;
    _searchLayer: ClusteredVectorLayer;
    @Prop()
    projection: Projection;
    @Prop({ type: Number, default: 1 })
    defaultElevation: number;
    @Prop({ type: String })
    text: string;

    _formatter: ItemFormatter;
    // searchMarkerStyle;
    searchClusterStyle: PointStyleBuilder;
    // searchService: MapBoxOnlineGeocodingService;
    searchAsTypeTimer;
    dataItems: ObservableArray<SearchItem> = new ObservableArray([] as any);
    loading = false;

    filteringOSMKey = false;

    currentSearchText: string = null;

    @Watch('text')
    onTextPropChange(value) {
        // this.log('onTextPropChange', value, !!this.textField);
        if (this.textField) {
            this.textField.text = value;
            this.onTextChange({
                value,
            });
            setTimeout(() => {
                this.textField.requestFocus();
            }, 100);
        }
    }

    get formatter() {
        if (!this._formatter && this.mapComp) {
            this._formatter = this.mapComp.mapModule('formatter');
        }
        return this._formatter;
    }

    get textField() {
        return this.getRef<TextField>('textField');
    }

    get searchDataSource() {
        if (!this._searchDataSource) {
            const projection = this.mapView.projection;
            this._searchDataSource = new LocalVectorDataSource<LatLonKeys>({ projection });
        }
        return this._searchDataSource;
    }
    buildClusterElement(position: MapPos, elements: VectorElementVector) {
        // console.log('buildClusterElement', position, elements.size());
        if (!this.searchClusterStyle) {
            this.searchClusterStyle = new PointStyleBuilder({
                // hideIfOverlapped: false,
                size: 12,
                color: 'red',
            }).buildStyle();
        }

        return new Point({
            position,
            styleBuilder: this.searchClusterStyle,
        });
    }
    itemToMetaData(item: Item) {
        const result = {};
        Object.keys(item).forEach((k) => {
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
            styleBuilder: {
                hideIfOverlapped: false,
                size: 10,
                scaleWithDPI: true,
                color: providerColors[item.provider],
            },
            metaData,
        });
    }
    get searchLayer() {
        if (!this._searchLayer) {
            this._searchLayer = new ClusteredVectorLayer({
                visibleZoomRange: [0, 24],
                dataSource: this.searchDataSource,
                minimumClusterDistance: 20,
                builder: new ClusterElementBuilder({
                    color: 'red',
                    size: 15,
                    shape: 'point',
                    // buildClusterElement: this.buildClusterElement.bind(this)
                }),
                animatedClusters: true,
            });
            this._searchLayer.setVectorElementEventListener<LatLonKeys>({
                onVectorElementClicked: (data) => this.mapComp.onVectorElementClicked(data),
            });
            console.log('creating searchLayer');
            this.mapComp.addLayer(this._searchLayer, 'search');
        }
        return this._searchLayer;
    }
    ensureSearchLayer() {
        return this.searchLayer !== null;
    }

    get searchResultsVisible() {
        return this.hasFocus && this.searchResultsCount > 0;
    }

    getItemIcon(item: SearchItem) {
        return this.formatter.geItemIcon(item);
    }
    getItemIconColor(item: SearchItem) {
        return providerColors[item.provider];
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
        if (global.isAndroid) {
            this.nativeView.marginTop = statusBarHeight + 10;
        }
        if (this.text) {
            this.onTextPropChange(this.text);
        }
    }
    onLoaded() {}
    hasFocus = false;
    onFocus(e) {
        this.log('onFocus');
        this.hasFocus = true;
        if (this.currentSearchText && this.searchResultsCount === 0) {
            this.instantSearch(this.currentSearchText);
        }
    }
    onBlur(e) {
        this.log('onBlur');
        this.hasFocus = false;
    }

    searchForQuery(query) {
        this.textField.text = query;
        setTimeout(() => {
            this.textField.requestFocus();
        }, 100);

        // this.currentSearchText = query;
        // return this.instantSearch(this.currentSearchText);
    }
    onTextChange(e) {
        const query = e.value;
        console.log('onTextChange', query);
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
        return this.$packageService
            .searchInLocalGeocodingService(options)
            .then((result) => this.$packageService.convertGeoCodingResults(result, true));
    }
    searchInVectorTiles(options) {
        return this.$packageService
            .searchInVectorTiles(options)
            .then((result) => this.$packageService.convertFeatureCollection(result));
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
        // console.log('herePlaceSearch', options);
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
                    at: !options.locationRadius
                        ? options.location.lat + ',' + options.location.lon + ';' + options.locationRadius
                        : undefined,
                    in: options.locationRadius
                        ? options.location.lat + ',' + options.location.lon + ';' + options.locationRadius
                        : undefined,
                },
                'https://places.cit.api.here.com/places/v1/discover/search'
            )
        ).then((result: any) =>
            // this.log('herePlaceSearch', result.results.items.length);
            result.results.items.map((f) => new HereFeature(f))
        );
    }
    photonSearch(options: { query: string; language?: string; location?: MapPos<LatLonKeys>; locationRadius?: number }) {
        if (!this.$networkService.connected) {
            return Promise.resolve([]);
        }
        // console.log('photonSearch', options);
        return getJSON(
            queryString(
                {
                    q: options.query,
                    lat: options.location && options.location.lat,
                    lon: options.location && options.location.lon,
                    lang: options.language,
                    limit: 40,
                },
                'http://photon.komoot.de/api'
            )
        ).then(function (results: any) {
            return results.features.filter((r) => r.properties.osm_type !== 'R').map((f) => new PhotonFeature(f));
        });
    }
    currentQuery;
    instantSearch(_query) {
        this.loading = true;
        this.currentQuery = cleanUpString(_query);
        const options = {
            query: cleanUpString(_query),
            projection: this.projection,
            language: this.$packageService.currentLanguage,
            // regexFilter: `.*${cleanUpString(_query)}.*`,
            // filterExpression: `layer::name='transportation_name'`,
            // filterExpression: "layer::name='place' OR layer::name='poi'",
            // `REGEXP_LIKE(name, '${_query}')`
            location: this.$getMapComponent().cartoMap.focusPos,
            // locationRadius: 1000,
        };
        // console.log('instantSearch', _query, options);

        // TODO: dont fail when offline!!!
        this.dataItems = new ObservableArray([] as any);
        return Promise.all([
            this.searchInGeocodingService(options).then((r) => {
                // this.log('found local result', JSON.stringify(r));
                this.dataItems.push(r);
            }),
            // this.searchInVectorTiles(options).then(r => {
            //     this.log('found tile results', JSON.stringify(r));
            //     r && this.dataItems.push(r);
            // }),
            this.herePlaceSearch(options).then((r) => {
                this.dataItems.push(r);
            }),
            this.photonSearch(options).then((r) => {
                // this.log('found photon result', JSON.stringify(r));
                this.dataItems.push(r);
            }),
        ])
            .then((results) => {
                // const items = [].concat.apply([], results);
                // console.log('instantSearch done', this.dataItems.length);
                if (this.dataItems.length === 0) {
                    showSnack({ message: this.$t('no_result_found') });
                }
                if (this.hasFocus) {
                    // this.dataItems = items;
                    // console.log('instantSearch done', this.dataItems.length);
                }
            })
            .catch((err) => {
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
        this.currentQuery = null;
        this.textField.text = null;
        this.showingOnMap = false;
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
        // if (global.isAndroid) {
        //     (this.textField.nativeViewProtected as android.view.View).clearFocus();
        // }
        this.textField.clearFocus();
    }

    focus() {
        this.textField.focus();
    }

    showMenu(side: Side = 'left') {
        // this.log('showMenu', side);
        this.unfocus();
        this.$getAppComponent().drawer.open(side);
    }

    showMapMenu() {
        this.unfocus();
        this.mapComp.showMapMenu();
    }
    public onItemTap(item: SearchItem) {
        // const item = this.dataItems[args.index];
        if (!item) {
            return;
        }
        // const extent = item.properties.extent;
        console.log('Item Tapped', item);
        this.mapComp.selectItem({ item, isFeatureInteresting: true, zoom: 14 });
        this.unfocus();
    }

    get listItems() {
        if (this.filteringOSMKey) {
            return this.dataItems.filter((d) => d.properties.osm_key === this.currentQuery);
        } else {
            return this.dataItems;
        }
    }
    toggleFilterOSMKey() {
        this.filteringOSMKey = !this.filteringOSMKey;
        if (this.showingOnMap) {
            this.showResultsOnMap();
        }
    }
    showingOnMap = false;
    public showResultsOnMap() {
        const dataSource = this.searchDataSource;
        dataSource.clear();
        this.showingOnMap = true;
        const items = this.listItems.filter(
            (d) => !!d && (d.provider === 'here' || (d.provider === 'carto' && d.properties.layer === 'poi'))
        );
        items.forEach((d) => {
            dataSource.add(this.createSearchMarker(d));
        });
        this.ensureSearchLayer();
        this.unfocus();
        const mapBounds = dataSource.getDataExtent();
        this.mapView.moveToFitBounds(mapBounds, undefined, false, false, false, 100);
    }
}
