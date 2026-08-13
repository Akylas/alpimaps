import { getFromLocation } from '@nativescript-community/geocoding';
import Observable from '@nativescript-community/observable';
import { DoubleVector, GenericMapPos, MapBounds, MapPos, MapPosVector, fromNativeMapPos, nativeVectorToArray } from '@nativescript-community/ui-carto/core';
import { TileDataSource } from '@nativescript-community/ui-carto/datasources';
import { PersistentCacheTileDataSource } from '@nativescript-community/ui-carto/datasources/cache';
import { MBTilesTileDataSource } from '@nativescript-community/ui-carto/datasources/mbtiles';
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
import { Geometry, LineGeometry } from '@nativescript-community/ui-carto/geometry';
import { Feature, VectorTileFeature, VectorTileFeatureCollection } from '@nativescript-community/ui-carto/geometry/feature';
import { GeoJSONGeometryReader } from '@nativescript-community/ui-carto/geometry/reader';
import { GeoJSONGeometryWriter } from '@nativescript-community/ui-carto/geometry/writer';
import { HillshadeRasterTileLayer } from '@nativescript-community/ui-carto/layers/raster';
import { VectorTileLayer } from '@nativescript-community/ui-carto/layers/vector';
import { Projection } from '@nativescript-community/ui-carto/projections';
import { MultiValhallaOfflineRoutingService, ValhallaOnlineRoutingService, ValhallaProfile } from '@nativescript-community/ui-carto/routing';
import { SearchRequest, VectorTileSearchService, VectorTileSearchServiceOptions } from '@nativescript-community/ui-carto/search';
import { File, Folder, knownFolders, path } from '@nativescript/core/file-system';
import type { Point as GeoJSONPoint } from 'geojson';
import { LineString, MultiLineString, Point } from 'geojson';
import { getMapContext } from '~/mapModules/MapModule';
import { Address, AscentSegment, IItem, IItem as Item, Route, RouteInstruction, RouteProfile, RoutingAction } from '~/models/Item';
import { EARTH_RADIUS, TO_RAD, computeDistanceBetween } from '~/utils/geo';
import { type GradeOptions, buildGradeSections, computeGrades } from '~/utils/grade';
import { projectOnRoute } from '~/utils/navigation';
import { instructionsFromResult } from '~/utils/routing';
import { getDataFolder, getSavedMBTilesDir, listFolder } from '~/utils/utils';
import { networkService } from './NetworkService';
import { Application, ApplicationSettings } from '@akylas/nativescript';
import { get } from 'svelte/store';
import { useOfflineGeocodeAddress, useSystemGeocodeAddress } from '~/stores/mapStore';
import {
    DEFAULT_ELEVATION_PROFILE_ASCENTS_DIP_TOLERANCE,
    DEFAULT_ELEVATION_PROFILE_ASCENTS_MIN_GAIN,
    DEFAULT_ELEVATION_PROFILE_FILTER_STEP,
    DEFAULT_ELEVATION_PROFILE_GRADE_BASELINE,
    DEFAULT_ELEVATION_PROFILE_GRADE_MIN_SECTION,
    DEFAULT_ELEVATION_PROFILE_GRADE_SMOOTH,
    DEFAULT_ELEVATION_PROFILE_GRADE_STEP,
    DEFAULT_ELEVATION_PROFILE_SMOOTH_WINDOW,
    DEFAULT_VALHALLA_MAX_DISTANCE_AUTO,
    DEFAULT_VALHALLA_MAX_DISTANCE_BICYCLE,
    DEFAULT_VALHALLA_MAX_DISTANCE_PEDESTRIAN,
    DEFAULT_VALHALLA_ONLINE_URL,
    SETTINGS_ELEVATION_PROFILE_ASCENTS_DIP_TOLERANCE,
    SETTINGS_ELEVATION_PROFILE_ASCENTS_MIN_GAIN,
    SETTINGS_ELEVATION_PROFILE_FILTER_STEP,
    SETTINGS_ELEVATION_PROFILE_GRADE_BASELINE,
    SETTINGS_ELEVATION_PROFILE_GRADE_MIN_SECTION,
    SETTINGS_ELEVATION_PROFILE_GRADE_SMOOTH,
    SETTINGS_ELEVATION_PROFILE_GRADE_STEP,
    SETTINGS_ELEVATION_PROFILE_SMOOTH_WINDOW,
    SETTINGS_VALHALLA_MAX_DISTANCE_AUTO,
    SETTINGS_VALHALLA_MAX_DISTANCE_BICYCLE,
    SETTINGS_VALHALLA_MAX_DISTANCE_PEDESTRIAN,
    SETTINGS_VALHALLA_MAX_DISTANCE_TRACE,
    SETTINGS_VALHALLA_ONLINE_URL
} from '~/utils/constants';
import { fullLangStore } from '~/helpers/locale';
import { isPointInsideBounds } from '~/helpers/geolib';

