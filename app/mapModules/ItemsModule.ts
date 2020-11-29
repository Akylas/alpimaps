import { MapPos } from '@nativescript-community/ui-carto/core';
import { LocalVectorDataSource } from '@nativescript-community/ui-carto/datasources/vector';
import { VectorLayer } from '@nativescript-community/ui-carto/layers/vector';
import { CartoMap } from '@nativescript-community/ui-carto/ui';
import {
    Line,
    LineEndType,
    LineJointType,
    LineStyleBuilder,
    LineStyleBuilderOptions
} from '@nativescript-community/ui-carto/vectorelements/line';
import { Marker, MarkerStyleBuilder, MarkerStyleBuilderOptions } from '@nativescript-community/ui-carto/vectorelements/marker';
import { Point, PointStyleBuilder, PointStyleBuilderOptions } from '@nativescript-community/ui-carto/vectorelements/point';
import { Color, knownFolders, path } from '@nativescript/core';
import { IItem, Item, ItemRepository } from '~/models/Item';
import { Route, RouteRepository } from '~/models/Route';
import { showError } from '~/utils/error';
import { darkColor } from '~/variables';
import MapModule, { getMapContext } from './MapModule';
import NSQLDatabase from './NSQLDatabase';
import { sql } from 'kiss-orm';
const mapContext = getMapContext();
const filePath = path.join(knownFolders.documents().getFolder('db').path, 'db.sqlite');

