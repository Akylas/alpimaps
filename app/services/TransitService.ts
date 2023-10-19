import Observable from '@nativescript-community/observable';
import { Color } from '@nativescript/core';
import { GenericMapPos } from '@nativescript-community/ui-carto/core';
import { networkService } from './NetworkService';

import { SQLiteDatabase } from '@nativescript-community/sqlite';
import { ApplicationSettings } from '@akylas/nativescript';
import type { TransitRoute, TransitRoutes } from './transitland';
export const MOBILITY_URL = 'https://data.mobilites-m.fr';
export const TRANSITLAND_API_URL = 'https://transit.land/api/v2/rest';
export const MOBILITY_API_URL = MOBILITY_URL + '/api';
// const navitiaAPIEndPoint = 'https://api.navitia.io/v1/';

class TransitService extends Observable {
    _db: SQLiteDatabase;
    defaultTransitLineColor = 'red';
    async start() {
        // const folderPath = getSavedMBTilesDir();
        // if (Folder.exists(folderPath)) {
        //     const folder = Folder.fromPath(folderPath);
        //     const entities = folder.getEntitiesSync();
        //     entities.some((s) => {
        //         if (s.name.endsWith('.transitdb')) {
        //             this._db = openOrCreate(s.path, { flags: android.database.sqlite.SQLiteDatabase.OPEN_READONLY });
        //             return true;
        //         }
        //     });
        // }
    }
    // routes: any[];
    async getTransitLines(line?) {
        // if (this._db) {
        //     if (!this.routes) {
        //         this.routes = (await this._db.select('SELECT * from routes WHERE geojson IS NOT NULL')) as any;

        //         console.log('routes', this.routes.length);
        //     }
        //     return `{"type":"FeatureCollection","features":[${this.routes.map(r=>r.geojson).join(',')}]}`;
        // }
        return networkService.request<string>({
            method: 'GET',
            toJSON: false,
            url: 'https://data.mobilites-m.fr/api/lines/json',
            headers: {
                'Cache-Control': networkService.getCacheControl(60 * 3600 * 24, 60 * 3600 * 24 - 1)
            },
            queryParams: {
                types: 'ligne',
                reseaux: 'SEM,C38',
                codes: line
            }
        });
        // const result = await  networkService.request<string>({
        //             method: 'GET',
        //             toJSON: false,
        //             url: `${navitiaAPIEndPoint}coverage/${lon};${lat}/lines${line ? '/' + line : ''}`,
        //             headers: {
        //                 'Cache-Control': getCacheControl(60 * 3600 * 24, 60 * 3600 * 24 - 1),
        //                 Authorization: '8fad1f83-3a48-4eae-9bae-8e0177e6b7c7'
        //             },
        //             queryParams: {
        //                 count:1000
        //                 // types: 'ligne',
        //                 // reseaux: 'SEM,C38',
        //                 // codes: line
        //             }
        //         });
    }

    metroLinesData;
    async getMetroLinesData() {
        if (!this.metroLinesData) {
            const data = await networkService.request({
                url: MOBILITY_API_URL + '/routers/default/index/routes',
                method: 'GET',
                headers: {
                    'Cache-Control': networkService.getCacheControl(60 * 3600 * 24, 60 * 3600 * 24 - 1)
                }
            });
            this.metroLinesData = data.reduce((acc, value) => {
                value.color = value.color ? '#' + value.color : '#37333A';
                value.textColor = value.textColor ? '#' + value.textColor : 'white';
                acc[value.id] = value;
                return acc;
            }, {});
        }
        return this.metroLinesData;
    }

    async getMetroLines() {
        return networkService.request<string>({
            method: 'GET',
            toJSON: false,
            url: 'https://data.mobilites-m.fr/api/lines/json',
            headers: {
                'Cache-Control': networkService.getCacheControl(60 * 3600 * 24, 60 * 3600 * 24 - 1)
            },
            queryParams: {
                types: 'ligne',
                reseaux: 'SEM,C38'
            }
        });
    }
    async findBusStop(position: GenericMapPos<LatLonKeys>) {
        return networkService.request({
            url: MOBILITY_API_URL + '/linesNear/json',
            method: 'GET',
            headers: {
                'Cache-Control': networkService.getCacheControl(60 * 3600 * 24, 60 * 3600 * 24 - 1)
            },
            queryParams: {
                x: position.lon,
                y: position.lat,
                dist: 100,
                details: 'true'
            }
        });
    }

