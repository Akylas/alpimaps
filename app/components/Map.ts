import { throttle } from 'helpful-decorators';
import { CartoMapStyle, ClickType, MapPos, ScreenPos, toNativeScreenPos } from 'nativescript-carto/core/core';
import { PersistentCacheTileDataSource } from 'nativescript-carto/datasources/cache';
import { LocalVectorDataSource } from 'nativescript-carto/datasources/vector';
import { Layer } from 'nativescript-carto/layers/layer';
import { CartoOnlineVectorTileLayer, VectorElementEventData, VectorLayer, VectorTileEventData, VectorTileLayer, VectorTileRenderOrder } from 'nativescript-carto/layers/vector';
import { Projection } from 'nativescript-carto/projections/projection';
import { CartoMap, registerLicense, RenderProjectionMode } from 'nativescript-carto/ui/ui';
import { setShowDebug } from 'nativescript-carto/utils/utils';
import { Line, LineEndType, LineJointType, LineStyleBuilder, LineStyleBuilderOptions } from 'nativescript-carto/vectorelements/line';
import { Marker, MarkerStyleBuilder, MarkerStyleBuilderOptions } from 'nativescript-carto/vectorelements/marker';
import { Point, PointStyleBuilder, PointStyleBuilderOptions } from 'nativescript-carto/vectorelements/point';
import { MBVectorTileDecoder } from 'nativescript-carto/vectortiles/vectortiles';
import { localize } from 'nativescript-localize';
import * as perms from 'nativescript-perms';
import Vue from 'nativescript-vue';
import * as appSettings from 'tns-core-modules/application-settings/application-settings';
import { Folder, knownFolders, path } from 'tns-core-modules/file-system';
import { screen } from 'tns-core-modules/platform';
import { profile } from 'tns-core-modules/profiling';
import { layout } from 'tns-core-modules/utils/utils';
import { action } from 'ui/dialogs';
import { Component, Prop, Watch } from 'vue-property-decorator';
import { GeoHandler } from '~/handlers/GeoHandler';
import CustomLayersModule, { SourceItem } from '~/mapModules/CustomLayersModule';
import ItemFormatter from '~/mapModules/ItemFormatter';
import ItemsModule, { Item } from '~/mapModules/ItemsModule';
import MapModule from '~/mapModules/MapModule';
import UserLocationModule from '~/mapModules/UserLocationModule';
import { getBoundsZoomLevel, getCenter } from '~/utils/geo';
import { clog } from '~/utils/logging';
import { actionBarButtonHeight, primaryColor } from '../variables';
import BgServiceComponent from './BgServiceComponent';
import BottomSheet from './BottomSheet';
import BottomSheetHolder, { BottomSheetHolderScrollEventData } from './BottomSheet/BottomSheetHolder';
import DirectionsPanel from './DirectionsPanel';
import MapScrollingWidgets from './MapScrollingWidgets';
import MapWidgets from './MapWidgets';
import PackagesDownloadComponent from './PackagesDownloadComponent';
import Search from './Search';
import TopSheetHolder from './TopSheetHolder';
import App from './App';

const tinycolor = require('tinycolor2');

function distance(pos1: ScreenPos, pos2: ScreenPos) {
    return Math.sqrt(Math.pow(pos1.x - pos2.x, 2) + Math.pow(pos1.y - pos2.y, 2));
}

export type LayerType = 'map' | 'customLayers' | 'selection' | 'items' | 'directions' | 'userLocation';

const LAYERS_ORDER: LayerType[] = ['map', 'customLayers', 'selection', 'items', 'directions', 'userLocation'];
const mapLanguages = [
    'ar',
    'az',
    'be',
    'bg',
    'br',
    'bs',
    'ca',
    'cs',
    'cy',
    'da',
    'de',
    'el',
    'en',
    'eo',
    'es',
    'et',
    'fi',
    'fr',
    'fy',
    'ga',
    'gd',
    'he',
    'hr',
    'hu',
    'hy',
    'is',
    'it',
    'ja',
    'ka',
    'kk',
    'kn',
    'ko',
    'la',
    'lb',
    'lt',
    'lv',
    'mk',
    'mt',
    'nl',
    'no',
    'pl',
    'pt',
    'rm',
    'ro',
    'ru',
    'sk',
    'sl',
    'sq',
    'sr',
    'sv',
    'th',
    'tr',
    'uk',
    'zh'
];

