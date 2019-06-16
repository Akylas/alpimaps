import { View } from 'tns-core-modules/ui/core/view';
import { layout } from 'tns-core-modules/utils/utils';
import { Component } from 'vue-property-decorator';
import * as Animation from '~/animation';
import BaseVueComponent from './BaseVueComponent';
import DirectionsPanel from './DirectionsPanel';

const OPEN_DURATION = 200;
const CLOSE_DURATION = 200;

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
    nCurrentViewTop = 0;
    set currentViewTop(value) {
        this.nCurrentViewTop = value;
        const slotTopOnScreen = this.translationMaxOffset + value;
        if (slotTopOnScreen <= 60) {
            this.currentSlotTop = 60;
        } else {
            this.currentSlotTop = slotTopOnScreen;
        }
        // console.log('set currentViewTop', value, this.translationMaxOffset, slotTopOnScreen);
    }
    get currentViewTop() {
        return this.nCurrentViewTop;
    }
    onLayoutChange() {
        this.viewHeight = Math.round(layout.toDeviceIndependentPixels(this.nativeView.getMeasuredHeight()));
        // console.log('onLayoutChange1', this.viewHeight, this.$refs['slotView']);
        if (!this.$refs['slotView']) {
            return;
        }
        const view = this.$refs['topSheet'].nativeView;
        this.translationMaxOffset = Math.round(layout.toDeviceIndependentPixels(view.getMeasuredHeight()));
        this.currentViewTop = -this.translationMaxOffset;
        // console.log('onLayoutChange', view, this.translationMaxOffset);
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
            console.log('onPan', 'done', this.translationMaxOffset, viewTop, distanceFromFullyOpen);
            if (distanceFromFullyOpen <= Math.abs(this.translationMaxOffset / 2)) {
                // console.log('onPan', 'done', 'shouldClose');
                this.$emit('shouldClose');
                // this.closeSheet();
            } else {
                const steps = topSheet.steps;
                console.log('on pan up', distanceFromFullyOpen, Math.abs(viewTop), steps, getClosestValue(steps, distanceFromFullyOpen));
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
            // console.log('scrollSheetToPosition', viewTop, position);
            return new Promise(resolve => {
                new Animation.Animation({ value: viewTop })
                    .to({ value: -position }, OPEN_DURATION)
                    .easing(Animation.Easing.Quadratic.Out)
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
        // console.log('peekSheet', this.opened);
        if (!!this.opened) {
            return Promise.resolve();
        }
        this.opened = true;
        return this.scrollSheetToPosition(this.translationMaxOffset - topSheet.peekHeight);
    }
    closeSheet() {
        // console.log('closeSheet', this.opened);
        if (!this.opened) {
            return Promise.resolve();
        }
        this.opened = false;
        return this.scrollSheetToPosition(this.translationMaxOffset, CLOSE_DURATION);
    }
}
