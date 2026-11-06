/**
 * What the weather draws over the profile, in the manner of a weather chart: rain as rounded bars from the foot, as high as the rain and as
 * plain as the chance of it (a bar full height at 4 mm/h); the temperature as a line with a ringed dot at each sample and its figure above
 * a peak, below a dip; over the plot, a row of the sky and a row of the wind: an arrow of the way it pushes, the ride going to the right,
 * and its speed under it, a burst on a line of its own.
 */
import { Align, type Canvas, Cap, Join, Paint, Path, Style } from '@nativescript-community/ui-canvas';
import { Color } from '@nativescript/core';
import type { ProfileOverlay, ProfileView } from '~/routeFeatures/registry';
import type { WeatherFormat } from '~/routeFeatures/weather/data/format';
import type { ProfileWeather } from '~/routeFeatures/weather/data/read';
import { CLOUD_GRAY, RAIN_BLUE, TEMP_LINE, tint, windColor } from '~/routeFeatures/weather/ui/colors';

/** the cloud cover is a band from the top of the plot: as deep as a share of it at full cover */
const CLOUD_BAND_SHARE = 0.18;
const CLOUD_BAND_OPACITY = 0.28;
const RAIN_FULL_MM = 4;
const RAIN_BAR_SHARE = 0.25;
const RAIN_BAR_MIN = 3;
const RAIN_BAR_GAP = 1;
const RAIN_BAR_RADIUS = 2;
const RAIN_BAR_MIN_OPACITY = 0.25;
const TEMP_BAND_TOP = 0.5;
const TEMP_BAND_BOTTOM = 0.74;
const TEMP_MIN_RANGE = 6;
const SAMPLE_LABEL_GAP = 34;
const SKY_ROW = 12;
const WIND_ARROW_ROW = 30;
const MDI_ARROW_RIGHT = String.fromCodePoint(0xf0054);
const MDI_BURST = String.fromCodePoint(0xf059e);
const BURST_COLOR = '#D7263D';

const textPaint = new Paint();
textPaint.setFontWeight('bold');
textPaint.setTextAlign(Align.CENTER);
// the figures read over the fill and the bars: a halo of the background colour round them
const haloPaint = new Paint();
haloPaint.setFontWeight('bold');
haloPaint.setTextAlign(Align.CENTER);
haloPaint.setStyle(Style.STROKE);
haloPaint.setStrokeWidth(3);
const glyphPaint = new Paint();
glyphPaint.setTextAlign(Align.CENTER);
const linePaint = new Paint();
linePaint.setStyle(Style.STROKE);
linePaint.setStrokeWidth(2.5);
linePaint.setStrokeCap(Cap.ROUND);
linePaint.setStrokeJoin(Join.ROUND);
const fillPaint = new Paint();
fillPaint.setStyle(Style.FILL);
const cloudPath = new Path();

function drawText(canvas: Canvas, text: string, pointX: number, pointY: number) {
    canvas.drawText(text, pointX, pointY, haloPaint);
    canvas.drawText(text, pointX, pointY, textPaint);
}

// the cloud cover as a soft band from the top of the plot, deeper the more of the sky is covered, as oss-weather fills it. Under the rest
function drawCloud(canvas: Canvas, profile: ProfileWeather, view: ProfileView) {
    if (view.isEInk || !profile.cloud.length) {
        return;
    }
    const { contentLeft, contentRight, contentTop, pixelX } = view;
    const maxDepth = (view.contentBottom - contentTop) * CLOUD_BAND_SHARE;
    const depth = (value: number) => (Math.max(0, Math.min(100, value)) / 100) * maxDepth;
    const first = profile.cloud[0];
    const last = profile.cloud[profile.cloud.length - 1];
    cloudPath.reset();
    cloudPath.moveTo(contentLeft, contentTop);
    cloudPath.lineTo(contentLeft, contentTop + depth(first.value));
    profile.cloud.forEach(({ d: distance, value }) => cloudPath.lineTo(Math.min(contentRight, Math.max(contentLeft, pixelX(distance))), contentTop + depth(value)));
    cloudPath.lineTo(contentRight, contentTop + depth(last.value));
    cloudPath.lineTo(contentRight, contentTop);
    cloudPath.close();
    fillPaint.color = tint(CLOUD_GRAY, CLOUD_BAND_OPACITY);
    canvas.drawPath(cloudPath, fillPaint);
}

function drawRain(canvas: Canvas, profile: ProfileWeather, view: ProfileView) {
    const plotHeight = view.contentBottom - view.contentTop;
    for (const { from, mmPerHour, probability, to } of profile.rain) {
        const left = Math.max(view.contentLeft, view.pixelX(from));
        const right = Math.min(view.contentRight, view.pixelX(to));
        if (right - RAIN_BAR_GAP <= left) {
            continue;
        }
        const height = Math.max(RAIN_BAR_MIN, Math.min(1, mmPerHour / RAIN_FULL_MM) * plotHeight * RAIN_BAR_SHARE);
        // the chance is the opacity; e-ink has no opacity to give: its bars are black
        fillPaint.color = view.isEInk ? '#000000' : new Color(RAIN_BLUE).setAlpha(Math.round(255 * Math.max(RAIN_BAR_MIN_OPACITY, probability))).hex;
        canvas.drawRoundRect(left, view.contentBottom - height, right - RAIN_BAR_GAP, view.contentBottom, RAIN_BAR_RADIUS, RAIN_BAR_RADIUS, fillPaint);
    }
}

