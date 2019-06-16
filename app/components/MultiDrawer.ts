import { layout } from 'tns-core-modules/utils/utils';
import mergeOptions from 'merge-options';
import { Component, Model, Prop, Watch } from 'vue-property-decorator';
import Vue, { NativeScriptVue } from 'nativescript-vue';
import { View } from 'tns-core-modules/ui/core/view';
import { GridLayout } from 'tns-core-modules/ui/layouts/grid-layout/grid-layout';
import { Label } from 'tns-core-modules/ui/label/label';
import { DEV_LOG } from '~/utils/logging';

const DEFAULT_ANIM_DURATION = 200;
const DEFAULT_TRIGGER_WIDTH = 30;
const DEFAULT_MENU_WIDTH = '80%';
const DEFAULT_MENU_HEIGHT = '40%';
const DEFAULT_MENU_BACK_COLOR = '#ffffff';

export const defaultOptions = {
    debug: DEV_LOG,
    backdropColor: 'rgba(0, 0, 0, 0.7)',
    left: {
        width: DEFAULT_MENU_WIDTH,
        height: null,
        enabled: true,
        fixed: false,
        backgroundColor: DEFAULT_MENU_BACK_COLOR,
        canSwipeOpen: true,
        swipeOpenTriggerWidth: DEFAULT_TRIGGER_WIDTH,
        swipeOpenTriggerHeight: null,
        swipeOpenTriggerMinDrag: DEFAULT_TRIGGER_WIDTH,
        swipeCloseTriggerMinDrag: DEFAULT_TRIGGER_WIDTH,
        swipeOpenTriggerProperties: {},
        animation: {
            openDuration: DEFAULT_ANIM_DURATION,
            closeDuration: DEFAULT_ANIM_DURATION
        },
        translationOffsetMultiplier: -1,
        axis: 'X'
    },
    right: {
        width: DEFAULT_MENU_WIDTH,
        height: null,
        enabled: true,
        fixed: false,
        backgroundColor: DEFAULT_MENU_BACK_COLOR,
        canSwipeOpen: true,
        swipeOpenTriggerWidth: DEFAULT_TRIGGER_WIDTH,
        swipeOpenTriggerHeight: null,
        swipeOpenTriggerMinDrag: DEFAULT_TRIGGER_WIDTH,
        swipeCloseTriggerMinDrag: DEFAULT_TRIGGER_WIDTH,
        swipeOpenTriggerProperties: {},
        animation: {
            openDuration: DEFAULT_ANIM_DURATION,
            closeDuration: DEFAULT_ANIM_DURATION
        },
        translationOffsetMultiplier: 1,
        axis: 'X'
    },
    top: {
        width: null,
        height: DEFAULT_MENU_HEIGHT,
        enabled: true,
        fixed: false,
        backgroundColor: DEFAULT_MENU_BACK_COLOR,
        canSwipeOpen: true,
        swipeOpenTriggerWidth: null,
        swipeOpenTriggerHeight: DEFAULT_TRIGGER_WIDTH,
        swipeOpenTriggerMinDrag: DEFAULT_TRIGGER_WIDTH,
        swipeCloseTriggerMinDrag: DEFAULT_TRIGGER_WIDTH,
        swipeOpenTriggerProperties: {},
        animation: {
            openDuration: DEFAULT_ANIM_DURATION,
            closeDuration: DEFAULT_ANIM_DURATION
        },
        translationOffsetMultiplier: -1,
        axis: 'Y'
    },
    bottom: {
        width: null,
        height: DEFAULT_MENU_HEIGHT,
        enabled: true,
        fixed: false,
        backgroundColor: DEFAULT_MENU_BACK_COLOR,
        canSwipeOpen: true,
        swipeOpenTriggerWidth: null,
        swipeOpenTriggerHeight: DEFAULT_TRIGGER_WIDTH,
        swipeOpenTriggerMinDrag: DEFAULT_TRIGGER_WIDTH,
        swipeCloseTriggerMinDrag: DEFAULT_TRIGGER_WIDTH,
        swipeOpenTriggerProperties: {},
        animation: {
            openDuration: DEFAULT_ANIM_DURATION,
            closeDuration: DEFAULT_ANIM_DURATION
        },
        translationOffsetMultiplier: 1,
        axis: 'Y'
    }
};
type DeepPartial<T> = { [P in keyof T]?: DeepPartial<T[P]> };
export type OptionsType = DeepPartial<typeof defaultOptions>;
export interface MultiDrawerRefs {
    [key: string]: any;
    backDrop: NativeScriptVue<View>;
    leftDrawer?: NativeScriptVue<GridLayout>;
    rightDrawer?: NativeScriptVue<GridLayout>;
    topDrawer?: NativeScriptVue<GridLayout>;
    bottomDrawer?: NativeScriptVue<GridLayout>;
}

