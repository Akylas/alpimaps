import Vue from 'nativescript-vue';
import BaseVueComponent from './BaseVueComponent';
import { Component } from 'vue-property-decorator';
import { actionBarHeight, screenHeightDips, screenWidthDips } from '../variables';
import { MapPos } from 'nativescript-carto/core/core';

@Component({})
export default class BottomSheet extends BaseVueComponent {
    actionBarHeight = actionBarHeight;
    isBottomSheetOpen = false;
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
        if (this.isBottomSheetOpen) {
            return;
        }
        // console.log('openSheet', metaData,this.actionBarHeight, this.selectedSVGSrc);
        this.isBottomSheetOpen = true;
        const bottomSheet = this.getRef('bottomSheet');
        if (bottomSheet) {
            bottomSheet.translateY = actionBarHeight;
            bottomSheet.animate({
                translate: { x: 0, y: 0 },
                duration: 200
            });
        }
    }
    closeSheet() {
        if (!this.isBottomSheetOpen) {
            return;
        }
        const bottomSheet = this.getRef('bottomSheet');
        if (bottomSheet) {
            bottomSheet
                .animate({
                    translate: { x: 0, y: actionBarHeight },
                    duration: 200
                })
                .then(_ => {
                    this.isBottomSheetOpen = false;
                });
        } else {
            this.isBottomSheetOpen = false;
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
}
