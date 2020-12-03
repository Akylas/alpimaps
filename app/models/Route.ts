import { MapPos, MapPosVector } from '@nativescript-community/ui-carto/core';
import { LineGeometry } from '@nativescript-community/ui-carto/geometry';
import { WKBGeometryReader } from '@nativescript-community/ui-carto/geometry/reader';
import { WKBGeometryWriter } from '@nativescript-community/ui-carto/geometry/writer';
import CrudRepository from 'kiss-orm/dist/Repositories/CrudRepository';
import SqlQuery from 'kiss-orm/dist/Queries/SqlQuery';
const sql = SqlQuery.createFromTemplateString;
import NSQLDatabase from '../mapModules/NSQLDatabase';

export enum RoutingAction {
    HEAD_ON,
    FINISH,
    NO_TURN,
    GO_STRAIGHTT,
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

const writer = new WKBGeometryWriter();
const reader = new WKBGeometryReader();

namespace GeometryTransformer {
    export function to(value: MapPosVector<LatLonKeys>): any {
        const result = writer.writeGeometry(
            new LineGeometry<LatLonKeys>({
                poses: value
            })
        );
        if (global.isAndroid) {
            return result.getData();
        } else {
            const data = NSData.alloc().initWithBytesLength(result.getData(), result.size());
            return data;
        }
    }

    export function from(value: any): MapPosVector<LatLonKeys> {
        const result = reader.readGeometry(value) as LineGeometry<LatLonKeys>;
        return result.getNative().getPoses();
    }
}

export class Route {
    public readonly id!: string;

    public readonly profile!: RouteProfile | null;

    public readonly positions!: MapPosVector<LatLonKeys>;

    public readonly totalTime!: number;
    public readonly totalDistance!: number;
    public readonly instructions?: RouteInstruction[] | null;
}

export type IRoute = Partial<Route> & {
    // vectorElement?: VectorElement<any, any>;
};

export class RouteRepository extends CrudRepository<Route> {
    constructor(database: NSQLDatabase) {
        super({
            database,
            table: 'Routes',
            primaryKey: 'id',
            model: Route
        });
    }

    async createTables() {
        return this.database.query(sql`
			CREATE TABLE IF NOT EXISTS "Routes"  (
				id TEXT PRIMARY KEY NOT NULL,
				profile TEXT,
				positions blob NOT NULL,
				instructions TEXT,
				totalTime INTEGER,
				totalDistance INTEGER 
			);
		`);
    }

    async createRoute(item: IRoute) {
        const toSave = {};
        Object.keys(item).forEach((k) => {
            const data = item[k];
            if (typeof data === 'string') {
                toSave[k] = data;
            } else {
                if (k === 'positions') {
                    toSave[k] = GeometryTransformer.to(data);
                } else {
                    toSave[k] = JSON.stringify(data);
                }
            }
        });
        await this.create(toSave);
        return item as Route;
    }
    async updateRoute(item: Route, data: Partial<IRoute>) {
        const toSave = {};
        Object.keys(data).forEach((k) => {
            const d = data[k];
            if (typeof d === 'string') {
                toSave[k] = d;
            } else {
                if (k === 'positions') {
                    toSave[k] = GeometryTransformer.to(d);
                } else {
                    toSave[k] = JSON.stringify(d);
                }
            }
        });
        return this.update(item, toSave);
    }

    prepareGetRoute(item) {
        Object.keys(item).forEach((k) => {
            if (k === 'positions') {
                item[k] = GeometryTransformer.from(item[k]);
            } else if (k !== 'id' && k !== 'routeId') {
                item[k] = JSON.parse(item[k]);
            }
        });
        return item;
    }
    async getRoute(itemId: string) {
        let result = await this.get(itemId);
        result = this.prepareGetRoute(result);
        return result;
    }
    async searchRoute(where?: SqlQuery | null, orderBy?: SqlQuery | null) {
        const result = (await this.search(where, orderBy)).slice();
        for (let index = 0; index < result.length; index++) {
            let element = result[index];
            element = this.prepareGetRoute(element);
            result[index] = element;
        }
        return result;
    }
}

// @Entity()
// export default class Route extends BaseEntity {
//     @PrimaryColumn()
//     id: number;

//     @Column('simple-json', { nullable: true })
//     profile?: RouteProfile;

//     @Column('blob', { transformer: GeometryTransformer })
//     positions: MapPosVector<LatLonKeys>;

//     @Column()
//     totalTime: number;
//     @Column()
//     totalDistance: number;
//     @Column('simple-json', { nullable: true })
//     instructions?: RouteInstruction[];
// }
