import {
    GestureHandlerStateEvent,
    GestureHandlerTouchEvent,
    GestureState,
    GestureStateEventData,
    GestureTouchEventData,
    HandlerType,
    Manager,
    PanGestureHandler
} from 'nativescript-gesturehandler';
import { View } from '@nativescript/core/ui/core/view';
import { layout } from '@nativescript/core/utils/utils';
import { Component, Prop, Watch } from 'vue-property-decorator';
import { TWEEN } from 'nativescript-tween';
import BaseVueComponent from '../BaseVueComponent';
import BottomSheet, { NATIVE_GESTURE_TAG } from './BottomSheetBase';

const OPEN_DURATION = 100;
const CLOSE_DURATION = 200;

export let PAN_GESTURE_TAG = 1;

export interface BottomSheetHolderScrollEventData {
    top: number;
    percentage: number;
    height: number;
}

@Component({})
export default class BottomSheetHolder extends BaseVueComponent {
    bottomSheet: BottomSheet;
    setBottomSheet(comp: BottomSheet) {
        this.bottomSheet = comp;
        if (comp) {
            // comp.$on('listViewAtTop', value => {
            //     // this.log('listViewAtTop changed', value);
            //     this.panEnabled = value;
            //     // if (value && this._isPanning) {
            //     // if (this.bottomSheet) {
            //     //     this.bottomSheet.scrollEnabled = !value;
            //     // }
            //     // }
            // });
        }
    }
    opened = false;
    // _isPanning = false;
    // set isPanning(value) {
    //     console.log('set isPanning', value);
    //     if (value !== this._isPanning) {
    //         this._isPanning = value;
    //         // console.log('set isPanning1', value, this.panEnabled, this._isPanning);
    //         // if (value && this.panEnabled) {
    //         this.bottomSheet && (this.bottomSheet.scrollEnabled = !(value && this.panEnabled));
    //         // }
    //     }
    // }
    // get isPanning() {
    //     // console.log('get isPanning1', this._isPanning);
    //     return this._isPanning;
    // }
    isAnimating = false;
    prevDeltaY = 0;
    viewHeight = 0;
    mCurrentViewHeight = 0;
    isAtTop = false;
    set currentViewHeight(value) {
        value = Math.round(value);
        // if (this.bottomSheet) {
        //     // console.log('currentViewHeight', this.translationMaxOffset, this.mCurrentViewHeight, value);
        //     this.bottomSheet.scrollEnabled = this.mCurrentViewHeight === value;
        // }
        this.mCurrentViewHeight = value;
        value += this.bottomDecale;
        const delta = Math.max(this.viewHeight - value, 0);

        //
        this.isAtTop = this.peekerSteps.some(s => this.currentViewHeight + s === this.viewHeight + this.bottomDecale);
        const eventData = {
            top: value,
            percentage: delta / this.viewHeight,
            height: delta
        } as BottomSheetHolderScrollEventData;
        this.bottomSheet.handleScroll(eventData);
        this.$emit('scroll', eventData);
    }
    get currentViewHeight() {
        const result = this.mCurrentViewHeight;

        return result;
    }
    currentSheetTop = 0;

    @Prop({
        default: () => [50]
    })
    peekerSteps;
    @Prop({
        default: 0
    })
    bottomDecale;
    // @Prop()
    // shouldPan: Function;
    @Prop({
        // default: [50]
    })
    scrollViewTag;

    // @Prop({
    //     default: true
    // })
    isPanEnabled: boolean = true;
    // @Watch('panEnabled')
    // set panEnabled(value) {
    //     if (value !== this.isPanEnabled) {
    //         this.isPanEnabled = value;
    //         // console.log('onPanEnabledChanged', value);
    //         // this.panGestureHandler.enabled = value;
    //     }
    // }
    // get panEnabled() {
    //     return this.isPanEnabled;
    // }

