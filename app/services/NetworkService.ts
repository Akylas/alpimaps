import * as https from '@nativescript-community/https';
import { MapBounds, MapPos } from '@nativescript-community/ui-carto/core';
import * as appavailability from '@nativescript/appavailability';
import { Application, ApplicationEventData, ApplicationSettings, Connectivity, EventData, Folder, Observable, Utils } from '@nativescript/core';
import { wrapNativeException } from '@nativescript/core/utils';
import dayjs from 'dayjs';
import { HTTPError, TimeoutError } from '@shared/utils/error';
import { createGlobalEventListener, globalObservable } from '@shared/utils/svelte/ui';
import { getDataFolder } from '~/utils/utils';
import { DEFAULT_VALHALLA_ONLINE_URL, SETTINGS_VALHALLA_ONLINE_URL } from '~/utils/constants';

export const onNetworkChanged = createGlobalEventListener('network');

export const maxAgeMonth = dayjs.duration({ months: 1 }).asSeconds();
export interface CacheOptions {
    diskLocation: string;
    diskSize: number;
    memorySize?: number;
}
export type HTTPOptions = https.HttpsRequestOptions;

export interface HttpRequestOptions extends HTTPOptions {
    body?;
    cachePolicy?: https.CachePolicy;
    queryParams?: object;
    apiPath?: string;
    multipartParams?;
    canRetry?;
}

export function getCacheControl(maxAge = 60, stale = 59) {
    return `max-age=${maxAge}, max-stale=${stale}, stale-while-revalidate=${stale}`;
}
// const osmOverpassUrl = 'http://overpass-api.de/api/';
// const OSMReplaceKeys = {
//     'contact:phone': 'phone',
//     via_ferrata_scale: 'difficulty'
// };
// const OSMIgnoredSubtypes = ['parking_entrance', 'tram_stop', 'platform', 'bus_stop', 'tram', 'track'];
// const OSMClassProps = ['amenity', 'natural', 'leisure', 'shop', 'sport', 'place', 'highway', 'waterway', 'historic', 'railway', 'landuse', 'aeroway', 'boundary', 'office', 'tourism'];
// function prepareOSMWay(way, nodes) {
//     const points = [];
//     if (Object.keys(nodes).length > 0) {
//         way.nodes.forEach(function (node) {
//             // console.debug('handling', node);
//             node = nodes[node + ''][0];
//             points.push([node.lat, node.lon]);
//         });
//     } else {
//         way.geometry.forEach(function (node) {
//             // console.debug('handling', node);
//             // node = nodes[node +
//             //     ''][0];
//             points.push([node.lat, node.lon]);
//         });
//     }

//     const region = getBounds(points);
//     const result: any = {
//         route: {
//             distance: getPathLength(points),
//             region: {
//                 northeast: {
//                     lat: region.maxLat,
//                     lon: region.maxLng
//                 },
//                 southwest: {
//                     lat: region.minLat,
//                     lon: region.minLng
//                 }
//             },
//             points
//         },
//         id: way.id,
//         osm: {
//             id: way.id,
//             type: way.type
//         },
//         tags: way.tags,
//         start: points[0],
//         startOnRoute: true,
//         endOnRoute: true,
//         end: points[points.length - 1]
//     };
//     Object.keys(OSMReplaceKeys).forEach(function (key) {
//         if (way.tags[key]) {
//             way.tags[OSMReplaceKeys[key]] = way.tags[key];
//             delete way.tags[key];
//         }
//     });
//     if (way.tags) {
//         result.title = way.tags.name;
//         if (way.tags.note) {
//             if (way.tags.description) {
//                 result.description = way.tags.description;
//                 result.notes = [
//                     {
//                         title: 'note',
//                         text: way.tags.note
//                     }
//                 ];
//             } else {
//                 result.description = way.tags.note;
//             }
//         } else {
//             result.description = way.tags.description;
//         }
//         result.tags = {};
//         Object.keys(way.tags).forEach(function (k) {
//             if (k !== 'source' && !k.startsWith('addr:')) {
//                 result.tags[k] = way.tags[k];
//             }
//         });
//         // const osmClass = result.osm.class;
//         // const osmSub = result.osm.subtype;
//         // result.icon = osmIcon(osmClass, osmSub, result.tags[osmSub]);
//     }
//     return result;
// }

