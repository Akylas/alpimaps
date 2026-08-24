import { getFromLocation } from '@nativescript-community/geocoding';
import Observable from '@nativescript-community/observable';
import * as api from '@nativescript-community/ui-massifmaps/api';
import type { MassifLayer, MassifObject, MassifSource } from '@nativescript-community/ui-massifmaps/api';
import { File, Folder, knownFolders, path } from '@nativescript/core/file-system';
import type { Point as GeoJSONPoint } from 'geojson';
import { LineString, MultiLineString, Point } from 'geojson';
import { getMapContext } from '~/mapModules/MapModule';
import { Address, AscentSegment, IItem, IItem as Item, Route, RouteInstruction, RouteProfile, RoutingAction } from '~/models/Item';
import { EARTH_RADIUS, type MapPos, TO_RAD, computeDistanceBetween, fromPosition, geometryBounds, geometryCenter, toPosition } from '~/utils/geo';

/** `[lng, lat]` pairs, which is what the valhalla HTTP helpers take. */
const toLngLat = (positions: MapPos[]): [number, number][] => positions.map((p) => [p.lon, p.lat]);
import { type GradeOptions, buildGradeSections, computeGrades } from '~/utils/grade';
import { projectOnRoute } from '~/utils/navigation';
import { type ValhallaProfile, instructionsFromResult } from '~/utils/routing';
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

/** app field name -> the key the SDK serialises the address under */
const geocodingMapping: [string, string][] = [
    ['name', 'name'],
    ['country', 'country'],
    ['city', 'locality'],
    ['neighbourhood', 'neighbourhood'],
    ['state', 'region'],
    ['postcode', 'postcode'],
    ['street', 'street'],
    ['houseNumber', 'houseNumber'],
    ['county', 'county']
];

let geocodingAvailable = true;
let geocodingRequestId = 0;
let searchRequestId = 0;
let routingRequestId = 0;

/** What a tile search takes. The zoom/result knobs are properties of the SERVICE, not the request. */
export interface SearchOptions {
    position?: MapPos;
    geometry?: GeoJSON.Geometry;
    searchRadius?: number;
    regexFilter?: string;
    filterExpression?: string;
    minZoom?: number;
    maxZoom?: number;
    maxResults?: number;
    layers?: string[];
    preventDuplicates?: boolean;
    sortByDistance?: boolean;
    bounds?: IMapBounds;
}

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
function sampleTrackForRouting(positions: MapPos[]) {
    const size = positions.length;
    const candidates: MapPos[] = [];
    let previous = positions[0];
    candidates.push(previous);
    for (let index = 1; index < size - 1; index++) {
        const current = positions[index];
        if (computeDistanceBetween(previous, current) >= TRACK_ROUTING_MIN_SPACING) {
            candidates.push(current);
            previous = current;
        }
    }
    const last = positions[size - 1];

    const result: MapPos[] = [];
    // keep both ends whatever the thinning: they are the actual start and destination
    const step = Math.max(1, Math.ceil(candidates.length / (TRACK_ROUTING_MAX_POINTS - 1)));
    for (let index = 0; index < candidates.length; index += step) {
        result.push(candidates[index]);
    }
    result.push(last);
    return result;
}

class PackageService extends Observable {
    hillshadeLayer?: MassifLayer<'massif::HillshadeRasterTileLayer'>;
    localVectorTileLayer?: MassifLayer<'massif::VectorTileLayer'>;

    mLocalOfflineRoutingSearchService: MassifObject<'massif::MultiValhallaOfflineRoutingService'>;
    mOnlineRoutingSearchService: MassifObject<'massif::ValhallaOnlineRoutingService'>;

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
    _currentLanguage = ApplicationSettings.getString('language', 'en');
    get currentLanguage() {
        return this._currentLanguage;
    }
    set currentLanguage(value) {
        if (this._currentLanguage === value) {
            this._currentLanguage = value;
            this.mLocalOSMOfflineGeocodingService?.set('language', value);
            this.mLocalOSMOfflineReverseGeocodingService?.set('language', value);
        }
    }
    /**
     * One geocoding answer, as the app's item shape.
     *
     * The SDK hands the whole result set over as a GeoJSON FeatureCollection whose features already
     * carry `address` and `rank`, so there is nothing to walk: what used to be a crossing per
     * result, per feature and per address field is one read.
     */
    convertGeoCodingResults(features: GeoJSON.Feature[], full = false) {
        const items: GeoResult[] = [];
        if (!features) {
            return items;
        }
        for (const feature of features) {
            const item = this.convertGeoCodingResult(feature, full);
            if (item) {
                items.push(item);
            }
        }
        return items;
    }

