import { ClickType, MapPos, NMapPos, fromNativeMapBounds, fromNativeMapPos } from '@nativescript-community/ui-carto/core';
import { LocalVectorDataSource } from '@nativescript-community/ui-carto/datasources/vector';
import { VectorElementEventData, VectorLayer, VectorTileEventData } from '@nativescript-community/ui-carto/layers/vector';
import {
    PackageManagerValhallaRoutingService,
    RouteMatchingResult,
    RoutingResult,
    ValhallaOfflineRoutingService,
    ValhallaOnlineRoutingService,
    ValhallaProfile,
} from '@nativescript-community/ui-carto/routing';
import { CartoMap } from '@nativescript-community/ui-carto/ui';
import { Group } from '@nativescript-community/ui-carto/vectorelements/group';
import { Line, LineEndType, LineJointType, LineStyleBuilder } from '@nativescript-community/ui-carto/vectorelements/line';
import { Marker, MarkerStyleBuilder } from '@nativescript-community/ui-carto/vectorelements/marker';
import { Point } from '@nativescript-community/ui-carto/vectorelements/point';
import { TextField } from '@nativescript-community/ui-material-textfield';
import { Device } from '@nativescript/core';
import { Folder } from '@nativescript/core/file-system';
import { layout } from '@nativescript/core/utils/utils';
import { Component, Prop } from 'vue-property-decorator';
import { IMapModule } from '~/mapModules/MapModule';
import { Address, IItem as Item } from '~/models/Item';
import Route, { RoutingAction } from '~/models/Route';
import { omit } from '~/utils';
import BaseVueComponent from './BaseVueComponent';
import Map from './Map';

export interface RouteInstruction {
    // position: MapPos<LatLonKeys>;
    action: RoutingAction;
    azimuth: number;
    distance: number;
    pointIndex: number;
    time: number;
    turnAngle: number;
    streetName: string;
    instruction: string;
}

export interface RouteProfile {
    max: [number, number];
    min: [number, number];
    dplus?: any;
    dmin?: any;
    // points: MapPos<LatLonKeys>[];
    data: { x: number; altitude: number; altAvg: number; grade }[];
    colors?: { x: number; color: string }[];
}

// function getPointsFromResult(result: RoutingResult<LatLonKeys> | RouteMatchingResult<LatLonKeys>) {
//     let startTime = Date.now();
//     const points = result.getPoints();
//     const positions = [];
//     let lastLon, lastLat, lat, lon, p: NMapPos;
//     for (let i = 0; i < points.size(); i++) {
//         p = points.get(i);
//         lat = p.getY();
//         lon = p.getX();
//         // if (!lastLon || lastLat !== lat || lastLon !== lon) {
//         positions.push({ lat: Math.round(lat * 1000000) / 1000000, lon: Math.round(lon * 1000000) / 1000000});
//         // }
//         // lastLon = lon;
//         // lastLat = lat;
//     }
//     console.log('getPointsFromResult', points.size(), Date.now() - startTime, 'ms');
//     return positions;
// }

function routingResultToJSON(result: RoutingResult<LatLonKeys>) {
    const rInstructions = result.getInstructions();
    const instructions: RouteInstruction[] = [];
    // const positions = getPointsFromResult(result);
    for (let i = 0; i < rInstructions.size(); i++) {
        const instruction = rInstructions.get(i);
        const pointIndex = instruction.getPointIndex();
        instructions.push({
            action: RoutingAction[instruction.getAction().toString().replace('ROUTING_ACTION_', '')],
            azimuth: Math.round(instruction.getAzimuth()),
            distance: instruction.getDistance(),
            time: instruction.getTime(),
            pointIndex,
            turnAngle: instruction.getTurnAngle(),
            streetName: instruction.getStreetName(),
            instruction: (instruction as any).getInstruction(),
        });
    }
    const res = {
        positions: result.getPoints(),
        totalTime: result.getTotalTime(),
        totalDistance: result.getTotalDistance(),
        instructions,
    } as Route;

    return res;
}
// const OPEN_DURATION = 200;
// const CLOSE_DURATION = 200;
@Component({})
export default class DirectionsPanel extends BaseVueComponent implements IMapModule {
    mapView: CartoMap<LatLonKeys>;
    mapComp: Map;
    opened = false;
    _routeDataSource: LocalVectorDataSource;
    _routeLayer: VectorLayer;
    waypoints: {
        marker: Group;
        position: MapPos<LatLonKeys>;
        isStart: boolean;
        isStop: boolean;
        metaData: any;
        text: string;
    }[] = [];
    profile: ValhallaProfile = 'pedestrian';
    showOptions = true;
    loading = false;
    currentRoute: Route;
    currentLine: Line;

