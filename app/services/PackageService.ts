import { CartoMapStyle, fromNativeMapPos, MapPos, nativeVectorToArray } from 'nativescript-carto/core/core';
import { PersistentCacheTileDataSource } from 'nativescript-carto/datasources/cache';
import { CartoOnlineTileDataSource } from 'nativescript-carto/datasources/cartoonline';
import { MergedMBVTTileDataSource, OrderedTileDataSource, TileDataSource } from 'nativescript-carto/datasources/datasource';
import { HTTPTileDataSource } from 'nativescript-carto/datasources/http';
import {
    Address,
    GeocodingRequest,
    GeocodingResult,
    GeocodingResultVector,
    GeocodingService,
    PackageManagerGeocodingService,
    PackageManagerReverseGeocodingService,
    ReverseGeocodingRequest,
    ReverseGeocodingService
} from 'nativescript-carto/geocoding/service';
import { Feature, FeatureCollection } from 'nativescript-carto/geometry/feature';
import { CartoOnlineVectorTileLayer } from 'nativescript-carto/layers/vector';
import { CartoPackageManager, CartoPackageManagerListener, PackageErrorType, PackageManagerTileDataSource, PackageStatus } from 'nativescript-carto/packagemanager/packagemanager';
import { MBVectorTileDecoder } from 'nativescript-carto/vectortiles/vectortiles';
import { Observable } from 'tns-core-modules/data/observable/observable';
import { File, Folder, path } from 'tns-core-modules/file-system';
import { getDataFolder } from '~/utils';
import { log } from '~/utils/logging';
import { Item } from '~/mapModules/ItemsModule';

export type PackageType = 'geo' | 'routing' | 'map';
const docPath = getDataFolder();

interface GeoResult {
    properties?: { [k: string]: any };
    address: Address;
    position?: MapPos;
}

class PackageManagerListener implements CartoPackageManagerListener {
    constructor(private type: PackageType, public superThis: PackageService) {}
    onPackageCancelled(id: string, version: number) {
        this.superThis.onPackageCancelled.call(this.superThis, this.type, id, version);
    }
    onPackageFailed(arg1: string, version: number, errorType: PackageErrorType) {
        this.superThis.onPackageFailed.call(this.superThis, this.type, arg1, version, errorType);
    }
    onPackageListFailed() {
        this.superThis.onPackageListFailed.call(this.superThis, this.type);
    }
    onPackageListUpdated() {
        this.superThis.onPackageListUpdated.call(this.superThis, this.type);
    }
    onPackageStatusChanged(arg1: string, version: number, status: PackageStatus) {
        this.superThis.onPackageStatusChanged.call(this.superThis, this.type, arg1, version, status);
    }
    onPackageUpdated(arg1: string, version: number) {
        this.superThis.onPackageUpdated.call(this.superThis, this.type, arg1, version);
    }
    // onStyleFailed?(styleName: string) {
    //     this.superThis.onStyleFailed(this.type, styleName);
    // }
    // onStyleUpdated?(styleName: string) {
    //     this.superThis.onStyleUpdated(this.type, styleName);
    // }
}
export default class PackageService extends Observable {
    dataFolder = Folder.fromPath(path.join(docPath, 'packages'));
    geoDataFolder = Folder.fromPath(path.join(docPath, 'geocodingpackages'));
    routingDataFolder = Folder.fromPath(path.join(docPath, 'routingpackages'));
    _packageManager: CartoPackageManager;
    _geoPackageManager: CartoPackageManager;
    _routingPackageManager: CartoPackageManager;
    dataSource: TileDataSource<any, any>;
    vectorTileDecoder: MBVectorTileDecoder;
    downloadingPackages: { [k: string]: number } = {};
    constructor() {
        super();

        // this.packageManager.start();
    }

