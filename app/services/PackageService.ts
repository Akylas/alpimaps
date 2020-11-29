import Observable from '@nativescript-community/observable';
import {
    CartoMapStyle,
    IntVector,
    MapPos,
    MapPosVector,
    fromNativeMapPos,
    nativeVectorToArray
} from '@nativescript-community/ui-carto/core';
import { MergedMBVTTileDataSource, OrderedTileDataSource, TileDataSource } from '@nativescript-community/ui-carto/datasources';
import { PersistentCacheTileDataSource } from '@nativescript-community/ui-carto/datasources/cache';
import { HTTPTileDataSource } from '@nativescript-community/ui-carto/datasources/http';
import {
    Address,
    GeocodingRequest,
    GeocodingResult,
    GeocodingResultVector,
    GeocodingService,
    OSMOfflineGeocodingService,
    OSMOfflineReverseGeocodingService,
    PackageManagerGeocodingService,
    PackageManagerReverseGeocodingService,
    ReverseGeocodingRequest,
    ReverseGeocodingService
} from '@nativescript-community/ui-carto/geocoding/service';
import { Feature, FeatureCollection, VectorTileFeatureCollection } from '@nativescript-community/ui-carto/geometry/feature';
import { HillshadeRasterTileLayer } from '@nativescript-community/ui-carto/layers/raster';
import { CartoOnlineVectorTileLayer, VectorTileLayer } from '@nativescript-community/ui-carto/layers/vector';
import {
    CartoPackageManager,
    CartoPackageManagerListener,
    PackageErrorType,
    PackageManagerTileDataSource,
    PackageStatus
} from '@nativescript-community/ui-carto/packagemanager';
import {
    PackageManagerValhallaRoutingService,
    ValhallaOfflineRoutingService,
    ValhallaOnlineRoutingService
} from '@nativescript-community/ui-carto/routing';
import { SearchRequest, VectorTileSearchService } from '@nativescript-community/ui-carto/search';
import { MBVectorTileDecoder } from '@nativescript-community/ui-carto/vectortiles';
import * as app from '@nativescript/core/application';
import * as appSettings from '@nativescript/core/application-settings';
import { File, Folder, path } from '@nativescript/core/file-system';
import KalmanFilter from 'kalmanjs';
import { getDistanceSimple } from '~/helpers/geolib';
import { IItem as Item } from '~/models/Item';
import { RouteProfile } from '~/models/Route';
import { getDataFolder } from '~/utils/utils';

export type PackageType = 'geo' | 'routing' | 'map';

interface GeoResult {
    properties?: { [k: string]: any };
    address: Address;
    position?: MapPos<LatLonKeys>;
    provider?: string;
    rank?: number;
}

class MathFilter {
    filter(_newData): any {
        return _newData;
    }
}

class WindowKalmanFilter extends MathFilter {
    windowLength: number;
    kalmanFilter: KalmanFilter;
    constructor(options) {
        super();
        this.windowLength = options?.windowLength ?? 5;
        this.kalmanFilter = new KalmanFilter(options?.kalman ?? { R: 0.2, Q: 1 });
    }

    datas = [];
    lastData = null;
    filter(_newData) {
        this.datas.push(_newData);
        this.lastData = _newData;
        if (this.datas.length > this.windowLength) {
            this.datas.shift();
        }
        return this.kalmanFilter.filter(
            this.datas.reduce(function (sum, num) {
                return sum + num;
            }, 0) / this.datas.length
        );
    }
}

function getGradeColor(grade) {
    if (grade >= 20) {
        return 'red';
    } else if (grade >= 10) {
        return 'yellow';
    }
    return '#60B3FC';
}

const average = (arr) => arr.reduce((p, c) => p + c, 0) / arr.length;

let PackageManagerListener;
if (gVars.packageServiceEnabled) {
    PackageManagerListener = class implements CartoPackageManagerListener {
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
    };
}

class PackageService extends Observable {
    _packageManager: CartoPackageManager;
    _geoPackageManager: CartoPackageManager;
    _routingPackageManager: CartoPackageManager;
    dataSource: TileDataSource<any, any>;
    vectorTileDecoder: MBVectorTileDecoder;
    downloadingPackages: { [k: string]: number } = {};
    hillshadeLayer?: HillshadeRasterTileLayer;
    localVectorTileLayer?: VectorTileLayer;

