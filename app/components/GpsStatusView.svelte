<script lang="ts" context="module">
    import { Color, Utils } from '@nativescript/core';
    import { primaryColor, textColor } from '~/variables';

    const density = Utils.layout.getDisplayDensity();
    const snrScale = 0.1 * density;
    const gridStrokeWidth = Math.max(0.5, density);

    const activePaint = new Paint();
    activePaint.setStyle(Style.FILL);

    const inactivePaint = new Paint();
    inactivePaint.setStyle(Style.FILL);

    const gridPaint = new Paint();
    gridPaint.setStyle(Style.STROKE);
    // gridPaint.setStrokeWidth(gridStrokeWidth);
    const gridPaintStrong = new Paint(gridPaint);
    gridPaintStrong.setStrokeWidth(gridStrokeWidth);
    // gridPaintStrong.setColor(Color.parseColor('#FFFFFFFF'));

    const gridBorderPaint = new Paint();
    gridBorderPaint.setStyle(Style.STROKE);

    const northPaint = new Paint();
    northPaint.setStyle(Style.FILL);

    const labelPaint = new Paint();
    labelPaint.setStyle(Style.FILL);
    labelPaint.setTextAlign(Align.CENTER);

    const fontMetrics = labelPaint.getFontMetrics();
    const MAX_NMEA_ID = 336;

    /*
     * Get the total height of the text. Note that this is not the same as getTextSize/setTextSize.
     * Also note that the ascent is negative and descent is positive, hence descent - ascent will give us
     * absolute text height (a positive number).
     */
    const textHeight = Math.ceil(fontMetrics.descent - fontMetrics.ascent);

    /*
     * Height should be the same as two rows of small text plus a row of medium text. This is a
     * rough approximation based on text sizes and the ratio between text size and actual height.
     */
    const preferredHeight = ((2 * labelPaint.getTextSize() + 18) * textHeight) / labelPaint.getTextSize();

    const northArrow = new Path();
    const labelPathN = new Path();
    const labelPathE = new Path();
    const labelPathS = new Path();
    const labelPathW = new Path();
</script>