// function filterTag(tag, key, tags) {
//     if (OSMReplaceKeys[key]) {
//         tags[tag] = tags[key];
//         delete tags[key];
//     }
//     if (key.startsWith('addr:')) {
//         delete tags[key];
//     }
// }
// function prepareOSMObject(ele, _withIcon?, _testForGeoFeature?) {
//     const tags = ele.tags;
//     const id = isNaN(ele.id) ? ele.id : ele.id.toString();
//     const result = {
//         osm: {
//             id: ele.id,
//             type: ele.type
//         } as any,
//         id,
//         tags: ele.tags
//     } as any;
//     OSMClassProps.forEach(function (key) {
//         if (ele.tags[key]) {
//             result.osm.class = key;
//             result.osm.subtype = ele.tags[key];
//             return false;
//         }
//     });
//     // ignores
//     if (OSMIgnoredSubtypes.indexOf(result.osm.subtype) !== -1) {
//         return;
//     }
//     if (ele.center) {
//         result.lat = ele.center.lat;
//         result.lon = ele.center.lon;
//     } else if (ele.hasOwnProperty('lat')) {
//         result.lat = ele.lat;
//         result.lon = ele.lon;
//     } else if (ele.type === 'relation' && ele.members) {
//         const index = ele.members.findIndex(function (member: any) {
//             return /centre/.test(member.role);
//         });
//         if (index !== -1) {
//             const realCenter = ele.members[index];
//             result.lat = realCenter.lat;
//             result.lon = realCenter.lon;
//         } else if (ele.bounds) {
//             const bounds = ele.bounds;
//             result.lat = (bounds.maxlat + bounds.minlat) / 2;
//             result.lon = (bounds.maxlon + bounds.minlon) / 2;
//         }
//     }

//     if (ele.tags) {
//         ele.tags.forEach(filterTag);
//         if (ele.tags.ele) {
//             result.altitude = parseFloat(ele.tags.ele);
//         }
//         result.title = ele.tags.name;
//         if (ele.tags.note) {
//             if (ele.tags.description) {
//                 result.description = ele.tags.description;
//                 result.notes = [
//                     {
//                         title: 'note',
//                         text: ele.tags.note
//                     }
//                 ];
//             } else {
//                 result.description = ele.tags.note;
//             }
//         } else if (ele.tags.description) {
//             result.description = ele.tags.description;
//         }
//         // var osmClass = result.osm.class;
//         // var osmSub = result.osm.subtype;
//         // if (_withIcon !== false) {
//         //     result.icon = osmIcon(osmClass, osmSub, result.tags[osmSub]);
//         // }
//         // if (_testForGeoFeature !== false) {
//         //     result.settings = {
//         //         geofeature: osmIsGeoFeature(osmClass, osmSub)
//         //     };
//         // }
//     }
//     console.debug('prepareOSMObject done ', result);
//     return result;
// }

export function wrapNativeHttpException(error, requestParams: HttpRequestOptions) {
    return wrapNativeException(error, (message) => {
        if (/(SocketTimeout|ConnectException|SocketException|UnknownHost)/.test(message)) {
            return new TimeoutError();
        } else {
            return new HTTPError({
                message,
                statusCode: -1,
                requestParams
            });
        }
    });
}

export interface HttpRequestOptions extends HTTPOptions {
    toJSON?: boolean;
    queryParams?: object;
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
                parts.push(encodeURIComponent(data));
            } else if (Array.isArray(data)) {
                parts.push(data[0] + '=' + encodeURIComponent(data[1]));
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
            parts.push(key + ('=' + encodeURIComponent(obj[key])));
        }
    }

    return parts.splice(0, 2).join('?') + (parts.length > 0 ? '&' + parts.join('&') : '');
}

