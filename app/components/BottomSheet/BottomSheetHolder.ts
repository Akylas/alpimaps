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
import { Component, Prop } from 'vue-property-decorator';
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
    isAtStep = false;
    set currentViewHeight(value) {
        value = Math.round(value);
        // if (this.bottomSheet) {
        //     // console.log('currentViewHeight', this.translationMaxOffset, this.mCurrentViewHeight, value);
        //     this.bottomSheet.scrollEnabled = this.mCurrentViewHeight === value;
        // }
        this.mCurrentViewHeight = value;
        value += this.bottomDecale;
        const delta = Math.max(this.viewHeight - value, 0);
        this.isAtStep = this.peekerSteps.some(s => (this.currentViewHeight === this.viewHeight + s + this.bottomDecale));
        this.$emit('scroll', {
            top: value,
            percentage: delta / this.viewHeight,
            height: delta
        } as BottomSheetHolderScrollEventData);
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
    panGestureTag = PAN_GESTURE_TAG++
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
        const viewHeight = Math.round(layout.toDeviceIndependentPixels(this.nativeView.getMeasuredHeight()));
        // this.log('onLayoutChange', viewHeight, this.viewHeight, this.currentViewHeight, this.translationMaxOffset);
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

        // this.log('onGestureState', state, prevState);
        // if (!this.panEnabled) {
        //     return;
        // }
        // this.updateIsPanning(state);
        const comp = this.bottomSheet;
        if (prevState === GestureState.ACTIVE && this.didPanDuringGesture) {
            const { velocityY, translationY } = extraData;
            const viewTop = this.mCurrentViewHeight - this.viewHeight;

            const dragToss = 0.05;
            const endOffsetY = viewTop + translationY - this.prevDeltaY + dragToss * velocityY;

            const steps = [0].concat(this.peekerSteps);
            let destSnapPoint = steps[0];
            // console.log('onPan', 'done', viewTop, translationY, this.prevDeltaY, dragToss, velocityY, endOffsetY, steps);
            for (let i = 0; i < steps.length; i++) {
                const snapPoint = steps[i];
                const distFromSnap = Math.abs(snapPoint + endOffsetY);
                if (distFromSnap <= Math.abs(destSnapPoint + endOffsetY)) {
                    destSnapPoint = snapPoint;
                }
            }
            // if (destSnapPoint === 0) {
            //     this.$emit('');
            // }
            this.scrollSheetToPosition(destSnapPoint);
            this.prevDeltaY = 0;
        }
        this.didPanDuringGesture = false;
    }
    // updateIsPanning(state: GestureState) {
    //     console.log('updateIsPanning', state);
    //     const viewTop = this.mCurrentViewHeight - this.viewHeight;
    //     this.isPanning = state === GestureState.ACTIVE || state === GestureState.BEGAN;
    //     // if (this._isPanning) {

    //     // }

    //     // && viewTop !== -this.translationMaxOffset;
    //     // this.log('updateIsPanning', state, viewTop, this.translationMaxOffset, this._isPanning);
    // }
    onGestureTouch(args: GestureTouchEventData) {
        const data = args.data;
        // this.log('onGestureTouch', data.state);

        if (data.state !== GestureState.ACTIVE) {
            return;
        }
        const deltaY = data.extraData.translationY;
        const comp = this.bottomSheet;
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
        if (comp.touchingListView && !comp.listViewAtTop && !this.isAtStep) {
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

        const y = deltaY - this.prevDeltaY;
        // console.log('onPan', 'moving', viewTop, deltaY, this.prevDeltaY, y, this.translationMaxOffset);
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
    // isAtStep() {
    //     return  this.currentViewHeight = this.viewHeight + obj.value;
    // }
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
                    // this.log('onUpdate', this.viewHeight, obj.value);
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

    peek() {
        // if (!!this.opened) {
        //     return Promise.resolve();
        // }
        // this.log('peek', this.opened);
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
