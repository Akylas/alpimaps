<script lang="ts">
    import { moon, sun } from '@modern-dev/daylight';
    import { startListeningForSensor, stopListeningForSensor } from '@nativescript-community/sensors';
    import { estimateMagneticField } from '@nativescript-community/sensors/sensors';
    import { Align, Canvas, CanvasView, LayoutAlignment, Paint, StaticLayout } from '@nativescript-community/ui-canvas';
    import type { MapPos } from '@nativescript-community/ui-carto/core';
    import { executeOnMainThread } from '@nativescript/core/utils';
    import { getMoonPosition, getPosition } from 'suncalc';
    import { onDestroy, onMount } from 'svelte';
    import { NativeViewElementNode } from 'svelte-native/dom';
    import SmoothCompassBehavior, { wrap } from '~/components/SmoothCompassBehavior';
    import { getBearing } from '~/helpers/geolib';
    import { formatter } from '~/mapModules/ItemFormatter';
    import { Item } from '~/models/Item';
    import { packageService } from '~/services/PackageService';
    import { TO_DEG, TO_RAD } from '~/utils/geo';
    import { primaryColor } from '~/variables';
    import CompassDialView from './CompassDialView.svelte';
    import { Utils } from '@nativescript-community/ui-chart/utils/Utils';

    let currentHeading: number = 0;
    let lastHeadingTime: number = 0;
    let headingAccuracy: number = undefined;
    let listeningForHeading = false;

    export let height: number = 350;
    export let location: MapPos<LatLonKeys> = null;
    export let aimingItems: Item[] = [];

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
    let androidDeclination;
    function onSensor(data, sensor: string) {
        switch (sensor) {
            case 'heading':
                if (__ANDROID__ && !('trueHeading' in data) && location) {
                    if (androidDeclination === undefined) {
                        androidDeclination = estimateMagneticField(location.lat, location.lon, location.altitude).getDeclination();
                    }
                    data.trueHeading = data.heading + androidDeclination;
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
    const textPaint = new Paint();
    textPaint.textSize = 12;
    textPaint.color = 'white';
    function onCanvasDraw({ canvas, object, delta }: { canvas: Canvas; object: Canvas; delta }) {
        let w = canvas.getWidth();
        let h = canvas.getHeight();
        const rx = w / 2;
        const ry = h / 2;
        const radius = Math.min(rx, ry);

        function getCenter(bearing) {
            const rad = TO_RAD * ((bearing - 90) % 360);
            const ryd = radius - delta;
            const result = [rx + Math.cos(rad) * ryd, ry + +Math.sin(rad) * ryd];
            return result;
        }

        if (moonBearing !== null) {
            let center = getCenter(moonBearing);
            paint.setColor('gray');
            canvas.drawCircle(center[0], center[1], 10, paint);
            paint.setColor('#ffdd55');
            center = getCenter(sunBearing);
            canvas.drawCircle(center[0], center[1], 10, paint);
        }
        if (location && aimingItems?.length) {
            aimingItems.forEach((item) => {
                const center = packageService.getItemCenter(item);
                const bearing = getBearing(location, center);
                let centerCanvas = getCenter(bearing);
                paint.setColor(primaryColor);
                canvas.drawCircle(centerCanvas[0], centerCanvas[1], 5, paint);

                const text = formatter.getItemTitle(item);
                const staticLayout = new StaticLayout(text, textPaint, radius, LayoutAlignment.ALIGN_NORMAL, 1, 0, true);
                const textW = Math.min(Utils.calcTextSize(textPaint, text).width, staticLayout.getWidth());
                const textH = staticLayout.getHeight();
                let textX = centerCanvas[0];
                let textY = centerCanvas[1];
                // textPaint.setTextAlign(Align.CENTER);
                if (bearing > 340 || bearing < 20) {
                    // textPaint.setTextAlign(Align.CENTER);
                    textY += 10;
                } else if (bearing > 160 && bearing < 200) {
                    // textPaint.setTextAlign(Align.CENTER);
                    textY -= 10 + textH;
                } else if (bearing >= 200) {
                    // textPaint.setTextAlign(Align.LEFT);
                    textY -= textH/2;
                    textX += 10 + textW/2;
                } else  {
                    // textPaint.setTextAlign(Align.RIGHT);
                    textY -= textH/2;
                    textX -= 10 + textW/2;
                }
                canvas.save();
                canvas.translate(textX - textW/2, textY);
                paint.setColor('#444444aa');
                canvas.drawRoundRect(-2, -1, textW + 4, textH + 2, 2, 2, paint);
                staticLayout.draw(canvas);
                canvas.restore();
            });
        }
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
    <CompassDialView onDraw={onCanvasDraw} />
    <svgview src="~/assets/svgs/needle.svg" stretch="aspectFit" horizontalAlignment="center" rotate={-currentHeading} />
    <!-- {#if moonBearing !== null}
        <canvas bind:this={canvas} on:draw={onCanvasDraw} />
    {/if} -->
    <label visibility={headingAccuracy >= 2 ? 'visible' : 'hidden'} class="alpimaps" text="alpimaps-compass-calibrate" horizontalAlignment="right" verticalAlignment="bottom" fontSize={60} />
</gridLayout>
>
