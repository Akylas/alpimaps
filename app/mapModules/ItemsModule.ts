import { GenericMapPos } from '@nativescript-community/ui-carto/core';
import { GeoJSONVectorTileDataSource } from '@nativescript-community/ui-carto/datasources';
import { PolygonGeometry } from '@nativescript-community/ui-carto/geometry';
import { VectorTileFeatureCollection } from '@nativescript-community/ui-carto/geometry/feature';
import { GeoJSONGeometryWriter } from '@nativescript-community/ui-carto/geometry/writer';
import { VectorTileEventData, VectorTileLayer, VectorTileRenderOrder } from '@nativescript-community/ui-carto/layers/vector';
import { VectorTileSearchService } from '@nativescript-community/ui-carto/search';
import { CartoMap } from '@nativescript-community/ui-carto/ui';
import { Point, PointStyleBuilder, PointStyleBuilderOptions } from '@nativescript-community/ui-carto/vectorelements/point';
import { ShareFile } from '@nativescript-community/ui-share-file';
import { File, Folder, ImageSource, knownFolders, path, profile } from '@nativescript/core';
import type { Feature, FeatureCollection } from 'geojson';
import { getDistanceSimple } from '~/helpers/geolib';
import { GroupRepository, IItem, Item, ItemRepository, Route, RouteInstruction, RouteProfile, RouteStats, toJSONStringified } from '~/models/Item';
import { showError } from '~/utils/error';
import { accentColor } from '~/variables';
import MapModule, { getMapContext } from './MapModule';
import NSQLDatabase from './NSQLDatabase';
import SqlQuery from 'kiss-orm/dist/Queries/SqlQuery';
import { getDataFolder, getItemsDataFolder } from '~/utils/utils.common';
import { importGPXToGeojson } from '~/utils/gpx';
import { Canvas, Rect } from '@nativescript-community/ui-canvas';
import { shareFile } from '~/utils/share';
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
    // currentLayerFeatures: ItemFeature[] = [];
    currentItems: IItem[] = [];
    localVectorLayer: VectorTileLayer;
    db: NSQLDatabase;
    itemRepository: ItemRepository;
    groupsRepository: GroupRepository;
    imagesFolder = Folder.fromPath(path.join(getItemsDataFolder(), 'item_images'));

    @profile
    async initDb() {
        try {
            // console.log('initDb0', getItemsDataFolder());
            // let filePath = getItemsDataFolder() + '/db/db.sqlite';
            const filePath = path.join(Folder.fromPath(getItemsDataFolder()).getFolder('db').path, 'db.sqlite');
            // console.log('initDb', filePath);
            // if (filePath.startsWith('content:/') && !filePath.startsWith('content://')) {
            //     filePath = 'content://' + filePath.slice(9);
            // }
            // console.log('initDb2', filePath);
            this.db = new NSQLDatabase(filePath, {
                // for now it breaks
                // threading: true,
                transformBlobs: false
            } as any);
            this.groupsRepository = new GroupRepository(this.db);
            this.itemRepository = new ItemRepository(this.db, this.groupsRepository);
            await this.groupsRepository.createTables();
            await this.itemRepository.createTables();
            this.onDbInitListeners.forEach((l) => l());
            this.onDbInitListeners = [];
            const items = await this.itemRepository.searchItem({ where: SqlQuery.createFromTemplateString`"onMap" = 1` });
            if (items.length > 0) {
                items.forEach((i) => {
                    this.addItemToLayer(i);
                }, this);
                this.setLayerGeoJSONString();
            }
        } catch (err) {
            console.error(err, err.stack);

            showError(err);
        }
    }
    onMapReady(mapView: CartoMap<LatLonKeys>) {
        super.onMapReady(mapView);
        this.initDb();
    }
    onDbInitListeners = [];
    onDbInit(callback) {
        if (this.itemRepository) {
            callback();
        } else {
            this.onDbInitListeners.push(callback);
        }
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
                labelRenderOrder: VectorTileRenderOrder.LAST,
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
        // DEV_LOG && console.log('addItemToLayer', `${item.properties.color}`, JSON.stringify(item.properties));
        // this.currentLayerFeatures.push({ type: 'Feature', id: item.id, properties: item.properties, geometry: item.geometry });
        if (autoUpdate) {
            this.getLocalVectorDataSource().addGeoJSONStringFeature(1, JSON.stringify({ type: 'Feature', id: item.id, properties: item.properties, geometry: item.geometry }));
            // this.updateGeoJSONLayer();
        }
    }
    getFeature(id: string) {
        return this.currentItems.find((d) => d.properties.id === id);
    }
    getLocalVectorDataSource() {
        this.getOrCreateLocalVectorLayer();
        return this.localVectorDataSource;
    }
    setLayerGeoJSONString() {
        this.getOrCreateLocalVectorLayer();
        const str = JSON.stringify({
            type: 'FeatureCollection',
            features: this.currentItems.map((item) => ({ type: 'Feature', id: item.id, properties: item.properties, geometry: item.geometry }))
        });
        // DEV_LOG && console.log('updateGeoJSONLayer', str);
        this.getLocalVectorDataSource().setLayerGeoJSONString(1, str);
    }
    async updateItem(item: IItem, data?: Partial<IItem>, autoUpdateLayer = true) {
        item = await this.itemRepository.updateItem(item as Item, data);
        const index = this.currentItems.findIndex((d) => d.id === item.id);
        console.log('updateItem', item.id, index, autoUpdateLayer, item.onMap);
        if (index !== -1) {
            this.currentItems.splice(index, 1, item);
            if (autoUpdateLayer && item.onMap !== 0) {
                this.getLocalVectorDataSource().updateGeoJSONStringFeature(1, JSON.stringify({ type: 'Feature', id: item.id, properties: item.properties, geometry: item.geometry }));
            }
            if (item.route) {
                this.takeItemPicture(item);
            }
        }
        this.notify({ eventName: 'itemChanged', item });
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
                    return item as Item;
                }
            }
        } else {
            properties = item.properties = item.properties || {};
            const style = (properties.style = properties.style || {});
            style.color = style.color || accentColor.hex;
        }
        if (!item.id) {
            const id = (item.properties.id = Date.now());
            item = await this.itemRepository.createItem({ ...item, id, onMap: onMap ? 1 : 0 });

            if (onMap) {
                this.addItemToLayer(item, true);
            }
        } else {
            item.onMap = onMap ? 1 : 0;
            item = await this.itemRepository.updateItem(item as Item);
            this.notify({ eventName: 'itemChanged', item });
        }
        return item as Item; // return the first one
    }
    async showItem(item: IItem) {
        if (item.onMap === 0) {
            this.updateItem(item, { onMap: 1 }, false);
            this.addItemToLayer(item, true);
        }
    }
    async hideItem(item: IItem) {
        if (item === mapContext.getSelectedItem()) {
            mapContext.unselectItem();
        }
        const index = this.currentItems.findIndex((d) => d.id === item.id);
        if (index > -1) {
            // this.currentLayerFeatures.splice(index, 1);
            this.currentItems.splice(index, 1);
            this.getLocalVectorDataSource().removeGeoJSONFeature(1, item.id);
            // this.updateGeoJSONLayer();
        }
        this.updateItem(item, { onMap: 0 });
    }
    async deleteItem(item: IItem) {
        DEV_LOG && console.log('deleteItem', item.id);
        if (item === mapContext.getSelectedItem()) {
            mapContext.unselectItem();
        }
        const index = this.currentItems.findIndex((d) => d.id === item.id);
        if (index > -1) {
            // this.currentLayerFeatures.splice(index, 1);
            this.currentItems.splice(index, 1);
            this.getLocalVectorDataSource().removeGeoJSONFeature(1, item.id);
            // this.updateGeoJSONLayer();
        }

        if (item.image_path) {
            File.fromPath(item.image_path).remove();
        }
        if (item.id) {
            await this.itemRepository.delete(item as Item);
        }
    }
    async takeItemPicture(item, restore = false) {
        //item needs to be already selected
        // we hide other items before the screenshot
        // and we show theme again after it
        let oldItem;
        let mapBounds;
        if (restore) {
            oldItem = mapContext.getSelectedItem();
            mapBounds = mapContext.getMap().getMapBounds();
        }
        mapContext.selectItem({ item, isFeatureInteresting: true, preventZoom: false });
        mapContext.innerDecoder.setStyleParameter('hide_unselected', '1');
        return new Promise<void>((resolve) => {
            mapContext.onMapStable(async () => {
                try {
                    console.log('takeItemPicture', 'onMapStable');
                    // const startTime = Date.now();
                    const viewPort = mapContext.getMapViewPort();
                    const image = await mapContext.getMap().captureRendering(true);

                    // restore everyting
                    mapContext.innerDecoder.setStyleParameter('hide_unselected', '0');
                    if (restore) {
                        console.log('takeItemPicture', 'restore', !!oldItem, mapBounds);
                        if (oldItem) {
                            mapContext.selectItem({ item: oldItem, isFeatureInteresting: true, preventZoom: true });
                        }
                        mapContext.getMap().moveToFitBounds(mapBounds, undefined, true, true, true, 0);
                    }

                    // image.saveToFile(path.join(itemsModule.imagesFolder.path, Date.now() + '_full.png'), 'png');
                    const canvas = new Canvas(500, 500);
                    // console.log('captureRendering', item.image_path, image.width, image.height, viewPort, canvas.getWidth(), canvas.getHeight());
                    //we offset a bit to be sure we the whole trace
                    const offset = 20;
                    canvas.drawBitmap(
                        image,
                        new Rect(viewPort.left - offset, viewPort.top - offset, viewPort.left + viewPort.width + offset, viewPort.top + viewPort.height + offset),
                        new Rect(0, 0, 500, 500),
                        null
                    );
                    new ImageSource(canvas.getImage()).saveToFile(item.image_path, 'jpg');
                    // console.log('saved bitmap', imagePath, Date.now() - startTime, 'ms');
                    canvas.release();
                    resolve();
                } catch (error) {
                    console.error(error, error.stack);
                }
            }, true);
        });
    }
    async importGPXFile(link: string) {
        const items = importGPXToGeojson(link);
        for (let index = 0; index < items.length; index++) {
            const item = items[index];
            if (item.route) {
                item.image_path = path.join(this.imagesFolder.path, Date.now() + '.jpg');
            }
            const dbItem = await this.saveItem(item);
            await this.itemRepository.setItemGroup(dbItem, dbItem.groups?.[0] || 'gpx');
            mapContext.selectItem({ item: dbItem, isFeatureInteresting: true, peek: true, preventZoom: false, forceZoomOut: true, zoomDuration: 0 });
            if (item.route) {
                await this.takeItemPicture(dbItem);
            }
        }
    }
    async importGeoJSONFile(link: string) {
        // const strData = await File.fromPath(link).read();
        // const str = (new java.lang.String(strData, 'UTF_8')).toString()
        const str = await File.fromPath(link).readText();
        const jsonObj = JSON.parse(str) as FeatureCollection | Feature;
        let featuresToImport = [];
        if (jsonObj.type === 'Feature') {
            featuresToImport.push(jsonObj);
        } else if (jsonObj.type === 'FeatureCollection') {
            featuresToImport = jsonObj.features;
        }
        let dbItem: Item;
        for (let index = 0; index < featuresToImport.length; index++) {
            const item = featuresToImport[index];
            if (typeof item.image === 'string') {
                const image = await ImageSource.fromBase64(item.image);
                delete item.image;
                item.image_path = path.join(this.imagesFolder.path, Date.now() + '.jpg');
                await image.saveToFileAsync(item.image_path, 'jpg');
            }
            dbItem = await this.saveItem(item);
            if (dbItem.groups?.length) {
                await this.itemRepository.setItemGroup(dbItem, dbItem.groups[0]);
            }
            // await this.itemRepository.addGroupToItem(dbItem, 'gpx')
        }
        if (dbItem) {
            mapContext.selectItem({ item: dbItem, isFeatureInteresting: true, peek: true, preventZoom: false, forceZoomOut: true, zoomDuration: 0 });
        }
    }
    async shareItemsAsGeoJSON(items: IItem[], name = 'items') {
        const features = [];
        for (let index = 0; index < items.length; index++) {
            const item = items[index];
            const { id, image_path, onMap, ...toShare } = item;
            const itemIsRoute = !!item.route;
            toShare.type = 'Feature';
            if (!itemIsRoute && image_path) {
                toShare['image'] = await (await ImageSource.fromFile(image_path)).toBase64StringAsync('jpg');
            }
            features.push(toShare);
        }

        await shareFile(JSON.stringify({ type: 'FeatureCollection', features } as FeatureCollection), name + '.geojson', {
            // type: 'text/json'
        });
    }

    async setItemGroup(item: Item, groupName: string) {
        await this.itemRepository.setItemGroup(item, groupName);
        this.notify({ eventName: 'itemChanged', item });
    }
}
