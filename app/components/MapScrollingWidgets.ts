import { Item } from '~/mapModules/ItemsModule';
import { debounce } from 'helpful-decorators';
import { CartoMap } from 'nativescript-carto/ui/ui';
import { Component } from 'vue-property-decorator';
import Map from '~/components/Map';
import { GeoHandler } from '~/handlers/GeoHandler';
import { PackageAction, PackageStatus } from 'nativescript-carto/packagemanager/packagemanager';
import MapModule from '~/mapModules/MapModule';
import BgServiceComponent from './BgServiceComponent';
import ScaleView from './ScaleView';
import { AlertDialog, confirm } from 'nativescript-material-dialogs';
import Vue from 'nativescript-vue';
import OptionPicker from './OptionPicker';

@Component({
    components: {
        ScaleView
    }
})
export default class MapScrollingWidgets extends BgServiceComponent implements MapModule {
    mapView: CartoMap;
    mapComp: Map;

    currentMapZoom = 0;
    totalDownloadProgress = 0;

    selectedItem: Item = null;

    get scaleView() {
        return this.$refs.scaleView as ScaleView;
    }

    get showSuggestionPackage() {
        return (
            this.suggestionPackage &&
            (!this.suggestionPackage.status ||
                (this.suggestionPackage.status.getCurrentAction() !== PackageAction.READY && this.suggestionPackage.status.getCurrentAction() !== PackageAction.DOWNLOADING))
        );
    }

    onSelectedItem(selectedItem: Item, oldItem: Item) {
        this.selectedItem = selectedItem;
    }
    mounted() {
        super.mounted();
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

    suggestionPackage: { id: string; name: string; status: PackageStatus } = null;
    suggestionPackageName: string = null;

    @debounce(2000)
    updateSuggestion(focusPos) {
        if (this.mapView.zoom < 8) {
            this.suggestionPackage = null;
            this.suggestionPackageName = null;
            return;
        }
        const suggestions = this.$packageService.packageManager.suggestPackages(focusPos, this.mapComp.mapProjection);
        const suggestionPackage = suggestions[0];
        if (suggestionPackage) {
            const status = this.$packageService.packageManager.getLocalPackageStatus(suggestionPackage.getPackageId(), -1);
            // console.log('test suggestion', suggestionPackage.getPackageId(), suggestionPackage.getName(), status);
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
    onMapStable(e) {
        const cartoMap = this.mapView;
        if (!cartoMap) {
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
            this.updateSuggestion(this.mapView.focusPos);
        } else {
            this.suggestionPackage = null;
            this.suggestionPackageName = null;
        }
    }
    downloadSuggestion() {
        this.log('downloadSuggestion', this.suggestionPackage.id);
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
        instance.options = [{ name: this.$ltc('map_package'), checked: true }, { name: this.$ltc('search_package'), checked: false }, { name: this.$ltc('routing_package'), checked: false }];
        instance.$mount();
        // this.nativeView._addViewCore(instance.nativeView);
        console.log('instance.nativeView', instance.nativeView);
        // new AlertDialog({view: instance.nativeView}).show();
        confirm({
            title: `${this.$ltc('download_suggestion')}: ${this.suggestionPackageName}`,
            okButtonText: this.$t('download'),
            cancelButtonText: this.$t('cancel'),
            view: instance.nativeView
            // context: {
            //     options: [{ map: true }, { geo: false }, { routing: false }]
            // }
        })
            .then(result => {
                console.log('result', result, instance.options);
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

    onMapReady(mapComp: Map, mapView: CartoMap) {
        this.mapView = mapView;
        this.mapComp = mapComp;
        this.scaleView.onMapReady(mapComp, mapView);
    }
    onMapDestroyed() {
        this.mapView = null;
        this.mapComp = null;
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
        return this.mapComp.mapModules.userLocation.askUserLocation();
    }
    onWatchLocation() {
        return this.mapComp.mapModules.userLocation.onWatchLocation();
    }

    get selectedItemHasPosition() {
        // console.log('selectedItemHasPosition', this.selectedItem);
        return this.selectedItem && this.selectedItem.position;
    }
    startDirections() {
        if (this.selectedItem) {
            const module = this.mapComp.mapModule('directionsPanel');
            module.handleClickOnItem(this.selectedItem);
        }
    }
}
