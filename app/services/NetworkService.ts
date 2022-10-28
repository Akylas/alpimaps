import * as https from '@nativescript-community/https';
import { MapBounds, MapPos } from '@nativescript-community/ui-carto/core';
import * as appavailability from '@nativescript/appavailability';
import { ApplicationEventData, EventData, Observable, knownFolders } from '@nativescript/core';
import { off as applicationOff, on as applicationOn, foregroundEvent } from '@nativescript/core/application';
import * as connectivity from '@nativescript/core/connectivity';
import { Headers } from '@nativescript/core/http';
import { ad } from '@nativescript/core/utils/utils';
import extend from 'just-extend';
import { BaseError } from 'make-error';
import { getBounds, getPathLength } from '~/helpers/geolib';
import { l } from '~/helpers/locale';
import { RouteProfile } from '~/models/Item';
import { createGlobalEventListener, globalObservable } from '~/variables';

export const onNetworkChanged = createGlobalEventListener('network');

export interface CacheOptions {
    diskLocation: string;
    diskSize: number;
    memorySize?: number;
}
type HTTPOptions = https.HttpsRequestOptions;

export interface HttpRequestOptions extends HTTPOptions {
    body?;
    cachePolicy?: https.CachePolicy;
    queryParams?: {};
    apiPath?: string;
    multipartParams?;
    canRetry?;
}

export function getCacheControl(maxAge = 60, stale = 59) {
    return `max-age=${maxAge}, max-stale=${stale}, stale-while-revalidate=${stale}`;
}

const contactEmail = 'contact%40akylas.fr';

const osmOverpassUrl = 'http://overpass-api.de/api/';
const OSMReplaceKeys = {
    'contact:phone': 'phone',
    via_ferrata_scale: 'difficulty'
};
const OSMIgnoredSubtypes = ['parking_entrance', 'tram_stop', 'platform', 'bus_stop', 'tram', 'track'];
const OSMClassProps = ['amenity', 'natural', 'leisure', 'shop', 'sport', 'place', 'highway', 'waterway', 'historic', 'railway', 'landuse', 'aeroway', 'boundary', 'office', 'tourism'];
function prepareOSMWay(way, nodes) {
    const points = [];
    if (Object.keys(nodes).length > 0) {
        way.nodes.forEach(function (node) {
            // console.debug('handling', node);
            node = nodes[node + ''][0];
            points.push([node.lat, node.lon]);
        });
    } else {
        way.geometry.forEach(function (node) {
            // console.debug('handling', node);
            // node = nodes[node +
            //     ''][0];
            points.push([node.lat, node.lon]);
        });
    }

    const region = getBounds(points);
    const result: any = {
        route: {
            distance: getPathLength(points),
            region: {
                northeast: {
                    lat: region.maxLat,
                    lon: region.maxLng
                },
                southwest: {
                    lat: region.minLat,
                    lon: region.minLng
                }
            },
            points
        },
        id: way.id,
        osm: {
            id: way.id,
            type: way.type
        },
        tags: way.tags,
        start: points[0],
        startOnRoute: true,
        endOnRoute: true,
        end: points[points.length -1]
    };
    Object.keys(OSMReplaceKeys).forEach(function (key) {
        if (way.tags[key]) {
            way.tags[OSMReplaceKeys[key]] = way.tags[key];
            delete way.tags[key];
        }
    });
    if (way.tags) {
        result.title = way.tags.name;
        if (way.tags.note) {
            if (way.tags.description) {
                result.description = way.tags.description;
                result.notes = [
                    {
                        title: 'note',
                        text: way.tags.note
                    }
                ];
            } else {
                result.description = way.tags.note;
            }
        } else {
            result.description = way.tags.description;
        }
        result.tags = {};
        Object.keys(way.tags).forEach(function (k) {
            if (k !== 'source' && !k.startsWith('addr:')) {
                result.tags[k] = way.tags[k];
            }
        });
        // const osmClass = result.osm.class;
        // const osmSub = result.osm.subtype;
        // result.icon = osmIcon(osmClass, osmSub, result.tags[osmSub]);
    }
    return result;
}

