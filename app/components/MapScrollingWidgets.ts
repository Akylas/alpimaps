import { Item } from '~/mapModules/ItemsModule';
import { debounce } from 'helpful-decorators';
import { CartoMap } from 'nativescript-carto/ui';
import { Component } from 'vue-property-decorator';
import Map from '~/components/Map';
import { GeoHandler } from '~/handlers/GeoHandler';
import { PackageAction, PackageStatus } from 'nativescript-carto/packagemanager';
import { IMapModule } from '~/mapModules/MapModule';
import BgServiceComponent from './BgServiceComponent';
import ScaleView from './ScaleView';
import { alert, confirm } from 'nativescript-material-dialogs';
import Vue from 'nativescript-vue';
import OptionPicker from './OptionPicker';
import UserLocationModule from '~/mapModules/UserLocationModule';
import { MapPos } from 'nativescript-carto/core';
import * as sensors from 'nativescript-sensors';
import { Accuracy } from '@nativescript/core/ui/enums/enums';
import * as appSettings from '@nativescript/core/application-settings/application-settings';
import { statusBarHeight } from '~/variables';
import { layout } from '@nativescript/core/utils/utils';

@Component({
    components: {
        ScaleView
    }
})
export default class MapScrollingWidgets extends BgServiceComponent implements IMapModule {
    mapView: CartoMap<LatLonKeys>;
    mapComp: Map;

    currentMapZoom = 0;
    totalDownloadProgress = 0;

    selectedItem: Item = null;
    mShowLocationInfo = false;

    get showLocationInfo () {
        return this.mShowLocationInfo;
    }
    set showLocationInfo (value) {
         this.mShowLocationInfo = value;
         if (!value && this.listeningForBarometer) {
            this.stopBarometerAltitudeUpdate();
        }
    }

    hasBarometer = sensors.isSensorAvailable('barometer');
    listeningForBarometer = false;
    airportPressure = appSettings.getNumber('airport_pressure', null);
    airportRefName: string = appSettings.getString('airport_ref', null);
    mCurrentAltitude: number = null;
    suggestionPackage: { id: string; name: string; status: PackageStatus } = null;
    suggestionPackageName: string = null;

    get currentAltitude() {
        if (this.listeningForBarometer) {
            if (!this.airportPressure) {
                return this.$t('no_ref');
            }
            return this.mCurrentAltitude || '-';
        }
        return this.currentLocation && this.currentLocation.altitude !== undefined ? this.currentLocation.altitude : '-';
    }

    get scaleView() {
        return this.$refs.scaleView as ScaleView;
    }

    get watchingLocation() {
        return this.userLocationModule && this.userLocationModule.watchingLocation;
    }
    get queryingLocation() {
        return this.userLocationModule && this.userLocationModule.queryingLocation;
    }
    // get currentLocation() {
    //     return this.userLocationModule && this.userLocationModule.lastUserLocation;
    // }

    get showSuggestionPackage() {
        return (
            this.suggestionPackage &&
            (!this.suggestionPackage.status ||
                (this.suggestionPackage.status.getCurrentAction() !== PackageAction.READY && this.suggestionPackage.status.getCurrentAction() !== PackageAction.DOWNLOADING))
        );
    }

    get locationButtonClass() {
        // this.log('locationButtonClass', this.watchingLocation, this.queryingLocation);
        return this.watchingLocation ? 'buttonthemed' : 'buttontext';
    }

    get locationButtonLabelClass() {
        // this.log('locationButtonClass', this.watchingLocation, this.queryingLocation);
        return this.queryingLocation ? 'fade-blink' : '';
    }

    get selectedItemHasPosition() {
        // console.log('selectedItemHasPosition', this.selectedItem);
        return this.selectedItem && this.selectedItem.position;
    }

    onSelectedItem(selectedItem: Item, oldItem: Item) {
        this.selectedItem = selectedItem;
    }
    mounted() {
        super.mounted();
        if (gVars.isAndroid) {
            this.nativeView.marginTop = layout.toDevicePixels(statusBarHeight);
        }
        if (this.$packageService) {
            this.$packageService.on('onProgress', this.onTotalDownloadProgress, this);
            this.$packageService.on('onPackageStatusChanged', this.onPackageStatusChanged, this);
        }
    }
    destroyed() {
        super.destroyed();
        if (this.$packageService) {
            this.$packageService.off('onProgress', this.onTotalDownloadProgress, this);
            this.$packageService.off('onPackageStatusChanged', this.onPackageStatusChanged, this);
        }
    }

    onServiceLoaded(geoHandler: GeoHandler) {}
    onServiceUnloaded(geoHandler: GeoHandler) {}

