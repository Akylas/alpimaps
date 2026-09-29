// Settings rows drawn as grouped cards: each run of rows between section headers becomes one
// rounded card, drawn by the row itself so the shared settings page needs no change.
import { Canvas, CanvasView, Direction, Paint, Path, Style } from '@nativescript-community/ui-canvas';
import { get } from 'svelte/store';
import { isEInk } from '~/helpers/theme';
import { colors } from '~/variables';

/** Distance from the screen edge to the card, and from the card to the row text. */
export const CARD_INSET = 12;
export const CARD_PADDING = 16;
const CARD_RADIUS = 16;

const NOT_IN_CARD = ['header', 'sectionheader'];

const fillPaint = new Paint();
const strokePaint = new Paint();
strokePaint.style = Style.STROKE;
strokePaint.strokeWidth = 1;

// The row's own background is the card colour: onDraw runs after the row's children, so a card
// filled here would cover the text. The page colour is painted around the card instead.
function drawCardRow(first: boolean, last: boolean, withIcon: boolean, { canvas }: { canvas: Canvas; object: CanvasView }) {
    const { colorCanvas, colorHairline } = get(colors);
    const width = canvas.getWidth();
    const height = canvas.getHeight();
    const top = first ? 4 : 0;
    const bottom = last ? height - 4 : height;
    const topRadius = first ? CARD_RADIUS : 0;
    const bottomRadius = last ? CARD_RADIUS : 0;
    const path = new Path();
    path.addRoundRect(CARD_INSET, top, width - CARD_INSET, bottom, [topRadius, topRadius, topRadius, topRadius, bottomRadius, bottomRadius, bottomRadius, bottomRadius], Direction.CW);
    path.toggleInverseFillType();
    fillPaint.color = colorCanvas;
    canvas.drawPath(path, fillPaint);
    path.toggleInverseFillType();
    if (isEInk) {
        strokePaint.color = colorHairline;
        canvas.drawPath(path, strokePaint);
    }
    if (!last) {
        strokePaint.color = colorHairline;
        // from the text: an icon tile sits in the padding (40 wide, 14 before the text)
        canvas.drawLine(CARD_INSET + CARD_PADDING + (withIcon ? 54 : 0), height - 0.5, width - CARD_INSET, height - 0.5, strokePaint);
    }
}

/** Marks each row with its place in its card; header rows are left as they are. */
export function groupRows<T extends { type?: string; icon?: string; onDraw?: Function }>(rows: T[]): T[] {
    return rows.map((row, index) => {
        if (NOT_IN_CARD.includes(row.type)) {
            return row;
        }
        const previous = rows[index - 1];
        const next = rows[index + 1];
        const first = !previous || NOT_IN_CARD.includes(previous.type);
        const last = !next || NOT_IN_CARD.includes(next.type);
        return { ...row, onDraw: (_item, event) => drawCardRow(first, last, !!row.icon, event) };
    });
}
