import { AndroidActivityBackPressedEventData } from '@nativescript/core/application/application-interfaces';
import { AppURL, handleOpenURL } from '@nativescript-community/appurl';
import * as EInfo from '@nativescript-community/extendedinfo';
import * as perms from '@nativescript-community/perms';
import { CartoMapStyle, ClickType, MapPos, toNativeScreenPos } from '@nativescript-community/ui-carto/core';
import { PersistentCacheTileDataSource } from '@nativescript-community/ui-carto/datasources/cache';
import { LocalVectorDataSource } from '@nativescript-community/ui-carto/datasources/vector';
import { Layer } from '@nativescript-community/ui-carto/layers';
import {
    CartoOnlineVectorTileLayer,
    VectorElementEventData,
    VectorLayer,
    VectorTileEventData,
    VectorTileLayer,
    VectorTileRenderOrder,
} from '@nativescript-community/ui-carto/layers/vector';
import { Projection } from '@nativescript-community/ui-carto/projections';
import { CartoMap, PanningMode, RenderProjectionMode } from '@nativescript-community/ui-carto/ui';
import { setShowDebug, setShowError, setShowInfo, setShowWarn } from '@nativescript-community/ui-carto/utils';
import { Line, LineStyleBuilder, LineStyleBuilderOptions } from '@nativescript-community/ui-carto/vectorelements/line';
import { Marker, MarkerStyleBuilder, MarkerStyleBuilderOptions } from '@nativescript-community/ui-carto/vectorelements/marker';
import { Point, PointStyleBuilder, PointStyleBuilderOptions } from '@nativescript-community/ui-carto/vectorelements/point';
import { MBVectorTileDecoder } from '@nativescript-community/ui-carto/vectortiles';
import { Drawer } from '@nativescript-community/ui-drawer';
import { action, login } from '@nativescript-community/ui-material-dialogs';
import { TextField } from '@nativescript-community/ui-material-textfield';
import { Brightness } from '@nativescript/brightness';
import { AndroidApplication, Application, Color } from '@nativescript/core';
import * as appSettings from '@nativescript/core/application-settings';
import { Folder, knownFolders, path } from '@nativescript/core/file-system';
import { Device, Screen } from '@nativescript/core/platform';
import { profile } from '@nativescript/core/profiling';
import { ad } from '@nativescript/core/utils/utils';
import { compose } from '@nativescript/email';
import { throttle } from 'helpful-decorators';
import { allowSleepAgain, keepAwake } from 'nativescript-insomnia';
import * as SocialShare from 'nativescript-social-share';
import tinycolor from 'tinycolor2';
import { Component, Prop } from 'vue-property-decorator';
import { GeoHandler } from '~/handlers/GeoHandler';
import { $t } from '~/helpers/locale';
import CustomLayersModule, { SourceItem } from '~/mapModules/CustomLayersModule';
import ItemFormatter from '~/mapModules/ItemFormatter';
import ItemsModule from '~/mapModules/ItemsModule';
import MapModule from '~/mapModules/MapModule';
import UserLocationModule from '~/mapModules/UserLocationModule';
import { IItem } from '~/models/Item';
import { NOTIFICATION_CHANEL_ID_KEEP_AWAKE_CHANNEL, NotificationHelper } from '~/services/android/NotifcationHelper';
import { computeDistanceBetween, getBoundsZoomLevel, getCenter } from '~/utils/geo';
import { Sentry, isSentryEnabled } from '~/utils/sentry';
import { screenHeightDips, screenWidthDips } from '~/variables';
import { actionBarButtonHeight, navigationBarHeight, primaryColor } from '../variables';
import BgServiceComponent from './BgServiceComponent';
import BottomSheetHolder, { BottomSheetHolderScrollEventData } from './BottomSheet/BottomSheetHolder';
import BottomSheetInner from './BottomSheetInner';
import DirectionsPanel from './DirectionsPanel';
import LocationInfoPanel from './LocationInfoPanel';
import MapRightMenu from './MapRightMenu';
import MapScrollingWidgets from './MapScrollingWidgets';
import PackagesDownloadComponent from './PackagesDownloadComponent';
import Search from './Search';
import TopSheetHolder, { DEFAULT_TOP, TopSheetHolderScrollEventData } from './TopSheetHolder';
const KEEP_AWAKE_NOTIFICATION_ID = 23466578;