    convertFeatureCollection(features: GeoJSON.Feature[], options: { bounds?: IMapBounds }) {
        const result: GeoResult[] = [];
        for (const feature of features) {
            const geometry = feature.geometry;
            if (!geometry) {
                continue;
            }
            const position = geometryCenter(geometry);
            if (!position || (options.bounds && !isPointInsideBounds(position, options.bounds))) {
                continue;
            }
            const properties = feature.properties as any;
            result.push({
                properties: { layer: properties?.layerName, ...properties } as any,
                geometry: { type: 'Point', coordinates: [position.lon, position.lat] },
                distance: properties?.distance
            } as GeoResult);
        }
        return result;
    }

    convertGeoCodingResult(feature: GeoJSON.Feature, full = false) {
        if (!feature?.geometry) {
            return;
        }
        const position = geometryCenter(feature.geometry);
        const properties = feature.properties as any;
        const r = {
            properties: { ...properties },
            geometry: { type: 'Point', coordinates: [position.lon, position.lat] }
        } as GeoResult;
        // a shape rather than a point: the caller zooms to it instead of centring on it
        if (feature.geometry.type !== 'Point') {
            r.properties.zoomBounds = geometryBounds(feature.geometry);
        }
        if (full) {
            this.prepareGeoCodingResult(r);
            if (!r.properties.name && !r.properties.address?.['street'] && !r.properties.address?.['city']) {
                return;
            }
        }
        return r;
    }

