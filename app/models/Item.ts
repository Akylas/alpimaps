import { MapBounds } from '@nativescript-community/ui-carto/core';
import { VectorTileLayer } from '@nativescript-community/ui-carto/layers/vector';
import type { Geometry } from 'geojson';
import extend from 'just-extend';
import SqlQuery from 'kiss-orm/dist/Queries/SqlQuery';
import CrudRepository from 'kiss-orm/dist/Repositories/CrudRepository';
import NSQLDatabase from '../mapModules/NSQLDatabase';

const sql = SqlQuery.createFromTemplateString;

export enum RoutingAction {
    HEAD_ON,
    FINISH,
    NO_TURN,
    GO_STRAIGHT,
    TURN_RIGHT,
    UTURN,
    TURN_LEFT,
    REACH_VIA_LOCATION,
    ENTER_ROUNDABOUT,
    LEAVE_ROUNDABOUT,
    STAY_ON_ROUNDABOUT,
    START_AT_END_OF_STREET,
    ENTER_AGAINST_ALLOWED_DIRECTION,
    LEAVE_AGAINST_ALLOWED_DIRECTION,
    GO_UP,
    GO_DOWN,
    WAIT
}

export interface RouteInstruction {
    // position: MapPos<LatLonKeys>;
    a: RoutingAction;
    az: number;
    dist: number;
    index: number;
    time: number;
    angle: number;
    name: string;
    inst: string;
}

export interface RouteProfile {
    max: [number, number];
    min: [number, number];
    dplus?: any;
    dmin?: any;
    data: { d: number; a: number; avg: number; g }[];
    colors?: { d: number; color: string }[];
}
export interface Route {
    osmid?: number;
    totalTime: number;
    totalDistance: number;
}

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
        const updatedItem = { ...item, properties: extend(item.properties, data) };
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
