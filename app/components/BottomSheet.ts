import BaseVueComponent from './BaseVueComponent';
import { Component } from 'vue-property-decorator';
import { actionBarHeight } from '../variables';
import { MapPos } from 'nativescript-carto/core/core';
import { layout } from 'tns-core-modules/utils/utils';

const OPEN_DURATION = 200;
const CLOSE_DURATION = 200;
@Component({})
export default class BottomSheet extends BaseVueComponent {
    actionBarHeight = actionBarHeight;
    opened = false;
    selectedMetaData;
    selectedTitle: string = '';
    selectedSubtitle: string = '';
    selectedSVGSrc: string = '';
    selectedPosition: MapPos;
    constructor() {
        super();
    }
    mounted() {
        super.mounted();
    }
    openSheet(position, metaData) {
        this.selectedPosition = position;
        this.selectedMetaData = metaData;
        const icon = metaData && (metaData.class || metaData.layer);
        if (icon) {
            this.selectedSVGSrc = `~/assets/icons/${icon}-11.svg`;
        } else {
            this.selectedSVGSrc = undefined;
        }

        this.renderSelectedTitle();
        this.renderSelectedSubtitle();
        if (this.opened) {
            return;
        }
        // console.log('openSheet', metaData,this.actionBarHeight, this.selectedSVGSrc);
        this.opened = true;
        const bottomSheet = this.getRef('bottomSheet');
        if (bottomSheet) {
            bottomSheet.translateY = actionBarHeight;
            bottomSheet.animate({
                translate: { x: 0, y: 0 },
                duration: OPEN_DURATION
            });
        }
    }
    closeSheet() {
        if (!this.opened) {
            return;
        }
        const bottomSheet = this.getRef('bottomSheet');
        if (bottomSheet) {
            bottomSheet
                .animate({
                    translate: { x: 0, y: actionBarHeight },
                    duration: CLOSE_DURATION
                })
                .then(_ => {
                    this.opened = false;
                });
        } else {
            this.opened = false;
        }
    }
    renderSelectedTitle() {
        if (this.selectedMetaData) {
            this.selectedTitle = this.selectedMetaData.name;
        } else if (this.selectedPosition) {
            this.selectedTitle = `${this.selectedPosition.latitude.toFixed(3)}, ${this.selectedPosition.longitude.toFixed(3)}`;
        } else {
            this.selectedTitle = '';
        }
    }
    renderSelectedSubtitle() {
        if (this.selectedMetaData && this.selectedPosition) {
            this.selectedSubtitle = `${this.selectedPosition.latitude.toFixed(3)}, ${this.selectedPosition.longitude.toFixed(3)}`;
        } else {
            this.selectedSubtitle = '';
        }
        // return this.selectedPosition.toString()
    }
    isAnimating = false;
    isPanning = false;
    invisible = false;
    async open(animationFactor = 1) {
        if (this.isPanning || this.isAnimating) {
            return;
        }

        this.isPanning = false;
        this.invisible = false;
        if (animationFactor !== 0) {
            this.isAnimating = true;
            const duration = OPEN_DURATION * animationFactor;

            this.$refs.backDrop.nativeView.animate({
                opacity: 1,
                duration
            });
            const bottomSheet = this.getRef('bottomSheet');
            await bottomSheet.animate({
                translate: {
                    x: 0,
                    y: 0
                },
                duration
            });
            this.isAnimating = false;
        }

        this.opened = true;
        // console.log('did open', side);
        // this.$emit('stateChange', side);
    }
    async close(animationFactor = 1) {
        if (this.isAnimating) {
            return;
        }

        // console.log('closing', side);

        this.isPanning = false;

        if (animationFactor !== 0) {
            this.isAnimating = true;
            const duration = CLOSE_DURATION * animationFactor;

            const bottomSheet = this.getRef('bottomSheet');
            bottomSheet.animate({
                translate: {
                    x: 0,
                    y: this.translationOffset
                },
                duration
            });
            await this.$refs.backDrop.nativeView.animate({
                opacity: 0,
                duration
            });
            this.isAnimating = false;
        }
        // console.log('closed', side);

        this.opened = false;
        this.invisible = true;
        // this.$emit('stateChange', false);
    }
    translationOffset = 0;
    prevDeltaY = 0;
    onDrawerLayoutChange(side) {
        // const view = this.$refs[`${side}Drawer`][0].nativeView;
        const bottomSheet = this.getRef('bottomSheet');
        this.translationOffset = 1 * layout.toDeviceIndependentPixels(bottomSheet.getMeasuredHeight());
    }
    onDrawerPan(args) {
        if (this.isAnimating) {
            return;
        }
        const bottomSheet = this.getRef('bottomSheet');
        let panProgress = 0;

        if (args.state === 1) {
            // down
            this.isPanning = true;

            if (!this.opened) {
                this.$refs.backDrop.nativeView.opacity = 0;
                this.invisible = false;
            }

            this.prevDeltaY = 0;
        } else if (args.state === 2) {
            // panning

            this.constrainY(bottomSheet, bottomSheet.translateY + (args.deltaY - this.prevDeltaY));
            panProgress = Math.abs(bottomSheet.translateY) / Math.abs(this.translationOffset);

            // this.prevDeltaX = args.deltaX;
            this.prevDeltaY = args.deltaY;

            this.$refs.backDrop.nativeView.opacity = 1 - panProgress;
        } else if (args.state === 3) {
            // up
            this.isPanning = false;

            if (this.opened) {
                // already open
                let distanceFromFullyOpen = 0;
                distanceFromFullyOpen = Math.abs(bottomSheet.translateY);
                if (distanceFromFullyOpen > 50) {
                    this.close(1 - distanceFromFullyOpen / Math.abs(this.translationOffset));
                } else {
                    this.open(distanceFromFullyOpen / Math.abs(this.translationOffset));
                }
            } else {
                const offsetAbs = Math.abs(this.translationOffset);
                const multiplier = 1;
                let distanceFromEdge = 0;
                distanceFromEdge = offsetAbs - multiplier * bottomSheet.translateY;

                if (distanceFromEdge < 50) {
                    this.close(distanceFromEdge / Math.abs(this.translationOffset));
                } else {
                    this.open(1 - distanceFromEdge / Math.abs(this.translationOffset));
                }
            }

            this.prevDeltaY = 0;
        }
    }
    constrainY(view, y) {
        const offset = this.translationOffset;
        let trY = y;
        if (offset < 0) {
            if (y > 0) {
                trY = 0;
            } else if (this.opened && y < offset) {
                trY = offset;
            }
        } else {
            if (y < 0) {
                trY = 0;
            } else if (this.opened && y > offset) {
                trY = offset;
            }
        }
        // console.log('constrainY', trY);
        view.translateY = trY;
    }
}
