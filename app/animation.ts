import TWEEN from '@tweenjs/tween.js';
import { ApplicationEventData, on as applicationOn, suspendEvent } from '@nativescript/core/application';

const Easing = TWEEN.Easing;
export { Easing };

// We need to cancel all animations on app pause
// or they will remain in an in-between state
applicationOn(suspendEvent, function(args: ApplicationEventData) {
    const runningAnimations = TWEEN.getAll();
    console.log('[Animation]', 'suspendEvent', runningAnimations.length);
    runningAnimations.forEach((t: Animation) => t.cancel());
});

export class Animation extends TWEEN.Tween {
    constructor(obj) {
        super(obj);
        this['_onCompleteCallback'] = function() {
            if (this.__onCompleteCallback) {
                this.__onCompleteCallback(this._object);
            }
            cancelAnimationFrame();
        };
    }
    __onCompleteCallback;
    onComplete(callback) {
        this.__onCompleteCallback = callback;
        return this;
    }
    to(properties: any, duration: number) {
        return super.to(properties, duration) as this;
    }
    onUpdate(callback) {
        return super.onUpdate(callback) as this;
    }
    stop() {
        return super.stop() as this;
    }
    start(time?: number) {
        startAnimationFrame();
        return super.start(time) as this;
    }
    cancel() {
        return super.end().stop() as this;
    }
    end() {
        return super.end().stop() as this;
    }
}

let animationFrameRunning = false;
const cancelAnimationFrame = function() {
    if (runningTweens > 0) {
        runningTweens--;
    }
    if (animationFrameRunning && runningTweens === 0) {
        animationFrameRunning = false;
    }
};

let runningTweens = 0;
const startAnimationFrame = function() {
    runningTweens++;
    if (!animationFrameRunning) {
        animationFrameRunning = true;
        tAnimate();
    }
};
//////////////////////////
// requestAnimationFrame polyill
let lastTime = 0;

const requestAnimationFrame = function(callback) {
    const currTime = new Date().getTime();
    // 16 => 60 fps
    const timeToCall = Math.max(0, 10 - (currTime - lastTime));
    const id = setTimeout(function() {
        lastTime = new Date().getTime();
        callback(currTime + timeToCall);
    }, timeToCall);
    return id;
};
//////////////////////////

function tAnimate() {
    if (animationFrameRunning) {
        requestAnimationFrame(tAnimate);
        TWEEN.update();
    }
}