    _offlineRoutingSearchService: PackageManagerValhallaRoutingService;
    _localOfflineRoutingSearchService: ValhallaOfflineRoutingService;
    _onlineRoutingSearchService: ValhallaOnlineRoutingService;

    log(...args) {
        console.log(`[${this.constructor.name}]`, ...args);
    }
    _docPath;
    get docPath() {
        if (!this._docPath) {
            this._docPath = getDataFolder();
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
        if (gVars.packageServiceEnabled && !this._packageManager) {
            this._packageManager = new CartoPackageManager({
                source: 'carto.streets',
                dataFolder: this.dataFolder.path,
                listener: new PackageManagerListener('map', this)
            });
        }
        return this._packageManager;
    }
    get geoPackageManager() {
        if (gVars.packageServiceEnabled && !this._geoPackageManager) {
            this._geoPackageManager = new CartoPackageManager({
                source: 'geocoding:carto.streets',
                dataFolder: this.geoDataFolder.path,
                listener: new PackageManagerListener('geo', this)
            });
        }
        return this._geoPackageManager;
    }
    get routingPackageManager() {
        if (gVars.packageServiceEnabled && !this._routingPackageManager) {
            this._routingPackageManager = new CartoPackageManager({
                source: 'routing:carto.streets',
                dataFolder: this.routingDataFolder.path,
                listener: new PackageManagerListener('routing', this)
            });
        }
        return this._routingPackageManager;
    }
    started = false;
    start() {
        if (gVars.packageServiceEnabled) {
            if (this.started) {
                return;
            }
            this.started = true;
            if (!Folder.exists(this.docPath)) {
                console.log('creating doc folder', Folder.fromPath(this.docPath).path);
            }
            const managerStarted = this.packageManager.start();
            const geoManagerStarted = this.geoPackageManager.start();
            const routingManagerStarted = this.routingPackageManager.start();
            const packages = this._packageManager.getLocalPackages();
            const geoPackages = this._geoPackageManager.getLocalPackages();
            const routingPackages = this._routingPackageManager.getLocalPackages();
            this.updatePackagesLists();
        }
    }
    updatePackagesList(manager: CartoPackageManager) {
        if (gVars.packageServiceEnabled) {
            const age = manager.getServerPackageListAge();
            if (age <= 0 || age > 3600 * 24 * 30) {
                return manager.startPackageListDownload();
            }
        }
        return false;
    }
    updatePackagesLists() {
        if (gVars.packageServiceEnabled) {
            return (
                this.updatePackagesList(this.packageManager) ||
                this.updatePackagesList(this.geoPackageManager) ||
                this.updatePackagesList(this.routingPackageManager)
            );
        }
    }
    onPackageListUpdated(type: PackageType) {
        this.notify({ eventName: 'onPackageListUpdated', type, object: this });
    }
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
    }
    updateTotalProgress() {
        const keys = Object.keys(this.downloadingPackages);
        let totalProgress = keys.reduce((result, k) => (result += this.downloadingPackages[k]), 0);
        if (keys.length > 0) {
            totalProgress /= keys.length;
        } else {
            totalProgress = 100;
        }
        this.notify({
            eventName: 'onProgress',
            object: this,
            data: totalProgress
        });
    }
    onPackageCancelled(type: PackageType, id: string, version: number) {
        const key = type + '_' + id;
        delete this.downloadingPackages[key];
        this.updateTotalProgress();
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
    }

