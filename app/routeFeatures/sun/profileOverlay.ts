/**
 * What the sun draws over the profile: a ribbon along the foot of the plot, a stretch for each class of the sun in the colour of the lens,
 * and the sun going down as a dashed line with its glyph at the top. On e-ink the ribbon is the greys of the lens in a black outline.
 */
import { Align, DashPathEffect, Paint, Style } from '@nativescript-community/ui-canvas';
import type { ProfileOverlay } from '~/routeFeatures/registry';
import type { SunRead } from '~/routeFeatures/sun/read';

const RIBBON_HEIGHT = 4;
const SUNSET_GLYPH_ROW = 12;
const MDI_SUNSET_DOWN = String.fromCodePoint(0xf059b);

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
export function sunProfileOverlay(read: Pick<SunRead, 'runs' | 'summary'>, colors: (isEInk: boolean) => Record<string, string>): ProfileOverlay {
    return {
        draw(canvas, view) {
            const { contentBottom, contentLeft, contentRight, contentTop, fontScale, ink, isEInk, pixelX } = view;
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
            const { sunset } = read.summary;
            if (sunset) {
                const pointX = pixelX(sunset.distance);
                if (pointX >= contentLeft && pointX <= contentRight) {
                    linePaint.color = isEInk ? '#000000' : ink;
                    canvas.drawLine(pointX, contentTop + SUNSET_GLYPH_ROW * fontScale, pointX, contentBottom - height, linePaint);
                    glyphPaint.fontFamily = view.iconFontFamily;
                    glyphPaint.setTextSize(14 * fontScale);
                    glyphPaint.color = isEInk ? '#000000' : ink;
                    canvas.drawText(MDI_SUNSET_DOWN, Math.min(Math.max(pointX, contentLeft + 8), contentRight - 8), contentTop + SUNSET_GLYPH_ROW * fontScale, glyphPaint);
                }
            }
        }
    };
}