function filterTag(tag, key, tags) {
    if (OSMReplaceKeys[key]) {
        tags[tag] = tags[key];
        delete tags[key];
    }
    if (key.startsWith('addr:')) {
        delete tags[key];
    }
}
function prepareOSMObject(ele, _withIcon?, _testForGeoFeature?) {
    const tags = ele.tags;
    const id = isNaN(ele.id) ? ele.id : ele.id.toString();
    const result = {
        osm: {
            id: ele.id,
            type: ele.type
        } as any,
        id,
        tags: ele.tags
    } as any;
    OSMClassProps.forEach(function (key) {
        if (ele.tags[key]) {
            result.osm.class = key;
            result.osm.subtype = ele.tags[key];
            return false;
        }
    });
    // ignores
    if (OSMIgnoredSubtypes.indexOf(result.osm.subtype) !== -1) {
        return;
    }
    if (ele.center) {
        result.lat = ele.center.lat;
        result.lon = ele.center.lon;
    } else if (ele.hasOwnProperty('lat')) {
        result.lat = ele.lat;
        result.lon = ele.lon;
    } else if (ele.type === 'relation' && ele.members) {
        const index = ele.members.findIndex(function (member: any) {
            return /centre/.test(member.role);
        });
        if (index !== -1) {
            const realCenter = ele.members[index];
            result.lat = realCenter.lat;
            result.lon = realCenter.lon;
        } else if (ele.bounds) {
            const bounds = ele.bounds;
            result.lat = (bounds.maxlat + bounds.minlat) / 2;
            result.lon = (bounds.maxlon + bounds.minlon) / 2;
        }
    }

    if (ele.tags) {
        ele.tags.forEach(filterTag);
        if (ele.tags.ele) {
            result.altitude = parseFloat(ele.tags.ele);
        }
        result.title = ele.tags.name;
        if (ele.tags.note) {
            if (ele.tags.description) {
                result.description = ele.tags.description;
                result.notes = [
                    {
                        title: 'note',
                        text: ele.tags.note
                    }
                ];
            } else {
                result.description = ele.tags.note;
            }
        } else if (ele.tags.description) {
            result.description = ele.tags.description;
        }
        // var osmClass = result.osm.class;
        // var osmSub = result.osm.subtype;
        // if (_withIcon !== false) {
        //     result.icon = osmIcon(osmClass, osmSub, result.tags[osmSub]);
        // }
        // if (_testForGeoFeature !== false) {
        //     result.settings = {
        //         geofeature: osmIsGeoFeature(osmClass, osmSub)
        //     };
        // }
    }
    console.debug('prepareOSMObject done ', result);
    return result;
}

export interface HttpRequestOptions extends HTTPOptions {
    toJSON?: boolean;
    queryParams?: {};
}

export function queryString(params, location) {
    const obj = {};
    let i, len, key, value;

    if (typeof params === 'string') {
        value = location.match(new RegExp('[?&]' + params + '=?([^&]*)[&#$]?'));
        return value ? value[1] : undefined;
    }

    const locSplit = location.split(/[?&]/);
    // _params[0] is the url

    const parts = [];
    for (i = 0, len = locSplit.length; i < len; i++) {
        const theParts = locSplit[i].split('=');
        if (!theParts[0]) {
            continue;
        }
        if (theParts[1]) {
            parts.push(theParts[0] + '=' + theParts[1]);
        } else {
            parts.push(theParts[0]);
        }
    }
    if (Array.isArray(params)) {
        let data;

        for (i = 0, len = params.length; i < len; i++) {
            data = params[i];
            if (typeof data === 'string') {
                parts.push(data);
            } else if (Array.isArray(data)) {
                parts.push(data[0] + '=' + data[1]);
            }
        }
    } else if (typeof params === 'object') {
        for (key in params) {
            value = params[key];
            if (typeof value === 'undefined') {
                delete obj[key];
            } else {
                if (typeof value === 'object') {
                    obj[key] = JSON.stringify(value);
                } else {
                    obj[key] = value;
                }
            }
        }
        for (key in obj) {
            parts.push(key + (obj[key] === true ? '' : '=' + obj[key]));
        }
    }

    return parts.splice(0, 2).join('?') + (parts.length > 0 ? '&' + parts.join('&') : '');
}

