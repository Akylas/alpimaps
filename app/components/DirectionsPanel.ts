import { ClickType, fromNativeMapPos, MapPos } from 'nativescript-carto/core';
import { LocalVectorDataSource } from 'nativescript-carto/datasources/vector';
import { VectorElementEventData, VectorLayer, VectorTileEventData } from 'nativescript-carto/layers/vector';
import {
    PackageManagerValhallaRoutingService,
    RoutingAction,
    RoutingResult,
    ValhallaOnlineRoutingService,
    ValhallaProfile,
    ValhallaOfflineRoutingService
} from 'nativescript-carto/routing';
import { CartoMap } from 'nativescript-carto/ui';
import { Line, LineEndType, LineJointType, LineStyleBuilder } from 'nativescript-carto/vectorelements/line';
import { Marker, MarkerStyleBuilder } from 'nativescript-carto/vectorelements/marker';
import { Point, PointStyleBuilder } from 'nativescript-carto/vectorelements/point';
import { Text, TextStyleBuilder } from 'nativescript-carto/vectorelements/text';
import { Group, GroupOptions } from 'nativescript-carto/vectorelements/group';
import { confirm } from 'nativescript-material-dialogs';
import { TextField } from '@nativescript/core/ui/text-field/text-field';
import { Component } from 'vue-property-decorator';
// import { layout } from '@nativescript/core/utils/utils';
import { Item } from '~/mapModules/ItemsModule';
import { IMapModule } from '~/mapModules/MapModule';
import BaseVueComponent from './BaseVueComponent';
import Map from './Map';
import { showSnack } from 'nativescript-material-snackbar';
import { File, Folder, path } from '@nativescript/core/file-system';
import { device } from '@nativescript/core/platform';
import { layout } from '@nativescript/core/utils/utils';

export interface RouteInstruction {
    position: MapPos<LatLonKeys>;
    action: string;
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
    points: MapPos<LatLonKeys>[];
    data: Array<{ x: number; altitude: number; altAvg: number; grade }>;
    colors?: Array<{ x: number; color: string }>;
}
export interface Route {
    profile?: RouteProfile;
    positions: MapPos<LatLonKeys>[];
    totalTime: number;
    totalDistance: number;
    instructions: RouteInstruction[];
}

