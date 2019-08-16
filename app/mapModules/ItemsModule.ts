import { MapBounds, MapPos } from 'nativescript-carto/core/core';
import { LocalVectorDataSource } from 'nativescript-carto/datasources/vector';
import { VectorLayer } from 'nativescript-carto/layers/vector';
import { CartoMap } from 'nativescript-carto/ui/ui';
import { Route } from '~/components/DirectionsPanel';
import Map from '~/components/Map';
import MapModule from './MapModule';
import Vue from 'nativescript-vue';

import { NativeSQLite } from '@nano-sql/adapter-sqlite-nativescript';
// MUST include nSQL from the lib path.
import { nSQL } from '@nano-sql/core/lib/index';
import { InanoSQLTableConfig } from '@nano-sql/core/lib/interfaces';
import { Line, LineEndType, LineJointType, LineStyleBuilder, LineStyleBuilderOptions } from 'nativescript-carto/vectorelements/line';
import { Point, PointStyleBuilder, PointStyleBuilderOptions } from 'nativescript-carto/vectorelements/point';
import { Marker, MarkerStyleBuilder, MarkerStyleBuilderOptions } from 'nativescript-carto/vectorelements/marker';
import { VectorElement } from 'nativescript-carto/vectorelements/vectorelements';

export const tables: InanoSQLTableConfig[] = [
    {
        name: 'items',
        model: {
            'id:int': { pk: true, ai: true },
            'provider:string': {},
            'properties:obj': {
                default: () => undefined,
                model: {
                    'name:string': {},
                    'osm_value:string': {},
                    'osm_key:string': {},
                    'class:string': {},
                    'layer:string': {},
                    '*:any': {}
                }
            },
            'address:obj': {
                default: () => undefined,
                model: {
                    'country:string': {},
                    'name:string': {},
                    'county:string': {},
                    'neighbourhood:string': {},
                    'postcode:string': {},
                    'region:string': {},
                    'road:string': {},
                    'houseNumber:string': {}
                }
            },
            'styleOptions:obj': {
                default: () => undefined,
                model: {
                    'color:string': {},
                    'size:number': {},
                    'scalingMode:number': {},
                    'orientationMode:number': {}
                }
            },
            'position:geo': {},
            'zoomBounds:obj': {
                default: () => undefined,
                model: {
                    'northeast:geo': {},
                    'southwest:geo': {}
                }
            }
        }
    },
    {
        name: 'routes',
        model: {
            'id:int': { pk: true, ai: true },
            'provider:string': {},
            'properties:obj': {
                default: () => undefined,
                model: {
                    'name:string': {},
                    'osm_value:string': {},
                    'osm_key:string': {},
                    'class:string': {},
                    'layer:string': {},
                    '*:any': {}
                }
            },
            'address:obj': {
                default: () => undefined,
                model: {
                    'country:string': {},
                    'name:string': {},
                    'county:string': {},
                    'neighbourhood:string': {},
                    'postcode:string': {},
                    'region:string': {},
                    'road:string': {},
                    'houseNumber:string': {}
                }
            },
            'styleOptions:obj': {
                default: () => undefined,
                model: {
                    'color:string': {},
                    'width:number': {},
                    'joinType:number': {},
                    'endType:number': {},
                    'clickWidth:number': {},
                    'stretchFactor:number': {}
                }
            },

            'route:obj': {
                model: {
                    'totalTime:number': {},
                    'totalDistance:number': {},
                    'positions:geo[]': {},
                    'instructions:obj[]': {
                        model: {
                            'position:geo': {},
                            'action:string': {},
                            'azimuth:number': {},
                            'distance:number': {},
                            'time:number': {},
                            'turnAngle:number': {},
                            'streetName:string': {}
                        }
                    },
                    'profile:obj': {
                        default: () => undefined,
                        model: {
                            'min:number[]': {},
                            'max:number[]': {},
                            'dplus:number': {},
                            'dmin:number': {},
                            'points:geo[]': {
                                default: () => undefined
                            },
                            'data:obj[]': {
                                default: () => undefined,
                                model: {
                                    'x:number': {},
                                    'y:number': {}
                                }
                            }
                        }
                    }
                }
            },

            'zoomBounds:obj': {
                default: () => undefined,
                model: {
                    'northeast:geo': {},
                    'southwest:geo': {}
                }
            }
        }
    }
];

