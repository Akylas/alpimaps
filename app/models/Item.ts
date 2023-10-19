import { MapBounds } from '@nativescript-community/ui-carto/core';
import { VectorTileLayer } from '@nativescript-community/ui-carto/layers/vector';
import { ValhallaProfile } from '@nativescript-community/ui-carto/routing';
import type { Geometry, Point } from 'geojson';
import SqlQuery from 'kiss-orm/dist/Queries/SqlQuery';
import CrudRepository from 'kiss-orm/dist/Repositories/CrudRepository';
import NSQLDatabase from '../mapModules/NSQLDatabase';
// import SimpleOpeningHours from '~/helpers/SimpleOpeningHours';
const extend = require('just-extend');

const sql = SqlQuery.createFromTemplateString;

export function toJSONStringified(item: Partial<Item>) {
    return {
        type: item.type,
        id: item.id,
        properties: item.properties,
        geometry: item.geometry,
        route: item._route || JSON.stringify(item.route),
        profile: item._profile || JSON.stringify(item.profile),
        stats: item._stats || JSON.stringify(item.stats),
        instructions: item._instructions || JSON.stringify(item.instructions)
    };
}

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
export interface DirectionWayPoint {
    geometry: Point;
    properties: {
        id: string;
        color: string;
        isStart: boolean;
        isStop: boolean;
        metaData: any;
        text: string;
    };
}
export interface Route {
    osmid?: string;
    type?: string;
    waypoints?: DirectionWayPoint[];
    costing_options?: any;
    totalTime?: number;
    totalDistance?: number;
}

export interface RouteStats {
    waytypes: {
        perc: number;
        dist: number;
        id: string;
    }[];
    surfaces: {
        perc: number;
        dist: number;
        id: string;
    }[];
}

export interface Address {
    country?: string;
    country_code?: string;
    name?: string;
    city?: string;
    county?: string;
    state?: string;
    neighbourhood?: string;
    postcode?: string;
    street?: string;
    houseNumber?: string;
    getCategories?: Function;
}

export interface ItemProperties {
    [k: string]: any;
    name?: string;
    osm_value?: string;
    osm_key?: string;
    class?: string;
    layer?: string;
    rank?: number;
    extent?: string | [number, number, number, number];
    provider?: 'photon' | 'here' | 'carto';
    categories?: string[];
    address?: Address;

    route?: {
        type?: ValhallaProfile;
        subtype?: string;
        totalTime?: number;
        totalDistance?: number;
    };
    profile?: {
        dplus?: any;
        dmin?: any;
    };
    zoomBounds?: MapBounds<LatLonKeys>;
}

export class Group {
    public readonly id!: string;
    public name: string;
    public onMap: 1 | 0;
}
export class Item {
    public id!: number;
    type?: string;

    image_path?: string;
    creation_date: number;

    public properties!: ItemProperties | null;
    public _properties!: string;
    public geometry!: Geometry;
    public _geometry!: string;
    public _nativeGeometry!: any;

    onMap: 1 | 0;

    route?: Route;
    public _route!: string;
    profile?: RouteProfile;
    public _profile!: string;
    instructions?: RouteInstruction[];
    public _instructions!: string;
    stats?: RouteStats;
    public _stats!: string;

    public groups?: string[];
}
export type IItem = Partial<Item> & {
    layer?: VectorTileLayer;
    // vectorElement?: VectorElement<any, any>;
};

export class GroupRepository extends CrudRepository<Group> {
    constructor(database: NSQLDatabase) {
        super({
            database,
            table: 'Groups',
            primaryKey: 'id',
            model: Group
        });
    }
    static migrations = {
        addGroupName: sql`ALTER TABLE Groups ADD COLUMN name TEXT`,
        addGroupOnMap: sql`ALTER TABLE Groups ADD COLUMN onMap INTEGER`
    };
    async createTables() {
        await this.database.query(sql`
        CREATE TABLE IF NOT EXISTS "Groups" (
            id TEXT PRIMARY KEY NOT NULL
        );
        `);
        const migrationKeys = Object.keys(GroupRepository.migrations);
        for (let index = 0; index < migrationKeys.length; index++) {
            const key = migrationKeys[index];
            try {
                await this.database.migrate({
                    [key]: GroupRepository.migrations[key]
                });
            } catch (error) {
                console.error(error);
            }
        }
    }
}
export class ItemRepository extends CrudRepository<Item> {
    constructor(
        database: NSQLDatabase,
        public groupsRepository: GroupRepository
    ) {
        super({
            database,
            table: 'Items',
            primaryKey: 'id',
            model: Item
        });
    }

