import { GenericMapPos, fromNativeMapPos } from '@nativescript-community/ui-carto/core';
import { LocalVectorDataSource } from '@nativescript-community/ui-carto/datasources/vector';
import { LineGeometry, PolygonGeometry } from '@nativescript-community/ui-carto/geometry';
import { VectorTileFeatureCollection } from '@nativescript-community/ui-carto/geometry/feature';
import { GeoJSONGeometryReader } from '@nativescript-community/ui-carto/geometry/reader';
import { GeoJSONGeometryWriter } from '@nativescript-community/ui-carto/geometry/writer';
import { VectorLayer, VectorTileEventData, VectorTileLayer } from '@nativescript-community/ui-carto/layers/vector';
import { VectorTileSearchService } from '@nativescript-community/ui-carto/search';
import { CartoMap } from '@nativescript-community/ui-carto/ui';
import { Line, LineEndType, LineJointType, LineStyleBuilder, LineStyleBuilderOptions } from '@nativescript-community/ui-carto/vectorelements/line';
import { Marker, MarkerStyleBuilder, MarkerStyleBuilderOptions } from '@nativescript-community/ui-carto/vectorelements/marker';
import { Point, PointStyleBuilder, PointStyleBuilderOptions } from '@nativescript-community/ui-carto/vectorelements/point';
import { knownFolders, path } from '@nativescript/core';
import { IItem, Item, ItemProperties, ItemRepository } from '~/models/Item';
import { showError } from '~/utils/error';
import { join_em } from '~/utils/joinem';
import { darkColor } from '~/variables';
import MapModule, { getMapContext } from './MapModule';
import NSQLDatabase from './NSQLDatabase';
import { ShareFile } from '@nativescript-community/ui-share-file';
import { getDistanceSimple } from '~/helpers/geolib';
import { GeoJSONVectorTileDataSource } from '@nativescript-community/ui-carto/datasources';
import type { Feature } from 'geojson';
import { MBVectorTileDecoder } from '@nativescript-community/ui-carto/vectortiles';
const mapContext = getMapContext();
const filePath = path.join(knownFolders.documents().getFolder('db').path, 'db.sqlite');

let writer: GeoJSONGeometryWriter<LatLonKeys>;

declare type Mutable<T extends object> = {
    -readonly [K in keyof T]: T[K];
};
export default class ItemsModule extends MapModule {
    localVectorDataSource: GeoJSONVectorTileDataSource;
    currentLayerFeatures: Feature[] = [];
    currentItems: IItem[] = [];
    localVectorLayer: VectorTileLayer;
    db: NSQLDatabase;
    itemRepository: ItemRepository;
    async initDb() {
        try {
            this.db = new NSQLDatabase(filePath, {
                // for now it breaks
                // threading: true,
                transformBlobs: false
            } as any);
            this.itemRepository = new ItemRepository(this.db);
            await this.itemRepository.createTables();
            // await this.connection.synchronize(false);
            const items = await this.itemRepository.searchItem();
            this.addItemsToLayer(items);
        } catch (err) {
            console.log('err', err, err.stack);

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
            // this.localVectorDataSource.clear();
            this.localVectorDataSource = null;
        }
        if (this.localVectorLayer) {
            this.localVectorLayer.setVectorTileEventListener(null);
            this.localVectorLayer = null;
        }
    }