export const types = {
    meta: {
        'key:string': { notNull: true },
        'value:any': { notNull: true }
    }
};

export interface Address {
    country?: string;
    name?: string;
    county?: string;
    state?: string;
    // locality: r.address.getLocality(),
    neighbourhood?: string;
    postcode?: string;
    region?: string;
    road?: string;
    houseNumber?: string;
}
export interface Item {
    id?: number;
    properties?: {
        [k: string]: any;
        name?: string;
        osm_value?: string;
        osm_key?: string;
        class?: string;
        layer?: string;
    };
    provider?: 'photon' | 'here' | 'carto';
    categories?: string[];
    address?: Address;
    zoomBounds?: MapBounds;
    route?: Route;
    position?: MapPos;
    styleOptions?: any;
    vectorElement?: VectorElement<any, any>;
}

export default class ItemsModule extends MapModule {
    localVectorDataSource: LocalVectorDataSource;
    localVectorLayer: VectorLayer;

    onMapReady(mapComp: Map, mapView: CartoMap) {
        // this.log('onMapReady');
        super.onMapReady(mapComp, mapView);
        Promise.resolve()
            .then(() => {
                return nSQL().createDatabase({
                    id: 'alpimaps',
                    mode: new NativeSQLite(),
                    tables
                    // types
                });
            })
            .catch(err => {
                this.log('catching error', err); // TODO: catch already created for now. need to look at how to do it
            })
            .then(() => {
                // this.log('database created', nSQL().listDatabases());
                // return nSQL().transaction([
                return Promise.all([
                    nSQL('routes')
                        .query('select')
                        .exec(),
                    // .then(this.addItemsToLayer),
                    nSQL('items')
                        .query('select')
                        .exec()
                    // .exec()
                    // .then(this.addItemsToLayer)
                ]);
            })
            .then(r => {
                r.forEach(items => {
                    // console.log('got result', items.length);
                    this.addItemsToLayer(items);
                });
            })
            .catch(err => {
                Vue.prototype.$showError(err);
            });
    }
    onMapDestroyed() {
        // this.log('onMapDestroyed');
        super.onMapDestroyed();
        nSQL().disconnect();

        if (this.localVectorDataSource) {
            this.localVectorDataSource.clear();
            this.localVectorDataSource = null;
        }
        if (this.localVectorLayer) {
            this.localVectorLayer.setVectorElementEventListener(null);
            this.localVectorLayer = null;
        }
    }

