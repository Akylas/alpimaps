import BaseVueComponent from '../BaseVueComponent';
import { Component } from 'vue-property-decorator';
import BottomSheetHolder, { PAN_GESTURE_TAG } from './BottomSheetHolder';
import Vue from 'nativescript-vue';
import { TouchGestureEventData } from '@nativescript/core/ui/gestures';
import { PanGestureHandler } from 'nativescript-gesturehandler';
import { CollectionView } from 'nativescript-collectionview';
import LineChart from 'nativescript-chart/charts/LineChart';
import { Manager, HandlerType } from 'nativescript-gesturehandler/gesturehandler';
// import { RadCartesianChart } from 'nativescript-ui-chart';
export const NATIVE_GESTURE_TAG = 4;

@Component({})
export default class BottomSheetBase extends BaseVueComponent {
    constructor() {
        super();
    }

    public touchingListView = false;
    public isListViewAtTop = true;
    // public listViewVisible = false;
    isScrollEnabled = true;
    set scrollEnabled(value) {
        if (value !== this.isScrollEnabled) {
            // this.log('set scrollEnabled', value);
            this.isScrollEnabled = value;
        }
    }
    get scrollEnabled() {
        return this.isScrollEnabled;
    }
    get listViewAtTop() {
        return this.isListViewAtTop;
    }
    set listViewAtTop(value) {
        if (value !== this.isListViewAtTop) {
            this.isListViewAtTop = value;
            // this.log('set listViewAtTop ', value);
            this.$emit('listViewAtTop', value);
        }
    }
    holder: BottomSheetHolder;
    panGestureHandler: PanGestureHandler;
    get listView() {
        return this.$refs['listView'] && (this.$refs['listView'].nativeView as CollectionView);
    }
    get graphView() {
        return this.$refs['graphView'] && (this.$refs['graphView'].nativeView as LineChart);
    }
    mounted() {
        super.mounted();

        let parent: Vue = this;
        while (parent !== null && !(parent instanceof BottomSheetHolder)) {
            parent = parent.$parent as any;
        }
        const listView = this.listView;
        // this.log('mounted', !!parent, !!listView);
        if (parent instanceof BottomSheetHolder) {
            this.holder = parent;
            parent.setBottomSheet(this);
        }

        // this is very important and necessary on ios
        // without this the listview gesture and the pan gesture cant work together
        if (gVars.isIOS && listView && !!this.holder) {
            const manager = Manager.getInstance();
            const gestureHandler = manager.createGestureHandler(HandlerType.NATIVE_VIEW, NATIVE_GESTURE_TAG, {
                disallowInterruption: true,
                simultaneousHandlers: [PAN_GESTURE_TAG]
            });
            gestureHandler.attachToView(this.listView);
        }
    }

    reset() {
        this.listViewAtTop = true;
        this.scrollEnabled = true;
    }

    onListViewTouch(event: TouchGestureEventData) {
        switch(event.action) {
            case 'down':
                this.touchingListView = true;
                break;
            case 'up':
            case 'cancel':
                this.touchingListView = false;
                break;
        }
    }
    onListViewScroll(args) {
        // this.log('onListViewScroll', this.isScrollEnabled , this.listViewAtTop, args.scrollOffset);
        if (!this.isScrollEnabled) {
            return;
        }
        if (!this.listViewAtTop && args.scrollOffset <= 0) {
            this.listViewAtTop = true;
        } else if (this.listViewAtTop && args.scrollOffset > 0) {
            // this.log('listViewAtTop', this.listViewAtTop);
            this.listViewAtTop = false;
        }
    }
}