export const NetworkConnectionStateEvent = 'NetworkConnectionStateEvent';
export interface NetworkConnectionStateEventData extends EventData {
    data: {
        connected: boolean;
        connectionType: connectivity.connectionType;
    };
}

// mapquest algos
function decompress(encoded, precision) {
    precision = Math.pow(10, -precision);
    let index = 0,
        lat = 0,
        lng = 0;
    const len = encoded.length,
        array: MapPos<LatLonKeys>[] = [];
    while (index < len) {
        let b,
            shift = 0,
            result = 0;
        do {
            b = encoded.charCodeAt(index++) - 63;
            result |= (b & 0x1f) << shift;
            shift += 5;
        } while (b >= 0x20);
        const dlat = result & 1 ? ~(result >> 1) : result >> 1;
        lat += dlat;
        shift = 0;
        result = 0;
        do {
            b = encoded.charCodeAt(index++) - 63;
            result |= (b & 0x1f) << shift;
            shift += 5;
        } while (b >= 0x20);
        const dlng = result & 1 ? ~(result >> 1) : result >> 1;
        lng += dlng;
        array.push({ lat: lat * precision, lon: lng * precision });
    }
    return array;
}

function encodeNumber(num) {
    num = num << 1;
    if (num < 0) {
        num = ~num;
    }
    let encoded = '';
    while (num >= 0x20) {
        encoded += String.fromCharCode((0x20 | (num & 0x1f)) + 63);
        num >>= 5;
    }
    encoded += String.fromCharCode(num + 63);
    return encoded;
}

function compress(points: MapPos<LatLonKeys>[], precision) {
    let oldLat = 0,
        oldLng = 0,
        index = 0;
    let encoded = '';
    const len = points.length;
    precision = Math.pow(10, precision);
    while (index < len) {
        const pt = points[index++];
        //  Round to N decimal places
        const lat = Math.round(pt.lat * precision);
        const lng = Math.round(pt.lon * precision);

        //  Encode the differences between the points
        encoded += encodeNumber(lat - oldLat);
        encoded += encodeNumber(lng - oldLng);

        oldLat = lat;
        oldLng = lng;
    }
    return encoded;
}

function latlongToOSMString(_point: MapPos<LatLonKeys>) {
    return _point.lat.toFixed(4) + ',' + _point.lon.toFixed(4);
}
function regionToOSMString(_region: MapBounds<LatLonKeys>) {
    return 'bbox:' + latlongToOSMString(_region.southwest) + ',' + latlongToOSMString(_region.northeast);
}

function evalTemplateString(resource: string, obj: {}) {
    const names = Object.keys(obj);
    const vals = Object.keys(obj).map((key) => obj[key]);
    return new Function(...names, `return \`${resource}\`;`)(...vals);
}
export class CustomError extends BaseError {
    customErrorConstructorName: string;
    isCustomError = true;
    assignedLocalData: any;
    silent?: boolean;
    constructor(props?, customErrorConstructorName?: string) {
        super(props.message);
        this.message = props.message;
        delete props.message;
        this.silent = props.silent;
        delete props.silent;
        // we need to understand if we are duplicating or not
        const isError = props instanceof Error;
        if (props.customErrorConstructorName || isError) {
            // duplicating
            // use getOwnPropertyNames to get hidden Error props
            const keys = Object.getOwnPropertyNames(props);
            for (let index = 0; index < keys.length; index++) {
                const k = keys[index];
                if (!props[k] || typeof props[k] === 'function') continue;
                // console.log('assigning', k, props[k], this[k]);
                this[k] = props[k];
            }
        } else {
            this.assignedLocalData = props;
        }

        if (!this.customErrorConstructorName) {
            this.customErrorConstructorName = customErrorConstructorName || (this as any).constructor.name; // OR (<any>this).constructor.name;
        }
    }

