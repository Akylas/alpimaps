import {
    BaseEntity,
    Column,
    Entity,
    JoinColumn,
    OneToOne,
    PrimaryColumn,
    PrimaryGeneratedColumn,
    ValueTransformer,
} from '@nativescript-community/typeorm';
import { MapBounds, MapPos } from '@nativescript-community/ui-carto/core';
import { VectorElement } from '@nativescript-community/ui-carto/vectorelements';
import { LineStyleBuilderOptions } from '@nativescript-community/ui-carto/vectorelements/line';
import { MarkerStyleBuilderOptions } from '@nativescript-community/ui-carto/vectorelements/marker';
import { Color } from '@nativescript/core/color';
import Route from './Route';

export interface Address {
    country?: string;
    name?: string;
    county?: string;
    state?: string;
    neighbourhood?: string;
    postcode?: string;
    region?: string;
    road?: string;
    houseNumber?: string;
}

namespace StyleTransformer {
    export function to(
        value: MarkerStyleBuilderOptions & LineStyleBuilderOptions
    ): MarkerStyleBuilderOptions & LineStyleBuilderOptions {
        const result = { ...value };
        Object.keys(result).forEach((k) => {
            if (result[k] instanceof Color) {
                result[k] = result[k].hex;
            }
        });
        return result as any;
    }

    export function from(
        value: MarkerStyleBuilderOptions & LineStyleBuilderOptions
    ): MarkerStyleBuilderOptions & LineStyleBuilderOptions {
        return value;
    }
}

export type IItem = Partial<Item>;

@Entity()
export default class Item extends BaseEntity {
    @PrimaryGeneratedColumn()
    id: number;

    @Column('simple-json', { nullable: true })
    properties?: {
        [k: string]: any;
        name?: string;
        osm_value?: string;
        osm_key?: string;
        class?: string;
        layer?: string;
    };

    @Column({ nullable: true })
    provider?: 'photon' | 'here' | 'carto';

    @Column('simple-array', { nullable: true })
    categories?: string[];

    @Column('simple-json', { nullable: true })
    address?: Address;

    @Column('simple-json', { nullable: true })
    zoomBounds?: MapBounds<LatLonKeys>;

    @Column('simple-json', { nullable: true })
    position?: MapPos<LatLonKeys>;

    @Column('simple-json', { nullable: true, transformer: StyleTransformer })
    styleOptions?: MarkerStyleBuilderOptions & LineStyleBuilderOptions;

    @OneToOne((type) => Route, { cascade: true, nullable: true, eager: true })
    @JoinColumn()
    route: Route;

    vectorElement?: VectorElement<any, any>;
}