    getOrCreateLocalVectorLayer() {
        if (!this.localVectorLayer) {
            const projection = this.mapView.projection;
            this.localVectorDataSource = new LocalVectorDataSource({ projection });

            this.localVectorLayer = new VectorLayer({ visibleZoomRange: [0, 24], dataSource: this.localVectorDataSource });
            this.localVectorLayer.setVectorElementEventListener(this.mapComp);

            this.mapComp.addLayer(this.localVectorLayer, 'items');
        }
    }
    createLocalMarker(item: Item, options: MarkerStyleBuilderOptions) {
        // console.log('createLocalMarker', options);
        Object.keys(options).forEach(k => {
            if (options[k] === undefined) {
                delete options[k];
            }
        });
        this.getOrCreateLocalVectorLayer();
        const styleBuilder = new MarkerStyleBuilder(options);
        const metaData = this.itemToMetaData(item);
        // console.log('metaData', metaData);
        return new Marker({ position: item.position, projection: this.mapComp.mapProjection, styleBuilder, metaData });
    }
    createLocalPoint(position: MapPos, options: PointStyleBuilderOptions) {
        this.getOrCreateLocalVectorLayer();
        const styleBuilder = new PointStyleBuilder(options);
        return new Point({ position, projection: this.mapComp.mapProjection, styleBuilder });
    }
    itemToMetaData(item: Item) {
        const result = {};
        Object.keys(item).forEach(k => {
            if (item[k] !== null && item[k] !== undefined) {
                result[k] = JSON.stringify(item[k]);
            }
        });
        return result;
    }
    createLocalLine(item: Item, options: LineStyleBuilderOptions) {
        // console.log('createLocalLine', options);
        Object.keys(options).forEach(k => {
            if (options[k] === undefined) {
                delete options[k];
            }
        });
        this.getOrCreateLocalVectorLayer();
        const styleBuilder = new LineStyleBuilder({ clickWidth: 10, ...options });

        const metaData = this.itemToMetaData(item);
        // console.log('metaData', metaData);
        return new Line({ positions: item.route.positions, projection: this.mapComp.mapProjection, styleBuilder, metaData });
    }
    addItemToLayer(item: Item) {
        if (item.route) {
            const line = this.createLocalLine(item, item.styleOptions);
            this.localVectorDataSource.add(line);
            return line;
        } else {
            const marker = this.createLocalMarker(item, item.styleOptions);
            this.localVectorDataSource.add(marker);
            return marker;
        }
    }
    addItemsToLayer(items: Item[]) {
        // this.log('addItemsToLayer', items);
        items.forEach(this.addItemToLayer, this);
    }
    updateItem(item: Item) {
        const tableId = item.route ? 'routes' : 'items';
        // console.log('saveItem', !!item.route, !!item.vectorElement, item.route);
        return nSQL(tableId)
            .query('upsert', item)
            .exec()
            .then(r => {
                const rItem = r[0] as Item;
                const selectedElement = item.vectorElement;
                if (selectedElement) {
                    selectedElement.metaData = this.itemToMetaData(item);
                    Object.assign(selectedElement, item.styleOptions);
                    // this.localVectorDataSource.add(selectedElement);
                    rItem.vectorElement = selectedElement;
                } else {
                    rItem.vectorElement = this.addItemToLayer(rItem);
                }
                return rItem; // return the first one
            });
    }
    saveItem(item: Item, styleOptions?: MarkerStyleBuilderOptions | PointStyleBuilderOptions | LineStyleBuilderOptions) {
        if (item.route) {
            item.styleOptions = {
                color: 'red',
                joinType: LineJointType.ROUND,
                endType: LineEndType.ROUND,
                width: 6,
                clickWidth: 30,
                ...item.styleOptions
            };
        } else {
            item.styleOptions = {
                color: 'yellow',
                size: 20,
                ...item.styleOptions
            };
        }
        const tableId = item.route ? 'routes' : 'items';
        // console.log('saveItem', !!item.route, !!item.vectorElement, item.route);
        return nSQL(tableId)
            .query('upsert', item)
            .exec()
            .then(r => {
                // this.log('upsert done', tableId, r);
                const rItem = r[0] as Item;
                const selectedElement = item.vectorElement;
                if (selectedElement) {
                    Object.assign(selectedElement, item.styleOptions);
                    this.localVectorDataSource.add(selectedElement);
                    rItem.vectorElement = selectedElement;
                } else {
                    rItem.vectorElement = this.addItemToLayer(rItem);
                }
                return rItem; // return the first one
            });
    }
    deleteItem(item: Item) {
        if (item === this.mapComp.selectedItem) {
            this.mapComp.unselectItem();
        }
        if (item.vectorElement) {
            this.localVectorDataSource.remove(item.vectorElement);
            item.vectorElement = null;
        }
        return nSQL(item.route ? 'routes' : 'items')
            .query('delete')
            .where(['id', '=', item.id])
            .exec();
    }
}