<script lang="ts">
    import { Align, Canvas, CanvasView, Paint, Path, Style } from '@nativescript-community/ui-canvas';
    import { onDestroy, onMount } from 'svelte';
    import { NativeViewElementNode } from 'svelte-native/dom';
    import { get } from 'svelte/store';
    import { listenForGpsStatus, stopListenForGpsStatus } from '~/handlers/GeoHandler';
    import { getMapContext } from '~/mapModules/MapModule';
    import { watchingLocation } from '~/stores/mapStore';
    import { TO_RAD } from '~/utils/geo';

    export let height: number = 350;
    let canvas: NativeViewElementNode<CanvasView>;
    let canvas2: NativeViewElementNode<CanvasView>;

    let draw_1_32 = false;
    let draw_33_54 = false;
    let draw_55_64 = false;
    let draw_65_88 = false;
    let draw_89_96 = false;
    let draw_97_192 = false;
    let draw_193_195 = false;
    let draw_196_200 = false;
    let draw_201_235 = false;
    let draw_236_300 = false;
    let draw_301_336 = false;

    let mSats;
    function onSatsChange(sats) {
        mSats = sats;
        if (canvas.nativeView) {
            canvas.nativeView.invalidate();
            canvas2.nativeView.invalidate();
        }
    }
    let wasWatchingForLocation;
    onMount(async () => {
        try {
            wasWatchingForLocation = get(watchingLocation);
            if (!wasWatchingForLocation) {
                const userLocationModule = getMapContext().mapModule('userLocation');
                await userLocationModule.startWatchLocation();
            }
            listenForGpsStatus(onSatsChange);
        } catch (err) {
            console.error('listenForGpsStatus', err, err['stack']);
        }
    });
    onDestroy(() => {
        try {
            if (!wasWatchingForLocation) {
                const userLocationModule = getMapContext().mapModule('userLocation');
                userLocationModule.stopWatchLocation();
            }
            stopListenForGpsStatus();
        } catch (err) {
            console.error('stopListenForGpsStatus', err, err['stack']);
        }
    });

    function onCanvasDraw({ canvas, object }: { canvas: Canvas; object: CanvasView }) {
        try {
            let mW = canvas.getWidth();
            let mH = canvas.getHeight();
            const width = Math.min(mW, mH);
            const cx = mW / 2;
            const cy = mH / 2;

            canvas.translate(cx, cy);
            // canvas.rotate(-mRotation);

            canvas.drawCircle(0, 0, width * 0.37125, gridBorderPaint);

            canvas.drawLine(-width * 0.405, 0, width * 0.405, 0, gridPaintStrong);
            canvas.drawLine(0, -width * 0.405, 0, width * 0.405, gridPaintStrong);

            canvas.drawCircle(0, 0, width * 0.405, gridPaintStrong);
            canvas.drawCircle(0, 0, width * 0.27, gridPaintStrong);
            canvas.drawCircle(0, 0, width * 0.135, gridPaintStrong);

            canvas.drawPath(northArrow, northPaint);

            const descent = fontMetrics.descent;

            canvas.drawTextOnPath('N', labelPathN, -descent, 4, labelPaint);
            canvas.drawTextOnPath('S', labelPathS, -descent, 4, labelPaint);
            canvas.drawTextOnPath('E', labelPathE, -descent, 4, labelPaint);
            canvas.drawTextOnPath('W', labelPathW, -descent, 4, labelPaint);
            if (mSats) {
                for (let index = 0; index < mSats.length; index++) {
                    const sat = mSats[index];
                    drawSat(canvas, width, sat);
                }
            }
        } catch (error) {
            console.error(error, error.stack);
        }
    }

    function drawSat(canvas, mW, sat) {
        const r = ((90 - sat.elevation) * mW * 0.9) / 200;
        const x = r * Math.sin((sat.azimuth * Math.PI) / 180);
        const y = -(r * Math.cos((sat.azimuth * Math.PI) / 180));

        canvas.drawCircle(x, y, sat.snr * snrScale, sat.usedInFix ? activePaint : inactivePaint);
    }

    function refreshGeometries(e) {
        const mW = Utils.layout.toDeviceIndependentPixels(e.object.getMeasuredWidth());
        const mH = Utils.layout.toDeviceIndependentPixels(e.object.getMeasuredHeight());

        const width = Math.min(mW, mH)

        const txtColor = $textColor;
        let mRotation = 0;
        gridBorderPaint.setStrokeWidth(mW * 0.0625);

        activePaint.setColor(primaryColor); // Teal 200
        inactivePaint.setColor('#F44336'); // Red 500
        gridPaintStrong.setColor(txtColor); // Orange 500
        gridPaint.setColor(new Color(txtColor).setAlpha(100)); // Orange 500
        gridBorderPaint.setColor(new Color(txtColor).setAlpha(100)); // Orange 500 @ 30%
        northPaint.setColor('#F44336'); // Red 500
        labelPaint.setColor(new Color(txtColor).setAlpha(100)); // Orange 500

        const arrowWidth = 2 * density;

        northArrow.reset();
        northArrow.moveTo(-arrowWidth, -mH * 0.27);
        northArrow.lineTo(arrowWidth, -mH * 0.27);
        northArrow.lineTo(0, -mH * 0.405 - gridStrokeWidth * 2);
        northArrow.close();

        labelPaint.setTextSize(mH * 0.045);

        const offsetX = width * 0.0275 * Math.cos(TO_RAD * (mRotation + 90));
        const offsetY = width * 0.0275 * Math.sin(TO_RAD * (mRotation + 90));
        const relX = width * Math.cos(TO_RAD * mRotation);
        const relY = width * Math.sin(TO_RAD * mRotation);

        labelPathN.reset();
        labelPathN.moveTo(offsetX - relX, -width * 0.4275 + offsetY - relY);
        labelPathN.rLineTo(2 * relX, 2 * relY);

        labelPathE.reset();
        labelPathE.moveTo(width * 0.4275 + offsetX - relX, offsetY - relY);
        labelPathE.rLineTo(2 * relX, 2 * relY);

        labelPathS.reset();
        labelPathS.moveTo(offsetX - relX, width * 0.4275 + offsetY - relY);
        labelPathS.rLineTo(2 * relX, 2 * relY);

        labelPathW.reset();
        labelPathW.moveTo(-width * 0.4275 + offsetX - relX, offsetY - relY);
        labelPathW.rLineTo(2 * relX, 2 * relY);
    }

    /**
     * Draws the grid lines and labels.
     */
    function drawGrid(canvas: Canvas) {
        //don't use Canvas.getWidth() and Canvas.getHeight() here, they may return incorrect values
        const w = canvas.getWidth();
        const h = canvas.getHeight();

        // left boundary
        canvas.drawLine(gridStrokeWidth / 2, 0, gridStrokeWidth / 2, h - textHeight, gridPaintStrong);

        const numBars = getNumBars();

        if (draw_1_32) drawLabel(canvas, 'GPS', 1, 32, numBars);
        if (draw_33_54) drawLabel(canvas, 'SBAS', 33, 22, numBars);
        if (draw_55_64) drawLabel(canvas, '55-64', 55, 10, numBars);

        // 65–88 is GLONASS, 89–96 is for possible future GLONASS extensions
        if (draw_65_88 && draw_89_96) drawLabel(canvas, 'GLONASS', 65, 32, numBars);
        else if (draw_65_88) drawLabel(canvas, 'GLONASS', 65, 24, numBars);
        else if (draw_89_96) drawLabel(canvas, 'GLONASS', 89, 8, numBars);

        if (draw_97_192) drawLabel(canvas, '97-192', 97, 96, numBars);

        // 193–195 is QZSS, 196–200 is for possible future QZSS extensions
        if (draw_193_195 && draw_196_200) drawLabel(canvas, 'QZSS', 193, 8, numBars);
        else if (draw_193_195) drawLabel(canvas, 'QZSS', 193, 3, numBars);
        else if (draw_196_200) drawLabel(canvas, 'QZSS', 196, 5, numBars);

        if (draw_201_235) drawLabel(canvas, 'Beidou', 201, 35, numBars);

        // 236–300 (currently unused)
        if (draw_236_300) drawLabel(canvas, '236-300', 236, 65, numBars);

        // 301–336 is Galileo
        if (draw_301_336) drawLabel(canvas, 'Galileo', 301, 36, numBars);

        // range boundaries and auxiliary lines (after every 4th satellite)
        for (let nmeaID = 1; nmeaID < MAX_NMEA_ID; nmeaID++) {
            let pos = getGridPos(nmeaID);
            if (pos > 0) {
                let x = gridStrokeWidth / 2 + (pos * (w - gridStrokeWidth)) / numBars;
                let paint;
                switch (nmeaID) {
                    case 32:
                    case 64:
                    case 96:
                    case 192:
                    case 200:
                    case 235:
                    case 300:
                    case 336:
                        paint = gridPaintStrong;
                        break;
                    case 54:
                        if (!draw_55_64) paint = gridPaintStrong;
                        break;
                    case 88:
                        if (!draw_89_96) paint = gridPaintStrong;
                        else paint = gridPaint;
                        break;
                    case 195:
                        if (!draw_196_200) paint = gridPaintStrong;
                        break;
                    default:
                        if (nmeaID % 4 == 0) paint = gridPaint;
                        break;
                }
                if (paint) {
                    canvas.drawLine(x, 0, x, h - textHeight, paint);
                }
            }
        }

        // right boundary
        canvas.drawLine(w - gridStrokeWidth / 2, h - textHeight, w - gridStrokeWidth / 2, 0, gridPaintStrong);

        // bottom line
        canvas.drawLine(0, h - textHeight - gridStrokeWidth / 2, w, h - textHeight - gridStrokeWidth / 2, gridPaintStrong);
    }

    /**
     * Draws the label for a satellite range.
     *
     * @param canvas The {@code Canvas} on which the SNR view will appear.
     * @param label The text to be displayed (the description of the satellite range, such as "GPS", "GLONASS" or "Beidou")
     * @param startBar The NMEA ID of the first satellite in the range
     * @param rangeBars The number of NMEA IDs in the range (ranges must be contiguous)
     * @param numBars Total number of SNR bars being displayed, as returned by getNumBars()
     */
    function drawLabel(canvas: Canvas, label, startBar, rangeBars, numBars) {
        const offsetBars = getGridPos(startBar) - 1;
        const w = canvas.getWidth();
        const h = canvas.getHeight();
        const labelPath = new Path();

        labelPath.reset();
        labelPath.moveTo(gridStrokeWidth + (offsetBars * (w - gridStrokeWidth)) / numBars, h);
        labelPath.rLineTo((rangeBars * (w - gridStrokeWidth)) / numBars - gridStrokeWidth, 0);
        canvas.drawTextOnPath(label, labelPath, 0, -fontMetrics.descent, labelPaint);
    }

    /**
     * Draws the SNR bar for a satellite.
     *
     * @param canvas The {@code Canvas} on which the SNR view will appear.
     * @param nmeaID The NMEA ID of the satellite, as returned by {@link android.location.GpsSatellite#getPrn()}.
     * @param snr The signal-to-noise ratio (SNR) for the satellite.
     * @param used Whether the satellite is used in the fix.
     */
    function drawSat2(canvas: Canvas, w, h, { nmeaID, snr, usedInFix }) {
        const i = getGridPos(nmeaID);

        const x0 = ((i - 1) * (w - gridStrokeWidth)) / getNumBars() + gridStrokeWidth / 2;
        const x1 = (i * (w - gridStrokeWidth)) / getNumBars() - gridStrokeWidth / 2;

        const y0 = h - gridStrokeWidth - textHeight;
        const y1 = y0 * (1 - Math.min(snr, 60) / 60);

        canvas.drawRect(x0, y1, x1, h - textHeight, usedInFix ? activePaint : inactivePaint);
    }

    /**
     * Returns the position of the SNR bar for a satellite in the grid.
     * <p>
     * This function returns the position at which the SNR bar for the
     * satellite with the given {@code nmeaID} will appear in the grid, taking
     * into account the visibility of NMEA ID ranges.
     *
     * @param nmeaID The NMEA ID of the satellite, as returned by {@link android.location.GpsSatellite#getPrn()}.
     * @return The position of the SNR bar in the grid. The position of the first visible bar is 1. If {@code nmeaID} falls within a hidden range, -1 is returned.
     */
    function getGridPos(nmeaID) {
        if (nmeaID < 1) return -1;

        let skip = 0;
        if (nmeaID > 32) {
            if (!draw_1_32) skip += 32;
            if (nmeaID > 54) {
                if (!draw_33_54) skip += 22;
                if (nmeaID > 64) {
                    if (!draw_55_64) skip += 10;
                    if (nmeaID > 88) {
                        if (!draw_65_88) skip += 24;
                        if (nmeaID > 96) {
                            if (!draw_89_96) skip += 8;
                            if (nmeaID > 192) {
                                if (!draw_97_192) skip += 96;
                                if (nmeaID > 195) {
                                    if (!draw_193_195) skip += 3;
                                    if (nmeaID > 200) {
                                        if (!draw_196_200) skip += 5;
                                        if (nmeaID > 235) {
                                            if (!draw_201_235) skip += 35;
                                            if (nmeaID > 300) {
                                                if (nmeaID > MAX_NMEA_ID) return -1;
                                                else if (!draw_301_336) return -1;
                                                else if (!draw_236_300) skip += 65;
                                            } else {
                                                // 235 < nmeaID <= 300
                                                if (!draw_236_300) return -1;
                                            }
                                        } else {
                                            // 200 < nmeaID <= 235
                                            if (!draw_201_235) return -1;
                                        }
                                    } else {
                                        // 195 < nmeaID <= 200
                                        if (!draw_196_200) return -1;
                                    }
                                } else {
                                    // 192 < nmeaID <= 195
                                    if (!draw_193_195) return -1;
                                }
                            } else {
                                // 96 < nmeaID <= 192
                                if (!draw_97_192) return -1;
                            }
                        } else {
                            // 88 < nmeaID <= 96
                            if (!draw_89_96) return -1;
                        }
                    } else {
                        // 64 < nmeaID <= 88
                        if (!draw_65_88) return -1;
                    }
                } else {
                    // 54 < nmeaID <= 64
                    if (!draw_55_64) return -1;
                }
            } else {
                // 32 < nmeaID <= 54
                if (!draw_33_54) return -1;
            }
        } else {
            // nmeaID <= 32
            if (!draw_1_32) return -1;
        }

        return nmeaID - skip;
    }

    /**
     * Returns the number of SNR bars to draw
     *
     * The number of bars to draw varies depending on the systems supported by the device. Common
     * numbers are 32 for a GPS-only receiver, 56 for a combined GPS/GLONASS receiver or 91 for a
     * combined GPS/GLONASS/Beidou receiver. Another 36 bars are needed for Galileo; some receivers
     * require additional bars for regional GNSS or assistance systems.
     *
     * @return The number of bars to draw
     */
    function getNumBars() {
        return (
            (draw_1_32 ? 32 : 0) +
            (draw_33_54 ? 22 : 0) +
            (draw_55_64 ? 10 : 0) +
            (draw_65_88 ? 24 : 0) +
            (draw_89_96 ? 8 : 0) +
            (draw_97_192 ? 96 : 0) +
            (draw_193_195 ? 3 : 0) +
            (draw_196_200 ? 5 : 0) +
            (draw_201_235 ? 35 : 0) +
            (draw_236_300 ? 65 : 0) +
            (draw_301_336 ? 36 : 0)
        );
    }

    /**
     * Initializes the SNR grid.
     * <p>
     * This method iterates through {@link #mSats} to determine which ranges of
     * NMEA IDs will be drawn.
     */
    function initializeGrid() {
        // iterate through list to find out how many bars to draw
        if (mSats)
            for (let index = 0; index < mSats.length; index++) {
                const sat = mSats[index];
                const prn = sat.nmeaID;
                if (prn < 1) {
                    // Log.wtf(TAG, String.format("Got satellite with invalid NMEA ID %d", prn));
                } else if (prn <= 32) {
                    draw_1_32 = true;
                } else if (prn <= 54) {
                    draw_33_54 = true;
                } else if (prn <= 64) {
                    // most likely an extended SBAS range, display the lower range, too
                    draw_33_54 = true;
                    draw_55_64 = true;
                } else if (prn <= 88) {
                    draw_65_88 = true;
                } else if (prn <= 96) {
                    // most likely an extended GLONASS range, display the lower range, too
                    draw_65_88 = true;
                    draw_89_96 = true;
                } else if (prn <= 192) {
                    draw_97_192 = true; // TODO: do we really want to enable this huge 96-sat block?
                    // Log.w(TAG, String.format("Got satellite with NMEA ID %d (from the huge unassigned 97-192 range)", prn));
                } else if (prn <= 195) {
                    draw_193_195 = true;
                } else if (prn <= 200) {
                    // most likely an extended QZSS range, display the lower range, too
                    draw_193_195 = true;
                    draw_196_200 = true;
                } else if (prn <= 235) {
                    draw_201_235 = true;
                } else if (prn <= 300) {
                    draw_236_300 = true; // TODO: same as above, do we really want to enable this?
                } else if (prn <= 336) {
                    draw_301_336 = true;
                } else {
                    // Log.w(TAG, String.format("Got satellite with NMEA ID %d, possibly unsupported system", prn));
                }
            }
        /*
         * If we didn't get any valid ranges, display at least the GPS range.
         * No need to check for extended ranges here - if they get drawn, so
         * will their corresponding base range.
         */
        if (!(draw_1_32 || draw_33_54 || draw_65_88 || draw_97_192 || draw_193_195 || draw_201_235 || draw_236_300 || draw_301_336)) draw_1_32 = true;
    }

    /**
     * Redraws the SNR view.
     * <p>
     * This method is called whenever the view needs to be redrawn. Besides the
     * usual cases of view creation/recreation, this also occurs when the
     * {@link #showSats(Iterable)} has been called to indicate new SNR data is
     * available.
     */
    function onCanvas2Draw({ canvas, object }: { canvas: Canvas; object: CanvasView }) {
        try {
            let mW = canvas.getWidth();
            let mH = canvas.getHeight();
            initializeGrid();

            // draw the SNR bars
            if (mSats) {
                for (let index = 0; index < mSats.length; index++) {
                    const sat = mSats[index];
                    drawSat2(canvas, mW, mH, sat);
                }
            }

            // draw the grid on top
            drawGrid(canvas);
        } catch (err) {
            console.error('onCanvas2Draw', err, err.stack);
        }
    }
</script>

<gridLayout {height} rows="*,auto">
    <canvas bind:this={canvas} on:draw={onCanvasDraw} on:layoutChanged={refreshGeometries} />
    <canvas bind:this={canvas2} on:draw={onCanvas2Draw} height={preferredHeight} row="1" />
</gridLayout>