export const NetworkConnectionStateEvent = 'NetworkConnectionStateEvent';
export interface NetworkConnectionStateEventData extends EventData {
    data: {
        connected: boolean;
        forcedOffline: boolean;
        connectionType: Connectivity.connectionType;
    };
}

function decompress(encoded: string, precision: number) {
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

function encodeNumber(num: number) {
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

function compress(points: [number, number][], precision: number) {
    let oldLat = 0,
        oldLng = 0,
        index = 0;
    let encoded = '';
    const len = points.length;
    precision = Math.pow(10, precision);
    while (index < len) {
        const pt = points[index++];
        //  Round to N decimal places
        const lat = Math.round(pt[1] * precision);
        const lng = Math.round(pt[0] * precision);

        //  Encode the differences between the points
        encoded += encodeNumber(lat - oldLat);
        encoded += encodeNumber(lng - oldLng);

        oldLat = lat;
        oldLng = lng;
    }
    return encoded;
}

function latlongToOSMString(_point: MapPos<LatLonKeys>) {
    return _point.lon.toFixed(4) + ',' + _point.lat.toFixed(4);
}
export function regionToOSMString(_region: MapBounds<LatLonKeys>) {
    return latlongToOSMString(_region.southwest) + ',' + latlongToOSMString(_region.northeast);
}

export class NetworkService extends Observable {
    _connectionType: Connectivity.connectionType = Connectivity.connectionType.none;
    _connected = false;
    _forcedOffline = ApplicationSettings.getBoolean('forceOffline', false);
    get connected() {
        return this._connected && !this._forcedOffline;
    }
    set connected(value: boolean) {
        if (this._connected !== value) {
            this._connected = value;
            this.notifyNetworkChange();
        }
    }
    get forcedOffline() {
        return this._forcedOffline;
    }
    set forcedOffline(value: boolean) {
        this._forcedOffline = value;
        ApplicationSettings.setBoolean('forceOffline', value);
        this.notifyNetworkChange();
    }
    get connectionType() {
        return this._connectionType;
    }
    set connectionType(value: Connectivity.connectionType) {
        if (this._connectionType !== value) {
            this._connectionType = value;
            this.connected = value !== Connectivity.connectionType.none;
        }
    }

    notifyNetworkChange() {
        globalObservable.notify({ eventName: 'network', data: this.connected });
        this.notify({
            eventName: NetworkConnectionStateEvent,
            object: this,
            data: {
                connected: this.connected,
                forcedOffline: this._forcedOffline,
                connectionType: this._connectionType
            }
        } as NetworkConnectionStateEventData);
    }

    monitoring = false;
    canCheckWeather = false;
    async start() {
        if (this.monitoring) {
            return;
        }
        this.monitoring = true;
        Application.on(Application.foregroundEvent, this.onAppResume, this);
        Connectivity.startMonitoring(this.onConnectionStateChange.bind(this));
        this.connectionType = Connectivity.getConnectionType();
        this.canCheckWeather = await appavailability.available(__IOS__ ? 'weather://' : 'com.akylas.weather');
        const folder = Folder.fromPath(getDataFolder()).getFolder('cache');
        const diskLocation = folder.path;
        DEV_LOG && console.log('setCache', diskLocation);
        https.setCache({
            diskLocation,
            diskSize: 40 * 1024 * 1024,
            memorySize: 10 * 1024 * 1024
        });
        if (__ANDROID__) {
            try {
                //@ts-ignore
                https.addInterceptor(com.nativescript.https.CacheInterceptor.INTERCEPTOR);
                //@ts-ignore
                https.addNetworkInterceptor(com.nativescript.https.CacheInterceptor.INTERCEPTOR);
            } catch (error) {
                console.error(error, error.stack);
            }
        }
    }
    clearRequests(...tags) {
        for (let index = 0; index < tags.length; index++) {
            https.cancelRequest(tags[index]);
        }
    }
    stop() {
        if (!this.monitoring) {
            return;
        }
        Application.off(Application.foregroundEvent, this.onAppResume, this);
        this.monitoring = false;
        Connectivity.stopMonitoring();
    }
    onAppResume(args: ApplicationEventData) {
        this.connectionType = Connectivity.getConnectionType();
    }
    onConnectionStateChange(newConnectionType: Connectivity.connectionType) {
        this.connectionType = newConnectionType;
    }
    async request<T = any>(requestParams: HttpRequestOptions, retry = 0): Promise<T> {
        // if (!this.connected) {
        //     return Promise.reject(new NoNetworkError());
        // }
        try {
            DEV_LOG && console.info('request', networkService.connected, JSON.stringify(requestParams));
            if (requestParams.queryParams) {
                requestParams.url = queryString(requestParams.queryParams, requestParams.url);
                delete requestParams.queryParams;
            }
            DEV_LOG && console.info('url', requestParams.url);
            requestParams.headers = requestParams.headers || {};
            if (!requestParams.headers['Content-Type']) {
                requestParams.headers['Content-Type'] = 'application/json';
            }
            const response = await https.request(requestParams);
            const statusCode = response.statusCode;

            let content:
                | {
                      response?: any;
                  }
                | string;
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
            DEV_LOG && console.log('handleRequestResponse', requestParams.url, statusCode, response.reason, isString, typeof content);
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
            throw wrapNativeHttpException(error, requestParams);
        }
    }

    async getValhallaElevationProfile(points: [number, number][]) {
        const serviceUrl = ApplicationSettings.getString(SETTINGS_VALHALLA_ONLINE_URL, DEFAULT_VALHALLA_ONLINE_URL);
        return this.request({
            url: `${serviceUrl}/height`,
            body: {
                range: true,
                encoded_polyline: compress(points, 6)
            },
            headers: {
                'User-Agent': 'AlpiMaps',
                'Cache-Control': getCacheControl(maxAgeMonth, maxAgeMonth - 1)
            },
            method: 'POST',
            timeout: 60000
        });
    }

    async getValhallaTraceAttributes(points: [number, number][], options = {}) {
        const serviceUrl = ApplicationSettings.getString(SETTINGS_VALHALLA_ONLINE_URL, DEFAULT_VALHALLA_ONLINE_URL);
        return this.request({
            url: `${serviceUrl}/trace_attributes`,
            body: {
                range: true,
                encoded_polyline: compress(points, 6),
                costing: 'pedestrian',
                ...options
            },
            headers: {
                'User-Agent': 'AlpiMaps',
                'Cache-Control': getCacheControl(maxAgeMonth, maxAgeMonth - 1)
            },
            method: 'POST',
            timeout: 60000
        });
    }

    broadcastPromises: { [key: string]: { resolve: Function; reject: Function; timeoutTimer: number }[] } = {};
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
            intent.putExtra('package', __APP_ID__);
            intent.setPackage('com.akylas.weather');
            const context: android.content.Context = Utils.android.getApplicationContext();

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

    getCacheControl(maxAge = 60, stale = 59, noCache = false) {
        if (noCache) {
            return 'no-cache';
        }
        if (this.forcedOffline) {
            return 'only-if-cached';
        }
        return `max-age=${maxAge}, max-stale=${stale}, stale-while-revalidate=${stale}`;
    }

    async getMetroLines() {
        return this.request<string>({
            method: 'GET',
            toJSON: false,
            url: 'https://data.mobilites-m.fr/api/lines/json',
            headers: {
                'Cache-Control': getCacheControl(maxAgeMonth, maxAgeMonth - 1)
            },
            queryParams: {
                types: 'ligne',
                reseaux: 'SEM,C38'
            }
        });
    }
}
export const networkService = new NetworkService();
