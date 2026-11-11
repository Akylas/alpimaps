/**
 * What the sun draws over the profile: a ribbon along the foot of the plot, a stretch for each class of the sun in the colour of the lens,
 * and the sun rising and going down, and the moon in the dark, as dashed lines in their colours, with their glyph at the top. On e-ink the ribbon is the greys of the lens in a black outline.
 */
import { Align, DashPathEffect, Paint, Style } from '@nativescript-community/ui-canvas';
import type { ProfileOverlay } from '~/routeFeatures/registry';
import { SUN_COLORS } from '~/routeFeatures/sun/colors';
import type { SunRead } from '~/routeFeatures/sun/read';
import { rideMoonEvents } from '~/routeFeatures/sun/symbols';

const RIBBON_HEIGHT = 4;
const GLYPH_ROW = 12;
const MDI_SUNSET_DOWN = String.fromCodePoint(0xf059b);
const MDI_SUNSET_UP = String.fromCodePoint(0xf059c);
const MDI_MOON_WAXING_CRESCENT = String.fromCodePoint(0xf0f67);
const MDI_MOON_WANING_CRESCENT = String.fromCodePoint(0xf0f65);

const fillPaint = new Paint();
fillPaint.setStyle(Style.FILL);
const outlinePaint = new Paint();
outlinePaint.setStyle(Style.STROKE);
outlinePaint.setStrokeWidth(1);
const linePaint = new Paint();
linePaint.setStyle(Style.STROKE);
linePaint.setStrokeWidth(1.5);
linePaint.setPathEffect(new DashPathEffect([6, 4], 0));
const glyphPaint = new Paint();
glyphPaint.setTextAlign(Align.CENTER);

/** The sun of a route, to hand to the profile chart. `colors` is the lens palette for a theme: a map of the classes' keys to colours. */
export function sunProfileOverlay(read: SunRead, colors: (isEInk: boolean) => Record<string, string>): ProfileOverlay {
    const { sunrise, sunset } = read.summary;
    const moon = rideMoonEvents(read);
    // where each is on the ride, in metres, as the lines are drawn
    const marks = [
        { distance: sunrise?.distance, glyph: MDI_SUNSET_UP, color: SUN_COLORS.sunrise },
        { distance: sunset?.distance, glyph: MDI_SUNSET_DOWN, color: SUN_COLORS.sunset },
        ...moon.map(({ distance, id }) => ({ distance, glyph: id === 'moonrise' ? MDI_MOON_WAXING_CRESCENT : MDI_MOON_WANING_CRESCENT, color: SUN_COLORS.moon }))
    ];
    return {
        draw(canvas, view) {
            const { contentBottom, contentLeft, contentRight, contentTop, fontScale, isEInk, pixelX } = view;
            const palette = colors(isEInk);
            const height = RIBBON_HEIGHT * fontScale;
            read.runs.forEach(({ from, k, to }) => {
                const left = Math.max(contentLeft, pixelX(from));
                const right = Math.min(contentRight, pixelX(to));
                if (right > left && palette[k]) {
                    fillPaint.color = palette[k];
                    canvas.drawRect(left, contentBottom - height, right, contentBottom, fillPaint);
                }
            });
            if (isEInk) {
                outlinePaint.color = '#000000';
                canvas.drawRect(contentLeft, contentBottom - height, contentRight, contentBottom, outlinePaint);
            }
            marks.forEach(({ color, distance, glyph }) => {
                if (distance === undefined) {
                    return;
                }
                const pointX = pixelX(distance);
                if (pointX < contentLeft || pointX > contentRight) {
                    return;
                }
                // e-ink has no colour to give
                const stroke = isEInk ? '#000000' : color;
                linePaint.color = stroke;
                canvas.drawLine(pointX, contentTop + GLYPH_ROW * fontScale, pointX, contentBottom - height, linePaint);
                glyphPaint.fontFamily = view.iconFontFamily;
                glyphPaint.setTextSize(14 * fontScale);
                glyphPaint.color = stroke;
                canvas.drawText(glyph, Math.min(Math.max(pointX, contentLeft + 8), contentRight - 8), contentTop + GLYPH_ROW * fontScale, glyphPaint);
            });
        }
    };
}
