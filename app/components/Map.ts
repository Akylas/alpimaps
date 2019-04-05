import { throttle } from 'helpful-decorators';
import { CartoMapStyle, MapBounds, MapPos } from 'nativescript-carto/core/core';
import { PersistentCacheTileDataSource } from 'nativescript-carto/datasources/cache';
import { LocalVectorDataSource } from 'nativescript-carto/datasources/vector';
import { CartoOnlineVectorTileLayer, VectorElementEventData, VectorLayer, VectorTileEventData, VectorTileLayer, VectorTileRenderOrder } from 'nativescript-carto/layers/vector';
import { PackageInfo } from 'nativescript-carto/packagemanager/packagemanager';
import { Projection } from 'nativescript-carto/projections/projection';
import { CartoMap, registerLicense } from 'nativescript-carto/ui/ui';
import { Marker, MarkerStyleBuilder, MarkerStyleBuilderOptions } from 'nativescript-carto/vectorelements/marker';
import { Point, PointStyleBuilder, PointStyleBuilderOptions } from 'nativescript-carto/vectorelements/point';
import { BillboardOrientation, BillboardScaling } from 'nativescript-carto/vectorelements/vectorelements';
import { MBVectorTileDecoder } from 'nativescript-carto/vectortiles/vectortiles';
import { localize } from 'nativescript-localize';
import * as perms from 'nativescript-perms';
import Vue from 'nativescript-vue';
import * as appSettings from 'tns-core-modules/application-settings/application-settings';
import { Folder, knownFolders, path } from 'tns-core-modules/file-system';
import { isAndroid } from 'tns-core-modules/platform';
import { GC } from 'tns-core-modules/utils/utils';
import { action } from 'ui/dialogs';
import { Component, Prop, Watch } from 'vue-property-decorator';
import { GeoHandler } from '~/handlers/GeoHandler';
import CustomLayersModule, { SourceItem } from '~/mapModules/CustomLayersModule';
import MapModule from '~/mapModules/MapModule';
import UserLocationModule from '~/mapModules/UserLocationModule';
import { clog } from '~/utils/logging';
import { actionBarButtonHeight, primaryColor } from '../variables';
import BgServiceComponent from './BgServiceComponent';
import BottomSheet from './BottomSheet';
import MultiDrawer from './MultiDrawer';
import PackagesDownloadComponent from './PackagesDownloadComponent';
import Search from './Search';
import { profile } from 'tns-core-modules/profiling';

const mapLanguages = ['en', 'de', 'es', 'it', 'fr', 'ru'];
@Component({
    components: {
        MultiDrawer,
        BottomSheet,
        Search,
        PackagesDownloadComponent
    }
})
export default class Map extends BgServiceComponent {
    mapModules: {
        [k: string]: MapModule;
        customLayers: CustomLayersModule;
        userLocation: UserLocationModule;
    } = { userLocation: new UserLocationModule(), customLayers: new CustomLayersModule() };

    @Prop({ default: false }) readonly licenseRegistered!: boolean;
    @Watch('licenseRegistered')
    onLicenseRegisteredChanged(value) {
        clog('onLicenseRegisteredChanged', value);
    }
    currentLayer: VectorTileLayer;
    currentLayerType = 'voyager';
    localVectorDataSource: LocalVectorDataSource;
    localVectorLayer: VectorLayer;
    currentMapRotation = 0;
    currentMapZoom = 0;
    actionBarButtonHeight = actionBarButtonHeight;
    showingDownloadPackageDialog = false;
    suggestionPackage: PackageInfo;
    suggestionPackageName: string;
    totalDownloadProgress = 0;
    vectorTileDecoder: MBVectorTileDecoder;

    selectedPosMarker: Marker;
    selectedData: { position: MapPos; metaData?: any } = null;
    mapProjection: Projection = null;
    currentLanguage = 'en';

