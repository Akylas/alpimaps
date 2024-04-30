import { Canvas, Rect } from '@nativescript-community/ui-canvas';
import { GenericMapPos, MapBounds } from '@nativescript-community/ui-carto/core';
import { GeoJSONVectorTileDataSource } from '@nativescript-community/ui-carto/datasources';
import { PolygonGeometry } from '@nativescript-community/ui-carto/geometry';
import { VectorTileFeatureCollection } from '@nativescript-community/ui-carto/geometry/feature';
import { GeoJSONGeometryWriter } from '@nativescript-community/ui-carto/geometry/writer';
import { VectorTileEventData, VectorTileLayer, VectorTileRenderOrder } from '@nativescript-community/ui-carto/layers/vector';
import { VectorTileSearchService } from '@nativescript-community/ui-carto/search';
import { CartoMap } from '@nativescript-community/ui-carto/ui';
import { Point, PointStyleBuilder, PointStyleBuilderOptions } from '@nativescript-community/ui-carto/vectorelements/point';
import { getImagePipeline } from '@nativescript-community/ui-image';
import { ShareFile } from '@nativescript-community/ui-share-file';
import { File, Folder, ImageSource, Screen, Utils, knownFolders, path, profile } from '@nativescript/core';
import type { Feature, FeatureCollection, Point as GeometryPoint } from 'geojson';
import SqlQuery from 'kiss-orm/dist/Queries/SqlQuery';
import { get } from 'svelte/store';
import { getBoundsOfDistance, getDistanceSimple, getMetersPerPixel } from '~/helpers/geolib';
import { GroupRepository, IItem, Item, ItemRepository, Route, RouteInstruction, RouteProfile, RouteStats } from '~/models/Item';
import { networkService } from '~/services/NetworkService';
import { showError } from '~/utils/error';
import { JSONtoXML, importGPXToGeojson } from '~/utils/gpx';
import { shareFile } from '~/utils/share';
import { getItemsDataFolder, pick } from '~/utils/utils/index.common';
import { fonts } from '~/variables';
import MapModule, { getMapContext } from './MapModule';
import NSQLDatabase from './NSQLDatabase';
import { clearTimeout, setTimeout } from '~/utils/utils';
const mapContext = getMapContext();

let writer: GeoJSONGeometryWriter<LatLonKeys>;

const TAG = '[ItemsModule]';