    getOrCreateLocalVectorLayer() {
        if (!this.localVectorLayer) {
            this.localVectorDataSource = new GeoJSONVectorTileDataSource({
                simplifyTolerance: 0,
                minZoom: 0,
                maxZoom: 24
            });
            this.localVectorDataSource.createLayer('items');
            // this.localVectorDataSource.setGeometrySimplifier(new DouglasPeuckerGeometrySimplifier({ tolerance: 2 }));
            this.localVectorLayer = new VectorTileLayer({
                labelBlendingSpeed: 0,
                layerBlendingSpeed: 0,
                clickRadius: 6,
                dataSource: this.localVectorDataSource,
                decoder: mapContext.innerDecoder
            });
            this.localVectorLayer.setVectorTileEventListener<LatLonKeys>(
                {
                    onVectorTileClicked(info: VectorTileEventData<LatLonKeys>) {
                        return mapContext.vectorTileElementClicked(info);
                    }
                },
                mapContext.getProjection()
            );

            mapContext.addLayer(this.localVectorLayer, 'items');
        }
    }
    // createLocalMarker(item: IItem, options: MarkerStyleBuilderOptions) {
    //     // console.log('createLocalMarker', options);
    //     Object.keys(options).forEach((k) => {
    //         if (options[k] === undefined) {
    //             delete options[k];
    //         }
    //     });
    //     const styleBuilder = new MarkerStyleBuilder(options);
    //     const metaData = this.itemToMetaData(item);
    //     // console.log('metaData', metaData);
    //     return new Marker({ position: item.position, projection: mapContext.getProjection(), styleBuilder, metaData });
    // }
    createLocalPoint(position: GenericMapPos<LatLonKeys>, options: PointStyleBuilderOptions) {
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
                        result[k] = typeof item[k] === 'string' ? item[k] : JSON.stringify(item[k]);
                    }
                }
            });
        return result;
    }
    // createLocalLine(item: IItem, options: LineStyleBuilderOptions) {
    //     // console.log('createLocalLine', options);
    //     Object.keys(options).forEach((k) => {
    //         if (options[k] === undefined) {
    //             delete options[k];
    //         }
    //     });
    //     const styleBuilder = new LineStyleBuilder(options);

    //     const metaData = this.itemToMetaData(item);
    //     return new Line({ positions: item.route.positions, projection: mapContext.getProjection(), styleBuilder, metaData });
    // }
    addItemToLayer(item: IItem, autoUpdate = false) {
        this.getOrCreateLocalVectorLayer();
        // if (!writer) {
        //     const projection = this.localVectorLayer.getDataSource().getProjection();
        //     writer = new GeoJSONGeometryWriter<LatLonKeys>({
        //         sourceProjection: projection
        //     });
        // }

        const sProps = {};
        Object.keys(item.properties).forEach((k) => {
            if (typeof item.properties[k] === 'object') {
                sProps[k] = JSON.stringify(item.properties[k]);
            } else {
                sProps[k] = item.properties[k];
            }
        });
        this.currentItems.push(item);
        this.currentLayerFeatures.push({ type: 'Feature', id: item.id, properties: sProps, geometry: item.geometry });
        if (autoUpdate) {
            this.updateGeoJSONLayer();
        }
        // if (item.route) {
        //     const line = this.createLocalLine(item, item.styleOptions);
        //     this.currentLayerFeatures.push(line);
        //     // item.vectorElement = line;
        //     return line;
        // } else {
        //     const marker = this.createLocalMarker(item, item.styleOptions);
        //     this.localVectorDataSource.add(marker);
        //     item.vectorElement = marker;
        //     return marker;
        // }
    }
    getFeature(id: string) {
        return this.currentItems.find((d) => d.properties.id === id);
    }
    updateGeoJSONLayer() {
        this.getOrCreateLocalVectorLayer();
        // console.log(
        //     'updateGeoJSONLayer',
        //     this.currentLayerFeatures.map((i) => [i.geometry.type, i.geometry.coordinates.length])
        // );
        this.localVectorDataSource.setLayerGeoJSONString(
            1,
            JSON.stringify({
                type: 'FeatureCollection',
                features: this.currentLayerFeatures
            })
        );
    }
    addItemsToLayer(items: readonly Item[]) {
        items.forEach((i) => this.addItemToLayer(i), this);
        this.updateGeoJSONLayer();
    }
    async updateItem(item: IItem, data: Partial<ItemProperties>) {
        if (Object.keys(data).length > 0) {
            item = await this.itemRepository.updateItem(item as Item, data);
        }
        const index = this.currentLayerFeatures.findIndex((d) => d.id === item.id);
        if (index !== -1) {
            this.currentItems.splice(index, 1, item);
            const sProps = {};
            Object.keys(item.properties).forEach((k) => {
                if (typeof item.properties[k] === 'object') {
                    sProps[k] = JSON.stringify(item.properties[k]);
                } else {
                    sProps[k] = item.properties[k];
                }
            });
            this.currentLayerFeatures.splice(index, 1, { type: 'Feature', id: item.id, properties: sProps, geometry: item.geometry });
            // console.log('test', k, item.properties[k]);
            this.updateGeoJSONLayer();
        }
        return item;
    }
    async shareFile(content: string, fileName: string) {
        const file = knownFolders.temp().getFile(fileName);
        // iOS: using writeText was not adding the file. Surely because it was too soon or something
        // doing it sync works better but still needs a timeout
        // showLoading('loading');
        await file.writeText(content);
        const shareFile = new ShareFile();
        await shareFile.open({
            path: file.path,
            title: fileName,
            type: '*/*',
            options: true, // optional iOS
            animated: true // optional iOS
        });
    }
    async getRoutePositions(item: IItem) {
        const layer = item.layer;
        const properties = item.properties;
        const projection = layer.getDataSource().getProjection();
        const mapProjection = mapContext.getProjection();
        const searchService = new VectorTileSearchService({
            minZoom: 14,
            maxZoom: 14,
            layer
        });
        let extent: [number, number, number, number] = item.properties.extent as any;
        if (typeof extent === 'string') {
            extent = JSON.parse(`[${extent}]`);
        }
        const boundsGeo = new PolygonGeometry<LatLonKeys>({
            poses: [
                { lat: extent[1], lon: extent[0] },
                { lat: extent[3], lon: extent[2] }
            ]
        });
        // console.log('boundsGeo', boundsGeo.getBounds());
        const featureCollection = await new Promise<VectorTileFeatureCollection>((resolve) =>
            searchService.findFeatures(
                {
                    projection: mapProjection,
                    filterExpression: `osmid=${properties.osmid}`,
                    geometry: boundsGeo
                },
                resolve
            )
        );
        console.log('found', featureCollection.getFeatureCount());
        if (!writer) {
            writer = new GeoJSONGeometryWriter<LatLonKeys>({
                sourceProjection: projection
            });
        }
        const jsonStr = writer.writeFeatureCollection(featureCollection);

        // this.shareFile(jsonStr, 'test2.json');
        const geojson: GeoJSON.FeatureCollection<GeoJSON.LineString | GeoJSON.MultiLineString> = JSON.parse(jsonStr);

        const features = geojson.features;

        const listCoordinates: GeoJSON.Position[][] = [];
        features.forEach((f) => {
            if (f.geometry.type === 'MultiLineString') {
                listCoordinates.push(...f.geometry.coordinates);
            } else {
                listCoordinates.push(f.geometry.coordinates);
            }
        });
        // const test = join_em(listCoordinates);
        console.log('listCoordinate s', listCoordinates.length);
        const sorted = [];

        // listCoordinates.forEach((coords) => {
        //     // try to find the current sorted one where the end point is the closest to our start point.
        //     const start = coords[0];
        //     let minDist = Number.MAX_SAFE_INTEGER;
        //     let index = -1;
        //     sorted.forEach((s2, i) => {
        //         const end = s2[s2.length - 1];
        //         const distance = getDistanceSimple([start[1], start[0]], [end[1], end[0]]);
        //         if (distance < minDist) {
        //             minDist = distance;
        //             index = i;
        //         }
        //     });
        //     if (index < sorted.length - 1) {
        //         sorted.splice(index + 1, 0, coords);
        //     } else {
        //         sorted.push(coords);
        //     }
        // });
        // now let s try to find the right order.
        // console.log('test', sorted.length);
        // console.log(
        //     'test2',
        //     sorted.map((s, i) => {
        //         if (i < sorted.length -1) {
        //             const start = sorted[i][sorted[i].length - 1];
        //             const end = sorted[i + 1][0];
        //             return getDistanceSimple([start[1], start[0]], [end[1], end[0]]);
        //         }
        //         return 0;
        //     })
        // );
        // throw new Error();
        // let count = 0;
        // features.forEach((f: any) => {
        //     count += f.geometry.coordinates.length;
        //     f.start = f.geometry.coordinates[0].join('');
        //     f.end = f.geometry.coordinates[f.geometry.coordinates.length - 1].join('');
        // });
        // let index = features.findIndex((s) => features.findIndex((s2) => s2.end === s.start) === -1);
        // const sorted = features.splice(index, 1);
        // console.log('test', index, count);
        // while (features.length > 0) {
        //     index = features.findIndex((s) => s.start === sorted.at(-1).end);
        //     if (index !== -1) {
        //         sorted.push(...features.splice(index, 1));
        //     } else {
        //         break;
        //     }
        // }
        // if (features.length > 0) {
        //     sorted.push(...features);
        // }
        const coordinates = [];
        listCoordinates.forEach((s, index) => {
            // if (index === 0) {
            coordinates.push(...s);
            // } else {
            // coordinates.push(...s.geometry.coordinates);
            // }
        });
        return {
            type: 'LineString' as any,
            coordinates
        };
        // console.log('coordinates', coordinates.length);
        // const reader = new GeoJSONGeometryReader({
        //     targetProjection: mapProjection
        // });
        // const geometry = reader.readGeometry(
        //     JSON.stringify({
        //         type: 'LineString',
        //         coordinates
        //     })
        // );
        // return geometry as LineGeometry<LatLonKeys>;
    }
    async saveItem(item: Mutable<IItem>, styleOptions?: MarkerStyleBuilderOptions | PointStyleBuilderOptions | LineStyleBuilderOptions) {
        try {
            const properties = item.properties;
            if (properties?.route) {
                if (!item.geometry && properties.route.osmid) {
                    item.geometry = await this.getRoutePositions(item);
                }
                // if (!item.route.id) {
                //     item.route = await this.routeRepository.createRoute({ ...item.route, id: Date.now() + '' });
                // }
                // item.routeId = item.route.id;
                // item.styleOptions = {
                //     color: darkColor.setAlpha(150).hex,
                //     joinType: LineJointType.ROUND,
                //     endType: LineEndType.ROUND,
                //     width: 3,
                //     clickWidth: 10,
                //     ...item.styleOptions
                // };
                // } else {
                //     item.styleOptions = {
                //         color: 'yellow',
                //         size: 20,
                //         ...item.styleOptions
                //     };
            }
            if (!item.id) {
                item = await this.itemRepository.createItem({ ...item, id: item.properties.id || Date.now() + '' });
            }
            this.addItemToLayer(item, true);

            // const selectedElement = item.vectorElement;
            // if (selectedElement) {
            //     Object.assign(selectedElement, item.styleOptions);
            //     // this.localVectorDataSource.add(selectedElement);
            //     // item.vectorElement = selectedElement;
            // } else {
            //     item.vectorElement = this.addItemToLayer(item as Item);
            // }
            return item; // return the first one
        } catch (err) {
            showError(err);
        }
    }
    async deleteItem(item: IItem) {
        console.log('deleteItem', item.id, item.properties.id);
        if (item === mapContext.getSelectedItem()) {
            mapContext.unselectItem();
        }
        const index = this.currentLayerFeatures.findIndex((d) => d.id === item.id);
        if (index > -1) {
            this.currentLayerFeatures.splice(index, 1);
            this.currentItems.splice(index, 1);
            this.updateGeoJSONLayer();
        }
        // if (item.vectorElement) {
        //     this.localVectorDataSource.remove(item.vectorElement);
        //     item.vectorElement = null;
        // }
        if (item.id) {
            //     if (item.route && item.route.id) {
            //         await this.routeRepository.delete(item.route);
            //     }
            await this.itemRepository.delete(item as Item);
        }
    }
}