@Component({})
export default class MultiDrawer extends Vue {
    $refs: MultiDrawerRefs;
    @Model('state', { type: [String, Boolean], default: false })
    readonly state!: boolean;

    @Prop({ type: Boolean, default: true })
    readonly enabled!: boolean;

    @Prop({ type: Object, required: false })
    readonly options!: OptionsType;

    @Watch('state')
    async stateChanged(side) {
        if (this.computedOpenSide !== side) {
            await this.close();
        }
        if (side) {
            this.open(side);
        }
    }
    @Watch('options', { immediate: true, deep: true })
    onOptionsChanged(options) {
        this.optionsInternal = mergeOptions(defaultOptions, options);
    }

    getDrawer(side: string): NativeScriptVue<GridLayout> {
        return this.$refs[`${side}Drawer`][0];
    }
    get backdropNative() {
        return this.$refs.backDrop.nativeView as Label;
    }

    // beforeUpdate(...args) {
    //     console.log('beforeUpdate', args);
    // }

    // handled by the watcher
    optionsInternal: OptionsType = {};
    sides = {
        left: {
            open: false,
            invisible: true,
            translation: 0,
            translationOffset: 0
        },
        right: {
            open: false,
            invisible: true,
            translation: 0,
            translationOffset: 0
        },
        top: {
            open: false,
            invisible: true,
            translation: 0,
            translationOffset: 0
        },
        bottom: {
            open: false,
            invisible: true,
            translation: 0,
            translationOffset: 0
        }
    };

    backdropVisible = false;
    isAnimating = false;
    isPanning = false;
    layoutColumns = '*';
    layoutRows = '*';
    prevDeltaX = 0;
    prevDeltaY = 0;

    get computedSidesEnabled() {
        const validSides = Object.keys(this.sides);
        return Object.keys(this.$slots).filter(slotName => validSides.indexOf(slotName) !== -1 && this.optionsInternal[slotName].enabled);
    }
    drawerStyle = {};
    updateDrawerStyle(side) {
        // if (this.isAnimating) {
        //     // if we are animating this should not be used! So let s say nothing changed
        //     return this.lastComputedDrawerStyle[side];
        // }
        const sideOptions = this.sides[side];
        const optionsInternal = this.optionsInternal[side];
        const invisible = sideOptions.invisible;
        const open = sideOptions.open;
        const translationOffset = sideOptions.translationOffset;
        const isOpened = open || optionsInternal.fixed || !invisible;
        const isVisible = isOpened || invisible !== true;
        this.log('computedDrawerStyle', invisible, open, translationOffset, isOpened, isVisible);
        this.drawerStyle[side] = {
            ...(isVisible ? {} : { transform: `translate${optionsInternal.axis}(${translationOffset})` }),
            // transform: `translate${this.optionsInternal[side].axis}(${isOpened ? 0 : this.sides[side].translationOffset})`,
            ...(optionsInternal.width ? { width: optionsInternal.width } : {}),
            ...(optionsInternal.height ? { height: optionsInternal.height } : {}),
            backgroundColor: optionsInternal.backgroundColor,
            visibility: isVisible ? 'visible' : 'hidden',
            [optionsInternal.axis === 'X' ? 'horizontalAlignment' : 'verticalAlignment']: side
        };
    }
    get computedDrawerStyle() {
        return side => {
            // if (this.isAnimating) {
            //     // if we are animating this should not be used! So let s say nothing changed
            //     return this.lastComputedDrawerStyle[side];
            // }
            const sideOptions = this.sides[side];
            const optionsInternal = this.optionsInternal[side];
            const invisible = sideOptions.invisible;
            const open = sideOptions.open;
            const translationOffset = sideOptions.translationOffset;
            const isOpened = open || optionsInternal.fixed || !invisible;
            const isVisible = isOpened || invisible !== true;
            this.log('computedDrawerStyle', invisible, open, translationOffset, isOpened, isVisible);
            const result = {
                ...(isVisible ? {} : { transform: `translate${optionsInternal.axis}(${translationOffset})` }),
                // transform: `translate${this.optionsInternal[side].axis}(${isOpened ? 0 : this.sides[side].translationOffset})`,
                ...(optionsInternal.width ? { width: optionsInternal.width } : {}),
                ...(optionsInternal.height ? { height: optionsInternal.height } : {}),
                backgroundColor: optionsInternal.backgroundColor,
                visibility: isVisible ? 'visible' : 'hidden',
                [optionsInternal.axis === 'X' ? 'horizontalAlignment' : 'verticalAlignment']: side
            };
            return result;
        };
    }
    get computedSwipeOpenTriggerProperties() {
        return side => {
            const optionsInternal = this.optionsInternal[side];

            return {
                ...(optionsInternal.swipeOpenTriggerWidth
                    ? {
                        width: optionsInternal.swipeOpenTriggerWidth
                    }
                    : {}),
                ...(optionsInternal.swipeOpenTriggerHeight
                    ? {
                        height: optionsInternal.swipeOpenTriggerHeight
                    }
                    : {}),
                [optionsInternal.axis === 'X' ? 'horizontalAlignment' : 'verticalAlignment']: side,
                ...(this.optionsInternal.debug ? { backgroundColor: 'rgba(0, 255, 0, 0.3)' } : {}),
                ...optionsInternal.swipeOpenTriggerProperties
            };
        };
    }

