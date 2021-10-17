import { Align, Canvas, Paint, Rect, RectF, Style, createRectF } from '@nativescript-community/ui-canvas';
import Shape, { colorProperty, lengthProperty, numberProperty, percentLengthProperty, stringProperty } from '@nativescript-community/ui-canvas/shapes/shape';
import { Length, PercentLength, zeroLength } from '@nativescript/core/ui/styling/style-properties';
import { Color } from '@nativescript/core';
import { layout } from '@nativescript/core/utils/utils';
import { osmicon } from '~/helpers/formatter';

const specialShapes = ['shell_modern', 'triangle_turned', 'triangle_line', 'rectangle_line', 'red_diamond', 'drop_line', 'diamond_line', 'urned_T', 'white_foot'];

const shapepaint = new Paint();
shapepaint.setFontFamily('osm');
shapepaint.setTextSize(34);
const textpaint = new Paint();
textpaint.setFontWeight('500');
textpaint.setTextSize(18);
textpaint.setAntiAlias(true);
textpaint.setTextAlign(Align.CENTER);

export default class SymbolShape extends Shape {
    @stringProperty symbol: string;
    @colorProperty({ nonPaintProp: true }) color: Color;
    @lengthProperty left = zeroLength;
    @lengthProperty top = zeroLength;
    drawOnCanvas(canvas: Canvas) {
        const availableWidth = layout.toDevicePixels(canvas.getWidth());
        const availableHeight = layout.toDevicePixels(canvas.getHeight());
        const width = layout.toDeviceIndependentPixels(PercentLength.toDevicePixels(this.width, 0, availableWidth));
        const height = layout.toDeviceIndependentPixels(PercentLength.toDevicePixels(this.height, 0, availableHeight));
        const left = layout.toDeviceIndependentPixels(Length.toDevicePixels(this.left));
        const top = layout.toDeviceIndependentPixels(Length.toDevicePixels(this.top));
        const symbol = this.symbol || `blue:white:${this.color || 'blue'}_bar`;
        const array = symbol.split(':');
        const length = array.length;
        if (array[1] !== 'none') {
            const arrayBackColor = array[1].split('_');
            const backgroundColor = arrayBackColor[0];
            shapepaint.setColor(backgroundColor);
            if (arrayBackColor[1] === 'round') {
                canvas.drawOval(left, top, left + width, height + top, shapepaint);
            } else if (arrayBackColor[1] === 'circle') {
                shapepaint.setStyle(Style.STROKE);
                canvas.drawOval(left, top, left + width, height + top, shapepaint);
                shapepaint.setStyle(Style.FILL);
            } else if (arrayBackColor[1] === 'frame') {
                shapepaint.setStyle(Style.STROKE);
                canvas.drawRoundRect(left, top, left + width, height + top, 3, 3, shapepaint);
                shapepaint.setStyle(Style.FILL);
            } else {
                canvas.drawRoundRect(left, top, left + width, height + top, 3, 3, shapepaint);
            }
        }
        if (length > 2) {
            const foreground = array[2];
            const foregroundArray = foreground.split('_');
            let shape;
            if (foregroundArray.length === 2 && specialShapes.indexOf(foreground) !== -1) {
                shapepaint.setColor('white');
                shape = foreground;
            } else {
                const color = foregroundArray.length > 1 ? foregroundArray[0] : foreground || 'white';
                shapepaint.setColor(color);
                shape = foregroundArray.at(-1);
            }
            if (shape) {
                canvas.drawText(osmicon('symbol-' + shape), left, height + top - 2, shapepaint);
            } else if (array.length > 3) {
                textpaint.setColor(array.at(-1));
                canvas.drawText(array[array.length - 2], left + width / 2, height / 2 + top + 7, textpaint);
            }
        }
    }
}