export interface MapModules {
    // [k: string]: MapModule;
    mapScrollingWidgets: MapScrollingWidgets;
    mapWidgets: MapWidgets;
    search: Search;
    customLayers: CustomLayersModule;
    directionsPanel: DirectionsPanel;
    userLocation: UserLocationModule;
    items: ItemsModule;
    formatter: ItemFormatter;
}

const defaultLiveSync = global.__onLiveSync;
@Component({
    components: {
        BottomSheet,
        BottomSheetHolder,
        TopSheetHolder,
        Search,
        MapWidgets,
        MapScrollingWidgets
    }
})
export default class Map extends BgServiceComponent {
    mapModules: MapModules;

    @Prop({ default: false }) readonly licenseRegistered!: boolean;
    @Watch('licenseRegistered')
    onLicenseRegisteredChanged(value) {
        clog('onLicenseRegisteredChanged', value);
    }

    mapModule<T extends keyof MapModules>(id: T) {
        return this.mapModules[id];
    }
    get darkMode() {
        return this.currentLayerStyle === 'positron';
    }
    set darkMode(value: boolean) {
        this.setMapStyle(value ? 'positron' : 'voyager');
    }
    currentLayer: VectorTileLayer;
    currentLayerStyle: CartoMapStyle;
    localVectorDataSource: LocalVectorDataSource;
    localVectorLayer: VectorLayer;
    actionBarButtonHeight = actionBarButtonHeight;
    vectorTileDecoder: MBVectorTileDecoder;

    selectedPosMarker: Marker;
    selectedRouteLine: Line;
    mSelectedItem: Item = null;
    mapProjection: Projection = null;
    currentLanguage = 'en';
    addedLayers: string[] = [];

    showingDownloadPackageDialog = false;

    set selectedItem(value) {
        this.runOnModules('onSelectedItem', value, this.mSelectedItem);
        this.mSelectedItem = value;
    }
    get selectedItem() {
        return this.mSelectedItem;
    }

    get searchResultsVisible() {
        return this.searchView && this.searchView.searchResultsVisible;
    }
    _cartoMap: CartoMap = null;
    get cartoMap() {
        console.log('get cartoMap', !!this._cartoMap);
        return this._cartoMap;
    }

    get peekHeight() {
        return 70;
    }
    fullHeight = 0;
    onLayoutChange() {
        this.fullHeight = layout.toDeviceIndependentPixels(this.nativeView.getMeasuredHeight());
    }
    get bottomSheetSteps() {
        // console.log('peekerSteps', this.shouldShowFullHeight, this.peekHeight, this.actionBarHeight, this.fullHeight);
        if (this.shouldShowFullHeight) {
            return [this.peekHeight, this.peekHeight + this.actionBarHeight, this.fullHeight];
        }
        return [this.peekHeight, this.peekHeight + this.actionBarHeight];
    }
    get shouldShowFullHeight() {
        return !!this.mSelectedItem && !!this.mSelectedItem.route;
    }
    constructor() {
        super();
    }

    // get cartoMap() {
    //     return this.$refs.cartoMap && this.$refs.cartoMap.nativeView;
    // }