    onPackageListFailed(type: PackageType) {
        // console.log('onPackageListFailed');
        this.notify({ eventName: 'onPackageListFailed', type, object: this });
    }

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
    clearCacheOnDataSource(dataSource: TileDataSource<any, any> & { dataSources?: TileDataSource<any, any>[] }) {
        if (dataSource instanceof PersistentCacheTileDataSource) {
            dataSource.clear();
        }
        if (dataSource.dataSources) {
            dataSource.dataSources.forEach((d) => this.clearCacheOnDataSource(d));
        }
    }
    clearCache() {
        this.dataSource && this.clearCacheOnDataSource(this.dataSource);
    }
    dataSourcehasContours = false;
    getDataSource(withContour = false) {
        if (gVars.packageServiceEnabled) {
            if (this.dataSource && this.dataSourcehasContours !== withContour) {
                this.dataSource = null;
            }
            this.dataSourcehasContours = withContour;
            if (!this.dataSource) {
                const maptileCacheFolder = File.fromPath(path.join(this.docPath, 'maptiler.db'));
                // const tilezenCacheFolder = File.fromPath(path.join(this.docPath, 'tilezen.db'));
                // const cacheFolder = File.fromPath(path.join(this.docPath, 'carto.db'));
                const terrainCacheFolder = File.fromPath(path.join(this.docPath, 'terrain.db'));

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
    }
    // getCartoCss() {
    //     return Folder.fromPath(path.join(knownFolders.currentApp().path, 'assets'))
    //         .getFile('style.mss')
    //         .readTextSync();
    // }
    getVectorTileDecoder(style: string = 'voyager') {
        if (gVars.packageServiceEnabled && !this.vectorTileDecoder) {
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
            if (this._offlineSearchService) {
                this._offlineSearchService.language = value;
            }
            if (this._offlineReverseSearchService) {
                this._offlineReverseSearchService.language = value;
            }
            if (this._localOSMOfflineGeocodingService) {
                this._localOSMOfflineGeocodingService.language = value;
            }
            if (this._localOSMOfflineReverseGeocodingService) {
                this._localOSMOfflineReverseGeocodingService.language = value;
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
    convertGeoCodingResults(result: GeocodingResultVector, full = false) {
        const items = [];
        // this.dataItems = new GeocodingResultArray(result);
        const size = result.size();
        for (let i = 0; i < size; i++) {
            items.push(this.convertGeoCodingResult(result.get(i), full));
        }
        return items;
    }

    convertFeatureCollection(features: FeatureCollection) {
        let feature: Feature;
        if (features.getFeatureCount() > 0) {
            feature = features.getFeature(0);
            const r = {
                properties: feature.properties,
                position: feature.geometry ? fromNativeMapPos(feature.geometry.getCenterPos()) : undefined
            } as GeoResult;

            return r;
        }
    }
    convertGeoCodingResult(result: GeocodingResult, full = false) {
        let feature: Feature;
        const rank = result.getRank();
        const features = result.getFeatureCollection();
        if (features.getFeatureCount() > 0) {
            feature = features.getFeature(0);
            const r = {
                rank,
                properties: feature.properties,
                address: result.getAddress(),
                position: feature.geometry ? fromNativeMapPos(feature.geometry.getCenterPos()) : undefined
            } as GeoResult;
            if (full) {
                this.prepareGeoCodingResult(r);
            }
            return r;
        }
    }
    searchInGeocodingService(
        service: ReverseGeocodingService<any, any> | GeocodingService<any, any>,
        options
    ): Promise<GeocodingResultVector> {
        return new Promise((resolve, reject) => {
            service.calculateAddresses(options, (err, result) => {
                if (err) {
                    reject(err);
                    return;
                }
                resolve(result);
            });
        });
    }
    getDefaultMBTilesDir() {
        let localMbtilesSource = appSettings.getString('local_mbtiles_directory');
        if (!localMbtilesSource) {
            let defaultPath = path.join(getDataFolder(), 'alpimaps_mbtiles');
            if (global.isAndroid) {
                const dirs = (app.android.startActivity as android.app.Activity).getExternalFilesDirs(null);
                const sdcardFolder = dirs[dirs.length - 1].getAbsolutePath();
                defaultPath = path.join(sdcardFolder, '../../../..', 'alpimaps_mbtiles');
            }
            localMbtilesSource = appSettings.getString('local_mbtiles_directory', defaultPath);
        }
        return localMbtilesSource;
    }
    _localOSMOfflineGeocodingService: OSMOfflineGeocodingService;
    get localOSMOfflineGeocodingService() {
        if (!this._localOSMOfflineGeocodingService) {
            const folderPath = this.getDefaultMBTilesDir();
            if (Folder.exists(folderPath)) {
                const folder = Folder.fromPath(folderPath);
                const entities = folder.getEntitiesSync();
                entities.some((s) => {
                    if (s.name.endsWith('.nutigeodb')) {
                        this._localOSMOfflineGeocodingService = new OSMOfflineGeocodingService({
                            language: this.currentLanguage,
                            maxResults: 100,
                            path: s.path
                        });
                        return true;
                    }
                });
            }
        }
        return this._localOSMOfflineGeocodingService;
    }
    _localOSMOfflineReverseGeocodingService: OSMOfflineReverseGeocodingService;
    get localOSMOfflineReverseGeocodingService() {
        if (!this._localOSMOfflineReverseGeocodingService) {
            const folderPath = this.getDefaultMBTilesDir();
            if (Folder.exists(folderPath)) {
                const folder = Folder.fromPath(folderPath);
                const entities = folder.getEntitiesSync();
                entities.some((s) => {
                    if (s.name.endsWith('.nutigeodb')) {
                        this._localOSMOfflineReverseGeocodingService = new OSMOfflineReverseGeocodingService({
                            language: this.currentLanguage,
                            path: s.path
                        });
                        return true;
                    }
                });
            }
        }
        return this._localOSMOfflineReverseGeocodingService;
    }
    _vectorTileSearchService: VectorTileSearchService;
    get vectorTileSearchService() {
        if (!this._vectorTileSearchService) {
            if (this.localVectorTileLayer) {
                this._vectorTileSearchService = new VectorTileSearchService({
                    minZoom: 10,
                    maxZoom: 10,
                    layer: this.localVectorTileLayer
                });
            }
        }
        return this._vectorTileSearchService;
    }
    searchInPackageGeocodingService(options: GeocodingRequest<LatLonKeys>): Promise<GeocodingResultVector> {
        if (!this.started) {
            return Promise.resolve(null);
        }
        return this.searchInGeocodingService(this.offlineSearchService, options);
    }
    searchInPackageReverseGeocodingService(options: ReverseGeocodingRequest<LatLonKeys>): Promise<GeocodingResultVector> {
        if (!this.started) {
            return Promise.resolve(null);
        }
        return this.searchInGeocodingService(this.offlineReverseSearchService, options);
    }
    searchInLocalGeocodingService(options: GeocodingRequest<LatLonKeys>): Promise<GeocodingResultVector> {
        const service = this.localOSMOfflineGeocodingService;
        if (!service) {
            return Promise.resolve(null);
        }
        return this.searchInGeocodingService(service, options);
    }
    searchInLocalReverseGeocodingService(options: ReverseGeocodingRequest<LatLonKeys>): Promise<GeocodingResultVector> {
        const service = this.localOSMOfflineReverseGeocodingService;
        if (!service) {
            return Promise.resolve(null);
        }
        return this.searchInGeocodingService(service, options);
    }
    searchInVectorTiles(options: SearchRequest): Promise<VectorTileFeatureCollection> {
        const service = this.vectorTileSearchService;
        if (!service) {
            return Promise.resolve(null);
        }
        return new Promise((resolve) => service.findFeatures(options, (result) => resolve(result)));
    }
    prepareGeoCodingResult(geoRes: GeoResult) {
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
        ].forEach((d) => {
            if (!address[d[0]]) {
                const value = geoRes.address[d[1]]();
                if (value.length > 0) {
                    address[d[0]] = value;
                }
            }
        });

        const cat = geoRes.address.getCategories();
        if (cat && cat.size() > 0) {
            geoRes['categories'] = nativeVectorToArray(cat);
        }
        geoRes.provider = 'carto';
        geoRes.properties.name = geoRes.properties.name || geoRes.address.getName();
        geoRes.address = address;
        if (geoRes.properties.name.length === 0) {
            delete geoRes.properties.name;
        }
        return geoRes as Item;
    }
    async getElevation(pos: MapPos<LatLonKeys>): Promise<number> {
        if (this.hillshadeLayer) {
            return new Promise((resolve, reject) => {
                this.hillshadeLayer.getElevationAsync(pos, (err, result) => {
                    if (err) {
                        reject(err);
                        return;
                    }
                    resolve(result);
                });
            });
        }
        return null;
    }
    async getElevations(pos: MapPosVector<LatLonKeys>): Promise<IntVector> {
        if (this.hillshadeLayer) {
            return new Promise((resolve, reject) => {
                this.hillshadeLayer.getElevationsAsync(pos, (err, result) => {
                    if (err) {
                        reject(err);
                        return;
                    }
                    resolve(result);
                });
            });
        }
        return null;
    }
    getSmoothedGradient(points: { distance: number; altitude: number; altAvg: number; grade }[]) {
        const finalGrades = [];
        const grades: { grad: number; dist: number }[] = [null];
        grades[points.length - 1] = null;
        for (let index = 1; index < points.length - 1; index++) {
            const dist = points[index + 1].distance - points[index - 1].distance;
            if (dist > 0) {
                const grad = Math.max(Math.min((100 * (points[index + 1].altAvg - points[index - 1].altAvg)) / dist, 30), -30);
                grades[index] = {
                    grad,
                    dist: points[index].distance
                };
            } else {
                grades[index] = grades[index - 1];
            }
        }
        for (let index = points.length - 2; 0 <= index; index--) {
            if (null === grades[index] && null !== grades[index + 1]) {
                grades[index] = {
                    grad: grades[index + 1].grad,
                    dist: points[index].distance
                };
            }
        }
        for (let index = 1; index < points.length; index++) {
            if (null === grades[index] && null !== grades[index - 1]) {
                grades[index] = {
                    grad: grades[index - 1].grad,
                    dist: points[index].distance
                };
            }
        }
        const dist = Math.max(Math.min(5, grades.length / 50), 50);
        const lastDist = grades[grades.length - 1].dist;
        const g = Math.min(lastDist / 50, 500);
        for (let index = 0; index < grades.length; index++) {
            let d = 0,
                f = 0;
            let e = 0;
            for (let k = 1; k <= dist && e < g; k++) {
                e =
                    grades[index + k < grades.length ? index + k : grades.length - 1].dist -
                    grades[0 <= index - k ? index - k : 0].dist;
                for (let h = index - k; h < index + k; h++) {
                    if ('undefined' !== typeof grades[h] && null !== grades[h]) {
                        e = Math.pow(grades[h].dist, 2) / (Math.abs(h - index) + 1);
                        f += e * grades[h].grad;
                        d += e;
                    }
                }
            }
            finalGrades[index] = points[index].grade = Math.round(f / d);
        }
        return finalGrades;
    }

    computeProfileFromHeights(positions: MapPosVector<LatLonKeys>, elevations: IntVector) {
        let last: { lat: number; lon: number; altitude: number; tmpElevation: number },
            currentHeight,
            currentDistance = 0;
        const result: RouteProfile = {
            max: [-1000, -1000],
            min: [100000, 100000],
            dplus: 0,
            dmin: 0,
            data: []
        };

        const profile: { lat: number; lon: number; altitude: number; tmpElevation: number }[] = [];
        const altitudeFilter = new WindowKalmanFilter({ windowLength: 5, kalman: { R: 0.2, Q: 1 } });
        for (let i = 0; i < positions.size(); i++) {
            const pos = positions.get(i);
            const altitude = elevations.get(i);
            profile.push({
                lat: pos.getY(),
                lon: pos.getX(),
                altitude,
                tmpElevation: altitudeFilter.filter(elevations.get(i))
            });
        }
        let ascent = 0;
        let descent = 0;
        let lastAlt;
        // let lastAlt2;
        // let grades = [];
        const nbPoints = profile.length;
        const filterStep = Math.min(10, Math.round(nbPoints / 10));

        for (let i = 0; i < nbPoints; i++) {
            const sample = profile[i];

            const deltaDistance = last ? getDistanceSimple(last, sample, 0.5) : 0;
            // const deltaDistance2 = last ? getDistanceSimple(last, sample) : 0;
            currentDistance += deltaDistance;
            // sample.height = (sample as any).tmpElevation;
            let grade;
            if (i >= 1) {
                const diff = (sample as any).tmpElevation - lastAlt;
                const rdiff = Math.round(diff);
                if (rdiff > filterStep) {
                    ascent += rdiff;
                    lastAlt = (sample as any).tmpElevation;
                } else if (diff < -filterStep) {
                    descent -= rdiff;
                    lastAlt = (sample as any).tmpElevation;
                }
                // grade = (deltaDistance === 0) ? 0 : Math.round(((sample.altitude - last.altitude) / deltaDistance) * 100);
                // grades.push(grade);
            } else {
                lastAlt = (sample as any).tmpElevation;
            }
            currentHeight = sample.altitude;

            result.data.push({
                distance: Math.round(currentDistance),
                altitude: currentHeight,
                grade,
                altAvg: (sample as any).tmpElevation
            });
            if ((sample as any).tmpElevation > result.max[1]) {
                result.max[1] = (sample as any).tmpElevation;
            }
            if ((sample as any).tmpElevation < result.min[1]) {
                result.min[1] = (sample as any).tmpElevation;
            }
            // result.points.push({ lat: sample.lat, lon: sample.lon });
            last = sample;

            delete (sample as any).tmpElevation;
            // delete (sample as any).tmp2Elevation;
        }
        // grades.unshift(grades[0]); //no first grade let s copy the next one
        // result.data[0].grade = grades[0];

        const colors = [];
        const grades = this.getSmoothedGradient(result.data);

        // const gradesFiltered = [];
        // for (let i = 0; i < grades.length; i++) {
        //     // let min = Math.max(i - range, 0);
        //     // let max = Math.min(i + range, grades.length - 1);
        //     gradesFiltered[i] = Math.round(grades[i]);
        // }
        let grade,
            lastGrade = grades[0];
        for (let i = 1; i < grades.length; i++) {
            grade = grades[i];
            if (
                lastGrade === undefined ||
                (Math.floor(lastGrade / 10) !== Math.floor(grade / 10) && (lastGrade * grade <= 0 || lastGrade > 0))
            ) {
                colors.push({
                    distance: i,
                    color: getGradeColor(Math.floor(lastGrade !== undefined ? lastGrade : grade))
                });
            }
            lastGrade = grade;
        }
        if (colors[colors.length - 1].distance < grades.length - 1) {
            colors.push({
                distance: grades.length - 1,
                color: getGradeColor(lastGrade)
            });
        }

        result.dmin = Math.round(-descent);
        result.dplus = Math.round(ascent);
        result.colors = colors;
        return result;
    }
    async getElevationProfile(item: Item) {
        if (this.hillshadeLayer && item.route) {
            const elevations = await this.getElevations(item.route.positions);
            if (DEV_LOG) {
                console.log('getElevations done', elevations.size());
            }
            return this.computeProfileFromHeights(item.route.positions, elevations);
        }
        return null;
    }

    offlineRoutingSearchService() {
        if (gVars.packageServiceEnabled) {
            if (!this._offlineRoutingSearchService) {
                this._offlineRoutingSearchService = new PackageManagerValhallaRoutingService({
                    packageManager: packageService.routingPackageManager
                });
            }
            return this._offlineRoutingSearchService;
        } else {
            console.log('offlineRoutingSearchService', !!this._localOfflineRoutingSearchService);
            if (!this._localOfflineRoutingSearchService) {
                const folderPath = packageService.getDefaultMBTilesDir();
                if (Folder.exists(folderPath)) {
                    const folder = Folder.fromPath(folderPath);
                    const entities = folder.getEntitiesSync();
                    entities.some((s) => {
                        if (s.name.endsWith('.vtiles')) {
                            this._localOfflineRoutingSearchService = new ValhallaOfflineRoutingService({
                                path: s.path
                            });
                            return true;
                        }
                    });
                }
            }
            return this._localOfflineRoutingSearchService;
        }
    }

    onlineRoutingSearchService() {
        if (!this._onlineRoutingSearchService) {
            this._onlineRoutingSearchService = new ValhallaOnlineRoutingService({
                apiKey: gVars.MAPBOX_TOKEN
            });
        }
        return this._onlineRoutingSearchService;
    }
}
export const packageService = new PackageService();