// function distance(pos1: ScreenPos, pos2: ScreenPos) {
//     return Math.sqrt(Math.pow(pos1.x - pos2.x, 2) + Math.pow(pos1.y - pos2.y, 2));
// }
const mailRegexp = /(?:[a-z0-9!#$%&'*+/=?^_`{|}~-]+(?:\.[a-z0-9!#$%&'*+/=?^_`{|}~-]+)*|"(?:[\x01-\x08\x0b\x0c\x0e-\x1f\x21\x23-\x5b\x5d-\x7f]|\\[\x01-\x09\x0b\x0c\x0e-\x7f])*")@(?:(?:[a-z0-9](?:[a-z0-9-]*[a-z0-9])?\.)+[a-z0-9](?:[a-z0-9-]*[a-z0-9])?|\[(?:(?:25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)\.){3}(?:25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?|[a-z0-9-]*[a-z0-9]:(?:[\x01-\x08\x0b\x0c\x0e-\x1f\x21-\x5a\x53-\x7f]|\\[\x01-\x09\x0b\x0c\x0e-\x7f])+)\])/;

function base64Encode(value) {
    if (global.isIOS) {
        const text = NSString.stringWithString(value);
        const data = text.dataUsingEncoding(NSUTF8StringEncoding);
        return data.base64EncodedStringWithOptions(0);
    }
    if (global.isAndroid) {
        const text = new java.lang.String(value);
        const data = text.getBytes('UTF-8');
        return android.util.Base64.encodeToString(data, android.util.Base64.DEFAULT);
    }
}
export type LayerType = 'map' | 'customLayers' | 'selection' | 'items' | 'directions' | 'userLocation' | 'search';

const LAYERS_ORDER: LayerType[] = ['map', 'customLayers', 'selection', 'items', 'directions', 'search', 'userLocation'];

const brightness = new Brightness();

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
    bottomSheet: BottomSheetInner;
}

let defaultLiveSync = global.__onLiveSync;
@Component({
    components: {
        BottomSheetInner,
        TopSheetHolder,
        Search,
        // MapWidgets,
        LocationInfoPanel,
        MapRightMenu,
        MapScrollingWidgets,
    },
})
export default class Map extends BgServiceComponent {
    mapModules: MapModules = null;
    isSentryEnabled = isSentryEnabled;
    appVersion = EInfo.getVersionNameSync() + '.' + EInfo.getBuildNumberSync();
    bottomSheetStepIndex = 0;
    packageServiceEnabled = gVars.packageServiceEnabled;
    @Prop({ default: false }) readonly licenseRegistered!: boolean;
    // @Watch('licenseRegistered')
    // onLicenseRegisteredChanged(value) {
    // console.log('onLicenseRegisteredChanged', value);
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
    // selectedRouteLine: Line<LatLonKeys>;
    mSelectedItem: IItem = null;
    itemLoading = false;
    mapProjection: Projection = null;
    currentLanguage = appSettings.getString('language', 'en');
    addedLayers: string[] = [];

    keepAwake = false;

    currentMapRotation = 0;

    set selectedItem(value) {
        this.runOnModules('onSelectedItem', value, this.mSelectedItem);
        this.mSelectedItem = value;
        this.bottomSheet.onSelectedItemChange(value);
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

    get rightMenu() {
        return this.$refs['rightMenu'] as MapRightMenu;
    }
    get bottomSheet() {
        return (this.$refs['bottomSheet'] as BottomSheetInner) || null;
    }
    get drawer() {
        return (this.$refs['drawer'] as Drawer) || null;
    }
    get topSheetHolder() {
        return this.$refs['topSheetHolder'] as TopSheetHolder;
    }
    get locationInfoPanel() {
        return this.$refs['locationInfo'] as LocationInfoPanel;
    }
    get topSheet() {
        return this.topSheetHolder.topSheet;
    }
    get shouldShowFullHeight() {
        return !!this.mSelectedItem && !!this.mSelectedItem.route;
    }
    constructor() {
        super();
        handleOpenURL(this.onAppUrl);
        this.keepAwake = appSettings.getBoolean('keepAwake', false);
        if (this.keepAwake) {
            this.showKeepAwakeNotification();
        }
    }
    searchText: string = null;
    handleReceivedAppUrl(appURL: AppURL) {
        console.log('Got the following appURL', appURL.path, Array.from(appURL.params.entries()));
        if (appURL.path.startsWith('eo')) {
            const latlong = appURL.path.split(':')[1].split(',').map(parseFloat) as [number, number];
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
                    this.selectItem({
                        item: {
                            properties: {
                                name: actualQuery,
                            },
                            position: {
                                lat: parseFloat(match[1]),
                                lon: parseFloat(match[2]),
                            },
                        },
                        isFeatureInteresting: true,
                    });
                } else {
                    this.searchView.searchForQuery(actualQuery);
                }
            }
        } else if (appURL.path && appURL.path.endsWith('.gpx')) {
            console.log('importing GPX', appURL.path);
        }
    }
    onAppUrl(appURL: AppURL, args) {
        if (global.isAndroid) {
            const activity = Application.android.startActivity;
            const visible = activity && activity.getWindow().getDecorView().getRootView().isShown();
            if (!visible) {
                if (args && args.eventName === AndroidApplication.activityStartedEvent) {
                    //ignoring newIntent in background as we already received start activity event with intent
                    return;
                } else {
                }
            }
        }
        try {
            this.handleReceivedAppUrl(appURL);
        } catch (err) {
            console.log(err);
        }
    }

    // get cartoMap() {
    //     return this.$refs.cartoMap && this.$refs.cartoMap.nativeView;
    // }

    get customSources() {
        return this.mapModules['customLayers'].customSources;
    }

    get shouldShowNavigationBarOverlay() {
        return global.isAndroid && navigationBarHeight !== 0 && !!this.mSelectedItem;
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
        if (global.isAndroid) {
            Application.android.on(AndroidApplication.activityBackPressedEvent, this.onAndroidBackButton);
        }

        // if (global.isAndroid) {
        // (this.$refs.fab.nativeView as GridLayout).getChildAt(0).marginBottom = -navigationBarHeight;
        // this.nativeView.marginBottom = navigationBarHeight;
        // this.overMapWidgets.nativeView.marginBottom = layout.toDevicePixels(navigationBarHeight);
        // }
        this.searchView = this.$refs.searchView;
        this.$setMapComponent(this);
        this.mapModules = {
            items: new ItemsModule(),
            userLocation: new UserLocationModule(),
            customLayers: new CustomLayersModule(),
            formatter: new ItemFormatter(),
            directionsPanel: this.topSheet,
            search: this.searchView,
            rightMenu: this.$refs.rightMenu,
            mapScrollingWidgets: this.$refs.mapScrollingWidgets,
            bottomSheet: this.bottomSheet,
        };

        if (!!this.geoHandler) {
            this.runOnModules('onServiceLoaded', this.geoHandler);
        }
        // this.log('mounted', App.cartoLicenseRegistered, Object.keys(this.mapModules), !!this.searchView);
        // this.mapModules.userLocation.on('location', this.onNewLocation, this);

        if (DEV_LOG) {
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
    }
    onDeviceScreen(isScreenOn: boolean) {
        this.log('onDeviceScreen', isScreenOn);
    }
    onLoaded() {}
    destroyed() {
        this.log('onMapDestroyed');
        this.runOnModules('onMapDestroyed');
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
        // this.selectedRouteLine = null;
        super.destroyed();
    }
    onAndroidBackButton(data: AndroidActivityBackPressedEventData) {
        data.cancel = true;
        Application.android.foregroundActivity.moveTaskToBack(true);
    }
    showMapMenu() {
        this.drawer.open('right');
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
        return Object.keys(this.mapModules).some((k) => {
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
        this.runOnModules('onServiceLoaded', geoHandler);
    }
    onServiceUnloaded(geoHandler: GeoHandler) {
        this.runOnModules('onServiceUnloaded', geoHandler);
    }

    resetBearing() {
        this._cartoMap.setBearing(0, 200);
    }
    onMapMove(e) {
        const cartoMap = this._cartoMap;
        if (!cartoMap) {
            return;
        }
        const bearing = cartoMap.bearing;
        this.currentMapRotation = Math.round(bearing * 100) / 100;
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

    async onMapReady(e) {
        const cartoMap = (this._cartoMap = e.object as CartoMap<LatLonKeys>);
        console.log('onMapReady', cartoMap);
        // CartoMap.setRunOnMainThread(false);
        setShowDebug(DEV_LOG);
        setShowInfo(DEV_LOG);
        setShowWarn(DEV_LOG);
        setShowError(true);
        this.mapProjection = cartoMap.projection;
        if (global.isAndroid) {
            this.log('onMapReady', com.carto.ui.BaseMapView.getSDKVersion());
        } else {
            this.log('onMapReady', cartoMap.nativeViewProtected as NTMapView);
        }

        const options = cartoMap.getOptions();
        options.setWatermarkScale(0);
        // options.setWatermarkPadding(toNativeScreenPos({ x: 80, y: navigationBarHeight }));
        options.setRestrictedPanning(true);
        options.setPanningMode(PanningMode.PANNING_MODE_STICKY);
        options.setSeamlessPanning(true);
        options.setEnvelopeThreadPoolSize(2);
        options.setTileThreadPoolSize(2);
        options.setZoomGestures(true);
        options.setRotatable(true);
        // options.setDrawDistance(8);
        this.bShowGlobe = appSettings.getBoolean('showGlobe', false);
        options.setRenderProjectionMode(
            this.bShowGlobe
                ? RenderProjectionMode.RENDER_PROJECTION_MODE_SPHERICAL
                : RenderProjectionMode.RENDER_PROJECTION_MODE_PLANAR
        );
        // console.log('test', JSON.parse('{"lat":45.2002,"lon":5.7222}'));
        const pos = JSON.parse(appSettings.getString('mapFocusPos', '{"lat":45.2002,"lon":5.7222}')) as MapPos<LatLonKeys>;
        const zoom = appSettings.getNumber('mapZoom', 10);
        // console.log('map start pos', pos, zoom);
        cartoMap.setFocusPos(pos, 0);
        cartoMap.setZoom(zoom, 0);
        // setTimeout(() => {
        try {
            const status = await perms.request('storage');
            if (gVars.packageServiceEnabled) {
                this.$packageService.start();
            }
            // setTimeout(() => {
            // }, 100);
            // appSettings.remove('mapStyle');
            this.setMapStyle(appSettings.getString('mapStyle', 'osmxml'), true);
            this.show3DBuildings = this.rightMenu.show3DBuildings;
            this.showContourLines = this.rightMenu.showContourLines;
            this.runOnModules('onMapReady', this, cartoMap);
        } catch (err) {
            this.showError(err);
        }
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
    selectItem({
        item,
        isFeatureInteresting = false,
        peek = true,
        setSelected = true,
        showButtons = false,
        zoom,
    }: {
        item: IItem;
        showButtons?: boolean;
        isFeatureInteresting: boolean;
        peek?: boolean;
        setSelected?: boolean;
        zoom?: number;
    }) {
        if (isFeatureInteresting) {
            if (item.route) {
                const vectorElement = item.vectorElement as Line;
                if (vectorElement) {
                    const color = new Color(vectorElement.color as string);
                    vectorElement.color = new tinycolor({ r: color.r, g: color.g, b: color.b, a: color.a / 255 })
                        .darken(10)
                        .toRgbString();
                    vectorElement.width += 2;
                }
                // if (!this.selectedRouteLine) {
                //     this.selectedRouteLine = this.createLocalLine(item.route.positions, {
                //         // color: '#55ff0000',
                //         color: '#99ffffff',
                //         // visible: false,
                //         joinType: LineJointType.ROUND,
                //         endType: LineEndType.ROUND,
                //         width: (item.styleOptions ? item.styleOptions.width : 6) + 2,
                //         clickWidth: 0

                //         // orientationMode: BillboardOrientation.GROUND,
                //         // scalingMode: BillboardScaling.SCREEN_SIZE
                //     });
                //     this.localVectorDataSource.add(this.selectedRouteLine);
                // } else {
                //     this.selectedRouteLine.positions = item.route.positions;
                //     this.selectedRouteLine.visible = true;
                // }
                if (this.selectedPosMarker) {
                    this.selectedPosMarker.visible = false;
                }
            } else {
                if (!this.selectedPosMarker) {
                    this.selectedPosMarker = this.createLocalPoint(item.position, {
                        // color: '#55ff0000',
                        color: tinycolor(primaryColor).setAlpha(0.7).toRgbString(),
                        scaleWithDPI: true,
                        size: 30,
                        // orientationMode: BillboardOrientation.GROUND,
                        // scalingMode: BillboardScaling.SCREEN_SIZE
                    });
                    this.localVectorDataSource.add(this.selectedPosMarker);
                } else {
                    this.selectedPosMarker.position = item.position;
                    this.selectedPosMarker.visible = true;
                }
                // if (this.selectedRouteLine) {
                //     this.selectedRouteLine.visible = false;
                // }
            }
            // item.route = {
            //     instructions: Array.from({length: 40}, () => ({
            //         position: null,
            //         action: "left",
            //         azimuth: 0,
            //         distance: 0,
            //         time: 0,
            //         turnAngle: 0,
            //         streetName: 'toto'
            //     }))
            // } as any
            if (setSelected) {
                this.selectedItem = item;
            }

            if (
                !item.route &&
                (!item.properties || !item.properties.hasOwnProperty('ele')) &&
                this.$packageService.hillshadeLayer
            ) {
                this.$packageService.getElevation(item.position).then((result) => {
                    if (this.selectedItem.position === item.position) {
                        this.selectedItem.properties = this.selectedItem.properties || {};
                        this.selectedItem.properties['ele'] = result;
                        this.selectedItem = { ...this.selectedItem };
                    }
                });
                // console.log('get elevation done ', item);
            }
            // console.log('selectedItem', item);
            // const vectorTileDecoder = this.getVectorTileDecoder();
            // vectorTileDecoder.setStyleParameter('selected_id', ((item.properties && item.properties.osm_id) || '') + '');
            // vectorTileDecoder.setStyleParameter('selected_name', (item.properties && item.properties.name) || '');
            if (peek) {
                this.bottomSheetStepIndex = showButtons ? 2 : 1;
            }
            if (item.zoomBounds) {
                const zoomLevel = getBoundsZoomLevel(item.zoomBounds, {
                    width: Screen.mainScreen.widthPixels,
                    height: Screen.mainScreen.heightPixels,
                });
                this.cartoMap.moveToFitBounds(item.zoomBounds, undefined, true, true, false, 200);
                // this.cartoMap.setZoom(zoomLevel, 200);
                // this.cartoMap.setFocusPos(getCenter(item.zoomBounds.northeast, item.zoomBounds.southwest), 200);
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
        // this.log('unselectItem', !!this.mSelectedItem);
        if (!!this.mSelectedItem) {
            const item = this.selectedItem;
            this.selectedItem = null;
            if (this.selectedPosMarker) {
                this.selectedPosMarker.visible = false;
            }
            if (item.route) {
                const vectorElement = item.vectorElement as Line;
                if (vectorElement) {
                    const color = new Color(vectorElement.color as string);

                    vectorElement.color = new tinycolor({ r: color.r, g: color.g, b: color.b, a: color.a / 255 })
                        .lighten(10)
                        .toRgbString();
                    vectorElement.width -= 2;
                }
            }
            // if (this.selectedRouteLine) {
            //     this.selectedRouteLine.visible = false;
            // }
            this.bottomSheetStepIndex = 0;
            // const vectorTileDecoder = this.getVectorTileDecoder();
            // vectorTileDecoder.setStyleParameter('selected_id', '0');
            // vectorTileDecoder.setStyleParameter('selected_name', '');
        }
    }
    onStepIndexChanged() {
        if (this.bottomSheetStepIndex === 0) {
            this.unselectItem();
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
            this.selectItem({ item: { position, properties: {} }, isFeatureInteresting: !this.selectedItem });
            this.runOnModules('onMapClicked', e);
        }
        this.unFocusSearch();
    }
    onVectorTileClicked(data: VectorTileEventData<LatLonKeys>) {
        const { clickType, position, featureLayerName, featureData, featurePosition } = data;
        this.log('onVectorTileClicked', featureLayerName, featureData.class, featureData.subclass, featureData);
        const handledByModules = this.runOnModules('onVectorTileClicked', data);
        if (!handledByModules && clickType === ClickType.SINGLE) {
            if (
                featureLayerName === 'transportation' ||
                featureLayerName === 'transportation_name' ||
                featureLayerName === 'route' ||
                featureLayerName === 'contour' ||
                featureLayerName === 'hillshade' ||
                ((featureLayerName === 'waterway' ||
                    featureLayerName === 'building' ||
                    featureLayerName === 'park' ||
                    featureLayerName === 'landcover' ||
                    featureLayerName === 'landuse') &&
                    !featureData.name)
            ) {
                return false;
            }
            featureData.layer = featureLayerName;

            const isFeatureInteresting =
                !!featureData.name ||
                featureLayerName === 'poi' ||
                featureLayerName === 'mountain_peak' ||
                featureLayerName === 'housenumber';
            if (isFeatureInteresting) {
                const result: IItem = {
                    properties: featureData,
                    position: isFeatureInteresting ? featurePosition : position,
                };
                this.selectItem({ item: result, isFeatureInteresting });

                const service = this.$packageService.localOSMOfflineReverseGeocodingService;
                if (service) {
                    this.itemLoading = true;
                    const radius = 100;
                    this.$packageService
                        .searchInGeocodingService(service, {
                            projection: this.mapProjection,
                            location: featurePosition,
                            searchRadius: radius,
                        })
                        .then((res) => {
                            if (res) {
                                for (let index = 0; index < res.size(); index++) {
                                    const r = this.$packageService.convertGeoCodingResult(res.get(index));
                                    if (computeDistanceBetween(result.position, r.position) <= radius && r.rank > 0.9) {
                                        if (this.selectedItem.position === result.position) {
                                            this.selectedItem = this.$packageService.prepareGeoCodingResult({
                                                address: r.address as any,
                                                ...this.selectedItem,
                                            });
                                        }
                                        break;
                                    }
                                }
                            }
                        })
                        // .then(() => {
                        //     console.log('test about to select item', result);
                        //     this.selectItem({ item: result, isFeatureInteresting });
                        // })
                        .catch((err) => {
                            console.error(err);
                        });
                }
            }
            this.unFocusSearch();

            // return true to only look at first vector found
            return isFeatureInteresting;
        }
        return handledByModules;
    }
    onVectorElementClicked(data: VectorElementEventData<LatLonKeys>) {
        const { clickType, position, elementPos, metaData, element } = data;
        Object.keys(metaData).forEach((k) => {
            metaData[k] = JSON.parse(metaData[k]);
        });
        // console.log('metaData', metaData);
        const handledByModules = this.runOnModules('onVectorElementClicked', data);
        if (!handledByModules && clickType === ClickType.SINGLE) {
            const item: IItem = { position, vectorElement: element, ...metaData };
            // }
            if (item.route) {
                item.route.positions = (element as Line<LatLonKeys>).getPoses() as any;
            }
            this.selectItem({ item, isFeatureInteresting: true });
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
        this.cartoMap
            .getOptions()
            .setRenderProjectionMode(
                value ? RenderProjectionMode.RENDER_PROJECTION_MODE_SPHERICAL : RenderProjectionMode.RENDER_PROJECTION_MODE_PLANAR
            );
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
            decoder: vectorTileDecoder,
        });
        this.updateLanguage(this.currentLanguage);
        // console.log('currentLayer', !!this.currentLayer);
        this.currentLayer.setLabelRenderOrder(VectorTileRenderOrder.LAST);
        this.currentLayer.setVectorTileEventListener<LatLonKeys>(
            {
                onVectorTileClicked: (data) => this.onVectorTileClicked(data),
            },
            this.mapProjection
        );
        try {
            this.addLayer(this.currentLayer, 'map');
        } catch (err) {
            this.showError(err);
            this.vectorTileDecoder = null;
        }
        // console.log('setCurrentLayer', 'done');
    }

    clearCache() {
        this.currentLayer && this.currentLayer.clearTileCaches(true);
        this.$packageService.clearCache();
        this.cartoMap.requestRedraw();
    }
    updateLanguage(code: string) {
        appSettings.setString('language', code);
        this.currentLanguage = code;
        this.$packageService.currentLanguage = code;
        // if (this.currentLayer === null) {
        //     return;
        // }
        // const current = this.currentLayer;
        const decoder = this.vectorTileDecoder;
        if (!decoder) {
            return;
        }
        // this.log('updateLanguage', code, decoder);
        decoder.setStyleParameter('lang', code);
        decoder.setStyleParameter('fallback_lang', 'latin');
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
    @profile
    setMapStyle(layerStyle: string, force = false) {
        layerStyle = layerStyle.toLowerCase();
        if (layerStyle !== this.currentLayerStyle || !!force) {
            this.currentLayerStyle = layerStyle;
            appSettings.setString('mapStyle', layerStyle);
            const oldVectorTileDecoder = this.vectorTileDecoder;
            if (layerStyle === 'default' || layerStyle === 'voyager' || layerStyle === 'positron') {
                this.vectorTileDecoder = new CartoOnlineVectorTileLayer({
                    style: this.geteCartoMapStyleFromStyle(layerStyle),
                }).getTileDecoder();
            } else {
                try {
                    this.vectorTileDecoder = new MBVectorTileDecoder({
                        style: this.getStyleFromCartoMapStyle(this.currentLayerStyle),
                        liveReload: TNS_ENV !== 'production',
                        ...(layerStyle.endsWith('.zip')
                            ? { zipPath: `~/assets/styles/${layerStyle}` }
                            : { dirPath: `~/assets/styles/${layerStyle}` }),
                    });
                    this.runOnModules('vectorTileDecoderChanged', oldVectorTileDecoder, this.vectorTileDecoder);
                } catch (err) {
                    this.showError(err);
                    this.vectorTileDecoder = null;
                }
            }
            this.updateLanguage(this.currentLanguage);
            if (gVars.packageServiceEnabled) {
                this.setCurrentLayer(this.currentLayerStyle);
            }
        }
    }

    onLayerOpacityChanged(item, event) {
        const opacity = event.value / 100;
        item.layer.opacity = opacity;
        appSettings.setNumber(item.name + '_opacity', opacity);
        item.layer.visible = opacity !== 0;
        this.cartoMap.requestRedraw();
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
            actions: [$t('delete'), $t('clear_cache')],
        }).then((result) => {
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
                    // const PhotoViewer = require('nativescript-photoviewer');
                    // new PhotoViewer().showGallery([item.legend]);
                    break;
            }
        });
    }

    selectStyle() {
        console.log('selectStyle');
        const assetsFolder = Folder.fromPath(path.join(knownFolders.currentApp().path, 'assets', 'styles'));
        assetsFolder.getEntities().then((files) => {
            action({
                title: this.$tc('select_style'),
                actions: files.map((e) => e.name).concat(this.$tc('default')),
            }).then((result) => {
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
            actions: SUPPORTED_LOCALES,
        }).then((result) => {
            console.log('result', result);
            result && this.updateLanguage(result);
        });
    }

    downloadPackages() {
        this.$showBottomSheet(PackagesDownloadComponent);
    }
    removeLayer(layer: Layer<any, any>, layerId: LayerType, offset?: number) {
        const realLayerId = offset ? layerId + offset : layerId;
        const index = this.addedLayers.indexOf(realLayerId);
        if (index !== -1) {
            this.addedLayers.splice(index, 1);
        }
        this._cartoMap.removeLayer(layer);
    }
    addLayer(layer: Layer<any, any>, layerId: LayerType, offset?: number) {
        const realLayerId = offset ? layerId + offset : layerId;
        if (this._cartoMap) {
            if (this.addedLayers.indexOf(realLayerId) !== -1) {
                return;
            }
            const layerIndex = LAYERS_ORDER.indexOf(layerId);
            let realIndex = 0;
            this.addedLayers.some((s) => {
                if (LAYERS_ORDER.indexOf(s as any) < layerIndex) {
                    realIndex++;
                    return false;
                }
                return true;
            });
            if (realIndex >= 0 && realIndex < this.addedLayers.length) {
                const index = realIndex + (offset || 0);
                this._cartoMap.addLayer(layer, index);
                this.addedLayers.splice(index, 0, realLayerId);
            } else {
                this._cartoMap.addLayer(layer);
                this.addedLayers.push(realLayerId);
            }
            this._cartoMap.requestRedraw();
        }
    }
    mBottomSheetTranslation = 0;
    get bottomSheetTranslation() {
        const result = this.mBottomSheetTranslation + navigationBarHeight;
        return result;
    }
    topSheetTranslation = DEFAULT_TOP;
    scrollingWidgetsOpacity = 1;
    // onBottomSheetScroll(e: BottomSheetHolderScrollEventData) {
    //     // console.log('onBottomSheetScroll', e);
    //     this.mBottomSheetTranslation = e.height;
    //     this.bottomSheetPercentage = e.percentage;
    // }
    onTopSheetScroll(e: TopSheetHolderScrollEventData) {
        // console.log('onTopSheetScroll', e.height, e.bottom);
        this.topSheetTranslation = e.bottom;
        // this.bottomSheetPercentage = e.percentage;
    }

    bottomSheetTranslationFunction(maxTranslation, translation, progress) {
        if (translation < 300) {
            this.scrollingWidgetsOpacity = 1;
        } else {
            this.scrollingWidgetsOpacity = 4 * (2 - 2 * progress) - 3;
        }
        const maptranslation = -(maxTranslation - translation);
        const result = {
            bottomSheet: {
                translateY: translation,
            },
            searchView: {
                target: this.searchView.nativeView,
                opacity: this.scrollingWidgetsOpacity,
            },
            locationInfo: {
                target: this.$refs.locationInfo.nativeView,
                opacity: this.scrollingWidgetsOpacity,
            },
            mapScrollingWidgets: {
                target: this.$refs.mapScrollingWidgets.nativeView,
                translateY: maptranslation,
                opacity: this.scrollingWidgetsOpacity,
            },
            speeddial: {
                target: this.$refs.speeddial.nativeView,
                translateY: maptranslation,
                opacity: this.scrollingWidgetsOpacity,
            },
        };
        // console.log('bottomSheetTranslationFunction', translation, progress, this.scrollingWidgetsOpacity);
        return result;
    }

    lastBrightness;
    public showKeepAwakeNotification() {
        this.lastBrightness = brightness.get();
        brightness.set({
            intensity: 100,
        });
        if (global.isAndroid) {
            const context: android.content.Context = ad.getApplicationContext();
            const builder = new androidx.core.app.NotificationCompat.Builder(context, NOTIFICATION_CHANEL_ID_KEEP_AWAKE_CHANNEL);

            // create notification channel
            const color = this.accentColor.android;
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
            const service = context.getSystemService(
                android.content.Context.NOTIFICATION_SERVICE
            ) as android.app.NotificationManager;
            service.notify(KEEP_AWAKE_NOTIFICATION_ID, notifiction);
        }
    }

    public hideKeepAwakeNotification() {
        brightness.set({
            intensity: this.lastBrightness,
        });
        if (global.isAndroid) {
            const context: android.content.Context = ad.getApplicationContext();
            const service = context.getSystemService(
                android.content.Context.NOTIFICATION_SERVICE
            ) as android.app.NotificationManager;
            service.cancel(KEEP_AWAKE_NOTIFICATION_ID);
        }
    }

    switchKeepAwake() {
        this.log('switchKeepAwake', this.keepAwake);
        if (this.keepAwake) {
            allowSleepAgain()
                .then(() => {
                    this.keepAwake = false;
                    appSettings.setBoolean('keepAwake', false);
                    this.hideKeepAwakeNotification();
                    // this.log('allowSleepAgain done', this.keepAwake);
                })
                .catch((err) => this.showError(err));
        } else {
            keepAwake()
                .then(() => {
                    this.keepAwake = true;
                    appSettings.setBoolean('keepAwake', true);
                    this.showKeepAwakeNotification();
                    // this.log('keepAwake done', this.keepAwake);
                })
                .catch((err) => this.showError(err));
        }
    }

    switchLocationInfo() {
        this.locationInfoPanel.showLocationInfo = !this.locationInfoPanel.showLocationInfo;
    }

    shareScreenshot() {
        this.cartoMap.captureRendering(true).then((result) => {
            SocialShare.shareImage(result as any);
        });
    }
    onTap(command: string) {
        switch (command) {
            case 'sendFeedback':
                compose({
                    subject: `[${EInfo.getAppNameSync()}(${this.appVersion})] Feedback`,
                    to: ['martin@akylas.fr'],
                    attachments: [
                        {
                            fileName: 'report.json',
                            path: `base64://${base64Encode(
                                JSON.stringify(
                                    {
                                        device: {
                                            model: Device.model,
                                            DeviceType: Device.deviceType,
                                            language: Device.language,
                                            manufacturer: Device.manufacturer,
                                            os: Device.os,
                                            osVersion: Device.osVersion,
                                            region: Device.region,
                                            sdkVersion: Device.sdkVersion,
                                            uuid: Device.uuid,
                                        },
                                        screen: {
                                            widthDIPs: screenWidthDips,
                                            heightDIPs: screenHeightDips,
                                            widthPixels: Screen.mainScreen.widthPixels,
                                            heightPixels: Screen.mainScreen.heightPixels,
                                            scale: Screen.mainScreen.scale,
                                        },
                                    },
                                    null,
                                    4
                                )
                            )}`,
                            mimeType: 'application/json',
                        },
                    ],
                }).catch((err) => this.showError(err));
                break;
            case 'sendBugReport':
                login({
                    title: this.$tc('send_bug_report'),
                    message: this.$tc('send_bug_report_desc'),
                    okButtonText: this.$t('send'),
                    cancelButtonText: this.$t('cancel'),
                    autoFocus: true,
                    usernameTextFieldProperties: {
                        marginLeft: 10,
                        marginRight: 10,
                        autocapitalizationType: 'none',
                        keyboardType: 'email',
                        autocorrect: false,
                        error: this.$tc('email_required'),
                        hint: this.$tc('email'),
                    },
                    passwordTextFieldProperties: {
                        marginLeft: 10,
                        marginRight: 10,
                        error: this.$tc('please_describe_error'),
                        secure: false,
                        hint: this.$tc('description'),
                    },
                    beforeShow: (options, usernameTextField: TextField, passwordTextField: TextField) => {
                        usernameTextField.on('textChange', (e: any) => {
                            const text = e.value;
                            if (!text) {
                                usernameTextField.error = this.$tc('email_required');
                            } else if (!mailRegexp.test(text)) {
                                usernameTextField.error = this.$tc('non_valid_email');
                            } else {
                                usernameTextField.error = null;
                            }
                        });
                        passwordTextField.on('textChange', (e: any) => {
                            const text = e.value;
                            if (!text) {
                                passwordTextField.error = this.$tc('description_required');
                            } else {
                                passwordTextField.error = null;
                            }
                        });
                    },
                }).then((result) => {
                    if (result.result) {
                        if (!result.userName || !mailRegexp.test(result.userName)) {
                            this.showError(new Error(this.$tc('email_required')));
                            return;
                        }
                        if (!result.password || result.password.length === 0) {
                            this.showError(new Error(this.$tc('description_required')));
                            return;
                        }
                        Sentry.withScope((scope) => {
                            scope.setUser({ email: result.userName });
                            Sentry.captureMessage(result.password);
                            this.$alert(this.$t('bug_report_sent'));
                        });
                    }
                });
                break;
        }
    }
}