    get customSources() {
        console.log('get', 'customSources');
        return this.mapModules['customLayers'].customSources;
    }
    @profile
    mounted() {
        this.mapModules = {
            items: new ItemsModule(),
            userLocation: new UserLocationModule(),
            customLayers: new CustomLayersModule(),
            formatter: new ItemFormatter(),
            directionsPanel: this.topSheet,
            search: this.searchView,
            mapWidgets: this.$refs.mapWidgets,
            mapScrollingWidgets: this.$refs.mapScrollingWidgets
        };
        super.mounted();
        this.$setMapComponent(this);
        this.log('mounted', App.cartoLicenseRegistered);
        if (!App.cartoLicenseRegistered) {
            // if (gVars.isAndroid) {
            // setTimeout(() => {
            registerLicense(gVars.CARTO_TOKEN, result => {
                clog('registerLicense done', result);
                this.$getAppComponent().setCartoLicenseRegistered(result);
                setShowDebug(true);
            });
            // }, 200);
            // } else {
            //     registerLicense(gVars.CARTO_IOS_TOKEN, result => {
            //         clog('registerLicense done', result);
            //         this.$getAppComponent().setCartoLicenseRegistered(result);
            //     });
            //     // registerLicense(gVars.CARTO_IOS_TOKEN);
            // }
        } else {
            setShowDebug(true);
        }

        global.__onLiveSync = (context?: ModuleContext) => {
            clog('__onLiveSync', context);
            if (!context) {
                this.reloadMapStyle && this.reloadMapStyle();
            }
            defaultLiveSync(context);
        };
    }
    destroyed() {
        this.runOnModules('onMapDestroyed');
        this.$setMapComponent(null);

        this.localVectorLayer = null;
        if (this.localVectorDataSource) {
            this.localVectorDataSource.clear();
            this.localVectorDataSource = null;
        }
        if (this._cartoMap) {
            // const layers = this._cartoMap.getLayers();
            // if (layers) {
            //     layers.clear();
            // }
            this._cartoMap = null;
        }
        global.__onLiveSync = defaultLiveSync;
        this.selectedPosMarker = null;
        this.selectedRouteLine = null;
        super.destroyed();
    }
    reloadMapStyle() {
        this.setMapStyle(this.currentLayerStyle, true);
    }

    getOrCreateLocalVectorLayer() {
        if (!this.localVectorLayer) {
            const projection = this.mapProjection;
            this.localVectorDataSource = new LocalVectorDataSource({ projection });

            this.localVectorLayer = new VectorLayer({ dataSource: this.localVectorDataSource });
            this.addLayer(this.localVectorLayer, 'selection');
        }
        return this.localVectorLayer;
    }

    runOnModules(functionName: string, ...args) {
        let m: MapModule;
        return Object.keys(this.mapModules).some(k => {
            m = this.mapModules[k];
            if (m && m[functionName]) {
                const result = (m[functionName] as Function).call(m, ...args);
                if (result) {
                    return result;
                }
                return false;
            }
        });
    }

    onServiceLoaded(geoHandler: GeoHandler) {
        this.log('onServiceLoaded');
        this.runOnModules('onServiceLoaded', geoHandler);
    }
    onServiceUnloaded(geoHandler: GeoHandler) {
        this.log('onServiceUnloaded');
        this.runOnModules('onServiceUnloaded', geoHandler);
    }

    onMapMove(e) {
        const cartoMap = this._cartoMap;
        if (!cartoMap) {
            return;
        }
        // console.log('onMapMove',e.data);
        this.runOnModules('onMapMove', e);
        // if (zoom < 10) {
        //     this.suggestionPackage = undefined;
        //     this.suggestionPackageName = undefined;
        // }
    }
    onMapIdle(e) {
        const cartoMap = this._cartoMap;
        if (!cartoMap) {
            return;
        }
        this.runOnModules('onMapIdle', e);
        const zoom = cartoMap.zoom;
        console.log('onMapIdle', zoom);
    }
    @throttle(100)
    saveSettings() {
        appSettings.setNumber('mapZoom', this._cartoMap.zoom);
        appSettings.setString('mapFocusPos', JSON.stringify(this._cartoMap.focusPos));
    }
    onMapStable(e) {
        const cartoMap = this.cartoMap;
        if (!cartoMap) {
            return;
        }
        this.saveSettings();
        this.runOnModules('onMapStable', e);
        const zoom = cartoMap.zoom;
        // console.log('onMapStable', zoom);
    }

