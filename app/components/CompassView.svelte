<script lang="ts">
    import { startListeningForSensor, stopListeningForSensor } from '@nativescript-community/sensors';
    import { estimateMagneticField } from '@nativescript-community/sensors/sensors';
    import { MapPos } from '@nativescript-community/ui-carto/core';
    import { onDestroy, onMount } from 'svelte';
    function wrap(value, min, max) {
        let result;

        const offset_value = value - min;
        if (offset_value < 0.0) {
            result = max - min - (Math.abs(offset_value) % (max - min)) + min;
        } else {
            result = (offset_value % (max - min)) + min;
        }

        if (result == max) {
            result = min;
        }

        return result;
    }
    class SmoothCompassBehavior {
        static DISTANCE_FACTOR = 0.0025;
        static MAX_ACCELERATION = 0.0005;

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

    let currentHeading: number = 0;
    let lastHeadingTime: number = 0;
    let headingAccuracy: number = undefined;
    let listeningForHeading = false;

    export let height: number = 350;
    export let altitude: number = null;
    export let location: MapPos<LatLonKeys> = null;
    const behavior = new SmoothCompassBehavior(0.5);

    function startHeadingListener() {
        if (!listeningForHeading) {
            listeningForHeading = true;
            startListeningForSensor('heading', onSensor, 100, 0, { headingFilter: 0 });
        }
    }
    function stopHeadingListener() {
        if (listeningForHeading) {
            listeningForHeading = false;
            stopListeningForSensor('heading', onSensor);
        }
    }
    function onSensor(data, sensor: string) {
        switch (sensor) {
            case 'heading':
                if (global.isAndroid && !('trueHeading' in data) && location) {
                    const res = estimateMagneticField(location.lat, location.lon, altitude);
                    if (res) {
                        data.trueHeading = data.heading + res.getDeclination();
                    }
                }
                const newValue = 'trueHeading' in data ? data.trueHeading : data.heading;
                const oldBearing = currentHeading;
                const newBearing = wrap(behavior.updateBearing(oldBearing, newValue, lastHeadingTime ? Math.abs(data.timestamp - lastHeadingTime) : 10), 0, 360);
                if (newBearing !== oldBearing) {
                    currentHeading = newBearing;
                    lastHeadingTime = data.timestamp;
                }
                if (headingAccuracy !== data.accuracy) {
                    // on ios accuracy is in degrees so lower is best
                    // on android 0 - 4 with highest is best
                    if (global.isAndroid) {
                        headingAccuracy = 4 - data.accuracy;
                    } else {
                        headingAccuracy = data.accuracy;
                    }
                }

                break;
        }
    }
    onMount(() => {
        try {
            startHeadingListener();
        } catch (err) {
            console.error('startHeadingListener', err, err['stack']);
        }
    });
    onDestroy(() => {
        try {
            stopHeadingListener();
        } catch (err) {
            console.error('stopHeadingListener', err, err['stack']);
        }
    });
</script>

<gridLayout {height}>
    <label text={headingAccuracy + ''} verticalAlignment="top" />
    <svgview src="~/assets/svgs/needle_background.svg" stretch="aspectFit" horizontalAlignment="center" />
    <svgview src="~/assets/svgs/needle.svg" stretch="aspectFit" horizontalAlignment="center" rotate={-currentHeading} />
    <label visibility={headingAccuracy >= 2 ? 'visible' : 'hidden'} class="alpimaps" text="alpimaps-compass-calibrate" horizontalAlignment="right" verticalAlignment="bottom" fontSize="80" />
</gridLayout>
