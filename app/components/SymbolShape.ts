import { Utils } from '@nativescript/core';
import { Align, Canvas, Direction, Paint, Path, Style } from '@nativescript-community/ui-canvas';
import Shape, { colorProperty, lengthProperty, stringProperty } from '@nativescript-community/ui-canvas/shapes/shape';
import { Color, CoreTypes, Length, PercentLength } from '@nativescript/core';
import { osmicon } from '~/helpers/formatter';

const specialShapes = ['shell_modern', 'triangle_turned', 'triangle_line', 'rectangle_line', 'red_diamond', 'drop_line', 'diamond_line', 'urned_T', 'white_foot'];

const shapepaint = new Paint();
shapepaint.setFontFamily('osm');
shapepaint.setTextSize(34);
const textpaint = new Paint();
textpaint.setFontWeight('500');
textpaint.setTextSize(18);
textpaint.setTextAlign(Align.CENTER);

const path = new Path();

export default class SymbolShape extends Shape {
    @stringProperty symbol: string;
    @colorProperty({ nonPaintProp: true }) color: Color;
    @lengthProperty left = CoreTypes.zeroLength;
    @lengthProperty top = CoreTypes.zeroLength;
    drawOnCanvas(canvas: Canvas) {
        const availableWidth = layout.toDevicePixels(canvas.getWidth());
        const availableHeight = layout.toDevicePixels(canvas.getHeight());
        const width = Utils.layout.toDeviceIndependentPixels(PercentLength.toDevicePixels(this.width, 0, availableWidth));
        const height = Utils.layout.toDeviceIndependentPixels(PercentLength.toDevicePixels(this.height, 0, availableHeight));
        const left = Utils.layout.toDeviceIndependentPixels(Length.toDevicePixels(this.left));
        const top = Utils.layout.toDeviceIndependentPixels(Length.toDevicePixels(this.top));
        const symbol = this.symbol || `blue:white:${this.color || 'blue'}_bar`;
        path.reset();
        path.addRoundRect(left, top, left + width, height + top, 3, 3, Direction.CW);

        canvas.clipPath(path);
        try {
            const [waycolor, background, ...others] = symbol.split(':');
            if (background !== 'none') {
                const [backgroundColor, form] = background.split('_');
                shapepaint.setColor(backgroundColor);
                if (form === 'round') {
                    canvas.drawOval(left, top, left + width, height + top, shapepaint);
                } else if (form === 'circle') {
                    shapepaint.setStyle(Style.STROKE);
                    canvas.drawOval(left, top, left + width, height + top, shapepaint);
                    shapepaint.setStyle(Style.FILL);
                } else if (form === 'frame') {
                    shapepaint.setStyle(Style.STROKE);
                    canvas.drawRect(left, top, left + width, height + top, shapepaint);
                    shapepaint.setStyle(Style.FILL);
                } else {
                    canvas.drawRect(left, top, left + width, height + top, shapepaint);
                }
            }
            const length = others.length;
            if (length > 0) {
                const foreground = others[0];
                const hasSymbol = foreground.indexOf('_') !== -1;
                const textIndex = hasSymbol || length > 2 ? 1 : 0;
                if (hasSymbol) {
                    //we have a shape
                    const foregroundArray = foreground.split('_');
                    let shape;
                    if (foregroundArray.length === 2 && specialShapes.indexOf(foreground) !== -1) {
                        shapepaint.setColor('white');
                        shape = foreground;
                    } else {
                        const color = foregroundArray.length > 1 ? foregroundArray[0] : foreground || 'white';
                        shapepaint.setColor(color);
                        shape = foregroundArray[foregroundArray.length - 1];
                    }
                    if (shape.length > 1) {
                        canvas.drawText(osmicon('symbol-' + shape), left, height + top - 2, shapepaint);
                    } else {
                        canvas.drawText(shape, left + 9, height / 2 + top + 9, shapepaint);
                    }
                }
                if (others[textIndex]?.length) {
                    try {
                        textpaint.setColor(others[textIndex + 1] || 'black');
                    } catch (error) {
                        console.error('error setting text paint', error);

                        textpaint.setColor('black');
                    }
                    canvas.drawText(others[textIndex], left + width / 2, height / 2 + top + 7, textpaint);
                }
            }
        } catch (error) {
            console.error(error, error.stack);
        }
    }
}
