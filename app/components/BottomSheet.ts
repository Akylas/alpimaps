import * as app from '@nativescript/core/application';
import { CartoMap } from 'nativescript-carto/ui';
import { Color } from '@nativescript/core/ui/core/view';
import { GridLayout } from '@nativescript/core/ui/layouts/grid-layout/grid-layout';
import { Component, Prop, Watch } from 'vue-property-decorator';
import { convertValueToUnit } from '~/helpers/formatter';
import { Item } from '~/mapModules/ItemsModule';
import { IMapModule } from '~/mapModules/MapModule';
import { actionBarHeight, screenHeightDips } from '~/variables';
import BottomSheetBase from './BottomSheet/BottomSheetBase';
import BottomSheetInfoView from './BottomSheetInfoView';
import BottomSheetRouteInfoView from './BottomSheetRouteInfoView';
import { RouteInstruction } from './DirectionsPanel';
import Map from './Map';
import LineChart from 'nativescript-chart/charts/LineChart';
import { LineDataSet } from 'nativescript-chart/data/LineDataSet';
import { LineData } from 'nativescript-chart/data/LineData';
import { XAxisPosition } from 'nativescript-chart/components/XAxis';
import { omit } from '~/utils';
import { knownFolders } from '@nativescript/core/file-system/file-system';
import { ShareFile } from 'nativescript-akylas-share-file';
import { Rounding } from 'nativescript-chart/data/DataSet';
// import InAppBrowser from 'nativescript-inappbrowser';
import { openUrl } from '@nativescript/core/utils/utils';
import { Entry } from 'nativescript-chart/data/Entry';
import { Canvas, Paint, Align } from 'nativescript-canvas';
import { Highlight } from 'nativescript-chart/highlight/Highlight';

export const LISTVIEW_HEIGHT = 200;
export const PROFILE_HEIGHT = 150;
export const WEB_HEIGHT = 400;

@Component({
    components: {
        BottomSheetRouteInfoView,
        BottomSheetInfoView
    }
})
export default class BottomSheet extends BottomSheetBase implements IMapModule {
    mapView: CartoMap<LatLonKeys>;
    mapComp: Map;
    // @Prop({
    //     default: () => [50]
    // })
    // steps;
    @Prop() item: Item;

    profileHeight = PROFILE_HEIGHT;
    graphAvailable = false;

    mounted() {
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
        return this.$refs['bottomSheet'] && (this.$refs['bottomSheet'].nativeView as GridLayout);
    }
    get routeView() {
        return this.$refs['routeView'] as BottomSheetRouteInfoView;
    }

    get chart() {
        return this.$refs.graphView.nativeView as LineChart;
    }

    get webViewSrc() {
        if (this.listViewAvailable && this.item?.properties) {
            const props = this.item.properties;
            let name = props.name;
            if (props.wikipedia) {
                name = props.wikipedia.split(':')[1];
            }
            let url = `https://duckduckgo.com/?kae=d&ks=s&ko=-2&kaj=m&k1=-1&q=${encodeURIComponent(name)
                .toLowerCase()
                .replace('/s+/g', '+')}`;
            // this.log('webViewSrc', url);
            return url;
        }
        encodeURIComponent;
    }

