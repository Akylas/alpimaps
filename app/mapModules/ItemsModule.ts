import { shareFile } from '@akylas/nativescript-app-utils/share';
import type { MassifLayer, MassifMap, MassifObject, MassifSource } from '@nativescript-community/ui-massifmaps/api';
import { getImagePipeline } from '@nativescript-community/ui-image';
import { ShareFile } from '@nativescript-community/ui-share-file';
import { ApplicationSettings, File, Folder, ImageSource, Screen, knownFolders, path, profile } from '@nativescript/core';
import { showError } from '@shared/utils/showError';
import type { Feature, FeatureCollection, Point as GeometryPoint, LineString } from 'geojson';
import SqlQuery from 'kiss-orm/dist/Queries/SqlQuery';
import { get } from 'svelte/store';

import { osmicon } from '~/helpers/formatter';
import { getCachedOSMElement, osmElementTypes, osmItemKey, setCachedOSMElement, updateOSMDetailsState } from '~/helpers/osmDetails';
import { formatter } from '~/mapModules/ItemFormatter';

import { lc } from '@nativescript-community/l';
import NSQLDatabase from '@shared/db/NSQLDatabase';
import { getBoundsOfDistance, getDistanceSimple, getMetersPerPixel } from '~/helpers/geolib';
import { GroupRepository, IItem, Item, ItemRepository, Route, RouteInstruction, RouteProfile, RouteStats } from '~/models/Item';
import { maxAgeMonth, networkService } from '~/services/NetworkService';
import { JSONtoXML, importGPXToGeojson } from '~/utils/gpx';
import { showSnack } from '~/utils/ui';
import { clearTimeout, getItemsDataFolder, pick, setTimeout } from '~/utils/utils';
import { fonts } from '~/variables';
import MapModule, { getMapContext } from './MapModule';
import { type MapPos, fromBounds, fromPosition, toPosition } from '~/utils/geo';
const mapContext = getMapContext();

/** registry ids must be unique */
let localPointId = 0;

function ring(corners: [number, number][]): GeoJSON.Polygon {
    return { type: 'Polygon', coordinates: [[...corners, corners[0]]] };
}

const TAG = '[ItemsModule]';

// tried in order: the next one starts when the previous failed or is still silent after the hedge delay
const overpassEndpoints = ['https://overpass-api.de/api/interpreter', 'https://overpass.private.coffee/api/interpreter', 'https://overpass.openstreetmap.fr/api/interpreter'];
const OVERPASS_HEDGE_DELAY = 1500;
const OVERPASS_MIN_INTERVAL = 300;
const OSM_DETAILS_CACHE_SIZE = 100;

interface OverpassElement {
    type: string;
    id: number;
    lat?: number;
    lon?: number;
    center?: { lat: number; lon: number };
    tags?: Record<string, string>;
}

let lastOverpassStart = 0;
let overpassRequestCount = 0;
async function waitOverpassTurn() {
    const now = Date.now();
    const startAt = Math.max(now, lastOverpassStart + OVERPASS_MIN_INTERVAL);
    lastOverpassStart = startAt;
    if (startAt > now) {
        await new Promise((resolve) => setTimeout(resolve, startAt - now));
    }
}

