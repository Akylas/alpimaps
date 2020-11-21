import { Align, Canvas, Paint } from '@nativescript-community/ui-canvas';
import { CartoMap } from '@nativescript-community/ui-carto/ui';
import { LineChart } from '@nativescript-community/ui-chart/charts';
import { HighlightEventData } from '@nativescript-community/ui-chart/charts/Chart';
import { XAxisPosition } from '@nativescript-community/ui-chart/components/XAxis';
import { Rounding } from '@nativescript-community/ui-chart/data/DataSet';
import { Entry } from '@nativescript-community/ui-chart/data/Entry';
import { LineData } from '@nativescript-community/ui-chart/data/LineData';
import { LineDataSet } from '@nativescript-community/ui-chart/data/LineDataSet';
import { Highlight } from '@nativescript-community/ui-chart/highlight/Highlight';
import { LineDataProvider } from '@nativescript-community/ui-chart/interfaces/dataprovider/LineDataProvider';
import { ShareFile } from '@nativescript-community/ui-share-file';
import { Color, GridLayout, knownFolders } from '@nativescript/core';
import * as app from '@nativescript/core/application';
import { openUrl } from '@nativescript/core/utils';
import { Component, Prop, Watch } from 'vue-property-decorator';
import { convertValueToUnit } from '~/helpers/formatter';
import { IMapModule } from '~/mapModules/MapModule';
import { IItem as Item } from '~/models/Item';
import { omit } from '~/utils';
import { screenHeightDips, textColor } from '~/variables';
import BaseVueComponent from './BaseVueComponent';
import BottomSheetBase from './BottomSheet/BottomSheetBase';
import BottomSheetInfoView from './BottomSheetInfoView';
import BottomSheetRouteInfoView from './BottomSheetRouteInfoView';
import { RouteInstruction } from './DirectionsPanel';
import Map from './Map';

export const LISTVIEW_HEIGHT = 200;
export const PROFILE_HEIGHT = 150;
export const WEB_HEIGHT = 400;

@Component({
    components: {
        BottomSheetRouteInfoView,
        BottomSheetInfoView,
    },
})
export default class BottomSheetInner extends BaseVueComponent implements IMapModule {
    mapView: CartoMap<LatLonKeys>;
    mapComp: Map;
    
    currentItem: Item = null;
    get item() {
        return this.currentItem;
    }
    profileHeight = PROFILE_HEIGHT;
    graphAvailable = false;

    mounted() {
        this.updateSteps();
        super.mounted();
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
        return this.getRef<GridLayout>('bottomSheet');
    }
    get routeView() {
        return this.$refs['routeView'] as BottomSheetRouteInfoView;
    }

    get chart() {
        return this.getRef<LineChart>('graphView');
    }

    get webViewSrc() {
        // if (this.listViewAvailable && this.item?.properties) {
        if (this.item?.properties) {
            const item = this.item;
            const props = item.properties;
            let name = props.name;
            if (props.wikipedia) {
                name = props.wikipedia.split(':')[1];
            }
            if (item.address) {
                name += ' ' + item.address.county;
            }
            const url = `https://duckduckgo.com/?kae=d&ks=s&ko=-2&kaj=m&k1=-1&q=${encodeURIComponent(name)
                .toLowerCase()
                .replace('/s+/g', '+')}`;
            // console.log('webViewSrc', url);
            return url;
        }
    }

    get rows() {
        const result = '70,50,auto,auto';
        return result;
    }
    get showListView() {
        return this.listViewAvailable && this.listViewVisible;
    }
    get showGraph() {
        return this.graphAvailable;
    }
    get itemRouteNoProfile() {
        return this.item && !!this.item.route && (!this.item.route.profile || !this.item.route.profile.max);
    }

    get itemIsRoute() {
        return this.item && !!this.item.route;
    }

    updateGraphAvailable() {
        this.graphAvailable =
            this.itemIsRoute &&
            !!this.item.route.profile &&
            !!this.item.route.profile.data &&
            this.item.route.profile.data.length > 0;
    }
    onSelectedItemChange(item: Item) {
        this.currentItem = item;
        this.updateGraphAvailable();
        this.updateSteps();
        if (this.graphAvailable) {
            this.updateChartData();
        }
    }