    get rows() {
        const result = `70,50,auto,auto`;
        return result;
    }
    get showListView() {
        return this.listViewAvailable && this.listViewVisible;
    }
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
        this.reset();
        // this.listViewVisible = false;
        // this.listViewAvailable =
        //     !!this.item && !!this.item.route && !!this.item.route.instructions && this.item.route.instructions.length > 0;

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
        const index = this.routeView.onNewLocation(e);
        this.log('onNewLocation', index);
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
                        x: item.x,
                        entry: item
                    } as any
                ]);
            }
        }
    }
    onChartTap(event) {
        const chart = this.chart;
        const dataSet = chart.getData().getDataSetByIndex(0);
        dataSet.setIgnoreFiltered(true);
        const x = dataSet.getEntryIndexForXValue(event.highlight.x, NaN, Rounding.CLOSEST);
        dataSet.setIgnoreFiltered(false);

        const position = this.item.route.positions[x];
        if (position) {
            const mapComp = this.$getMapComponent();
            mapComp.selectItem({ item: { position }, isFeatureInteresting: true, setSelected: false, peek: false });
        }
    }
    searchItemWeb() {
        if (gVars.isAndroid) {
            const query = this.$getMapComponent()
                .mapModule('formatter')
                .getItemName(this.item);
            if (gVars.isAndroid) {
                const intent = new android.content.Intent(android.content.Intent.ACTION_WEB_SEARCH);
                intent.putExtra(android.app.SearchManager.QUERY, query); // query contains search string
                (app.android.foregroundActivity as android.app.Activity).startActivity(intent);
            }
        }
    }

    toggleWebView() {
        this.stepToScrollTo = !this.listViewAvailable ? this.steps.length : -1;
        this.listViewAvailable = !this.listViewAvailable;
    }
    stepToScrollTo = -1;
    get steps() {
        let total = 70;
        const result = [total];
        total += 50;
        result.push(total);
        if (this.graphAvailable) {
            total += PROFILE_HEIGHT;
            result.push(total);
        }
        if (this.mListViewAvailable) {
            total += WEB_HEIGHT;
            result.push(total);
            total += screenHeightDips - total;
            result.push(total);
        }
        if (this.stepToScrollTo >= 0) {
            const index = this.stepToScrollTo;
            this.stepToScrollTo = -1;
            setTimeout(() => {
                this.holder.scrollSheetToPosition(this.steps[index]);
            }, 0);
        }
        return result;
    }

    updatingItem = false;
    async getProfile() {
        this.updatingItem = true;
        const positions = this.item.route.positions;
        const profile = await this.$packageService.getElevationProfile(positions);
        this.item.route.profile = profile;
        (await this.item.id) !== undefined ? this.updateItem(false) : this.saveItem(false);
        this.stepToScrollTo = 2;
        this.updatingItem = false;
    }
    saveItem(peek = true) {
        const mapComp = this.$getMapComponent();
        mapComp
            .mapModule('items')
            .saveItem(mapComp.selectedItem)
            .then(item => {
                mapComp.selectItem({ item, isFeatureInteresting: true, peek });
            })
            .catch(err => {
                this.showError(err);
            });
    }
    async updateItem(peek = true) {
        const mapComp = this.$getMapComponent();
        return mapComp
            .mapModule('items')
            .updateItem(mapComp.selectedItem)
            .then(item => {
                mapComp.selectItem({ item, isFeatureInteresting: true, peek });
            })
            .catch(err => {
                this.showError(err);
            });
    }
    deleteItem() {
        const mapComp = this.$getMapComponent();
        mapComp.mapModule('items').deleteItem(this.mapComp.selectedItem);
    }
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
        const shareFile = new ShareFile();
        await shareFile.open({
            path: file.path,
            title: fileName,
            options: true, // optional iOS
            animated: true // optional iOS
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
            const textColor = new Color('white');
            if (!this.chartInitialized) {
                this.chartInitialized = true;
                chart.setDoubleTapToZoomEnabled(true);
                chart.setScaleEnabled(true);
                chart.setDragEnabled(true);
                chart.setHighlightPerTapEnabled(true);
                chart.setDrawHighlight(false);

                chart.getLegend().setEnabled(false);
                // chart.setLogEnabled(true);
                chart.getAxisLeft().setTextColor(textColor);
                chart.getXAxis().setPosition(XAxisPosition.BOTTOM);
                chart.getXAxis().setTextColor(textColor);
                chart.getXAxis().setValueFormatter({
                    getAxisLabel: (value, axis) => convertValueToUnit(value, 'km')[0]
                });
                chart.getAxisLeft().setLabelCount(3);
                chart.getXAxis().setDrawLabels(true);
                chart.getXAxis().setDrawGridLines(true);

                chart.getAxisRight().setEnabled(false);
                chart.getAxisRight().setTextColor(textColor);

                chart.setMaxVisibleValueCount(300);
                chart.setMarker({
                    paint: new Paint(),
                    refreshContent(e: Entry, highlight: Highlight) {
                        this.highlight = highlight;
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
                        canvas.drawText(this.highlight.entry.altitude.toFixed(), 0, 5, paint);
                        canvas.restore();
                    }
                } as any);
            } else {
                chart.highlightValues(null);
                chart.resetZoom();
            }
            let set = new LineDataSet(profileData, 'altitude', 'x', 'altAvg');
            set.setDrawValues(true);
            set.setValueTextColor(textColor);
            set.setValueTextSize(10);
            set.setMaxFilterNumber(200);
            set.setUseColorsForFill(true);
            set.setValueFormatter({
                getFormattedValue(value: number, entry: Entry, index, count, dataSetIndex: any, viewPortHandler: any) {
                    if (index === 0 || index === count - 1 || value === profile.max[1]) {
                        return value.toFixed();
                    }
                }
            });
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
            // set = new LineDataSet(profileData, 'grade', 'x', 'grade');
            // set.setAxisDependency(AxisDependency.RIGHT);
            // set.setColor('red');
            // sets.push(set);
        }

        const linedata = new LineData(sets);
        chart.setData(linedata);
    }
    get routeInstructions() {
        if (this.listViewAvailable) {
            return this.item.route.instructions;
        }
        return [];
    }
    public onInstructionTap(instruction: RouteInstruction) {
        // this.log('onInstructionTap', instruction);

        const mapComp = this.$getMapComponent();
        mapComp.selectItem({
            item: { position: instruction.position },
            isFeatureInteresting: true,
            setSelected: false,
            peek: false
        });
        if (this.graphAvailable) {
            const dataSet = this.chart.getData().getDataSetByIndex(0);
            dataSet.setIgnoreFiltered(true);
            const item = dataSet.getEntryForIndex(instruction.pointIndex);
            dataSet.setIgnoreFiltered(false);
            // console.log('highlight item', item);
            this.chart.highlightValues([
                {
                    dataSetIndex: 0,
                    x: item.x,
                    entry: item
                } as Highlight
            ]);
        }
    }
}