export type PackageType = 'geo' | 'routing' | 'map';

export interface GeoResult extends Item {
    geometry: Point;
}

class MathFilter {
    filter(_newData): any {
        return _newData;
    }
}

const VECTORTILESEARCH_OPTIONS = ['minZoom', 'maxZoom', 'maxResults', 'layers', 'preventDuplicates', 'sortByDistance'];

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

let geocodingAvailable = true;
/** valhalla rejects requests with too many locations, and a recorded track has thousands of points */
const TRACK_ROUTING_MAX_POINTS = 40;
/** meters: closer via points than this add nothing but request size */
const TRACK_ROUTING_MIN_SPACING = 150;
/** meters: how far a routed maneuver may sit from the recorded track and still be matched to it */
const TRACK_INSTRUCTION_TOLERANCE = 60;

/**
 * Picks via points spread along a track: keeps the ends, then adds points no closer than
 * TRACK_ROUTING_MIN_SPACING, thinning further if that still leaves too many for valhalla.
 */
function sampleTrackForRouting(positions: MapPosVector<LatLonKeys>) {
    const size = positions.size();
    const candidates: MapPos<LatLonKeys>[] = [];
    let previous = fromNativeMapPos<LatLonKeys>(positions.get(0));
    candidates.push(previous);
    for (let index = 1; index < size - 1; index++) {
        const current = fromNativeMapPos<LatLonKeys>(positions.get(index));
        if (computeDistanceBetween(previous, current) >= TRACK_ROUTING_MIN_SPACING) {
            candidates.push(current);
            previous = current;
        }
    }
    const last = fromNativeMapPos<LatLonKeys>(positions.get(size - 1));

    const result: MapPos<LatLonKeys>[] = [];
    // keep both ends whatever the thinning: they are the actual start and destination
    const step = Math.max(1, Math.ceil(candidates.length / (TRACK_ROUTING_MAX_POINTS - 1)));
    for (let index = 0; index < candidates.length; index += step) {
        result.push(candidates[index]);
    }
    result.push(last);
    return result;
}

class PackageService extends Observable {
    // vectorTileDecoder: MBVectorTileDecoder;
    hillshadeLayer?: HillshadeRasterTileLayer;
    localVectorTileLayer?: VectorTileLayer;

    mLocalOfflineRoutingSearchService: MultiValhallaOfflineRoutingService;
    mOnlineRoutingSearchService: ValhallaOnlineRoutingService;