    localData() {
        const res = {};
        for (const key in this.assignedLocalData) {
            res[key] = this.assignedLocalData[key];
        }
        return res;
    }

    toJSON() {
        const error = {
            message: this.message
        };
        Object.getOwnPropertyNames(this).forEach((key) => {
            if (typeof this[key] !== 'function') {
                error[key] = this[key];
            }
        });
        return error;
    }
    toData() {
        return JSON.stringify(this.toJSON());
    }
    toString() {
        return evalTemplateString(l(this.message), Object.assign({ localize: l }, this.assignedLocalData));
    }

    getMessage() {}
}
export class TimeoutError extends CustomError {
    constructor(props?) {
        super(
            Object.assign(
                {
                    message: 'timeout_error'
                },
                props
            ),
            'TimeoutError'
        );
    }
}

export class NoNetworkError extends CustomError {
    constructor(props?) {
        super(
            Object.assign(
                {
                    message: 'no_network'
                },
                props
            ),
            'NoNetworkError'
        );
    }
}
export interface HTTPErrorProps {
    statusCode: number;
    responseHeaders?: Headers;
    title?: string;
    message: string;
    requestParams: HTTPOptions;
}
export class HTTPError extends CustomError {
    statusCode: number;
    responseHeaders?: Headers;
    requestParams: HTTPOptions;
    constructor(props: HTTPErrorProps | HTTPError) {
        super(
            Object.assign(
                {
                    message: 'httpError'
                },
                props
            ),
            'HTTPError'
        );
    }
}
export class MessageError extends CustomError {
    constructor(props: { title?: string; message: string }) {
        super(
            Object.assign(
                {
                    message: 'error'
                },
                props
            ),
            'MessageError'
        );
    }
}
// used to throw while not show the error
export class FakeError extends CustomError {
    constructor(props?: any) {
        super(
            Object.assign(
                {
                    message: 'error'
                },
                props
            ),
            'FakeError'
        );
    }
}

