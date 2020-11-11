import BaseVueComponent from '../BaseVueComponent';
import { Component } from 'vue-property-decorator';
import BottomSheetHolder, { BottomSheetHolderScrollEventData, PAN_GESTURE_TAG } from './BottomSheetHolder';
import Vue from 'nativescript-vue';
import { TouchGestureEventData } from '@nativescript/core/ui/gestures';
import { PanGestureHandler } from '@nativescript-community/gesturehandler';
import { CollectionView } from '@nativescript-community/ui-collectionview';
import { LineChart } from '@nativescript-community/ui-chart/charts';
import { HandlerType, Manager } from '@nativescript-community/gesturehandler/gesturehandler';
import { layout } from '@nativescript/core/utils/utils';
import { View } from '@nativescript/core';
// import { RadCartesianChart } from 'nativescript-ui-chart';
export const NATIVE_GESTURE_TAG = 4;

function getViewTop(view: View) {
    if (!view) {
        return 0;
    }
    if (global.isAndroid) {
        return layout.toDeviceIndependentPixels((view.nativeView as android.view.View).getTop());
    } else {
        return layout.toDeviceIndependentPixels((view.nativeView as UIView).frame.origin.y);
    }
}

@Component({})
export default class BottomSheetBase extends BaseVueComponent {
    constructor() {
        super();
    }
    holder: BottomSheetHolder;
    panGestureHandler: PanGestureHandler;

    public isListViewAtTop = true;
    public listViewVisible = false;
    public mListViewAvailable = false;
    public isScrollEnabled = true;

    get steps() {
        return [];
    }
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
    get listView() {
        return this.getRef<CollectionView>('listView');
    }
    get graphView() {
        return this.getRef<LineChart>('graphView');
    }
    listViewLocationY = 0;
    get listViewAvailable() {
        return this.mListViewAvailable;
    }
    set listViewAvailable(value: boolean) {
        this.mListViewAvailable = value;
        if (this.listView) {
            this.listViewLocationY = getViewTop(this.listView);
            // this.log('listViewLocationY', this.listViewLocationY);
        }
    }
    onLayoutChange() {
        if (this.listViewAvailable) {
            this.listViewLocationY = getViewTop(this.listView);
            // this.log('onLayoutChange', this.listViewAvailable, this.listViewLocationY);
        }
    }
    handleScroll(e: BottomSheetHolderScrollEventData) {
        // this.log('handleScroll', this.listViewAvailable);
        if (this.listViewAvailable) {
            // we use this to track if listview is visible or not.
            // this is important to know we can drag or not
            const listViewTop = this.listViewLocationY;
            if (!this.listViewVisible && e.height > listViewTop + 10) {
                this.listViewVisible = true;
            }
            if (this.listView && this.listViewVisible && e.height <= listViewTop) {
                this.listViewAtTop = true;
                this.listViewVisible = false;
                this.listView.scrollToIndex && this.listView.scrollToIndex(0, false);
            }
        }
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
        if (global.isIOS && listView && !!this.holder) {
            const manager = Manager.getInstance();
            const gestureHandler = manager.createGestureHandler(HandlerType.NATIVE_VIEW, NATIVE_GESTURE_TAG, {
                disallowInterruption: true,
                simultaneousHandlers: [PAN_GESTURE_TAG],
            });
            gestureHandler.attachToView(this.listView);
        }
    }

    reset() {
        this.listViewAtTop = true;
        this.listViewVisible = false;
        this.scrollEnabled = true;
    }

    onListViewScroll(args) {
        if (!this.isScrollEnabled) {
            return;
        }
        // we use this to know with the listView is at top
        // important for the dragging behavior
        if (!this.listViewAtTop && args.scrollOffset <= 10) {
            this.listViewAtTop = true;
        } else if (this.listViewAtTop && args.scrollOffset > 10) {
            this.listViewAtTop = false;
        }
    }
}
