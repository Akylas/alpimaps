<script lang="ts">
    import { packageService } from '~/services/PackageService';
    import { createNativeAttributedString } from '@nativescript-community/text';
    import { Align, Canvas, DashPathEffect, LayoutAlignment, Paint, Path, StaticLayout, Style } from '@nativescript-community/ui-canvas';
    import { LineChart } from '@nativescript-community/ui-chart/charts';
    import type { HighlightEventData } from '@nativescript-community/ui-chart/charts/Chart';
    import { XAxisPosition } from '@nativescript-community/ui-chart/components/XAxis';
    import { AxisDependency } from '@nativescript-community/ui-chart/components/YAxis';
    import { Rounding } from '@nativescript-community/ui-chart/data/DataSet';
    import type { Entry } from '@nativescript-community/ui-chart/data/Entry';
    import { LineData } from '@nativescript-community/ui-chart/data/LineData';
    import { LineDataSet, Mode } from '@nativescript-community/ui-chart/data/LineDataSet';
    import { Highlight } from '@nativescript-community/ui-chart/highlight/Highlight';
    import type { Transformer } from '@nativescript-community/ui-chart/utils/Transformer';
    import { LimitLine } from '@nativescript-community/ui-chart/components/LimitLine';
    import { ApplicationSettings, Color, Utils } from '@nativescript/core';
    import { createEventDispatcher } from '@shared/utils/svelte/ui';
    import { NativeViewElementNode } from '@nativescript-community/svelte-native/dom';
    import { convertDurationSeconds, convertElevation, formatDistance } from '~/helpers/formatter';
    import { getBounds } from '~/helpers/geolib';
    import { isEInk, onThemeChanged } from '~/helpers/theme';
    import { getMapContext } from '~/mapModules/MapModule';
    import type { AscentSegment, IItem as Item } from '~/models/Item';
    import type { AttentionKind, ProfileBracket, ProfileFillStop, ProfileMark } from '~/routeFeatures/registry';
    import { showError } from '@shared/utils/showError';
    import { gradeBucketIndex, gradeColor, gradeShades } from '~/utils/grade';
    import { drawSurfaceBand } from '~/utils/surfacePattern';
    import { colors, fontScale, fonts } from '~/variables';
    import { lc } from '~/helpers/locale';
    import { SDK_VERSION } from '@akylas/nativescript/utils';
    let { colorBackground, colorOnPrimary, colorOnSurface, colorOnSurfaceVariant, colorOutline, colorOutlineVariant, colorPrimary } = $colors;
    $: ({ colorBackground, colorOnPrimary, colorOnSurface, colorOnSurfaceVariant, colorOutline, colorOutlineVariant, colorPrimary } = $colors);

    /** what ui-chart fills a line set with by default, out of 255 */
    const DEFAULT_FILL_ALPHA = 85;
    /** grade sections are read by colour, so their fill has to actually carry one */
    const GRADE_FILL_ALPHA = 225;

    /** km between x labels: whatever gives about four of them */
    const xintervals = [0.1, 0.2, 0.5, 1, 2, 3, 5, 10, 15, 20, 25, 50, 100];
    const X_LABEL_COUNT = 4;
    function closestUpper(arr: number[], target: number): number | undefined {
        return arr.filter((x) => x >= target).sort((a, b) => a - b)[0];
    }

    // the shared dispatcher hands the payload itself to the listener, not a `CustomEvent`
    interface $$Events {
        highlight: { lat: number; lon: number; highlight: Highlight<Entry> };
        /** the cursor's point and, when the sheet knows them, the figures to the end of the route. `null`: no cursor */
        /** a tap on an attention mark: its index in `marks` */
        mark: { index: number };
        cursor: {
            index: number;
            entry: { d: number; a: number; g?: number };
            remainingDistance?: number;
            remainingTime?: number;
            dplus?: number;
            dmin?: number;
        } | null;
    }
    const dispatch = createEventDispatcher<$$Events>();
    const mapContext = getMapContext();

    const cursorPaint = new Paint();
    cursorPaint.setStrokeWidth(1.5);
    const highlightPaint = new Paint();
    highlightPaint.setColor('#aaa');
    highlightPaint.setStrokeWidth(1);
    highlightPaint.setTextSize(10);

    const waypointsBackPaint = new Paint();
    waypointsBackPaint.setColor(colorPrimary);

    const waypointsPaint = new Paint();
    waypointsPaint.fontFamily = 'osm';
    waypointsPaint.setColor(colorOnPrimary);
    waypointsPaint.setTextSize(8);
    waypointsPaint.setTextAlign(Align.CENTER);

    const nstringPaint = new Paint();
    nstringPaint.setColor('#aaa');
    nstringPaint.setStrokeWidth(1);
    nstringPaint.setTextSize(12);

    // chart labels sit on a semi opaque rounded plate, so they read over the grade fill and gridlines
    const plateLabelPaint = new Paint();
    const plateBackPaint = new Paint();
    // TODO(cleanup): the older drawing helpers of this file (this one, the limit line renderers) still name the canvas `c`
    function drawPlatedLabel(c: Canvas, lines: string[], x: number, top: number, paint: Paint, alignRight: boolean) {
        const metrics = paint.getFontMetrics();
        const lineHeight = metrics.descent - metrics.ascent;
        const width = Math.max(...lines.map((line) => paint.measureText(line)));
        const left = alignRight ? x - width : x;
        plateBackPaint.color = new Color(isEInk ? '#ffffff' : colorBackground).setAlpha(210).hex;
        c.drawRoundRect(left - 3, top - 1, left + width + 3, top + lines.length * lineHeight + 1, 4, 4, plateBackPaint);
        const align = paint.getTextAlign();
        paint.setTextAlign(Align.LEFT);
        lines.forEach((line, index) => c.drawText(line, left, top - metrics.ascent + index * lineHeight, paint));
        paint.setTextAlign(align);
    }
    // what the lens lays over the profile: climb brackets over the curve, attention marks in a band under the plot
    const overlayPaint = new Paint();
    overlayPaint.setStyle(Style.STROKE);
    overlayPaint.setStrokeWidth(1.5);
    const overlayFillPaint = new Paint();
    overlayFillPaint.setStyle(Style.FILL);
    const overlayTextPaint = new Paint();
    overlayTextPaint.setFontWeight('bold');
    overlayTextPaint.setTextAlign(Align.LEFT);
    /** how far over the summit a bracket stands, and how tall its ends are */
    const BRACKET_LIFT = 8;
    const BRACKET_END = 5;
    const BRACKET_PLATE_GAP = 3;
    const PLATE_PADDING = 4;
    // the marks lie in the room the axis labels leave under the plot
    const MARK_GAP = 1;
    const MARK_HEIGHT = 3;
    const MARK_TIER_STEP = 2;
    const MARK_MIN_WIDTH = 4;
    /** the room over the plot for the plate of the highest bracket */
    const BRACKET_ROOM = 24;
    /** of the plot's height, the bottom part of it, and what is under it, a tap counts as on the marks */
    const MARK_HIT_HEIGHT = 0.1;
    const MARK_COLORS: Record<AttentionKind, string> = { steep: '#9E1B18' };
    /**
     * A limit line that is none: the axis draws its limit lines last, over the data, the plates and the axis, so
     * this is the way to the top layer. It is added after the plates.
     */
    class OverlayLimitLine extends LimitLine {
        constructor(limit: number) {
            super(limit, '');
        }
    }
    function drawOverlay(canvas: Canvas) {
        const chartView = chart?.nativeView;
        if (!chartView || mini) {
            return;
        }
        const { contentBottom, contentLeft, contentRight, contentTop } = chartView.viewPortHandler;
        const { max, min } = chartView.xAxisRenderer.getCurrentMinMax();
        // the elevations at the plot's foot and top, which a zoom moves
        const axisMinimum = chartView.transformer.getValuesByTouchPoint(contentLeft, contentBottom).y;
        const axisMaximum = chartView.transformer.getValuesByTouchPoint(contentLeft, contentTop).y;
        if (!(max > min) || !(axisMaximum > axisMinimum)) {
            return;
        }
        const pixelX = (distance: number) => contentLeft + ((distance - min) / (max - min)) * (contentRight - contentLeft);
        const pixelY = (elevation: number) => contentBottom - ((elevation - axisMinimum) / (axisMaximum - axisMinimum)) * (contentBottom - contentTop);
        const ink = isEInk ? '#000000' : colorOnSurface;
        overlayPaint.color = ink;
        overlayTextPaint.color = isEInk ? '#ffffff' : colorBackground;
        overlayTextPaint.setTextSize(9 * $fontScale);
        const metrics = overlayTextPaint.getFontMetrics();
        const textHeight = metrics.descent - metrics.ascent;
        for (const { from, label, to, top } of brackets) {
            const start = Math.max(contentLeft, pixelX(from));
            const end = Math.min(contentRight, pixelX(to));
            if (end <= start) {
                continue;
            }
            const y = pixelY(top) - BRACKET_LIFT;
            canvas.drawLine(start, y, end, y, overlayPaint);
            canvas.drawLine(start, y, start, y + BRACKET_END, overlayPaint);
            canvas.drawLine(end, y, end, y + BRACKET_END, overlayPaint);
            if (label) {
                // over the bracket, never on it: its width stays readable, a short climb at the edge keeps its label whole
                const width = overlayTextPaint.measureText(label) + PLATE_PADDING * 2;
                const left = Math.min(Math.max((start + end - width) / 2, contentLeft), contentRight - width);
                const bottom = y - BRACKET_PLATE_GAP;
                overlayFillPaint.color = ink;
                canvas.drawRoundRect(left, bottom - textHeight - 2, left + width, bottom, 4, 4, overlayFillPaint);
                canvas.drawText(label, left + PLATE_PADDING, bottom - 1 - metrics.descent, overlayTextPaint);
            }
        }
        for (const { from, kind, tier, to } of marks) {
            const start = Math.max(contentLeft, pixelX(from));
            const end = Math.min(contentRight, pixelX(to));
            if (end < contentLeft || start > contentRight) {
                continue;
            }
            overlayFillPaint.color = isEInk ? '#000000' : MARK_COLORS[kind];
            const top = contentBottom + MARK_GAP;
            // the harder, the thicker: it reads without colour, on e-ink too
            const height = MARK_HEIGHT + ((tier ?? 1) - 1) * MARK_TIER_STEP;
            canvas.drawRoundRect(start, top, Math.max(end, start + MARK_MIN_WIDTH), top + height, height / 2, height / 2, overlayFillPaint);
        }
        if (popover && cursorShown) {
            drawPopover(canvas);
        }
        cursorShown = false;
    }
    /** The attention mark a tap on the bottom edge of the plot, or under it, is on, -1 for none. */
    function markAt(highlight: Highlight<Entry>) {
        const chartView = chart?.nativeView;
        if (!marks.length || !chartView || highlight.yTouchPx === undefined) {
            return -1;
        }
        const { contentBottom, contentTop } = chartView.viewPortHandler;
        if (highlight.yTouchPx < contentBottom - (contentBottom - contentTop) * MARK_HIT_HEIGHT) {
            return -1;
        }
        return marks.findIndex(({ from, to }) => highlight.x >= from && highlight.x <= to);
    }

    // the cursor's card, in the manner of a weather chart's, laid out once when the cursor moves. Blocks apart by a
    // hairline: what is here, what is left of the ascent it is on, what is left of the route
    const POPOVER_WIDTH = 132;
    const POPOVER_PADDING = 7;
    const POPOVER_BLOCK_GAP = 5;
    /** how far from the middle the cursor has to go for the card to change side */
    const POPOVER_SIDE_MARGIN = 12;
    const POPOVER_EDGE = 4;
    const popoverPaint = new Paint();
    const popoverBackPaint = new Paint();
    popoverBackPaint.setStyle(Style.FILL);
    const popoverBorderPaint = new Paint();
    popoverBorderPaint.setStyle(Style.STROKE);
    popoverBorderPaint.setStrokeWidth(1);
    // the hairline between the blocks stays well under the card's own border
    const popoverCrossPaint = new Paint();
    popoverCrossPaint.setStyle(Style.STROKE);
    popoverCrossPaint.setStrokeWidth(1);
    const popoverLinePaint = new Paint();
    popoverLinePaint.setStyle(Style.STROKE);
    popoverLinePaint.setStrokeWidth(0.5);
    let popover: StaticLayout[] = null;
    /** where the last draw put the cursor, which the card is beside */
    let cursorX = 0;
    /** the cursor was drawn in this frame: its card is only drawn with it */
    let cursorShown = false;
    let popoverBounds: { left: number; top: number; right: number; bottom: number } = null;
    /** the card is on the side the cursor is not, so a finger on the cursor never lands on it */
    let popoverSide: 'left' | 'right' = 'right';
    interface PopoverSpan {
        text: string;
        fontFamily?: string;
        fontSize?: number;
        fontWeight?: string;
        color?: string;
    }
    /** A row of figures side by side, an icon in front of each. */
    function figuresRow(figures: { icon: string; color?: string; text: string }[], accent: string): PopoverSpan[] {
        return figures.flatMap(({ color, icon, text }, position) => [
            { text: position ? '   ' : '', fontSize: 11 },
            { text: icon, fontFamily: $fonts.mdi, fontSize: 12, color: color ?? accent },
            { text: '  ' + text, fontSize: 11, fontWeight: 'bold', color: colorOnSurface }
        ]);
    }
    function buildPopover(
        index: number,
        entry: { d: number; a: number; g?: number; dp?: number; dm?: number },
        params: { remainingDistance: number; remainingTime: number; dplus?: number; dmin?: number }
    ) {
        const accent = isEInk ? colorOnSurface : colorPrimary;
        const caption = (text: string): PopoverSpan[] => [{ text: text + '\n', fontSize: 9, color: colorOnSurfaceVariant }];
        const blocks: PopoverSpan[][] = [];
        // the point: where it is, and what the lens says of it
        const lensNote = note?.(index);
        blocks.push([{ text: formatDistance(entry.d), fontSize: 13, fontWeight: 'bold', color: colorOnSurface }, ...(lensNote ? [{ text: '\n' + lensNote, fontSize: 10, color: accent }] : [])]);
        // what the ground is like right here
        const grade = entry.g || 0;
        blocks.push(
            figuresRow(
                [
                    { icon: 'mdi-triangle-outline', text: convertElevation(entry.a || 0) },
                    { icon: 'mdi-angle-acute', color: gradeColor(grade), text: grade.toFixed(1) + ' %' }
                ],
                accent
            )
        );
        // what is left of the ascent the point is on, up to its top
        const ascent = item.profile?.ascents?.find((candidate) => index >= candidate.startIndex && index <= candidate.highestPointIndex);
        const summit = ascent && item.profile.data[ascent.highestPointIndex];
        if (summit && summit.d > entry.d) {
            blocks.push([
                ...caption(lc('cursor_ascent_left')),
                ...figuresRow(
                    [
                        { icon: 'mdi-arrow-top-right', text: convertElevation(ascent.highestElevation - (entry.a || 0)) },
                        { icon: 'mdi-arrow-expand-right', text: formatDistance(summit.d - entry.d) }
                    ],
                    accent
                )
            ]);
        }
        // what is left of the whole route
        const total: { icon: string; text: string }[][] = [];
        if (!isNaN(params.remainingDistance)) {
            total.push([{ icon: 'mdi-flag-checkered', text: formatDistance(params.remainingDistance) + (!isNaN(params.remainingTime) ? ' · ' + convertDurationSeconds(params.remainingTime) : '') }]);
        }
        const climbed: { icon: string; text: string }[] = [];
        if (!isNaN(entry.dp) && params.dplus - entry.dp > 0) {
            climbed.push({ icon: 'mdi-arrow-top-right', text: convertElevation(params.dplus - entry.dp) });
        }
        if (!isNaN(entry.dm) && Math.abs(params.dmin - entry.dm) > 0) {
            climbed.push({ icon: 'mdi-arrow-bottom-right', text: convertElevation(-(params.dmin - entry.dm)) });
        }
        if (climbed.length) {
            total.push(climbed);
        }
        if (total.length) {
            blocks.push([...caption(lc('cursor_route_left')), ...total.flatMap((row, position) => [...(position ? [{ text: '\n', fontSize: 11 }] : []), ...figuresRow(row, accent)])]);
        }
        popoverBackPaint.color = new Color(isEInk ? '#ffffff' : colorBackground).setAlpha(240).hex;
        popoverBorderPaint.color = isEInk ? colorOnSurface : colorOutline;
        popoverLinePaint.color = new Color(isEInk ? colorOnSurface : colorOutlineVariant).setAlpha(isEInk ? 120 : 70).hex;
        popoverCrossPaint.color = isEInk ? colorOnSurface : colorOnSurfaceVariant;
        popoverPaint.setTextSize(11 * $fontScale);
        popover = blocks.map((spans) => new StaticLayout(createNativeAttributedString({ spans }), popoverPaint, POPOVER_WIDTH - POPOVER_PADDING * 2, LayoutAlignment.ALIGN_NORMAL, 1, 0, true));
    }
    /** The card goes when what it is beside moves: the chart is zoomed or panned, the sheet it is in dragged. */
    function hideCard() {
        if (popover) {
            popover = null;
            popoverBounds = null;
            chart?.nativeView?.invalidate();
        }
    }
    function drawPopover(canvas: Canvas) {
        const { contentLeft, contentRight } = chart.nativeView.viewPortHandler;
        const middle = (contentLeft + contentRight) / 2;
        // a card that followed the cursor would flip under a finger crossing the middle: it stays on one side until the cursor is well on the other
        if (cursorX > middle + POPOVER_SIDE_MARGIN) {
            popoverSide = 'left';
        } else if (cursorX < middle - POPOVER_SIDE_MARGIN) {
            popoverSide = 'right';
        }
        const height = popover.reduce((total, layout) => total + layout.getHeight(), 0) + POPOVER_BLOCK_GAP * (popover.length - 1) + POPOVER_PADDING * 2;
        const left = popoverSide === 'left' ? contentLeft + POPOVER_EDGE : contentRight - POPOVER_WIDTH - POPOVER_EDGE;
        // at the very top of the chart's canvas, over the brackets: not in the plot, where the data's layers would lie over it
        const top = 2;
        canvas.drawRoundRect(left, top, left + POPOVER_WIDTH, top + height, 8, 8, popoverBackPaint);
        canvas.drawRoundRect(left, top, left + POPOVER_WIDTH, top + height, 8, 8, popoverBorderPaint);
        let y = top + POPOVER_PADDING;
        popover.forEach((layout, position) => {
            if (position > 0) {
                // the hairline between two blocks
                const line = y - POPOVER_BLOCK_GAP / 2;
                canvas.drawLine(left + POPOVER_PADDING, line, left + POPOVER_WIDTH - POPOVER_PADDING, line, popoverLinePaint);
            }
            canvas.save();
            canvas.translate(left + POPOVER_PADDING, y);
            layout.draw(canvas);
            canvas.restore();
            y += layout.getHeight() + POPOVER_BLOCK_GAP;
        });
        // a cross in its corner says the card can be put away
        const crossX = left + POPOVER_WIDTH - POPOVER_PADDING - 3;
        const crossY = top + POPOVER_PADDING + 5;
        canvas.drawLine(crossX - 3, crossY - 3, crossX + 3, crossY + 3, popoverCrossPaint);
        canvas.drawLine(crossX - 3, crossY + 3, crossX + 3, crossY - 3, popoverCrossPaint);
        popoverBounds = { left, top, right: left + POPOVER_WIDTH, bottom: top + height };
    }
    /** An elevation the way the axis writes it: no unit. */
    const axisNumber = (meters: number) => Math.round(meters).toLocaleString();
    /** An elevation line whose label the axis custom renderer draws on a plate, above or below it. */
    class PlateLimitLine extends LimitLine {
        constructor(
            limit: number,
            public plateLabel: string,
            public plateBelow: boolean
        ) {
            super(limit, '');
        }
    }

    export let item: Item;
    export let showAscents = true;
    export let showWaypoints = true;
    let chart: NativeViewElementNode<LineChart>;
    export let showProfileGrades = true;
    /** navigation bar widget variant: no axes, labels, limit lines or gestures */
    export let mini = false;
    /** the fill dithers into noise on eink, where the silhouette alone reads better */
    export let filled = true;
    /** profile index range to zoom on, eg the climb underway. Whole route when null */
    export let range: { fromIndex: number; toIndex: number } = null;
    /** the lens card's chart: its cursor's figures leave through the `cursor` event instead of being drawn over it */
    export let inCard = false;
    /** spans marked above the curve, eg the climbs of the lens in use */
    export let brackets: ProfileBracket[] = [];
    /** what the lens in use says of the point under the cursor, for the card that follows it */
    export let note: (index: number) => string | undefined = null;
    /** what needs attention along the route, drawn under the profile and tapped to focus */
    export let marks: ProfileMark[] = [];
    /** the fill's colours when a lens has its own, else the grade's if `showProfileGrades` */
    export let fill: ProfileFillStop[] = null;
    /** the chart is beside the main map: a picked point is shown on it, and the card goes when its sheet moves */
    export let besideMap = true;
    if (inCard && besideMap) {
        mapContext.onItemSheetMoved(hideCard);
    }

    export function clearHighlight() {
        chart?.nativeView?.highlightValues(null);
        popover = null;
        popoverBounds = null;
        dispatch('cursor', null);
        // the tiles show what is left from the point: no point, nothing left to show
        !mini && mapContext.mapModule('items').notify({ eventName: 'user_onroute_data', item });
    }

    $: if (chart?.nativeView?.data && range !== undefined) {
        // the widget cuts its axes, the card zooms
        (mini ? applyRange : zoomToRange)(range);
    }

    /** The two elevations the axis marks with a plate, and the overlay over them. */
    function setElevationLimitLines(leftAxis: LineChart['leftAxis'], min: number, max: number) {
        leftAxis.removeAllLimitLines();
        [new PlateLimitLine(min, axisNumber(min), true), new PlateLimitLine(max, axisNumber(max), false)].forEach((limitLine) => {
            limitLine.lineColor = colorOutline;
            limitLine.enableDashedLine(4, 3, 0);
            limitLine.lineWidth = 0.5;
            leftAxis.addLimitLine(limitLine);
        });
        leftAxis.addLimitLine(new OverlayLimitLine(max));
    }

    /** The widget's stretch: the axes are cut to it. */
    function applyRange(range: { fromIndex: number; toIndex: number }) {
        const chartView = chart?.nativeView;
        const data = item?.profile?.data;
        if (!chartView || !data?.length) {
            return;
        }
        const leftAxis = chartView.leftAxis;
        const xAxis = chartView.xAxis;
        if (!range) {
            xAxis.resetAxisMinimum();
            xAxis.resetAxisMaximum();
            leftAxis.resetAxisMinimum();
            leftAxis.resetAxisMaximum();
        } else {
            const from = Math.max(Math.min(range.fromIndex, data.length - 1), 0);
            const to = Math.max(Math.min(range.toIndex, data.length - 1), from);
            xAxis.axisMinimum = data[from].d;
            xAxis.axisMaximum = data[to].d;
            // the whole route's altitude range would flatten a single climb into a straight line
            let min = Infinity;
            let max = -Infinity;
            for (let index = from; index <= to; index++) {
                min = Math.min(min, data[index].a);
                max = Math.max(max, data[index].a);
            }
            leftAxis.axisMinimum = min;
            leftAxis.axisMaximum = max;
        }
        chartView.invalidate();
    }

    // the whole route's label interval, which a stretch of it replaces while it is in view
    let wholeInterval = 0;
    /** The card's height range is that of the stretch in view, `from` to `to` being profile indexes. */
    function setHeight(from: number, to: number) {
        const chartView = chart?.nativeView;
        const data = item?.profile?.data;
        if (!chartView || !data?.length) {
            return;
        }
        let min = Infinity;
        let max = -Infinity;
        for (let index = Math.max(from, 0); index <= Math.min(to, data.length - 1); index++) {
            min = Math.min(min, data[index].a);
            max = Math.max(max, data[index].a);
        }
        if (min > max) {
            return;
        }
        const leftAxis = chartView.leftAxis;
        const padding = Math.max(10, (max - min) * 0.1);
        leftAxis.axisMinimum = min - padding;
        leftAxis.axisMaximum = max + padding;
        leftAxis.forcedInterval = Math.max(10, Math.round((max - min) / leftAxis.labelCount / 10) * 10);
        // the labels are made again, which the next draw may not do (it skips it after a highlight is set or cleared), then the
        // mapping of the elevations to the screen, which is made from the axis' range, and only when the offsets are
        chartView.leftAxisRenderer.computeAxis(leftAxis.axisMinimum, leftAxis.axisMaximum, leftAxis.inverted);
        chartView.calculateOffsets();
        chartView.invalidate();
    }
    /** The whole route's height range again. */
    function resetHeight() {
        const leftAxis = chart?.nativeView?.leftAxis;
        if (leftAxis) {
            leftAxis.resetAxisMinimum();
            leftAxis.resetAxisMaximum();
            leftAxis.forcedInterval = wholeInterval;
            // releasing the limits leaves the stretch's values in the axis until it is calculated again, which this does
            chart.nativeView.notifyDataSetChanged();
            chart.nativeView.invalidate();
        }
    }

    /**
     * The card's stretch: the chart is zoomed to it, along the distance, and `null` is the whole route again. The height range is
     * the stretch's: a climb is read by its shape.
     */
    function zoomToRange(range: { fromIndex: number; toIndex: number }) {
        const chartView = chart?.nativeView;
        const data = item?.profile?.data;
        if (!chartView || !data?.length) {
            return;
        }
        chartView.fitScreen();
        if (!range) {
            resetHeight();
            return;
        }
        const from = Math.max(Math.min(range.fromIndex, data.length - 1), 0);
        const to = Math.max(Math.min(range.toIndex, data.length - 1), from);
        const stretch = data[to].d - data[from].d;
        const scaleX = stretch > 0 ? (data[data.length - 1].d - data[0].d) / stretch : 1;
        chartView.zoomAndCenter(Math.max(1, scaleX), 1, (data[from].d + data[to].d) / 2, 0, AxisDependency.LEFT);
        setHeight(from, to);
    }

    $: {
        try {
            if (chart) {
                updateChartData(item);
            }
        } catch (err) {
            console.error('updateChartData', !!err, err, err.stack);
            showError(err);
        }
    }
    // a prop that is an array counts as changed whenever its parent updates: the chart is rebuilt for what really differs
    let builtFill = fill;
    let builtGrades = showProfileGrades;
    let builtAscents = showAscents;
    $: if (chart?.nativeView?.data && (fill !== builtFill || showProfileGrades !== builtGrades || showAscents !== builtAscents)) {
        builtFill = fill;
        builtGrades = showProfileGrades;
        builtAscents = showAscents;
        updateChartData(item);
    }
    // the stops the fill was last coloured with, which e-ink draws as shades and hatching instead, and the shade of each: from the grade
    // of its stretch, the chart having the colours it may turn into something else
    let fillStops: ProfileFillStop[] = null;
    let fillShades: string[] = [];
    /**
     * On e-ink the fill is not coloured: the colours of the grades are greys that look alike. A grade is a shade of black, the more the
     * steeper, and a surface is a hatching. Clipped to the area under the curve.
     */
    function drawEInkFill(canvas: Canvas, set: LineDataSet, spline: Path, trans: Transformer, min: number, max: number, superMethod: () => void) {
        const data = item?.profile?.data;
        if (!fillStops?.length || !data?.length) {
            superMethod();
            return;
        }
        const { contentBottom, contentLeft, contentRight, contentTop } = chart.nativeView.viewPortHandler;
        // what the renderer hands over is the curve alone, in values rather than pixels: the area under it is closed down to the fill's
        // line the way the renderer does it, then made pixels
        const area = new Path();
        area.addPath(spline);
        const fillMin = set.fillFormatter.getFillLinePosition(set, chart.nativeView);
        area.lineTo(max, fillMin);
        area.lineTo(min, fillMin);
        area.close();
        trans.pathValueToPixel(area);
        canvas.save();
        canvas.clipPath(area);
        fillStops.forEach((stop, index) => {
            const left = Math.max(contentLeft, trans.getPixelForValues(data[stop.d].d, 0).x);
            const right = Math.min(contentRight, trans.getPixelForValues(data[fillStops[index + 1]?.d ?? data.length - 1].d, 0).x);
            if (right <= left) {
                return;
            }
            if (stop.pattern) {
                drawSurfaceBand(canvas, { id: '', pattern: stop.pattern, left, right, top: contentTop, bottom: contentBottom, fillColor: '#ffffff', patternColor: '#000000' });
                return;
            }
            if (fillShades[index]) {
                overlayFillPaint.color = fillShades[index];
                canvas.drawRect(left, contentTop, right, contentBottom, overlayFillPaint);
            }
        });
        canvas.restore();
    }
    // the overlay is read as it is drawn: a new lens or new marks need a redraw, not a rebuilt chart
    $: if (chart?.nativeView && (brackets || marks)) {
        chart.nativeView.invalidate();
    }
    let onChartDataUpdateCallbacks = [];

    let highlightNString;
    function onChartPanOrZoom(event) {
        hideCard();
        try {
            const chart = event.object as LineChart;
            const xAxisRender = chart.xAxisRenderer;
            const { max, min } = xAxisRender.getCurrentMinMax();
            const dataSet = chart.data.getDataSetByIndex(0);
            dataSet.ignoreFiltered = true;
            const minX = dataSet.getEntryIndexForXValue(min, NaN, Rounding.CLOSEST);
            const maxX = dataSet.getEntryIndexForXValue(max, NaN, Rounding.CLOSEST);
            dataSet.ignoreFiltered = false;
            if (inCard) {
                // the height follows the stretch in view, the whole route's once it is whole again
                if (chart.isFullyZoomedOut()) {
                    resetHeight();
                } else {
                    setHeight(minX, maxX);
                }
            }
            const positions = (item.geometry?.['coordinates'] as any[]).slice(minX, maxX + 1);
            const region = getBounds(positions);
            // `[min, max]`, which is what the facade's bounds are everywhere
            mapContext
                .getMap()
                .camera()
                .fitBounds(
                    [
                        [region.minLng, region.minLat],
                        [region.maxLng, region.maxLat]
                    ],
                    { integerZoom: true }
                );
        } catch (error) {
            console.error(error, error.stack);
        }
    }
    // a highlight that follows another this closely is a finger being dragged along the chart, not a tap
    const SCRUB_GAP = 150;
    let lastHighlightAt = 0;
    // the route whose card was put away: its position updates do not bring the card back
    let dismissedFor: Item = null;
    async function onChartHighlight(event: HighlightEventData) {
        // DEV_LOG && console.log('onChartHighlight', event.highlight);
        if (!item) {
            return;
        }
        const now = Date.now();
        const scrubbing = now - lastHighlightAt < SCRUB_GAP;
        lastHighlightAt = now;
        const { xTouchPx, yTouchPx } = event.highlight;
        if (!scrubbing && popoverBounds && xTouchPx >= popoverBounds.left && xTouchPx <= popoverBounds.right && yTouchPx >= popoverBounds.top && yTouchPx <= popoverBounds.bottom) {
            // a tap on the card puts it away, the cursor with it: it sits on the side the cursor is not on
            dismissedFor = item;
            clearHighlight();
            return;
        }
        // a tap, or a finger, on the chart is the user's own: the card is theirs to open again
        dismissedFor = null;
        const markIndex = scrubbing ? -1 : markAt(event.highlight);
        if (markIndex >= 0) {
            // a tap on a mark picks the mark, not a point of the route
            clearHighlight();
            dispatch('mark', { index: markIndex });
            return;
        }
        const shouldSelectItem = event.highlight.hasOwnProperty('xPx');
        // const shouldSelectItem = true;
        const entryIndex = event.highlight.entryIndex;
        const positions = item.geometry?.['coordinates'];
        const actualIndex = Math.max(0, Math.min(entryIndex, positions.length - 1));
        const position = positions[actualIndex];
        // DEV_LOG && console.log('onChartHighlight', entryIndex, position, shouldSelectItem);

        if (position) {
            if (event.highlight) {
                dispatch('highlight', { lat: position[1], lon: position[0], highlight: event.highlight });
            }
            if (shouldSelectItem && besideMap) {
                mapContext.selectItem({
                    item: { geometry: { type: 'Point', coordinates: position } },
                    isFeatureInteresting: true,
                    setSelected: false,
                    peek: false,
                    zoomDuration: 100,
                    preventZoom: false
                });
            }
        }
        // if (DEV_LOG) {
        //     try {
        //         const points = [{ lat: position[1], lon: position[0] }];
        //         if (actualIndex < positions.length - 1) {
        //             points.push({ lat: positions[actualIndex + 1][1], lon: positions[actualIndex + 1][0] });
        //         } else {
        //             points.unshift({ lat: positions[actualIndex - 1][1], lon: positions[actualIndex - 1][0] });
        //         }

        //         const projection = mapContext.getProjection();
        //         packageService
        //             .getStats({
        //                 projection,
        //                 points,
        //                 profile: item.properties.route.type,
        //                 attributes: ['edge.surface', 'edge.road_class', 'edge.sac_scale', 'edge.use'],
        //                 shape_match: 'edge_walk'
        //             })
        //             .then((edges) => console.log('edges', edges));
        //     } catch (error) {
        //         console.error(error, error.stack);
        //     }
        // }
    }

    let chartInitialized = false;

    onThemeChanged(() => {
        if (!chart) {
            return;
        }
        const chartView = chart.nativeView;

        const leftAxis = chartView.leftAxis;
        leftAxis.textColor = colorOnSurface;
        leftAxis.gridColor = colorOutlineVariant;
        const xAxis = chartView.xAxis;
        xAxis.textColor = colorOnSurface;
        xAxis.gridColor = colorOutlineVariant;
        const dataSet = chartView.data?.getDataSetByIndex(0);
        if (dataSet) {
            dataSet.valueTextColor = colorOnSurface;
        }
    });
    export function hilghlightPathIndex(
        params: { onPathIndex: number; remainingDistance: number; remainingDistanceToStep: number; remainingTime: number; dplus?: number; dmin?: number },
        highlight?: Highlight<Entry>,
        sendEvent = true,
        // false: the cursor moves, its card does not open (a route just selected)
        card = true
    ) {
        if (!chart) {
            return;
        }
        if (!item) {
            onChartDataUpdateCallbacks.push(() => {
                hilghlightPathIndex(params, highlight, sendEvent, card);
            });
            return;
        }
        const nChart = chart?.nativeView;
        // DEV_LOG && console.log('hilghlightPathIndex', !!item, JSON.stringify(params), JSON.stringify(highlight), nChart);
        const onPathIndex = params.onPathIndex;
        if (onPathIndex === -1) {
            popover = null;
            popoverBounds = null;
            dispatch('cursor', null);
            if (nChart) {
                nChart.highlight(null);
            }
            // the widget is a second chart on the same route: letting it emit too would fight the
            // item sheet's own live data
            !mini &&
                mapContext.mapModule('items').notify({
                    eventName: 'user_onroute_data',
                    item
                });
        } else {
            const itemData = highlight?.entry || item?.profile?.data?.[onPathIndex];

            if (itemData) {
                const spans = [
                    {
                        fontFamily: $fonts.mdi,
                        color: colorPrimary,
                        text: 'mdi-arrow-expand-right'
                    },
                    {
                        text: formatDistance(params.remainingDistance) + '  '
                    },
                    {
                        fontFamily: $fonts.mdi,
                        color: colorPrimary,
                        text: 'mdi-triangle-outline'
                    },
                    {
                        text: (itemData.a || 0).toFixed() + 'm' + '  '
                    },
                    {
                        fontFamily: $fonts.mdi,
                        color: colorPrimary,
                        text: 'mdi-angle-acute'
                    },
                    {
                        // one decimal, and the section colour, so this agrees with the fill under it
                        color: gradeColor(itemData.g || 0),
                        text: (itemData.g || 0).toFixed(1) + '% '
                    }
                ];
                if (!isNaN(itemData.dp) && params.dplus - itemData.dp > 0) {
                    spans.push(
                        {
                            fontFamily: $fonts.mdi,
                            color: colorPrimary,
                            text: 'mdi-arrow-top-right'
                        },
                        {
                            text: convertElevation(params.dplus - itemData.dp) + ' '
                        }
                    );
                }
                if (!isNaN(itemData.dm) && Math.abs(params.dmin - itemData.dm) > 0) {
                    spans.push(
                        {
                            fontFamily: $fonts.mdi,
                            color: colorPrimary,
                            text: 'mdi-arrow-bottom-right'
                        },
                        {
                            text: convertElevation(-(params.dmin - itemData.dm)) + ' '
                        }
                    );
                }
                if (!isNaN(params.remainingTime)) {
                    spans.unshift(
                        {
                            fontFamily: $fonts.mdi,
                            color: colorPrimary,
                            text: 'mdi-timer-outline'
                        },
                        {
                            text: convertDurationSeconds(params.remainingTime) + '  '
                        }
                    );
                }
                highlightNString = createNativeAttributedString({
                    spans
                });
                if (inCard && card && dismissedFor !== item) {
                    buildPopover(onPathIndex, { d: itemData.d, a: itemData.a, g: itemData.g, dp: itemData.dp, dm: itemData.dm }, params);
                } else {
                    popover = null;
                }
                dispatch('cursor', { index: onPathIndex, entry: { d: itemData.d, a: itemData.a, g: itemData.g }, ...params });
                !mini &&
                    mapContext.mapModule('items').notify({
                        eventName: 'user_onroute_data',
                        item,
                        itemData,
                        ...params
                    });
            } else {
                !mini &&
                    mapContext.mapModule('items').notify({
                        eventName: 'user_onroute_data',
                        item,
                        ...params
                    });
            }
            if (highlight) {
                // the card built above is drawn now, whether or not the chart has already drawn this highlight
                nChart?.invalidate();
                return;
            }
            function highlightFunc() {
                if (!item) {
                    return;
                }
                const nChart = chart?.nativeView;
                const profile = item.profile;
                const profileData = profile?.data;
                if (profileData) {
                    const dataSet = nChart.data.getDataSetByIndex(0);
                    dataSet.ignoreFiltered = true;
                    const entry = profileData[onPathIndex];
                    dataSet.ignoreFiltered = false;
                    // DEV_LOG && console.log('highlight', onPathIndex, sendEvent, entry.d, JSON.stringify(entry));
                    const highlight = {
                        dataSetIndex: 0,
                        entryIndex: onPathIndex,
                        entry
                    };
                    nChart.highlightValues([highlight]);
                    if (sendEvent) {
                        onChartHighlight({ eventName: 'highlight', highlight, object: nChart } as any);
                    }
                }
            }
            if (nChart && nChart.data) {
                highlightFunc();
            } else {
                DEV_LOG && console.log('stacking highlight');
                onChartDataUpdateCallbacks.push(highlightFunc);
            }
        }
    }

    export function updateChartData(it = item) {
        if (!chart || !it) {
            return;
        }
        const chartView = chart.nativeView;
        const sets = [];
        const profile = it.profile;
        const profileData = profile?.data;
        const leftAxis = chartView.leftAxis;
        let xinterval;
        if (profileData) {
            const xAxis = chartView.xAxis;
            if (!chartInitialized) {
                chartInitialized = true;
                // the navigation bar owns the drag here, and there is no room for labels anyway. The
                // axes stay enabled and are only made invisible: calcMinMax skips a disabled axis, and
                // the y transformer is built from the range it computes, so disabling draws nothing
                chartView.highlightPerDragEnabled = !mini;
                chartView.highlightPerTapEnabled = !mini;
                chartView.scaleXEnabled = !mini;
                // the card's chart is zoomed along the distance only: its height follows the stretch in view, see `fitHeight`.
                // The chart pans only if both axes can drag, but with no zoom of its own on the height there is nothing to drag on it
                chartView.scaleYEnabled = !mini && !inCard;
                chartView.doubleTapToZoomEnabled = !mini;
                chartView.dragEnabled = !mini;
                chartView.clipHighlightToContent = false;
                // the card's chart is zoomed to a stretch: a finger pans it there, and scrubs it when it is whole
                chartView.zoomedPanWith2Pointers = !mini && !inCard;
                chartView.clipDataToContent = true;

                chartView.minOffset = 0;
                // the mini chart is drawn under the widget's own labels — the summit elevation sits in
                // its top right corner — so the curve needs headroom rather than the whole card
                // with the readout above, the highlight needs no room of its own
                chartView.setExtraOffsets(0, mini ? 14 : inCard ? BRACKET_ROOM : 24, mini ? 4 : 10, mini ? 2 : inCard ? 0 : 10);
                if (mini) {
                    chartView.legend.enabled = false;
                    [leftAxis, xAxis].forEach((axis) => {
                        axis.drawLabels = false;
                        axis.drawGridLines = false;
                        axis.drawAxisLine = false;
                    });
                }
                leftAxis.textColor = colorOnSurface;
                leftAxis.drawZeroLine = true;
                leftAxis.gridColor = new Color(colorOutlineVariant).setAlpha(inCard ? 140 : 70).hex;
                if (inCard) {
                    leftAxis.gridLineWidth = 0.5;
                } else {
                    leftAxis.gridDashPathEffect = new DashPathEffect([6, 3], 0);
                }
                leftAxis.ensureLastLabel = true;
                leftAxis.drawLimitLinesBehindData = false;
                // the plates lie on the plot's edges: they would be cut at them
                leftAxis.clipLimitLinesToContent = false;
                // under the highlight, so its distance badge covers the axis labels, not the reverse
                leftAxis.drawLabelsBehindData = true;
                leftAxis.customRenderer = {
                    drawLimitLine(c: Canvas, axis, limitLine, rect, y: number, paint: Paint) {
                        if (limitLine instanceof OverlayLimitLine) {
                            drawOverlay(c);
                            return;
                        }
                        // a zoomed chart shows a stretch of the route: its extremes may be out of view, where the plates would hang
                        if (limitLine instanceof PlateLimitLine && (y < rect.top - 1 || y > rect.bottom + 1)) {
                            return;
                        }
                        c.drawLine(rect.left, y, rect.right, y, paint);
                        if (limitLine instanceof PlateLimitLine) {
                            plateLabelPaint.textSize = 9 * $fontScale;
                            plateLabelPaint.color = colorOnSurface;
                            const metrics = plateLabelPaint.getFontMetrics();
                            const height = metrics.descent - metrics.ascent;
                            // over the axis labels, on the line: its value matters more than a round number of the axis, and
                            // nothing of the data's is here to lie under
                            const top = y - height / 2;
                            drawPlatedLabel(c, [limitLine.plateLabel], rect.left - 2, top, plateLabelPaint, true);
                        }
                    }
                };

                xAxis.position = XAxisPosition.BOTTOM;
                xAxis.labelTextAlign = Align.CENTER;
                xAxis.ensureLastLabel = true;
                xAxis.textColor = colorOnSurface;
                xAxis.drawGridLines = false;
                xAxis.drawMarkTicks = true;
                xAxis.drawLimitLinesBehindData = false;
                xAxis.drawLabelsBehindData = true;
                xAxis.valueFormatter = {
                    getAxisLabel: (value) => formatDistance(value)
                };

                chartView.customRenderer = {
                    drawHighlight(c: Canvas, h: Highlight<Entry>, set: LineDataSet, paint: Paint) {
                        const x = h.drawX;
                        if (mini) {
                            // a dot riding the profile reads as "you are here"; the full height line
                            // cuts a widget sized chart in two and leaves nothing readable
                            c.drawCircle(x, h.drawY, 4, highlightPaint);
                            return;
                        }
                        if (highlightNString && !inCard) {
                            const staticLayout = new StaticLayout(highlightNString, nstringPaint, c.getWidth(), LayoutAlignment.ALIGN_NORMAL, 1, 0, true);
                            c.save();
                            c.translate(10, 0);
                            staticLayout.draw(c);
                            c.restore();
                        }
                        if (inCard) {
                            // a line down to the plot's foot and a ringed dot on the curve, the card beside it says the rest
                            cursorX = x;
                            cursorShown = true;
                            const bottom = chartView.viewPortHandler.contentBottom;
                            cursorPaint.color = isEInk ? colorOnSurface : colorPrimary;
                            c.drawLine(x, 0, x, bottom, cursorPaint);
                            cursorPaint.color = isEInk ? 'white' : colorBackground;
                            c.drawCircle(x, h.drawY, 7, cursorPaint);
                            cursorPaint.color = isEInk ? colorOnSurface : colorPrimary;
                            c.drawCircle(x, h.drawY, 5, cursorPaint);
                            return;
                        }
                        c.drawLine(x, 20, x, c.getHeight(), highlightPaint);
                        c.drawCircle(x, 20, 4, highlightPaint);
                        c.drawText(formatDistance(h.entry['d']), x + 6, 23, highlightPaint);
                    },
                    drawFill(c: Canvas, set: LineDataSet, spline: Path, trans: Transformer, min: number, max: number, superMethod: () => void) {
                        if (isEInk && !mini) {
                            drawEInkFill(c, set, spline, trans, min, max, superMethod);
                        } else {
                            superMethod();
                        }
                    }
                };
            } else {
                chartView.highlightValues(null);
                chartView.resetZoom();
                dispatch('cursor', null);
            }
            const deltaA = profile.max[1] - profile.min[1];
            const spaceMin = 100;
            let spaceMax = 0;
            const chartElevationMinRange = ApplicationSettings.getNumber('chart_elevation_min_range', 250);
            if (deltaA < chartElevationMinRange) {
                //   const space = (chartElevationMinRange - deltaA) / 2;
                //    spaceMin += space;
                spaceMax += chartElevationMinRange - deltaA;
            }
            const labelCount = inCard ? 3 : 5;
            const step = Math.max(chartElevationMinRange, deltaA) / labelCount < 100 ? 50 : 100;
            const interval = Math.round(Math.max(chartElevationMinRange, deltaA) / labelCount / step) * step;
            leftAxis.forcedInterval = interval;
            wholeInterval = interval;
            leftAxis.labelCount = labelCount;
            leftAxis.spaceMin = spaceMin;
            leftAxis.spaceMax = spaceMax;
            leftAxis.textSize = 9 * $fontScale;

            const totalDistance = it.route.totalDistance;
            const xLabelCount = inCard ? X_LABEL_COUNT : 6;
            xinterval = closestUpper(xintervals, totalDistance / xLabelCount / 1000) * 1000;
            xAxis.forcedInterval = xinterval;
            xAxis.labelCount = xLabelCount;
            xAxis.textSize = 9 * $fontScale;
            xAxis.clipLimitLinesToContent = false;
            const chartData = chartView.data;
            let set: LineDataSet;
            // thicker in the widget: the same hairline that reads fine on a full chart nearly disappears
            // at a glance on a card the height of a line of text
            const lineWidth = mini ? 2 : 1;
            // the curve is the ink of an e-ink screen: the light blue is a colour there
            const lineColor = isEInk ? colorOnSurface : '#60B3FC';
            function updateSetColors() {
                const stops = fill ?? (showProfileGrades ? profile.colors : null);
                fillStops = stops;
                fillShades = (stops ?? []).map((stop, index) => {
                    const end = stops[index + 1]?.d ?? profileData.length - 1;
                    let grades = 0;
                    for (let point = stop.d; point <= end; point++) {
                        grades += profileData[point].g ?? 0;
                    }
                    const shade = gradeShades[gradeBucketIndex(grades / (end - stop.d + 1))] ?? 0;
                    return shade > 0 ? new Color('#000000').setAlpha(shade).hex : '';
                });
                if (stops && stops.length > 1) {
                    set.lineWidth = lineWidth;
                    // TODO(cleanup): the cast is carried over; type the stops for the colors setter instead
                    set.colors = stops as any;
                    // the grade buckets only mean something if they can be told apart, and the chart's
                    // default fill alpha washes them out. Eink keeps that default: there the fill is a
                    // grey wedge behind the curve, and darkening it buries the line in it
                    set.fillAlpha = isEInk ? DEFAULT_FILL_ALPHA : GRADE_FILL_ALPHA;
                } else {
                    set.lineWidth = lineWidth;
                    set.resetColors();
                    set.color = lineColor;
                    set.fillAlpha = DEFAULT_FILL_ALPHA;
                }
            }
            if (!chartData) {
                set = new LineDataSet(profileData, 'a', 'd', 'a');
                set.maxFilterNumber = ApplicationSettings.getNumber('chart_max_filter', 50);
                set.useColorsForFill = true;
                set.fillFormatter = {
                    getFillLinePosition(dataSet: LineDataSet, dataProvider) {
                        return dataProvider.yChartMin;
                    }
                };
                // set.valueFormatter=({
                //     getFormattedValue(value: number, entry: Entry, index, count, dataSetIndex: any, viewPortHandler: any) {
                //         if (index === 0 || index === count - 1 || value === profile.max[1] || value === profile.min[1]) {
                //             return convertElevation(value);
                //         }
                //     }
                // } as any);
                set.drawFilledEnabled = filled;
                set.color = lineColor;
                set.lineWidth = 1;
                set.fillColor = '#60B3FC80';
                set.mode = Mode.CUBIC_BEZIER;
                updateSetColors();
                sets.push(set);
                const lineData = new LineData(sets);
                chartView.data = lineData;
            } else {
                clearHighlight();
                set = chartData.getDataSetByIndex(0);
                updateSetColors();
                set.values = profileData;
                set.notifyDataSetChanged();
                chartData.notifyDataChanged();
                chartView.notifyDataSetChanged();
            }

            if (mini) {
                // limit lines, ascent callouts and waypoint pins all carry labels that have nowhere to
                // go at this size, so the widget stops here
                set.drawFilledEnabled = filled;
                applyRange(range);
                onChartDataUpdateCallbacks.forEach((c) => c());
                onChartDataUpdateCallbacks = [];
                return;
            }

            setElevationLimitLines(leftAxis, profile.min[1], profile.max[1]);
            let limitLine: LimitLine;

            xAxis.removeAllLimitLines();
            if (showAscents && profile.ascents) {
                profile.ascents.forEach((ascent: AscentSegment) => {
                    const text = convertElevation(ascent.highestElevation);
                    limitLine = new LimitLine(profileData[ascent.highestPointIndex].d, text);
                    limitLine.lineColor = colorOutline;
                    limitLine.enableDashedLine(6, 3, 0);
                    limitLine.lineWidth = 0.5;
                    limitLine.textSize = 7 * $fontScale;
                    limitLine.xOffset = 0;
                    limitLine.textColor = colorOnSurface;
                    limitLine.ensureVisible = true;
                    limitLine.drawLabel = (c: Canvas, label: string, x: number, y: number, paint: Paint) => {
                        c.drawCircle(x, y - 6, 6, waypointsBackPaint);
                        waypointsPaint.textSize = 7 * $fontScale;
                        c.drawText('', x, y - 5 + 1, waypointsPaint);
                        // right aligned when the renderer flipped the label to stay inside the chart
                        drawPlatedLabel(c, label.split('\n'), x + 2, y + 3, paint, paint.getTextAlign() === Align.RIGHT);
                    };
                    xAxis.addLimitLine(limitLine);
                });
            }
            if (showWaypoints && it.route.waypoints) {
                it.route.waypoints.forEach((p) => {
                    if (p.properties.showOnMap && p.properties.index > 0) {
                        limitLine = new LimitLine(profileData[p.properties.index].d, ' ');
                        limitLine.lineColor = colorOutline;
                        limitLine.enableDashedLine(6, 3, 0);
                        limitLine.lineWidth = 0.5;
                        limitLine.ensureVisible = true;
                        limitLine.drawLabel = (c: Canvas, label: string, x: number, y: number, paint: Paint) => {
                            c.drawCircle(x - 5, y + 0, 6, waypointsBackPaint);
                            waypointsPaint.textSize = 8 * $fontScale;
                            c.drawText('', x - 5, y + 4 - 1, waypointsPaint);
                        };
                        xAxis.addLimitLine(limitLine);
                    }
                });
            }

            // a rebuilt chart is the whole route again: its stretch is zoomed to over it
            if (range) {
                zoomToRange(range);
            } else if (inCard) {
                resetHeight();
            }
            onChartDataUpdateCallbacks.forEach((c) => c());
            onChartDataUpdateCallbacks = [];
        }
    }
</script>

<gridlayout {...$$restProps}>
    <linechart
        bind:this={chart}
        doubleTapGestureOptions={{
            maxDelayMs: 100
        }}
        hardwareAccelerated={__ANDROID__ && SDK_VERSION >= 28}
        panGestureOptions={{
            minDist: 20,
            failOffsetYStart: -20,
            failOffsetYEnd: 20
        }}
        on:highlight={onChartHighlight}
        on:zoom={onChartPanOrZoom}
        on:pan={onChartPanOrZoom} />
</gridlayout>
