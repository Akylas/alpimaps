import { CartoMapStyle, ClickType, ScreenPos, toNativeScreenPos, MapPos } from 'nativescript-carto/core';
import { ad, layout } from '@nativescript/core/utils/utils';
import { PersistentCacheTileDataSource } from 'nativescript-carto/datasources/cache';
import { LocalVectorDataSource } from 'nativescript-carto/datasources/vector';
import { Layer } from 'nativescript-carto/layers';
import { CartoOnlineVectorTileLayer, VectorElementEventData, VectorLayer, VectorTileEventData, VectorTileLayer, VectorTileRenderOrder } from 'nativescript-carto/layers/vector';
import { Projection } from 'nativescript-carto/projections';
import { CartoMap, registerLicense, RenderProjectionMode } from 'nativescript-carto/ui';
import { setShowDebug } from 'nativescript-carto/utils';
import { Line, LineEndType, LineJointType, LineStyleBuilder, LineStyleBuilderOptions } from 'nativescript-carto/vectorelements/line';
import { Marker, MarkerStyleBuilder, MarkerStyleBuilderOptions } from 'nativescript-carto/vectorelements/marker';
import { Point, PointStyleBuilder, PointStyleBuilderOptions } from 'nativescript-carto/vectorelements/point';
import { MBVectorTileDecoder } from 'nativescript-carto/vectortiles';
import { allowSleepAgain, keepAwake } from 'nativescript-insomnia';
import { localize } from 'nativescript-localize';
import * as perms from 'nativescript-perms';
import * as SocialShare from 'nativescript-social-share';
import { AppURL, handleOpenURL } from 'nativescript-urlhandler';
import * as appSettings from '@nativescript/core/application-settings';
import { Folder, knownFolders, path } from '@nativescript/core/file-system';
import { screen } from '@nativescript/core/platform';
import { profile } from '@nativescript/core/profiling';
import { throttle } from 'helpful-decorators';
import { action } from 'nativescript-material-dialogs';
import { Component, Prop, Watch } from 'vue-property-decorator';
import { GeoHandler } from '~/handlers/GeoHandler';
import CustomLayersModule, { SourceItem } from '~/mapModules/CustomLayersModule';
import ItemFormatter from '~/mapModules/ItemFormatter';
import ItemsModule, { Item } from '~/mapModules/ItemsModule';
import MapModule from '~/mapModules/MapModule';
import UserLocationModule from '~/mapModules/UserLocationModule';
import { NOTIFICATION_CHANEL_ID_KEEP_AWAKE_CHANNEL, NotificationHelper } from '~/services/android/NotifcationHelper';
import { computeDistanceBetween, getBoundsZoomLevel, getCenter } from '~/utils/geo';
import { actionBarButtonHeight, actionBarHeight, navigationBarHeight, primaryColor } from '../variables';
import App from './App';
import BgServicePageComponent from './BgServicePageComponent';
import BottomSheet from './BottomSheet';
import BottomSheetHolder, { BottomSheetHolderScrollEventData } from './BottomSheet/BottomSheetHolder';
import DirectionsPanel from './DirectionsPanel';
import MapRightMenu from './MapRightMenu';
import MapScrollingWidgets from './MapScrollingWidgets';
import PackagesDownloadComponent from './PackagesDownloadComponent';
import Search from './Search';
import TopSheetHolder, { DEFAULT_TOP, TopSheetHolderScrollEventData } from './TopSheetHolder';

const KEEP_AWAKE_NOTIFICATION_ID = 23466578;

const tinycolor = require('tinycolor2');

function distance(pos1: ScreenPos, pos2: ScreenPos) {
    return Math.sqrt(Math.pow(pos1.x - pos2.x, 2) + Math.pow(pos1.y - pos2.y, 2));
}

export type LayerType = 'map' | 'customLayers' | 'selection' | 'items' | 'directions' | 'userLocation' | 'search';