    onMapReady(e) {
        const cartoMap = (this._cartoMap = e.object as CartoMap);

        this.mapProjection = cartoMap.projection;
        this.log('onMapReady');

        const options = cartoMap.getOptions();
        options.setWatermarkScale(0.5);
        options.setWatermarkPadding(toNativeScreenPos({ x: 80, y: 0 }));
        options.setRestrictedPanning(true);
        options.setSeamlessPanning(true);
        options.setEnvelopeThreadPoolSize(2);
        options.setTileThreadPoolSize(2);
        options.setZoomGestures(true);
        options.setRotatable(true);
        // options.setDrawDistance(8);
        this.showGlobe = appSettings.getBoolean('showGlobe', false);
        console.log('test', JSON.parse('{"lat":45.2002,"lon":5.7222}'));
        const pos = JSON.parse(appSettings.getString('mapFocusPos', '{"lat":45.2002,"lon":5.7222}')) as MapPos;
        const zoom = appSettings.getNumber('mapZoom', 10);
        console.log('map start pos', pos, zoom);
        cartoMap.setFocusPos(pos, 0);
        cartoMap.setZoom(zoom, 0);

        perms
            .request('storage')
            .then(status => {
                this.log('on request storage', status, this.actionBarButtonHeight, !!this._cartoMap);
                this.$packageService.start();
                this.setMapStyle(appSettings.getString('mapStyle', 'alpimaps.zip'));
                this.runOnModules('onMapReady', this, cartoMap);

                // TODO: calling setCurrentLayer twice is a trick to get the map to load on close/start
                this.setCurrentLayer(this.currentLayerStyle);
            })
            .catch(err => console.error(err));
    }
    get bottomSheetHolder() {
        return this.$refs['bottomSheetHolder'] as BottomSheetHolder;
    }

    get bottomSheet() {
        return this.bottomSheetHolder.bottomSheet;
    }
    get topSheetHolder() {
        return this.$refs['topSheetHolder'] as TopSheetHolder;
    }

    get topSheet() {
        return this.topSheetHolder.topSheet;
    }