    valhallaCostingOptions = { use_hills: 0, use_roads: 0, use_ferry: 0, max_hiking_difficulty: 6 };

    get profileColor() {
        return (p) => (this.profile === p ? '#fff' : '#55ffffff');
    }

    setProfile(p: ValhallaProfile) {
        this.profile = p;
    }

    get peekHeight() {
        return Math.round(layout.toDeviceIndependentPixels(this.nativeView.getMeasuredHeight()));
    }
    get fullHeight() {
        return this.peekHeight;
    }
    get steps() {
        return [this.peekHeight];
    }
    mounted() {
        super.mounted();
    }
    onMapReady(mapComp: Map, mapView: CartoMap<LatLonKeys>) {
        this.mapView = mapView;
        this.mapComp = mapComp;
    }
    onMapDestroyed() {
        this.mapView = null;
        this.mapComp = null;
        if (this._routeDataSource) {
            this._routeDataSource.clear();
            this._routeDataSource = null;
        }

        if (this._routeLayer) {
            this._routeLayer.setVectorElementEventListener(null);
            this._routeLayer = null;
        }
    }

    get routeDataSource() {
        if (!this._routeDataSource && this.mapView) {
            const projection = this.mapView.projection;
            this._routeDataSource = new LocalVectorDataSource({ projection });
        }
        return this._routeDataSource;
    }
    get routeLayer() {
        if (!this._routeLayer) {
            this._routeLayer = new VectorLayer({ visibleZoomRange: [0, 24], dataSource: this.routeDataSource, opacity: 0.7 });
            this._routeLayer.setVectorElementEventListener<LatLonKeys>({
                onVectorElementClicked: (data) => this.mapComp.onVectorElementClicked(data),
            });
            this.mapComp.addLayer(this._routeLayer, 'directions');
        }
        return this._routeLayer;
    }
    line: Line<LatLonKeys>;

    addStartPoint(position: MapPos<LatLonKeys>, metaData?) {
        const toAdd = {
            isStart: true,
            isStop: false,
            position,
            metaData,
            marker: null,
            text: metaData ? metaData.name : `${position.lat.toFixed(3)}, ${position.lon.toFixed(3)}`,
        };
        const group = new Group();
        group.elements = [
            new Marker({
                position,
                styleBuilder: {
                    size: 15,
                    hideIfOverlapped: false,
                    scaleWithDPI: true,
                    color: 'green',
                },
            }),
            // new Text({
            //     position,
            //     text: '0',
            //     styleBuilder: {
            //         fontSize: 5,
            //         anchorPointY: 1,
            //         hideIfOverlapped: false,
            //         // scaleWithDPI: true,
            //         color: 'white',
            //         // backgroundColor: 'red'
            //     }
            // })
        ];
        toAdd.marker = group;
        this.routeDataSource.add(group);
        this.ensureRouteLayer();
        this.waypoints.unshift(toAdd);
        this.startTF.text = this.currentStartSearchText = toAdd.text;
        this.updateWayPoints();
    }
    addStopPoint(position: MapPos<LatLonKeys>, metaData?) {
        const toAdd = {
            isStart: false,
            isStop: true,
            position,
            metaData,
            marker: null,
            text: metaData?.name || `${position.lat.toFixed(3)}, ${position.lon.toFixed(3)}`,
        };
        if (this.waypoints.length > 0 && this.waypoints[this.waypoints.length - 1].isStop === true) {
            this.waypoints[this.waypoints.length - 1].isStop = false;
            (this.waypoints[this.waypoints.length - 1].marker.elements[0] as Point).styleBuilder = {
                size: 15,
                hideIfOverlapped: false,
                scaleWithDPI: true,
                color: 'blue',
            };
            this.addStopPoint(position, metaData);
            return;
        }
        const group = new Group();
        group.elements = [
            new Marker({
                position,
                styleBuilder: {
                    size: 15,
                    hideIfOverlapped: false,
                    scaleWithDPI: true,
                    color: 'red',
                },
            }),
        ];
        toAdd.marker = group;
        this.routeDataSource.add(group);
        this.stopTF.text = this.currentStopSearchText = toAdd.text;
        this.ensureRouteLayer();
        this.waypoints.push(toAdd);
        this.updateWayPoints();
    }
    updateWayPoints() {
        if (!this.line) {
            this.line = new Line<LatLonKeys>({
                styleBuilder: {
                    color: 'gray',
                    width: 4,
                },
                positions: this.waypoints.map((w) => w.position),
            });
            this.routeDataSource.add(this.line);
        } else {
            this.line.positions = this.waypoints.map((w) => w.position);
        }
        this.show();
    }