export class NetworkService extends Observable {
    _connectionType: connectivity.connectionType = connectivity.connectionType.none;
    _connected = false;
    get connected() {
        return this._connected;
    }
    set connected(value: boolean) {
        if (this._connected !== value) {
            globalObservable.notify({ eventName: 'network', data: value });
            this._connected = value;
            this.notify({
                eventName: NetworkConnectionStateEvent,
                object: this,
                data: {
                    connected: value,
                    connectionType: this._connectionType
                }
            } as NetworkConnectionStateEventData);
        }
    }
    get connectionType() {
        return this._connectionType;
    }
    set connectionType(value: connectivity.connectionType) {
        if (this._connectionType !== value) {
            this._connectionType = value;
            this.connected = value !== connectivity.connectionType.none;
        }
    }
    constructor() {
        super();
        // console.log('creating NetworkHandler Handler');
    }
    monitoring = false;
    canCheckWeather = false;
    async start() {
        if (this.monitoring) {
            return;
        }
        this.monitoring = true;
        applicationOn(foregroundEvent, this.onAppResume, this);
        connectivity.startMonitoring(this.onConnectionStateChange.bind(this));
        this.connectionType = connectivity.getConnectionType();
        this.canCheckWeather = await appavailability.available(__IOS__ ? 'weather://' : 'com.akylas.weather');
        const folder = knownFolders.documents().getFolder('cache');
        const diskLocation = folder.path;
        const cacheSize = 10 * 1024 * 1024;
        DEV_LOG && console.log('setCache', diskLocation, cacheSize);
        https.setCache({
            diskLocation,
            diskSize: cacheSize,
            memorySize: cacheSize
        });
    }
    stop() {
        if (!this.monitoring) {
            return;
        }
        applicationOff(foregroundEvent, this.onAppResume, this);
        this.monitoring = false;
        connectivity.stopMonitoring();
    }
    onAppResume(args: ApplicationEventData) {
        this.connectionType = connectivity.getConnectionType();
    }
    onConnectionStateChange(newConnectionType: connectivity.connectionType) {
        this.connectionType = newConnectionType;
    }
    async request<T = any>(requestParams: HttpRequestOptions, retry = 0): Promise<T> {
        // if (!this.connected) {
        //     return Promise.reject(new NoNetworkError());
        // }
        try {
            if (requestParams.queryParams) {
                requestParams.url = queryString(requestParams.queryParams, requestParams.url);
                delete requestParams.queryParams;
            }
            requestParams.headers = requestParams.headers || {};
            if (!requestParams.headers['Content-Type']) {
                requestParams.headers['Content-Type'] = 'application/json';
            }
            const response = await https.request(requestParams);
            const statusCode = response.statusCode;

            let content: {
                response?: any;
            } | string;
            if (requestParams.toJSON !== false) {
                try {
                    content = await response.content.toJSONAsync();
                } catch (err) {
                    console.error('error parsing json response', err);
                }
            }

            if (!content) {
                content = await response.content.toStringAsync();
            }
            const isString = typeof content === 'string';
            DEV_LOG && console.log('handleRequestResponse response', requestParams.url, statusCode, response.reason, response.headers, isString, typeof content, content);
            if (Math.round(statusCode / 100) !== 2) {
                let jsonReturn: {
                    data?: any;
                    error?;
                };
                if (!isString) {
                    jsonReturn = content as any;
                } else {
                    const responseStr = (content as any as string).replace('=>', ':');
                    try {
                        jsonReturn = JSON.parse(responseStr);
                    } catch (err) {
                        // error result might html
                        const match = /<title>(.*)\n*<\/title>/.exec(responseStr);
                        throw new HTTPError({
                            statusCode,
                            responseHeaders: response.headers,
                            message: match ? match[1] : 'HTTP error',
                            requestParams
                        });
                    }
                }
                const error = jsonReturn.error || jsonReturn;
                throw new HTTPError({
                    statusCode: response.statusCode,
                    responseHeaders: response.headers,
                    message: error.error_description || error.message || error.error || error,
                    requestParams
                });
            }
            if (!isString || requestParams.toJSON === false) {
                return content as T;
            }
            try {
                // we should never go there anymore
                const result = JSON.parse(content as any as string);
                return result.response || response;
            } catch (e) {
                // console.log('failed to parse result to JSON', e);
                return undefined;
            }
        } catch (error) {
            if (!(error instanceof HTTPError)) {
                if (!this._connected) {
                    throw new NoNetworkError();
                }
            } else {
                throw error;
            }
        }
    }

    // queryGeoFeatures(
    //     query: {
    //         type: 'node' | 'way';
    //         recurse?: string;
    //         features: string;
    //         outType?: string;
    //         options?: string[];
    //     }[],
    //     region: MapBounds<LatLonKeys>,
    //     feature: {
    //         outType?: string;
    //         usingWays?: boolean;
    //         filterFunc?: Function;
    //     }
    // ) {
    //     let data = '';
    //     if (region) {
    //         data += '[' + regionToOSMString(region) + ']';
    //     }
    //     data +=
    //         '[out:json];(' +
    //         query.reduce(function (result, value, index) {
    //             // array
    //             const type = value.type;
    //             result += type;
    //             if (value.options) {
    //                 const options = value.options.reduce(function (result2, value2, key2) {
    //                     result2 += '(' + key2 + ':' + value2 + ')';
    //                     return result2;
    //                 }, '');
    //                 result += options;
    //             }
    //             if (value.hasOwnProperty('features')) {
    //                 result += value.features;
    //             }
    //             // if (value.region) {
    //             //     var region = regionToString(value.region);
    //             //     result += region;
    //             // }
    //             if (value.recurse) {
    //                 result += ';' + value.recurse;
    //             }
    //             return result + ';';
    //         }, '');

