import { GenericMapPos } from '@nativescript-community/ui-carto/core';
import { GeoJSONVectorTileDataSource } from '@nativescript-community/ui-carto/datasources';
import { PolygonGeometry } from '@nativescript-community/ui-carto/geometry';
import { VectorTileFeatureCollection } from '@nativescript-community/ui-carto/geometry/feature';
import { GeoJSONGeometryWriter } from '@nativescript-community/ui-carto/geometry/writer';
import { VectorTileEventData, VectorTileLayer } from '@nativescript-community/ui-carto/layers/vector';
import { VectorTileSearchService } from '@nativescript-community/ui-carto/search';
import { CartoMap } from '@nativescript-community/ui-carto/ui';
import { Point, PointStyleBuilder, PointStyleBuilderOptions } from '@nativescript-community/ui-carto/vectorelements/point';
import { ShareFile } from '@nativescript-community/ui-share-file';
import { File, Folder, ImageSource, knownFolders, path, profile } from '@nativescript/core';
import type { Feature } from 'geojson';
import { getDistanceSimple } from '~/helpers/geolib';
import { IItem, Item, ItemRepository, Route, RouteInstruction, RouteProfile, RouteStats, toJSONStringified } from '~/models/Item';
import { showError } from '~/utils/error';
import { accentColor } from '~/variables';
import MapModule, { getMapContext } from './MapModule';
import NSQLDatabase from './NSQLDatabase';
import SqlQuery from 'kiss-orm/dist/Queries/SqlQuery';
import { getDataFolder } from '~/utils/utils.common';
const mapContext = getMapContext();

let writer: GeoJSONGeometryWriter<LatLonKeys>;

export interface ItemFeature extends Feature {
    route?: Route;
    profile?: RouteProfile;
    instructions?: RouteInstruction[];
    stats?: RouteStats;
}

declare type Mutable<T extends object> = {
    -readonly [K in keyof T]: T[K];
};
export default class ItemsModule extends MapModule {
    localVectorDataSource: GeoJSONVectorTileDataSource;
    currentLayerFeatures: ItemFeature[] = [];
    currentItems: IItem[] = [];
    localVectorLayer: VectorTileLayer;
    db: NSQLDatabase;
    itemRepository: ItemRepository;