    @Prop() translationFunction?: Function;

    async show() {
        const height = this.nativeView.getMeasuredHeight();
        const superParams = {
            target: this.nativeView,
            translate: {
                x: 0,
                y: 0,
            },
            duration: 200,
        };
        const params = this.translationFunction ? this.translationFunction(height, 0, 1, superParams) : superParams;
        await this.nativeView.animate(params);
    }
    async hide() {
        const height = this.nativeView.getMeasuredHeight();
        const superParams = {
            target: this.nativeView,
            translate: {
                x: 0,
                y: -height,
            },
            duration: 200,
        };
        const params = this.translationFunction ? this.translationFunction(height, -height, 0, superParams) : superParams;
        await this.nativeView.animate(params);
    }
    addWayPoint(position: MapPos<LatLonKeys>, metaData?, index = -1) {
        const toAdd = {
            isStart: false,
            isStop: false,
            position,
            metaData,
            marker: null,
            text: metaData ? metaData.name : `${position.lat.toFixed(3)}, ${position.lon.toFixed(3)}`,
        };
        if (this.waypoints.length === 0 || this.waypoints[0].isStart === false) {
            this.addStartPoint(position, metaData);
        } else {
            this.addStopPoint(position, metaData);
        }
    }

    handleClickOnPos(position: MapPos<LatLonKeys>, metaData?) {
        this.addWayPoint(position);
    }
    handleClickOnItem(item: Item) {
        this.handleClickOnPos(item.position, item.properties);
    }
    onVectorTileClicked(data: VectorTileEventData<LatLonKeys>) {
        const { clickType, position, featurePosition, featureData } = data;
        // console.log('onVectorTileClicked', clickType, ClickType.LONG);
        if (clickType === ClickType.LONG) {
            // console.log('onVectorTileClicked', data.featureLayerName);
            if (data.featureLayerName === 'poi' || data.featureLayerName === 'mountain_peak') {
                this.handleClickOnPos(featurePosition, featureData);
                return true;
            }
        }
        return false;
    }
    onVectorElementClicked(data: VectorElementEventData<LatLonKeys>) {
        const { clickType, position, elementPos, metaData } = data;
        // console.log('onVectorElementClicked', clickType, ClickType.LONG);
        if (clickType === ClickType.LONG) {
            this.handleClickOnPos(elementPos, metaData);
            return true;
        }
    }
    onMapClicked(e) {
        const { clickType, position } = e.data;
        // console.log('onMapClicked', clickType, ClickType.LONG);

        if (clickType === ClickType.LONG) {
            this.handleClickOnPos(position);
            return true;
        }
    }
    cancel() {
        // console.log('cancel');
        this.waypoints = [];
        if (this.line) {
            this.line = null;
        }
        if (this._routeDataSource) {
            this._routeDataSource.clear();
        }
        this.unfocus(this.startTF);
        this.unfocus(this.stopTF);
        this.startTF.text = null;
        this.stopTF.text = null;
        this.hide();
    }
    _offlineRoutingSearchService: PackageManagerValhallaRoutingService;
    get offlineRoutingSearchService() {
        if (!this._offlineRoutingSearchService) {
            this._offlineRoutingSearchService = new PackageManagerValhallaRoutingService({
                packageManager: this.mapComp.$packageService.routingPackageManager,
            });
        }
        return this._offlineRoutingSearchService;
    }
    _localOfflineRoutingSearchService: ValhallaOfflineRoutingService;
    get localOfflineRoutingSearchService() {
        if (!this._localOfflineRoutingSearchService) {
            const folderPath = this.$packageService.getDefaultMBTilesDir();
            if (Folder.exists(folderPath)) {
                const folder = Folder.fromPath(folderPath);
                const entities = folder.getEntitiesSync();
                entities.some((s) => {
                    if (s.name.endsWith('.vtiles')) {
                        this._localOfflineRoutingSearchService = new ValhallaOfflineRoutingService({
                            path: s.path,
                        });
                        return true;
                    }
                });
            }
        }
        return this._localOfflineRoutingSearchService;
    }