    constructor() {
        super();
    }
    panGestureHandler: PanGestureHandler;
    panGestureTag = PAN_GESTURE_TAG++;
    mounted() {
        super.mounted();
        const manager = Manager.getInstance();
        const gestureHandler = manager.createGestureHandler(HandlerType.PAN, this.panGestureTag, {
            shouldCancelWhenOutside: false,
            activeOffsetY: 5,
            failOffsetY: -5,
            simultaneousHandlers: gVars.isIOS ? [NATIVE_GESTURE_TAG] : undefined
        });
        gestureHandler.on(GestureHandlerTouchEvent, this.onGestureTouch, this);
        gestureHandler.on(GestureHandlerStateEvent, this.onGestureState, this);
        this.log('mounted', this.nativeView, this.scrollingView && this.scrollingView.nativeView);
        gestureHandler.attachToView(this.scrollingView);
        this.panGestureHandler = gestureHandler as any;
    }
    destroyed() {
        if (this.panGestureHandler) {
            this.panGestureHandler.off(GestureHandlerTouchEvent, this.onGestureTouch, this);
            this.panGestureHandler.off(GestureHandlerStateEvent, this.onGestureState, this);
            this.panGestureHandler.detachFromView(this.scrollingView);
            this.panGestureHandler = null;
        }
    }
    get scrollingView() {
        return this.$refs['scrollingView'].nativeView as View;
        // return this.bottomSheet.nativeView;
    }
    get translationMaxOffset() {
        let result = this.peekerSteps.slice(-1)[0];
        result += this.bottomDecale;
        return result;
    }
    onLayoutChange() {
        // we need to know the full height on layout
        const viewHeight = Math.round(layout.toDeviceIndependentPixels(this.nativeView.getMeasuredHeight()));
        if (this.mCurrentViewHeight === 0) {
            this.viewHeight = viewHeight;
            this.currentViewHeight = this.viewHeight;
        } else {
            const shown = this.viewHeight - this.mCurrentViewHeight;
            this.viewHeight = viewHeight;
            this.currentViewHeight = this.viewHeight - shown;
        }
    }
    didPanDuringGesture = false;
    onGestureState(args: GestureStateEventData) {
        const { state, prevState, extraData, view } = args.data;
        if (state === GestureState.ACTIVE) {
                this.prevDeltaY = 0;
        }
        else if (prevState === GestureState.ACTIVE && this.didPanDuringGesture) {
            const comp = this.bottomSheet;
            // we dont animate the drag velocity is the listview is enabled.
            if (!comp.listViewVisible|| !comp.isScrollEnabled) {
                const { velocityY, translationY } = extraData;
                const viewTop = this.mCurrentViewHeight - this.viewHeight;

                const dragToss = 0.05;
                const endOffsetY = viewTop + translationY - this.prevDeltaY + dragToss * velocityY;

                const steps = [0].concat(this.peekerSteps);
                let destSnapPoint = steps[0];
                for (let i = 0; i < steps.length; i++) {
                    const snapPoint = steps[i];
                    const distFromSnap = Math.abs(snapPoint + endOffsetY);
                    if (distFromSnap <= Math.abs(destSnapPoint + endOffsetY)) {
                        destSnapPoint = snapPoint;
                    }
                }
                this.scrollSheetToPosition(destSnapPoint);
            }
        }
        this.didPanDuringGesture = false;
    }
    lastDraggingY = 0;
    onGestureTouch(args: GestureTouchEventData) {
        const data = args.data;
        // this.log('onGestureTouch', data.state);

        if (data.state !== GestureState.ACTIVE) {
            return;
        }
        const deltaY = data.extraData.translationY;
        const comp = this.bottomSheet;
        const y = (this.lastDraggingY = deltaY - this.prevDeltaY);
        // this.log(
        //     'onGestureTouch',
        //     this.isAnimating,
        //     comp.listViewAvailable,
        //     comp.listViewAtTop,
        //     this.prevDeltaY,
        //     this.viewHeight,
        //     this.currentViewHeight,
        //     this.translationMaxOffset,
        //     deltaY
        // );

        if (comp.listView) {
            comp.scrollEnabled = comp.listViewVisible && (!comp.listViewAtTop || (this.isAtTop && y < 0));
        }
        // console.log('dragging', y,comp.listViewVisible, comp.scrollEnabled);
        if (comp.listViewVisible && comp.scrollEnabled) {
            // if (this.isAnimating || !this._isPanning || !this.panEnabled) {
            this.prevDeltaY = deltaY;
            return;
        }
        if (this.isAnimating) {
            this.prevDeltaY = deltaY;
            return;
        }
        this.didPanDuringGesture = true;
        const viewTop = this.mCurrentViewHeight - this.viewHeight;

        this.constrainY(viewTop + y);
        // this.updateIsPanning(data.state);
        this.prevDeltaY = deltaY;
    }

    constrainY(y) {
        // console.log('constrainY', y, this.translationMaxOffset);
        let trY = y;
        if (y > 0) {
            trY = 0;
        } else if (y < -this.translationMaxOffset) {
            trY = -this.translationMaxOffset;
        }
        this.currentViewHeight = this.viewHeight + trY;
    }
    currentStep = 0;
    scrollSheetToPosition(position, duration = OPEN_DURATION) {
        const viewTop = this.mCurrentViewHeight - this.viewHeight;

        if (position > 0) {
            position += this.bottomDecale;
        }

        this.currentStep = this.peekerSteps.indexOf(position);
        // this.log('scrollSheetToPosition', position, this.currentViewHeight, this.viewHeight);
        return new Promise(resolve => {
            // this.log('scrollSheetToPosition2', position, viewTop);
            new TWEEN.Tween({ value: viewTop })
                .to({ value: -position }, duration)
                .easing(TWEEN.Easing.Quadratic.Out)
                .onUpdate(obj => {
                    this.currentViewHeight = this.viewHeight + obj.value;
                })
                .onComplete(resolve)
                .onStop(resolve)
                .start();
            if (position !== 0) {
                this.opened = true;
                this.$emit('open');
            }
        }).then(() => {
            if (position === 0) {
                this.opened = false;
                this.$emit('close');
            }
        });
    }

    @Watch('peekerSteps')
    onPeekerStepsChanged() {
        if (this.currentStep >=this.peekerSteps.length) {
            this.scrollSheetToPosition(this.peekerSteps[this.peekerSteps.length -1]);
        }
    }

    peek() {
        // if (!!this.opened) {
        //     return Promise.resolve();
        // }
        const steps = this.peekerSteps;
        const currentStep = this.currentStep;
        const dest = currentStep >= 0 && currentStep < steps.length ? steps[this.currentStep] : steps[0];
        this.scrollSheetToPosition(dest);
    }
    close() {
        // this.log('close', this.opened);
        if (!this.opened) {
            return Promise.resolve();
        }
        this.scrollSheetToPosition(0, CLOSE_DURATION);
    }
}
