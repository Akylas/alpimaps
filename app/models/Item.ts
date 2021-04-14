import { MapBounds, MapPos } from '@nativescript-community/ui-carto/core';
import { VectorElement } from '@nativescript-community/ui-carto/vectorelements';
import { LineStyleBuilderOptions } from '@nativescript-community/ui-carto/vectorelements/line';
import { MarkerStyleBuilderOptions } from '@nativescript-community/ui-carto/vectorelements/marker';
import { Color } from '@nativescript/core';
import { Route, RouteRepository } from './Route';
import NSQLDatabase from '../mapModules/NSQLDatabase';

import CrudRepository from 'kiss-orm/dist/Repositories/CrudRepository';
import SqlQuery from 'kiss-orm/dist/Queries/SqlQuery';
const sql = SqlQuery.createFromTemplateString;

export interface Address {
    country?: string;
    name?: string;
    city?: string;
    county?: string;
    state?: string;
    neighbourhood?: string;
    postcode?: string;
    street?: string;
    houseNumber?: string;
}
export class Item {
    public readonly id!: string;

    public properties!: {
        [k: string]: any;
        name?: string;
        osm_value?: string;
        osm_key?: string;
        class?: string;
        layer?: string;
        extent?: string | [number, number, number, number];
    } | null;

    public provider!: 'photon' | 'here' | 'carto' | null;

    public categories!: string[] | null;

    public address!: Address | null;

    public zoomBounds!: MapBounds<LatLonKeys> | null;

    public position!: MapPos<LatLonKeys> | null;

    public styleOptions!: (MarkerStyleBuilderOptions & LineStyleBuilderOptions) | null;

    public routeId!: string;
    public route?: Route;
}
export type IItem = Partial<Item> & {
    vectorElement?: VectorElement<any, any>;
};

export class ItemRepository extends CrudRepository<Item> {
    constructor(database: NSQLDatabase, private routeRepository: RouteRepository) {
        super({
            database,
            table: 'Items',
            primaryKey: 'id',
            model: Item
        });
    }

    async createTables() {
        return this.database.query(sql`
			CREATE TABLE IF NOT EXISTS "Items" (
				id TEXT PRIMARY KEY NOT NULL,
				properties TEXT,
				provider TEXT,
				styleOptions TEXT,
				address TEXT,
				zoomBounds TEXT,
				position TEXT NOT NULL,
				routeId TEXT
			);
		`);
    }

    async createItem(item: IItem) {
        const toSave = {};
        Object.keys(item).forEach((k) => {
            if (k === 'route') {
                return;
            }
            const data = item[k];
            if (typeof data === 'string') {
                toSave[k] = data;
            } else {
                if (k === 'styleOptions') {
                    Object.keys(data).forEach((k2) => {
                        if (data[k2] instanceof Color) {
                            data[k2] = data[k2].hex;
                        }
                    });
                }
                toSave[k] = JSON.stringify(data);
            }
        });
        await this.create(toSave);
        return item as Item;
    }
    async updateItem(item: Item, data: Partial<IItem>) {
        const toSave = {};
        Object.keys(data).forEach((k) => {
            if (typeof data[k] === 'string') {
                toSave[k] = data[k];
            } else {
                const d = data[k];
                if (k === 'styleOptions') {
                    Object.keys(d).forEach((k2) => {
                        if (d[k2] instanceof Color) {
                            d[k2] = d[k2].hex;
                        }
                    });
                }
                toSave[k] = JSON.stringify(d);
            }
        });
        return this.update(item, toSave);
    }

    prepareGetItem(item: Item) {
        Object.keys(item).forEach((k) => {
            if (k !== 'id' && k !== 'routeId') {
                item[k] = JSON.parse(item[k]);
            }
        });
        return item;
    }
    async getItem(itemId: string) {
        let element = await this.get(itemId);
        element = this.prepareGetItem(element);
        if (element.routeId) {
            element.route = await this.routeRepository.getRoute(element.routeId);
        }
        return element;
    }
    async searchItem(where?: SqlQuery | null, orderBy?: SqlQuery | null) {
        const result = (await this.search(where, orderBy)).slice();
        for (let index = 0; index < result.length; index++) {
            const element = this.prepareGetItem(result[index]);
            if (element.routeId) {
                element.route = await this.routeRepository.getRoute(element.routeId);
            }
            result[index] = element;
        }
        return result;
    }
}