    onMapMove(e) {
        const cartoMap = this.mapView;
        if (!cartoMap) {
            return;
        }
        const scaleView = this.scaleView;
        
        scaleView && scaleView.onMapMove(e);
        // const cartoMap = this.mapView;
        // if (!cartoMap) {
        //     return;
        // }
        // const bearing = cartoMap.bearing;
        // const zoom = cartoMap.zoom;
        // this.currentMapZoom = zoom;
    }
    // onMapIdle(e) {
    //     const cartoMap = this.mapView;
    //     if (!cartoMap) {
    //         return;
    //     }
    //     const zoom = cartoMap.zoom;
    //     console.log('onMapIdle', zoom);
    // }
    // onMapStable(e) {
    //     const cartoMap = this.mapView;
    //     if (!cartoMap) {
    //         return;
    //     }
    // }

    @debounce(2000)
    updateSuggestion(focusPos) {
        // this.log('updateSuggestion', focusPos);
        if (!this.mapView) {
            return;
        }
        // if (zoom < 8) {
        //     this.suggestionPackage = null;
        //     this.suggestionPackageName = null;
        //     return;
        // }
        const suggestions = this.$packageService.packageManager.suggestPackages(focusPos, this.mapComp.mapProjection);
        const suggestionPackage = suggestions[0];
        // this.log('test suggestion', focusPos, suggestionPackage && suggestionPackage.getPackageId(), suggestionPackage && suggestionPackage.getName());
        if (suggestionPackage) {
            const status = this.$packageService.packageManager.getLocalPackageStatus(suggestionPackage.getPackageId(), -1);
            // this.log('test suggestion status', status, status && status.getCurrentAction());
            if (!status || status.getCurrentAction() !== PackageAction.READY) {
                this.suggestionPackage = {
                    id: suggestionPackage.getPackageId(),
                    name: suggestionPackage.getName(),
                    status
                };
                this.suggestionPackageName = this.suggestionPackage.name.split('/').slice(-1)[0];
            } else {
                this.suggestionPackage = null;
                this.suggestionPackageName = null;
            }
        } else {
            this.suggestionPackage = null;
            this.suggestionPackageName = null;
        }

        // console.log('onMapStable suggestions', !!this.suggestionPackage, this.suggestionPackageName, Date.now());
    }
    lastSuggestionKey: string;
    onMapStable(e) {
        const cartoMap = this.mapView;
        const packageServiceEnabled = this.mapComp && this.mapComp.packageServiceEnabled
        if (!cartoMap || !packageServiceEnabled) {
            return;
        }
        const zoom = Math.round(cartoMap.zoom);
        // this.log('onMapStable', zoom);
        // this.currentMapRotation = Math.round(bearing * 100) / 100;
        // if (zoom < 10) {
        //     this.suggestionPackage = undefined;
        //     this.suggestionPackageName = undefined;
        // }
        if (zoom >= 8) {
            const focusPos = this.mapView.focusPos;
            const suggestionKey = `${focusPos.lat.toFixed(5)}${focusPos.lat.toFixed(5)}${zoom}`;
            if (suggestionKey !== this.lastSuggestionKey) {
                this.lastSuggestionKey = suggestionKey;
                this.updateSuggestion(focusPos);
            }
        } else {
            this.suggestionPackage = null;
            this.suggestionPackageName = null;
        }
    }
    downloadSuggestion() {
        // this.log('downloadSuggestion', this.suggestionPackage.id);
        if (this.suggestionPackage) {
            this.$packageService.packageManager.startPackageDownload(this.suggestionPackage.id);
        }
        this.$showToast(`${this.$t('downloading')}  ${this.suggestionPackageName}`);
    }
    customDownloadSuggestion() {
        if (!this.suggestionPackage) {
            return;
        }
        // const ComponentClass = Vue.extend(OptionPicker);
        let instance = new OptionPicker();
        instance.options = [{ name: this.$tc('map_package'), checked: true }, { name: this.$tc('search_package'), checked: false }, { name: this.$tc('routing_package'), checked: false }];
        instance.$mount();
        // this.nativeView._addViewCore(instance.nativeView);
        // console.log('instance.nativeView', instance.nativeView);
        // new AlertDialog({view: instance.nativeView}).show();
        confirm({
            title: `${this.$tc('download_suggestion')}: ${this.suggestionPackageName}`,
            okButtonText: this.$t('download'),
            cancelButtonText: this.$t('cancel'),
            view: instance.nativeView
            // context: {
            //     options: [{ map: true }, { geo: false }, { routing: false }]
            // }
        })
            .then(result => {
                // console.log('result', result, instance.options);
                if (result) {
                    const options = instance.options;
                    if (options[0].checked) {
                        this.$packageService.packageManager.startPackageDownload(this.suggestionPackage.id);
                    }
                    if (options[1].checked) {
                        this.$packageService.geoPackageManager.startPackageDownload(this.suggestionPackage.id);
                    }
                    if (options[2].checked) {
                        this.$packageService.routingPackageManager.startPackageDownload(this.suggestionPackage.id);
                    }
                }
            })
            .catch(this.showError)
            .then(() => {
                // this.nativeView._removeViewCore(instance.nativeView);
                instance.$destroy();
                instance = null;
            });
    }
    currentLocation: MapPos = null;
    onNewLocation(e: any) {
        this.currentLocation = e.data;
        // this.log('onNewLocation', this.currentLocation);
    }
    userLocationModule: UserLocationModule = null;
    onMapReady(mapComp: Map, mapView: CartoMap<LatLonKeys>) {
        this.mapView = mapView;
        this.mapComp = mapComp;
        this.userLocationModule = this.mapComp.mapModules.userLocation;
        this.userLocationModule.on('location', this.onNewLocation, this);
        this.scaleView.onMapReady(mapComp, mapView);
    }
    onMapDestroyed() {
        this.userLocationModule.off('location', this.onNewLocation, this);
        this.mapView = null;
        this.mapComp = null;
        this.userLocationModule = null;
    }
    onTotalDownloadProgress(e) {
        // this.log('onTotalDownloadProgress', e.data);
        if (e.data === 100) {
            this.totalDownloadProgress = 0;
        } else {
            this.totalDownloadProgress = e.data;
        }
    }
    onPackageStatusChanged(e) {
        const { id, status } = e.data;
        if (this.suggestionPackage && id === this.suggestionPackage.id) {
            this.suggestionPackage.status = status;
        }

        // this.dataItems.some((d, index) => {
        //     if (d.id === id) {
        //         // console.log('updating item!', id, index);
        //         switch (e.type as PackageType) {
        //             case 'geo':
        //                 d.geoStatus = status;
        //                 break;
        //             case 'routing':
        //                 d.routingStatus = status;
        //                 break;
        //             default:
        //                 d.status = status;
        //         }
        //         this.dataItems.setItem(index, d);
        //         // d.status = status;
        //         return true;
        //     }
        //     return false;
        // });
    }