// var osmOverpassUrls = [
//     // 'http://this.openstreetmap.fr/oapi/',
//     'http://overpass-api.de/api/',
//     'https://maps.mail.ru/osm/tools/overpass/api/',
//     'https://overpass.openstreetmap.ru/api/',
//     'https://overpass.osm.ch/api/',
//     // 'http://overpass.osm.rambler.ru/cgi/'
// ];
// var index = 0;
function overpassAPIURL() {
    return 'http://overpass-api.de/api/';
    // index = (index + 1) % osmOverpassUrls.length;
    // return osmOverpassUrls[index];
}

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
        DEV_LOG && console.log(TAG, 'onMapReady', !!this.localVectorLayer);
        // if (this.localVectorLayer) {
        //     mapContext.addLayer(this.localVectorLayer, 'items');
        // }
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
            this.getLocalVectorDataSource().addGeoJSONStringFeature(1, { type: 'Feature', id: item.id, properties: item.properties, geometry: item.geometry });
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
        // console.log('updateItem', item.id, index, autoUpdateLayer, item.onMap);
        if (index !== -1) {
            this.currentItems.splice(index, 1, item);
            if (autoUpdateLayer && item.onMap !== 0) {
                this.getLocalVectorDataSource().updateGeoJSONStringFeature(1, { type: 'Feature', id: item.id, properties: item.properties, geometry: item.geometry });
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
        let boundsGeo;
        if (extent) {
            if (typeof extent === 'string') {
                if (extent[0] !== '[') {
                    extent = `[${extent}]` as any;
                }
                extent = JSON.parse(extent as any);
            }
            boundsGeo = new PolygonGeometry<LatLonKeys>({
                poses: [
                    { lat: extent[1], lon: extent[0] },
                    { lat: extent[3], lon: extent[0] },
                    { lat: extent[3], lon: extent[2] },
                    { lat: extent[1], lon: extent[2] }
                ]
            });
        } else {
            const position = getMapContext().getMap().getFocusPos();
            const mpp = getMetersPerPixel(position, mapContext.getMap().getZoom());
            const searchRadius = Math.min(Math.max(mpp * Screen.mainScreen.widthPixels * 2, mpp * Screen.mainScreen.heightPixels * 2), 50000); //meters;
            const bounds = getBoundsOfDistance(position, searchRadius);
            boundsGeo = new PolygonGeometry<LatLonKeys>({
                poses: [bounds.northeast, { lat: bounds.northeast.lat, lon: bounds.southwest.lon }, bounds.southwest, { lat: bounds.southwest.lat, lon: bounds.northeast.lon }]
            });
        }
        const key = ['route_id', 'osmid', 'id'].find((k) => properties.hasOwnProperty(k));
        const featureCollection = await new Promise<VectorTileFeatureCollection>((resolve) =>
            searchService.findFeatures(
                {
                    projection: mapProjection,
                    filterExpression: `${key}='${properties[key]}'`,
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
        const { mdi } = get(fonts);
        let properties = item.properties;
        if (item.route) {
            // console.log('saveItem', properties.route.osmid, item.geometry);
            if (!item.geometry && item.route.osmid) {
                item.geometry = await this.getRoutePositions(item);
                if (!item.geometry) {
                    return item as Item;
                }
            }
        }
        // else {
        properties = item.properties = item.properties || {};
        // TODO: do we always remove it?
        delete item.properties.style;
        if (!item.route) {
            item.properties.style = {
                iconSize: 20,
                fontFamily: mdi,
                mapFontFamily: MATERIAL_MAP_FONT_FAMILY,
                iconDx: -2,
                icon: 'mdi-map-marker'
            };
        }
        const style = (properties.style = properties.style || {});
        style.color = style.color;
        // }

        if (!item.id) {
            const isRoute = !!item.route;
            if (isRoute) {
                item.image_path = this.getItemImagePath();
            }
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
        if (File.exists(item.image_path)) {
            // we need to evict from image cache
            getImagePipeline().evictFromCache(item.image_path);
        }
        mapContext.selectItem({ item, isFeatureInteresting: true, preventZoom: false });
        mapContext.innerDecoder.setStyleParameter('hide_unselected', '1');
        console.log('takeItemPicture');
        return new Promise<void>((resolve) => {
            let done = false;
            const onDone = async () => {
                if (timer) {
                    clearTimeout(timer);
                    timer = null;
                }
                if (done) {
                    return;
                }
                done = true;
                try {
                    DEV_LOG && console.log('takeItemPicture', 'onMapStable');
                    // const startTime = Date.now();
                    const mapView = mapContext.getMap();
                    const image = await mapView.captureRendering(true);
                    DEV_LOG && console.log('takeItemPicture', 'onMapStable1');

                    // restore everyting
                    mapContext.innerDecoder.setStyleParameter('hide_unselected', '0');
                    if (restore) {
                        // console.log('takeItemPicture', 'restore', !!oldItem, mapBounds);
                        if (oldItem) {
                            mapContext.selectItem({ item: oldItem, isFeatureInteresting: true, preventZoom: true });
                        }
                        mapContext.getMap().moveToFitBounds(mapBounds, undefined, true, true, true, 0);
                    }

                    // image.saveToFile(item.image_path, 'jpg');
                    const viewPort = mapContext.getMapViewPort();
                    //we offset a bit to be sure we the whole trace
                    const offset = 20;
                    const left = Math.max(viewPort.left - offset, 0);
                    const top = Math.max(viewPort.top - offset, 0);
                    const width = Math.min(left + viewPort.width + offset, mapView.getMeasuredWidth() - left);
                    const height = Math.min(top + viewPort.height + offset, mapView.getMeasuredHeight() - top);
                    const canvas = new Canvas(width, height);
                    console.log('captureRendering', item.image_path, image.width, image.height, viewPort, canvas.getWidth(), canvas.getHeight());
                    // const actuaWidth = Math.min(width, height);
                    if (__IOS__) {
                        canvas.scale(1, -1,  width / 2, height / 2);
                    }
                    canvas.drawBitmap(image, new Rect(left, top, left + width, top + height), new Rect(0, 0, canvas.getWidth(), canvas.getHeight()), null);
                    new ImageSource(canvas.getImage()).saveToFile(item.image_path, 'jpg');
                    // console.log('saved bitmap', imagePath, Date.now() - startTime, 'ms');
                    canvas.release();
                    resolve();
                } catch (error) {
                    console.error(error, error.stack);
                }
            };
            let timer = setTimeout(onDone, 1500) as any;
            mapContext.onMapStable(onDone, true);
        });
    }

    getItemImagePath() {
        return path.join(this.imagesFolder.path, Date.now() + '.jpg');
    }
    async importGPXFile(link: string) {
        const items = importGPXToGeojson(link);
        for (let index = 0; index < items.length; index++) {
            const item = items[index];
            if (item.route) {
                item.image_path = this.getItemImagePath();
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
            const props = item.properties;
            if (props.mapFontFamily) {
                const filtered = pick(props, 'mapFontFamily', 'fontFamily', 'iconSize', 'iconDx', 'icon', 'color');
                // old style we need to clear it
                props.style = { ...(props.style || {}), ...filtered };
                Object.keys(filtered).forEach((k) => delete props[k]);
            }
            if (typeof item.image === 'string') {
                const image = await ImageSource.fromBase64(item.image);
                delete item.image;
                item.image_path = this.getItemImagePath();
                await image.saveToFileAsync(item.image_path, 'jpg');
            } else if (!item.image_path || !File.exists(dbItem.image_path)) {
                if (item.route) {
                    item.image_path = this.getItemImagePath();
                } else {
                    delete item.image_path;
                }
            }
            dbItem = await this.saveItem(item);
            if (dbItem.groups?.length) {
                await this.itemRepository.setItemGroup(dbItem, dbItem.groups[0]);
            }
            if (dbItem.route && !File.exists(dbItem.image_path)) {
                await this.takeItemPicture(dbItem);
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
            // in case of routes the image will be created on import
            features.push(toShare);
        }

        await shareFile(JSON.stringify({ type: 'FeatureCollection', features } as FeatureCollection), name + '.geojson', {
            // type: 'text/json'
        });
    }
    async shareItemsAsGPX(items: IItem[], name = 'items') {
        // all items are routes!
        const mapBounds = {
            northeast: {
                lat: Number.MAX_SAFE_INTEGER,
                lon: Number.MAX_SAFE_INTEGER
            },
            southwest: {
                lat: -Number.MAX_SAFE_INTEGER,
                lon: -Number.MAX_SAFE_INTEGER
            }
        } as any as MapBounds<LatLonKeys>;
        const tracks = [];
        items.forEach((item) => {
            const bounds = item.properties.zoomBounds;
            if (bounds.northeast.lon < mapBounds.northeast.lon) {
                mapBounds.northeast.lon = bounds.northeast.lon;
            }
            if (bounds.southwest.lon > mapBounds.southwest.lon) {
                mapBounds.southwest.lon = bounds.southwest.lon;
            }
            if (bounds.northeast.lat < mapBounds.northeast.lat) {
                mapBounds.northeast.lat = bounds.northeast.lat;
            }
            if (bounds.southwest.lat > mapBounds.southwest.lat) {
                mapBounds.southwest.lat = bounds.southwest.lat;
            }
            const profile = item.profile?.data;
            tracks.push({
                trkseg: (item.geometry as GeoJSON.LineString).coordinates.map((l, index) => {
                    const trkpt = {
                        trkpt: {
                            _attrs: {
                                lat: Math.round(l[1] * 1000000) / 1000000,
                                lon: Math.round(l[0] * 1000000) / 1000000
                            }
                        }
                    } as any;
                    if (profile) {
                        trkpt.ele = profile?.[index].a;
                        trkpt.grade = profile?.[index].g;
                    }
                    return trkpt;
                })
            });
        });
        const gpx = JSONtoXML({
            gpx: {
                _attrs: {
                    version: '1.1',
                    xmlns: 'http://www.topografix.com/GPX/1/1',
                    'xmlns:xsi': 'http://www.w3.org/2001/XMLSchema-instance',
                    'xsi:schemaLocation':
                        'http://www.topografix.com/GPX/1/1 http://www.topografix.com/GPX/1/1/gpx.xsd http://www.garmin.com/xmlschemas/GpxExtensions/v3 http://www.garmin.com/xmlschemas/GpxExtensionsv3.xsd http://www.garmin.com/xmlschemas/TrackPointExtension/v1 https://www8.garmin.com/xmlschemas/TrackPointExtensionv1.xsd',
                    creator: 'AlpiMaps',
                    'xmlns:gpxx': 'http://www.garmin.com/xmlschemas/GpxExtensions/v3',
                    'xmlns:gpxtpx': 'http://www.garmin.com/xmlschemas/TrackPointExtension/v1'
                },
                metadata: {
                    name,
                    bounds: {
                        minlat: Math.round(mapBounds.southwest.lat * 1000000) / 1000000,
                        minlon: Math.round(mapBounds.southwest.lon * 1000000) / 1000000,
                        maxlat: Math.round(mapBounds.northeast.lat * 1000000) / 1000000,
                        maxlon: Math.round(mapBounds.northeast.lon * 1000000) / 1000000
                    },
                    copyright: {
                        author: 'AlpiMaps',
                        year: 2021
                    }
                },
                trk: tracks
            }
        });
        console.log('gpx', gpx);
        await shareFile(gpx, name + '.gpx', {
            // type: 'text/json'
        });
    }

    async setItemGroup(item: Item, groupName: string) {
        await this.itemRepository.setItemGroup(item, groupName);
        this.notify({ eventName: 'itemChanged', item });
    }
    ignoredOSMKeys = ['source', 'building', 'wall', 'bench', 'shelter_type', 'amenity', 'check_date', 'note', 'comment', 'ele', 'tourism'];

    async getOSMDetails(item: Item, mapZoom?: number) {
        const coordinates = (item.geometry as GeometryPoint).coordinates;
        const distance = mapZoom ? Math.max(14 - mapZoom, 1) * 20 : item.properties.class === 'country' ? 500 : 40;
        const types = ['way', 'node'];
        const data = `[out:json][timeout:25];${types.map((t) => `${t}['name'](around:${distance},${coordinates[1]},${coordinates[0]});out tags;`).join('')}`;
        const results = await networkService.request({
            url: overpassAPIURL() + 'interpreter',
            method: 'GET',
            headers: {
                'Cache-Control': networkService.getCacheControl(60 * 3600 * 24, 60 * 3600 * 24 - 1)
            },
            queryParams: {
                data
            }
        });
        const properties = item.properties;
        const matches = results.elements.filter((e) => e.tags && e.tags.name === properties.name);
        const nb = matches.length;
        if (nb) {
            if (nb === 1) {
                return matches[0];
            }
            // TODO: try to find the one with the same class / subclass
            return matches[0];
        }
        // for (let index = 0; index < results.elements.length; index++) {
        //     const result = results.elements[index];
        //     if (!result.tags) {
        //         continue;
        //     }
        //     // checking the name should be enough
        //     if (result.tags.name === properties.name) {
        //         return result;
        //     }
        // }
    }
    // async getFacebookDetails(item: Item, mapZoom?: number) {
    //     const coordinates = (item.geometry as GeometryPoint).coordinates;
    //     const distance = mapZoom ? Math.max(14 - mapZoom, 1) * 20 : item.properties.class === 'country' ? 500 : 40;
    //     const types = ['node', 'way'];
    //     const result = await networkService.request({
    //         url: 'https://graph.facebook.com/search',
    //         method: 'GET',
    //         queryParams: {
    //             access_token: gVars.FACEBOOK_TOKEN,
    //             fields: 'hours,phone,name,location,cover,about,description,emails,food_styles,restaurant_services,restaurant_specialties,payment_options,link,price_range,website',
    //             type: 'page',
    //             q: item.properties.name,
    //             center: coordinates[1] + ',' + coordinates[0],
    //             distance: 20
    //         }
    //     });
    //     console.log('result', result);
    // }
}
