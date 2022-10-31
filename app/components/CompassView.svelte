<script lang="ts">
    import { moon, sun } from '@modern-dev/daylight';
    import { startListeningForSensor, stopListeningForSensor } from '@nativescript-community/sensors';
    import { estimateMagneticField } from '@nativescript-community/sensors/sensors';
    import { Canvas, CanvasView, Paint } from '@nativescript-community/ui-canvas';
    import type { MapPos } from '@nativescript-community/ui-carto/core';
    import { executeOnMainThread } from '@nativescript/core/utils';
    import { getMoonPosition, getPosition } from 'suncalc';
    import { onDestroy, onMount } from 'svelte';
    import { NativeViewElementNode } from 'svelte-native/dom';
    import SmoothCompassBehavior, { wrap } from '~/components/SmoothCompassBehavior';
    import { TO_DEG } from '~/utils/geo';

    let currentHeading: number = 0;
    let lastHeadingTime: number = 0;
    let headingAccuracy: number = undefined;
    let listeningForHeading = false;

    export let height: number = 350;
    export let location: MapPos<LatLonKeys> = null;

    let moonBearing = null;
    let sunBearing = null;
    const behavior = new SmoothCompassBehavior(0.5);
    let canvas: NativeViewElementNode<CanvasView>;

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
                if (__ANDROID__ && !('trueHeading' in data) && location) {
                    const res = estimateMagneticField(location.lat, location.lon, location.altitude);
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
                // on ios accuracy is in degrees so lower is best
                // on android 0 - 4 with highest is best
                const newAccuracy = __ANDROID__ ? 4 - data.accuracy : data.accuracy;
                if (headingAccuracy !== newAccuracy) {
                    DEV_LOG && console.log('headingAccuracy', newAccuracy);
                    executeOnMainThread(() => {
                        headingAccuracy = newAccuracy;
                    });
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

    const paint = new Paint();
    function onCanvasDraw({ canvas, object }: { canvas: Canvas; object: Canvas }) {
        let w = canvas.getWidth();
        let h = canvas.getHeight();
        canvas.translate(w / 2, h / 2);
        canvas.save();
        canvas.rotate(moonBearing + 180);
        paint.setColor('gray');
        canvas.drawCircle(0, h / 2, 10, paint);
        canvas.restore();
        canvas.rotate(sunBearing + 180);
        paint.setColor('#ffdd55');
        canvas.drawCircle(0, h / 2, 10, paint);
    }

    $: {
        if (location) {
            const date = new Date();
            moonBearing = getMoonPosition(date, location.lat, location.lon).azimuth * TO_DEG + 180;
            sunBearing = getPosition(date, location.lat, location.lon).azimuth * TO_DEG + 180;
            canvas?.nativeView.invalidate();
        }
    }
</script>

<gridLayout {height}>
    <svgview src="~/assets/svgs/needle_background.svg" stretch="aspectFit" horizontalAlignment="center" />
    <svgview src="~/assets/svgs/needle.svg" stretch="aspectFit" horizontalAlignment="center" rotate={-currentHeading} />
    {#if moonBearing !== null}
        <canvas bind:this={canvas} on:draw={onCanvasDraw} />
    {/if}
    <label visibility={headingAccuracy >= 2 ? 'visible' : 'hidden'} class="alpimaps" text="alpimaps-compass-calibrate" horizontalAlignment="right" verticalAlignment="bottom" fontSize={60} />
</gridLayout>
>
