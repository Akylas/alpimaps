import { Canvas, Paint, Rect, RectF, createRectF } from '@nativescript-community/ui-canvas';
import Shape, {
    colorProperty,
    lengthProperty,
    numberProperty,
    percentLengthProperty,
    stringProperty
} from '@nativescript-community/ui-canvas/shapes/shape';
import { Length, PercentLength, zeroLength } from '@nativescript/core/ui/styling/style-properties';
import { Color } from '@nativescript/core';
import { layout } from '@nativescript/core/utils/utils';
import { osmicon } from '~/helpers/formatter';

const paint = new Paint();
paint.setFontFamily('osm');
paint.setTextSize(34);

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
        paint.setColor(array[1]);
        canvas.drawRect(left, top, left + width, height + top, paint);
        if (length > 2) {
            const foreground = array[2];
            const foregroundArray = foreground.split('_');
            const color = foregroundArray.length > 1 ? foregroundArray[0] : 'white';
            paint.setColor(color);
            const shape = foregroundArray[foregroundArray.length - 1];
            const icon = osmicon('symbol-' + shape);
            if (icon) {
                canvas.drawText(icon, 0, 1, left, height + top, paint);
            }
        }
    }
}