    get apikey() {
        return ApplicationSettings.getString('transitlandToken', gVars.TRANSIT_LAND);
    }
    async routes({
        position,
        include_geometry,
        include_alerts,
        search,
        route_type
    }: {
        route_type?: string;
        search?: string;
        include_geometry?: boolean;
        include_alerts?: boolean;
        position?: GenericMapPos<LatLonKeys>;
    }) {
        return (
            await networkService.request<TransitRoutes>({
                url: TRANSITLAND_API_URL + '/routes.json',
                method: 'GET',
                timeout: 30,
                headers: {
                    'Cache-Control': networkService.getCacheControl(60 * 3600 * 24, 60 * 3600 * 24 - 1),
                    apikey: this.apikey
                },
                queryParams: {
                    ...(position ? { lat: position.lat, lon: position.lon, radius: 50 } : {}),
                    include_geometry,
                    include_alerts,
                    route_type,
                    search
                    // x: position.lon,
                    // y: position.lat,
                    // dist: 100,
                    // details: 'true'
                }
            })
        ).routes.filter((r) => r.route_type < 13);
    }
    async route(
        route_key: string,
        {
            include_geometry,
            include_alerts
        }: {
            include_geometry?: boolean;
            include_alerts?: boolean;
        }
    ) {
        return (
            await networkService.request<TransitRoutes>({
                url: TRANSITLAND_API_URL + `/routes/${route_key}.json`,
                method: 'GET',
                timeout: 30,
                headers: {
                    'Cache-Control': networkService.getCacheControl(60 * 3600 * 24, 60 * 3600 * 24 - 1),
                    apikey: this.apikey
                },
                queryParams: {
                    include_geometry,
                    include_alerts
                }
            })
        ).routes[0];
    }
    async trips(
        route_key: string,
        {
            position,
            include_geometry,
            include_alerts,
            service_date,
            limit,
            after
        }: {
            service_date?: string;
            limit?: number;
            after?: number;
            include_geometry?: boolean;
            include_alerts?: boolean;
            position?: GenericMapPos<LatLonKeys>;
        }
    ) {
        return (
            await networkService.request<TransitRoutes>({
                url: TRANSITLAND_API_URL + `/routes/${route_key}/trips.json`,
                method: 'GET',
                timeout: 30,
                headers: {
                    'Cache-Control': networkService.getCacheControl(60 * 3600 * 24, 60 * 3600 * 24 - 1),
                    apikey: this.apikey
                },
                queryParams: {
                    ...(position ? { lat: position.lat, lon: position.lon, radius: 50 } : {}),
                    service_date,
                    include_geometry,
                    include_alerts,
                    limit,
                    after
                }
            })
        )['trips'];
    }
    async getLineTimeline(id, time?) {
        return networkService.request({
            url: MOBILITY_API_URL + '/ficheHoraires/json',
            method: 'GET',
            headers: {
                'Cache-Control': networkService.getCacheControl(60 * 24)
            },
            queryParams: {
                route: id,
                time
            }
        });
    }
    async getDisturbances() {
        return networkService.request({
            url: 'https://data.mobilites-m.fr/api/dyn/evtTC/json',
            method: 'GET',
            headers: {
                'Cache-Control': networkService.getCacheControl(60 * 24)
            }
        });
    }
    async getLineStops(id) {
        return networkService.request({
            url: `https://data.mobilites-m.fr/api/routers/default/index/routes/${id}/clusters`,
            method: 'GET',
            headers: {
                'Cache-Control': networkService.getCacheControl(60 * 24)
            }
        });
    }

    getRouteColor(item: TransitRoute) {
        if (item.route_color) {
            return item.route_color.startsWith('#') ? item.route_color : '#' + item.route_color;
        }
        return this.defaultTransitLineColor;
    }
    getRouteTextColor(item: TransitRoute) {
        return new Color(this.getRouteColor(item)).getBrightness() >= 170 ? '#000000' : '#ffffff';
    }
}

export const transitService = new TransitService();