    _onlineRoutingSearchService: ValhallaOnlineRoutingService;
    get onlineRoutingSearchService() {
        if (!this._onlineRoutingSearchService) {
            this._onlineRoutingSearchService = new ValhallaOnlineRoutingService({
                apiKey: gVars.MAPBOX_TOKEN,
            });
        }
        return this._onlineRoutingSearchService;
    }

    _routePointStyle;

    get routePointStyle() {
        if (!this._routePointStyle) {
            this._routePointStyle = new MarkerStyleBuilder({
                hideIfOverlapped: false,
                size: 10,
                color: 'white',
            }).buildStyle();
        }
        return this._routePointStyle;
    }
    _routeLeftPointStyle;
    get routeLeftPointStyle() {
        if (!this._routeLeftPointStyle) {
            this._routeLeftPointStyle = new MarkerStyleBuilder({
                hideIfOverlapped: false,
                size: 10,
                color: 'yellow',
            }).buildStyle();
        }
        return this._routeLeftPointStyle;
    }
    _routeRightPointStyle;
    get routeRightPointStyle() {
        if (!this._routeRightPointStyle) {
            this._routeRightPointStyle = new MarkerStyleBuilder({
                hideIfOverlapped: false,
                size: 10,
                color: 'purple',
            }).buildStyle();
        }
        return this._routeRightPointStyle;
    }
    createPolyline(result: Route, positions) {
        const styleBuilder = new LineStyleBuilder({
            color: 'orange',
            joinType: LineJointType.ROUND,
            endType: LineEndType.ROUND,
            clickWidth: 20,
            width: 6,
        });
        return new Line({
            positions,
            metaData: { route: JSON.stringify(omit(result, 'positions')) },
            styleBuilder,
        });
    }
    secondsToHours(sec: number) {
        const hours = sec / 3600;
        const remainder = sec % 3600;
        const minutes = remainder / 60;
        const seconds = remainder % 60;
        return (
            (hours < 10 ? '0' : '') +
            hours +
            'h' +
            (minutes < 10 ? '0' : '') +
            minutes +
            'm' +
            (seconds < 10 ? '0' : '') +
            seconds +
            's'
        );
    }
    switchValhallaSetting(key: string) {
        this.valhallaCostingOptions[key] = !this.valhallaCostingOptions[key];
    }
    valhallaSetting(key: string) {
        return this.valhallaCostingOptions[key];
    }
    valhallaSettingColor(key: string) {
        return this.valhallaCostingOptions[key] ? 'white' : '#55ffffff';
    }
    async showRoute(online = false) {
        try {
            let startTime = Date.now();
            this.loading = true;
            console.log(
                'showRoute',
                this.waypoints.map((r) => r.position),
                online,
                this.profile,
                this.valhallaCostingOptions
            );
            const service = online
                ? this.onlineRoutingSearchService
                : this.localOfflineRoutingSearchService || this.offlineRoutingSearchService;
            service.profile = this.profile;
            const result = await service.calculateRoute<LatLonKeys>({
                projection: this.mapView.projection,
                points: this.waypoints.map((r) => r.position),
                customOptions: {
                    directions_options: { language: Device.language },
                    costing_options: {
                        car: this.valhallaCostingOptions,
                        pedestrian: this.valhallaCostingOptions,
                        bicycle: this.valhallaCostingOptions,
                    },
                } as any,
            });
            this.loading = false;
            console.log('got  route', Date.now() - startTime, 'ms');

            this.cancel();
            startTime = Date.now();
            const route = routingResultToJSON(result);
            console.log('routingResultToJSON', Date.now() - startTime, 'ms');

            this.currentRoute = route;
            this.clearCurrentLine();
            this.currentLine = this.createPolyline(route, route.positions);
            this.routeDataSource.clear();
            this.line = null;
            this.waypoints = [];
            this.routeDataSource.add(this.currentLine);
            this.ensureRouteLayer();
            const geometry = this.currentLine.getGeometry();
            this.mapComp.selectItem({
                item: {
                    position: fromNativeMapPos(geometry.getCenterPos()),
                    route,
                    zoomBounds: fromNativeMapBounds(geometry.getBounds()),
                },
                isFeatureInteresting: true,
                showButtons: true,
            });
        } catch (error) {
            this.loading = false;
            if (!online) {
                // return confirm({
                //     message: this.$t('try_online'),
                //     okButtonText: this.$t('ok'),
                //     cancelButtonText: this.$t('cancel')
                // }).then(result => {
                // if (result) {
                this.showRoute(true);
                //     } else {
                //         this.cancel();
                //     }
                // });
            } else {
                this.cancel();
                throw error || 'failed to compute route';
            }
        }
    }
    ensureRouteLayer() {
        return this.routeLayer !== null;
    }
    clearCurrentLine() {
        if (this.currentLine) {
            this.routeDataSource.remove(this.currentLine);
            this.currentLine = null;
        }
    }
    onUnselectedItem(item: Item) {
        if (!!item.route && item.route === this.currentRoute) {
            this.currentRoute = null;
            this.clearCurrentLine();
        }
    }
    onSelectedItem(item: Item, oldItem: Item) {
        if (!!oldItem && !!oldItem.route && oldItem.route === this.currentRoute) {
            this.currentRoute = null;
            this.clearCurrentLine();
        }
        if (!!item && !!item.route && item.route !== this.currentRoute) {
            this.currentRoute = null;
            this.clearCurrentLine();
        }
    }