    async createTables() {
        return Promise.all([
            this.database.query(sql`
            CREATE TABLE IF NOT EXISTS "Items" (
                id BIGINT PRIMARY KEY NOT NULL,
                geometry TEXT NOT NULL,
                creation_date BIGINT,
                onMap INTEGER,
                properties TEXT,
                route TEXT,
                profile TEXT,
                instructions TEXT,
                stats TEXT,
                image_path TEXT
            );
        `),
            this.database.query(sql`
        CREATE TABLE IF NOT EXISTS "ItemsGroups" (
            item_id BIGINT,
            group_id TEXT,
            PRIMARY KEY(item_id, group_id),
            FOREIGN KEY(item_id) REFERENCES Items(id) ON DELETE CASCADE,
            FOREIGN KEY(group_id) REFERENCES Groups(id) ON DELETE CASCADE
        );
    `)
        ]);
    }
    async loadGroupsRelationship(item: Item): Promise<Item> {
        const groups = await this.groupsRepository.search({
            where: sql`
            "id" IN (
                SELECT "group_id"
                FROM "ItemsGroups"
                WHERE "item_id" = ${item.id}
            )
        `
        });
        item.groups = groups.map((g) => g.id);
        return item;
    }
    async createItem(item: IItem) {
        // DEV_LOG && console.log('createItem', item.onMap, item.image_path);
        const res = await this.create({
            id: item.id,
            creation_date: item.creation_date || Date.now(),
            onMap: item.onMap,
            image_path: item.image_path,
            properties: item._properties || JSON.stringify(item.properties),
            route: item._route || JSON.stringify(item.route),
            profile: item._profile || JSON.stringify(item.profile),
            stats: item._stats || JSON.stringify(item.stats),
            instructions: item._instructions || JSON.stringify(item.instructions),
            geometry: item._geometry || JSON.stringify(item.geometry)
        });
        return item as Item;
    }
    async updateItem(item: Item, data?: Partial<Item>) {
        if (!data) {
            const toUpdate = {
                creation_date: item.creation_date || Date.now(),
                // onMap: item.onMap,
                image_path: item.image_path,
                properties: item._properties || JSON.stringify(item.properties),
                route: item._route || JSON.stringify(item.route),
                profile: item._profile || JSON.stringify(item.profile),
                stats: item._stats || JSON.stringify(item.stats),
                instructions: item._instructions || JSON.stringify(item.instructions),
                geometry: item._geometry || JSON.stringify(item.geometry)
            };
            await this.update(item, toUpdate);
            return item;
        }
        const toSave: Partial<Item> = {};
        const toUpdate: any = {};
        if (data.properties) {
            toSave.properties = extend(item.properties, data.properties);
            // console.log('toSave', item.id, JSON.stringify(data.properties), JSON.stringify(toSave.properties));
            toUpdate.properties = JSON.stringify(toSave.properties);
            delete data.properties;
        }
        Object.keys(data).forEach((k) => {
            const value = data[k];
            toSave[k] = value;
            if (typeof value === 'object' || Array.isArray(value)) {
                toUpdate[k] = JSON.stringify(value);
            } else {
                toUpdate[k] = value;
            }
        });
        const updatedItem = { ...item, ...toSave };
        // console.log('update', item.id, JSON.stringify(toUpdate), JSON.stringify(toSave));
        await this.update(updatedItem, toUpdate);
        return updatedItem;
    }
    async addGroupToItem(item: Item, groupId: string) {
        try {
            let group;
            try {
                group = await this.groupsRepository.get(groupId);
            } catch (error) {}
            // console.log('addGroupToItem', group);
            if (!group) {
                group = await this.groupsRepository.create({ id: groupId, name: groupId, onMap: 1 });
            }
            const relation = await this.database.query(sql` SELECT * FROM ItemsGroups WHERE "item_id" = ${item.id} AND "group_id" = ${groupId}`);
            if (relation.length === 0) {
                await this.database.query(sql` INSERT INTO ItemsGroups ( item_id, group_id ) VALUES(${item.id}, ${groupId})`);
            }
            item.groups = item.groups || [];
            item.groups.push(groupId);
        } catch (error) {
            console.error(error);
        }
    }
    async setItemGroup(item: Item, groupName: string) {
        try {
            // console.log('setItemGroup', groupName, item.id);
            let group;
            if (groupName?.length) {
                try {
                    group = (await this.groupsRepository.search({ where: sql`name=${groupName}` }))[0];
                } catch (error) {
                    console.error('setItemGroup', error, error.stack);
                }
                if (!group) {
                    group = await this.groupsRepository.create({ id: Date.now(), name: groupName, onMap: 1 });
                }
            }

            if (groupName?.length) {
                await this.database.query(sql` DELETE FROM ItemsGroups where item_id=${item.id} AND group_id IS NOT ${group.id}`);
                const relation = await this.database.query(sql` SELECT * FROM ItemsGroups WHERE "item_id" = ${item.id} AND "group_id" = ${group.id}`);
                if (relation.length === 0) {
                    await this.database.query(sql` INSERT INTO ItemsGroups ( item_id, group_id ) VALUES(${item.id}, ${group.id})`);
                }
                item.groups = [groupName];
            } else {
                await this.database.query(sql` DELETE FROM ItemsGroups where item_id=${item.id}`);
                delete item.groups;
            }
        } catch (error) {
            console.error(error, error.stack);
        }
    }

