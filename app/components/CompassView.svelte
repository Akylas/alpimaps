<script lang="ts">
    import { moon, sun } from '@modern-dev/daylight';
    import { startListeningForSensor, stopListeningForSensor } from '@nativescript-community/sensors';
    import { estimateMagneticField } from '@nativescript-community/sensors/sensors';
    import { Align, Canvas, CanvasView, LayoutAlignment, Paint, StaticLayout } from '@nativescript-community/ui-canvas';
    import type { MapPos } from '@nativescript-community/ui-carto/core';
    import { executeOnMainThread } from '@nativescript/core/utils';
    import { getMoonPosition, GetMoonPositionResult, getPosition, GetSunPositionResult } from 'suncalc';
    import { onDestroy, onMount } from 'svelte';
    import { NativeViewElementNode } from 'svelte-native/dom';
    import SmoothCompassBehavior, { wrap } from '~/components/SmoothCompassBehavior';
    import { getBearing, getDistanceSimple } from '~/helpers/geolib';
    import { formatter } from '~/mapModules/ItemFormatter';
    import { Item } from '~/models/Item';
    import { packageService } from '~/services/PackageService';
    import { TO_DEG, TO_RAD } from '~/utils/geo';
    import { lc } from '~/helpers/locale';
    import { primaryColor } from '~/variables';
    import CompassDialView from './CompassDialView.svelte';
    import { Utils } from '@nativescript-community/ui-chart/utils/Utils';
    import { getMapContext } from '~/mapModules/MapModule';
    import IconButton from './IconButton.svelte';
    import { formatDistance } from '~/helpers/formatter';
    import dayjs, { Dayjs } from 'dayjs';

    let currentHeading: number = 0;
    let lastHeadingTime: number = 0;
    let headingAccuracy: number = undefined;
    let listeningForHeading = false;

    export let height: number = 350;
    export let location: MapPos<LatLonKeys> = null;
    export let date: Dayjs = dayjs();
    export let aimingItems: Item[] = [];

    export let updateWithUserLocation = false;
    export let updateWithSensor = true;

    let moonBearing: GetMoonPositionResult = null;
    let sunBearing: GetSunPositionResult = null;
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

    $: {
        try {
            if (updateWithSensor) {
                startHeadingListener();
            } else {
                stopHeadingListener();
            }
        } catch (err) {
            console.error('startHeadingListener', err, err['stack']);
        }
    }


    $: {
        if (location) {
            const ddate = date.toDate();
            moonBearing = getMoonPosition(ddate, location.lat, location.lon);
            moonBearing.azimuth = moonBearing.azimuth * TO_DEG + 180;
            moonBearing.altitude = moonBearing.altitude * TO_DEG;
            sunBearing = getPosition(ddate, location.lat, location.lon);
            sunBearing.azimuth = sunBearing.azimuth * TO_DEG + 180;
            sunBearing.altitude = sunBearing.altitude * TO_DEG;
            canvas?.nativeView.invalidate();
        }
    }

    function onNewLocation(e) {
        location = e.data;
    }
    onMount(() => {
        if (updateWithUserLocation) {
            const module = getMapContext().mapModule('userLocation');
            if (module) {
                module.on('location', onNewLocation);
                // onNewLocation({ data: module.lastUserLocation } as any);
            }
        }
    });
    onDestroy(() => {
        try {
            stopHeadingListener();
        } catch (err) {
            console.error('stopHeadingListener', err, err['stack']);
        }
        const module = getMapContext().mapModule('userLocation');
        if (module) {
            module.off('location', onNewLocation);
        }
    });
    const paint = new Paint();
    const textPaint = new Paint();
    textPaint.textSize = 12;
    textPaint.color = 'white';
    function onCanvasDraw({ canvas, object, delta, rotation }: { canvas: Canvas; object: Canvas; delta: number; rotation: number }) {
        let w = canvas.getWidth();
        let h = canvas.getHeight();
        const rx = w / 2;
        const ry = h / 2;
        const radius = Math.min(rx, ry);

        function getCenter(bearing, altitude) {
            const rad = TO_RAD * ((bearing - 90) % 360);
            const ryd = (radius - delta) * (1 - Math.max(0, altitude) / 90);
            const result = [rx + Math.cos(rad) * ryd, ry + +Math.sin(rad) * ryd];
            return result;
        }
        if (moonBearing !== null) {
            let center = getCenter(moonBearing.azimuth, moonBearing.altitude);
            paint.setColor('gray');
            if (moonBearing.altitude < 0) {
                paint.setAlpha(200);
            } else {
                paint.setAlpha(255);
            }
            canvas.drawCircle(center[0], center[1], 10, paint);
            paint.setColor('#ffdd55');
            center = getCenter(sunBearing.azimuth, sunBearing.altitude);
            if (sunBearing.altitude < 0) {
                paint.setAlpha(200);
            } else {
                paint.setAlpha(255);
            }
            canvas.drawCircle(center[0], center[1], 10, paint);
        }
        if (location && aimingItems?.length) {
            paint.setAlpha(255);
            aimingItems.forEach((item) => {
                canvas.save();
                const center = packageService.getItemCenter(item);
                const bearing = getBearing(location, center);
                let centerCanvas = getCenter(bearing, 0);
                paint.setColor(primaryColor);
                canvas.translate(centerCanvas[0], centerCanvas[1]);
                canvas.drawCircle(0, 0, 5, paint);
                const distance = getDistanceSimple(center, location);
                const text = formatter.getItemTitle(item) + ' ' + formatDistance(distance, distance < 1000 ? 0 : 1);
                const staticLayout = new StaticLayout(text, textPaint, radius, LayoutAlignment.ALIGN_NORMAL, 1, 0, true);
                const textW = Math.min(Utils.calcTextSize(textPaint, text).width, staticLayout.getWidth());
                const textH = staticLayout.getHeight();
                const bearingRotated = (bearing + rotation + 360) % 360;
                let textX = 0;
                let textY = 0;
                if (bearingRotated > 340 || bearingRotated < 20) {
                    textY += 10;
                } else if (bearingRotated > 160 && bearingRotated < 200) {
                    textY -= 10 + textH;
                } else if (bearingRotated >= 200) {
                    textY -= textH / 2;
                    textX += 10 + textW / 2;
                } else {
                    textY -= textH / 2;
                    textX -= 10 + textW / 2;
                }
                canvas.rotate(-rotation);
                canvas.translate(textX - textW / 2, textY);
                paint.setColor('#444444aa');
                canvas.drawRoundRect(-2, -1, textW + 4, textH + 2, 2, 2, paint);
                staticLayout.draw(canvas);
                canvas.restore();
            });
        }
    }
</script>

<gridLayout {height} rows="*,auto" {...$$restProps}>
    <CompassDialView bind:canvas onDraw={onCanvasDraw} rotation={updateWithSensor ? -currentHeading : 0} drawInsideGrid={moonBearing} />
    <svgview visibility={updateWithSensor ? 'visible' : 'hidden'} src="~/assets/svgs/needle.svg" stretch="aspectFit" horizontalAlignment="center" margin="30" />
    <IconButton small={true} text="mdi-rotate-orbit" on:tap={() => (updateWithSensor = !updateWithSensor)} isSelected={updateWithSensor} horizontalAlignment="left" verticalAlignment="bottom" />
    <label
        row={1}
        visibility={updateWithSensor && headingAccuracy >= 2 ? 'visible' : 'hidden'}
        text={lc('calibration_needed')}
        horizontalAlignment="center"
        fontSize={10}
        padding={4}
        marginBottom={4}
        verticalTextAlignment="center"
        backgroundColor="orange"
        borderRadius="4"
        color="white"
    />
</gridLayout>
>