function routingResultToJSON(result: RoutingResult<LatLonKeys>) {
    const rInstructions = result.getInstructions();
    const instructions: RouteInstruction[] = [];
    const points = result.getPoints().toArray();
    const positions = [];
    let lastP;
    points.forEach(p => {
        if (!lastP || lastP.lat !== p.lat || lastP.lon !== p.lon) {
            positions.push(p);
        }
        lastP = p;
    });
    for (let i = 0; i < rInstructions.size(); i++) {
        const instruction = rInstructions.get(i);

        const position = points[instruction.getPointIndex()];
        // console.log('instruction', i, JSON.stringify(position), (instruction as any).getInstruction());
        instructions.push({
            position,
            action: instruction.getAction().toString(),
            azimuth: instruction.getAzimuth(),
            distance: instruction.getDistance(),
            time: instruction.getTime(),
            pointIndex: instruction.getPointIndex(),
            turnAngle: instruction.getTurnAngle(),
            streetName: instruction.getStreetName(),
            instruction: (instruction as any).getInstruction()
        });
    }
    const res = {
        positions,
        totalTime: result.getTotalTime(),
        totalDistance: result.getTotalDistance(),
        instructions
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
    // startMarker: Marker = null;
    // stopMarker: Marker = null;
    waypoints: Array<{
        marker: Group;
        position: MapPos<LatLonKeys>;
        isStart: boolean;
        isStop: boolean;
        metaData: any;
        text: string;
    }> = [];
    // waypoints: MapPos[] = [];
    // stopPos: MapwaypointsPos = null;
    profile: ValhallaProfile = 'pedestrian';
    showOptions = false;
    loading = false;
    currentRoute: Route;
    currentLine: Line;

    valhallaCostingOptions = { use_hills: 0, use_roads: 0, use_ferry: 1, max_hiking_difficulty: 6 };

    get profileColor() {
        return p => {
            return this.profile === p ? '#fff' : '#55ffffff';
        };
    }

    setProfile(p: ValhallaProfile) {
        this.profile = p;
    }

    get peekHeight() {
        return Math.round(layout.toDeviceIndependentPixels(this.nativeView.getMeasuredHeight()))
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
            this._routeLayer.setVectorElementEventListener(this.mapComp);
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
            text: metaData ? metaData.name : `${position.lat.toFixed(3)}, ${position.lon.toFixed(3)}`
        };
        const group = new Group();
        group.elements = [
            new Marker({
                position,
                styleBuilder: {
                    size: 15,
                    hideIfOverlapped: false,
                    scaleWithDPI: true,
                    color: 'green'
                }
            })
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
            text: metaData ? metaData.name : `${position.lat.toFixed(3)}, ${position.lon.toFixed(3)}`
        };
        // this.log('addStopPoint', this.waypoints.length,  this.waypoints);
        if (this.waypoints.length > 0 && this.waypoints[this.waypoints.length - 1].isStop === true) {
            this.waypoints[this.waypoints.length - 1].isStop = false;
            (this.waypoints[this.waypoints.length - 1].marker.elements[0] as Point).styleBuilder = {
                size: 15,
                hideIfOverlapped: false,
                scaleWithDPI: true,
                color: 'blue'
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
                    color: 'red'
                }
            })
            // new Text({
            //     position,
            //     text: this.waypoints.length + '',
            //     styleBuilder: {
            //         fontSize: 5,
            //         hideIfOverlapped: false,
            //         anchorPointY: 1,
            //         // scaleWithDPI: true,
            //         color: 'white',
            //         // backgroundColor: 'red'
            //     }
            // })
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
                    width: 4
                },
                positions: this.waypoints.map(w => w.position)
            });
            this.routeDataSource.add(this.line);
        } else {
            this.line.positions = this.waypoints.map(w => w.position);
        }
        this.mapComp.topSheetHolder.peekSheet();
    }
    addWayPoint(position: MapPos<LatLonKeys>, metaData?, index = -1) {
        const toAdd = {
            isStart: false,
            isStop: false,
            position,
            metaData,
            marker: null,
            text: metaData ? metaData.name : `${position.lat.toFixed(3)}, ${position.lon.toFixed(3)}`
        };
        // this.log('addWayPoint', toAdd);
        if (this.waypoints.length === 0 || this.waypoints[0].isStart === false) {
            this.addStartPoint(position, metaData);
        } else {
            this.addStopPoint(position, metaData);
            // this.log('addWayPoint stop', this.waypoints[this.waypoints.length - 1]);
        }
    }

    handleClickOnPos(position: MapPos<LatLonKeys>, metaData?) {
        // this.log('onMapClicked', position, this.startPos, this.stopPos);
        // const text = metaData ? metaData.name : `${position.lat.toFixed(3)}, ${position.lon.toFixed(3)}`;
        // // console.log('handleClickOnPos', position, text);
        // if (this.waypoints.length === 0) {
        //     // set start, or start =again
        //     this.startTF.text = this.currentStartSearchText = text;
        //     // this.setStartPosition(position);
        // } else if (this.waypoints.length === 1) {
        //     // set stop and calculate
        //     // this.setStopPosition(position);
        //     this.stopTF.text = this.currentStopSearchText = text;
        //     // this.showRoute(this.startPos, this.stopPos);
        // }
        this.addWayPoint(position);
    }
    handleClickOnItem(item: Item) {
        this.handleClickOnPos(item.position, item.properties);
    }
    onVectorTileClicked(data: VectorTileEventData<LatLonKeys>) {
        const { clickType, position, featurePosition, featureData } = data;
        // console.log('onVectorTileClicked', clickType, ClickType.LONG);
        if (clickType === ClickType.LONG) {
            // this.log('onVectorTileClicked', data.featureLayerName);
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
        // this.log('onMapClicked', clickType, ClickType.LONG);

        if (clickType === ClickType.LONG) {
            this.handleClickOnPos(position);
            return true;
        }
    }

    // setStartPosition(position: MapPos) {
    //     this.log('setStartPosition', position, !!this.startMarker);
    //     if (!this.startMarker) {
    //         // Create markers for start & end, and a layer for them
    //         const styleBuilder = new MarkerStyleBuilder({
    //             hideIfOverlapped: false,
    //             size: 30,
    //             color: 'green'
    //         });

    //         this.startMarker = new Marker({
    //             position,
    //             styleBuilder
    //         });
    //         this.routeDataSource.add(this.startMarker);
    //         this.ensureRouteLayer();
    //     } else {
    //         this.startMarker.position = position;
    //         this.startMarker.visible = true;
    //     }
    //     this.mapComp.topSheetHolder.peekSheet();
    // }
    // setStopPosition(position: MapPos) {
    //     this.log('setStopPosition', position, !!this.stopMarker);
    //     if (!this.stopMarker) {
    //         // Create markers for start & end, and a layer for them
    //         const styleBuilder = new MarkerStyleBuilder({
    //             hideIfOverlapped: false,
    //             size: 30,
    //             color: 'red'
    //         });

    //         this.stopMarker = new Marker({
    //             position,
    //             styleBuilder
    //         });
    //         this.routeDataSource.add(this.stopMarker);
    //         this.ensureRouteLayer();
    //     } else {
    //         this.stopMarker.position = position;
    //         this.stopMarker.visible = true;
    //     }
    //     this.mapComp.topSheetHolder.peekSheet();
    // }

    cancel() {
        // this.log('cancel');
        this.waypoints = [];
        if (this.line) {
            this.line = null;
        }
        if (this._routeDataSource) {
            this._routeDataSource.clear();
        }
        this.startTF.text = null;
        this.stopTF.text = null;
        this.mapComp.topSheetHolder.closeSheet();
    }
    _offlineRoutingSearchService: PackageManagerValhallaRoutingService;
    get offlineRoutingSearchService() {
        if (!this._offlineRoutingSearchService) {
            this._offlineRoutingSearchService = new PackageManagerValhallaRoutingService({
                packageManager: this.mapComp.$packageService.routingPackageManager
            });
        }
        return this._offlineRoutingSearchService;
    }
    _localOfflineRoutingSearchService: ValhallaOfflineRoutingService;
    get localOfflineRoutingSearchService() {
        if (!this._localOfflineRoutingSearchService) {
            if (Folder.exists(LOCAL_MBTILES)) {
                const folder = Folder.fromPath(LOCAL_MBTILES);
                const entities = folder.getEntitiesSync();
                entities.some(s => {
                    if (s.name.endsWith('.vtiles')) {
                        this._localOfflineRoutingSearchService = new ValhallaOfflineRoutingService({
                            path: s.path
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
                apiKey: gVars.MAPBOX_TOKEN
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
                color: 'white'
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
                color: 'yellow'
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
                color: 'purple'
            }).buildStyle();
        }
        return this._routeRightPointStyle;
    }
    createRoutePoint(instruction: RouteInstruction, ds: LocalVectorDataSource) {
        let style;

        const action = instruction.action;

        if (action === RoutingAction.TURN_LEFT.toString()) {
            style = this.routeLeftPointStyle;
        } else if (action === RoutingAction.TURN_RIGHT.toString()) {
            style = this.routeRightPointStyle;
        } else {
            style = this.routePointStyle;
        }

        const marker = new Marker({
            position: instruction.position,
            style,
            metaData: { instruction: JSON.stringify(instruction) }
        });

        ds.add(marker);
    }
    createPolyline(result: Route, positions) {
        const styleBuilder = new LineStyleBuilder({
            color: 'orange',
            joinType: LineJointType.ROUND,
            endType: LineEndType.ROUND,
            clickWidth: 20,
            width: 6
        });
        // this.log('createPolyline', JSON.stringify(result));
        return new Line({
            positions,
            metaData: { route: JSON.stringify(result) },
            styleBuilder
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
    showRoute(online = false) {
        return new Promise<Route>((resolve, reject) => {
            this.loading = true;

            const service = online
                ? this.onlineRoutingSearchService
                : this.localOfflineRoutingSearchService || this.offlineRoutingSearchService;
            service.profile = this.profile;
            service.calculateRoute(
                {
                    projection: this.mapView.projection,
                    points: this.waypoints.map(r => r.position),
                    customOptions: {
                        directions_options: { language: device.language },
                        costing_options: {
                            car: this.valhallaCostingOptions,
                            pedestrian: this.valhallaCostingOptions,
                            bicycle: this.valhallaCostingOptions
                        }
                    } as any
                },
                (error, result) => {
                    this.loading = false;
                    if (error || result === null) {
                        return reject(error);
                    }
                    this.cancel();
                    const route = routingResultToJSON(result);

                    resolve(route);
                }
            );
        })
            .then(route => {
                this.currentRoute = route;
                // const distance = route.totalDistance / 1000;
                // const time = this.secondsToHours(route.totalTime);
                // const text = 'Your route is ' + distance + 'km (' + time + ')';

                // alert(text);
                this.clearCurrentLine();

                // this.routeDataSource.clear();
                this.currentLine = this.createPolyline(route, route.positions);
                this.routeDataSource.clear();
                this.line = null;
                this.waypoints = [];
                this.routeDataSource.add(this.currentLine);
                this.ensureRouteLayer();
                // Add instruction markers
                // const instructions = result.getInstructions();
                // let first = true;

                // route.instructions.forEach(i => {
                //     if (first) {
                //         // Set car to first instruction position
                //         first = false;
                //     } else {
                //         this.createRoutePoint(i, this.routeDataSource);
                //     }
                // });
                this.mapComp.selectItem({
                    item: { position: fromNativeMapPos(this.currentLine.getGeometry().getCenterPos()), route },
                    isFeatureInteresting: true,
                    showButtons: true
                });
            })
            .catch(error => {
                if (!online) {
                    return confirm({
                        message: this.$t('try_online'),
                        okButtonText: this.$t('ok'),
                        cancelButtonText: this.$t('cancel')
                    }).then(result => {
                        if (result) {
                            this.showRoute(true);
                        }
                    });
                } else {
                    this.cancel();
                    return Promise.reject(error || 'failed to compute route');
                }
            });
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
            // this.routeDataSource.clear();
            this.currentRoute = null;
            this.clearCurrentLine();
        }
    }
    onSelectedItem(item: Item, oldItem: Item) {
        if (!!oldItem && !!oldItem.route && oldItem.route === this.currentRoute) {
            // this.routeDataSource.clear();
            this.currentRoute = null;
            this.clearCurrentLine();
        }
        if (!!item && !!item.route && item.route !== this.currentRoute) {
            // this.routeDataSource.clear();
            this.currentRoute = null;
            this.clearCurrentLine();
        }
    }

    unfocus(textField: TextField) {
        // if (this.searchAsTypeTimer) {
        //     clearTimeout(this.searchAsTypeTimer);
        //     this.searchAsTypeTimer = null;
        // }
        if (gVars.isAndroid) {
            (textField.nativeViewProtected as android.view.View).clearFocus();
        }
        textField.dismissSoftInput();
    }

    currentStartSearchText = null;
    currentStopSearchText = null;
    onStartTextChange(e) {
        this.currentStartSearchText = e.value;
    }
    onStopTextChange(e) {
        this.currentStopSearchText = e.value;
    }
    get startTF() {
        return this.$refs.startTF && (this.$refs.startTF.nativeView as TextField);
    }
    get stopTF() {
        return this.$refs.stopTF && (this.$refs.stopTF.nativeView as TextField);
    }
    clearStartSearch() {
        // if (this.searchAsTypeTimer) {
        //     clearTimeout(this.searchAsTypeTimer);
        //     this.searchAsTypeTimer = null;
        // }
        // this.dataItems = [] as any;
        if (this.waypoints.length >= 1 && this.waypoints[0].isStart === true) {
            const toRemove = this.waypoints.splice(0, 1)[0];
            this.routeDataSource.remove(toRemove.marker);
            if (this.line) {
                this.line.positions = this.waypoints.map(w => w.position);
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
                this.line.positions = this.waypoints.map(w => w.position);
            }
        }
        this.currentStopSearchText = null;
        this.stopTF.text = null;
        this.unfocus(this.stopTF);
    }
}