async function overpassRequest(data: string, force: boolean) {
    await waitOverpassTurn();
    const headers = {
        'Cache-Control': networkService.getCacheControl(maxAgeMonth, maxAgeMonth - 1, force),
        'User-Agent': __APP_ID__
    };
    const requestId = ++overpassRequestCount;
    const tags: string[] = [];
    return new Promise<{ elements: OverpassElement[] }>((resolve, reject) => {
        let nextIndex = 0;
        let pending = 0;
        let settled = false;
        let lastError;
        let hedgeTimer;
        const startNext = () => {
            clearTimeout(hedgeTimer);
            if (settled || nextIndex >= overpassEndpoints.length) {
                return;
            }
            const tag = `overpass_${requestId}_${nextIndex}`;
            tags.push(tag);
            pending++;
            networkService
                .request({ url: overpassEndpoints[nextIndex++], method: 'GET', tag, headers, queryParams: { data } })
                .then((result) => {
                    if (!Array.isArray(result?.elements) || /runtime error/.test(result.remark ?? '')) {
                        throw new Error('invalid overpass response');
                    }
                    return result;
                })
                .then(
                    (result) => {
                        if (!settled) {
                            settled = true;
                            clearTimeout(hedgeTimer);
                            networkService.clearRequests(...tags.filter((t) => t !== tag));
                            resolve(result);
                        }
                    },
                    (error) => {
                        pending--;
                        lastError = error;
                        if (settled) {
                            return;
                        }
                        if (nextIndex < overpassEndpoints.length) {
                            startNext();
                        } else if (pending === 0) {
                            settled = true;
                            reject(lastError);
                        }
                    }
                );
            if (nextIndex < overpassEndpoints.length) {
                hedgeTimer = setTimeout(startNext, OVERPASS_HEDGE_DELAY);
            }
        };
        startNext();
    });
}