    _cartoMap: CartoMap = null;
    get cartoMap() {
        console.log('get cartoMap', !!this._cartoMap);
        return this._cartoMap;
    }
    // @Provide()
    // parentMap() {
    //     console.log('get parentMap');
    //     return  this;
    // }
    // selectedPosition: MapPos;
    constructor() {
        super();
    }

    // get cartoMap() {
    //     return this.$refs.cartoMap && this.$refs.cartoMap.nativeView;
    // }

    get customSources() {
        return this.mapModules['customLayers'].customSources;
    }
    @profile
    mounted() {
        super.mounted();
        this.$setMapComponent(this);
        const page = this.page;
        page.backgroundSpanUnderStatusBar = true;
        page.actionBarHidden = true;
        if (this.$packageService) {
            this.$packageService.on('onProgress', this.onTotalDownloadProgress);
        }
    }
    // updated() {
        // clog('Map updated');
    // }
    @profile
    onLoaded() {
        if (isAndroid) {
            setTimeout(() => {
                registerLicense(process.env.CARTO_ANDROID_TOKEN, result => {
                    clog('registerLicense done', result);
                    this.$getAppComponent().setCartoLicenseRegistered(result);
                });
            }, 200);
        } else {
            registerLicense(process.env.CARTO_IOS_TOKEN);
        }
        GC();
    }

    getOrCreateLocalVectorLayer() {
        if (!this.localVectorLayer) {
            const projection = this.mapProjection;
            this.localVectorDataSource = new LocalVectorDataSource({ projection });

            const layer = new VectorLayer({ dataSource: this.localVectorDataSource });
            this.cartoMap.addLayer(layer);
        }
    }

    startWatchLocation() {
        console.log('startWatchLocation');
        if (this.watchingLocation) {
            return;
        }
        return this.geoHandler
            .enableLocation()
            .then(r => this.geoHandler.startWatch())
            .then(() => (this.watchingLocation = true));
    }
    stopWatchLocation() {
        console.log('stopWatchLocation');
        this.geoHandler.stopWatch();
        this.watchingLocation = false;
    }

    runOnModules(functionName: string, ...args) {
        let m: MapModule;
        Object.keys(this.mapModules).forEach(k => {
            m = this.mapModules[k];
            m[functionName] && (m[functionName] as Function).apply(m, args);
        });
    }

    onServiceLoaded(geoHandler: GeoHandler) {
        console.log('onServiceLoaded');
        this.runOnModules('onServiceLoaded', geoHandler);
    }
    onServiceUnloaded(geoHandler: GeoHandler) {
        console.log('onServiceUnloaded');
        this.runOnModules('onServiceUnloaded', geoHandler);
    }

    resetBearing() {
        this.cartoMap.setBearing(0, 200);
    }

    onMapMove(e) {
        const cartoMap = this.cartoMap;
        const bearing = cartoMap.bearing;
        const zoom = cartoMap.zoom;
        // console.log('onMapMove', bearing, zoom);
        this.currentMapRotation = bearing;
        this.currentMapZoom = zoom;
        this.runOnModules('onMapMove', e);
        // if (zoom < 10) {
        //     this.suggestionPackage = undefined;
        //     this.suggestionPackageName = undefined;
        // }
    }
    onMapIdle(e) {
        const zoom = this.cartoMap.zoom;
        console.log('onMapIdle', zoom);
    }
    @throttle(100)
    saveSettings() {
        appSettings.setNumber('mapZoom', this.cartoMap.zoom);
        appSettings.setString('mapFocusPos', JSON.stringify(this.cartoMap.focusPos));
    }
    onMapStable(e) {
        const zoom = this.cartoMap.zoom;
        this.saveSettings();
        //     if (zoom >= 10) {
        //         const suggestions = this.$packageService.packageManager.suggestPackages(this.cartoMap.focusPos, this.cartoMap.projection);
        //         this.suggestionPackage = suggestions[0];
        //         if (this.suggestionPackage) {
        //             this.suggestionPackageName = this.suggestionPackage
        //                 .getName()
        //                 .split('/')
        //                 .slice(-1)[0];
        //         } else {
        //             this.suggestionPackageName = undefined;
        //         }

        //         console.log('onMapStable suggestions', !!this.suggestionPackage, this.suggestionPackageName);
        //     }
    }