    //     data += ');out ' + (feature.outType || 'center qt') + ' 200;';
    //     return this.request({
    //         url: osmOverpassUrl,
    //         queryParams: {
    //             data: escape(data),
    //             contact: contactEmail
    //         },
    //         method: 'GET',
    //         timeout: 60000
    //     }).then((result) => {
    //         let results;
    //         if (feature.usingWays) {
    //             const nodes = result.elements
    //                 .filter(function (el) {
    //                     return el.type === 'node';
    //                 })
    //                 .reduce((r, v, i, a, k = v.id) => ((r[k] || (r[k] = [])).push(v), r), {});
    //             // var nodes = _.filter(result.elements, 'type', 'node');
    //             const ways: any = result.elements.filter(function (el) {
    //                 return el.type === 'way';
    //             });
    //             const resultingWays = ways.reduce((r, v, i, a, k = v.id) => ((r[k] || (r[k] = [])).push(v), r), {});
    //             console.debug('ways', resultingWays);
    //             const canMerge = function (way1, way2) {
    //                 if (way1.id === way2.id) {
    //                     return false;
    //                 }
    //                 const keys = [...new Set(Object.keys(way1.tags).concat(Object.keys(way2.tags)))];
    //                 for (let i = 0; i < keys.length; i++) {
    //                     const key = keys[i];
    //                     if (way1[key] && way2[key] && way1[key] !== way2[key]) {
    //                         return false;
    //                     }
    //                 }
    //                 return true;
    //             };
    //             // console.debug('nodes', nodes);
    //             let wayId, comparing, start2, end2;
    //             for (let i = 0; i < ways.length; i++) {
    //                 const current = ways[i];
    //                 const start = current.nodes[0];
    //                 const end = current.nodes[current.nodes.length -1];
    //                 for (wayId in resultingWays) {
    //                     comparing = resultingWays[wayId];
    //                     if (!comparing || !canMerge(comparing, current)) {
    //                         continue;
    //                     }
    //                     start2 = comparing.nodes[0];
    //                     end2 = comparing.nodes[comparing.nodes.length -1];

    //                     if (start2 === end) {
    //                         comparing.nodes = current.nodes.slice(0, -1).concat(comparing.nodes);
    //                         comparing.geometry = current.geometry.slice(0, -1).concat(comparing.geometry);
    //                         delete resultingWays[current.id + ''];
    //                         comparing.tags = extend({}, current.tags, comparing.tags);
    //                         break;
    //                     } else if (end2 === start) {
    //                         comparing.nodes = comparing.nodes.concat(current.nodes.slice(1));
    //                         comparing.geometry = comparing.geometry.concat(current.geometry.slice(1));
    //                         delete resultingWays[current.id + ''];
    //                         comparing.tags = extend({}, current.tags, comparing.tags);
    //                         break;
    //                     }
    //                 }
    //             }
    //             results = resultingWays.map((way) => prepareOSMWay(way, nodes));
    //         } else {
    //             results = result.elements.map(function (ele) {
    //                 if (feature.filterFunc && !feature.filterFunc(ele)) {
    //                     return;
    //                 }
    //                 if (ele.lat || ele.center) {
    //                     return prepareOSMObject(ele, false, false);
    //                     // if (item) {
    //                     //     return _itemHandler.createAnnotItem(feature, item);
    //                     // }
    //                 }
    //             });
    //         }