function escapeOverpassString(value: string) {
    return value.replace(/\\/g, '\\\\').replace(/"/g, '\\"').replace(/\n/g, '\\n');
}

const osmDetailsCache = new Map<string, Promise<OverpassElement | undefined>>();

/** what an OSM element adds to an item's properties, and when it was read */
export interface OSMItemDetails {
    properties: Record<string, any>;
    fetchedAt: number;
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
    localVectorDataSource: MassifSource<'massif::GeoJSONVectorTileDataSource'>;
    // currentLayerFeatures: ItemFeature[] = [];
    currentItems: IItem[] = [];
    localVectorLayer: MassifLayer<'massif::VectorTileLayer'>;
    db: NSQLDatabase;
    itemRepository: ItemRepository;
    groupsRepository: GroupRepository;
    imagesFolder = Folder.fromPath(path.join(getItemsDataFolder(), 'item_images'));
    dbInitialized = false;
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
            try {
                await this.db.migrate(Object.assign({}, this.groupsRepository.migrations, this.itemRepository.migrations));
            } catch (error) {
                console.error('error applying migrations', error.stack);
            }

            this.dbInitialized = true;
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
    onMapReady(map: MassifMap) {
        super.onMapReady(map);
        DEV_LOG && console.log(TAG, 'onMapReady', !!this.localVectorLayer);
        // if (this.localVectorLayer) {
        //     mapContext.addLayer(this.localVectorLayer, 'items');
        // }
        this.initDb();
    }
    onDbInitListeners = [];
    onDbInit(callback) {
        if (this.dbInitialized) {
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
            // destroying the object drops its subscriptions with it
            this.localVectorLayer.destroy();
            this.localVectorLayer = null;
        }
    }
    updateLocalLayer() {
        DEV_LOG && console.log('updateLocalLayer');
        const oldLayer = this.localVectorLayer;
        this.localVectorLayer = null;
        this.getOrCreateLocalVectorLayer(false);
        mapContext.replaceLayer(oldLayer, this.localVectorLayer);
    }
    getOrCreateLocalVectorLayer(add = true) {
        if (!this.localVectorLayer) {
            const map = mapContext.getMap();
            if (!this.localVectorDataSource) {
                this.localVectorDataSource = map.source('source.items', { type: 'geojson', simplifyTolerance: 2, minZoom: 0, maxZoom: 24 });
                this.localVectorDataSource.createLayer('items');
                this.localVectorDataSource.createLayer('poi');
            }
            this.localVectorLayer = map.buildLayer('layer.items', {
                type: 'vector',
                source: this.localVectorDataSource.id,
                style: mapContext.innerDecoder.id,
                labelBlendingSpeed: 0,
                layerBlendingSpeed: 0,
                labelRenderOrder: 'VECTOR_TILE_RENDER_ORDER_LAST',
                clickRadius: ApplicationSettings.getNumber('route_click_radius', 16)
            });
            this.localVectorLayer.onFeatureClick((e) => {
                e.consumed = mapContext.vectorTileElementClicked(mapContext.featureClickData(e));
            });
            if (add) {
                mapContext.addLayer(this.localVectorLayer, 'items');
            }
        }
    }
    setVisibility(value: boolean) {
        this.localVectorLayer?.visible(value);
    }
    addItemToLayer(item: IItem, autoUpdate = false) {
        this.currentItems.push(item);
        // DEV_LOG && console.log('addItemToLayer', `${item.properties.color}`, JSON.stringify(item.properties));
        // this.currentLayerFeatures.push({ type: 'Feature', id: item.id, properties: item.properties, geometry: item.geometry });
        if (autoUpdate) {
            this.getLocalVectorDataSource().addFeature(1, { type: 'Feature', id: item.id, properties: item.properties, geometry: item.geometry });
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
        // DEV_LOG && console.log('updateGeoJSONLayer', str);
        this.getLocalVectorDataSource().setGeoJSON(1, {
            type: 'FeatureCollection',
            features: this.currentItems.map((item) => ({ type: 'Feature', id: item.id, properties: item.properties, geometry: item.geometry }))
        });
    }
    async updateItem(item: IItem, data?: Partial<IItem>, autoUpdateLayer = true, updatePicture = true) {
        item = await this.itemRepository.updateItem(item as Item, data);
        const index = this.currentItems.findIndex((d) => d.id === item.id);
        // console.log('updateItem', item.id, index, autoUpdateLayer, item.onMap);
        if (index !== -1) {
            this.currentItems.splice(index, 1, item);
            if (autoUpdateLayer && item.onMap !== 0) {
                this.getLocalVectorDataSource().updateFeature(1, { type: 'Feature', id: item.id, properties: item.properties, geometry: item.geometry });
            }
            if (item.route && updatePicture) {
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
    /**
     * A route in vector tiles is split into many features (per tile): find them all by id and stitch
     * them. The search is bounded by the route extent or the screen, else it scans the world.
     */
    async getRoutePositions(item: IItem) {
        const layer = item.layer;
        const properties = item.properties;
        const source = layer.child('dataSource');
        const maxZoom = source.get('maxZoom') as number;
        const searchService = mapContext.getMap().object('search', 'search.routePositions', {
            type: 'vectortile',
            layer: layer.id,
            minZoom: maxZoom,
            maxZoom
        });
        let extent: [number, number, number, number] = item.properties.extent as any;
        let boundsGeoJSON: GeoJSON.Polygon;
        if (extent) {
            if (typeof extent === 'string') {
                if (extent[0] !== '[') {
                    extent = `[${extent}]` as any;
                }
                extent = JSON.parse(extent as any);
            }
            boundsGeoJSON = ring([
                [extent[0], extent[1]],
                [extent[0], extent[3]],
                [extent[2], extent[3]],
                [extent[2], extent[1]]
            ]);
        } else {
            const camera = mapContext.getMap().camera();
            const position = fromPosition(camera.position());
            const mpp = getMetersPerPixel(position, camera.zoom());
            const searchRadius = Math.min(Math.max(mpp * Screen.mainScreen.widthPixels * 2, mpp * Screen.mainScreen.heightPixels * 2), 50000); //meters;
            const bounds = getBoundsOfDistance(position, searchRadius);
            boundsGeoJSON = ring([
                [bounds.northeast.lon, bounds.northeast.lat],
                [bounds.southwest.lon, bounds.northeast.lat],
                [bounds.southwest.lon, bounds.southwest.lat],
                [bounds.northeast.lon, bounds.southwest.lat]
            ]);
        }
        const key = ['route_id', 'osmid', 'id'].find((k) => properties.hasOwnProperty(k));
        const request = mapContext.getMap().object('search', `search.request.route.${++localPointId}`, {
            type: 'request',
            filterExpression: `${key}='${properties[key]}'`,
            geometry: { type: 'geojson', geojson: boundsGeoJSON }
        });
        // One geometry per feature, read while the result is alive: the collection dies with the
        // delivery, so nothing here can hand it back.
        const geometries = (await searchService.callAsync('findFeatures', [request.handle], ((collection) =>
            collection.collect((feature) => feature.get('geometryGeoJSON'))))) as unknown as string[];
        request.destroy();
        source.destroy();
        if (!geometries?.length) {
            return null;
        }
        const geojson = { features: geometries.map((geometry) => ({ type: 'Feature', geometry: JSON.parse(geometry) })) } as GeoJSON.FeatureCollection<
            GeoJSON.LineString | GeoJSON.MultiLineString
        >;
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
                fontFamily: mdi,
                mapFontFamily: MATERIAL_MAP_FONT_FAMILY,
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
        return item as Item;
    }
    async showItem(item: IItem) {
        if (item.onMap === 0) {
            await this.updateItem(item, { onMap: 1 }, false, false);
            this.addItemToLayer(item, true);
        }
    }
    onItemSelected(item: IItem) {
        const startTime = Date.now();
        if (item?.route) {
            const features = [];
            if (item.route.waypoints?.length > 0) {
                DEV_LOG && console.log('waypoints', JSON.stringify(item.route.waypoints));
                item.route.waypoints.forEach((p) => {
                    if (p.properties.showOnMap) {
                        features.push({
                            geometry: p.geometry,
                            type: 'Feature',
                            properties: {
                                ...p.properties,
                                class: 'waypoint',
                                icon: p.properties.style?.icon ?? osmicon(formatter.geItemIcon(p), true)
                            }
                        });
                    }
                });
            }
            if (item.route.steps?.length > 0) {
                features.push(
                    ...item.route.steps.map((p) => ({
                        geometry: p.geometry,
                        type: 'Feature',
                        properties: {
                            class: 'step',
                            distFromStart: p.distFromStart,
                            distToEnd: p.distToEnd,
                            level: p.level,
                            distFromStartStr: p.distFromStartStr,
                            distToEndStr: p.distToEndStr
                        }
                    }))
                );
            }
            if (item.profile?.ascents?.length > 0) {
                const positions = item.geometry?.['coordinates'];
                item.profile.ascents.forEach((a) => {
                    const actualIndex = Math.max(0, Math.min(a.highestPointIndex, positions.length - 1));
                    const position = positions[actualIndex];
                    features.push({
                        geometry: {
                            type: 'Point',
                            coordinates: position
                        },
                        type: 'Feature',
                        properties: {
                            class: 'waypoint',
                            icon: '',
                            iconSize: 10,
                            iconDx: 0.5,
                            iconDy: -1
                        }
                    });
                });
            }
            // DEV_LOG && console.log('updategeojson1', Date.now() - startTime, item.route.steps?.length);
            const data = { type: 'FeatureCollection', features };
            this.getLocalVectorDataSource().setGeoJSON(2, data);
            // DEV_LOG && console.log('updategeojson2', Date.now() - startTime, JSON.stringify(data));
        } else {
            this.getLocalVectorDataSource().setGeoJSON(2, { type: 'FeatureCollection', features: [] });
        }
    }
    async hideItem(item: IItem) {
        if (item === mapContext.getSelectedItem()) {
            mapContext.unselectItem(true, true);
        }
        const index = this.currentItems.findIndex((d) => d.id === item.id);
        if (index > -1) {
            // this.currentLayerFeatures.splice(index, 1);
            this.currentItems.splice(index, 1);
            this.getLocalVectorDataSource().removeFeature(1, item.id);
            // this.updateGeoJSONLayer();
        }
        return this.updateItem(item, { onMap: 0 }, false, false);
    }
    async deleteItem(item: IItem) {
        DEV_LOG && console.log('deleteItem', item.id);
        if (item === mapContext.getSelectedItem()) {
            mapContext.unselectItem(true, true);
        }
        const index = this.currentItems.findIndex((d) => d.id === item.id);
        if (index > -1) {
            // this.currentLayerFeatures.splice(index, 1);
            this.currentItems.splice(index, 1);
            this.getLocalVectorDataSource().removeFeature(1, item.id);
            // this.updateGeoJSONLayer();
        }

        if (item.image_path && File.exists(item.image_path)) {
            File.fromPath(item.image_path).remove();
        }
        if (item.id) {
            await this.itemRepository.delete(item as Item);
        }
    }
    async takeItemPicture(item: IItem, restore = false) {
        if (!item.route || !ApplicationSettings.getBoolean('route_image_capture', false)) {
            return;
        }
        // console.log('takeItemPicture', new Error().stack);
        let oldItem;
        let mapBounds;
        if (restore) {
            oldItem = mapContext.getSelectedItem();
            mapBounds = mapContext.getMap().camera().bounds();
        }
        if (item.image_path && File.exists(item.image_path)) {
            getImagePipeline().evictFromCache(item.image_path);
        }
        return new Promise<void>((resolve) => {
            let done = false;
            const map = mapContext.getMap();
            mapContext.innerDecoder.call('setStyleParameter', 'hide_unselected', '1');
            mapContext.selectItem({ item, isFeatureInteresting: true, preventZoom: false });
            const onDone = async () => {
                if (timer) {
                    clearTimeout(timer);
                    timer = null;
                }
                if (done) {
                    return;
                }
                done = true;
                let image: ImageSource;
                let canvasImage: ImageSource;
                try {
                    // DEV_LOG && console.log('takeItemPicture', 'onMapStable');
                    // const startTime = Date.now();
                    image = await map.capture(true);
                    // DEV_LOG && console.log('takeItemPicture', 'onMapStable1');
                    image.saveToFile(item.image_path, 'jpg');
                    mapContext.innerDecoder.call('setStyleParameter', 'hide_unselected', '0');
                    if (restore) {
                        if (oldItem) {
                            mapContext.selectItem({ item: oldItem, isFeatureInteresting: true, preventZoom: true });
                        }
                        map.camera().fitBounds(mapBounds, { integerZoom: true, resetRotation: true, resetTilt: true });
                    }
                    resolve();
                } catch (error) {
                    console.error(error, error.stack);
                } finally {
                    if (__ANDROID__) {
                        image?.android.recycle();
                        canvasImage?.android.recycle();
                    }
                }
            };
            let timer = setTimeout(onDone, 1500) as any;
            // once: the screenshot is taken the first time the camera settles, not on every later one
            mapContext.getMap().once('map.stable', onDone);
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
            ['groups', 'profile', 'type', 'creation_date', 'instructions'].forEach((k) => {
                if (props[k]) {
                    item[k] = props[k];
                    delete props[k];
                }
            });
            if (props.route) {
                item.route = props.route;
            }
            if (props.mapFontFamily) {
                const filtered = pick(props, 'mapFontFamily', 'fontFamily', 'iconSize', 'iconDx', 'icon', 'color');
                // old style we need to clear it
                props.style = { ...(props.style || {}), ...filtered };
                Object.keys(filtered).forEach((k) => delete props[k]);
            }
            if (typeof props.image === 'string') {
                const image = await ImageSource.fromBase64(props.image);
                delete props.image;
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
    async itemsAsGeoJSON(items: IItem[]) {
        const features = [];
        for (let index = 0; index < items.length; index++) {
            const item = items[index];
            // const { id, image_path, profile, layer, onMap, ...toShare } = item;

            const itemIsRoute = !!item.route;
            const toShare = {
                type: 'Feature',
                properties: {
                    ...item.properties,
                    stats: item.stats,
                    type: item.type,
                    instructions: item.instructions,
                    groups: item.groups,
                    route: item.route,
                    profile: item.profile
                },
                geometry: item.geometry
            };
            toShare.type = 'Feature';
            if (itemIsRoute && item.profile) {
                (item.geometry as LineString).coordinates.forEach((c, index) => {
                    const d = item.profile.data[index];
                    if (c.length === 2) {
                        c.push(d.a);
                    }
                });
            }
            DEV_LOG && console.log('shareItemsAsGeoJSON', JSON.stringify(toShare));
            // in case of routes the image will be created on import
            if (!itemIsRoute && item.image_path) {
                toShare.properties['image'] = await (await ImageSource.fromFile(item.image_path)).toBase64StringAsync('jpg');
            }
            features.push(toShare);
        }
        return { type: 'FeatureCollection', features } as FeatureCollection;
    }
    async itemsAsGPX(items: IItem[], name = 'items') {
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
        } as any as IMapBounds;
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
                        trkpt.trkpt.ele = profile?.[index].a;
                        trkpt.trkpt.grade = profile?.[index].g;
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
        return gpx;
    }

    async shareItemsAsGeoJSON(items: IItem[], name = 'items') {
        return shareFile(JSON.stringify(await this.itemsAsGeoJSON(items)), name + '.geojson', {
            // type: 'text/json'
        });
    }
    async exportItemsAsGeoJSON(items: IItem[], name = 'items') {
        const exportPath = __ANDROID__ ? android.os.Environment.getExternalStoragePublicDirectory(android.os.Environment.DIRECTORY_DOWNLOADS).getAbsolutePath() : knownFolders.externalDocuments().path;
        const filePath = path.join(exportPath, name + '.geojson');
        await File.fromPath(path.join(exportPath, name + '.geojson')).writeText(JSON.stringify(await this.itemsAsGeoJSON(items)));
        return showSnack({ message: lc('saved', filePath) });
    }
    async shareItemsAsGPX(items: IItem[], name = 'items') {
        await shareFile(await this.itemsAsGPX(items, name), name + '.gpx', {
            // type: 'text/json'
        });
    }
    async exportItemsAsGPX(items: IItem[], name = 'items') {
        const exportPath = __ANDROID__ ? android.os.Environment.getExternalStoragePublicDirectory(android.os.Environment.DIRECTORY_DOWNLOADS).getAbsolutePath() : knownFolders.externalDocuments().path;
        const filePath = path.join(exportPath, name + '.gpx');
        await File.fromPath(filePath).writeText(await this.itemsAsGPX(items));
        return showSnack({ message: lc('saved', filePath) });
    }

    async setItemGroup(item: Item, groupName: string) {
        await this.itemRepository.setItemGroup(item, groupName);
        this.notify({ eventName: 'itemChanged', item });
    }
    ignoredOSMKeys = ['source', 'building', 'wall', 'bench', 'shelter_type', 'amenity', 'check_date', 'note', 'comment', 'ele', 'tourism'];

    async getOSMDetails(item: Item, mapZoom?: number, force = false) {
        const properties = item.properties;
        const coordinates = (item.geometry as GeometryPoint).coordinates;
        const distance = mapZoom ? Math.max(14 - mapZoom, 1) * 20 : properties.class === 'country' ? 500 : 40;
        const osmType = osmElementTypes[properties.osm_type];
        const osmId = /^\d+$/.test(String(properties.osm_id)) ? properties.osm_id : undefined;
        const key = osmType && osmId ? `${osmType}/${osmId}` : `${coordinates[1]},${coordinates[0]},${distance},${properties.name}`;
        let promise = force ? undefined : osmDetailsCache.get(key);
        if (!promise) {
            promise = this.fetchOSMElement(item, coordinates, distance, force, osmType && osmId ? `${osmType}(${osmId});out tags center;` : undefined);
            osmDetailsCache.set(key, promise);
            if (osmDetailsCache.size > OSM_DETAILS_CACHE_SIZE) {
                const [oldest] = osmDetailsCache.keys();
                osmDetailsCache.delete(oldest);
            }
            const created = promise;
            created.catch(() => {
                if (osmDetailsCache.get(key) === created) {
                    osmDetailsCache.delete(key);
                }
            });
        }
        const result = await promise;
        if (properties.int_name) {
            properties.name_int = properties.int_name;
            delete properties.int_name;
        }
        return result;
    }

    /** the item's properties an OSM element completes */
    osmElementProperties(item: IItem, element: { id: number; tags?: Record<string, string> }) {
        const properties: Record<string, any> = {};
        for (const [key, value] of Object.entries(element.tags ?? {})) {
            if (!key.startsWith('addr:') && !this.ignoredOSMKeys.includes(key) && value !== item.properties?.class) {
                properties[key] = value;
            }
        }
        properties.osmid = element.id;
        return properties;
    }

    /** getOSMDetails, with the lookup state for the views and the saved copy for offline */
    async fetchOSMDetails(item: Item, mapZoom?: number, force = false): Promise<OSMItemDetails | undefined> {
        const key = osmItemKey(item);
        updateOSMDetailsState(key, { loading: true });
        try {
            const element = await this.getOSMDetails(item, mapZoom, force);
            if (!element?.tags) {
                updateOSMDetailsState(key, { loading: false, missed: true });
                return;
            }
            const fetchedAt = Date.now();
            updateOSMDetailsState(key, { loading: false, missed: !element.tags.opening_hours, fetchedAt });
            if (!item.route) {
                setCachedOSMElement(key, { id: element.id, type: element.type, tags: element.tags, fetchedAt });
            }
            return { properties: this.osmElementProperties(item, element), fetchedAt };
        } catch (error) {
            updateOSMDetailsState(key, { loading: false, missed: true });
            throw error;
        }
    }

    async getCachedOSMDetails(item: IItem): Promise<OSMItemDetails | undefined> {
        const key = osmItemKey(item);
        const entry = await getCachedOSMElement(key);
        if (entry) {
            updateOSMDetailsState(key, { missed: !entry.tags.opening_hours, fetchedAt: entry.fetchedAt });
            return { properties: this.osmElementProperties(item, entry), fetchedAt: entry.fetchedAt };
        }
    }

    /** puts `properties` in the selected item when it is `item`, and in its saved copy, so every view of it updates */
    async mergeSelectedItemProperties(item: IItem, properties: Record<string, any>) {
        const selected = mapContext.getSelectedItem();
        if (!selected || selected.geometry !== item.geometry) {
            return false;
        }
        mapContext.setSelectedItem(selected, properties);
        if (selected.id) {
            await this.updateItem(selected, { properties: { ...properties } }, false, false);
        }
        return true;
    }

    /** fetches the details of the selected item and merges them in it */
    async loadOSMDetails(item: Item, force = false) {
        const details = await this.fetchOSMDetails(item, mapContext.getMap().camera().zoom(), force);
        if (details) {
            await this.mergeSelectedItemProperties(item, details.properties);
        }
        return details;
    }

    private async fetchOSMElement(item: Item, coordinates: number[], distance: number, force: boolean, idStatement?: string) {
        if (idStatement) {
            const { elements } = await overpassRequest(`[out:json][timeout:10];${idStatement}`, force);
            const element = elements.find((e) => e.tags);
            if (element) {
                return element;
            }
        }
        const name = item.properties.name;
        const around = `(around:${distance},${coordinates[1]},${coordinates[0]})`;
        const nameFilter = name ? `="${escapeOverpassString(name)}"` : '';
        const data = `[out:json][timeout:10];${['way', 'node'].map((type) => `${type}["name"${nameFilter}]${around};out tags center;`).join('')}`;
        const { elements } = await overpassRequest(data, force);
        const matches = name
            ? elements.filter((e) => e.tags && e.tags.name === name)
            : elements
                  .filter((e) => e.tags)
                  .sort((a, b) => getDistanceSimple(a.center || a, coordinates) - getDistanceSimple(b.center || b, coordinates))
                  .sort((a, b) => (a.type === b.type ? 0 : a.type === 'node' ? -1 : 1));
        // TODO: try to find the one with the same class / subclass
        return matches[0];
    }
    // async getFacebookDetails(item: Item, mapZoom?: number) {
    //     const coordinates = (item.geometry as GeometryPoint).coordinates;
    //     const distance = mapZoom ? Math.max(14 - mapZoom, 1) * 20 : item.properties.class === 'country' ? 500 : 40;
    //     const types = ['node', 'way'];
    //     const result = await networkService.request({
    //         url: 'https://graph.facebook.com/search',
    //         method: 'GET',
    //         queryParams: {
    //             access_token: FACEBOOK_TOKEN,
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
