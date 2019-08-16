import { GridLayout } from 'tns-core-modules/ui/layouts/grid-layout/grid-layout';
import { Component, Prop, Watch } from 'vue-property-decorator';
import { Item } from '~/mapModules/ItemsModule';
import BaseVueComponent from './BaseVueComponent';
import BottomSheetRouteView from './BottomSheetRouteView';
import { RouteInstruction } from './DirectionsPanel';
import ItemFormatter from '~/mapModules/ItemFormatter';
import BottomSheetBase from './BottomSheet/BottomSheetBase';
import { BottomSheetHolderScrollEventData } from './BottomSheet/BottomSheetHolder';
import * as app from 'application';
import { convertDistance, convertDuration } from '~/helpers/formatter';
import { View } from 'tns-core-modules/ui/core/view';
import { ItemEventData } from 'tns-core-modules/ui/list-view/list-view';
import { actionBarHeight } from '~/variables';
import { layout } from 'tns-core-modules/utils/utils';
import { IMapModule } from '~/mapModules/MapModule';
import Map from './Map';
import { CartoMap } from 'nativescript-carto/ui/ui';
import { EventData } from 'tns-core-modules/data/observable';
import { distanceToEnd, isLocationOnPath } from '~/utils/geo';
import { MapPos } from 'nativescript-carto/core/core';

function getViewTop(view: View) {
    if (gVars.isAndroid) {
        return layout.toDeviceIndependentPixels((view.nativeView as android.view.View).getTop());
    } else {
        return layout.toDeviceIndependentPixels((view.nativeView as UIView).frame.origin.y);
    }
}

@Component({
    components: {
        BottomSheetRouteView
    }
})
export default class BottomSheet extends BottomSheetBase implements IMapModule {
    mapView: CartoMap;
    mapComp: Map;
    @Prop({
        default: () => [50]
    })
    steps;
    @Prop() item: Item;

    // dataItems: any[] = [];
    listVisible = false;
    graphViewVisible = false;
    _formatter: ItemFormatter;

    mounted() {
        super.mounted();
        this.holder.$on('scroll', this.onScroll);
    }
    destroyed() {
        super.destroyed();
    }
    onMapReady(mapComp: Map, mapView: CartoMap) {
        this.mapView = mapView;
        this.mapComp = mapComp;
        mapComp.mapModules.userLocation.on('location', this.onNewLocation, this);
    }
    onMapDestroyed() {
        this.mapComp.mapModules.userLocation.on('location', this.onNewLocation, this);
        this.mapView = null;
        this.mapComp = null;
    }

    get bottomSheet() {
        return this.$refs['bottomSheet'] && (this.$refs['bottomSheet'].nativeView as GridLayout);
    }
    get routeView() {
        return this.$refs['routeView'] as BottomSheetRouteView;
    }
    get formatter() {
        if (!this._formatter && this.$getMapComponent()) {
            this._formatter = this.$getMapComponent().mapModule('formatter');
        }
        return this._formatter;
    }

    get rows() {
        const result = `70,${actionBarHeight},${this.graphAvailable ? 100 : 0},${this.listViewAvailable ? 150 : 0}`;
        // this.log('rows', result);
        return result;
    }
    get selectedIcon() {
        if (this.item) {
            return this.formatter.geItemIcon(this.item);
        }
        return [];
    }

    get selectedTitle() {
        if (this.item) {
            return this.formatter.getItemTitle(this.item);
        }
    }
    get selectedSubtitle() {
        if (this.item) {
            return this.formatter.getItemSubtitle(this.item);
        }
    }
    listViewAvailable = false;
    // get listViewAvailable() {
    //     return !!this.item && !!this.item.route && !!this.item.route.instructions;
    // }
    get showListView() {
        return this.listViewAvailable && this.listVisible;
    }
    graphAvailable = false;
    // get graphAvailable() {
    //     return this.itemRoute && !!this.item.route.profile && !!this.item.route.profile.data && this.item.route.profile.data.length > 0;
    // }
    get showGraph() {
        return this.graphAvailable && this.graphViewVisible;
    }
    get itemRouteNoProfile() {
        return this.item && !!this.item.route && (!this.item.route.profile || !this.item.route.profile.max);
    }

