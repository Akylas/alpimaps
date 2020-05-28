import { CartoOnlineVectorTileLayer } from 'nativescript-carto/layers/vector';
import { CartoMapStyle, fromNativeMapPos, MapPos, nativeVectorToArray } from 'nativescript-carto/core';
import { MergedMBVTTileDataSource, OrderedTileDataSource, TileDataSource } from 'nativescript-carto/datasources';
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
import { PersistentCacheTileDataSource } from 'nativescript-carto/datasources/cache';
import {
    CartoPackageManager,
    CartoPackageManagerListener,
    PackageErrorType,
    PackageManagerTileDataSource,
    PackageStatus
} from 'nativescript-carto/packagemanager';
import { MBVectorTileDecoder } from 'nativescript-carto/vectortiles';
import Observable from 'nativescript-observable';
import { File, Folder, path } from '@nativescript/core/file-system';
import { getDataFolder } from '~/utils';
import { clog, log } from '~/utils/logging';
import { Item } from '~/mapModules/ItemsModule';
import * as appSettings from '@nativescript/core/application-settings';
import { openOrCreate, SQLiteDatabase } from 'nativescript-akylas-sqlite';
import { toRadians, latLngToTileXY } from '~/utils/geo';
import { RouteProfile } from '~/components/DirectionsPanel';
import geolib from '~/helpers/geolib';

export type PackageType = 'geo' | 'routing' | 'map';

interface GeoResult {
    properties?: { [k: string]: any };
    address: Address;
    position?: MapPos<LatLonKeys>;
    provider?: string;
    rank?: number;
}