    /**
     * Runs a geocoding request and returns its features.
     *
     * `calculateAddresses` is blocking - the offline geocoder reads sqlite - so it goes through
     * callAsync, which runs it on a worker and resolves when the answer arrives.
     */
    async searchInGeocodingService(service: MassifObject, options: { query?: string; location?: MapPos; searchRadius?: number }): Promise<GeoJSON.Feature[]> {
        if (!service) {
            return null;
        }
        const request = options.location
            ? api.create('geocoding', `geocoding.request.${++geocodingRequestId}`, { type: 'reverse-request', location: toPosition(options.location), searchRadius: options.searchRadius }, 'massif::ReverseGeocodingRequest')
            : api.create('geocoding', `geocoding.request.${++geocodingRequestId}`, { type: 'request', query: options.query, searchRadius: options.searchRadius }, 'massif::GeocodingRequest');
        try {
            const collection = (await service.callAsync('calculateAddresses' as never, [request.handle] as never)) as unknown as GeoJSON.FeatureCollection;
            return collection?.features ?? [];
        } finally {
            request.destroy();
        }
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

    /**
     * The offline geocoders, over whatever .nutigeodb the user has downloaded.
     *
     * One database per area, found by scanning, so they are added after construction - which is
     * why the service takes none in its spec.
     */
    private buildGeocoder(id: string, type: 'multi-osm-offline' | 'multi-osm-offline-reverse') {
        const files = this.findFilesWithExtension('.nutigeodb');
        if (!files.length) {
            return null;
        }
        const service = api.create('geocoding', id, { type });
        service.set('language', this.currentLanguage);
        files.forEach((f) => service.call('add', f.path));
        return service;
    }

    mLocalOSMOfflineGeocodingService: MassifObject<'massif::MultiOSMOfflineGeocodingService'>;
    hasLocalOSMOfflineGeocodingService = true;
    get localOSMOfflineGeocodingService() {
        if (this.hasLocalOSMOfflineGeocodingService && !this.mLocalOSMOfflineGeocodingService) {
            this.mLocalOSMOfflineGeocodingService = this.buildGeocoder('geocoding.osm', 'multi-osm-offline') as never;
            this.hasLocalOSMOfflineGeocodingService = !!this.mLocalOSMOfflineGeocodingService;
        }
        return this.mLocalOSMOfflineGeocodingService;
    }
    mLocalOSMOfflineReverseGeocodingService: MassifObject<'massif::MultiOSMOfflineReverseGeocodingService'>;
    hasLocalOSMOfflineReverseGeocodingService = true;
    get localOSMOfflineReverseGeocodingService() {
        if (this.hasLocalOSMOfflineReverseGeocodingService && !this.mLocalOSMOfflineReverseGeocodingService) {
            this.mLocalOSMOfflineReverseGeocodingService = this.buildGeocoder('geocoding.osm.reverse', 'multi-osm-offline-reverse') as never;
            this.hasLocalOSMOfflineReverseGeocodingService = !!this.mLocalOSMOfflineReverseGeocodingService;
        }
        return this.mLocalOSMOfflineReverseGeocodingService;
    }
    _vectorTileSearchService: MassifObject<'massif::VectorTileSearchService'>;
    get vectorTileSearchService() {
        if (!this._vectorTileSearchService && this.localVectorTileLayer) {
            // Built FROM THE LAYER: its source and its decoder are the ones already on screen, so
            // a search reads exactly what the user is looking at.
            this._vectorTileSearchService = api.create('search', 'search.vectortile', {
                type: 'vectortile',
                layer: this.localVectorTileLayer.id,
                minZoom: 14,
                maxZoom: 14,
                preventDuplicates: true,
                sortByDistance: true,
                layers: ['poi', 'place', 'mountain_peak', 'transportation_name', 'landcover_name', 'landuse_name', 'park', 'water_name', 'building_name']
            } as never) as never;
        }
        return this._vectorTileSearchService;
    }
    _timezoneTileSearchService: MassifObject<'massif::VectorTileSearchService'>;
    timezoneVectorTileDataSource?: MassifSource<'massif::MBTilesTileDataSource'>;
    get timezoneTileSearchService() {
        if (!this._timezoneTileSearchService) {
            if (this.timezoneVectorTileDataSource === undefined) {
                this.timezoneVectorTileDataSource = api.createSource('source.timezone', {
                    type: 'mbtiles',
                    path: path.join(knownFolders.currentApp().path, 'assets', 'timezone.mbtiles')
                });
            }
            if (this.timezoneVectorTileDataSource) {
                this._timezoneTileSearchService = api.create('search', 'search.timezone', {
                    type: 'vectortile',
                    source: this.timezoneVectorTileDataSource.id,
                    style: getMapContext().mapDecoder.id,
                    minZoom: 3,
                    maxZoom: 3,
                    preventDuplicates: true,
                    sortByDistance: true
                } as never) as never;
            }
        }
        return this._timezoneTileSearchService;
    }

    async getItemAddress(item: IItem) {
        try {
            const service = this.localOSMOfflineReverseGeocodingService;
            let foundAddress = false;
            const geometry = item.geometry as GeoJSONPoint;
            const location = { lat: geometry.coordinates[1], lon: geometry.coordinates[0] };
            // DEV_LOG && console.log('fetching addresses', !!service, JSON.stringify(location), get(useOfflineGeocodeAddress), get(useSystemGeocodeAddress), geocodingAvailable, !!service);
            if (get(useOfflineGeocodeAddress) && service) {
                const radius = 200;
                const res = await packageService.searchInGeocodingService(service, { location, searchRadius: radius });
                const props = item.properties;
                if (res) {
                    let bestFind: GeoResult;
                    for (const feature of res) {
                        const r = packageService.convertGeoCodingResult(feature, true);

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
    searchInLocalGeocodingService(options: { query: string; searchRadius?: number }) {
        return this.searchInGeocodingService(this.localOSMOfflineGeocodingService, options);
    }
    searchInLocalReverseGeocodingService(options: { location: MapPos; searchRadius?: number }) {
        return this.searchInGeocodingService(this.localOSMOfflineReverseGeocodingService, options);
    }

    /**
     * A search over the tiles on screen. Returns the matching features, flat.
     *
     * The per-search settings are written onto the service and put back afterwards, because the
     * SDK has no per-request override for them - which also means two overlapping searches would
     * fight, so callers keep them sequential.
     */
    async searchInVectorTiles(options: SearchOptions): Promise<GeoJSON.Feature[]> {
        const service = this.vectorTileSearchService;
        if (!service) {
            return null;
        }
        const restore: { [key: string]: any } = {};
        for (const key of Object.keys(options)) {
            if (VECTORTILESEARCH_OPTIONS.indexOf(key) !== -1) {
                restore[key] = service.get(key as never);
                service.set(key as never, options[key] as never);
            }
        }
        const request = this.buildSearchRequest(options);
        try {
            const features = await service.callAsync('findFeatures' as never, [request.handle] as never, ((collection) =>
                collection.collect((feature) => ({
                    type: 'Feature',
                    geometry: JSON.parse(feature.get('geometryGeoJSON') as string),
                    properties: { ...(feature.get('properties') as object), layerName: feature.get('layerName'), distance: feature.get('distance') }
                }))) as never);
            return features as unknown as GeoJSON.Feature[];
        } finally {
            request.destroy();
            for (const key of Object.keys(restore)) {
                service.set(key as never, restore[key] as never);
            }
        }
    }

    /** A search request: a centre or a bounding geometry, a radius, and the filters. */
    private buildSearchRequest(options: SearchOptions): MassifObject<'massif::SearchRequest'> {
        const spec: { [key: string]: any } = { type: 'request' };
        if (options.searchRadius !== undefined) {
            spec.searchRadius = options.searchRadius;
        }
        if (options.regexFilter) {
            spec.regexFilter = options.regexFilter;
        }
        if (options.filterExpression) {
            spec.filterExpression = options.filterExpression;
        }
        if (options.position) {
            spec.geometry = { type: 'geojson', geojson: { type: 'Point', coordinates: toPosition(options.position) } };
        } else if (options.geometry) {
            spec.geometry = { type: 'geojson', geojson: options.geometry };
        }
        return api.create('search', `search.request.${++searchRequestId}`, spec as never) as never;
    }

    getTimezone(position: MapPos) {
        const service = this.timezoneTileSearchService;
        if (!service) {
            return null;
        }
        const request = this.buildSearchRequest({ position, searchRadius: 10 });
        try {
            return service.callAsync('findFeatures' as never, [request.handle] as never, ((collection) => collection.collect((feature) => feature.get('properties'))) as never);
        } finally {
            request.destroy();
        }
    }
    /**
     * Normalises a geocoding result's address onto the app's own field names.
     *
     * The address arrives as a plain object now - the SDK serialises it with the feature - so this
     * is a rename, where it used to be a getter call per field through a native object.
     */
    prepareGeoCodingResult(geoRes: GeoResult, onlyAddress = false) {
        const source = (geoRes.properties.address ?? {}) as { [key: string]: any };
        const address: any = {};
        for (const [target, key] of geocodingMapping) {
            const value = source[key];
            if (value?.length > 0) {
                address[target] = value;
            }
        }
        if (source.categories?.length) {
            geoRes.properties.categories = (source.categories as string[]).map((c) => c.split(':').reverse()).flat();
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
        return geoRes as Item;
    }
    hasElevation() {
        return !!this.hillshadeLayer;
    }

    /**
     * Elevations under a set of positions, in one crossing.
     *
     * Only a hillshade layer answers. The values come back as real doubles - the layer interpolates,
     * and rounding them destroys the grade the profile is differentiated from.
     */
    getElevations(positions: MapPos[]): number[] {
        return this.hillshadeLayer ? this.hillshadeLayer.elevations(positions.map(toPosition)) : null;
    }

    getElevation(pos: MapPos): number {
        const elevations = this.getElevations([pos]);
        const value = elevations?.[0];
        // -10000 is the layer's "no data here"
        return value === undefined || value === -10000 ? null : Math.max(-100, Math.round(value));
    }

    computeProfileFromHeights(positions: MapPos[], elevations: number[]) {
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
        const nbPoints = positions.length;
        for (let i = 0; i < nbPoints; i++) {
            const pos = positions[i];
            profile.push({
                lat: pos.lat,
                lon: pos.lon,
                altitude: elevations[i],
                tmpElevation: altitudeFilter.filter(elevations[i])
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
    /**
     * The positions of a route item, as plain `{ lat, lon }`.
     *
     * There is no native geometry cache any more: the item already carries GeoJSON, and building an
     * SDK geometry only to read its points back was two crossings and a proxy per point. A
     * MultiLineString is flattened, which is what every caller here assumed anyway.
     */
    getRouteItemPoses(item: Item): MapPos[] {
        const geometry = (item?.geometry ?? (item?._geometry ? JSON.parse(item._geometry) : null)) as LineString | MultiLineString;
        if (!geometry) {
            return null;
        }
        const coordinates = geometry.type === 'MultiLineString' ? (geometry.coordinates as number[][][]).flat() : (geometry.coordinates as number[][]);
        return coordinates.map((c) => ({ lat: c[1], lon: c[0] }) as MapPos);
    }

    getItemCenter(item: Item) {
        if (item?.route) {
            const bounds = geometryBounds(item.geometry as GeoJSON.Geometry);
            return bounds && { lat: (bounds.northeast.lat + bounds.southwest.lat) / 2, lon: (bounds.northeast.lon + bounds.southwest.lon) / 2 };
        }
        return (item.geometry as Point).coordinates;
    }

    /**
     * The elevation profile of a route: from the hillshade layer when there is one, from valhalla
     * otherwise.
     *
     * The two branches used to build their positions differently - one from a cached native
     * geometry, one from the item's GeoJSON - and produced the same thing; there is one path now.
     */
    async getElevationProfile(item: Item, positions?: MapPos[]) {
        if (item && item.geometry.type !== 'LineString' && item.geometry.type !== 'MultiLineString') {
            return null;
        }
        const startTime = Date.now();
        positions = positions ?? this.getRouteItemPoses(item);
        if (!positions?.length) {
            return null;
        }
        if (this.hillshadeLayer) {
            const result = this.computeProfileFromHeights(positions, this.getElevations(positions));
            DEV_LOG && console.log('getElevations done', Date.now() - startTime, 'ms');
            return result;
        }
        const webResult = await networkService.getValhallaElevationProfile(toLngLat(positions));
        const result = this.computeProfileFromHeights(
            positions,
            webResult.range_height.map((e) => e[1])
        );
        DEV_LOG && console.log('getValhallaElevationProfile done', Date.now() - startTime, 'ms');
        return result;
    }

    /**
     * Valhalla's trace attributes for a route: surface, road class, grade, per edge.
     *
     * Offline it is a map-matching call on the routing service; online it is the same request over
     * HTTP. `shape_match` and the attribute filters are free-form JSON, so they go through
     * setCustomParameter rather than being properties.
     */
    async getStats({
        // the shape indices are what lets us say which surface is *ahead*, not just how much of it there is
        attributes = ['edge.surface', 'edge.road_class', 'edge.sac_scale', 'edge.use', 'edge.length', 'edge.begin_shape_index', 'edge.end_shape_index'],
        item,
        points,
        profile,
        shape_match = 'walk_or_snap'
    }: {
        item?;
        points?: MapPos[];
        profile?: ValhallaProfile;
        attributes?: string[];
        shape_match?: string;
    }) {
        const positions = points ?? this.getRouteItemPoses(item);
        if (!positions?.length) {
            return null;
        }
        const startTime = Date.now();
        const service = this.offlineRoutingSearchService() as unknown as MassifObject<'massif::RoutingService'>;
        if (service) {
            const request = api.create('routing', `routing.match.${++routingRequestId}`, { type: 'match-request', points: positions.map(toPosition), accuracy: 1 }, 'massif::RouteMatchingRequest');
            try {
                request.call('setCustomParameter', 'shape_match', shape_match);
                request.call('setCustomParameter', 'filters', { attributes, action: 'include' });
                if (profile) {
                    service.set('profile', profile);
                }
                const raw = await service.callAsync('matchRoute' as never, [request.handle] as never, ((result) => result.get('rawResult')) as never);
                DEV_LOG && console.log('got trace attributes', Date.now() - startTime, 'ms');
                return JSON.parse(raw as unknown as string).edges;
            } finally {
                request.destroy();
            }
        }
        const webResult = await networkService.getValhallaTraceAttributes(toLngLat(positions), {
            shape_match,
            filters: { attributes, action: 'include' }
        });
        DEV_LOG && console.log('getStats done', Date.now() - startTime, 'ms');
        return webResult.edges;
    }

    async fetchStats({ item, positions, profile, route }: { positions?: MapPos[]; item?; route?: Route; profile?: ValhallaProfile }) {
        if (!route) {
            route = item.route;
        }
        const edges = await this.getStats({ item, points: positions, profile });
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

    setValhallaSetting(key: string, defaultValue: number) {
        const value = ApplicationSettings.getNumber(key, defaultValue);
        if (value !== defaultValue) {
            this.mLocalOfflineRoutingSearchService?.call('setConfigurationParameter', key, value);
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
    async computeTrackInstructions({ item, profile = 'pedestrian' }: { item: Item; profile?: ValhallaProfile }): Promise<RouteInstruction[]> {
        const trackPositions = this.getRouteItemPoses(item);
        const trackSize = trackPositions?.length ?? 0;
        if (trackSize < 2) {
            return null;
        }
        const points = sampleTrackForRouting(trackPositions);
        DEV_LOG && console.log('computeTrackInstructions', trackSize, 'track points ->', points.length, 'via points');
        const { positions: routePoints, result } = await this.computeRoute({ points, profile });

        let lastTrackIndex = -1;
        const instructions = instructionsFromResult(result, (pointIndex) => {
            const routePoint = routePoints[pointIndex];
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
        profile = 'pedestrian'
    }: {
        points: MapPos[];
        profile?: ValhallaProfile;
        /** valhalla `costing_options`, as stored on a computed route */
        costingOptions?: any;
    }) {
        // Typed as the BASE: the two services differ only in how they are built, and a union of
        // the two concrete types has no callable methods in common.
        const service = (this.offlineRoutingSearchService() ?? this.onlineRoutingSearchService()) as unknown as MassifObject<'massif::RoutingService'>;
        if (!service) {
            throw new Error('no_routing_service');
        }
        const request = api.create('routing', `routing.request.${++routingRequestId}`, { type: 'request', points: points.map(toPosition) }, 'massif::RoutingRequest');
        try {
            request.call('setCustomParameter', 'language', get(fullLangStore));
            if (costingOptions) {
                request.call('setCustomParameter', 'costing_options', costingOptions);
            }
            service.set('profile', profile);
            // The result is destroyed with the delivery, so everything the caller needs is read
            // out here - the path in one flat array, through the bulk channel.
            const route = await service.callAsync('calculateRoute' as never, [request.handle] as never, ((result) => ({
                instructionsJSON: result.get('instructionsJSON'),
                flat: result.getDoubles(),
                totalDistance: result.get('totalDistance'),
                totalTime: result.get('totalTime')
            })) as never) as unknown as { instructionsJSON: any; flat: number[]; totalDistance: number; totalTime: number };
            const positions: MapPos[] = [];
            for (let index = 0; index < route.flat.length; index += 2) {
                positions.push({ lat: route.flat[index + 1], lon: route.flat[index] });
            }
            return {
                // what instructionsFromResult reads, without the result object having to outlive it
                result: { get: (path: string) => (path === 'instructionsJSON' ? route.instructionsJSON : undefined) } as never,
                positions,
                totalDistance: route.totalDistance,
                totalTime: route.totalTime
            };
        } finally {
            request.destroy();
        }
    }

    offlineRoutingSearchService() {
        if (this.hasOfflineRouting && !this.mLocalOfflineRoutingSearchService) {
            const files = this.findFilesWithExtension('.vtiles');
            const currentLanguage = get(fullLangStore);
            if (files.length) {
                const service = (this.mLocalOfflineRoutingSearchService = api.create('routing', 'routing.offline', { type: 'multi-valhalla-offline' }) as MassifObject<'massif::MultiValhallaOfflineRoutingService'>);
                this.setValhallaSetting(SETTINGS_VALHALLA_MAX_DISTANCE_PEDESTRIAN, DEFAULT_VALHALLA_MAX_DISTANCE_PEDESTRIAN);
                this.setValhallaSetting(SETTINGS_VALHALLA_MAX_DISTANCE_AUTO, DEFAULT_VALHALLA_MAX_DISTANCE_AUTO);
                this.setValhallaSetting(SETTINGS_VALHALLA_MAX_DISTANCE_BICYCLE, DEFAULT_VALHALLA_MAX_DISTANCE_BICYCLE);
                this.setValhallaSetting(SETTINGS_VALHALLA_MAX_DISTANCE_TRACE, DEFAULT_VALHALLA_MAX_DISTANCE_BICYCLE);
                files.forEach((f) => service.call('add', f.path));
                if (currentLanguage !== 'en-US' && SUPPORTED_VALHALLA_LOCALES.indexOf(currentLanguage) !== -1) {
                    const localeData = require(`~/assets/valhalla/${currentLanguage}.json`);
                    DEV_LOG && console.log('loading custom valhalla locale', currentLanguage);
                    service.call('addLocale', currentLanguage, JSON.stringify(localeData));
                }
            } else {
                this.hasOfflineRouting = false;
            }
        }
        return this.mLocalOfflineRoutingSearchService;
    }

    setOnlineRoutingUrl(url: string) {
        // `+ +` was a typo that stringified NaN onto the url; one concatenation is what was meant
        this.mOnlineRoutingSearchService?.set('customServiceURL', `${url}/{service}`);
    }

    onlineRoutingSearchService() {
        if (!this.mOnlineRoutingSearchService) {
            this.mOnlineRoutingSearchService = api.create('routing', 'routing.online', {
                type: 'valhalla-online',
                customServiceURL: ApplicationSettings.getString(SETTINGS_VALHALLA_ONLINE_URL, DEFAULT_VALHALLA_ONLINE_URL) + '/{service}',
                profile: 'pedestrian',
                HTTPHeaders: { 'X-Client-Id': 'AlpiMaps' }
            });
        }
        return this.mOnlineRoutingSearchService;
    }
}
export const packageService = new PackageService();
