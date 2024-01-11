import Observable from '@nativescript-community/observable';
import { Color } from '@nativescript/core';
import { GenericMapPos } from '@nativescript-community/ui-carto/core';
import { getCacheControl, networkService } from './NetworkService';

import { SQLiteDatabase } from '@nativescript-community/sqlite';
import { GeoLocation } from '~/handlers/GeoHandler';
export const MOBILITY_URL = 'https://data.mobilites-m.fr';
export const MOBILITY_API_URL = MOBILITY_URL + '/api';
// const navitiaAPIEndPoint = 'https://api.navitia.io/v1/';

export interface MetroRoute {
    id: string;
    gtfsId: string;
    shortName: string;
    longName: string;
    color: string;
    textColor: string;
    mode: string;
    type: string;
    res?: number;
    name?: string;
}

export interface MetroBusStop {
    id: string;
    name: string;
    lon: number;
    lat: number;
    zone: string;
    lines: string[];
}

export interface MetroLineStop {
    id: string;
    code: string;
    city: string;
    name: string;
    visible: boolean;
    lat: number;
    lon: number;
}

export interface MetroTimesheet {
    '0': MetroTimesheetInner;
    '1': MetroTimesheetInner;
}

export interface MetroTimesheetInner {
    arrets: MetroTripStop[];
    trips: MetroTrip[];
    prevTime: number;
    nextTime: number;
}

export interface MetroTripStop {
    stopId: string;
    trips: (number | string)[];
    stopName: string;
    name: string;
    city: string;
    lat: number;
    lon: number;
    parentStation: MetroLineStop;
}

export interface MetroTrip {
    tripId: string;
    pickupType: string;
}

export interface TransitRoute extends MetroRoute {
    stopIds: string[];
    position: GenericMapPos<LatLonKeys>;
    id: string;
    geometry?;
}

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
            url: MOBILITY_API_URL + '/lines/json',
            headers: {
                'Cache-Control': getCacheControl(60 * 3600 * 24, 60 * 3600 * 24 - 1)
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

    metroLinesData: { [k: string]: MetroRoute };
    async getMetroLinesData() {
        if (!this.metroLinesData) {
            const data = await networkService.request<MetroRoute[]>({
                url: MOBILITY_API_URL + '/routers/default/index/routes',
                method: 'GET',
                headers: {
                    'Cache-Control': getCacheControl(60 * 3600 * 24, 60 * 3600 * 24 - 1)
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
    async findBusStop(position: GenericMapPos<LatLonKeys>) {
        return networkService.request<MetroBusStop[]>({
            url: MOBILITY_API_URL + '/linesNear/json',
            method: 'GET',
            headers: {
                'Cache-Control': getCacheControl(60 * 3600 * 24, 60 * 3600 * 24 - 1)
            },
            queryParams: {
                x: position.lon,
                y: position.lat,
                dist: 100,
                details: 'true'
            }
        });
    }
    async getLineTimeline(id, time?) {
        return networkService.request<MetroTimesheet>({
            url: MOBILITY_API_URL + '/ficheHoraires/json',
            method: 'GET',
            headers: {
                'Cache-Control': getCacheControl(60 * 24)
            },
            queryParams: {
                route: id,
                time
            }
        });
    }
    async getDisturbances() {
        return networkService.request({
            url: MOBILITY_API_URL + '/dyn/evtTC/json',
            method: 'GET',
            headers: {
                'Cache-Control': getCacheControl(60 * 24)
            }
        });
    }
    async getLineStops(id) {
        return networkService.request<MetroLineStop[]>({
            url: `${MOBILITY_API_URL}/routers/default/index/routes/${id.replace('_', ':')}/clusters`,
            method: 'GET',
            headers: {
                'Cache-Control': getCacheControl(60 * 24)
            }
        });
    }

    async routes({ position }) {
        const lines = await this.getMetroLinesData();
        const positionData = await this.findBusStop(position);
        const linesData = positionData.reduce((acc, d) => {
            d.lines.forEach((l) => {
                if (!acc[l]) {
                    acc[l] = { ...lines[l], stopIds: [d.id], position: { lat: d.lat, lon: d.lon }, id: l };
                } else {
                    acc[l].stopIds.push(d.id);
                }
            });
            return acc;
        }, {}) as { [k: string]: TransitRoute };
        return Object.values(linesData);
    }
    getRouteColor(item: TransitRoute) {
        return item.color || this.defaultTransitLineColor;
    }
    getRouteTextColor(item: TransitRoute) {
        return item.textColor || new Color(this.getRouteColor(item)).getBrightness() >= 170 ? '#000000' : '#ffffff';
    }
}

export const transitService = new TransitService();