    unfocus(textField: TextField) {
        textField.clearFocus();
    }

    currentStartSearchText = null;
    currentStopSearchText = null;
    // onStartTextChange(e) {
    //     this.currentStartSearchText = e.value;
    // }
    // onStopTextChange(e) {
    //     this.currentStopSearchText = e.value;
    // }
    get startTF() {
        return this.$refs.startTF && (this.$refs.startTF.nativeView as TextField);
    }
    get stopTF() {
        return this.$refs.stopTF && (this.$refs.stopTF.nativeView as TextField);
    }
    clearStartSearch() {
        if (this.waypoints.length >= 1 && this.waypoints[0].isStart === true) {
            const toRemove = this.waypoints.splice(0, 1)[0];
            this.routeDataSource.remove(toRemove.marker);
            if (this.line) {
                this.line.positions = this.waypoints.map((w) => w.position);
            }
        }
        this.currentStartSearchText = null;
        this.startTF.text = null;
        this.unfocus(this.startTF);
    }
    clearStopSearch() {
        if (this.waypoints.length >= 1 && this.waypoints[this.waypoints.length - 1].isStop === true) {
            const toRemove = this.waypoints.splice(this.waypoints.length - 1, 1)[0];
            this.routeDataSource.remove(toRemove.marker);
            if (this.line) {
                this.line.positions = this.waypoints.map((w) => w.position);
            }
        }
        this.currentStopSearchText = null;
        this.stopTF.text = null;
        this.unfocus(this.stopTF);
    }
}