    @profile
    async initDb() {
        try {
            const filePath = path.join(Folder.fromPath(getDataFolder()).getFolder('db').path, 'db.sqlite');
            this.db = new NSQLDatabase(filePath, {
                // for now it breaks
                // threading: true,
                transformBlobs: false
            } as any);
            this.itemRepository = new ItemRepository(this.db);
            await this.itemRepository.createTables();
            const items = await this.itemRepository.searchItem(SqlQuery.createFromTemplateString`"onMap" = 1`);
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
        super.onMapDestroyed();
        this.db && this.db.disconnect();

        if (this.localVectorDataSource) {
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
                simplifyTolerance: 2,
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
    createLocalPoint(position: GenericMapPos<LatLonKeys>, options: PointStyleBuilderOptions) {
        const styleBuilder = new PointStyleBuilder(options);
        return new Point({ position, projection: mapContext.getProjection(), styleBuilder });
    }
    addItemToLayer(item: IItem, autoUpdate = false) {
        this.currentItems.push(item);
        // DEV_LOG && console.log('addItemToLayer', JSON.stringify(item.properties));
        this.currentLayerFeatures.push({ type: 'Feature', id: item.id, properties: item.properties, geometry: item.geometry });
        if (autoUpdate) {
            this.updateGeoJSONLayer();
        }
    }
    getFeature(id: string) {
        return this.currentItems.find((d) => d.properties.id === id);
    }
    updateGeoJSONLayer() {
        this.getOrCreateLocalVectorLayer();
        const str = JSON.stringify({
            type: 'FeatureCollection',
            features: this.currentLayerFeatures
        });
        // DEV_LOG && console.log('updateGeoJSONLayer', str);
        this.localVectorDataSource.setLayerGeoJSONString(1, str);
    }
    addItemsToLayer(items: readonly Item[]) {
        if (items.length > 0) {
            items.forEach((i) => this.addItemToLayer(i), this);
            this.updateGeoJSONLayer();
        }
    }
    async updateItem(item: IItem, data: Partial<IItem>) {
        if (Object.keys(data).length > 0) {
            item = await this.itemRepository.updateItem(item as Item, data);
        }
        const index = this.currentLayerFeatures.findIndex((d) => d.id === item.id);
        if (index !== -1) {
            this.currentItems.splice(index, 1, item);
            // const sProps = {};
            // Object.keys(item.properties).forEach((k) => {
            //     if (typeof item.properties[k] === 'object') {
            //         sProps[k] = JSON.stringify(item.properties[k]);
            //     } else {
            //         sProps[k] = item.properties[k];
            //     }
            // });
            this.currentLayerFeatures.splice(index, 1, { type: 'Feature', id: item.id, properties: item.properties, geometry: item.geometry });
            this.updateGeoJSONLayer();
        }
        return item;
    }
    async shareFile(content: string, fileName: string) {
        const file = knownFolders.temp().getFile(fileName);
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
            minZoom: layer.dataSource.maxZoom,
            maxZoom: layer.dataSource.maxZoom,
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
        // const indexTest = new Array(sorted.length).fill(0).map((value, i) => i);
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
                    // const removed = indexTest.splice(index, 1);
                    // indexTest.splice(indexOther, 0, removed[0]);
                }
            }
        });
        // listCoordinates.forEach((coords, i) => {
        //     // try to find the current sorted one where the end point is the closest to our start point.
        //     const end = coords[coords.length - 1];
        //     let minDist = Number.MAX_SAFE_INTEGER;
        //     let foundNearest;
        //     listCoordinates.forEach((s2, j) => {
        //         if (i === j) {
        //             return;
        //         }
        //         const start = s2[0];
        //         const distance = getDistanceSimple([start[1], start[0]], [end[1], end[0]]);
        //         if (distance < minDist) {
        //             minDist = distance;
        //             foundNearest = s2;
        //         }
        //     });
        //     if (foundNearest) {
        //         const index = sorted.indexOf(foundNearest);
        //         const indexOther = sorted.indexOf(coords);
        //         if (index !== -1) {
        //             sorted.splice(index, 1);
        //             sorted.splice(indexOther + 1, 0, foundNearest);
        //         }
        //     }
        // });
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
            // bbox: extent
        };
    }
    async saveItem(item: Mutable<IItem>, onMap = true) {
        let properties = item.properties;
        if (item.route) {
            // console.log('saveItem', properties.route.osmid, item.geometry);
            if (!item.geometry && item.route.osmid) {
                item.geometry = await this.getRoutePositions(item);
                if (!item.geometry) {
                    return item;
                }
            }
        } else {
            properties = item.properties = item.properties || {};
            properties.color = accentColor.hex;
        }
        if (!item.id) {
            const id = (item.properties.id = item.properties.id || Date.now());
            item = await this.itemRepository.createItem({ ...item, id, onMap: onMap ? 1 : 0 });
        }
        if (onMap) {
            this.addItemToLayer(item, true);
        }
        return item; // return the first one
    }
    async showItem(item: IItem) {
        if (item.onMap === 0) {
            this.updateItem(item, { onMap: 1 });
            this.addItemToLayer(item, true);
        }
    }
    async hideItem(item: IItem) {
        if (item === mapContext.getSelectedItem()) {
            mapContext.unselectItem();
        }
        const index = this.currentLayerFeatures.findIndex((d) => d.id === item.id);
        if (index > -1) {
            this.currentLayerFeatures.splice(index, 1);
            this.currentItems.splice(index, 1);
            this.updateGeoJSONLayer();
        }
        this.updateItem(item, { onMap: 0 });
    }
    async deleteItem(item: IItem) {
        DEV_LOG && console.log('deleteItem', item.id);
        if (item === mapContext.getSelectedItem()) {
            mapContext.unselectItem();
        }
        const index = this.currentLayerFeatures.findIndex((d) => d.id === item.id);
        if (index > -1) {
            this.currentLayerFeatures.splice(index, 1);
            this.currentItems.splice(index, 1);
            this.updateGeoJSONLayer();
        }

        if (item.image_path) {
            File.fromPath(item.image_path).remove();
        }
        if (item.id) {
            await this.itemRepository.delete(item as Item);
        }
    }
    imagesFolder = Folder.fromPath(path.join(getDataFolder(), 'item_images'));
}