    get itemIsRoute() {
        return this.item && !!this.item.route;
    }
    @Watch('item')
    onSelectedItemChange(item: Item) {
        // this.log('onSelectedItemChange', !!item);
        this.reset();
        this.listVisible = false;
        this.listViewAvailable = !!this.item && !!this.item.route && !!this.item.route.instructions;

        this.graphViewVisible = false;
        this.graphAvailable = this.itemIsRoute && !!this.item.route.profile && !!this.item.route.profile.data && this.item.route.profile.data.length > 0;

        // if (item && item.route) {
        //     this.dataItems = item.route.instructions;
        // } else {
        //     // this.dataItems = [];
        // }
    }

    onNewLocation(e: any) {
        const location: MapPos = e.data;
        // this.log('onNewLocation', location);
        this.routeView.onNewLocation(e);
    }
    onScroll(e: BottomSheetHolderScrollEventData) {
        // this.log('onScroll', this.listViewAvailable, this.listVisible, e.height);
        if (this.listViewAvailable && !this.listVisible) {
            const locationY = getViewTop(this.listView);
            // this.log('listViewAvailable locationY', locationY, e.height);
            if (locationY) {
                const listViewTop = locationY;
                if (!this.listVisible && e.height > listViewTop + 10) {
                    // this.log('set listVisible', listViewTop, e.height);
                    this.listVisible = true;
                }
                if (this.listVisible && !this.isListViewAtTop && e.height < listViewTop) {
                    // this.log('resetting listViewAtTop to ensure pan enabled');
                    this.listViewAtTop = true;
                    this.listView.scrollToIndex(0, false);
                }
            }
        }
        if (this.graphAvailable && !this.graphViewVisible) {
            const locationY = getViewTop(this.graphView);
            // this.log('graphAvailable locationY', locationY, e.height);
            if (locationY) {
                const graphViewTop = locationY;
                if (!this.graphViewVisible && e.height > graphViewTop + 10) {
                    // this.log('set graphViewVisible', graphViewTop, e.height);
                    this.graphViewVisible = true;
                }
            }
        }
    }
    searchItemWeb() {
        if (gVars.isAndroid) {
            const query = this.$getMapComponent()
                .mapModule('formatter')
                .getItemName(this.item);
            console.log('searchItemWeb', this.item, query);
            const intent = new android.content.Intent(android.content.Intent.ACTION_WEB_SEARCH);
            intent.putExtra(android.app.SearchManager.QUERY, query); // query contains search string
            (app.android.foregroundActivity as android.app.Activity).startActivity(intent);
        }
    }
    updatingItem = false;
    getProfile() {
        this.updatingItem = true;
        this.$networkService
            .mapquestElevationProfile(this.item.route.positions)
            .then(result => {
                this.item.route.profile = result;
            })
            .then(() => this.updateItem(false))
            .then(() => {
                // make sure the graph is visible
                this.holder.scrollSheetToPosition(this.holder.peekerSteps[2]);
            })
            .catch(err => this.showError(err))
            .then(() => {
                this.updatingItem = true;
            });
    }
    saveItem() {
        const mapComp = this.$getMapComponent();
        mapComp
            .mapModule('items')
            .saveItem(this.item)
            .then(item => {
                mapComp.selectItem(item, true);
            })
            .catch(err => {
                this.showError(err);
            });
    }
    updateItem(peek = true) {
        const mapComp = this.$getMapComponent();
        mapComp
            .mapModule('items')
            .updateItem(this.item)
            .then(item => {
                mapComp.selectItem(item, true, peek);
            })
            .catch(err => {
                this.showError(err);
            });
    }
    deleteItem() {
        const mapComp = this.$getMapComponent();
        mapComp.mapModule('items').deleteItem(this.item);
    }