const LAYERS_ORDER: LayerType[] = ['map', 'customLayers', 'selection', 'items', 'directions', 'search', 'userLocation'];
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
    // mapWidgets: MapWidgets;
    search: Search;
    customLayers: CustomLayersModule;
    directionsPanel: DirectionsPanel;
    userLocation: UserLocationModule;
    items: ItemsModule;
    formatter: ItemFormatter;
    rightMenu: MapRightMenu;
    bottomSheet: BottomSheet;
}

let defaultLiveSync = global.__onLiveSync;
@Component({
    components: {
        BottomSheet,
        BottomSheetHolder,
        TopSheetHolder,
        Search,
        // MapWidgets,
        MapScrollingWidgets
    }
})
export default class Map extends BgServicePageComponent {
    mapModules: MapModules = null;

    @Prop({ default: false }) readonly licenseRegistered!: boolean;
    // @Watch('licenseRegistered')
    // onLicenseRegisteredChanged(value) {
    // clog('onLicenseRegisteredChanged', value);
    // }

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
    currentLayerStyle: string;
    localVectorDataSource: LocalVectorDataSource;
    localVectorLayer: VectorLayer;
    actionBarButtonHeight = actionBarButtonHeight;
    vectorTileDecoder: MBVectorTileDecoder;

    selectedPosMarker: Marker<LatLonKeys>;
    selectedRouteLine: Line<LatLonKeys>;
    mSelectedItem: Item = null;
    mapProjection: Projection = null;
    currentLanguage = appSettings.getString('language', 'en');
    addedLayers: string[] = [];

    showingDownloadPackageDialog = false;
    keepAwake = false;

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
    get mapWidgetsTopPadding() {
        return this.topSheetTranslation;
    }
    _cartoMap: CartoMap<LatLonKeys> = null;
    get cartoMap() {
        // console.log('get cartoMap', !!this._cartoMap);
        return this._cartoMap;
    }
    navigationBarHeight = navigationBarHeight;
    get peekHeight() {
        return 70;
    }
    fullHeight = 0;
    onLayoutChange() {
        this.fullHeight = layout.toDeviceIndependentPixels(this.nativeView.getMeasuredHeight());
        // this.log('onLayoutChange', this.fullHeight);
    }
    get bottomSheetSteps() {
        const result = [this.peekHeight, this.peekHeight + actionBarHeight];
        if (!!this.mSelectedItem) {
            if (!!this.mSelectedItem.route) {
                if (!!this.mSelectedItem.route.profile && !!this.mSelectedItem.route.profile.max) {
                    result.push(result[result.length - 1] + 100);
                }
                result.push(result[result.length - 1] + 150);
            }
        }
        // this.log('peekerSteps', result, !!this.mSelectedItem, !!this.mSelectedItem && !!this.mSelectedItem.route);
        return result;
        // if (this.shouldShowFullHeight) {
        //     return [this.peekHeight, this.peekHeight + this.actionBarHeight, this.fullHeight];
        // }
        // return [this.peekHeight, this.peekHeight + this.actionBarHeight];
    }

    get bottomSheetHolder() {
        return this.$refs['bottomSheetHolder'] as BottomSheetHolder;
    }

