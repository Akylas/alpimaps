<script context="module" lang="ts">
    import { Canvas, CanvasView, Paint, Path, Style } from '@nativescript-community/ui-canvas';

    const markerPaint = new Paint();
    markerPaint.setStyle(Style.FILL);
    const borderPaint = new Paint();
    borderPaint.setStyle(Style.STROKE);
    borderPaint.setStrokeWidth(1);
    const MARKER_SIZE = 5;

    /** part of the window kept behind the user, so the position marker is not glued to the left edge */
    const BEHIND_RATIO = 0.12;
</script>

<script lang="ts">
    import { NativeViewElementNode } from '@nativescript-community/svelte-native/dom';
    import NavigationCard, { NAVWIDGET_CARD_HEIGHT } from '~/components/navigation/NavigationCard.svelte';
    import { formatDistance } from '~/helpers/formatter';
    import { lc } from '~/helpers/locale';
    import { isEInk, onThemeChanged } from '~/helpers/theme';
    import { navigationItem, navigationProgress, navigationSurfaceSpan } from '~/stores/navigationStore';
    import { surfaceColors } from '~/utils/routing';
    import { drawSurfaceBand } from '~/utils/surfacePattern';
    import { colors, fontScaleMaxed } from '~/variables';

    /** null lets the flex row share its width out; the canvas still needs an explicit height */
    export let height = NAVWIDGET_CARD_HEIGHT;

    $: ({ colorOnSurface, colorOnSurfaceVariant, colorSurfaceContainerHigh } = $colors);

    let surfaceCanvas: NativeViewElementNode<CanvasView>;

    // valhalla road stats, only there once they have been fetched for the route
    $: stats = $navigationItem?.stats;
    // where each surface actually is along the route; absent on stats saved before it was recorded
    $: segments = stats?.surfaceSegments;
    $: profile = $navigationItem?.profile;
    $: onPathIndex = $navigationProgress?.onPathIndex ?? -1;
    $: available = !!segments?.length || !!stats?.surfaces?.length;
    // "surfaces" alone never said how far ahead the bar looks, which made it unreadable
    $: caption = segments?.length ? lc('surfaces') + ' · ' + formatDistance($navigationSurfaceSpan) : lc('surfaces');
    $: if (onPathIndex !== undefined || stats || $navigationSurfaceSpan) {
        surfaceCanvas?.nativeView?.invalidate();
    }
    onThemeChanged(() => surfaceCanvas?.nativeView?.invalidate());

    function drawBand(canvas: Canvas, id: string, left: number, right: number, height: number) {
        // on eink every surface colour collapses to the same grey, so the pattern is what carries the meaning
        drawSurfaceBand(canvas, {
            id,
            left,
            right,
            top: 0,
            bottom: height,
            fillColor: isEInk ? colorSurfaceContainerHigh : surfaceColors[id] || colorOnSurfaceVariant,
            patternColor: colorOnSurface
        });
    }

    /** first profile index at or past `distance` meters, -1 when the route ends before it */
    function indexAtDistance(distance: number) {
        const data = profile?.data;
        if (!data?.length) {
            return -1;
        }
        let low = 0;
        let high = data.length - 1;
        if (data[high].d < distance) {
            return -1;
        }
        while (low < high) {
            const middle = (low + high) >> 1;
            if (data[middle].d < distance) {
                low = middle + 1;
            } else {
                high = middle;
            }
        }
        return low;
    }

    /**
     * Index window the bar covers: `navigation_surface_span` meters of road ahead plus a short stretch
     * behind, so the widget answers "what am I riding into" at a scale the user chose.
     */
    function computeWindow(routeEnd: number) {
        const data = profile?.data;
        const position = Math.min(Math.max(onPathIndex, 0), routeEnd);
        if (!data?.length || onPathIndex < 0) {
            return { from: position, to: routeEnd };
        }
        const span = $navigationSurfaceSpan;
        const currentDistance = data[Math.min(position, data.length - 1)].d;
        const fromIndex = indexAtDistance(currentDistance - span * BEHIND_RATIO);
        const toIndex = indexAtDistance(currentDistance + span);
        return {
            from: Math.max(fromIndex < 0 ? 0 : fromIndex, 0),
            to: Math.min(toIndex < 0 ? routeEnd : toIndex, routeEnd)
        };
    }

    function onDraw({ canvas }: { canvas: Canvas; object: CanvasView }) {
        const canvasWidth = canvas.getWidth();
        const canvasHeight = canvas.getHeight();
        if (segments?.length) {
            const routeEnd = segments[segments.length - 1].end;
            const { from, to } = computeWindow(routeEnd);
            const span = to - from;
            if (span > 0) {
                for (let index = 0; index < segments.length; index++) {
                    const segment = segments[index];
                    if (segment.end <= from || segment.start >= to) {
                        continue;
                    }
                    const left = ((Math.max(segment.start, from) - from) / span) * canvasWidth;
                    const right = ((Math.min(segment.end, to) - from) / span) * canvasWidth;
                    drawBand(canvas, segment.id, left, right, canvasHeight);
                }
                if (onPathIndex >= from && onPathIndex <= to) {
                    drawPositionMarker(canvas, ((onPathIndex - from) / span) * canvasWidth, canvasWidth, canvasHeight);
                }
                return;
            }
        }
        // stats without positions: fall back to the route's overall composition
        const surfaces = stats?.surfaces;
        if (!surfaces?.length) {
            return;
        }
        let x = 0;
        for (let index = 0; index < surfaces.length; index++) {
            const surface = surfaces[index];
            // the last band takes whatever rounding left over, so the bar always ends flush
            const right = index === surfaces.length - 1 ? canvasWidth : x + surface.perc * canvasWidth;
            drawBand(canvas, surface.id, x, right, canvasHeight);
            x = right;
        }
    }

    function drawPositionMarker(canvas: Canvas, x: number, canvasWidth: number, canvasHeight: number) {
        const clampedX = Math.min(Math.max(x, 0), canvasWidth);
        const size = Math.min(canvasHeight / 2, MARKER_SIZE);
        // a downward triangle hanging from the top edge: it never hides the band it points at
        const marker = new Path();
        marker.moveTo(clampedX - size, 0);
        marker.lineTo(clampedX + size, 0);
        marker.lineTo(clampedX, size);
        marker.close();
        markerPaint.setColor(colorOnSurface);
        canvas.drawPath(marker, markerPaint);
        borderPaint.setColor(colorOnSurface);
        canvas.drawLine(clampedX, 0, clampedX, canvasHeight, borderPaint);
    }
</script>

{#if available}
    <!-- the canvas has no intrinsic size, so the card has to carry explicit dimensions -->
    <NavigationCard {height} padding="3 6 4 6" {...$$restProps}>
        <gridlayout rows="auto,*">
            <label color={colorOnSurfaceVariant} fontSize={10 * $fontScaleMaxed} text={caption} />
            <canvasview bind:this={surfaceCanvas} borderRadius={3} marginTop={2} row={1} on:draw={onDraw} />
        </gridlayout>
    </NavigationCard>
{/if}
