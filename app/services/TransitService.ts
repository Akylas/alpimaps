import Observable from '@nativescript-community/observable';
import { getCacheControl, networkService } from './NetworkService';
import { GenericMapPos } from '@nativescript-community/ui-carto/core';

import { SQLiteDatabase, openOrCreate } from '@akylas/nativescript-sqlite';
import { getDefaultMBTilesDir } from '~/utils/utils';
import { Folder } from '@nativescript/core';

// const navitiaAPIEndPoint = 'https://api.navitia.io/v1/';

class TransitService extends Observable {
    _db: SQLiteDatabase;
    start() {
        const folderPath = getDefaultMBTilesDir();
        if (Folder.exists(folderPath)) {
            const folder = Folder.fromPath(folderPath);
            const entities = folder.getEntitiesSync();
            entities.some((s) => {
                if (s.name.endsWith('.transitdb')) {
                    this._db = openOrCreate(s.path, { flags: android.database.sqlite.SQLiteDatabase.OPEN_READONLY });
                    return true;
                }
            });
        }
    }
    routes: any[];
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

    metroLinesData;
    async getMetroLinesData() {
        if (!this.metroLinesData) {
            const data = await networkService.request({
                url: 'https://data.mobilites-m.fr/api/routers/default/index/routes',
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
        return networkService.request({
            url: 'http://data.mobilites-m.fr/api/linesNear/json',
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
        return networkService.request({
            url: 'http://data.mobilites-m.fr/api/ficheHoraires/json',
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
            url: 'https://data.mobilites-m.fr/api/dyn/evtTC/json',
            method: 'GET',
            headers: {
                'Cache-Control': getCacheControl(60 * 24)
            }
        });
    }
    async getLineStops(id) {
        return networkService.request({
            url: `https://data.mobilites-m.fr/api/routers/default/index/routes/${id}/clusters`,
            method: 'GET',
            headers: {
                'Cache-Control': getCacheControl(60 * 24)
            }
        });
    }
}

export const transitService = new TransitService();