    createLocalMarker(position: MapPos, options: MarkerStyleBuilderOptions) {
        this.getOrCreateLocalVectorLayer();
        const styleBuilder = new MarkerStyleBuilder(options);
        return new Marker({ position, projection: this.mapProjection, styleBuilder });
    }
    createLocalPoint(position: MapPos, options: PointStyleBuilderOptions) {
        this.getOrCreateLocalVectorLayer();
        const styleBuilder = new PointStyleBuilder(options);
        return new Point({ position, projection: this.mapProjection, styleBuilder });
    }
    createLocalLine(positions: MapPos[], options: LineStyleBuilderOptions) {
        this.getOrCreateLocalVectorLayer();
        const styleBuilder = new LineStyleBuilder(options);
        return new Line({ positions, projection: this.mapProjection, styleBuilder });
    }
    selectItem(item: Item, isFeatureInteresting = false) {
        console.log('selectItem', isFeatureInteresting, !!item.route);
        if (isFeatureInteresting) {
            if (item.route) {
                if (!this.selectedRouteLine) {
                    this.selectedRouteLine = this.createLocalLine(item.route.positions, {
                        // color: '#55ff0000',
                        color: 'white',
                        // visible: false,
                        joinType: LineJointType.ROUND,
                        endType: LineEndType.ROUND,
                        width: 10,
                        clickWidth: 0

                        // orientationMode: BillboardOrientation.GROUND,
                        // scalingMode: BillboardScaling.SCREEN_SIZE
                    });
                    this.localVectorDataSource.add(this.selectedRouteLine);
                } else {
                    this.selectedRouteLine.positions = item.route.positions;
                    this.selectedRouteLine.visible = true;
                }
                if (this.selectedPosMarker) {
                    this.selectedPosMarker.visible = false;
                }
            } else {
                if (!this.selectedPosMarker) {
                    this.selectedPosMarker = this.createLocalPoint(item.position, {
                        // color: '#55ff0000',
                        color: tinycolor(primaryColor)
                            .setAlpha(0.7)
                            .toRgbString(),
                        scaleWithDPI: true,
                        size: 30
                        // orientationMode: BillboardOrientation.GROUND,
                        // scalingMode: BillboardScaling.SCREEN_SIZE
                    });
                    this.localVectorDataSource.add(this.selectedPosMarker);
                } else {
                    this.selectedPosMarker.position = item.position;
                    this.selectedPosMarker.visible = true;
                }
                if (this.selectedRouteLine) {
                    this.selectedRouteLine.visible = false;
                }
            }

            this.selectedItem = item;

            this.bottomSheetHolder.peek();
            if (item.zoomBounds) {
                const zoomLevel = getBoundsZoomLevel(item.zoomBounds, { width: screen.mainScreen.widthPixels, height: screen.mainScreen.heightPixels });
                this.cartoMap.setZoom(zoomLevel, getCenter(item.zoomBounds.northeast, item.zoomBounds.southwest), 200);
            } else {
                this.cartoMap.setFocusPos(item.position, 200);
            }
        } else {
            this.unselectItem();
        }
    }
    unselectItem() {
        // this.log('unselectItem', !!this._selectedItem);
        if (!!this.mSelectedItem) {
            this.selectedItem = null;
            if (this.selectedPosMarker) {
                this.selectedPosMarker.visible = false;
            }
            if (this.selectedRouteLine) {
                this.selectedRouteLine.visible = false;
            }
            this.bottomSheetHolder.close();
        }
    }
    cancelDirections() {
        this.mapModules.directionsPanel.cancel();
    }
    onMapClicked(e) {
        const { clickType, position } = e.data;
        const handledByModules = this.runOnModules('onMapClicked', e);
        if (!handledByModules && clickType === ClickType.SINGLE) {
            this.selectItem({ position }, false);
            this.runOnModules('onMapClicked', e);
        }
        this.unFocusSearch();
    }
    onVectorTileClicked(data: VectorTileEventData) {
        const { clickType, position, featureLayerName, featureData, featurePosition } = data;
        // console.log(
        //     'onVectorTileClicked',
        //     // position,
        //     // map.mapToScreen(position),
        //     // featurePosition,
        //     // map.mapToScreen(featurePosition),
        //     featureLayerName,
        //     featureData.class,
        //     featureData.subclass,
        //     featureData.name,
        //     featureData.ele
        // );
        const handledByModules = this.runOnModules('onVectorTileClicked', data);
        if (!handledByModules && clickType === ClickType.SINGLE) {
            const map = this._cartoMap;
            featureData.layer = featureLayerName;

            if (
                featureLayerName === 'transportation' ||
                featureLayerName === 'waterway' ||
                featureLayerName === 'transportation_name' ||
                featureLayerName === 'contour' ||
                featureLayerName === 'building' ||
                featureLayerName === 'landcover' ||
                featureLayerName === 'landuse'
            ) {
                return false;
            }
            const distanceFromClick = distance(map.mapToScreen(position), map.mapToScreen(featurePosition));

            console.log(
                `onVectorTileClicked distanceFromClick:${distanceFromClick}, elevation:${featureData.ele}, name:${featureData.name} layer: ${featureLayerName} class: ${featureData.class}`,
                this.actionBarHeight,
                this.bShow3DBuildings
            );

            // const languages = [];
            // Object.keys(featureData).forEach(k => {
            //     if (/name:/.test(k)) {
            //         languages.push(k.replace('name:', ''));
            //     }
            // });
            // console.log(JSON.stringify(languages));

            const isFeatureInteresting = !!featureData.name || featureLayerName === 'poi' || featureLayerName === 'housenumber';
            if (isFeatureInteresting) {
                let result: Item = {
                    properties: featureData,
                    position: isFeatureInteresting ? featurePosition : position
                };
                // if (featureLayerName === 'poi' || featureLayerName === 'housenumber') {
                this.$packageService
                    .searchInPackageReverseGeocodingService({
                        projection: this.mapProjection,
                        location: featurePosition,
                        searchRadius: 100
                    })
                    .then(res => {
                        let foundBetterRes = false;
                        res.some(r => {
                            console.log('search item', r.address);
                            result = this.$packageService.prepareGeoCodingResult({ address: r.address as any, ...result });
                            foundBetterRes = true;
                            if (result.address.name === featureData.name || result.address.houseNumber === featureData.housenumber) {
                                return true;
                            }
                        });
                        return foundBetterRes;
                    })
                    .then(actualRes => {
                        console.log('actualRes', actualRes);
                        if (actualRes) {
                            this.selectItem(JSON.parse(JSON.stringify(result)), isFeatureInteresting);
                        }
                    })
                    .catch(err => {
                        console.error(err);
                    });
                // }

                this.selectItem(result, isFeatureInteresting);
            }
            this.unFocusSearch();

            // return true to only look at first vector found
            return isFeatureInteresting;
        }
        return handledByModules;
    }
    onVectorElementClicked(data: VectorElementEventData) {
        const { clickType, position, elementPos, metaData, element } = data;
        Object.keys(metaData).forEach(k => {
            metaData[k] = JSON.parse(metaData[k]);
        });
        // console.log('onVectorElementClicked', clickType, elementPos);
        const handledByModules = this.runOnModules('onVectorElementClicked', data);
        if (!handledByModules && clickType === ClickType.SINGLE) {
            const item: Item = { position, vectorElement: element, ...metaData };
            this.selectItem(item, true);
            this.unFocusSearch();
            return true;
        }
        return handledByModules;
    }
    get searchView() {
        return this.$refs.searchView as Search;
    }
    unFocusSearch() {
        if (this.searchView && this.searchView.hasFocus) {
            this.searchView.unfocus();
        }
    }

