import { Component, Prop, Watch } from 'vue-property-decorator';
import { convertDistance, convertDuration } from '~/helpers/formatter';
import { Item } from '~/mapModules/ItemsModule';
import BaseVueComponent from './BaseVueComponent';
import { RouteInstruction } from './DirectionsPanel';
import ItemFormatter from '~/mapModules/ItemFormatter';
import BottomSheetBase from './BottomSheet/BottomSheetBase';
import { BottomSheetHolderScrollEventData } from './BottomSheet/BottomSheetHolder';

@Component({})
export default class BottomSheet extends BottomSheetBase {
    @Prop({
        default: () => [50]
    })
    steps;
    @Prop() item: Item;

    dataItems: any[] = [];
    listVisible = false;
    _formatter: ItemFormatter;

    mounted() {
        super.mounted();
        this.holder.$on('scroll', this.onScroll);
    }
    destroyed() {
        super.destroyed();
    }
    get formatter() {
        if (!this._formatter && this.$getMapComponent()) {
            this._formatter = this.$getMapComponent().mapModule('formatter');
        }
        return this._formatter;
    }

    get rows() {
        let result = '';
        this.steps.forEach((step, i) => {
            if (i === 0) {
                result += step;
            } else {
                result += ',' + (step - this.steps[i - 1]);
            }
        });
        // const result = this.steps.join(',');
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
    get listViewAvailable() {
        return this.steps.length > 2;
    }
    get showListView() {
        return this.listViewAvailable && this.listVisible;
    }
    @Watch('item')
    onSelectedItemChange(item: Item) {
        // console.log('bottom sheet item changed', item);
        this.listVisible = false;
        if (item && item.route) {
            this.dataItems = item.route.instructions;
        } else {
            this.dataItems = [];
        }
    }
    onScroll(e: BottomSheetHolderScrollEventData) {
        // this.log('onScroll', this.listViewAvailable, this.listVisible, e.height, this.steps[1]);
        if (this.listViewAvailable) {
            if (!this.listVisible && e.height > this.steps[1]) {
                this.listVisible = true;
            }
            if (this.listVisible && !this.isListViewAtTop && e.height < this.steps[1]) {
                // this.log('resetting listViewAtTop to ensure pan enabled');
                this.listViewAtTop = true;
                this.listView.scrollToIndex(0, false);
            }
        }
    }
    saveItem() {
        const mapComp = this.$getMapComponent();
        mapComp
            .mapModule('items')
            .saveItem(this.item)
            .then(item => {
                mapComp.selectItem(item, true);
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
        return item.action;
    }
    getRouteInstructionSubtitle(item: RouteInstruction) {
        return item.streetName;
    }
}
