import Observable from '@nativescript-community/observable';
import { GenericMapPos, IntVector, MapPos, MapPosVector, fromNativeMapPos, nativeVectorToArray } from '@nativescript-community/ui-carto/core';
import { TileDataSource } from '@nativescript-community/ui-carto/datasources';
import { PersistentCacheTileDataSource } from '@nativescript-community/ui-carto/datasources/cache';
import {
    GeocodingRequest,
    GeocodingResult,
    GeocodingResultVector,
    GeocodingService,
    MultiOSMOfflineGeocodingService,
    MultiOSMOfflineReverseGeocodingService,
    ReverseGeocodingRequest,
    ReverseGeocodingService
} from '@nativescript-community/ui-carto/geocoding/service';
import { LineGeometry } from '@nativescript-community/ui-carto/geometry';
import { Feature, VectorTileFeature, VectorTileFeatureCollection } from '@nativescript-community/ui-carto/geometry/feature';
import { GeoJSONGeometryReader } from '@nativescript-community/ui-carto/geometry/reader';
import { HillshadeRasterTileLayer } from '@nativescript-community/ui-carto/layers/raster';
import { VectorTileLayer } from '@nativescript-community/ui-carto/layers/vector';
import { MultiValhallaOfflineRoutingService, ValhallaOnlineRoutingService, ValhallaProfile } from '@nativescript-community/ui-carto/routing';
import { SearchRequest, VectorTileSearchService } from '@nativescript-community/ui-carto/search';
import { MBVectorTileDecoder } from '@nativescript-community/ui-carto/vectortiles';
import * as appSettings from '@nativescript/core/application-settings';
import { Folder } from '@nativescript/core/file-system';
import { Point } from 'geojson';
import { getMapContext } from '~/mapModules/MapModule';
import { IItem as Item, Route, RouteProfile } from '~/models/Item';
import { EARTH_RADIUS, TO_RAD } from '~/utils/geo';
import { getDataFolder, getSavedMBTilesDir, listFolder } from '~/utils/utils';

export type PackageType = 'geo' | 'routing' | 'map';

export interface GeoResult extends Item {
    geometry: Point;
}

class MathFilter {
    filter(_newData): any {
        return _newData;
    }
}

function dist2d(latlng1, latlng2) {
    const lat1 = latlng1.lat * TO_RAD,
        lat2 = latlng2.lat * TO_RAD,
        sinDLat = Math.sin(((latlng2.lat - latlng1.lat) * TO_RAD) / 2),
        sinDLon = Math.sin(((latlng2.lon - latlng1.lon) * TO_RAD) / 2),
        a = sinDLat * sinDLat + Math.cos(lat1) * Math.cos(lat2) * sinDLon * sinDLon,
        c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    return EARTH_RADIUS * c;
}

// class WindowKalmanFilter extends MathFilter {
//     windowLength: number;
//     kalmanFilter: KalmanFilter;
//     constructor(options) {
//         super();
//         this.windowLength = options?.windowLength ?? 5;
//         this.kalmanFilter = new KalmanFilter(options?.kalman ?? { R: 0.2, Q: 1 });
//     }

//     datas = [];
//     lastData = null;
//     filter(_newData) {
//         this.datas.push(_newData);
//         this.lastData = _newData;
//         if (this.datas.length > this.windowLength) {
//             this.datas.shift();
//         }
//         return this.kalmanFilter.filter(
//             this.datas.reduce(function (sum, num) {
//                 return sum + num;
//             }, 0) / this.datas.length
//         );
//     }
// }
class WindowFilter extends MathFilter {
    windowLength: number;
    constructor(options) {
        super();
        this.windowLength = options?.windowLength ?? 5;
    }

    datas = [];
    lastData = null;
    filter(_newData) {
        this.datas.push(_newData);
        this.lastData = _newData;
        if (this.datas.length > this.windowLength) {
            this.datas.shift();
        }
        return (
            this.datas.reduce(function (sum, num) {
                return sum + num;
            }, 0) / this.datas.length
        );
    }
}

