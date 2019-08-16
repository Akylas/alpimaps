const TWEEN = require('@tweenjs/tween.js');
export { Easing } from '@tweenjs/tween.js';

const TweenUpdate = TWEEN.update;

// Workaround to make tweenjs work in an env that is
// not really web and it is not really node...
TWEEN.now = function() {
    return new Date().getTime();
};

export class Animation extends TWEEN.Tween {
    constructor(obj) {
        super(obj);
        this['_onCompleteCallback'] = function() {
            // console.log('_onCompleteCallback', !!this.__onCompleteCallback);
            if (this.__onCompleteCallback) {
                this.__onCompleteCallback(this._object);
            }
            cancelAnimationFrame();
        };
    }
    __onCompleteCallback;
    onComplete(callback) {
        // console.log('onComplete', !!callback);
        this.__onCompleteCallback = callback;
        return this;
    }
    start(time?: number) {
        startAnimationFrame();
        return super.start(time);
    }
    stop() {
        cancelAnimationFrame();
        return super.stop();
    }
}

let animationFrameRunning = false;
const cancelAnimationFrame = function() {
    // console.log('cancelAnimationFrame', animationFrameRunning, runningTweens);
    if (runningTweens > 0) {
        runningTweens--;
    }
    if (animationFrameRunning && runningTweens === 0) {
        animationFrameRunning = false;
    }
};

let runningTweens = 0;
const startAnimationFrame = function() {
    // console.log('startAnimationFrame', animationFrameRunning, runningTweens);
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
    const timeToCall = Math.max(0, 16 - (currTime - lastTime));
    // console.log('requestAnimationFrame', timeToCall);
    const id = setTimeout(function() {
        lastTime = new Date().getTime();
        callback(currTime + timeToCall);
    }, timeToCall);
    return id;
};
//////////////////////////

function tAnimate() {
    // console.log('tAnimate', animationFrameRunning);

    if (animationFrameRunning) {
        requestAnimationFrame(tAnimate);
        TWEEN.update();
    }
}