    // setCurrentLayerStyle(style: CartoMapStyle) {
    //     this.currentLayerStyle = style;
    //     if (this.vectorTileDecoder instanceof CartoOnlineVectorTileLayer) {
    //         // this.vectorTileDecoder.style = this.getStyleFromCartoMapStyle(this.currentLayerStyle);
    //     }
    // }
    askUserLocation() {
        return this.userLocationModule.askUserLocation();
    }
    onWatchLocation() {
        return this.userLocationModule.onWatchLocation();
    }
    startDirections() {
        if (this.selectedItem) {
            const module = this.mapComp.mapModule('directionsPanel');
            module.addStopPoint(this.selectedItem.position, this.selectedItem.properties);
        }
    }
    startBarometer() {
        if (this.listeningForBarometer) {
            sensors.startListeningForSensor('barometer', this.onSensor, 1000);
        }
    }
    stopBarometer() {
        if (this.listeningForBarometer) {
            sensors.stopListeningForSensor('barometer', this.onSensor);
        }
    }
    startBarometerAltitudeUpdate() {
        if (!this.listeningForBarometer) {
            this.listeningForBarometer = true;
            this.startBarometer();
        }
    }
    stopBarometerAltitudeUpdate() {
        if (this.listeningForBarometer) {
            this.stopBarometer();
            this.listeningForBarometer = false;
        }
    }
    switchBarometer() {
        if (this.listeningForBarometer) {
            this.stopBarometerAltitudeUpdate();
        } else {
            this.startBarometerAltitudeUpdate();
        }
    }
    getNearestAirportPressure() {
        return this.geoHandler.enableLocation().then(() => {
            this.geoHandler
                .getLocation({ desiredAccuracy: Accuracy.high, maximumAge: 120000 })
                .then(r => sensors.getAirportPressureAtLocation(gVars.AVWX_API_KEY, r.latitude, r.longitude))
                .then(r => {
                    this.airportPressure = r.pressure;
                    this.airportRefName = r.name;
                    appSettings.setNumber('airport_pressure', this.airportPressure);
                    appSettings.setString('airport_ref', this.airportRefName);
                    alert(`found nearest airport pressure ${r.name} with pressure:${r.pressure} hPa`);
                })
                .catch(err => {
                    alert(`could not find nearest airport pressure: ${err}`);
                });
        });
    }
    onSensor(data, sensor: string) {
        if (sensor === 'barometer' && this.airportPressure != null) {
            // we can compute altitude
            if (this.airportPressure) {
                // this.log('barometer', data.timestamp, data.pressure, this.airportPressure);
                this.mCurrentAltitude = Math.round(sensors.getAltitude(data.pressure, this.airportPressure));
                this.stopBarometer();
                if (this.listeningForBarometer) {
                    setTimeout(() => {
                        this.startBarometer();
                    }, 5000);
                }
            }
        }
    }
}