    prepareGetItem(item: Item) {
        return {
            ...item,
            groups: item.groups ? (item.groups as any as string).split(',') : item.groups,
            _properties: item.properties,
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
            _geometry: item.geometry,
            get geometry() {
                if (!this._parsedGeometry) {
                    this._parsedGeometry = JSON.parse(this._geometry);
                }
                return this._parsedGeometry;
            },
            _route: item.route,
            get route() {
                if (!this._parsedRoute) {
                    this._parsedRoute = JSON.parse(this._route);
                }
                return this._parsedRoute;
            },
            _instructions: item.instructions,
            get instructions() {
                if (!this._parsedInstructions) {
                    this._parsedInstructions = JSON.parse(this._instructions);
                }
                return this._parsedInstructions;
            },
            _profile: item.profile,
            get profile() {
                if (!this._parsedProfile) {
                    this._parsedProfile = JSON.parse(this._profile);
                }
                return this._parsedProfile;
            },
            _stats: item.stats,
            get stats() {
                if (!this._parsedStats) {
                    this._parsedStats = JSON.parse(this._stats);
                }
                return this._parsedStats;
            },
            toJSON() {
                return {
                    type: this.type,
                    id: this.id,
                    properties: this.properties,
                    geometry: this.geometry,
                    stats: this.stats,
                    route: this.route,
                    instructions: this.instructions,
                    groups: this.groups
                };
            }
        };
    }
    async getItem(itemId: string) {
        const element = await this.get(itemId);
        return this.prepareGetItem(element);
    }
    async searchItem(args: { postfix?: SqlQuery; select?: SqlQuery; where?: SqlQuery; orderBy?: SqlQuery }) {
        const result = (await this.search(args)).slice();
        for (let index = 0; index < result.length; index++) {
            const element = this.prepareGetItem(result[index]);
            result[index] = element as any;
        }
        return result;
    }
}

// export function itemOHInfos(_item: Item) {
//     if (_item.properties?.opening_hours) {
//         const result: any = {};
//         const oh = new SimpleOpeningHours(_item.properties.opening_hours);
//         // var it = oh.getIterator();
//         // var state = it.getState();
//         result.opened = oh.isOpenNow();
//         result.oh = oh;
//         // it.advance();
//         // var endDate = it.getDate();
//         // if (endDate) {
//         //     endDate = moment(endDate);
//         //     console.debug(endDate.valueOf());
//         //     console.debug(now.valueOf());
//         //     var delta = Math.floor((endDate.valueOf() - now.valueOf()) / 1000);
//         //     console.debug(delta);
//         //     if (0 < delta && delta < 12 * 3600) {
//         //         result.nextTime = endDate;
//         //     }
//         // }
//         return result;
//     }
// }