    bShowGlobe = false;
    get showGlobe() {
        return this.bShowGlobe;
    }
    set showGlobe(value: boolean) {
        this.bShowGlobe = value;
        this.cartoMap.getOptions().setRenderProjectionMode(value ? RenderProjectionMode.RENDER_PROJECTION_MODE_SPHERICAL : RenderProjectionMode.RENDER_PROJECTION_MODE_PLANAR);
    }
    bShow3DBuildings = false;
    get show3DBuildings() {
        return this.bShow3DBuildings;
    }
    set show3DBuildings(value: boolean) {
        this.bShow3DBuildings = value;
        this.getVectorTileDecoder().setStyleParameter('buildings', !!value ? '2' : '1');
    }
    bShowContourLines = false;
    get showContourLines() {
        return this.bShowContourLines;
    }
    set showContourLines(value: boolean) {
        this.bShowContourLines = value;
        this.getVectorTileDecoder().setStyleParameter('contours', value ? '1' : '0');
    }
    _contourLinesOpacity = 1;
    get contourLinesOpacity() {
        return this._contourLinesOpacity;
    }
    set contourLinesOpacity(value: number) {
        this._contourLinesOpacity = value;
        const vectorTileDecoder = this.getVectorTileDecoder();
        vectorTileDecoder.setStyleParameter('contoursOpacity', value.toFixed(1));
    }
    setCurrentLayer(id: CartoMapStyle) {
        // const cartoMap = this._cartoMap;
        if (this.currentLayer) {
            this.removeLayer(this.currentLayer, 'map');
            this.currentLayer.setVectorTileEventListener(null);
            this.currentLayer = null;
        }
        clog('setCurrentLayer', id);
        this.currentLayerStyle = id;
        const vectorTileDecoder = this.getVectorTileDecoder();
        // clog('vectorTileDecoder', vectorTileDecoder);

        this.currentLayer = new VectorTileLayer({
            preloading: true,
            dataSource: this.$packageService.getDataSource(),
            decoder: vectorTileDecoder
        });
        this.updateLanguage(this.currentLanguage);
        this.show3DBuildings = appSettings.getBoolean('show3DBuildings', false);
        this.showContourLines = appSettings.getBoolean('showContourLines', false);
        // clog('currentLayer', !!this.currentLayer);
        this.currentLayer.setLabelRenderOrder(VectorTileRenderOrder.LAST);
        this.currentLayer.setVectorTileEventListener(this, this.mapProjection);
        this.addLayer(this.currentLayer, 'map');
        // clog('setCurrentLayer', 'done');
    }
    updateLanguage(code: string) {
        if (this.currentLayer === null) {
            return;
        }
        this.currentLanguage = code;
        this.$packageService.currentLanguage = code;
        const current = this.currentLayer;
        const decoder = current.getTileDecoder();
        // this.log('updateLanguage', code, decoder);
        decoder.setStyleParameter('lang', code);
    }