function getGradeColor(grade) {
    if (grade > 10) {
        return '#EA3223';
    } else if (grade > 7) {
        return '#FFFE54';
    } else if (grade > 4) {
        return '#001CF5';
    } else {
        return '#75FA4C';
    }
}

const streetKeys = ['service_other', 'residential', 'living_street', 'driveway', 'alley', 'footway', 'culdesac', 'parking_aisle', 'turn_channel'];

const geocodingMapping = [
    ['name', 'getName'],
    ['country', 'getCountry'],
    ['city', 'getLocality'],
    ['neighbourhood', 'getNeighbourhood'],
    ['state', 'getRegion'],
    ['postcode', 'getPostcode'],
    ['street', 'getStreet'],
    ['houseNumber', 'getHouseNumber'],
    ['county', 'getCounty']
];

class PackageService extends Observable {
    // vectorTileDecoder: MBVectorTileDecoder;
    hillshadeLayer?: HillshadeRasterTileLayer;
    localVectorTileLayer?: VectorTileLayer;

    _localOfflineRoutingSearchService: MultiValhallaOfflineRoutingService;
    _onlineRoutingSearchService: ValhallaOnlineRoutingService;

    _docPath;
    get docPath() {
        if (!this._docPath) {
            this._docPath = getDataFolder();
        }
        return this._docPath;
    }
    started = false;
    start() {
        if (this.started) {
            return;
        }
        this.started = true;
        if (!Folder.exists(this.docPath)) {
            console.error('creating doc folder', Folder.fromPath(this.docPath).path);
        }
    }
    clearCacheOnDataSource(dataSource: TileDataSource<any, any> & { dataSources?: TileDataSource<any, any>[] }) {
        if (dataSource instanceof PersistentCacheTileDataSource) {
            dataSource.clear();
        }
        if (dataSource.dataSources) {
            dataSource.dataSources.forEach((d) => this.clearCacheOnDataSource(d));
        }
    }
    _currentLanguage = appSettings.getString('language', 'en');
    get currentLanguage() {
        return this._currentLanguage;
    }
    set currentLanguage(value) {
        if (this._currentLanguage === value) {
            this._currentLanguage = value;
            if (this._localOSMOfflineGeocodingService) {
                this._localOSMOfflineGeocodingService.language = value;
            }
            if (this._localOSMOfflineReverseGeocodingService) {
                this._localOSMOfflineReverseGeocodingService.language = value;
            }
        }
    }
    convertGeoCodingResults(result: GeocodingResultVector, full = false) {
        const items: GeoResult[] = [];
        if (!result) {
            return items;
        }
        const size = result.size();
        let item;
        for (let i = 0; i < size; i++) {
            item = this.convertGeoCodingResult(result.get(i), full);
            if (item) {
                items.push(item);
            }
        }
        return items;
    }

    convertFeatureCollection(features: VectorTileFeatureCollection, options: SearchRequest) {
        const projection = this.vectorTileSearchService.options.layer.dataSource.getProjection();
        let feature: VectorTileFeature;
        const count = features.getFeatureCount();
        const result: GeoResult[] = [];
        for (let index = 0; index < count; index++) {
            feature = features.getFeature(index);
            if (!feature.geometry) {
                continue;
            }
            const position = projection.toWgs84(feature.geometry.getCenterPos());
            // if (result.findIndex((i) => i.geometry.coordinates[0] === position.lon && i.geometry.coordinates[1] === position.lat) >= 0) {
            //     continue;
            // }
            result.push({
                properties: { layer: feature.layerName, ...feature.properties } as any,
                geometry: {
                    type: 'Point',
                    coordinates: [position.lon, position.lat]
                },
                distance: feature.distance
            } as GeoResult);
        }
        return result;
    }
    convertGeoCodingResult(result: GeocodingResult, full = false) {
        let feature: Feature;
        const rank = result.getRank();
        const features = result.getFeatureCollection();
        if (features.getFeatureCount() > 0) {
            feature = features.getFeature(0);
            const position = fromNativeMapPos<LatLonKeys>(feature.geometry.getCenterPos());
            const r = {
                properties: { ...feature.properties, address: result.getAddress(), rank },
                geometry: {
                    type: 'Point',
                    coordinates: [position.lon, position.lat]
                }
            } as GeoResult;
            if ('getPos' in feature.geometry === false) {
                r.properties.zoomBounds = features.getBounds();
            }
            if (full) {
                this.prepareGeoCodingResult(r);
                if (!r.properties.name && !r.properties.address['street'] && !r.properties.address['city']) {
                    return;
                }
            }
            return r;
        }
    }
    searchInGeocodingService(service: ReverseGeocodingService<any, any> | GeocodingService<any, any>, options): Promise<GeocodingResultVector> {
        return new Promise((resolve, reject) => {
            service.calculateAddresses(options, (err, result) => {
                // console.log('calculateAddresses', options, err, result && result.size());
                if (err) reject(err);
                else resolve(result);
                resolve(result);
            });
        });
    }