    get packageManager() {
        if (!this._packageManager) {
            console.log('creating package manager', this.dataFolder.path);
            this._packageManager = new CartoPackageManager({
                source: 'carto.streets',
                dataFolder: this.dataFolder.path,
                listener: new PackageManagerListener('map', this)
            });
        }
        return this._packageManager;
    }
    get geoPackageManager() {
        if (!this._geoPackageManager) {
            console.log('creating geo package manager', this.geoDataFolder.path);
            this._geoPackageManager = new CartoPackageManager({
                source: 'geocoding:carto.streets',
                dataFolder: this.geoDataFolder.path,
                listener: new PackageManagerListener('geo', this)
            });
        }
        return this._geoPackageManager;
    }
    get routingPackageManager() {
        if (!this._routingPackageManager) {
            console.log('creating routing package manager', this.routingDataFolder.path);
            this._routingPackageManager = new CartoPackageManager({
                // source: 'routing:nutiteq.osm.car',
                source: 'routing:carto.streets',
                dataFolder: this.routingDataFolder.path,
                listener: new PackageManagerListener('routing', this)
            });
        }
        return this._routingPackageManager;
    }
    start() {
        const managerStarted = this.packageManager.start();
        const geoManagerStarted = this.geoPackageManager.start();
        const routingManagerStarted = this.routingPackageManager.start();
        const packages = this._packageManager.getLocalPackages();
        console.log('start packageManager', managerStarted, packages.size());
        const geoPackages = this._geoPackageManager.getLocalPackages();
        console.log('start geoPackageManager', geoManagerStarted, geoPackages.size());

        const routingPackages = this._routingPackageManager.getLocalPackages();
        if (routingPackages.size() > 0) {
            console.log('test routingPackageManager', routingPackages.get(0).getName(), routingPackages.get(0).getPackageType());
        }
        console.log('start routingPackageManager', routingManagerStarted, routingPackages.size());
        this.updatePackagesLists();
    }
    updatePackagesList(manager: CartoPackageManager) {
        const age = manager.getServerPackageListAge();
        // console.log('getServerPackageListAge', age);
        if (age <= 0 || age > 3600 * 24 * 30) {
            return manager.startPackageListDownload();
        }
        return false;
    }
    updatePackagesLists() {
        return this.updatePackagesList(this.packageManager) || this.updatePackagesList(this.geoPackageManager) || this.updatePackagesList(this.routingPackageManager);
    }
    @log
    onPackageListUpdated(type: PackageType) {
        this.notify({ eventName: 'onPackageListUpdated', type, object: this });
        // console.log('onPackageListUpdated', type);
    }
    @log
    onPackageStatusChanged(type: PackageType, id: string, version: number, status: PackageStatus) {
        const key = type + '_' + id;
        this.downloadingPackages[key] = status.getProgress();
        this.updateTotalProgress();
        this.notify({
            eventName: 'onPackageStatusChanged',
            object: this,
            type,
            data: {
                id,
                version,
                status
            }
        });
        // console.log('onPackageStatusChanged', id, version, status.getProgress());
    }
    updateTotalProgress() {
        const keys = Object.keys(this.downloadingPackages);
        let totalProgress = keys.reduce((result, k) => (result += this.downloadingPackages[k]), 0);
        if (keys.length > 0) {
            totalProgress /= keys.length;
        } else {
            totalProgress = 100;
        }
        // console.log('updateTotalProgress', keys, totalProgress);
        this.notify({
            eventName: 'onProgress',
            object: this,
            data: totalProgress
        });
    }
    @log
    onPackageCancelled(type: PackageType, id: string, version: number) {
        const key = type + '_' + id;
        delete this.downloadingPackages[key];
        this.updateTotalProgress();
        // console.log('onPackageCancelled', id, version);
        this.notify({
            eventName: 'onPackageCancelled',
            object: this,
            type,
            data: {
                id,
                version
            }
        });
    }

    @log
    onPackageFailed(type: PackageType, id: string, version: number, errorType: PackageErrorType) {
        const key = type + '_' + id;
        delete this.downloadingPackages[key];
        this.updateTotalProgress();
        this.notify({
            eventName: 'onPackageFailed',
            object: this,
            type,
            data: {
                id,
                version,
                errorType
            }
        });
        // console.log('onPackageFailed', id, version, errorType);
    }

    @log
    onPackageListFailed(type: PackageType) {
        // console.log('onPackageListFailed');
        this.notify({ eventName: 'onPackageListFailed', type, object: this });
    }

    @log
    onPackageUpdated(type: PackageType, id: string, version: number) {
        const key = type + '_' + id;
        delete this.downloadingPackages[key];
        this.updateTotalProgress();
        // console.log('onPackageFailed', id, version);
        this.notify({
            eventName: 'onPackageUpdated',
            object: this,
            type,
            data: {
                id,
                version
            }
        });
    }