// a row of the sky then a row of the wind at each sample while there is room for it
function drawSkyAndWind(canvas: Canvas, profile: ProfileWeather, view: ProfileView, fontSize: number, format: WeatherFormat) {
    const { contentLeft, contentRight, contentTop, fontScale, ink, isEInk, pixelX } = view;
    let lastSky = -Infinity;
    profile.temp.forEach(({ d: distance, glyph }) => {
        const pointX = pixelX(distance);
        if (pointX >= contentLeft && pointX <= contentRight && pointX - lastSky >= SAMPLE_LABEL_GAP * fontScale) {
            lastSky = pointX;
            glyphPaint.setTextSize(15 * fontScale);
            glyphPaint.color = ink;
            canvas.drawText(glyph, Math.min(Math.max(pointX, contentLeft + 8), contentRight - 8), contentTop + SKY_ROW * fontScale, glyphPaint);
        }
    });
    let lastWind = -Infinity;
    profile.wind.forEach(({ angle, d: distance, gust, head, speed }) => {
        const pointX = pixelX(distance);
        if (pointX < contentLeft || pointX > contentRight || pointX - lastWind < SAMPLE_LABEL_GAP * fontScale) {
            return;
        }
        lastWind = pointX;
        const color = isEInk ? '#000000' : (windColor(head) ?? ink);
        const centerX = Math.min(Math.max(pointX, contentLeft + 8), contentRight - 8);
        const centerY = contentTop + WIND_ARROW_ROW * fontScale;
        const arrowSize = 14 * fontScale;
        // an arrow of the way the wind pushes, the ride going to the right: right is with it, left against it, down to the rider's right
        canvas.save();
        canvas.translate(centerX, centerY);
        canvas.rotate(angle);
        glyphPaint.setTextSize(arrowSize);
        glyphPaint.color = color;
        canvas.drawText(MDI_ARROW_RIGHT, 0, arrowSize * 0.35, glyphPaint);
        canvas.restore();
        textPaint.color = color;
        const speedBaseline = centerY + 8 * fontScale + fontSize;
        drawText(canvas, format.speedNumber(speed), centerX, speedBaseline);
        // a burst: its own line, the glyph and the gust, in red
        if (gust >= profile.gustMin) {
            const text = format.speedNumber(gust);
            const burstColor = isEInk ? '#000000' : BURST_COLOR;
            textPaint.color = burstColor;
            const width = textPaint.measureText(text);
            drawText(canvas, text, centerX + 6 * fontScale, speedBaseline + fontSize + 1);
            glyphPaint.setTextSize(11 * fontScale);
            glyphPaint.color = burstColor;
            canvas.drawText(MDI_BURST, centerX + 6 * fontScale - width / 2 - 7 * fontScale, speedBaseline + fontSize + 1, glyphPaint);
        }
    });
}

function drawTemperature(canvas: Canvas, profile: ProfileWeather, view: ProfileView, fontSize: number, format: WeatherFormat) {
    if (!profile.temp.length) {
        return;
    }
    const { contentBottom, contentLeft, contentRight, contentTop, fontScale, ink, isEInk, pixelX } = view;
    const plotHeight = contentBottom - contentTop;
    const values = profile.temp.map(({ value }) => value);
    const lowest = Math.min(...values);
    const range = Math.max(TEMP_MIN_RANGE, Math.max(...values) - lowest);
    const bandTop = contentTop + plotHeight * TEMP_BAND_TOP;
    const bandBottom = contentTop + plotHeight * TEMP_BAND_BOTTOM;
    const points = profile.temp.map(({ d: distance, value }) => ({ pointX: pixelX(distance), pointY: bandBottom - ((value - lowest) / range) * (bandBottom - bandTop), value }));
    linePaint.color = isEInk ? '#000000' : TEMP_LINE;
    for (let index = 1; index < points.length; index++) {
        canvas.drawLine(points[index - 1].pointX, points[index - 1].pointY, points[index].pointX, points[index].pointY, linePaint);
    }
    let lastLabel = -Infinity;
    let lastText = '';
    points.forEach(({ pointX, pointY, value }, index) => {
        if (pointX < contentLeft || pointX > contentRight) {
            return;
        }
        fillPaint.color = '#ffffff';
        canvas.drawCircle(pointX, pointY, 5, fillPaint);
        fillPaint.color = isEInk ? '#000000' : TEMP_LINE;
        canvas.drawCircle(pointX, pointY, 3.5, fillPaint);
        // only what changes is said: a figure that is the one before is left out, the dot says it
        const text = format.temperature(value);
        if (text !== lastText && pointX - lastLabel >= SAMPLE_LABEL_GAP * fontScale) {
            lastLabel = pointX;
            lastText = text;
            // above a peak, below a dip
            const dip = index > 0 && index < points.length - 1 && value < points[index - 1].value && value < points[index + 1].value;
            textPaint.color = ink;
            drawText(canvas, text, Math.min(Math.max(pointX, contentLeft + 12), contentRight - 12), dip ? pointY + 8 + fontSize : pointY - 8);
        }
    });
}

/** The weather of a route, to hand to the profile chart. */
export function weatherProfileOverlay(profile: ProfileWeather, format: WeatherFormat): ProfileOverlay {
    return {
        draw(canvas, view) {
            const fontSize = 10 * view.fontScale;
            textPaint.setTextSize(fontSize);
            haloPaint.setTextSize(fontSize);
            haloPaint.color = view.isEInk ? '#ffffff' : view.background;
            glyphPaint.fontFamily = view.iconFontFamily;
            drawCloud(canvas, profile, view);
            drawRain(canvas, profile, view);
            drawSkyAndWind(canvas, profile, view, fontSize, format);
            drawTemperature(canvas, profile, view, fontSize, format);
        }
    };
}