    onNewLocation(e: any) {
        const index = this.routeView.onNewLocation(e);
        console.log('onNewLocation', index);
        if (index !== -1 && this.graphAvailable) {
            const profile = this.item.route.profile;
            const profileData = profile?.data;
            if (profileData) {
                const dataSet = this.chart.getData().getDataSetByIndex(0);
                dataSet.setIgnoreFiltered(true);
                const item = profileData[index];
                dataSet.setIgnoreFiltered(false);
                // console.log('highlight item', item);
                this.chart.highlightValues([
                    {
                        dataSetIndex: 0,
                        x: index,
                        entry: item,
                    } as any,
                ]);
            }
        }
    }
    onChartHighlight(event: HighlightEventData) {
        const x = event.highlight.entryIndex;
        const positions = this.item.route.positions;
        const position = positions.getPos(Math.max(0, Math.min(x, positions.size() - 1)));
        if (position) {
            const mapComp = this.$getMapComponent();
            mapComp.selectItem({ item: { position }, isFeatureInteresting: true, setSelected: false, peek: false });
        }
    }
    searchItemWeb() {
        if (global.isAndroid) {
            const query = this.$getMapComponent().mapModule('formatter').getItemName(this.item);
            if (global.isAndroid) {
                const intent = new android.content.Intent(android.content.Intent.ACTION_WEB_SEARCH);
                intent.putExtra(android.app.SearchManager.QUERY, query); // query contains search string
                (app.android.foregroundActivity as android.app.Activity).startActivity(intent);
            }
        }
    }
    openWebView() {
        openUrl(this.webViewSrc);
    }
    listViewAvailable = false;
    listViewVisible = false;
    toggleWebView() {
        // this.stepToScrollTo = !this.listViewAvailable ? this.steps.length : -1;
        this.listViewAvailable = !this.listViewAvailable;
    }
    // stepToScrollTo = -1;
    webViewHeight = 0;
    steps = [0];

    updateSteps() {
        let total = 70;
        const result = [0, total];
        total += 50;
        result.push(total);
        if (this.graphAvailable) {
            total += PROFILE_HEIGHT;
            result.push(total);
        }
        if (this.listViewAvailable) {
            total += WEB_HEIGHT;
            result.push(total);
            const delta = Math.floor(screenHeightDips - this.statusBarHeight - total);
            this.webViewHeight = WEB_HEIGHT + delta;
            total += delta;
            result.push(total);
        }
        this.steps = this.nativeView['steps'] = result;
    }