    get bottomSheet() {
        return this.$refs['bottomSheet'] as BottomSheet;
    }
    get topSheetHolder() {
        return this.$refs['topSheetHolder'] as TopSheetHolder;
    }
    get topSheet() {
        return this.topSheetHolder.topSheet;
    }
    get shouldShowFullHeight() {
        return !!this.mSelectedItem && !!this.mSelectedItem.route;
    }
    constructor() {
        super();
        this.showContourLines = appSettings.getBoolean('showContourLines', false);
        handleOpenURL(this.onAppUrl);
    }
    searchText: string = null;
    onAppUrl(appURL: AppURL) {
        console.log('Got the following appURL', appURL.path, Array.from(appURL.params.entries()));
        if (appURL.path.startsWith('eo')) {
            const latlong = appURL.path
                .split(':')[1]
                .split(',')
                .map(parseFloat) as [number, number];
            const loaded = !!this._cartoMap;
            if (latlong[0] !== 0 || latlong[1] !== 0) {
                if (loaded) {
                    this._cartoMap.setFocusPos({ lat: latlong[0], lon: latlong[1] }, 0);
                } else {
                    // happens before map ready
                    appSettings.setString('mapFocusPos', `{"lat":${latlong[0]},"lon":${latlong[1]}}`);
                }
            }
            if (appURL.params.has('z')) {
                const zoom = parseFloat(appURL.params.get('z'));
                if (loaded) {
                    this._cartoMap.setZoom(zoom, 0);
                } else {
                    appSettings.setNumber('mapZoom', zoom);
                }
            }
            if (appURL.params.has('q')) {
                const geoTextRegexp = /([\d\.-]+),([\d\.-]+)\((.*?)\)/;
                const query = appURL.params.get('q');
                const match = query.match(geoTextRegexp);
                const actualQuery = decodeURIComponent(query).replace(/[+]/g, ' ');
                if (match) {
                    this.selectItem(
                        {
                            properties: {
                                name: actualQuery
                            },
                            position: {
                                lat: parseFloat(match[1]),
                                lon: parseFloat(match[2])
                            }
                        },
                        true
                    );
                } else {
                    this.showLoading(this.$tc(`searching_for:${actualQuery}`));
                    this.$packageService
                        .searchInPackageGeocodingService({
                            projection: this.mapProjection,
                            query: actualQuery.replace(/[,]/g, ' ')
                        })
                        .then(result => {
                            if (result.length > 0) {
                                console.log('found it!', this.$packageService.prepareGeoCodingResult(result[0]));
                                this.selectItem(this.$packageService.prepareGeoCodingResult(result[0]), true, true, 16);
                            } else {
                                this.searchText = actualQuery.replace(/[,]/g, ' ');
                            }
                        })
                        .catch(err => this.showError(err))
                        .then(() => this.hideLoading());
                }
            }
        }
    }

    // get cartoMap() {
    //     return this.$refs.cartoMap && this.$refs.cartoMap.nativeView;
    // }

    get customSources() {
        return this.mapModules['customLayers'].customSources;
    }

    get shouldShowNavigationBarOverlay() {
        return gVars.isAndroid && navigationBarHeight !== 0 && !!this.mSelectedItem;
    }
    get bottomSheetDecale() {
        return navigationBarHeight;
    }