    mDocPath;
    get docPath() {
        if (!this.mDocPath) {
            this.mDocPath = getDataFolder();
        }
        return this.mDocPath;
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
    _currentLanguage = ApplicationSettings.getString('language', 'en');
    get currentLanguage() {
        return this._currentLanguage;
    }
    set currentLanguage(value) {
        if (this._currentLanguage === value) {
            this._currentLanguage = value;
            if (this.mLocalOSMOfflineGeocodingService) {
                this.mLocalOSMOfflineGeocodingService.language = value;
            }
            if (this.mLocalOSMOfflineReverseGeocodingService) {
                this.mLocalOSMOfflineReverseGeocodingService.language = value;
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

    convertFeatureCollection(features: VectorTileFeatureCollection, options: SearchRequest & { bounds?: IMapBounds }) {
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
            if (options.bounds && !isPointInsideBounds(position, options.bounds)) {
                continue;
            }
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

    mLocalOSMOfflineGeocodingService: MultiOSMOfflineGeocodingService;
    hasLocalOSMOfflineGeocodingService = true;
    get localOSMOfflineGeocodingService() {
        if (this.hasLocalOSMOfflineGeocodingService && !this.mLocalOSMOfflineGeocodingService) {
            const files = this.findFilesWithExtension('.nutigeodb');
            if (files.length) {
                const source = (this.mLocalOSMOfflineGeocodingService = new MultiOSMOfflineGeocodingService({
                    language: this.currentLanguage
                }));
                files.forEach((f) => source.add(f.path));
            } else {
                this.hasLocalOSMOfflineGeocodingService = false;
            }
        }
        return this.mLocalOSMOfflineGeocodingService;
    }
    mLocalOSMOfflineReverseGeocodingService: MultiOSMOfflineReverseGeocodingService;
    hasLocalOSMOfflineReverseGeocodingService = true;
    get localOSMOfflineReverseGeocodingService() {
        if (this.hasLocalOSMOfflineReverseGeocodingService && !this.mLocalOSMOfflineReverseGeocodingService) {
            const files = this.findFilesWithExtension('.nutigeodb');
            if (files.length) {
                const source = (this.mLocalOSMOfflineReverseGeocodingService = new MultiOSMOfflineReverseGeocodingService({
                    language: this.currentLanguage
                }));
                files.forEach((f) => source.add(f.path));
            } else {
                this.hasLocalOSMOfflineReverseGeocodingService = false;
            }
        }
        return this.mLocalOSMOfflineReverseGeocodingService;
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
    _timezoneTileSearchService: VectorTileSearchService;
    timezoneVectorTileDataSource?: MBTilesTileDataSource;
    get timezoneTileSearchService() {
        if (!this._timezoneTileSearchService) {
            if (this.timezoneVectorTileDataSource === undefined) {
                this.timezoneVectorTileDataSource = new MBTilesTileDataSource({
                    databasePath: path.join(knownFolders.currentApp().path, 'assets', 'timezone.mbtiles')
                });
            }

            if (this.timezoneVectorTileDataSource) {
                this._timezoneTileSearchService = new VectorTileSearchService({
                    minZoom: 3,
                    maxZoom: 3,
                    preventDuplicates: true,
                    sortByDistance: true,
                    dataSource: this.timezoneVectorTileDataSource,
                    decoder: getMapContext().mapDecoder
                });
            }
        }
        return this._timezoneTileSearchService;
    }

    async getItemAddress(item: IItem, projection: Projection) {
        try {
            const service = this.localOSMOfflineReverseGeocodingService;
            let foundAddress = false;
            const geometry = item.geometry as GeoJSONPoint;
            const location = { lat: geometry.coordinates[1], lon: geometry.coordinates[0] };
            // DEV_LOG && console.log('fetching addresses', !!service, JSON.stringify(location), get(useOfflineGeocodeAddress), get(useSystemGeocodeAddress), geocodingAvailable, !!service);
            if (get(useOfflineGeocodeAddress) && service) {
                const radius = 200;
                const res = await packageService.searchInGeocodingService(service, {
                    projection,
                    location,
                    searchRadius: radius
                });
                const props = item.properties;
                if (res) {
                    let bestFind: GeoResult;
                    for (let index = 0; index < res.size(); index++) {
                        const r = packageService.convertGeoCodingResult(res.get(index), true);

                        if (
                            r &&
                            r.properties.rank > 0.6 &&
                            computeDistanceBetween(location, {
                                lat: r.geometry.coordinates[1],
                                lon: r.geometry.coordinates[0]
                            }) <= radius
                        ) {
                            if (!bestFind || Object.keys(r.properties.address).length > Object.keys(bestFind.properties.address).length) {
                                bestFind = r;
                            } else if (bestFind && props.address && props.address['street']) {
                                break;
                            }
                        } else {
                            break;
                        }
                    }
                    // DEV_LOG && console.log('fetched addresses', bestFind, $selectedItem.geometry === item.geometry);
                    if (bestFind) {
                        foundAddress = true;
                        const result = { ...bestFind.properties.address, name: null, ...(props.housenumber ? { houseNumber: props.housenumber } : {}) } as any as Address;
                        return result;
                    }
                }
            }
            if (!foundAddress && get(useSystemGeocodeAddress) && geocodingAvailable) {
                const results = await getFromLocation(location.lat, location.lon, 10);
                // DEV_LOG && console.log('getFromLocation', JSON.stringify(results));
                if (results?.length > 0) {
                    const result = results[0];
                    return {
                        city: result.locality,
                        country: result.country,
                        state: result.administrativeArea,
                        housenumber: result.subThoroughfare,
                        postcode: result.postalCode,
                        street: result.thoroughfare
                    } as any as Address;
                }
            }
        } catch (error) {
            if (__ANDROID__ && /IOException.*UNAVAILABLE$/.test(error.toString())) {
                geocodingAvailable = false;
            }
            // for now we dont throw error, only return undefined
            console.error('error fetching address', error, error.stack);
        }
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

    async searchInVectorTiles(options: SearchRequest & VectorTileSearchServiceOptions): Promise<VectorTileFeatureCollection> {
        const service = this.vectorTileSearchService;
        if (!service) {
            return null;
        }
        const toRestoreSettings = {};
        Object.keys(options)
            .filter((s) => VECTORTILESEARCH_OPTIONS.indexOf(s) !== -1)
            .forEach((s) => {
                toRestoreSettings[s] = service[s];
                service[s] = options[s];
            });
        DEV_LOG && console.log('searchInVectorTiles', service.minZoom, service.maxZoom, JSON.stringify(toRestoreSettings));
        const result = await new Promise<VectorTileFeatureCollection<LatLonKeys>>((resolve) => service.findFeatures(options, resolve));
        Object.keys(toRestoreSettings).forEach((s) => {
            service[s] = toRestoreSettings[s];
        });
        return result;
    }

    getTimezone(position: MapPos<LatLonKeys>) {
        const service = this.timezoneTileSearchService;
        if (!service) {
            return null;
        }
        return service.findFeatures({
            projection: getMapContext().getProjection(),
            position,
            searchRadius: 10
        });
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
                    resolve(Math.max(-100, Math.round(result)));
                });
            });
        }
        return null;
    }
    /** the carto layer interpolates, so these are real doubles: rounding them destroys the grade */
    async getElevations(pos: MapPosVector<LatLonKeys> | GenericMapPos<LatLonKeys>[]): Promise<DoubleVector> {
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

    computeProfileFromHeights(positions: MapPosVector<LatLonKeys>, elevations: DoubleVector | number[]) {
        const smoothWindow = ApplicationSettings.getNumber(SETTINGS_ELEVATION_PROFILE_SMOOTH_WINDOW, DEFAULT_ELEVATION_PROFILE_SMOOTH_WINDOW);
        const filterStep = ApplicationSettings.getNumber(SETTINGS_ELEVATION_PROFILE_FILTER_STEP, DEFAULT_ELEVATION_PROFILE_FILTER_STEP);
        const ascentsMinGain = ApplicationSettings.getNumber(SETTINGS_ELEVATION_PROFILE_ASCENTS_MIN_GAIN, DEFAULT_ELEVATION_PROFILE_ASCENTS_MIN_GAIN);
        const ascentsDipTolerance = ApplicationSettings.getNumber(SETTINGS_ELEVATION_PROFILE_ASCENTS_DIP_TOLERANCE, DEFAULT_ELEVATION_PROFILE_ASCENTS_DIP_TOLERANCE);
        let last: { lat: number; lon: number; altitude: number; tmpElevation?: number },
            currentHeight,
            currentDistance = 0;
        const result: RouteProfile = {
            max: [-1000, -1000],
            min: [100000, 100000],
            dplus: 0,
            dmin: 0,
            data: [],
            ascents: []
        };

        const profile: { lat: number; lon: number; altitude: number; tmpElevation?: number }[] = [];
        const altitudeFilter = new WindowFilter({ windowLength: smoothWindow });
        const jsElevation: number[] = typeof elevations['toArray'] === 'function' ? (elevations as any).toArray() : elevations;
        const usingNative = typeof positions.size === 'function';
        const getPos = usingNative
            ? (i) => {
                  const pos = positions.get(i);
                  return [pos.getX(), pos.getY()];
              }
            : (i) => positions[i];
        const nbPoints = usingNative ? positions.size() : positions['length'];
        for (let i = 0; i < nbPoints; i++) {
            const pos = getPos(i);
            profile.push({
                lat: pos[1],
                lon: pos[0],
                altitude: jsElevation[i],
                tmpElevation: altitudeFilter.filter(jsElevation[i])
            });
        }
        let ascent = 0;
        let descent = 0;
        let lastAlt;
        /** smoothed altitudes, kept unrounded: the grade is differentiated from these */
        const smoothedElevations: number[] = [];

        const ascents: AscentSegment[] = [];
        let startIndex: number | null = null;
        let highestElevation = -Infinity;
        let highestPointIndex = -1;
        let currentMinSincePeak = Infinity;
        let inBetweenAscent = false;

        for (let i = 0; i < nbPoints; i++) {
            const sample = profile[i];

            const deltaDistance = last ? computeDistanceBetween(last, sample) : 0;
            currentDistance += deltaDistance;

            if (i >= 1) {
                const diff = sample.tmpElevation - lastAlt;
                const rdiff = Math.round(diff);
                if (rdiff > filterStep) {
                    ascent += rdiff;
                    lastAlt = sample.tmpElevation;
                } else if (rdiff < -filterStep) {
                    descent -= rdiff;
                    lastAlt = sample.tmpElevation;
                }
            } else {
                lastAlt = sample.tmpElevation;
            }
            currentHeight = Math.round(sample.altitude);

            function getElevation(index) {
                return Math.round(profile[index].altitude);
            }
            const elevation = getElevation(i);
            smoothedElevations.push(sample.tmpElevation);
            result.data.push({
                d: Math.round(currentDistance * 100) / 100,
                dp: Math.round(ascent),
                dm: Math.round(-descent),
                a: currentHeight
            });
            if (currentHeight > result.max[1]) {
                result.max[1] = currentHeight;
            }
            if (currentHeight < result.min[1]) {
                result.min[1] = currentHeight;
            }
            last = sample;
            delete sample.tmpElevation;

            // ascent detection
            if (startIndex === null) {
                startIndex = i;
                highestElevation = elevation;
                highestPointIndex = i;
                currentMinSincePeak = elevation;
                continue;
            }

            // Update the highest point in the current segment
            if (elevation > highestElevation) {
                highestElevation = elevation;
                highestPointIndex = i;
                currentMinSincePeak = elevation;
                inBetweenAscent = false;
            } else if (inBetweenAscent) {
                startIndex = i;
                highestElevation = elevation;
                highestPointIndex = i;
                currentMinSincePeak = elevation;
                continue;
            }

            // Track the lowest point after the peak
            if (i > highestPointIndex) {
                currentMinSincePeak = Math.min(currentMinSincePeak, elevation);
            }

            const dipFromPeak = highestElevation - currentMinSincePeak;

            if (dipFromPeak > ascentsDipTolerance) {
                // Too much dip – end current ascent if gain is enough
                const gain = highestElevation - getElevation(startIndex);
                if (gain >= ascentsMinGain) {
                    ascents.push({
                        startIndex,
                        endIndex: highestPointIndex,
                        gain,
                        highestElevation,
                        highestPointIndex
                    });
                }

                // Start a new potential ascent from current point
                startIndex = i;
                highestElevation = elevation;
                highestPointIndex = i;
                currentMinSincePeak = elevation;
                inBetweenAscent = true;
                continue;
            }

            // End the ascent if it's the last point
            const isLast = i === nbPoints - 1;
            const gain = highestElevation - getElevation(startIndex);
            if (isLast && gain >= ascentsMinGain) {
                ascents.push({
                    startIndex,
                    endIndex: highestPointIndex,
                    gain,
                    highestElevation,
                    highestPointIndex
                });
            }
        }
        const gradeOptions: GradeOptions = {
            step: ApplicationSettings.getNumber(SETTINGS_ELEVATION_PROFILE_GRADE_STEP, DEFAULT_ELEVATION_PROFILE_GRADE_STEP),
            smoothDistance: ApplicationSettings.getNumber(SETTINGS_ELEVATION_PROFILE_GRADE_SMOOTH, DEFAULT_ELEVATION_PROFILE_GRADE_SMOOTH),
            baseline: ApplicationSettings.getNumber(SETTINGS_ELEVATION_PROFILE_GRADE_BASELINE, DEFAULT_ELEVATION_PROFILE_GRADE_BASELINE),
            minSectionLength: ApplicationSettings.getNumber(SETTINGS_ELEVATION_PROFILE_GRADE_MIN_SECTION, DEFAULT_ELEVATION_PROFILE_GRADE_MIN_SECTION)
        };
        const distances = result.data.map((point) => point.d);
        const grades = computeGrades(distances, smoothedElevations, gradeOptions);
        for (let i = 0; i < result.data.length; i++) {
            result.data[i].g = Math.round(grades[i] * 10) / 10;
        }
        const sections = buildGradeSections(result.data, grades, smoothedElevations, gradeOptions);
        result.dmin = Math.round(-descent);
        result.dplus = Math.round(ascent);
        result.sections = sections;
        // the chart takes its gradient stops as indices into `data`
        result.colors = sections.map((section) => ({ d: section.startIndex, color: section.color }));
        result.ascents = ascents;
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
        return item._nativeGeometry as Geometry<LatLonKeys>;
    }

    getRouteItemPoses(item: Item) {
        const geometry = this.getRouteItemGeometry(item) as any as LineGeometry<LatLonKeys>;
        return geometry?.getPoses();
    }
    getItemCenter(item: Item) {
        if (!!item?.route) {
            return fromNativeMapPos(this.getRouteItemGeometry(item).getCenterPos());
        }
        return (item.geometry as Point).coordinates;
    }
    async getElevationProfile(item: Item, positions?: MapPosVector<LatLonKeys>) {
        if (!item || item.geometry.type === 'LineString' || item.geometry.type === 'MultiLineString') {
            if (this.hillshadeLayer) {
                const startTime = Date.now();
                if (!positions) {
                    positions = this.getRouteItemPoses(item);
                }
                const elevations = await this.getElevations(positions);
                const result = this.computeProfileFromHeights(positions, elevations);
                DEV_LOG && console.log('getElevations done', Date.now() - startTime, 'ms');
                return result;
            } else {
                const startTime = Date.now();
                let positions;
                if (item._nativeGeometry) {
                    const writer = new GeoJSONGeometryWriter<LatLonKeys>({
                        sourceProjection: getMapContext().getProjection()
                    });
                    const geometry = JSON.parse(writer.writeGeometry(item._nativeGeometry));
                    positions = (geometry as MultiLineString | LineString).coordinates;
                    if (Array.isArray(positions[0][0])) {
                        positions = positions.flatten();
                    }
                } else {
                    const geometry = item.geometry || JSON.parse(item._geometry);
                    positions = (geometry as MultiLineString | LineString).coordinates;
                    if (Array.isArray(positions[0][0])) {
                        positions = positions.flatten();
                    }
                }
                //    DEV_LOG && console.log('getValhallaElevationProfile', positions.length);
                const webResult = await networkService.getValhallaElevationProfile(positions);
                // DEV_LOG && console.log('getValhallaElevationProfile elevations', Object.keys(webResult), webResult.range_height.length, JSON.stringify(webResult.range_height));
                const result = this.computeProfileFromHeights(
                    positions,
                    webResult.range_height.map((e) => e[1])
                );
                DEV_LOG && console.log('getElevations done', Date.now() - startTime, 'ms');
                return result;
            }
        }
        return null;
    }

    async getStats({
        // the shape indices are what lets us say which surface is *ahead*, not just how much of it there is
        attributes = ['edge.surface', 'edge.road_class', 'edge.sac_scale', 'edge.use', 'edge.length', 'edge.begin_shape_index', 'edge.end_shape_index'],
        item,
        points,
        profile,
        projection,
        shape_match = 'walk_or_snap'
    }: {
        item;
        projection;
        points;
        profile?: ValhallaProfile;
        attributes?: string[];
        shape_match?: string;
    }) {
        const service = this.offlineRoutingSearchService();
        if (service instanceof MultiValhallaOfflineRoutingService) {
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
        } else {
            const startTime = Date.now();
            let positions;
            if (item._nativeGeometry) {
                const writer = new GeoJSONGeometryWriter<LatLonKeys>({
                    sourceProjection: getMapContext().getProjection()
                });
                const geometry = JSON.parse(writer.writeGeometry(item._nativeGeometry));
                positions = (geometry as MultiLineString | LineString).coordinates;
                if (Array.isArray(positions[0][0])) {
                    positions = positions.flatten();
                }
            } else {
                const geometry = item.geometry || JSON.parse(item._geometry);
                positions = (geometry as MultiLineString | LineString).coordinates;
                if (Array.isArray(positions[0][0])) {
                    positions = positions.flatten();
                }
            }
            DEV_LOG && console.log('getStats', positions.length);
            const webResult = await networkService.getValhallaTraceAttributes(positions, {
                shape_match,
                filters: { attributes, action: 'include' }
            });
            // DEV_LOG && console.log('getStats result', Object.keys(webResult));
            // const result = this.computeProfileFromHeights(
            //     positions,
            //     webResult.range_height.map((e) => e[1])
            // );
            DEV_LOG && console.log('getStats done', Date.now() - startTime, 'ms');
            return webResult.edges;
        }
    }
    async fetchStats({ item, positions, profile, projection, route }: { projection; positions?; item?; route?: Route; profile?: ValhallaProfile }) {
        if (!route) {
            route = item.route;
        }
        const edges = await this.getStats({ item, projection, points: positions || this.getRouteItemPoses(item), profile });
        if (!edges) {
            return;
        }
        const stats: {
            [k: string]: { [k: string]: number };
        } = { surfaces: {}, waytypes: {} };
        // where each surface actually is along the route, so navigation can show what is coming up
        const surfaceSegments: { id: string; start: number; end: number }[] = [];
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
                    //  key = 'highway';
                }
                stats.waytypes[key] = stats.waytypes[key] ? stats.waytypes[key] + edge.length : edge.length;
                key = edge.surface;
                stats.surfaces[key] = stats.surfaces[key] ? stats.surfaces[key] + edge.length : edge.length;
                if (edge.begin_shape_index >= 0 && edge.end_shape_index > edge.begin_shape_index) {
                    const previous = surfaceSegments[surfaceSegments.length - 1];
                    // valhalla splits a road into many edges: merge the consecutive ones sharing a surface
                    if (previous?.id === key && previous.end === edge.begin_shape_index) {
                        previous.end = edge.end_shape_index;
                    } else {
                        surfaceSegments.push({ id: key, start: edge.begin_shape_index, end: edge.end_shape_index });
                    }
                }
                if (edge.unpaved) {
                    stats.surfaces['unpaved'] = stats.surfaces['unpaved'] ? stats.surfaces['unpaved'] + edge.length : edge.length;
                }
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
                .sort((a, b) => b.perc - a.perc),
            surfaceSegments
        };

        DEV_LOG && console.log('stats', JSON.stringify(resultStats));
        return resultStats;
    }
    hasOfflineRouting = true;

    setValhallaSetting(key, defaultValue) {
        const source = this.mLocalOfflineRoutingSearchService;
        const value = ApplicationSettings.getNumber(key, defaultValue);
        if (value !== defaultValue) {
            source.setConfigurationParameter(key, value);
        }
    }
    /**
     * Turns a recorded track into navigation instructions.
     *
     * An imported gpx carries no maneuvers, and valhalla's map matching cannot supply them either:
     * the binding only exposes trace_attributes, which returns edge attributes and no maneuvers. So we
     * route through the track instead, sampling it into via points and asking for a normal route.
     *
     * The computed route snaps to the road graph, so its own point indices mean nothing to the track.
     * Each maneuver is therefore projected back onto the track to get an index the navigation can use.
     */
    async computeTrackInstructions({ item, profile = 'pedestrian', projection }: { item: Item; projection; profile?: ValhallaProfile }): Promise<RouteInstruction[]> {
        const trackPositions = this.getRouteItemPoses(item);
        const trackSize = trackPositions?.size() ?? 0;
        if (trackSize < 2) {
            return null;
        }
        const points = sampleTrackForRouting(trackPositions);
        DEV_LOG && console.log('computeTrackInstructions', trackSize, 'track points ->', points.length, 'via points');
        const { result } = await this.computeRoute({ points, projection, profile });
        const routePoints = result.getPoints();

        let lastTrackIndex = -1;
        const instructions = instructionsFromResult(result, (pointIndex) => {
            const routePoint = fromNativeMapPos<LatLonKeys>(routePoints.get(pointIndex));
            // a generous tolerance: the routed line and the recorded track never overlap exactly
            const projected = projectOnRoute(routePoint, trackPositions, { fromIndex: lastTrackIndex, tolerance: TRACK_INSTRUCTION_TOLERANCE });
            if (!projected) {
                return null;
            }
            lastTrackIndex = projected.index;
            return projected.index;
        });
        DEV_LOG && console.log('computeTrackInstructions got', instructions.length, 'instructions');
        return instructions.length ? instructions : null;
    }

    /**
     * One route, computed offline when we can and online otherwise, with no ui attached.
     *
     * The directions panel builds its own costing options out of what the user is looking at; this is
     * for everything that has to route without a panel — a recorded track, or a reroute during
     * navigation, which reuses the costing options stored on the route it is rerouting.
     */
    async computeRoute({
        costingOptions,
        points,
        profile = 'pedestrian',
        projection
    }: {
        points: GenericMapPos<LatLonKeys>[];
        projection;
        profile?: ValhallaProfile;
        /** valhalla `costing_options`, as stored on a computed route */
        costingOptions?: any;
    }) {
        const service = this.offlineRoutingSearchService() || this.onlineRoutingSearchService();
        if (!service) {
            throw new Error('no_routing_service');
        }
        const customOptions: any = { language: get(fullLangStore) };
        if (costingOptions) {
            customOptions.costing_options = costingOptions;
        }
        const result = await service.calculateRoute<LatLonKeys>({ projection, points, customOptions }, profile);
        return { result, positions: result.getPoints(), totalDistance: result.getTotalDistance(), totalTime: result.getTotalTime() };
    }

    offlineRoutingSearchService() {
        if (this.hasOfflineRouting && !this.mLocalOfflineRoutingSearchService) {
            const files = this.findFilesWithExtension('.vtiles');
            const currentLanguage = get(fullLangStore);
            if (files.length) {
                const source = (this.mLocalOfflineRoutingSearchService = new MultiValhallaOfflineRoutingService());
                this.setValhallaSetting(SETTINGS_VALHALLA_MAX_DISTANCE_PEDESTRIAN, DEFAULT_VALHALLA_MAX_DISTANCE_PEDESTRIAN);
                this.setValhallaSetting(SETTINGS_VALHALLA_MAX_DISTANCE_AUTO, DEFAULT_VALHALLA_MAX_DISTANCE_AUTO);
                this.setValhallaSetting(SETTINGS_VALHALLA_MAX_DISTANCE_BICYCLE, DEFAULT_VALHALLA_MAX_DISTANCE_BICYCLE);
                this.setValhallaSetting(SETTINGS_VALHALLA_MAX_DISTANCE_TRACE, DEFAULT_VALHALLA_MAX_DISTANCE_BICYCLE);
                files.forEach((f) => source.add(f.path));
                if (currentLanguage !== 'en-US' && SUPPORTED_VALHALLA_LOCALES.indexOf(currentLanguage) !== -1) {
                    const localeData = require(`~/assets/valhalla/${currentLanguage}.json`);
                    DEV_LOG && console.log('loading custom valhalla locale', currentLanguage);
                    this.mLocalOfflineRoutingSearchService.addLocale(currentLanguage, JSON.stringify(localeData));
                }
            } else {
                this.hasOfflineRouting = false;
            }
        }
        return this.mLocalOfflineRoutingSearchService;
    }

    setOnlineRoutingUrl(url: string) {
        if (this.mOnlineRoutingSearchService) {
            this.mOnlineRoutingSearchService.customServiceURL = url + +'/{service}';
        }
    }

    onlineRoutingSearchService() {
        if (!this.mOnlineRoutingSearchService) {
            this.mOnlineRoutingSearchService = new ValhallaOnlineRoutingService({
                customServiceURL: ApplicationSettings.getString(SETTINGS_VALHALLA_ONLINE_URL, DEFAULT_VALHALLA_ONLINE_URL) + '/{service}',
                profile: 'pedestrian',
                httpHeaders: {
                    'X-Client-Id': 'AlpiMaps'
                }
            });
        }
        return this.mOnlineRoutingSearchService;
    }
}
export const packageService = new PackageService();