    get inDebug() {
        return this.optionsInternal.debug;
    }
    get computedShowSwipeOpenTrigger() {
        return side => {
            console.log('computedShowSwipeOpenTrigger', side);
            if (!this.optionsInternal[side].canSwipeOpen) {
                return false;
            }
            return !(this.computedOpenSide || this.isPanning || this.isAnimating);
        };
    }
    get computedOpenSide() {
        return this.computedSidesEnabled.find(side => this.sides[side].open) || false;
    }
    isSideOpened(side = null) {
        if (!side) {
            side = this.computedSidesEnabled[0];
        }

        return this.sides[side].open === true;
    }
    get computedLayout() {
        const options = this.optionsInternal;

        const gridColumns = (options.left.fixed ? 'auto,' : '') + '*' + (options.right.fixed ? ', auto' : '');

        const layout = {
            grid: {
                columns: gridColumns,
                rows: '*'
            },
            main: {
                col: options.left.fixed ? 1 : 0
            },
            left: {
                col: 0
            },
            right: {
                col: (options.left.fixed ? 1 : 0) + (options.right.fixed ? 1 : 0)
            },
            top: {
                col: options.left.fixed ? 1 : 0
            },
            bottom: {
                col: options.left.fixed ? 1 : 0
            }
        };

        return layout;
    }
    noop() {
        // helper for catching events that we don't want to pass through.
    }
    get backDrop() {
        return this.$refs.backDrop.nativeView;
    }