    get watchingLocation() {
        return this.mapModules && this.mapModules.userLocation.watchingLocation;
    }
    get queryingLocation() {
        return this.mapModules && this.mapModules.userLocation.queryingLocation;
    }
    @profile
    mounted() {
        super.mounted();

        // if (gVars.isAndroid) {
        // (this.$refs.fab.nativeView as GridLayout).getChildAt(0).marginBottom = -navigationBarHeight;
        // this.nativeView.marginBottom = navigationBarHeight;
        // this.overMapWidgets.nativeView.marginBottom = layout.toDevicePixels(navigationBarHeight);
        // }
        this.log('onMapMounted', !!this.geoHandler);
        this.searchView = this.$refs.searchView;
        this.$setMapComponent(this);
        this.mapModules = {
            items: new ItemsModule(),
            userLocation: new UserLocationModule(),
            customLayers: new CustomLayersModule(),
            formatter: new ItemFormatter(),
            directionsPanel: this.topSheet,
            search: this.searchView,
            rightMenu: null,
            mapScrollingWidgets: this.$refs.mapScrollingWidgets,
            bottomSheet: this.bottomSheet
        };

        if (!!this.geoHandler) {
            this.runOnModules('onServiceLoaded', this.geoHandler);
        }
        // this.log('mounted', App.cartoLicenseRegistered, Object.keys(this.mapModules), !!this.searchView);
        // this.mapModules.userLocation.on('location', this.onNewLocation, this);

        defaultLiveSync = global.__onLiveSync.bind(global);
        global.__onLiveSync = (...args) => {
            this.log('__onLiveSync', args);
            const context = args[0];
            if (!context && !!this.currentLayerStyle && !this.currentLayerStyle.endsWith('.zip')) {
                this.reloadMapStyle && this.reloadMapStyle();
            }
            defaultLiveSync.apply(global, args);
        };
    }
    onDeviceScreen(isScreenOn: boolean) {
        this.log('onDeviceScreen', isScreenOn);
    }
    onLoaded() {
        // this.$getAppComponent().$on('screen', this.onDeviceScreen);
        // }, 0);
    }
    destroyed() {
        this.log('onMapDestroyed');
        this.runOnModules('onMapDestroyed');
        // this.$getAppComponent().$off('screen', this.onDeviceScreen);
        this.$setMapComponent(null);
        // this.mapModules.userLocation.off('location', this.onNewLocation, this);
        this.mapModules = null;

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
        // this.log('runOnModules', Object.keys(this.mapModules));
        if (!this.mapModules) {
            return;
        }
        let m: MapModule;
        return Object.keys(this.mapModules).some(k => {
            m = this.mapModules[k];
            // this.log('call module', k, functionName, m && m.constructor.name, m && !!m[functionName]);
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
        this.log('onServiceLoaded', !!geoHandler);
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
        // this.log('onMapMove');
        // const bearing = cartoMap.bearing;
        // this.log('onMapMove', bearing);
        // this.currentMapRotation = Math.round(bearing * 100) / 100;
        this.runOnModules('onMapMove', e);
        this.unFocusSearch();
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
        // this.log('onMapIdle', zoom);
    }
    @throttle(100)
    saveSettings() {
        if (!this._cartoMap) {
            return;
        }
        const cartoMap = this._cartoMap;
        appSettings.setNumber('mapZoom', cartoMap.zoom);
        appSettings.setString('mapFocusPos', JSON.stringify(cartoMap.focusPos));
    }
    onMapStable(e) {
        const cartoMap = this.cartoMap;
        if (!cartoMap) {
            return;
        }
        this.saveSettings();
        this.runOnModules('onMapStable', e);
        const zoom = cartoMap.zoom;
        // this.log('onMapStable', zoom);
    }

    onMapReady(e) {
        const cartoMap = (this._cartoMap = e.object as CartoMap<LatLonKeys>);

        this.mapProjection = cartoMap.projection;
        if (gVars.isAndroid) {
            this.log('onMapReady', com.carto.ui.BaseMapView.getSDKVersion());
        } else {
            this.log('onMapReady');

        }

        const options = cartoMap.getOptions();
        options.setWatermarkScale(0.5);
        options.setWatermarkPadding(toNativeScreenPos({ x: 80, y: navigationBarHeight }));
        options.setRestrictedPanning(true);
        options.setSeamlessPanning(true);
        options.setEnvelopeThreadPoolSize(2);
        options.setTileThreadPoolSize(2);
        options.setZoomGestures(true);
        options.setRotatable(true);
        // options.setDrawDistance(8);
        this.showGlobe = appSettings.getBoolean('showGlobe', false);
        // console.log('test', JSON.parse('{"lat":45.2002,"lon":5.7222}'));
        const pos = JSON.parse(appSettings.getString('mapFocusPos', '{"lat":45.2002,"lon":5.7222}')) as MapPos<LatLonKeys>;
        const zoom = appSettings.getNumber('mapZoom', 10);
        // console.log('map start pos', pos, zoom);
        cartoMap.setFocusPos(pos, 0);
        cartoMap.setZoom(zoom, 0);
        setTimeout(() => {
            perms
                .request('storage')
                .then(status => {
                    this.$packageService.start();
                    this.runOnModules('onMapReady', this, cartoMap);
                    this.setMapStyle(appSettings.getString('mapStyle', 'mapsmexml'), true);
                })
                .catch(err => this.showError(err));
        }, 0);
    }

    createLocalMarker(position: MapPos<LatLonKeys>, options: MarkerStyleBuilderOptions) {
        this.getOrCreateLocalVectorLayer();
        const styleBuilder = new MarkerStyleBuilder(options);
        return new Marker<LatLonKeys>({ position, projection: this.mapProjection, styleBuilder });
    }
    createLocalPoint(position: MapPos<LatLonKeys>, options: PointStyleBuilderOptions) {
        this.getOrCreateLocalVectorLayer();
        const styleBuilder = new PointStyleBuilder(options);
        return new Point<LatLonKeys>({ position, projection: this.mapProjection, styleBuilder });
    }
    createLocalLine(positions: MapPos<LatLonKeys>[], options: LineStyleBuilderOptions) {
        this.getOrCreateLocalVectorLayer();
        const styleBuilder = new LineStyleBuilder(options);
        return new Line<LatLonKeys>({ positions, projection: this.mapProjection, styleBuilder });
    }
    selectItem(item: Item, isFeatureInteresting = false, peek = true, zoom?: number) {
        this.log('selectItem', isFeatureInteresting);
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
            // console.log('selected_id', item.properties, item.route);
            // const vectorTileDecoder = this.getVectorTileDecoder();
            // vectorTileDecoder.setStyleParameter('selected_id', ((item.properties && item.properties.osm_id) || '') + '');
            // vectorTileDecoder.setStyleParameter('selected_name', (item.properties && item.properties.name) || '');

            this.bottomSheetHolder.peek();
            if (item.zoomBounds) {
                const zoomLevel = getBoundsZoomLevel(item.zoomBounds, { width: screen.mainScreen.widthPixels, height: screen.mainScreen.heightPixels });
                this.cartoMap.setZoom(zoomLevel, 200);
                this.cartoMap.setFocusPos(getCenter(item.zoomBounds.northeast, item.zoomBounds.southwest), 200);
            } else {
                if (zoom) {
                    this.cartoMap.setZoom(zoom, 200);
                }
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
            // const vectorTileDecoder = this.getVectorTileDecoder();
            // vectorTileDecoder.setStyleParameter('selected_id', '0');
            // vectorTileDecoder.setStyleParameter('selected_name', '');
        }
    }
    cancelDirections() {
        this.mapModules.directionsPanel.cancel();
    }
    onMapClicked(e) {
        const { clickType, position } = e.data;
        // this.log('onMapClicked', clickType, position);
        const handledByModules = this.runOnModules('onMapClicked', e);
        if (!handledByModules && clickType === ClickType.SINGLE) {
            this.selectItem({ position }, false);
            this.runOnModules('onMapClicked', e);
        }
        this.unFocusSearch();
    }
    onVectorTileClicked(data: VectorTileEventData<LatLonKeys>) {
        const { clickType, position, featureLayerName, featureData, featurePosition } = data;
        const featureDataWithoutName = JSON.parse(JSON.stringify(featureData));
        Object.keys(featureDataWithoutName).forEach(k => {
            if (k.startsWith('name:') || k.startsWith('name_')) {
                delete featureDataWithoutName[k];
            }
        });
        this.log('onVectorTileClicked', featureLayerName, featureData.class, featureData.subclass, featureDataWithoutName, position, featurePosition);
        // return false;
        const handledByModules = this.runOnModules('onVectorTileClicked', data);
        if (!handledByModules && clickType === ClickType.SINGLE) {
            const map = this._cartoMap;
            featureData.layer = featureLayerName;

            if (
                featureLayerName === 'transportation' ||
                featureLayerName === 'waterway' ||
                featureLayerName === 'hillshade' ||
                featureLayerName === 'transportation_name' ||
                featureLayerName === 'contour' ||
                featureLayerName === 'building' ||
                featureLayerName === 'landcover' ||
                featureLayerName === 'landuse'
            ) {
                return false;
            }
            // const distanceFromClick = distance(map.mapToScreen(position), map.mapToScreen(featurePosition));

            // console.log(
            //     `onVectorTileClicked distanceFromClick:${distanceFromClick}, elevation:${featureData.ele}, name:${featureData.name} layer: ${featureLayerName} class: ${featureData.class}`,
            //     actionBarHeight,
            //     this.bShow3DBuildings
            // );

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
                const radius = 10;
                this.$packageService
                    .searchInPackageReverseGeocodingService({
                        projection: this.mapProjection,
                        location: featurePosition,
                        searchRadius: radius
                    })
                    .then(res => {
                        // let foundBetterRes = false;
                        res.some(r => {
                            // console.log('found item search item', r, computeDistanceBetween(result.position, r.position));
                            if (computeDistanceBetween(result.position, r.position) <= radius && r.rank > 0.9) {
                                result = this.$packageService.prepareGeoCodingResult({ address: r.address as any, ...result });
                                console.log('search item', r.address, result);
                                return true;
                            }
                        });
                        // return foundBetterRes;
                    })
                    .then(() => {
                        this.selectItem(result, isFeatureInteresting);
                    })
                    .catch(err => {
                        console.error(err);
                    });
                // }
                // try {
                //     this.selectItem(result, isFeatureInteresting);
                // } catch (err) {}
            }
            this.unFocusSearch();

            // return true to only look at first vector found
            return isFeatureInteresting;
        }
        return handledByModules;
    }
    onVectorElementClicked(data: VectorElementEventData<LatLonKeys>) {
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
    // get searchView() {
    // return this.$refs[''] as Search;
    // }
    searchView: Search;
    unFocusSearch() {
        // this.log('unFocusSearch', !!this.searchView, !!this.searchView && this.searchView.hasFocus);
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
        // this.log('set showContourLines', value);
        this.bShowContourLines = value;
        if (this.currentLayer) {
            this.reloadMapStyle();
        }
        // this.getVectorTileDecoder().setStyleParameter('contours', value ? '1' : '0');
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
    _zoomBiais: string;
    get zoomBiais() {
        if (this._zoomBiais === undefined) {
            this._zoomBiais = appSettings.getString('zoomBiais', '0');
        }
        return this._zoomBiais;
    }
    set zoomBiais(value: string) {
        // this.log('setting zoomBiais', value);
        this._zoomBiais = value;
        if (this.currentLayer) {
            this.currentLayer.zoomLevelBias = parseFloat(value);
        }
        // const vectorTileDecoder = this.getVectorTileDecoder();
        // vectorTileDecoder.setStyleParameter('zoomBiais', value.toFixed());
    }
    bPreloading = appSettings.getBoolean('preloading', false);
    get preloading() {
        return this.bPreloading;
    }
    set preloading(value: boolean) {
        this.bPreloading = value;
        if (this.currentLayer) {
            this.currentLayer.preloading = value;
        }
    }
    setCurrentLayer(id: string) {
        this.log('setCurrentLayer', id, this.zoomBiais, this.preloading);
        // const cartoMap = this._cartoMap;
        if (this.currentLayer) {
            this.removeLayer(this.currentLayer, 'map');
            this.currentLayer.setVectorTileEventListener(null);
            this.currentLayer = null;
        }
        this.currentLayerStyle = id;
        const vectorTileDecoder = this.getVectorTileDecoder();

        this.currentLayer = new VectorTileLayer({
            preloading: this.preloading,
            zoomLevelBias: parseFloat(this.zoomBiais),
            dataSource: this.$packageService.getDataSource(this.showContourLines),
            decoder: vectorTileDecoder
        });
        this.updateLanguage(this.currentLanguage);
        this.show3DBuildings = appSettings.getBoolean('show3DBuildings', false);
        // this.showContourLines = appSettings.getBoolean('showContourLines', false);
        // clog('currentLayer', !!this.currentLayer);
        this.currentLayer.setLabelRenderOrder(VectorTileRenderOrder.LAST);
        this.currentLayer.setVectorTileEventListener(this, this.mapProjection);
        try {
            this.addLayer(this.currentLayer, 'map');
        } catch (err) {
            this.showError(err);
            this.vectorTileDecoder = null;
        }
        // clog('setCurrentLayer', 'done');
    }

    clearCache() {
        this.currentLayer && this.currentLayer.clearTileCaches(true);
        this.$packageService.clearCache();
    }
    updateLanguage(code: string) {
        appSettings.setString('language', code);
        this.currentLanguage = code;
        this.$packageService.currentLanguage = code;
        if (this.currentLayer === null) {
            return;
        }
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
    setMapStyle(layerStyle: string, force = false) {
        if (!layerStyle) {
            return;
        }
        layerStyle = layerStyle.toLowerCase()
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
        // console.log('onLayerOpacityChanged', item.name, event.value, item.opacity);
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
                title: this.$tc('select_style'),
                actions: files.map(e => e.name).concat(this.$tc('default'))
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
            console.log('selected language', result);
            result && this.updateLanguage(result);
        });
    }

    downloadPackages() {
        // const ComponentClass = Vue.extend(PackagesDownloadComponent);
        let instance = new PackagesDownloadComponent();
        instance.$mount();
        // this.log('downloadPackages', instance, instance.nativeView);
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
    removeLayer(layer: Layer<any, any>, layerId: LayerType, offset?: number) {
        const realLayerId = offset ? layerId + offset : layerId;
        const index = this.addedLayers.indexOf(realLayerId);
        // this.log('removeLayer', layerId, realLayerId, this.addedLayers, index);
        if (index !== -1) {
            this.addedLayers.splice(index, 1);
        }
        this._cartoMap.removeLayer(layer);
    }
    addLayer(layer: Layer<any, any>, layerId: LayerType, offset?: number) {
        const realLayerId = offset ? layerId + offset : layerId;
        // this.log('addLayer', layerId, realLayerId, offset, !!this._cartoMap, this.addedLayers.indexOf(layerId), this.addedLayers);
        if (this._cartoMap) {
            if (this.addedLayers.indexOf(realLayerId) !== -1) {
                return;
            }
            const layerIndex = LAYERS_ORDER.indexOf(layerId);
            // this.log('layerIndex', layerIndex);
            let realIndex = 0;
            this.addedLayers.some(s => {
                if (LAYERS_ORDER.indexOf(s as any) < layerIndex) {
                    realIndex++;
                    return false;
                }
                return true;
            });
            // for (let i = 0; i < index; i++) {
            //     if (this.addedLayers.indexOf(LAYERS_ORDER[i]) !== -1) {
            //         realIndex++;
            //     }
            // }
            // this.log('addedLayer about to add layer', layerId, realIndex, this.addedLayers.length);
            if (realIndex >= 0 && realIndex < this.addedLayers.length) {
                const index = realIndex + (offset || 0);
                this._cartoMap.addLayer(layer, index);
                this.addedLayers.splice(index, 0, realLayerId);
            } else {
                this._cartoMap.addLayer(layer);
                this.addedLayers.push(realLayerId);
            }
            // this.log('addedLayer', layerId, realIndex, offset, this.addedLayers);
            this._cartoMap.requestRedraw();
        }
    }
    mBottomSheetTranslation = 0;
    get bottomSheetTranslation() {
        const result = this.mBottomSheetTranslation + navigationBarHeight;
        // if (gVars.isAndroid) {
        //     result += 48;
        // }
        return result;
    }
    topSheetTranslation = DEFAULT_TOP;
    bottomSheetPercentage = 0;
    get scrollingWidgetsOpacity() {
        if (this.bottomSheetPercentage <= 0.5) {
            return 1;
        }
        return 4 * (2 - 2 * this.bottomSheetPercentage) - 3;
    }
    onBottomSheetScroll(e: BottomSheetHolderScrollEventData) {
        // console.log('onBottomSheetScroll', e);
        this.mBottomSheetTranslation = e.height;
        this.bottomSheetPercentage = e.percentage;
    }
    onTopSheetScroll(e: TopSheetHolderScrollEventData) {
        // console.log('onTopSheetScroll', e.height, e.bottom);
        this.topSheetTranslation = e.bottom;
        // this.bottomSheetPercentage = e.percentage;
    }

    public showKeepAwakeNotification() {
        if (gVars.isAndroid) {
            const context: android.content.Context = ad.getApplicationContext();
            const builder = new androidx.core.app.NotificationCompat.Builder(context, NOTIFICATION_CHANEL_ID_KEEP_AWAKE_CHANNEL);

            // create notification channel
            const color = android.graphics.Color.parseColor(this.accentColor);
            NotificationHelper.createNotificationChannel(context);

            const activityClass = (com as any).tns.NativeScriptActivity.class;
            const tapActionIntent = new android.content.Intent(context, activityClass);
            tapActionIntent.setAction(android.content.Intent.ACTION_MAIN);
            tapActionIntent.addCategory(android.content.Intent.CATEGORY_LAUNCHER);
            const tapActionPendingIntent = android.app.PendingIntent.getActivity(context, 10, tapActionIntent, 0);

            // construct notification in builder
            builder.setVisibility(androidx.core.app.NotificationCompat.VISIBILITY_SECRET);
            builder.setShowWhen(false);
            builder.setOngoing(true);
            builder.setColor(color);
            builder.setOnlyAlertOnce(true);
            builder.setPriority(androidx.core.app.NotificationCompat.PRIORITY_MIN);
            builder.setContentIntent(tapActionPendingIntent);
            builder.setSmallIcon(ad.resources.getDrawableId('ic_stat_logo'));
            builder.setContentTitle('Alpi Maps is keeping the screen awake');
            // builder.setLargeIcon();
            const notifiction = builder.build();
            const service = context.getSystemService(android.content.Context.NOTIFICATION_SERVICE) as android.app.NotificationManager;
            service.notify(KEEP_AWAKE_NOTIFICATION_ID, notifiction);
        }
    }

    public hideKeepAwakeNotification() {
        if (gVars.isAndroid) {
            const context: android.content.Context = ad.getApplicationContext();
            const service = context.getSystemService(android.content.Context.NOTIFICATION_SERVICE) as android.app.NotificationManager;
            service.cancel(KEEP_AWAKE_NOTIFICATION_ID);
        }
    }

    switchKeepAwake() {
        // this.log('switchKeepAwake', this.keepAwake);
        if (this.keepAwake) {
            allowSleepAgain()
                .then(() => {
                    this.keepAwake = false;
                    this.hideKeepAwakeNotification();
                    // this.log('allowSleepAgain done', this.keepAwake);
                })
                .catch(err => this.showError(err));
        } else {
            keepAwake()
                .then(() => {
                    this.keepAwake = true;
                    this.showKeepAwakeNotification();
                    // this.log('keepAwake done', this.keepAwake);
                })
                .catch(err => this.showError(err));
        }
    }

    switchLocationInfo() {
        this.mapModules.mapScrollingWidgets.showLocationInfo = !this.mapModules.mapScrollingWidgets.showLocationInfo;
    }

    shareScreenshot() {
        this.cartoMap.captureRendering(true).then(result => {
            SocialShare.shareImage(result);
        });
    }
}
