/**
 * What the weather draws over the profile, in the manner of a weather chart: rain as light rounded bars from the foot, one at each label of the x axis, as high as the rain (its square root over 1 mm/h) and as
 * plain as the chance of it, never wider than a cap; the sky and the temperature as a line with a ringed dot, at each label of the x axis and its figure above
 * a peak, below a dip; the sky, in the room the chart leaves over the plot, and over the plot a row of the wind: an arrow of the way it pushes, the ride going to the right,
 * and its speed under it, a burst on a line of its own.
 */
import { Align, type Canvas, Cap, Join, Paint, Path, Style } from '@nativescript-community/ui-canvas';
import type { ProfileOverlay, ProfileView } from '~/routeFeatures/registry';
import type { WeatherFormat } from '~/routeFeatures/weather/data/format';
import { type ProfileWeather, rainAtDistance, skyAtDistance } from '~/routeFeatures/weather/data/read';
import { CLOUD_GRAY, RAIN_BAR_BLUE, SUN_COLOR, TEMP_LINE, rainBarOpacity, rainBarWeight, tint, windColor } from '~/routeFeatures/weather/ui/colors';

/** the sky is a band from the top of the plot: as deep as a share of it */
const CLOUD_BAND_SHARE = 0.18;
const CLOUD_BAND_OPACITY = 0.28;
const SUN_BAND_OPACITY = 0.3;
const RAIN_FULL_MM = 4;
const RAIN_BAR_SHARE = 0.35;
const RAIN_BAR_MIN = 6;
/** dp: a bar never gets wider, however short the stretch of the ride it stands for */
const RAIN_BAR_MAX_WIDTH = 22;
const RAIN_BAR_RADIUS = 4;
const TEMP_BAND_TOP = 0.5;
const TEMP_BAND_BOTTOM = 0.74;
const TEMP_MIN_RANGE = 6;
const SAMPLE_LABEL_GAP = 34;
/** px: a label at the very edge of the plot is on it, whatever the rounding */
const EDGE_TOLERANCE = 0.5;
const SKY_ROW = 12;
const WIND_ARROW_ROW = 30;
/** dp of room over the plot from which the sky is drawn there, in the room the chart leaves for its brackets */
const SKY_HEADROOM_MIN = 18;
const SKY_HEADROOM_GAP = 2;
/** the wind starts at the top of the plot when the sky is over it */
const WIND_ARROW_ROW_UNDER_SKY = 12;
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

// where the sky is: in the room over the plot when the chart leaves some, as the plot is then the ride's alone, else a band from the top of the plot
function skyRoom({ contentBottom, contentTop, fontScale }: ProfileView) {
    const headroom = contentTop >= SKY_HEADROOM_MIN * fontScale;
    return headroom
        ? { headroom, top: SKY_HEADROOM_GAP, bottom: contentTop - SKY_HEADROOM_GAP }
        : { headroom, top: contentTop, bottom: contentTop + (contentBottom - contentTop) * CLOUD_BAND_SHARE };
}

// the sky as a soft band, a gauge of it: the cloud as deep as the sky is covered, the sun in the colour of the sun
// under it, as deep as it is clear, as oss-weather fills its cloud cover. Under the rest
function drawSky(canvas: Canvas, profile: ProfileWeather, view: ProfileView) {
    if (view.isEInk || !profile.cloud.length) {
        return;
    }
    const { contentLeft, contentRight, pixelX } = view;
    const { bottom, top } = skyRoom(view);
    const maxDepth = bottom - top;
    const share = (value: number) => Math.max(0, Math.min(100, value)) / 100;
    const points = [
        { pointX: contentLeft, value: profile.cloud[0].value },
        ...profile.cloud.map(({ d: distance, value }) => ({ pointX: Math.min(contentRight, Math.max(contentLeft, pixelX(distance))), value })),
        { pointX: contentRight, value: profile.cloud[profile.cloud.length - 1].value }
    ];
    // the cloud: from the top down to its depth
    cloudPath.reset();
    cloudPath.moveTo(contentLeft, top);
    points.forEach(({ pointX, value }) => cloudPath.lineTo(pointX, top + share(value) * maxDepth));
    cloudPath.lineTo(contentRight, top);
    cloudPath.close();
    fillPaint.color = tint(CLOUD_GRAY, CLOUD_BAND_OPACITY);
    canvas.drawPath(cloudPath, fillPaint);
    // the sun: from the cloud's depth down to the foot of the band
    cloudPath.reset();
    cloudPath.moveTo(contentLeft, top + maxDepth);
    points.forEach(({ pointX, value }) => cloudPath.lineTo(pointX, top + share(value) * maxDepth));
    cloudPath.lineTo(contentRight, top + maxDepth);
    cloudPath.close();
    fillPaint.color = tint(SUN_COLOR, SUN_BAND_OPACITY);
    canvas.drawPath(cloudPath, fillPaint);
}