    //         return results;
    //     });
    // }
    actualMapquestElevationProfile(_points: MapPos<LatLonKeys>[]) {
        const params = {
            key: gVars.MAPQUEST_TOKEN,
            inFormat: 'json',
            outFormat: 'json'
        };
        // const postParams = {
        //     json: JSON.stringify({
        //         // routeType: 'pedestrian',
        //         unit: 'm',
        //         useFilter: true,
        //         // cyclingRoadFactor:0.1,
        //         shapeFormat: 'cmp6',
        //         latLngCollection: compress(_points, 6)
        //     })
        // };
        return this.request({
            url: 'http://open.mapquestapi.com/elevation/v1/profile',
            queryParams: params,
            content: JSON.stringify({
                // routeType: 'pedestrian',
                unit: 'm',
                useFilter: true,
                // cyclingRoadFactor:0.1,
                shapeFormat: 'cmp6',
                latLngCollection: compress(_points, 6)
            }),
            // silent:_params.silent,
            method: 'POST',
            timeout: 60000
        }).then((e) => {
            if (e.info.statuscode > 300 && e.info.statuscode < 600) {
                return Promise.reject({
                    code: e.info.statuscode,
                    error: e.info.messages.join(', ')
                });
            } else {
                return e;
            }
        });
    }
    async mapquestElevationProfile(_points: MapPos<LatLonKeys>[]) {
        const distance = getPathLength(_points);
        let res: {
            elevationProfile;
            shapePoints;
        };
        // console.log('mapquestElevationProfile', distance);
        if (distance > 300000) {
            const totalPoints = _points.length;
            const semi = Math.floor(totalPoints / 2);
            // console.debug('semi', semi);
            const r = await this.actualMapquestElevationProfile(_points.slice(0, semi));
            const r2 = await this.actualMapquestElevationProfile(_points.slice(semi));
            const firstDistanceTotal = r.elevationProfile[r.elevationProfile.length -1].distance;
            res = {
                elevationProfile: r.elevationProfile.concat(
                    r2.elevationProfile.map((e) => {
                        e.distance += firstDistanceTotal;
                        return e;
                    })
                ),
                shapePoints: r.shapePoints.concat(r2.shapePoints)
            };
        } else {
            res = await this.actualMapquestElevationProfile(_points);
        }
        let last, currentHeight: number, coordIndex: number, currentDistance: number;
        const profile = res.elevationProfile;
        const coords = res.shapePoints;

        const result: RouteProfile = {
            max: [-1000, -1000],
            min: [100000, 100000],
            dplus: 0,
            dmin: 0,
            data: []
        };
        profile.forEach(function (value, index) {
            currentHeight = value.height;
            if (currentHeight === -32768) {
                return;
            }
            currentDistance = value.distance = Math.floor(value.distance * 1000);

            if (last) {
                // if (currentDistance - last.distance < 100) {
                //     console.log('ignore point as too close');
                //     return;
                // }
                const deltaz = currentHeight - last.height;
                if (deltaz > 0) {
                    result.dplus += deltaz;
                } else if (deltaz < 0) {
                    result.dmin += deltaz;
                }
            }
            if (currentDistance > result.max[0]) {
                result.max[0] = currentDistance;
            }
            if (currentDistance < result.min[0]) {
                result.min[0] = currentDistance;
            }
            if (currentHeight > result.max[1]) {
                result.max[1] = currentHeight;
            }
            if (currentHeight < result.min[1]) {
                result.min[1] = currentHeight;
            }

            result.data.push({ d: currentDistance, a: currentHeight, avg: currentHeight, g: 0 });
            coordIndex = index * 2;
            // result.points.push({ lat: coords[coordIndex], lon: coords[coordIndex + 1] });
            last = value;
            // console.log('setting last', last, result.dplus, result.dmin);
            // return memo;
        });
        // var result = {
        //     profile: _.reduce(
        //         profile,
        //         function(memo, value, index: number) {
        //             currentHeight = value.height;
        //             if (currentHeight === -32768) {
        //                 return memo;
        //             }
        //             currentDistance = value.distance = value.distance * 1000;

        //             if (last) {
        //                 if (currentDistance - last.distance < 100 ) {
        //                     console.log('ignore point as too close');
        //                     return memo;
        //                 }
        //                 const deltaz = currentHeight - last.height;
        //                 if (deltaz > 0) {
        //                     memo.dplus += deltaz;
        //                 } else if (distance < 0) {
        //                     memo.dmin += deltaz;
        //                 }
        //             }
        //             if (currentDistance > memo.max[0]) {
        //                 memo.max[0] = currentDistance;
        //             }
        //             if (currentDistance < memo.min[0]) {
        //                 memo.min[0] = currentDistance;
        //             }
        //             if (currentHeight > memo.max[1]) {
        //                 memo.max[1] = currentHeight;
        //             }
        //             if (currentHeight < memo.min[1]) {
        //                 memo.min[1] = currentHeight;
        //             }

        //             memo.data[0].push(currentDistance);
        //             memo.data[1].push(currentHeight);
        //             coordIndex = index * 2;
        //             memo.points.push([coords[coordIndex], coords[coordIndex + 1]]);
        //             last = value;
        //             console.log('setting last', last);
        //             return memo;
        //         },
        //         {
        //             max: [-1000, -1000],
        //             min: [100000, 100000],
        //             dplus: 0,
        //             dmin: 0,
        //             points: [],
        //             data: [[], []]
        //         }
        //     )
        // };
        result.dmin = Math.round(result.dmin);
        result.dplus = Math.round(result.dplus);
        // console.log('got profile', result);
        return result;
    }

