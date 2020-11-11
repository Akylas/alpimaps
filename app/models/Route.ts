import {
    BaseEntity,
    Column,
    Entity,
    OneToOne,
    PrimaryColumn,
    PrimaryGeneratedColumn,
    ValueTransformer,
} from '@nativescript-community/typeorm';
import { MapBounds, MapPos, MapPosVector } from '@nativescript-community/ui-carto/core';
import { decodeMapPosVector, encodeMapPosVector } from '@nativescript-community/ui-carto/utils';
import { VectorElement } from '@nativescript-community/ui-carto/vectorelements';
import { LineGeometry } from '@nativescript-community/ui-carto/geometry';
import { WKBGeometryWriter } from '@nativescript-community/ui-carto/geometry/writer';
import { WKBGeometryReader } from '@nativescript-community/ui-carto/geometry/reader';
import Item from './Item';

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
    WAIT,
}

export interface RouteInstruction {
    position: MapPos<LatLonKeys>;
    action: RoutingAction;
    azimuth: number;
    distance: number;
    pointIndex: number;
    time: number;
    turnAngle: number;
    streetName: string;
    instruction: string;
}

export interface RouteProfile {
    max: [number, number];
    min: [number, number];
    dplus?: any;
    dmin?: any;
    data: { distance: number; altitude: number; altAvg: number; grade }[];
    colors?: { distance: number; color: string }[];
}

const writer = new WKBGeometryWriter();
const reader = new WKBGeometryReader();

namespace GeometryTransformer {
    export function to(value: MapPosVector<LatLonKeys>): any {
        const result = writer.writeGeometry(
            new LineGeometry<LatLonKeys>({
                poses: value,
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

@Entity()
export default class Route extends BaseEntity {
    @PrimaryColumn()
    id: number;

    @Column('simple-json', { nullable: true })
    profile?: RouteProfile;

    @Column('blob', { transformer: GeometryTransformer })
    positions: MapPosVector<LatLonKeys>;

    @Column()
    totalTime: number;
    @Column()
    totalDistance: number;
    @Column('simple-json', { nullable: true })
    instructions?: RouteInstruction[];
}