    log(...params) {
        if (this.inDebug) {
            console.log(...params);
        }
    }
    async open(side = null, animationFactor = 1) {
        if (!side) {
            if (!this.computedSidesEnabled.length) {
                throw new Error('No sides are enabled, at least one side must be enabled to open the drawer');
            }
            side = this.computedSidesEnabled[0];
        }
        this.log('open', side, this.isPanning, this.isAnimating);

        if (this.computedSidesEnabled.indexOf(side) === -1) {
            return;
        }

        if (this.isPanning || this.isAnimating) {
            return;
        }

        this.isPanning = false;
        this.backdropVisible = true;
        this.sides[side].invisible = false;
        try {
            if (animationFactor !== 0) {
                this.log('open starting animation', side, this.isPanning, this.isAnimating);
                this.isAnimating = true;
                const duration = this.optionsInternal[side].animation.openDuration * animationFactor;

                this.backdropNative.animate({
                    opacity: 1,
                    duration
                });
                await this.getDrawer(side).nativeView.animate({
                    translate: {
                        x: 0,
                        y: 0
                    },
                    duration
                });
            }
        } catch (err) {
            console.error(err);
        } finally {
            this.sides[side].open = true;
            this.isAnimating = false;
            this.$emit('stateChange', side);
        }
    }
    async close(side = null, animationFactor = 1) {
        if (this.isAnimating) {
            return;
        }
        if (!side) {
            side = this.computedOpenSide;
        }
        if (!side) {
            return;
        }
        this.log('closing', side);

        this.isPanning = false;
        const sideData = this.sides[side];
        try {
            if (animationFactor !== 0) {
                this.isAnimating = true;
                const optionsInternal = this.optionsInternal[side];
                const duration = optionsInternal.animation.closeDuration * animationFactor;

                this.log('starting closing animation', side);
                await this.getDrawer(side).nativeView.animate({
                    translate: {
                        x: optionsInternal.axis === 'X' ? sideData.translationOffset : 0,
                        y: optionsInternal.axis === 'Y' ? sideData.translationOffset : 0
                    },
                    duration
                });
                this.log(' closing animation done', side);
                this.backdropNative.animate({
                    opacity: 0,
                    duration
                });
            }
        } catch (err) {
            console.error(err);
        } finally {
            sideData.open = false;
            sideData.invisible = true;
            this.backdropVisible = false;
            this.isAnimating = false;
            this.log('drawer hidden', side);
            this.$emit('stateChange', false);
        }

        // console.log('closed', side);
    }
    onDrawerLayoutChange(side) {
        const view = this.getDrawer(side).nativeView;
        const sideData = this.sides[side];
        const optionsInternal = this.optionsInternal[side];
        const newOffset = optionsInternal.translationOffsetMultiplier * layout.toDeviceIndependentPixels(optionsInternal.axis === 'X' ? view.getMeasuredWidth() : view.getMeasuredHeight());
        this.log('onDrawerLayoutChange', side, newOffset, sideData.translationOffset);

        // check for change to prevent unwanted call to computedDrawerStyle
        if (newOffset !== sideData.translationOffset) {
            sideData.translationOffset = newOffset;
        }
    }
    onBackDropPan(args) {
        // this.log('onBackDropPan', this.computedOpenSide, this.isPanning, this.isAnimating);
        this.onDrawerPan(this.computedOpenSide, args);
    }
    onOpenTriggerPan(side, args) {
        // this.log('onOpenTriggerPan', side, this.isPanning, this.isAnimating);
        this.onDrawerPan(side, args);
    }
    onDrawerPan(side, args) {
        // this.log('onDrawerPan', side, this.isPanning, this.isAnimating, args.state);
        if (side === false) {
            return;
        }
        const optionsInternal = this.optionsInternal[side];
        if (optionsInternal.fixed) {
            return;
        }
        if (!side) {
            return;
        }
        if ((this.isPanning && this.isPanning !== side) || this.isAnimating) {
            return;
        }
        const view = this.getDrawer(side).nativeView;
        let panProgress = 0;

        const sideData = this.sides[side];
        if (args.state === 1) {
            // down
            this.isPanning = side;

            if (!sideData.open) {
                this.$refs.backDrop.nativeView.opacity = 0;
                this.backdropVisible = true;
                sideData.invisible = false;
            }

            this.prevDeltaX = 0;
            this.prevDeltaY = 0;
        } else if (args.state === 2) {
            // panning

            if (optionsInternal.axis === 'X') {
                this.constrainX(view, side, view.translateX + (args.deltaX - this.prevDeltaX));
                panProgress = Math.abs(view.translateX) / Math.abs(sideData.translationOffset);
            } else {
                this.constrainY(view, side, view.translateY + (args.deltaY - this.prevDeltaY));
                panProgress = Math.abs(view.translateY) / Math.abs(sideData.translationOffset);
            }

            this.prevDeltaX = args.deltaX;
            this.prevDeltaY = args.deltaY;

            this.$refs.backDrop.nativeView.opacity = 1 - panProgress;
        } else if (args.state === 3) {
            // up
            this.isPanning = false;

            if (this.computedOpenSide === side) {
                // already open
                let distanceFromFullyOpen = 0;
                if (optionsInternal.axis === 'X') {
                    distanceFromFullyOpen = Math.abs(view.translateX);
                } else {
                    distanceFromFullyOpen = Math.abs(view.translateY);
                }
                if (distanceFromFullyOpen > optionsInternal.swipeCloseTriggerMinDrag) {
                    this.close(side, 1 - distanceFromFullyOpen / Math.abs(sideData.translationOffset));
                } else {
                    this.open(side, distanceFromFullyOpen / Math.abs(sideData.translationOffset));
                }
            } else {
                const offsetAbs = Math.abs(sideData.translationOffset);
                const multiplier = optionsInternal.translationOffsetMultiplier;
                let distanceFromEdge = 0;
                if (optionsInternal.axis === 'X') {
                    distanceFromEdge = offsetAbs - multiplier * view.translateX;
                } else {
                    distanceFromEdge = offsetAbs - multiplier * view.translateY;
                }

                if (distanceFromEdge < optionsInternal.swipeOpenTriggerMinDrag) {
                    this.close(side, distanceFromEdge / Math.abs(sideData.translationOffset));
                } else {
                    this.open(side, 1 - distanceFromEdge / Math.abs(sideData.translationOffset));
                }
            }

            this.prevDeltaX = 0;
            this.prevDeltaY = 0;
        }
    }
    constrainX(view, side, x) {
        const sideData = this.sides[side];
        const offset = sideData.translationOffset;
        let trX = x;
        if (offset < 0) {
            if (x > 0) {
                trX = 0;
            } else if (sideData.open && x < offset) {
                trX = offset;
            }
        } else {
            if (x < 0) {
                trX = 0;
            } else if (sideData.open && x > offset) {
                trX = offset;
            }
        }
        // console.log('constrainX', trX);
        view.translateX = trX;
    }
    constrainY(view, side, y) {
        const sideData = this.sides[side];
        const offset = sideData.translationOffset;
        let trY = y;
        if (offset < 0) {
            if (y > 0) {
                trY = 0;
            } else if (sideData.open && y < offset) {
                trY = offset;
            }
        } else {
            if (y < 0) {
                trY = 0;
            } else if (sideData.open && y > offset) {
                trY = offset;
            }
        }
        // console.log('constrainY', trY);
        view.translateY = trY;
    }
}