    onMapReady(e) {
        console.log('onMapReady');
        const cartoMap = (this._cartoMap = e.object as CartoMap);

        this.mapProjection = cartoMap.projection;

        // const europe = { longitude: 5.7222, latitude: 45.2002 };
        // this.cartoMap.setFocusPos(europe, 0);
        // this.cartoMap.setZoom(10, 0);
        const options = cartoMap.getOptions();
        options.setWatermarkScale(0.5);
        options.setRestrictedPanning(true);
        options.setSeamlessPanning(true);
        options.setEnvelopeThreadPoolSize(2);
        options.setDrawDistance(8);
        if (appSettings.getString('mapFocusPos')) {
            cartoMap.setFocusPos(JSON.parse(appSettings.getString('mapFocusPos')), 0);
        }
        cartoMap.setZoom(Math.min(appSettings.getNumber('mapZoom', 10), 14), 0);
        setTimeout(() => {
            perms
                .request('storage')
                .then(status => {
                    console.log('on request storage', status);
                    // if (status === 'authorized') {
                    this.$packageService.start();
                    this.setCurrentLayer(this.currentLayerType);
                    this.runOnModules('onMapReady', this, this.cartoMap);
                    cartoMap.requestRedraw();
                    // } else {
                    //     return Promise.reject(status);
                    // }
                })
                .catch(err => console.error(err));
        }, 0);
    }
    onTotalDownloadProgress(e) {
        this.totalDownloadProgress = e.data;
    }
    get bottomSheet() {
        return this.$refs['bottomSheet'] as BottomSheet;
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
    selectPosition(position: MapPos, metaData?, isFeatureInteresting = false, zoomBounds?: MapBounds) {
        // console.log('selectPosition', position, isFeatureInteresting, metaData);

        if (isFeatureInteresting) {
            if (!this.selectedPosMarker) {
                this.getOrCreateLocalVectorLayer();
                this.selectedPosMarker = this.createLocalMarker(position, {
                    color: primaryColor,
                    scaleWithDPI: true,
                    size: 20,
                    orientationMode: BillboardOrientation.GROUND,
                    scalingMode: BillboardScaling.SCREEN_SIZE
                });
            }
            if (!this.selectedData) {
                this.localVectorDataSource.add(this.selectedPosMarker);
            }
            this.selectedData = {
                position,
                metaData
            };
            this.selectedPosMarker.position = position;
            this.bottomSheet.openSheet(position, metaData);
            if (zoomBounds) {
                this.cartoMap.moveToFitBounds(zoomBounds, null, false, false, false, 200);
            } else {
                this.cartoMap.setFocusPos(position, 200);
            }
        } else {
            this.selectedData = undefined;
            if (this.selectedPosMarker) {
                this.localVectorDataSource.remove(this.selectedPosMarker);
            }
            this.bottomSheet.closeSheet();
        }

        if (this.directionsStart) {
        }
    }
    unselectPosition() {
        if (this.selectedData) {
            this.selectedData = undefined;
            if (this.selectedPosMarker) {
                this.localVectorDataSource.remove(this.selectedPosMarker);
            }
        }
    }
    directionsStart?: MapPos;
    startDirections() {
        this.directionsStart = this.selectedData.position;
        this.unselectPosition();
    }
    onVectorTileClicked(data: VectorTileEventData) {
        const { type, position, featureLayerName, featureData, featurePosition } = data;
        featureData.layer = featureLayerName;
        console.log('onVectorTileClicked', featureLayerName, featurePosition, position, JSON.stringify(featureData));
        const isFeatureInteresting = !!featureData.name || featureLayerName === 'poi' || featureLayerName === 'building';
        // if (isFeatureInteresting) {
        if (isFeatureInteresting) {
            this.selectPosition(isFeatureInteresting ? featurePosition : position, featureData, isFeatureInteresting);
            this.runOnModules('onVectorTileClicked', data);
        }
        // }

        // return true to only look at first vector found
        return isFeatureInteresting;
    }
    onVectorElementClicked(data: VectorElementEventData) {
        const { type, position, elementPos, metaData } = data;
        console.log('onVectorElementClicked', type, position, elementPos, metaData);
        this.selectPosition(position, metaData, true);
        this.runOnModules('onVectorElementClicked', data);
        return true;
    }
    onMapClicked(e) {
        const { clickType, position } = e.data;
        console.log('onMapClicked', position);
        this.selectPosition(position, undefined, false);
        this.runOnModules('onMapClicked', e);
    }
    setCurrentLayer(id: string) {
        const cartoMap = this.cartoMap;
        if (this.currentLayer) {
            cartoMap.removeLayer(this.currentLayer);
            this.currentLayer = null;
        }
        this.currentLayerType = id;
        const vectorTileDecoder = this.getVectorTileDecoder();
        vectorTileDecoder.setStyleParameter('lang', 'fr');
        vectorTileDecoder.setStyleParameter('buildings', '2');

        this.currentLayer = new VectorTileLayer({
            preloading: true,
            dataSource: this.$packageService.getDataSource(),
            decoder: vectorTileDecoder
        });
        this.currentLayer.setLabelRenderOrder(VectorTileRenderOrder.LAST);
        this.currentLayer.setVectorTileEventListener(this, this.mapProjection);
        cartoMap.addLayer(this.currentLayer, 0);
    }
    updateLanguage(code: string) {
        if (this.currentLayer == null) {
            return;
        }
        this.currentLanguage = code;
        const current = this.currentLayer;
        const decoder = current.getTileDecoder();
        decoder.setStyleParameter('lang', code);
    }

    onSelectLayer() {
        action({
            title: 'Layer',
            message: 'Select Layer'
            // actions: this.layerTypes
        }).then(result => {
            result && this.setCurrentLayer(result);
        });
    }
    onSelectLanguage() {
        action({
            title: 'Language',
            message: 'Select Language',
            actions: mapLanguages
        }).then(result => {
            result && this.updateLanguage(result);
        });
    }
    getVectorTileDecoder() {
        return this.vectorTileDecoder || this.$packageService.getVectorTileDecoder();
    }

    selectStyle() {
        const assetsFolder = Folder.fromPath(path.join(knownFolders.currentApp().path, 'assets', 'styles'));
        assetsFolder.getEntities().then(files => {
            files = files.filter(e => e.name.endsWith('.zip'));
            action({
                title: 'Language',
                message: 'Select Style',
                actions: files.map(e => e.name).concat('default')
            }).then(result => {
                if (result) {
                    if (result === 'default') {
                        this.vectorTileDecoder = new CartoOnlineVectorTileLayer({ style: CartoMapStyle.VOYAGER }).getTileDecoder();
                    } else {
                        this.vectorTileDecoder = new MBVectorTileDecoder({
                            style: 'voyager',
                            // dirPath: `~/assets/styles/${result}`
                            zipPath: `~/assets/styles/${result}`
                        });
                    }

                    this.setCurrentLayer(this.currentLayerType);
                }
            });
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

    downloadSuggestion() {
        if (this.suggestionPackage) {
            this.$packageService.packageManager.startPackageDownload(this.suggestionPackage.getPackageId());
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

    askUserLocation() {
        this.geoHandler.getCurrentLocation();
    }
    watchingLocation = false;
    onWatchLocation() {
        if (!this.watchingLocation) {
            this.startWatchLocation();
        } else {
            this.stopWatchLocation();
        }
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
}
