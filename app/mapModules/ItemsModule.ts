import { GenericMapPos } from '@nativescript-community/ui-carto/core';
import { GeoJSONVectorTileDataSource } from '@nativescript-community/ui-carto/datasources';
import { PolygonGeometry } from '@nativescript-community/ui-carto/geometry';
import { VectorTileFeatureCollection } from '@nativescript-community/ui-carto/geometry/feature';
import { GeoJSONGeometryWriter } from '@nativescript-community/ui-carto/geometry/writer';
import { VectorTileEventData, VectorTileLayer } from '@nativescript-community/ui-carto/layers/vector';
import { VectorTileSearchService } from '@nativescript-community/ui-carto/search';
import { CartoMap } from '@nativescript-community/ui-carto/ui';
import { LineStyleBuilderOptions } from '@nativescript-community/ui-carto/vectorelements/line';
import { MarkerStyleBuilderOptions } from '@nativescript-community/ui-carto/vectorelements/marker';
import { Point, PointStyleBuilder, PointStyleBuilderOptions } from '@nativescript-community/ui-carto/vectorelements/point';
import { ShareFile } from '@nativescript-community/ui-share-file';
import { knownFolders, path, profile } from '@nativescript/core';
import type { Feature } from 'geojson';
import { getDistanceSimple } from '~/helpers/geolib';
import { IItem, Item, ItemProperties, ItemRepository } from '~/models/Item';
import { showError } from '~/utils/error';
import MapModule, { getMapContext } from './MapModule';
import NSQLDatabase from './NSQLDatabase';
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

    @profile
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
            console.error(err, err.stack);

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
        // this.getOrCreateLocalVectorLayer();
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
        if (items.length > 0) {
            items.forEach((i) => this.addItemToLayer(i), this);
            this.updateGeoJSONLayer();
        }
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
        const projection = layer.dataSource.getProjection();
        const mapProjection = mapContext.getProjection();
        const searchService = new VectorTileSearchService({
            minZoom: 14,
            maxZoom: 14,
            layer
        });
        let extent: [number, number, number, number] = item.properties.extent as any;
        if (typeof extent === 'string') {
            if (extent[0] !== '[') {
                extent = `[${extent}]` as any;
            }
            extent = JSON.parse(extent as any);
        }
        const boundsGeo = new PolygonGeometry<LatLonKeys>({
            poses: [
                { lat: extent[1], lon: extent[0] },
                { lat: extent[3], lon: extent[0] },
                { lat: extent[3], lon: extent[2] },
                { lat: extent[1], lon: extent[2] }
            ]
        });
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
        const count = featureCollection.getFeatureCount();
        if (count === 0) {
            return null;
        }
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
        features.forEach((f, i) => {
            if (f.geometry.type === 'MultiLineString') {
                listCoordinates.push(...f.geometry.coordinates);
            } else {
                listCoordinates.push(f.geometry.coordinates);
            }
        });
        // const test = join_em(listCoordinates);
        const sorted = listCoordinates.slice();
        const indexTest = new Array(sorted.length).fill(0).map((value, i) => i);
        listCoordinates.forEach((coords, i) => {
            // try to find the current sorted one where the end point is the closest to our start point.
            const start = coords[0];
            let minDist = Number.MAX_SAFE_INTEGER;
            let foundNearest;
            listCoordinates.forEach((s2, j) => {
                if (i === j) {
                    return;
                }
                const end = s2[s2.length - 1];
                const distance = getDistanceSimple([start[1], start[0]], [end[1], end[0]]);
                if (distance < minDist) {
                    minDist = distance;
                    foundNearest = s2;
                }
            });
            if (foundNearest) {
                const index = sorted.indexOf(foundNearest);
                const indexOther = sorted.indexOf(coords);
                if (index !== -1) {
                    sorted.splice(index, 1);
                    sorted.splice(indexOther, 0, foundNearest);
                    const removed = indexTest.splice(index, 1);
                    indexTest.splice(indexOther, 0, removed[0]);
                }
            }
        });
        listCoordinates.forEach((coords, i) => {
            // try to find the current sorted one where the end point is the closest to our start point.
            const end = coords[coords.length - 1];
            let minDist = Number.MAX_SAFE_INTEGER;
            let foundNearest;
            listCoordinates.forEach((s2, j) => {
                if (i === j) {
                    return;
                }
                const start = s2[0];
                const distance = getDistanceSimple([start[1], start[0]], [end[1], end[0]]);
                if (distance < minDist) {
                    minDist = distance;
                    foundNearest = s2;
                }
            });
            if (foundNearest) {
                const index = sorted.indexOf(foundNearest);
                const indexOther = sorted.indexOf(coords);
                if (index !== -1) {
                    sorted.splice(index, 1);
                    sorted.splice(indexOther + 1, 0, foundNearest);
                }
            }
        });
        // console.log(
        //     'test2',
        //     indexTest,
        //     sorted.map((s, i) => {
        //         if (i < sorted.length - 1) {
        //             const start = sorted[i][sorted[i].length - 1];
        //             const end = sorted[i + 1][0];
        //             return getDistanceSimple([start[1], start[0]], [end[1], end[0]]);
        //         }
        //         return 0;
        //     })
        // );

        return {
            type: 'LineString' as any,
            coordinates: sorted.flat()
        };
    }
    async saveItem(item: Mutable<IItem>, styleOptions?: MarkerStyleBuilderOptions | PointStyleBuilderOptions | LineStyleBuilderOptions) {
        try {
            const properties = item.properties;
            if (properties?.route) {
                if (!item.geometry && properties.route.osmid) {
                    item.geometry = await this.getRoutePositions(item);
                    if (!item.geometry) {
                        return item;
                    }
                }
            }
            if (!item.id) {
                const id = item.properties.id || Date.now();
                item.properties.id = id;
                item = await this.itemRepository.createItem({ ...item, id });
            }
            this.addItemToLayer(item, true);
            return item; // return the first one
        } catch (err) {
            showError(err);
        }
    }
    async deleteItem(item: IItem) {
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