declare type Mutable<T extends object> = {
    -readonly [K in keyof T]: T[K];
};
export default class ItemsModule extends MapModule {
    localVectorDataSource: LocalVectorDataSource;
    localVectorLayer: VectorLayer;
    db: NSQLDatabase;
    itemRepository: ItemRepository;
    routeRepository: RouteRepository;
    async initDb() {
        console.log('ItemsModule', 'start');

        try {
            this.db = new NSQLDatabase(filePath, {
                // for now it breaks
                // threading: true,
            });
            this.itemRepository = new ItemRepository(this.db);
            this.routeRepository = new RouteRepository(this.db);
            await this.itemRepository.createTables();
            await this.routeRepository.createTables();
            // await this.connection.synchronize(false);
            const items = await this.itemRepository.searchItem();
            this.addItemsToLayer(items);
        } catch (err) {
            console.log('err', err);

            showError(err);
        }
    }
    onMapReady(mapView: CartoMap<LatLonKeys>) {
        super.onMapReady(mapView);
        this.initDb();
    }
    onMapDestroyed() {
        // console.log('onMapDestroyed');
        super.onMapDestroyed();
        // this.connection && this.connection.close();
        this.db && this.db.disconnect();

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
            this.localVectorLayer.setVectorElementEventListener<LatLonKeys>({
                onVectorElementClicked: (data) => mapContext.onVectorElementClicked(data)
            });

            mapContext.addLayer(this.localVectorLayer, 'items');
        }
    }
    createLocalMarker(item: IItem, options: MarkerStyleBuilderOptions) {
        // console.log('createLocalMarker', options);
        Object.keys(options).forEach((k) => {
            if (options[k] === undefined) {
                delete options[k];
            }
        });
        this.getOrCreateLocalVectorLayer();
        const styleBuilder = new MarkerStyleBuilder(options);
        const metaData = this.itemToMetaData(item);
        // console.log('metaData', metaData);
        return new Marker({ position: item.position, projection: mapContext.getProjection(), styleBuilder, metaData });
    }
    createLocalPoint(position: MapPos, options: PointStyleBuilderOptions) {
        this.getOrCreateLocalVectorLayer();
        const styleBuilder = new PointStyleBuilder(options);
        return new Point({ position, projection: mapContext.getProjection(), styleBuilder });
    }
    itemToMetaData(item: IItem) {
        const result = {};
        Object.keys(item)
            .filter((k) => k !== 'vectorElement')
            .forEach((k) => {
                if (item[k] !== null && item[k] !== undefined) {
                    if (k === 'route') {
                        // ignore positions as it is native object.
                        // we will get it back from the vectorElement
                        const { positions, ...others } = item[k];
                        result[k] = JSON.stringify(others);
                    } else {
                        result[k] = JSON.stringify(item[k]);
                    }
                }
            });
        return result;
    }
    createLocalLine(item: IItem, options: LineStyleBuilderOptions) {
        // console.log('createLocalLine', options);
        Object.keys(options).forEach((k) => {
            if (options[k] === undefined) {
                delete options[k];
            }
        });
        this.getOrCreateLocalVectorLayer();
        const styleBuilder = new LineStyleBuilder(options);

        const metaData = this.itemToMetaData(item);
        // console.log('metaData', metaData);
        return new Line({ positions: item.route.positions, projection: mapContext.getProjection(), styleBuilder, metaData });
    }
    addItemToLayer(item: IItem) {
        if (item.route) {
            const line = this.createLocalLine(item, item.styleOptions);
            this.localVectorDataSource.add(line);
            item.vectorElement = line;
            return line;
        } else {
            const marker = this.createLocalMarker(item, item.styleOptions);
            this.localVectorDataSource.add(marker);
            item.vectorElement = marker;
            return marker;
        }
    }
    addItemsToLayer(items: readonly Item[]) {
        items.forEach(this.addItemToLayer, this);
    }
    async updateItem(item: IItem, data: Partial<IItem>) {
        console.log('updateItem', item.id, item instanceof Item);
        await this.itemRepository.updateItem(item, data);
        // if (!(item instanceof Item)) {
        //     if (item.id) {
        //         if (item.route && !(item.route instanceof Route) && (item.route as any).id) {
        //             const routeToUpdate = await Route.findOne((item.route as any).id);
        //             Object.keys(item.route).forEach((k) => {
        //                 routeToUpdate[k] = item.route[k];
        //             });
        //             item.route = routeToUpdate;
        //         }
        //         const toUpdate = await this.itemRepository.findOne(item.id);
        //         Object.keys(item).forEach((k) => {
        //             toUpdate[k] = item[k];
        //         });
        //         item = toUpdate as any;
        //     } else {
        //         return item;
        //     }
        // }
        // await item.save();
        // console.log('updateItem', !!item.route, !!item.vectorElement, item.id);

        // const tableId = item.route ? 'routes' : 'items';
        // // console.log('saveItem', !!item.route, !!item.vectorElement, item.route);
        // return nSQL(tableId)
        //     .query('upsert', item)
        //     .exec()
        //     .then(r => {
        // const rItem = r[0] as Item;
        const selectedElement = item.vectorElement;
        if (selectedElement) {
            selectedElement.metaData = this.itemToMetaData(item);
            Object.assign(selectedElement, item.styleOptions);
            // this.localVectorDataSource.add(selectedElement);
            item.vectorElement = selectedElement;
        } else {
            item.vectorElement = this.addItemToLayer(item);
        }
        return item; // return the first one
        // });
    }
    async saveItem(
        item: Mutable<IItem>,
        styleOptions?: MarkerStyleBuilderOptions | PointStyleBuilderOptions | LineStyleBuilderOptions
    ) {
        console.log('saveItem', !!item.route, !!item.route && !!item.route.id);
        if (item.route) {
            if (!item.route.id) {
                // const route = new Route();
                // route.id = Date.now();
                // we need to save route first for it get an id
                // Object.keys(item.route).forEach((k) => (route[k] = item.route[k]));
                // await route.save();
                const routeId = Date.now();
                item.route = await this.routeRepository.createRoute({ ...item.route, id: routeId });
                console.log('created route', item.route.id, item.route.positions);
                // item.route = route;
            }
            item.routeId = item.route.id;
            const color = darkColor;
            item.styleOptions = {
                color: new Color(150, color.r, color.g, color.b),
                joinType: LineJointType.ROUND,
                endType: LineEndType.ROUND,
                width: 3,
                clickWidth: 10,
                ...item.styleOptions
            };
        } else {
            item.styleOptions = {
                color: 'yellow',
                size: 20,
                ...item.styleOptions
            };
        }
        if (!item.id) {
            // const data: IItem = item;
            // (data as any).id = Date.now();
            item = await this.itemRepository.createItem({ ...item, id: Date.now() + '' });
            // item = new Item();
            // Object.keys(data).forEach((k) => (item[k] = data[k]));
        }
        // console.log('saving item', item, item.route instanceof Route, item.route )
        // await item.save();
        console.log('item saved', item.id);
        // const test = await Item.findOne(item.id);
        // const tableId = item.route ? 'routes' : 'items';
        // console.log('saveItem', !!item.route, !!item.vectorElement);
        // return nSQL(tableId)
        //     .query('upsert', item)
        //     .exec()
        //     .then(r => {
        //         console.log('upsert done', tableId, r.length);
        //         nSQL('routes')
        //             .query('select')
        //             .exec().then(t=>{
        //                 console.log('test', t.length);
        //             });
        // const rItem = r[0] as Item;
        const selectedElement = item.vectorElement;
        if (selectedElement) {
            Object.assign(selectedElement, item.styleOptions);
            this.localVectorDataSource.add(selectedElement);
            item.vectorElement = selectedElement;
        } else {
            item.vectorElement = this.addItemToLayer(item as Item);
        }
        return item; // return the first one
        // });
    }
    async deleteItem(item: IItem) {
        if (item === mapContext.getSelecetedItem()) {
            mapContext.unselectItem();
        }
        if (item.vectorElement) {
            this.localVectorDataSource.remove(item.vectorElement);
            item.vectorElement = null;
        }
        if (item.id) {
            if (item.route && item.route.id) {
                await this.routeRepository.delete(item.route);
            }
            await this.itemRepository.delete(item as Item);
            // const toRemove = await Item.findOne(item.id);
            // if (toRemove) {
            // await toRemove.remove();
            // }
        }
        // return nSQL(item.route ? 'routes' : 'items')
        //     .query('delete')
        //     .where(['id', '=', item.id])
        //     .exec();
    }
}
