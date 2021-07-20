import Observable from '@nativescript-community/observable';
import { getCacheControl, networkService } from './NetworkService';
import { GenericMapPos } from '@nativescript-community/ui-carto/core';

import { SQLiteDatabase, openOrCreate } from '@akylas/nativescript-sqlite';
import { getDefaultMBTilesDir } from '~/utils/utils';
import { Folder } from '@nativescript/core';

class TransitService extends Observable {
    _db: SQLiteDatabase;
    start() {
        const folderPath = getDefaultMBTilesDir();
        if (Folder.exists(folderPath)) {
            const folder = Folder.fromPath(folderPath);
            const entities = folder.getEntitiesSync();
            entities.some((s) => {
                if (s.name.endsWith('.transitdb')) {
                    this._db = openOrCreate(s.path, {});
                    return true;
                }
            });
        }
    }
    routes: any[];
    async getTransitLines() {
        if (this._db) {
            if (!this.routes) {
                this.routes = (await this._db.select('SELECT * from routes WHERE geojson IS NOT NULL')) as any;
                console.log('routes', this.routes);
            }
        }
        return networkService.request<string>({
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
                value.color = '#' + value.color;
                value.textColor = '#' + value.textColor;
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
                dist: 50,
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
}

export const transitService = new TransitService();
