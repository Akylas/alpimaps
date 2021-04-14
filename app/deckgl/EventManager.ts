import { Observable } from "@nativescript/core";
import {
    GestureHandlerStateEvent,
    GestureHandlerTouchEvent,
    GestureState,
    GestureStateEventData,
    GestureTouchEventData,
    HandlerType,
    Manager,
    PanGestureHandler,
    install as installGestures,
    PinchGestureHandler,
    RotationGestureHandler
} from '@nativescript-community/gesturehandler';

export const PAN_GESTURE_TAG = 3431;
export const PINCH_GESTURE_TAG = 3432;
export const ROTATION_GESTURE_TAG = 3433;

export class EventManager extends Observable {
    constructor(private element = null, options:any = {}) {
        super();
        console.log('EventManager', element, options)
        const {
            events
        } = options;
    }
    public panGestureHandler: PanGestureHandler;
    onPanGestureState(args: GestureStateEventData) {
        const { state, extraData, view } = args.data;
        if (state === GestureState.BEGAN) {
            this.notify({
                eventName:'panstart',
                ...extraData,
                offsetCenter:{
                    x:extraData.x,
                    y:extraData.y,
                }
            })
        } else if (state === GestureState.END || state === GestureState.CANCELLED) {
            this.notify({
                eventName:'panend',
                ...extraData,
                offsetCenter:{
                    x:extraData.x,
                    y:extraData.y,
                }
                
            })
        }
    }
    onPanGestureTouch(args: GestureTouchEventData) {
        const { state, extraData, view } = args.data;
        if (state === GestureState.ACTIVE) {
            this.notify({
                eventName:'panmove',
                ...extraData,
                offsetCenter:{
                    x:extraData.x,
                    y:extraData.y,
                }
            })
        }
       
    }
    public pinchGestureHandler: PinchGestureHandler;
    onPinchGestureState(args: GestureStateEventData) {
        const { state, extraData, view } = args.data;
        if (state === GestureState.BEGAN) {
            this.notify({
                eventName:'pinchstart',
                ...extraData,
                rotation: this.currentRotation,
                offsetCenter:{
                    x:extraData.focalX,
                    y:extraData.focalY,
                }
            })
        } else if (state === GestureState.END || state === GestureState.CANCELLED) {
            this.notify({
                eventName:'pinchend',
                rotation: this.currentRotation,
                ...extraData,
                offsetCenter:{
                    x:extraData.focalX,
                    y:extraData.focalY,
                }
                
            })
            this. currentScale = 0;
        }
    }
    onPinchGestureTouch(args: GestureTouchEventData) {
        const { state, extraData, view } = args.data;
        if (state === GestureState.ACTIVE) {
            this.notify({
                eventName:'pinchmove',
                rotation: this.currentRotation,
                ...extraData,
                offsetCenter:{
                    x:extraData.focalX,
                    y:extraData.focalY,
                }
            })
        }
       
    }
    public rotationGestureHandler: RotationGestureHandler;
    currentRotation = 0;
    currentScale = 0;
    onRotationGestureState(args: GestureStateEventData) {
        const { state, extraData, view } = args.data;
        if (state === GestureState.BEGAN) {
            this.notify({
                eventName:'pinchstart',
                scale: this.currentScale,
                ...extraData,
                offsetCenter:{
                    x:extraData.anchorX,
                    y:extraData.anchorY,
                }
            })
        } else if (state === GestureState.END || state === GestureState.CANCELLED) {
            this.notify({
                eventName:'pinchend',
                ...extraData,
                scale: this.currentScale,
                offsetCenter:{
                    x:extraData.anchorX,
                    y:extraData.anchorY,
                }
                
            })
    this.currentRotation = 0;
}
    }
    onRotationGestureTouch(args: GestureTouchEventData) {
        const { state, extraData, view } = args.data;
        if (state === GestureState.ACTIVE) {
            this.notify({
                eventName:'pinchmove',
                ...extraData,
                scale: this.currentScale,
                offsetCenter:{
                    x:extraData.anchorX,
                    y:extraData.anchorY,
                }
            })
        }
       
    }
    notify(data) {
        data.type = data.eventName;
        data.srcEvent = {};
        data.stopPropagation = function(){}
        super.notify(data)
    }
    on(eventName, callback) {
        super.on(eventName, callback);
        if (/pan/.test(eventName) && !this.panGestureHandler) {
            const manager = Manager.getInstance();
            const gestureHandler = manager.createGestureHandler(HandlerType.PAN, PAN_GESTURE_TAG, {
                simultaneousHandlers:[ROTATION_GESTURE_TAG, PINCH_GESTURE_TAG]
            });
            gestureHandler.on(GestureHandlerTouchEvent, this.onPanGestureTouch as any, this);
            gestureHandler.on(GestureHandlerStateEvent, this.onPanGestureState as any, this);
            gestureHandler.attachToView(this.element);
            this.panGestureHandler = gestureHandler as any;
        } else if (/pinch/.test(eventName) && !this.pinchGestureHandler) {
            const manager = Manager.getInstance();
            let gestureHandler = manager.createGestureHandler(HandlerType.PINCH, PINCH_GESTURE_TAG, {
                simultaneousHandlers:[ROTATION_GESTURE_TAG, PAN_GESTURE_TAG]
            });
            gestureHandler.on(GestureHandlerTouchEvent, this.onPinchGestureTouch as any, this);
            gestureHandler.on(GestureHandlerStateEvent, this.onPinchGestureState as any, this);
            gestureHandler.attachToView(this.element);
            this.pinchGestureHandler = gestureHandler as any;
             gestureHandler = manager.createGestureHandler(HandlerType.ROTATION, ROTATION_GESTURE_TAG, {
                simultaneousHandlers:[PINCH_GESTURE_TAG, PAN_GESTURE_TAG]
            });
            gestureHandler.on(GestureHandlerTouchEvent, this.onRotationGestureTouch as any, this);
            gestureHandler.on(GestureHandlerStateEvent, this.onRotationGestureState as any, this);
            gestureHandler.attachToView(this.element);
            this.rotationGestureHandler = gestureHandler as any;
        }
    }
    off(eventName, callback) {
        super.off(eventName, callback);
        if (/pan/.test(eventName) && this.panGestureHandler) {
            this.panGestureHandler.detachFromView();
            this.panGestureHandler = null;
        }
        if (/pinch/.test(eventName) && this.pinchGestureHandler) {
            this.pinchGestureHandler.detachFromView();
            this.pinchGestureHandler = null;
            this.rotationGestureHandler.detachFromView();
            this.rotationGestureHandler = null;
        }
    }

    destroy() {
        if (this.panGestureHandler) {
            this.panGestureHandler.detachFromView();
            this.panGestureHandler = null;
        }
        if (this.panGestureHandler) {
            this.pinchGestureHandler.detachFromView();
            this.pinchGestureHandler = null;
            this.rotationGestureHandler.detachFromView();
            this.rotationGestureHandler = null;
        }
    }
}