    getVectorTileDecoder() {
        return this.vectorTileDecoder || this.$packageService.getVectorTileDecoder();
    }

    getStyleFromCartoMapStyle(style: CartoMapStyle) {
        switch (style) {
            case CartoMapStyle.DARKMATTER:
                return 'darkmatter';
            case CartoMapStyle.POSITRON:
                return 'positron';
            case CartoMapStyle.VOYAGER:
            default:
                return 'voyager';
        }
    }
    geteCartoMapStyleFromStyle(style: string) {
        switch (style) {
            case 'darkmatter':
                return CartoMapStyle.DARKMATTER;
            case 'positron':
                return CartoMapStyle.POSITRON;
            case 'voyager':
            default:
                return CartoMapStyle.VOYAGER;
        }
    }
    // setCurrentLayerStyle(style: CartoMapStyle) {
    //     this.currentLayerStyle = style;
    //     if (this.vectorTileDecoder instanceof CartoOnlineVectorTileLayer) {
    //         // this.vectorTileDecoder.style = this.getStyleFromCartoMapStyle(this.currentLayerStyle);
    //     }
    // }
    setMapStyle(layerStyle: any, force = false) {
        if (!layerStyle) {
            return;
        }
        console.log('setMapStyle', layerStyle);
        if (layerStyle !== this.currentLayerStyle || !!force) {
            this.currentLayerStyle = layerStyle;
            appSettings.setString('mapStyle', layerStyle);
            if (layerStyle === 'default' || layerStyle === 'voyager' || layerStyle === 'positron') {
                this.vectorTileDecoder = new CartoOnlineVectorTileLayer({ style: this.geteCartoMapStyleFromStyle(layerStyle) }).getTileDecoder();
            } else {
                try {
                    this.vectorTileDecoder = new MBVectorTileDecoder({
                        style: this.getStyleFromCartoMapStyle(this.currentLayerStyle),
                        liveReload: TNS_ENV !== 'production',
                        ...(layerStyle.endsWith('.zip') ? { zipPath: `~/assets/styles/${layerStyle}` } : { dirPath: `~/assets/styles/${layerStyle}` })
                    });
                } catch (err) {
                    this.showError(err);
                    this.vectorTileDecoder = null;
                }
            }

            this.setCurrentLayer(this.currentLayerStyle);
        }
    }

    // openSearch() {
    //     import('~/components/Search.vue').then(Search => {
    //         this.$navigateTo(Search.default, {
    //             animated: true,
    //             transitionAndroid: {
    //                 name: 'fade',
    //                 duration: 200,
    //                 curve: 'linear'
    //             },
    //             transitioniOS: {
    //                 name: 'fade',
    //                 duration: 200,
    //                 curve: 'linear'
    //             },
    //             props: {
    //                 searchLayer: this.currentLayer,
    //                 projection: this.mapProjection
    //             }
    //         } as any);
    //     });
    // }

    onLayerOpacityChanged(item, event) {
        const opacity = event.value / 100;
        item.layer.opacity = opacity;
        appSettings.setNumber(item.name + '_opacity', opacity);
        item.layer.visible = opacity !== 0;
        this.cartoMap.requestRedraw();
        // item.layer.refresh();
        console.log('onLayerOpacityChanged', item.name, event.value, item.opacity);
    }

    onSourceLongPress(item: SourceItem) {
        const actions = ['delete'];
        if (item.provider.cacheable !== false) {
            actions.push('clear_cache');
        }
        if (item.legend) {
            actions.push('legend');
        }
        action({
            title: `${item.name} Source`,
            message: 'Pick Action',
            actions: ['delete', 'clear_cache'].map(s => localize(s))
        }).then(result => {
            switch (result) {
                case 'delete': {
                    this.mapModules.customLayers.deleteSource(item.name);
                    break;
                }
                case 'clear_cache': {
                    ((item.layer as any).dataSource as PersistentCacheTileDataSource).clear();
                    item.layer.clearTileCaches(true);
                    break;
                }
                case 'legend':
                    const PhotoViewer = require('nativescript-photoviewer');
                    new PhotoViewer().showGallery([item.legend]);
                    break;
            }
        });
    }

