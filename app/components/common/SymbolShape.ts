import { Align, Canvas, Direction, LayoutAlignment, Paint, Path, StaticLayout, Style } from '@nativescript-community/ui-canvas';
import Shape, { colorProperty, lengthProperty, numberProperty, stringProperty } from '@nativescript-community/ui-canvas/shapes/shape';
import { Color, CoreTypes, Length, PercentLength, Utils } from '@nativescript/core';
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
    @numberProperty scale = 1;
    @numberProperty maxFontSize = 18;
    @stringProperty symbol: string;
    @colorProperty({ nonPaintProp: true }) color: Color;
    @lengthProperty left = CoreTypes.zeroLength;
    @lengthProperty top = CoreTypes.zeroLength;
    drawOnCanvas(canvas: Canvas) {
        SymbolShape.drawSymbolOnCanvas(canvas, {
            width: this.width,
            height: this.height,
            left: this.left,
            top: this.top,
            color: this.color,
            scale: this.scale,
            symbol: this.symbol,
            maxFontSize: this.maxFontSize
        });
    }

    static drawSymbolOnCanvas(canvas: Canvas, args: { symbol; left; top; width; height; color; scale; maxFontSize }) {
        const availableWidth = Utils.layout.toDevicePixels(canvas.getWidth());
        const availableHeight = Utils.layout.toDevicePixels(canvas.getHeight());
        const width = Utils.layout.toDeviceIndependentPixels(PercentLength.toDevicePixels(args.width, 0, availableWidth));
        const height = Utils.layout.toDeviceIndependentPixels(PercentLength.toDevicePixels(args.height, 0, availableHeight));
        const left = Utils.layout.toDeviceIndependentPixels(Length.toDevicePixels(args.left));
        const top = Utils.layout.toDeviceIndependentPixels(Length.toDevicePixels(args.top));
        const symbol = args.symbol || `blue:white:${args.color || 'blue'}_bar`;
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
                        const text = shape;
                        canvas.drawText(text, left + 9, height / 2 + top + 9, shapepaint);
                    }
                }
                if (others[textIndex]?.length) {
                    try {
                        textpaint.setColor(others[textIndex + 1] || 'black');
                    } catch (error) {
                        console.error('error setting text paint', error);

                        textpaint.setColor('black');
                    }
                    const text = others[textIndex];
                    const textLength = text.length;
                    if (textLength <= 3) {
                        textpaint.setTextSize(18);
                        canvas.drawText(text, left + width / 2, height / 2 + top + 7, textpaint);
                    } else {
                        const delta = Math.min(Math.max(text.length - 3, 0), 3);
                        const fontSize = Math.max((18 - 2 * delta) * args.scale, args.maxFontSize);
                        textpaint.setTextSize(fontSize);

                        const staticLayout = new StaticLayout(text, textpaint, width, LayoutAlignment.ALIGN_NORMAL, 1, 0, true);
                        const textheight = staticLayout.getHeight();
                        // staticLayout = new StaticLayout(text, textPaint, itemWidth, LayoutAlignment.ALIGN_CENTER, 1, 0, true);
                        canvas.save();
                        canvas.translate(left + width / 2, height / 2 + top - textheight / 2);
                        staticLayout.draw(canvas);
                        canvas.restore();
                        // canvas.drawText(text, left + width / 2, height / 2 + top + 7 - delta / 2, textpaint);
                    }
                }
            }
        } catch (error) {
            console.error(error, error.stack);
        }
    }
}