    getRouteInstructionIcon(item: any) {
        return [];
    }
    getRouteInstructionTitle(item: RouteInstruction) {
        switch (item.action) {
            case 'ROUTING_ACTION_HEAD_ON':
                return `Tourner ${item.turnAngle}, partant de ${item.azimuth}`;
            case 'ROUTING_ACTION_FINISH':
                return `Arriver : ${new Date(item.time)}`;
            case 'ROUTING_ACTION_NO_TURN':
                return `NO_TURN ${item.streetName}`;
            case 'ROUTING_ACTION_GO_STRAIGHT':
                const dataD = convertDistance(item.distance);
                return `Continuez pendant ${dataD.value.toFixed(1)} ${dataD.unit}`;
            case 'ROUTING_ACTION_TURN_RIGHT':
                return `Tournez à droite sur ${item.streetName}.`;
            case 'ROUTING_ACTION_UTURN':
                return `Faites demi-tour à ${item.turnAngle}pour rester sur ${item.streetName}`;
            case 'ROUTING_ACTION_TURN_LEFT':
                return `Tournez à gauche sur ${item.streetName}`;
            case 'ROUTING_ACTION_REACH_VIA_LOCATION':
                return `Votre destination est sur ${item.streetName}`;
            case 'ROUTING_ACTION_ENTER_ROUNDABOUT':
                return `Entrez dans le rond-point `;
            case 'ROUTING_ACTION_STAY_ON_ROUNDABOUT':
                return `Restez sur le rond-point`;
            case 'ROUTING_ACTION_LEAVE_ROUNDABOUT':
                return `Quittez le rond-point sur ${item.streetName}`;
            case 'ROUTING_ACTION_START_AT_END_OF_STREET':
                return `Départ de ${item.streetName}`;
            case 'ROUTING_ACTION_ENTER_AGAINST_ALLOWED_DIRECTION':
                return `Entrez sur ${item.streetName}.`;
            case 'ROUTING_ACTION_LEAVE_AGAINST_ALLOWED_DIRECTION':
                return `Quittez le rond-point dans ${item.streetName}`;
            case 'ROUTING_ACTION_GO_UP':
                return `Tournez à ${item.turnAngle} pour prendre la bretelle.`;
            case 'ROUTING_ACTION_GO_DOWN':
                return `Tournez à ${item.turnAngle} pour prendre la bretelle.`;
            case 'ROUTING_ACTION_WAIT':
                return `Gardez la ${item.turnAngle}pour prendre ${item.streetName}`;
        }
        return item.action;
    }
    getRouteInstructionSubtitle(item: RouteInstruction) {
        return item.streetName;
    }

    get routeElevationProfile() {
        // this.log('routeElevationProfile', this.graphViewVisible, !!this.item, !!this.item && !!this.item.route, !!this.item && !!this.item.route && !!this.item.route.profile);
        if (this.graphViewVisible) {
            const profile = this.item.route.profile;
            return profile ? profile.data : null;
        }
        return null;
    }
    get routeInstructions() {
        if (this.listVisible) {
            // const profile = this.item.route.profile;
            return this.item.route.instructions;
        }
        return [];
    }
    public onInstructionTap(args: ItemEventData) {
        const result = this.routeInstructions[args.index];
        // this.log('onInstructionTap', args.index, result);
        if (result) {
            this.$getMapComponent().cartoMap.setZoom(16, 100);
            this.$getMapComponent().cartoMap.setFocusPos(result.position, 100);
            // this.bleService.once(BLEConnectedEvent, ()=>{
            //     this.close();
            // })
            // this.bleService.connect(device.UUID);
        }
    }
    public onChartSelected(event) {
        // this.log('onChartSelected', event);
    }
}