    selectStyle() {
        const assetsFolder = Folder.fromPath(path.join(knownFolders.currentApp().path, 'assets', 'styles'));
        assetsFolder.getEntities().then(files => {
            // files = files.filter(e => e.name.endsWith('.zip'));
            action({
                title: 'Language',
                message: 'Select Style',
                actions: files.map(e => e.name).concat('default')
            }).then(result => {
                if (result) {
                    this.setMapStyle(result);
                }
            });
        });
    }
    selectLanguage() {
        action({
            title: 'Language',
            message: 'Select Language',
            actions: mapLanguages
        }).then(result => {
            result && this.updateLanguage(result);
        });
    }

    downloadPackages() {
        const ComponentClass = Vue.extend(PackagesDownloadComponent);
        let instance = new ComponentClass();
        instance.$mount();
        this.nativeView._addViewCore(instance.nativeView);
        this.nativeView.showBottomSheet({
            view: instance.nativeView,
            context: {},
            closeCallback: objId => {
                this.showingDownloadPackageDialog = false;
                this.nativeView._removeViewCore(instance.nativeView);
                instance.$destroy();
                instance = null;
            }
        });
        // let cfalertDialog = new CFAlertDialog();

        // let options: any = {
        //     // Options go here
        //     dialogStyle: CFAlertStyle.BOTTOM_SHEET,
        //     // title: 'Download Packages',
        //     headerView: instance.nativeView.nativeView,
        //     onDismiss: () => {
        //         this.showingDownloadPackageDialog = false;
        //         this.nativeView._removeViewCore(instance.nativeView);
        //         instance.$destroy();
        //         instance = null;
        //     }
        // };
        this.showingDownloadPackageDialog = true;
        // cfalertDialog.show(options); // That's about it ;)
    }
    removeLayer(layer: Layer<any, any>, layerId: LayerType) {
        const index = this.addedLayers.indexOf(layerId);
        if (index !== -1) {
            this.addedLayers.splice(index, 1);
        }
        this._cartoMap.removeLayer(layer);
    }
    addLayer(layer: Layer<any, any>, layerId: LayerType, offset?: number) {
        const realLayerId = offset ? layerId + offset : layerId;
        this.log('addLayer', layerId, realLayerId, index, !!this._cartoMap, this.addedLayers.indexOf(layerId), this.addedLayers);
        if (this._cartoMap) {
            if (this.addedLayers.indexOf(realLayerId) !== -1) {
                return;
            }
            const index = LAYERS_ORDER.indexOf(layerId);
            let realIndex = 0;
            for (let i = 0; i < index; i++) {
                if (this.addedLayers.indexOf(LAYERS_ORDER[i]) !== -1) {
                    realIndex++;
                }
            }
            if (realIndex >= 0) {
                this._cartoMap.addLayer(layer, realIndex + (offset || 0));
            } else {
                this._cartoMap.addLayer(layer);
            }
            this.addedLayers.splice(realIndex + (offset || 0), 0, realLayerId);
            // console.log('addedLayer', layerId, index, realIndex, offset, addedLayers);
            this._cartoMap.requestRedraw();
        }
    }
    bottomSheetTranslation = 0;
    bottomSheetPercentage = 0;
    get scrollingWidgetsOpacity() {
        if (this.bottomSheetPercentage <= 0.5) {
            return 1;
        }
        return 4 * (2 - 2 * this.bottomSheetPercentage) - 3;
    }
    onBottomSheetScroll(e: BottomSheetHolderScrollEventData) {
        // console.log('onBottomSheetScroll', e);
        this.bottomSheetTranslation = e.height;
        this.bottomSheetPercentage = e.percentage;
    }
}
