import * as utils from 'tns-core-modules/utils/utils';
import mergeOptions from 'merge-options';
import { Component, Model, Prop, Watch } from 'vue-property-decorator';
import Vue, { NativeScriptVue } from 'nativescript-vue';
import { View } from 'tns-core-modules/ui/core/view';
import { Style } from 'tns-core-modules/ui/styling/style';

const DEFAULT_ANIM_DURATION = 300;
const DEFAULT_TRIGGER_WIDTH = 30;
const DEFAULT_MENU_WIDTH = '70%';
const DEFAULT_MENU_HEIGHT = '40%';
const DEFAULT_MENU_BACK_COLOR = '#ffffff';

export const defaultOptions = {
    debug: false,
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
    get computedDrawerStyle() {
        return side => {
            const isOpened = this.sides[side].open || this.optionsInternal[side].fixed || !this.sides[side].invisible;
            const isVisible = isOpened || this.sides[side].invisible !== true;
            // console.log('computedDrawerStyle', side, this.sides[side].open, this.sides[side].translationOffset, this.sides[side].invisible, isVisible);
            return {
                ...(isVisible ? {} : { transform: `translate${this.optionsInternal[side].axis}(${this.sides[side].translationOffset})` }),
                // transform: `translate${this.optionsInternal[side].axis}(${isOpened ? 0 : this.sides[side].translationOffset})`,
                ...(this.optionsInternal[side].width ? { width: this.optionsInternal[side].width } : {}),
                ...(this.optionsInternal[side].height ? { height: this.optionsInternal[side].height } : {}),
                backgroundColor: this.optionsInternal[side].backgroundColor,
                visibility: isVisible ? 'visible' : 'hidden',
                [this.optionsInternal[side].axis === 'X' ? 'horizontalAlignment' : 'verticalAlignment']: side
            };
        };
    }
    get computedSwipeOpenTriggerProperties() {
        return side => ({
            ...(this.optionsInternal[side].swipeOpenTriggerWidth
                ? {
                    width: this.optionsInternal[side].swipeOpenTriggerWidth
                }
                : {}),
            ...(this.optionsInternal[side].swipeOpenTriggerHeight
                ? {
                    height: this.optionsInternal[side].swipeOpenTriggerHeight
                }
                : {}),
            [this.optionsInternal[side].axis === 'X' ? 'horizontalAlignment' : 'verticalAlignment']: side,
            ...(this.optionsInternal.debug ? { backgroundColor: 'rgba(0, 255, 0, 0.3)' } : {}),
            ...this.optionsInternal[side].swipeOpenTriggerProperties
        });
    }
    get computedShowSwipeOpenTrigger() {
        return side => {
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
    async open(side = null, animationFactor = 1) {
        if (!side) {
            if (!this.computedSidesEnabled.length) {
                throw new Error('No sides are enabled, at least one side must be enabled to open the drawer');
            }
            side = this.computedSidesEnabled[0];
        }
        // console.log('open', side, this.isPanning, this.isAnimating);

        if (this.computedSidesEnabled.indexOf(side) === -1) {
            return;
        }

        if (this.isPanning || this.isAnimating) {
            return;
        }

        this.isPanning = false;
        this.backdropVisible = true;
        this.sides[side].invisible = false;
        if (animationFactor !== 0) {
            this.isAnimating = true;
            const duration = this.optionsInternal[side].animation.openDuration * animationFactor;

            this.$refs.backDrop.nativeView.animate({
                opacity: 1,
                duration
            });
            await this.$refs[`${side}Drawer`][0].nativeView.animate({
                translate: {
                    x: 0,
                    y: 0
                },
                duration
            });
            this.isAnimating = false;
        }

        this.sides[side].open = true;
        // console.log('did open', side);
        this.$emit('stateChange', side);
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
        // console.log('closing', side);

        this.isPanning = false;

        if (animationFactor !== 0) {
            this.isAnimating = true;
            const duration = this.optionsInternal[side].animation.closeDuration * animationFactor;

            this.$refs[`${side}Drawer`][0].nativeView.animate({
                translate: {
                    x: this.optionsInternal[side].axis === 'X' ? this.sides[side].translationOffset : 0,
                    y: this.optionsInternal[side].axis === 'Y' ? this.sides[side].translationOffset : 0
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

        this.sides[side].open = false;
        this.sides[side].invisible = true;
        this.backdropVisible = false;
        this.$emit('stateChange', false);
    }
    onDrawerLayoutChange(side) {
        const view = this.$refs[`${side}Drawer`][0].nativeView;
        this.sides[side].translationOffset =
            this.optionsInternal[side].translationOffsetMultiplier *
            utils.layout.toDeviceIndependentPixels(this.optionsInternal[side].axis === 'X' ? view.getMeasuredWidth() : view.getMeasuredHeight());
    }
    onBackDropPan(args) {
        // console.log('onBackDropPan', this.computedOpenSide, this.isPanning, this.isAnimating);
        this.onDrawerPan(this.computedOpenSide, args);
    }
    onOpenTriggerPan(side, args) {
        // console.log('onOpenTriggerPan', side, this.isPanning, this.isAnimating);
        this.onDrawerPan(side, args);
    }
    onDrawerPan(side, args) {
        // console.log('onDrawerPan', side, this.isPanning, this.isAnimating);
        if (side === false) {
            return;
        }
        if (this.optionsInternal[side].fixed) {
            return;
        }
        if (!side) {
            return;
        }
        if ((this.isPanning && this.isPanning !== side) || this.isAnimating) {
            return;
        }
        const view = this.$refs[`${side}Drawer`][0].nativeView;
        let panProgress = 0;

        if (args.state === 1) {
            // down
            this.isPanning = side;

            if (!this.sides[side].open) {
                this.$refs.backDrop.nativeView.opacity = 0;
                this.backdropVisible = true;
                this.sides[side].invisible = false;
            }

            this.prevDeltaX = 0;
            this.prevDeltaY = 0;
        } else if (args.state === 2) {
            // panning

            if (this.optionsInternal[side].axis === 'X') {
                this.constrainX(view, side, view.translateX + (args.deltaX - this.prevDeltaX));
                panProgress = Math.abs(view.translateX) / Math.abs(this.sides[side].translationOffset);
            } else {
                this.constrainY(view, side, view.translateY + (args.deltaY - this.prevDeltaY));
                panProgress = Math.abs(view.translateY) / Math.abs(this.sides[side].translationOffset);
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
                if (this.optionsInternal[side].axis === 'X') {
                    distanceFromFullyOpen = Math.abs(view.translateX);
                } else {
                    distanceFromFullyOpen = Math.abs(view.translateY);
                }
                if (distanceFromFullyOpen > this.optionsInternal[side].swipeCloseTriggerMinDrag) {
                    this.close(side, 1 - distanceFromFullyOpen / Math.abs(this.sides[side].translationOffset));
                } else {
                    this.open(side, distanceFromFullyOpen / Math.abs(this.sides[side].translationOffset));
                }
            } else {
                const offsetAbs = Math.abs(this.sides[side].translationOffset);
                const multiplier = this.optionsInternal[side].translationOffsetMultiplier;
                let distanceFromEdge = 0;
                if (this.optionsInternal[side].axis === 'X') {
                    distanceFromEdge = offsetAbs - multiplier * view.translateX;
                } else {
                    distanceFromEdge = offsetAbs - multiplier * view.translateY;
                }

                if (distanceFromEdge < this.optionsInternal[side].swipeOpenTriggerMinDrag) {
                    this.close(side, distanceFromEdge / Math.abs(this.sides[side].translationOffset));
                } else {
                    this.open(side, 1 - distanceFromEdge / Math.abs(this.sides[side].translationOffset));
                }
            }

            this.prevDeltaX = 0;
            this.prevDeltaY = 0;
        }
    }
    constrainX(view, side, x) {
        const offset = this.sides[side].translationOffset;
        let trX = x;
        if (offset < 0) {
            if (x > 0) {
                trX = 0;
            } else if (this.sides[side].open && x < offset) {
                trX = offset;
            }
        } else {
            if (x < 0) {
                trX = 0;
            } else if (this.sides[side].open && x > offset) {
                trX = offset;
            }
        }
        // console.log('constrainX', trX);
        view.translateX = trX;
    }
    constrainY(view, side, y) {
        const offset = this.sides[side].translationOffset;
        let trY = y;
        if (offset < 0) {
            if (y > 0) {
                trY = 0;
            } else if (this.sides[side].open && y < offset) {
                trY = offset;
            }
        } else {
            if (y < 0) {
                trY = 0;
            } else if (this.sides[side].open && y > offset) {
                trY = offset;
            }
        }
        // console.log('constrainY', trY);
        view.translateY = trY;
    }
}