    updatingItem = false;
    async getProfile() {
        this.updatingItem = true;
        const profile = await this.$packageService.getElevationProfile(this.item);
        this.item.route.profile = profile;
        await (this.item.id !== undefined ? this.updateItem(false) : this.saveItem(false));
        this.updateGraphAvailable();
        this.updateSteps();
        if (this.graphAvailable) {
            this.updateChartData();
        }
        this.$getMapComponent().bottomSheetStepIndex = 3;
        this.updatingItem = false;
    }
    saveItem(peek = true) {
        const mapComp = this.$getMapComponent();
        mapComp
            .mapModule('items')
            .saveItem(mapComp.selectedItem)
            .then((item) => {
                mapComp.selectItem({ item, isFeatureInteresting: true, peek });
            })
            .catch((err) => {
                this.showError(err);
            });
    }
    async updateItem(peek = true) {
        const mapComp = this.$getMapComponent();
        return mapComp
            .mapModule('items')
            .updateItem(mapComp.selectedItem)
            .then((item) => {
                mapComp.selectItem({ item, isFeatureInteresting: true, peek });
            })
            .catch((err) => {
                this.showError(err);
            });
    }
    deleteItem() {
        const mapComp = this.$getMapComponent();
        mapComp.mapModule('items').deleteItem(this.mapComp.selectedItem);
    }
    shareItem() {
        const itemToShare = omit(this.item, 'vectorElement');
        this.shareFile(JSON.stringify(itemToShare), 'sharedItem.json');
    }
    async shareFile(content: string, fileName: string) {
        const file = knownFolders.temp().getFile(fileName);
        // iOS: using writeText was not adding the file. Surely because it was too soon or something
        // doing it sync works better but still needs a timeout
        // this.showLoading('loading');
        await file.writeText(content);
        const shareFile = new ShareFile();
        await shareFile.open({
            path: file.path,
            title: fileName,
            options: true, // optional iOS
            animated: true, // optional iOS
        });
    }
    getRouteInstructionTitle(item: RouteInstruction) {
        return item.instruction;
    }
    getRouteInstructionSubtitle(item: RouteInstruction) {
        return item.streetName;
    }
    chartInitialized = false;
    updateChartData() {
        const chart = this.chart;
        const sets = [];
        const profile = this.item.route.profile;
        const profileData = profile?.data;
        if (profileData) {
            if (!this.chartInitialized) {
                this.chartInitialized = true;
                chart.setHighlightPerDragEnabled(true);
                chart.setHighlightPerTapEnabled(true);
                // chart.setScaleXEnabled(true);
                // chart.setDragEnabled(true);
                chart.getAxisRight().setEnabled(false);
                chart.getLegend().setEnabled(false);
                chart.setDrawHighlight(false);
                const leftAxis = chart.getAxisLeft();
                leftAxis.setTextColor(textColor);
                leftAxis.setLabelCount(3);

                const xAxis = chart.getXAxis();
                xAxis.setPosition(XAxisPosition.BOTTOM);
                xAxis.setTextColor(textColor);
                xAxis.setValueFormatter({
                    getAxisLabel: (value, axis) => convertValueToUnit(value, 'km').join(' '),
                });

                chart.setMaxVisibleValueCount(300);
                chart.setMarker({
                    paint: new Paint(),
                    refreshContent(e: Entry, highlight: Highlight) {
                        this.entry = e;
                    },
                    draw(canvas: Canvas, posX: any, posY: any) {
                        const canvasHeight = canvas.getHeight();
                        const paint = this.paint as Paint;
                        paint.setColor('#FFBB73');
                        paint.setAntiAlias(true);
                        paint.setTextAlign(Align.CENTER);
                        paint.setStrokeWidth(1);
                        paint.setTextSize(10);
                        canvas.save();
                        canvas.translate(posX, posY);
                        canvas.drawLine(-5, 0, 5, 0, paint);
                        canvas.drawLine(0, -5, 0, 5, paint);
                        if (posY > canvasHeight - 20) {
                            canvas.translate(0, -30);
                        } else {
                            canvas.translate(0, 10);
                        }
                        canvas.drawText(this.entry.altitude.toFixed(), 0, 5, paint);
                        canvas.restore();
                    },
                } as any);
            } else {
                chart.highlightValues(null);
                chart.resetZoom();
            }
            const chartData = chart.getData();
            if (!chartData) {
                const set = new LineDataSet(profileData, 'altitude', 'distance', 'altAvg');
                set.setDrawValues(true);
                set.setValueTextColor(textColor);
                set.setValueTextSize(10);
                set.setMaxFilterNumber(200);
                set.setUseColorsForFill(true);
                set.setFillFormatter({
                    getFillLinePosition(dataSet: LineDataSet, dataProvider: LineDataProvider) {
                        return dataProvider.getYChartMin();
                    },
                });
                set.setValueFormatter({
                    getFormattedValue(value: number, entry: Entry, index, count, dataSetIndex: any, viewPortHandler: any) {
                        if (index === 0 || index === count - 1 || value === profile.max[1]) {
                            return value.toFixed();
                        }
                    },
                } as any);
                set.setDrawFilled(true);
                if (profile.colors && profile.colors.length > 0) {
                    set.setLineWidth(2);
                    set.setColors(profile.colors);
                } else {
                    set.setColor('#60B3FC');
                }
                // set.setMode(Mode.CUBIC_BEZIER);
                set.setFillColor('#8060B3FC');
                sets.push(set);
                const lineData = new LineData(sets);
                chart.setData(lineData);
            } else {
                chart.highlightValues(null);
                const dataSet = chartData.getDataSetByIndex(0);
                dataSet.setValues(profileData);
                chart.getData().notifyDataChanged();
                chart.notifyDataSetChanged();
            }
        }
    }
    get routeInstructions() {
        if (this.listViewAvailable) {
            return this.item.route.instructions;
        }
        return [];
    }
    public onInstructionTap(instruction: RouteInstruction) {
        // console.log('onInstructionTap', instruction);

        const mapComp = this.$getMapComponent();
        // mapComp.selectItem({
        //     item: { position: instruction.position },
        //     isFeatureInteresting: true,
        //     setSelected: false,
        //     peek: false
        // });
        // if (this.graphAvailable) {
        //     const dataSet = this.chart.getData().getDataSetByIndex(0);
        //     dataSet.setIgnoreFiltered(true);
        //     const item = dataSet.getEntryForIndex(instruction.pointIndex);
        //     dataSet.setIgnoreFiltered(false);
        //     // console.log('highlight item', item);
        //     this.chart.highlightValues([
        //         {
        //             dataSetIndex: 0,
        //             x: item.x,
        //             entry: item
        //         } as Highlight
        //     ]);
        // }
    }
}
