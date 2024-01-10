export function wrap(value, min, max) {
    let result;

    const offset_value = value - min;
    if (offset_value < 0.0) {
        result = max - min - (Math.abs(offset_value) % (max - min)) + min;
    } else {
        result = (offset_value % (max - min)) + min;
    }

    if (result === max) {
        result = min;
    }

    return result;
}
export default class SmoothCompassBehavior {
    static DISTANCE_FACTOR: number = 0.0025;
    static MAX_ACCELERATION: number = 0.0005;

    distanceFactor;
    maxAcceleration;

    lastDistance = 0.0;

    constructor(scale) {
        this.distanceFactor = SmoothCompassBehavior.DISTANCE_FACTOR * (0.5 + scale * 1.5);
        this.maxAcceleration = SmoothCompassBehavior.MAX_ACCELERATION * (0.5 + scale * 1.5);
        // console.log('SmoothCompassBehavior', scale, this.distanceFactor, this.maxAcceleration);
    }

    public updateBearing(compassBearing, sensorBearing, timeDelta) {
        for (let count = 0; count < timeDelta; count++) {
            let distance = wrap(sensorBearing - compassBearing, -180.0, 180.0);
            distance = distance * this.distanceFactor;
            if (distance > 0.0 && distance > this.lastDistance + this.maxAcceleration) {
                distance = this.lastDistance + this.maxAcceleration;
            } else if (distance < 0.0 && distance < this.lastDistance - this.maxAcceleration) {
                distance = this.lastDistance - this.maxAcceleration;
            }
            this.lastDistance = distance;
            compassBearing += distance;
        }

        return compassBearing;
    }
}
