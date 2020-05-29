import * as app from '@nativescript/core/application';
import { CartoMap } from 'nativescript-carto/ui';
import { View } from '@nativescript/core/ui/core/view';
import { GridLayout } from '@nativescript/core/ui/layouts/grid-layout/grid-layout';
import { ItemEventData } from '@nativescript/core/ui/list-view/list-view';
import { Component, Prop, Watch } from 'vue-property-decorator';
import { convertDistance } from '~/helpers/formatter';
import ItemFormatter from '~/mapModules/ItemFormatter';
import { Item } from '~/mapModules/ItemsModule';
import { IMapModule } from '~/mapModules/MapModule';
import { actionBarHeight, primaryColor } from '~/variables';
import BottomSheetBase from './BottomSheet/BottomSheetBase';
import { BottomSheetHolderScrollEventData } from './BottomSheet/BottomSheetHolder';
import BottomSheetInfoView from './BottomSheetInfoView';
import BottomSheetRouteInfoView from './BottomSheetRouteInfoView';
import { RouteInstruction } from './DirectionsPanel';
import Map from './Map';
import { MapPos } from 'nativescript-carto/core';
import LineChart from 'nativescript-chart/charts/LineChart';
import { LineDataSet, Mode } from 'nativescript-chart/data/LineDataSet';
import { LineData } from 'nativescript-chart/data/LineData';
import { XAxisPosition } from 'nativescript-chart/components/XAxis';
import { omit } from '~/utils';
import { knownFolders } from '@nativescript/core/file-system/file-system';
import { ShareFile } from 'nativescript-akylas-share-file';
import { Rounding } from 'nativescript-chart/data/DataSet';
// import InAppBrowser from 'nativescript-inappbrowser';
import { openUrl } from '@nativescript/core/utils/utils';

export const LISTVIEW_HEIGHT = 200;
export const PROFILE_HEIGHT = 100;


@Component({
    components: {
        BottomSheetRouteInfoView,
        BottomSheetInfoView
    }
})
export default class BottomSheet extends BottomSheetBase implements IMapModule {
    mapView: CartoMap<LatLonKeys>;
    mapComp: Map;
    @Prop({
        default: () => [50]
    })
    steps;
    @Prop() item: Item;

    // dataItems: any[] = [];
    // graphViewVisible = false;
    profileHeight = PROFILE_HEIGHT
    graphAvailable = false;

    mounted() {
        super.mounted();
        // this.holder.$on('scroll', this.onScroll);
    }
    destroyed() {
        super.destroyed();
    }
    onMapReady(mapComp: Map, mapView: CartoMap<LatLonKeys>) {
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
        return this.$refs['routeView'] as BottomSheetRouteInfoView;
    }

    get chart() {
        return this.$refs.graphView.nativeView as LineChart;
    }

    get rows() {
        const result = `70,${actionBarHeight},auto,${
            this.listViewAvailable ? LISTVIEW_HEIGHT : 0
        }`;
        // this.log('rows', result);
        return result;
    }
    // get listViewAvailable() {
    //     return !!this.item && !!this.item.route && !!this.item.route.instructions;
    // }
    get showListView() {
        // return this.listViewAvailable;
        return this.listViewAvailable && this.listViewVisible;
    }
    // get graphAvailable() {
    //     return this.itemRoute && !!this.item.route.profile && !!this.item.route.profile.data && this.item.route.profile.data.length > 0;
    // }
    get showGraph() {
        // return this.graphAvailable && this.graphViewVisible;
        return this.graphAvailable;
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
        this.listViewVisible = false;
        this.listViewAvailable = !!this.item && !!this.item.route && !!this.item.route.instructions;

        // this.graphViewVisible = false;
        this.graphAvailable =
            this.itemIsRoute &&
            !!this.item.route.profile &&
            !!this.item.route.profile.data &&
            this.item.route.profile.data.length > 0;
        if (this.graphAvailable) {
            this.updateChartData();
        }
    }