    findFilesWithExtension(extension: string) {
        const result = [];
        const folderPath = getSavedMBTilesDir();
        if (folderPath) {
            const entities = listFolder(folderPath);
            const folders = entities.filter((e) => e.isFolder);
            folders.forEach((f) => {
                const subentities = listFolder(f.path);
                result.push(...subentities.filter((s) => s.path.endsWith(extension)));
            });
        }
        return result;
    }

    _localOSMOfflineGeocodingService: MultiOSMOfflineGeocodingService;
    get localOSMOfflineGeocodingService() {
        if (!this._localOSMOfflineGeocodingService) {
            const files = this.findFilesWithExtension('.nutigeodb');
            const source = (this._localOSMOfflineGeocodingService = new MultiOSMOfflineGeocodingService({
                language: this.currentLanguage
            }));
            files.forEach((f) => source.add(f.path));
        }
        return this._localOSMOfflineGeocodingService;
    }
    _localOSMOfflineReverseGeocodingService: MultiOSMOfflineReverseGeocodingService;
    get localOSMOfflineReverseGeocodingService() {
        if (!this._localOSMOfflineReverseGeocodingService) {
            const files = this.findFilesWithExtension('.nutigeodb');
            const source = (this._localOSMOfflineReverseGeocodingService = new MultiOSMOfflineReverseGeocodingService({
                language: this.currentLanguage
            }));
            files.forEach((f) => source.add(f.path));
        }
        return this._localOSMOfflineReverseGeocodingService;
    }
    _vectorTileSearchService: VectorTileSearchService;
    get vectorTileSearchService() {
        if (!this._vectorTileSearchService) {
            if (this.localVectorTileLayer) {
                this._vectorTileSearchService = new VectorTileSearchService({
                    minZoom: 14,
                    maxZoom: 14,
                    preventDuplicates: true,
                    sortByDistance: true,
                    layers: ['poi', 'place', 'mountain_peak', 'transportation_name', 'landcover_name', 'landuse_name', 'park', 'water_name', 'building_name'],
                    layer: this.localVectorTileLayer
                });
            }
        }
        return this._vectorTileSearchService;
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
    async searchInVectorTiles(options: SearchRequest): Promise<VectorTileFeatureCollection> {
        const service = this.vectorTileSearchService;
        if (!service) {
            return null;
        }
        return new Promise((resolve) => service.findFeatures(options, resolve));
    }
    prepareGeoCodingResult(geoRes: GeoResult, onlyAddress = false) {
        const address: any = {};

        geocodingMapping.forEach((d) => {
            if (!address[d[0]] && d[1] in geoRes.properties.address) {
                try {
                    const value = geoRes.properties.address[d[1]]();
                    if (value.length > 0) {
                        address[d[0]] = value;
                    }
                } catch (err) {
                    console.error('error getting address', d[0], err);
                }
            }
        });
        if ('getCategories' in geoRes.properties.address) {
            const cat = geoRes.properties.address['getCategories']();
            if (cat && cat.size() > 0) {
                geoRes.properties.categories = nativeVectorToArray<string>(cat)
                    .map((s) => s.split(':').reverse())
                    .flat();
            }
        }

        const res = geoRes as Item;
        res.properties.provider = 'carto';
        res.properties.address = address;
        if (!onlyAddress) {
            const name = (geoRes.properties.name = geoRes.properties.name || res.properties.address.name);
            if (name && name.length === 0) {
                delete geoRes.properties.name;
            }
        }
        // console.log('geoRes', JSON.stringify(geoRes));
        return geoRes as Item;
    }
    hasElevation() {
        return !!this.hillshadeLayer;
    }
    async getElevation(pos: MapPos<LatLonKeys>): Promise<number> {
        if (this.hillshadeLayer) {
            return new Promise((resolve, reject) => {
                // console.log('getElevation', pos);
                this.hillshadeLayer.getElevationAsync(pos, (err, result) => {
                    if (err || result === -10000) {
                        reject(err);
                        return;
                    }
                    // console.log('gotElevation', result);
                    resolve(Math.max(0, result));
                });
            });
        }
        return null;
    }
    async getElevations(pos: MapPosVector<LatLonKeys> | GenericMapPos<LatLonKeys>[]): Promise<IntVector> {
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
    getSmoothedGradient(points: { d: number; a: number; avg: number; g }[]) {
        const finalGrades = [];
        const grades: { grad: number; dist: number }[] = [null];
        grades[points.length - 1] = null;
        for (let index = 1; index < points.length - 1; index++) {
            const dist = points[index + 1].d - points[index - 1].d;
            if (dist > 0) {
                const grad = Math.max(Math.min((100 * (points[index + 1].avg - points[index - 1].avg)) / dist, 30), -30);
                grades[index] = {
                    grad,
                    dist: points[index].d
                };
            } else {
                grades[index] = grades[index - 1];
            }
        }
        for (let index = points.length - 2; 0 <= index; index--) {
            if (null === grades[index] && null !== grades[index + 1]) {
                grades[index] = {
                    grad: grades[index + 1].grad,
                    dist: points[index].d
                };
            }
        }
        for (let index = 1; index < points.length; index++) {
            if (null === grades[index] && null !== grades[index - 1]) {
                grades[index] = {
                    grad: grades[index - 1].grad,
                    dist: points[index].d
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
                e = grades.at(index + k < grades.length ? index + k : -1).dist - grades[0 <= index - k ? index - k : 0].dist;
                for (let h = index - k; h < index + k; h++) {
                    if (undefined !== grades[h] && null !== grades[h]) {
                        e = Math.pow(grades[h].dist, 2) / (Math.abs(h - index) + 1);
                        f += e * grades[h].grad;
                        d += e;
                    }
                }
            }
            finalGrades[index] = points[index].g = Math.round(f / d);
        }
        return finalGrades;
    }

    computeProfileFromHeights(positions: MapPosVector<LatLonKeys>, elevations: IntVector) {
        let last: { lat: number; lon: number; altitude: number; tmpElevation?: number },
            currentHeight,
            currentDistance = 0;
        const result: RouteProfile = {
            max: [-1000, -1000],
            min: [100000, 100000],
            dplus: 0,
            dmin: 0,
            data: []
        };

        const profile: { lat: number; lon: number; altitude: number; tmpElevation?: number }[] = [];
        const altitudeFilter = new WindowFilter({ windowLength: 2 });
        const jsElevation: number[] = (elevations as any).toArray();
        const nbPoints = positions.size();
        for (let i = 0; i < positions.size(); i++) {
            const pos = positions.get(i);
            profile.push({
                lat: pos.getY(),
                lon: pos.getX(),
                altitude: jsElevation[i],
                tmpElevation: altitudeFilter.filter(jsElevation[i])
            });
        }
        let ascent = 0;
        let descent = 0;
        let lastAlt;
        const filterStep = 10;
        for (let i = 0; i < nbPoints; i++) {
            const sample = profile[i];

            const deltaDistance = last ? dist2d(last, sample) : 0;
            currentDistance += deltaDistance;
            if (i >= 1) {
                const diff = sample.altitude - lastAlt;
                const rdiff = Math.round(diff);
                if (rdiff > filterStep) {
                    ascent += rdiff;
                    lastAlt = sample.altitude;
                } else if (diff < -filterStep) {
                    descent -= rdiff;
                    lastAlt = sample.altitude;
                }
            } else {
                lastAlt = sample.altitude;
            }
            currentHeight = Math.round(sample.altitude);
            const avg = Math.round(sample.tmpElevation);

            result.data.push({
                d: currentDistance,
                a: currentHeight,
                g: 0,
                avg
            } as any);
            if (currentHeight > result.max[1]) {
                result.max[1] = currentHeight;
            }
            if (sample.tmpElevation < result.min[1]) {
                result.min[1] = currentHeight;
            }
            last = sample;
            delete sample.tmpElevation;
        }
        const colors = [];
        let grade;
        let lastKm = 0.5;
        let gradesCounter = 0;
        let gradeSum = 0;
        let lastIndex = 0;
        lastAlt = result.data[0].a;
        for (let i = 0; i < result.data.length; i++) {
            const pt1 = result.data[i];

            let idelta = 1;
            let pt2 = result.data[Math.min(i + idelta, profile.length - 1)];
            if (pt2.d - pt1.d < 20) {
                if (grade === undefined) {
                    while (pt2.d - pt1.d < 20 && i + idelta < profile.length) {
                        idelta++;
                        pt2 = result.data[Math.min(i + idelta, profile.length - 1)];
                    }
                } else {
                    pt1.g = grade;
                    continue;
                }
            }
            grade = ((pt2.avg - pt1.avg) / (pt2.d - pt1.d)) * 100;
            pt1.g = grade;
            gradeSum += grade;
            gradesCounter += 1;
            if (pt1.d / 1000 > lastKm) {
                lastKm += 0.5;
                const avgGrade = gradeSum / gradesCounter;
                gradeSum = 0;
                gradesCounter = 0;
                colors.push({
                    d: lastIndex,
                    g: avgGrade,
                    color: getGradeColor(Math.abs(avgGrade))
                });
                for (let j = lastIndex; j <= i; j++) {
                    result.data[j].avg = avgGrade;
                }
                lastIndex = i;
                lastAlt = pt1.a;
            }
        }
        if (colors.length && colors[colors.length - 1].lastIndex < result.data.length - 1) {
            const avgGrade = gradeSum / gradesCounter;
            colors.push({
                d: result.data.length - 1,
                g: avgGrade,
                color: getGradeColor(avgGrade)
            });
        }
        result.dmin = Math.round(-descent);
        result.dplus = Math.round(ascent);
        result.colors = colors;
        return result;
    }
    _reader: GeoJSONGeometryReader;
    getGeoJSONReader() {
        if (!this._reader) {
            this._reader = new GeoJSONGeometryReader({
                targetProjection: getMapContext().getProjection()
            });
        }
        return this._reader;
    }

    getRouteItemGeometry(item: Item) {
        let geometry = item._nativeGeometry || (packageService.getGeoJSONReader().readGeometry(item._geometry || JSON.stringify(item.geometry)) as LineGeometry<LatLonKeys>);
        if (geometry['getGeometryCount']) {
            geometry = geometry['getGeometry'](0);
        }
        if (!item._nativeGeometry) {
            item._nativeGeometry = geometry.getNative?.() || geometry;
        }
        return item._nativeGeometry;
    }

    getRouteItemPoses(item: Item) {
        const geometry = this.getRouteItemGeometry(item);
        return geometry.getPoses() as MapPosVector<LatLonKeys>;
    }
    getItemCenter(item: Item) {
        if (!!item?.route) {
            return fromNativeMapPos(this.getRouteItemGeometry(item).getCenterPos());
        }
        return (item.geometry as Point).coordinates;
    }
    async getElevationProfile(item: Item, positions?: MapPosVector<LatLonKeys>) {
        if (this.hillshadeLayer && (!item || item.geometry.type === 'LineString' || item.geometry.type === 'MultiLineString')) {
            const startTime = Date.now();
            if (!positions) {
                positions = this.getRouteItemPoses(item);
            }
            const elevations = await this.getElevations(positions);
            const result = this.computeProfileFromHeights(positions, elevations);
            DEV_LOG && console.log('getElevations done', Date.now() - startTime, 'ms');
            return result;
        }
        return null;
    }

    async getStats({
        projection,
        points,
        profile,
        attributes = ['edge.surface', 'edge.road_class', 'edge.sac_scale', 'edge.use', 'edge.length'],
        shape_match = 'walk_or_snap'
    }: {
        projection;
        points;
        profile?: ValhallaProfile;
        attributes?: string[];
        shape_match?: string;
    }) {
        const service = this.offlineRoutingSearchService() || this.onlineRoutingSearchService();
        if (service instanceof MultiValhallaOfflineRoutingService || service instanceof ValhallaOnlineRoutingService) {
            const startTime = Date.now();
            DEV_LOG && console.log('matchRoute', points);
            const matchResult = await service.matchRoute(
                {
                    projection,
                    points,
                    accuracy: 1,
                    customOptions: {
                        shape_match,
                        filters: { attributes, action: 'include' }
                    }
                },
                profile
            );
            DEV_LOG && console.log('got trace attributes', Date.now() - startTime, 'ms');
            return JSON.parse(matchResult.getRawResult()).edges;
        }
    }
    async fetchStats({ projection, positions, item, route, profile }: { projection; positions?; item?; route?: Route; profile?: ValhallaProfile }) {
        if (!route) {
            route = item.route;
        }
        const edges = await this.getStats({ projection, points: positions || this.getRouteItemPoses(item), profile });
        if (!edges) {
            return;
        }
        const stats: {
            [k: string]: { [k: string]: number };
        } = { surfaces: {}, waytypes: {} };
        const totalDistanceKm = route.totalDistance / 1000;
        try {
            for (let index = 0; index < edges.length; index++) {
                const edge = edges[index];
                let key;
                if (edge.sac_scale > 0) {
                    key = 'sac_scale_' + edge.sac_scale;
                } else if (!edge.use || edge.use === 'null' || edge.use === 'road') {
                    key = edge.road_class;
                } else {
                    key = edge.use;
                }
                if (streetKeys.indexOf(key) !== -1) {
                    key = 'street';
                } else if (key === 'secondary' || key === 'tertiary' || key === 'unclassified' || key === 'service_road' || key === 'pedestrian_crossing') {
                    key = 'road';
                } else if (key === 'motorway' || key === 'trunk' || key === 'primary') {
                    key = 'highway';
                }
                stats.waytypes[key] = stats.waytypes[key] ? stats.waytypes[key] + edge.length : edge.length;
                key = edge.surface;
                stats.surfaces[key] = stats.surfaces[key] ? stats.surfaces[key] + edge.length : edge.length;
            }
        } catch (error) {
            console.error(error, error.stack);
        }

        const resultStats = {
            waytypes: Object.keys(stats.waytypes)
                .map((s) => ({ perc: stats.waytypes[s] / totalDistanceKm, dist: stats.waytypes[s], id: s }))
                .sort((a, b) => b.perc - a.perc),
            surfaces: Object.keys(stats.surfaces)
                .map((s) => ({ perc: stats.surfaces[s] / totalDistanceKm, dist: stats.surfaces[s], id: s }))
                .sort((a, b) => b.perc - a.perc)
        };

        DEV_LOG &&
            console.log(
                'stats',
                resultStats.waytypes.reduce((prev, current) => prev + current.dist, 0),
                resultStats.surfaces.reduce((prev, current) => prev + current.perc, 0),
                resultStats.waytypes.reduce((prev, current) => prev + current.perc, 0),
                JSON.stringify(resultStats),
                resultStats.waytypes.map((s) => s.id),
                resultStats.surfaces.map((s) => s.id)
            );
        return resultStats;
    }
    hasOfflineRouting = true;
    offlineRoutingSearchService() {
        // console.log('offlineRoutingSearchService', !!this._localOfflineRoutingSearchService);
        if (this.hasOfflineRouting && !this._localOfflineRoutingSearchService) {
            const files = this.findFilesWithExtension('.vtiles');
            if (files.length) {
                const source = (this._localOfflineRoutingSearchService = new MultiValhallaOfflineRoutingService());
                source.setConfigurationParameter('service_limits.bicycle.max_distance', 255000);
                source.setConfigurationParameter('service_limits.trace.max_distance', 500000);
                files.forEach((f) => source.add(f.path));
            } else {
                this.hasOfflineRouting = false;
            }
        }
        return this._localOfflineRoutingSearchService;
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
