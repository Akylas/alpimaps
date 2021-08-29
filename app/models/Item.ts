import { MapBounds, MapPos } from '@nativescript-community/ui-carto/core';
import { VectorElement } from '@nativescript-community/ui-carto/vectorelements';
import { LineStyleBuilderOptions } from '@nativescript-community/ui-carto/vectorelements/line';
import { MarkerStyleBuilderOptions } from '@nativescript-community/ui-carto/vectorelements/marker';
import { Color } from '@nativescript/core';
import { Route, RouteInstruction, RouteProfile, RouteRepository } from './Route';
import NSQLDatabase from '../mapModules/NSQLDatabase';
import type { Geometry } from 'geojson';
import mergeOptions from 'merge-options';

import CrudRepository from 'kiss-orm/dist/Repositories/CrudRepository';
import SqlQuery from 'kiss-orm/dist/Queries/SqlQuery';
import { VectorTileLayer } from '@nativescript-community/ui-carto/layers/vector';
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
export interface ItemProperties {
    [k: string]: any;
    name?: string;
    osm_value?: string;
    osm_key?: string;
    class?: string;
    layer?: string;
    extent?: string | [number, number, number, number];
    provider?: 'photon' | 'here' | 'carto';
    categories?: string[];
    address?: Address;
    route?: Route;
    profile?: RouteProfile;
    instructions?: RouteInstruction[];
    zoomBounds?: MapBounds<LatLonKeys>;
}
export class Item {
    public readonly id!: string;

    public properties!: ItemProperties | null;
    public _properties!: string;
    public geometry!: Geometry;
    public _geometry!: string;
    public _nativeGeometry!: any;
}
export type IItem = Partial<Item> & {
    layer?: VectorTileLayer;
    // vectorElement?: VectorElement<any, any>;
};

export class ItemRepository extends CrudRepository<Item> {
    constructor(database: NSQLDatabase) {
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
                geometry TEXT NOT NULL
			);
		`);
    }

    async createItem(item: IItem) {
        await this.create({
            id: item.id,
            properties: item._properties || JSON.stringify(item.properties),
            geometry: item._geometry || JSON.stringify(item.geometry)
        });
        return item as Item;
    }
    async updateItem(item: Item, data: Partial<ItemProperties>) {
        const updatedItem = { ...item, properties: mergeOptions(item.properties, data) };
        await this.update(updatedItem, { properties: JSON.stringify(updatedItem.properties) });
        return updatedItem;
    }

    prepareGetItem(item: Item) {
        return {
            id: item.id,
            _properties: item.properties,
            _geometry: item.geometry,
            get properties() {
                if (!this._parsedProperties) {
                    this._parsedProperties = JSON.parse(this._properties);
                    this._parsedProperties.id = this.id;
                }
                return this._parsedProperties;
            },
            set properties(value) {
                delete this._properties;
                this._parsedProperties = value;
            },
            get geometry() {
                if (!this._parsedGeometry) {
                    this._parsedGeometry = JSON.parse(this._geometry);
                }
                return this._parsedGeometry;
            }
        };
    }
    async getItem(itemId: string) {
        const element = await this.get(itemId);
        return this.prepareGetItem(element);
    }
    async searchItem(where?: SqlQuery | null, orderBy?: SqlQuery | null) {
        const result = (await this.search(where, orderBy)).slice();
        for (let index = 0; index < result.length; index++) {
            const element = this.prepareGetItem(result[index]);
            result[index] = element as any;
        }
        return result;
    }
}
