import { View } from '@nativescript/core/ui/core/view';
import { layout } from '@nativescript/core/utils/utils';
import { Component } from 'vue-property-decorator';
import { TWEEN } from 'nativescript-tween';
import BaseVueComponent from './BaseVueComponent';
import DirectionsPanel from './DirectionsPanel';

const OPEN_DURATION = 200;
const CLOSE_DURATION = 200;
export const DEFAULT_TOP = 80;
export interface TopSheetHolderScrollEventData {
    bottom: number;
    percentage: number;
    height: number;
}

function getClosestValue(array, goal) {
    return array.reduce(function(prev, curr) {
        return Math.abs(curr - goal) < Math.abs(prev - goal) ? curr : prev;
    });
}

@Component({
    components: {
        DirectionsPanel
    }
})
export default class TopSheetHolder extends BaseVueComponent {
    opened = false;
    constructor() {
        super();
    }
    mounted() {
        super.mounted();
    }
    get computedStyle() {
        return {
            ...{ transform: `translateY(${this.translationMaxOffset})` }
        };
    }
    get topSheet() {
        return this.$refs['topSheet'] as DirectionsPanel;
    }
    get scrollView() {
        return this.$refs['topSheet'].nativeView as View;
    }
    isPanning = false;
    isAnimating = false;
    prevDeltaY = 0;
    translationMaxOffset = 0;
    viewHeight = 0;

    currentSlotTop = 0;
    nCurrentViewTop = null;
    set currentViewTop(value) {
        this.nCurrentViewTop = value;
        const slotTopOnScreen = this.translationMaxOffset + value;
        // console.log('set currentViewTop', value, this.translationMaxOffset, slotTopOnScreen, DEFAULT_TOP);
        if (slotTopOnScreen <= DEFAULT_TOP) {
            this.currentSlotTop = DEFAULT_TOP;
        } else {
            this.currentSlotTop = slotTopOnScreen;
        }
        this.$emit('scroll', {
            bottom: this.currentSlotTop,
            percentage: slotTopOnScreen / this.translationMaxOffset,
            height: slotTopOnScreen
        } as TopSheetHolderScrollEventData);
    }
    get currentViewTop() {
        return this.nCurrentViewTop;
    }
    onLayoutChange() {
        this.viewHeight = Math.round(layout.toDeviceIndependentPixels(this.nativeView.getMeasuredHeight()));
        // if (!this.$refs['slotView']) {
        //     return;
        //
        const view = this.$refs['topSheet'].nativeView;
        this.translationMaxOffset = Math.round(layout.toDeviceIndependentPixels(view.getMeasuredHeight()));
        console.log('onLayoutChange', view, this.viewHeight, this.translationMaxOffset);
        if (this.currentViewTop === null) {
            this.currentViewTop = -this.translationMaxOffset;
        }
    }

    onPan(args) {
        // console.log('onPan', this.isPanning, this.isAnimating, args.state, args.deltaY);

        if (this.isAnimating) {
            return;
        }
        let panProgress = 0;

        const view = this.scrollView;
        const viewTop = this.currentViewTop;
        if (args.state === 1) {
            // down
            this.isPanning = true;

            this.prevDeltaY = 0;
        } else if (args.state === 2) {
            // panning
            const view = this.scrollView;
            // console.log('onPan', 'moving', viewTop, args.deltaY, this.prevDeltaY);
            this.constrainY(view, viewTop + (args.deltaY - this.prevDeltaY));
            panProgress = Math.abs(viewTop);

            this.prevDeltaY = args.deltaY;
        } else if (args.state === 3) {
            // up
            this.isPanning = false;

            const topSheet = this.topSheet;
            let distanceFromFullyOpen = 0;
            distanceFromFullyOpen = this.translationMaxOffset - Math.abs(viewTop);
            // console.log('onPan', 'done', this.translationMaxOffset, viewTop, distanceFromFullyOpen);
            if (distanceFromFullyOpen <= Math.abs(this.translationMaxOffset / 2)) {
                // console.log('onPan', 'done', 'shouldClose');
                this.$emit('shouldClose');
                // this.closeSheet();
            } else {
                const steps = topSheet.steps;
                // console.log('on pan up', distanceFromFullyOpen, Math.abs(viewTop), steps, getClosestValue(steps, distanceFromFullyOpen));
                this.scrollSheetToPosition(this.translationMaxOffset - getClosestValue(steps, Math.abs(distanceFromFullyOpen)));
            }
            this.prevDeltaY = 0;
        }
    }

    constrainY(view: View, y) {
        let trY = y;
        if (y > 0) {
            trY = 0;
        } else if (y < -this.translationMaxOffset) {
            trY = -this.translationMaxOffset;
        }
        this.currentViewTop = trY;
    }

    scrollSheetToPosition(position, duration = OPEN_DURATION) {
        const view = this.scrollView;
        if (view) {
            const viewTop = this.currentViewTop;
            // this.log('scrollSheetToPosition', viewTop, position);
            return new Promise(resolve => {
                // this.log('scrollSheetToPosition2', viewTop, position);
                new TWEEN.Tween({ value: viewTop })
                    .to({ value: -position }, duration)
                    .easing(TWEEN.Easing.Quadratic.Out)
                    .onUpdate(obj => {
                        this.currentViewTop = obj.value;
                    })
                    .onComplete(resolve)
                    .onStop(resolve)
                    .start();
            });
        }
        return Promise.resolve();
    }

    peekSheet() {
        const topSheet = this.topSheet;
        // this.log('peekSheet', this.opened);
        if (!!this.opened) {
            return Promise.resolve();
        }
        this.opened = true;
        return this.scrollSheetToPosition(this.translationMaxOffset - topSheet.peekHeight);
    }
    closeSheet() {
        // this.log('closeSheet', this.opened);
        if (!this.opened) {
            return Promise.resolve();
        }
        this.opened = false;
        return this.scrollSheetToPosition(this.translationMaxOffset, CLOSE_DURATION);
    }
}