    broadcastPromises: { [key: string]: { resolve: Function; reject: Function; timeoutTimer: NodeJS.Timer }[] } = {};
    sendWeatherBroadcastQuery({ lat, lon, timeout = 0 }) {
        return new Promise((resolve, reject) => {
            const id = Date.now() + '';
            this.broadcastPromises[id] = this.broadcastPromises[id] || [];
            let timeoutTimer;
            if (timeout > 0) {
                timeoutTimer = setTimeout(() => {
                    // we need to try catch because the simple fact of creating a new Error actually throws.
                    // so we will get an uncaughtException
                    try {
                        reject(new Error('timeout'));
                    } catch {}
                    delete this.broadcastPromises[id];
                }, timeout);
            }
            this.broadcastPromises[id].push({ resolve, reject, timeoutTimer });
            const intent = new android.content.Intent('com.akylas.weather.QUERY_WEATHER');
            intent.putExtra('id', id);
            intent.putExtra('lat', lat);
            intent.putExtra('lon', lon);
            intent.putExtra('package', 'akylas.alpi.maps');
            intent.setPackage('com.akylas.weather');
            const context: android.content.Context = ad.getApplicationContext();

            context.sendBroadcast(intent);
        });
    }
    onWeatherResultBroadcast(id, weatherData, error) {
        if (id && this.broadcastPromises.hasOwnProperty(id)) {
            this.broadcastPromises[id].forEach(function (executor) {
                executor.timeoutTimer && clearTimeout(executor.timeoutTimer);
                if (error) {
                    executor.reject(error);
                } else {
                    executor.resolve(weatherData);
                }
            });
            delete this.broadcastPromises[id];
        }
    }
    async getMetroLines() {
        return this.request<string>({
            method: 'GET',
            toJSON: false,
            url: 'https://data.mobilites-m.fr/api/lines/json',
            headers: {
                'Cache-Control': getCacheControl(60 * 3600 * 24, 60 * 3600 * 24 - 1)
            },
            queryParams: {
                types: 'ligne',
                reseaux: 'SEM,C38'
            }
        });
    }
}
export const networkService = new NetworkService();