// a bar at each label of the x axis, as oss-weather has one for each of its hours: the rain at that distance. Without labels, one in the
// middle of each stretch of rain
function drawRain(canvas: Canvas, profile: ProfileWeather, view: ProfileView) {
    const { contentBottom, contentLeft, contentRight, contentTop, isEInk, pixelX, xTicks } = view;
    const plotHeight = contentBottom - contentTop;
    const width = RAIN_BAR_MAX_WIDTH * view.fontScale;
    const bars = xTicks.length
        ? xTicks.flatMap((distance) => {
              const stretch = rainAtDistance(profile.rain, distance);
              return stretch ? [{ ...stretch, center: pixelX(distance) }] : [];
          })
        : profile.rain.map((stretch) => ({ ...stretch, center: (pixelX(stretch.from) + pixelX(stretch.to)) / 2 }));
    for (const { center, mmPerHour, probability } of bars) {
        // kept in the plot: the bars of its two ends are whole
        const left = Math.max(contentLeft, Math.min(contentRight - width, center - width / 2));
        const height = Math.max(RAIN_BAR_MIN, Math.min(1, rainBarWeight(mmPerHour) / Math.sqrt(RAIN_FULL_MM)) * plotHeight * RAIN_BAR_SHARE);
        // the chance is the opacity; e-ink has no opacity to give: its bars are black
        fillPaint.color = isEInk ? '#000000' : tint(RAIN_BAR_BLUE, rainBarOpacity(probability));
        canvas.drawRoundRect(left, contentBottom - height, left + width, contentBottom, RAIN_BAR_RADIUS, RAIN_BAR_RADIUS, fillPaint);
    }
}

type SkyPoint = { d: number; value: number; glyph: string };

// the sky at each label of the x axis, as oss-weather has one for each of its hours: the temperature on the line between the samples round
// it, the glyph of the nearest. Without labels, the samples
function skyPoints(profile: ProfileWeather, view: ProfileView): SkyPoint[] {
    if (!view.xTicks.length) {
        return profile.temp;
    }
    return view.xTicks.flatMap((distance) => {
        const sky = skyAtDistance(profile.temp, distance);
        return sky ? [{ d: distance, ...sky }] : [];
    });
}

// a row of the sky then a row of the wind at each sample while there is room for it
function drawSkyAndWind(canvas: Canvas, profile: ProfileWeather, skies: SkyPoint[], view: ProfileView, fontSize: number, format: WeatherFormat) {
    const { contentLeft, contentRight, contentTop, fontScale, ink, isEInk, pixelX } = view;
    const room = skyRoom(view);
    const glyphSize = 15 * fontScale;
    const glyphBaseline = room.headroom ? (room.top + room.bottom) / 2 + glyphSize * 0.35 : contentTop + SKY_ROW * fontScale;
    let lastSky = -Infinity;
    skies.forEach(({ d: distance, glyph }) => {
        const pointX = pixelX(distance);
        if (pointX >= contentLeft - EDGE_TOLERANCE && pointX <= contentRight + EDGE_TOLERANCE && pointX - lastSky >= SAMPLE_LABEL_GAP * fontScale) {
            lastSky = pointX;
            glyphPaint.setTextSize(glyphSize);
            glyphPaint.color = ink;
            canvas.drawText(glyph, Math.min(Math.max(pointX, contentLeft + 8), contentRight - 8), glyphBaseline, glyphPaint);
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
        const centerY = contentTop + (room.headroom ? WIND_ARROW_ROW_UNDER_SKY : WIND_ARROW_ROW) * fontScale;
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

function drawTemperature(canvas: Canvas, skies: SkyPoint[], view: ProfileView, fontSize: number, format: WeatherFormat) {
    if (!skies.length) {
        return;
    }
    const { contentBottom, contentLeft, contentRight, contentTop, fontScale, ink, isEInk, pixelX } = view;
    const plotHeight = contentBottom - contentTop;
    const values = skies.map(({ value }) => value);
    const lowest = Math.min(...values);
    const range = Math.max(TEMP_MIN_RANGE, Math.max(...values) - lowest);
    const bandTop = contentTop + plotHeight * TEMP_BAND_TOP;
    const bandBottom = contentTop + plotHeight * TEMP_BAND_BOTTOM;
    const points = skies.map(({ d: distance, value }) => ({ pointX: pixelX(distance), pointY: bandBottom - ((value - lowest) / range) * (bandBottom - bandTop), value }));
    linePaint.color = isEInk ? '#000000' : TEMP_LINE;
    for (let index = 1; index < points.length; index++) {
        canvas.drawLine(points[index - 1].pointX, points[index - 1].pointY, points[index].pointX, points[index].pointY, linePaint);
    }
    let lastLabel = -Infinity;
    points.forEach(({ pointX, pointY, value }, index) => {
        if (pointX < contentLeft - EDGE_TOLERANCE || pointX > contentRight + EDGE_TOLERANCE) {
            return;
        }
        fillPaint.color = '#ffffff';
        canvas.drawCircle(pointX, pointY, 5, fillPaint);
        fillPaint.color = isEInk ? '#000000' : TEMP_LINE;
        canvas.drawCircle(pointX, pointY, 3.5, fillPaint);
        const text = format.temperature(value);
        if (pointX - lastLabel >= SAMPLE_LABEL_GAP * fontScale) {
            lastLabel = pointX;
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
            drawSky(canvas, profile, view);
            drawRain(canvas, profile, view);
            const skies = skyPoints(profile, view);
            drawSkyAndWind(canvas, profile, skies, view, fontSize, format);
            drawTemperature(canvas, skies, view, fontSize, format);
        }
    };
}