const average = arr => arr.reduce((p, c) => p + c, 0) / arr.length;

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

    log(...args) {
        clog(`[${this.constructor.name}]`, ...args);
    }
    _docPath;
    get docPath() {
        if (!this._docPath) {
            this._docPath = getDataFolder();
            this.log('docPath', this._docPath);
        }
        return this._docPath;
    }
    get dataFolder() {
        return Folder.fromPath(path.join(this.docPath, 'packages'));
    }
    get geoDataFolder() {
        return Folder.fromPath(path.join(this.docPath, 'geocodingpackages'));
    }
    get routingDataFolder() {
        return Folder.fromPath(path.join(this.docPath, 'routingpackages'));
    }
    get packageManager() {
        if (!this._packageManager) {
            // console.log('creating package manager', this.dataFolder.path);
            // try {
            this._packageManager = new CartoPackageManager({
                source: 'carto.streets',
                dataFolder: this.dataFolder.path,
                listener: new PackageManagerListener('map', this)
            });
            // this._packageManager.getNative(); // to ensure we catch the error right away
            // } catch (error) {
            //     console.log('test', Object.keys(error), Object.keys(error.nativeException), typeof error, error.nativeException);
            //     // Vue.prototype.$showError(error);
            // }
        }
        return this._packageManager;
    }
    get geoPackageManager() {
        if (!this._geoPackageManager) {
            // console.log('creating geo package manager', this.geoDataFolder.path);
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
            // console.log('creating routing package manager', this.routingDataFolder.path);
            this._routingPackageManager = new CartoPackageManager({
                // source: 'routing:nutiteq.osm.car',
                source: 'routing:carto.streets',
                dataFolder: this.routingDataFolder.path,
                listener: new PackageManagerListener('routing', this)
            });
        }
        return this._routingPackageManager;
    }
    started = false;
    start() {
        if (this.started) {
            return;
        }
        this.started = true;
        if (!Folder.exists(this.docPath)) {
            this.log('creating doc folder', Folder.fromPath(this.docPath).path);
        }
        const managerStarted = this.packageManager.start();
        const geoManagerStarted = this.geoPackageManager.start();
        const routingManagerStarted = this.routingPackageManager.start();
        const packages = this._packageManager.getLocalPackages();
        this.log('start packageManager', managerStarted, packages.size());
        const geoPackages = this._geoPackageManager.getLocalPackages();
        // this.log('start geoPackageManager', geoManagerStarted, geoPackages.size());

        const routingPackages = this._routingPackageManager.getLocalPackages();
        if (routingPackages.size() > 0) {
            this.log('test routingPackageManager', routingPackages.get(0).getName(), routingPackages.get(0).getPackageType());
        }
        // this.log('start routingPackageManager', routingManagerStarted, routingPackages.size());
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
        return (
            this.updatePackagesList(this.packageManager) ||
            this.updatePackagesList(this.geoPackageManager) ||
            this.updatePackagesList(this.routingPackageManager)
        );
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
    clearCacheOnDataSource(dataSource: TileDataSource<any, any> & { dataSources?: Array<TileDataSource<any, any>> }) {
        if (dataSource instanceof PersistentCacheTileDataSource) {
            dataSource.clear();
        }
        if (dataSource.dataSources) {
            dataSource.dataSources.forEach(d => this.clearCacheOnDataSource(d));
        }
    }
    clearCache() {
        this.dataSource && this.clearCacheOnDataSource(this.dataSource);
    }
    dataSourcehasContours = false;
    getDataSource(withContour = false) {
        if (this.dataSource && this.dataSourcehasContours !== withContour) {
            this.dataSource = null;
        }
        this.dataSourcehasContours = withContour;
        if (!this.dataSource) {
            const maptileCacheFolder = File.fromPath(path.join(this.docPath, 'maptiler.db'));
            const tilezenCacheFolder = File.fromPath(path.join(this.docPath, 'tilezen.db'));
            const cacheFolder = File.fromPath(path.join(this.docPath, 'carto.db'));
            const terrainCacheFolder = File.fromPath(path.join(this.docPath, 'terrain.db'));
            // console.log('create main vector datasource', cacheFolder.path);

            // const realSource =new HTTPTileDataSource({
            //     url: 'https://tile.nextzen.org/tilezen/vector/v1/all/{z}/{x}/{y}.mvt?api_key=O5iag8fiQIeqwgPFKMsrhA',
            //     minZoom: 0,
            //     maxZoom: 14
            // });
            const realSource = new OrderedTileDataSource({
                dataSources: [
                    new PackageManagerTileDataSource({
                        packageManager: this.packageManager
                    }),
                    new PersistentCacheTileDataSource({
                        // dataSource: new CartoOnlineTileDataSource({
                        //     source: 'carto.streets'
                        // }),
                        dataSource: new HTTPTileDataSource({
                            url: `https://api.maptiler.com/tiles/v3/{z}/{x}/{y}.pbf?key=${gVars.MAPTILER_TOKEN}`,
                            minZoom: 0,
                            maxZoom: 14
                        }),
                        capacity: 100 * 1024 * 1024,
                        databasePath: maptileCacheFolder.path
                    })
                ]
            });
            if (withContour) {
                this.dataSource = new MergedMBVTTileDataSource({
                    dataSources: [
                        realSource,
                        new PersistentCacheTileDataSource({
                            dataSource: new HTTPTileDataSource({
                                minZoom: 9,
                                maxZoom: 14,
                                url: `https://api.maptiler.com/tiles/contours/tiles.json?key=${gVars.MAPTILER_TOKEN}`
                                // url: `https://a.tiles.mapbox.com/v4/mapbox.mapbox-terrain-v2/{zoom}/{x}/{y}.vector.pbf?access_token=${gVars.MAPBOX_TOKEN}`
                            }),
                            capacity: 100 * 1024 * 1024,
                            databasePath: terrainCacheFolder.path
                        })
                    ]
                });
            } else {
                this.dataSource = realSource;
            }
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
    _currentLanguage = appSettings.getString('language', 'en');
    get currentLanguage() {
        return this._currentLanguage;
    }
    set currentLanguage(value) {
        if (this._currentLanguage === value) {
            this._currentLanguage = value;
            // this.log('set currentLanguage', value, !!this._offlineSearchService, !!this._offlineReverseSearchService);
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
    searchInGeocodingService(
        service: ReverseGeocodingService<any, any> | GeocodingService<any, any>,
        options
    ): Promise<GeoResult[]> {
        // this.log('searchInGeocodingService', service['language'], options);
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
    searchInPackageGeocodingService(options: GeocodingRequest<LatLonKeys>): Promise<GeoResult[]> {
        if (!this.started) {
            return Promise.resolve(undefined);
        }
        return this.searchInGeocodingService(this.offlineSearchService, options);
    }
    searchInPackageReverseGeocodingService(options: ReverseGeocodingRequest<LatLonKeys>): Promise<GeoResult[]> {
        if (!this.started) {
            return Promise.resolve(undefined);
        }
        return this.searchInGeocodingService(this.offlineReverseSearchService, options);
    }
    prepareGeoCodingResult(result: GeoResult) {
        const address: any = {};

        [
            ['country', 'getCountry'],
            ['locality', 'getLocality'],
            ['neighbourhood', 'getNeighbourhood'],
            ['state', 'getRegion'],
            ['postcode', 'getPostcode'],
            ['road', 'getStreet'],
            ['houseNumber', 'getHouseNumber'],
            ['county', 'getCounty']
        ].forEach(d => {
            if (!address[d[0]]) {
                const value = result.address[d[1]]();
                if (value.length > 0) {
                    address[d[0]] = value;
                }
            }
        });

        const cat = result.address.getCategories();
        if (cat && cat.size() > 0) {
            result['categories'] = nativeVectorToArray(cat);
        }
        result.provider = 'carto';
        result.properties.name = result.properties.name || result.address.getName();
        result.address = address;
        if (result.properties.name.length === 0) {
            delete result.properties.name;
        }
        return result as Item;
    }

    _elevationDb: SQLiteDatabase;
    getElevationDB() {
        if (!this._elevationDb) {
            if (Folder.exists(LOCAL_MBTILES)) {
                const folder = Folder.fromPath(LOCAL_MBTILES);
                const entities = folder.getEntitiesSync();
                entities.some(s => {
                    if (s.name.endsWith('.etiles')) {
                        console.log('loading eitles', s.path);
                        this._elevationDb = openOrCreate(s.path, android.database.sqlite.SQLiteDatabase.OPEN_READONLY);
                        return true;
                    }
                });
            }
        }
        return this._elevationDb;
    }

    computeProfileFromHeights(profile: { height: number; lat: number; lon: number }[]) {
        let last,
            currentHeight,
            coordIndex,
            currentDistance = 0;

        const result: RouteProfile = {
            max: [-1000, -1000],
            min: [100000, 100000],
            dplus: 0,
            dmin: 0,
            points: [],
            data: []
        };

        let range = 3;
        for (let i = 0; i < profile.length; i++) {
            let min = Math.max(i - range, 0);
            let max = Math.min(i + range, profile.length - 1);
            (profile[i] as any).tmpElevation = Math.round(average(profile.slice(min, max).map(s => s.height)));
        }
        let ascent = 0;
        let descent = 0;
        let lastAlt;
        for (let i = 0; i < profile.length; i++) {
            let sample = profile[i];

            const deltaDistance = last ? geolib.getDistance(last, sample) : 0;
            currentDistance += deltaDistance;
            // sample.height = (sample as any).tmpElevation;
            if (i >= 1) {
                let diff = (sample as any).tmpElevation - lastAlt;
                if (diff > 0) {
                    ascent += diff;
                } else if (diff < 0) {
                    descent -= diff;
                }
                lastAlt = (sample as any).tmpElevation;
            } else {
                lastAlt = (sample as any).tmpElevation;
            }
            delete (sample as any).tmpElevation;
            currentHeight = sample.height;
            if (currentHeight > result.max[1]) {
                result.max[1] = currentHeight;
            }
            if (currentHeight < result.min[1]) {
                result.min[1] = currentHeight;
            }
            result.data.push({ x: Math.round(currentDistance), y: currentHeight });
            coordIndex = i * 2;
            result.points.push({ lat: sample.lat, lon: sample.lon });
            last = sample;
        }
        result.dmin = Math.round(-descent);
        result.dplus = Math.round(ascent);
        // console.log('got profile', result);
        return result;
    }

    async getElevationProfile(_points: MapPos<LatLonKeys>[]) {
        const db = this.getElevationDB();
        if (!db) {
            return null;
        }

        const zoom_level = 11;
        const tilesIndexed = {};

        // sort the points per tile
        _points.forEach((p, index) => {
            const tile = latLngToTileXY(p.lat, p.lon, zoom_level, 512);
            const key = tile.x + '' + tile.y;
            if (!tilesIndexed[key]) {
                tilesIndexed[key] = { x: tile.x, y: tile.y, poses: [] };
            }
            tilesIndexed[key].poses.push({ index, pixelX: tile.pixelX, pixelY: tile.pixelY, ...p });
        });
        const result = [];
        // request all the necessary tiles from db
        await Promise.all(
            Object.keys(tilesIndexed).map(k => {
                const t = tilesIndexed[k];
                return db
                    .get(
                        `SELECT tile_data FROM tiles WHERE zoom_level=${zoom_level} AND tile_row=${(1 << zoom_level) -
                            1 -
                            t.y} and tile_column=${t.x}`
                    )
                    .then(row => {
                        if (row && row.tile_data) {
                            const data = row.tile_data as any;

                            // decode into android bitmap to get access to the pixels
                            const bmp = android.graphics.BitmapFactory.decodeByteArray(data, 0, data.length);
                            t.poses.forEach(p => {
                                const pixel = bmp.getPixel(p.pixelX, p.pixelY);
                                const R = (pixel >> 16) & 0xff;
                                const G = (pixel >> 8) & 0xff;
                                const B = pixel & 0xff;
                                result[p.index] = {
                                    lat: p.lat,
                                    lon: p.lon,
                                    height: Math.round(-10000 + (R * 256 * 256 + G * 256 + B) * 0.1)
                                };
                            });
                            bmp.recycle();
                        }
                    });
            })
        );
        // transform the result into a profile we can use
        return this.computeProfileFromHeights(result);
    }
}