    onNewLocation(e: any) {
        // const location: MapPos<LatLonKeys> = e.data;
        const index = this.routeView.onNewLocation(e);
        // this.log('onNewLocation', index, e.data);
        if (index !== -1 && this.graphAvailable) {
            const profile = this.item.route.profile;
            const profileData = profile?.data;
            if (profileData) {

                const chart = this.chart;
                chart.highlightValue(profileData[index].x, 0, 0);
            }
        }
    }
    onChartTap(event) {
        const chart = this.chart;
        console.log('onChartTap', event.highlight);
        const x = chart.getData().getDataSetByIndex(0).getEntryIndexForXValue(event.highlight.x, NaN, Rounding.CLOSEST);
        const position = this.item.route.positions[x];
        console.log('onChartTap2', x, position);
        if (position) {
            const mapComp = this.$getMapComponent();
            mapComp.selectItem({item:{ position }, isFeatureInteresting:true, setSelected:false, peek:false});
        }
    }
    // onScroll(e: BottomSheetHolderScrollEventData) {
    //     if (this.listViewAvailable && !this.listViewVisible) {
    //         const locationY = getViewTop(this.listView);
    //         // this.log('listViewAvailable locationY', locationY, e.height);
    //         if (locationY) {
    //             const listViewTop = locationY;
    //             if (!this.listViewVisible && e.height > listViewTop + 10) {
    //                 // this.log('set listVisible', listViewTop, e.height);
    //                 this.listViewVisible = true;
    //             }
    //             if (this.listViewVisible && !this.isListViewAtTop && e.height < listViewTop) {
    //                 // this.log('resetting listViewAtTop to ensure pan enabled');
    //                 this.listViewAtTop = true;
    //                 this.listView.scrollToIndex(0, false);
    //             }
    //         }
    //     }
    //     // if (this.graphAvailable && !this.graphViewVisible) {
    //     //     const locationY = getViewTop(this.graphView);
    //     //     // this.log('graphAvailable locationY', locationY, e.height);
    //     //     if (locationY) {
    //     //         const graphViewTop = locationY;
    //     //         if (!this.graphViewVisible && e.height > graphViewTop + 10) {
    //     //             // this.log('set graphViewVisible', graphViewTop, e.height);
    //     //             this.graphViewVisible = true;
    //     //         }
    //     //     }
    //     // }
    // }
    // async openLink(url: string) {
    //     try {
    //         const available = await InAppBrowser.isAvailable();
    //         if (available) {
    //             const result = await InAppBrowser.open(url, {
    //                 // iOS Properties
    //                 dismissButtonStyle: 'close',
    //                 preferredBarTintColor: primaryColor,
    //                 preferredControlTintColor: 'white',
    //                 readerMode: false,
    //                 animated: true,
    //                 // modalPresentationStyle: 'fullScreen',
    //                 // modalTransitionStyle: 'partialCurl',
    //                 // modalEnabled: true,
    //                 enableBarCollapsing: false,
    //                 // Android Properties
    //                 showTitle: true,
    //                 toolbarColor: primaryColor,
    //                 secondaryToolbarColor: 'white',
    //                 enableUrlBarHiding: true,
    //                 enableDefaultShare: true,
    //                 forceCloseOnRedirection: false
    //                 // Specify full animation resource identifier(package:anim/name)
    //                 // or only resource name(in case of animation bundled with app).
    //                 // animations: {
    //                 //     startEnter: 'slide_in_right',
    //                 //     startExit: 'slide_out_left',
    //                 //     endEnter: 'slide_in_left',
    //                 //     endExit: 'slide_out_right'
    //                 // },
    //                 // headers: {
    //                 //     'my-custom-header': 'my custom header value'
    //                 // }
    //             });
    //             // alert({
    //             //     title: 'Response',
    //             //     message: JSON.stringify(result),
    //             //     okButtonText: 'Ok'
    //             // });
    //         } else {
    //             openUrl(url);
    //         }
    //     } catch (error) {
    //         alert({
    //             title: 'Error',
    //             message: error.message,
    //             okButtonText: 'Ok'
    //         });
    //     }
    // }
    searchItemWeb() {
        if (gVars.isAndroid) {
            const query = this.$getMapComponent()
                .mapModule('formatter')
                .getItemName(this.item);
            console.log('searchItemWeb', this.item, query);
            if (gVars.isAndroid) {
                const intent = new android.content.Intent(android.content.Intent.ACTION_WEB_SEARCH);
                intent.putExtra(android.app.SearchManager.QUERY, query); // query contains search string
                (app.android.foregroundActivity as android.app.Activity).startActivity(intent);
            }
           
        }
    }
    updatingItem = false;
    async getProfile() {
        this.updatingItem = true;
        const positions = this.item.route.positions;
        const profile = await this.$packageService.getElevationProfile(positions);
        // this.$networkService
        //     .mapquestElevationProfile(positions)
        //     .then(result => {
        this.item.route.profile = profile;
        //     })
        await this.item.id ? this.updateItem(false) : this.saveItem(false);
        //     .then(() => {
        // make sure the graph is visible
        await this.holder.scrollSheetToPosition(this.holder.peekerSteps[2]);
        //     })
        //     .catch(err => this.showError(err))
        //     .then(() => {
        this.updatingItem = false;
        //     });
    }
    saveItem(peek = true) {
        const mapComp = this.$getMapComponent();
        mapComp
            .mapModule('items')
            .saveItem(this.item)
            .then(item => {
                mapComp.selectItem({item, isFeatureInteresting:true, peek});
            })
            .catch(err => {
                this.showError(err);
            });
    }
    async updateItem(peek = true) {
        const mapComp = this.$getMapComponent();
        return mapComp
            .mapModule('items')
            .updateItem(this.item)
            .then(item => {
                mapComp.selectItem({item, isFeatureInteresting:true, peek});
            })
            .catch(err => {
                this.showError(err);
            });
    }
    deleteItem() {
        const mapComp = this.$getMapComponent();
        mapComp.mapModule('items').deleteItem(this.item);
    }
    // export interface Item {
    //     id?: number;
    //     properties?: {
    //         [k: string]: any;
    //         name?: string;
    //         osm_value?: string;
    //         osm_key?: string;
    //         class?: string;
    //         layer?: string;
    //     };
    //     provider?: 'photon' | 'here' | 'carto';
    //     categories?: string[];
    //     address?: Address;
    //     zoomBounds?: MapBounds<LatLonKeys>;
    //     route?: Route;
    //     position?: MapPos<LatLonKeys>;
    //     styleOptions?: any;
    //     vectorElement?: VectorElement<any, any>;
    // }
    shareItem() {
        const itemToShare = omit(this.item, 'vectorElement');
        this.shareFile(JSON.stringify(itemToShare), `sharedItem.json`);
    }
    async shareFile(content: string, fileName: string) {
        const file = knownFolders.temp().getFile(fileName);
        // iOS: using writeText was not adding the file. Surely because it was too soon or something
        // doing it sync works better but still needs a timeout
        // this.showLoading('loading');
        await file.writeText(content);

        // if (gVars.isIOS) {
        //     await timeout(1000);
        // }
        //we need to wait quit a bit on ios for the file to be correctly shared ...
        // return timeout(gVars.isIOS ? 1000 : 0).then(noop => {
        // this.hideLoading();
        // this.log('shareFile', fileName, file.path);
        const shareFile = new ShareFile();
        await shareFile.open({
            path: file.path,
            title: fileName,
            options: true, // optional iOS
            animated: true // optional iOS
        });

        // });
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

    updateChartData() {
        const chart = this.chart;
        const key = (chart as any).propName;
        const sets = [];
        const profile = this.item.route.profile;
        const profileData = profile?.data;
        // console.log('updateChartData', profileData);
        if (profileData) {
            let set = new LineDataSet(profileData, 'y', 'x', 'y');
            set.setDrawValues(false);
            set.setDrawFilled(true);
            set.setColor('#60B3FC');
            // set.setMode(Mode.CUBIC_BEZIER);
            set.setFillColor('#8060B3FC');
            sets.push(set);
        }

        // chart.setDoubleTapToZoomEnabled(true);
        // chart.setScaleEnabled(true);
        // chart.setDragEnabled(true);
        chart.setHighlightPerTapEnabled(true);

        chart.getLegend().setEnabled(false);
        // chart.setLogEnabled(true);
        chart.getAxisLeft().setTextColor('white');
        chart.getXAxis().setPosition(XAxisPosition.BOTTOM);
        chart.getXAxis().setTextColor('white');
        // chart.getXAxis().setValueFormatter({
        //     getAxisLabel(value, axis) {
        //         return convertDuration(value, format);
        //     }
        // });
        chart.getXAxis().setDrawLabels(true);
        chart.getXAxis().setDrawGridLines(true);
        chart.getAxisRight().setEnabled(false);
        const linedata = new LineData(sets);
        chart.setData(linedata);
    }

    // get routeElevationProfile() {
    //     // this.log('routeElevationProfile', this.graphViewVisible, !!this.item, !!this.item && !!this.item.route, !!this.item && !!this.item.route && !!this.item.route.profile);
    //     if (this.graphViewVisible) {
    //         const profile = this.item.route.profile;
    //         return profile ? profile.data : null;
    //     }
    //     return null;
    // }
    get routeInstructions() {
        if (this.listViewAvailable) {
            // if (this.listVisible) {
            // const profile = this.item.route.profile;
            return this.item.route.instructions;
        }
        return [];
    }
    public onInstructionTap(args: ItemEventData) {
        const result = this.routeInstructions[args.index];
        // this.log('onInstructionTap', args.index, result);
        if (result) {
            // this.$getMapComponent().cartoMap.setZoom(16, 100);
            // this.$getMapComponent().cartoMap.setFocusPos(result.position, 100);


            const mapComp = this.$getMapComponent();
            mapComp.selectItem({item:{ position: result.position }, isFeatureInteresting:true, setSelected:false, peek:false});
        }
    }
}