    getDataSource() {
        if (!this.dataSource) {
            const maptileCacheFolder = File.fromPath(path.join(docPath, 'maptiler.db'));
            const cacheFolder = File.fromPath(path.join(docPath, 'carto.db'));
            const terrainCacheFolder = File.fromPath(path.join(docPath, 'terrain.db'));
            console.log('create main vector datasource', cacheFolder.path);
            this.dataSource = new MergedMBVTTileDataSource({
                dataSources: [
                    new OrderedTileDataSource({
                        dataSources: [
                            new PackageManagerTileDataSource({
                                packageManager: this.packageManager
                            }),
                            new PersistentCacheTileDataSource({
                                dataSource: new CartoOnlineTileDataSource({
                                    source: 'carto.streets'
                                }),
                                // dataSource: new HTTPTileDataSource({
                                //     url: 'https://api.maptiler.com/tiles/v3/{z}/{x}/{y}.pbf?key=V7KGiDaKQBCWTYsgsmxh',
                                //     minZoom: 0,
                                //     maxZoom: 14
                                // }),
                                capacity: 100 * 1024 * 1024,
                                databasePath: cacheFolder.path
                            })
                        ]
                    }),
                    new PersistentCacheTileDataSource({
                        dataSource: new HTTPTileDataSource({
                            minZoom: 0,
                            maxZoom: 14,
                            url: `https://a.tiles.mapbox.com/v4/mapbox.mapbox-terrain-v2/{zoom}/{x}/{y}.vector.pbf?access_token=${gVars.MAPBOX_TOKEN}`
                        }),
                        capacity: 100 * 1024 * 1024,
                        databasePath: terrainCacheFolder.path
                    })
                ]
            });
        }
        return this.dataSource;
    }
    // getCartoCss() {
    //     return Folder.fromPath(path.join(knownFolders.currentApp().path, 'assets'))
    //         .getFile('style.mss')
    //         .readTextSync();
    // }
    getVectorTileDecoder(style: string = 'voyager') {
        if (!this.vectorTileDecoder) {
            // console.log('cartoCss', cartoCss);
            // this.vectorTileDecoder = new MBVectorTileDecoder({
            //     style,
            //     dirPath: '~/assets/styles/walkaholic',
            //     liveReload: TNS_ENV !== 'production',
            //     // zipPath: '~/assets/styles/walkaholic.zip'
            // });
            this.vectorTileDecoder = new CartoOnlineVectorTileLayer({ style: CartoMapStyle.VOYAGER }).getTileDecoder();
        }
        return this.vectorTileDecoder;
    }
    _currentLanguage = 'en';
    get currentLanguage() {
        return this._currentLanguage;
    }
    set currentLanguage(value) {
        if (this._currentLanguage === value) {
            this._currentLanguage = value;
            if (this._offlineSearchService) {
                this._offlineSearchService.language = value;
            }
            if (this._offlineReverseSearchService) {
                this._offlineReverseSearchService.language = value;
            }
        }
    }
    _offlineSearchService: PackageManagerGeocodingService;
    get offlineSearchService() {
        if (!this._offlineSearchService) {
            this._offlineSearchService = new PackageManagerGeocodingService({
                packageManager: this.geoPackageManager,
                language: this.currentLanguage
            });
        }
        return this._offlineSearchService;
    }
    _offlineReverseSearchService: PackageManagerReverseGeocodingService;
    get offlineReverseSearchService() {
        if (!this._offlineReverseSearchService) {
            this._offlineReverseSearchService = new PackageManagerReverseGeocodingService({
                packageManager: this.geoPackageManager,
                language: this.currentLanguage
            });
        }
        return this._offlineReverseSearchService;
    }
    convertGeoCodingResult(result: GeocodingResultVector) {
        const items = [];
        // this.dataItems = new GeocodingResultArray(result);
        let geoRes: GeocodingResult, features: FeatureCollection, feature: Feature;
        for (let i = 0; i < result.size(); i++) {
            geoRes = result.get(i);
            const address = geoRes.getAddress();
            const rank = geoRes.getRank();
            features = geoRes.getFeatureCollection();
            if (features.getFeatureCount() > 0) {
                // geoRes = result.get(j);
                feature = features.getFeature(0);
                // console.log('convertGeoCodingResult', feature.properties, address, feature.geometry, rank);
                items.push({
                    rank,
                    categories: nativeVectorToArray(address.getCategories()),
                    properties: feature.properties,
                    address,
                    position: feature.geometry ? fromNativeMapPos(feature.geometry.getCenterPos()) : undefined
                });
            }
            // for (let j = 0; j < features.getFeatureCount(); j++) {

            // }
        }
        return items;
    }
    searchInGeocodingService(service: ReverseGeocodingService<any, any> | GeocodingService<any, any>, options): Promise<GeoResult[]> {
        return new Promise((resolve, reject) => {
            service.calculateAddresses(options, (err, result) => {
                if (err) {
                    reject(err);
                    return;
                }
                resolve(this.convertGeoCodingResult(result));
            });
        });
    }
    searchInPackageGeocodingService(options: GeocodingRequest) {
        return this.searchInGeocodingService(this.offlineSearchService, options);
    }
    searchInPackageReverseGeocodingService(options: ReverseGeocodingRequest) {
        return this.searchInGeocodingService(this.offlineReverseSearchService, options);
    }
    prepareGeoCodingResult(result: GeoResult) {
        const address: any = result.address || {};

        [['country', 'getCountry'], ['neighbourhood', 'getNeighbourhood'], ['postcode', 'getPostcode'], ['road', 'getStreet'], ['houseNumber', 'getHouseNumber'], ['city', 'getCounty']].forEach(d => {
            if (!address[d[0]]) {
                const value = result.address[d[1]]();
                if (value.length > 0) {
                    address[d[0]] = value;
                }
            }
        });
        result.address = address;
        result.properties.name = result.properties.name || result.address.getName();
        return result as Item;
    }
}
