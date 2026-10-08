<script lang="ts">
    import { Align, Canvas, DashPathEffect, Paint, Rect, Style } from '@nativescript-community/ui-canvas';
    import { File, ImageSource, knownFolders, path } from '@nativescript/core';
    import { lang, lc } from '~/helpers/locale';
    import { getMapContext } from '~/mapModules/MapModule';
    import { legendVersion, showLegend } from '~/stores/legendStore';
    import { massifIconFont, massifIconFontFamily } from '~/utils/massif';
    import { colors } from '~/variables';
    $: ({ colorOnSurface, colorOnSurfaceVariant, colorSurfaceContainer } = $colors);

    // the swatch box, then the label, per row; a section title above its rows
    const SWATCH_W = 40;
    const SWATCH_H = 16;
    const ROW_H = 22;
    const SECTION_H = 26;

    interface LegendLine {
        color?: string;
        width?: number;
        opacity?: number;
        dasharray?: number[];
        offset?: number;
    }
    interface LegendItem {
        id: string;
        label: string | Record<string, string>;
        kind: 'line' | 'fill' | 'poi' | 'shield' | 'label';
        lines?: LegendLine[];
        color?: string;
        opacity?: number;
        pattern?: string;
        outline?: LegendLine;
        icon?: string;
        marker?: { color: string; size: number; border?: string; borderWidth?: number };
        glyph?: { char: string; font?: string; color?: string };
        text?: { value: string; color?: string; halo?: string };
        plate?: { color: string; border?: string; borderWidth?: number; radius?: number };
    }
    interface Legend {
        sections: { id: string; label: string | Record<string, string>; items: LegendItem[] }[];
    }

    /** the panel never grows past this: the map is what it is compared with */
    export let maxHeight = 400;
    const HEADER_H = 36;

    let legend: Legend = null;
    $: $legendVersion, $showLegend && readLegend();
    // one small canvas per swatch: a single canvas the legend's height outgrew the GPU's texture size and drew nothing
    $: rows = (legend ? legend.sections.flatMap((section) => [{ section }, ...section.items.map((item) => ({ item }))]) : []) as { section?: Legend['sections'][number]; item?: LegendItem }[];
    $: height = legend ? legend.sections.reduce((acc, section) => acc + SECTION_H + section.items.length * ROW_H, 0) + 8 : 0;

    function readLegend() {
        try {
            // not in the plugin's typed method list yet; the SDK has it
            const result = (getMapContext().mapDecoder as any)?.call('getLegend');
            legend = typeof result === 'string' ? JSON.parse(result) : result;
        } catch (error) {
            console.error('getLegend', error);
            legend = null;
        }
    }

    function text(label: string | Record<string, string>): string {
        if (label && typeof label === 'object') {
            return label[lang] ?? label.en ?? Object.values(label)[0];
        }
        return (label as string) ?? '';
    }

    const images = new Map<string, ImageSource>();
    // the style's swatch images, copied out of the package at build time (app.webpack.config.js)
    function image(file: string) {
        if (!images.has(file)) {
            const filePath = path.join(knownFolders.currentApp().path, 'assets', 'massif-legend', file);
            images.set(file, File.exists(filePath) ? ImageSource.fromFileSync(filePath) : null);
        }
        return images.get(file);
    }

    const paint = new Paint();
    paint.setAntiAlias(true);
    // its own paint, as the other icon canvases do: a family switched on a shared paint did not take
    const glyphPaint = new Paint();
    glyphPaint.setAntiAlias(true);
    $: glyphPaint.fontFamily = ($massifIconFont, massifIconFontFamily());
    glyphPaint.setTextAlign(Align.CENTER);

    function stroke(line: LegendLine, maxWidth: number) {
        paint.setStyle(Style.STROKE);
        paint.color = line.color ?? '#000';
        paint.strokeWidth = Math.min(line.width ?? 1, maxWidth);
        paint.setAlpha(Math.round((line.opacity ?? 1) * 255));
        paint.setPathEffect(line.dasharray?.length ? new DashPathEffect(line.dasharray, 0) : null);
    }
    function fill(color: string, opacity = 1) {
        paint.setStyle(Style.FILL);
        paint.setPathEffect(null);
        paint.color = color;
        paint.setAlpha(Math.round(opacity * 255));
    }
    function centeredText(canvas: Canvas, value: string, cx: number, cy: number, color: string, size: number) {
        fill(color ?? colorOnSurface);
        paint.textSize = size;
        paint.setTextAlign(Align.CENTER);
        canvas.drawText(value, cx, cy + size * 0.35, paint);
        paint.setTextAlign(Align.LEFT);
    }

    function drawSwatch(canvas: Canvas, item: LegendItem, x: number, y: number) {
        const cx = x + SWATCH_W / 2;
        const cy = y + SWATCH_H / 2;
        switch (item.kind) {
            case 'line':
                (item.lines ?? []).forEach((line) => {
                    stroke(line, SWATCH_H - 2);
                    canvas.drawLine(x, cy + (line.offset ?? 0), x + SWATCH_W, cy + (line.offset ?? 0), paint);
                });
                break;
            case 'fill': {
                const pattern = item.pattern && image(item.pattern);
                if (item.color) {
                    fill(item.color, item.opacity);
                    canvas.drawRect(x, y, x + SWATCH_W, y + SWATCH_H, paint);
                }
                if (pattern) {
                    fill('#000');
                    canvas.save();
                    canvas.clipRect(x, y, x + SWATCH_W, y + SWATCH_H);
                    for (let top = y; top < y + SWATCH_H; top += pattern.height) {
                        for (let left = x; left < x + SWATCH_W; left += pattern.width) {
                            canvas.drawBitmap(pattern, left, top, paint);
                        }
                    }
                    canvas.restore();
                }
                if (item.outline) {
                    stroke(item.outline, 3);
                    canvas.drawRect(x, y, x + SWATCH_W, y + SWATCH_H, paint);
                }
                break;
            }
            case 'shield':
                if (item.glyph || item.icon) {
                    // a POI badge: its disc and icon, not the category name the spec gives it
                    drawPoi(canvas, item, cx, cy);
                    break;
                }
                if (item.plate) {
                    fill(item.plate.color);
                    const radius = Math.min(item.plate.radius ?? 3, SWATCH_H / 2 - 1);
                    canvas.drawRoundRect(x + 2, y + 1, x + SWATCH_W - 2, y + SWATCH_H - 1, radius, radius, paint);
                    if (item.plate.border && item.plate.borderWidth) {
                        stroke({ color: item.plate.border, width: item.plate.borderWidth }, 3);
                        canvas.drawRoundRect(x + 2, y + 1, x + SWATCH_W - 2, y + SWATCH_H - 1, radius, radius, paint);
                    }
                }
                if (item.text) {
                    centeredText(canvas, item.text.value, cx, cy, item.text.color, 10);
                }
                break;
            case 'poi':
                drawPoi(canvas, item, cx, cy);
                break;
            default:
                if (item.text) {
                    centeredText(canvas, item.text.value, cx, cy, item.text.color, 11);
                }
        }
    }

    function drawPoi(canvas: Canvas, item: LegendItem, cx: number, cy: number) {
        const radius = SWATCH_H / 2;
        if (item.plate) {
            fill(item.plate.color);
            canvas.drawCircle(cx, cy, radius, paint);
            if (item.plate.border && item.plate.borderWidth) {
                stroke({ color: item.plate.border, width: item.plate.borderWidth }, 2);
                canvas.drawCircle(cx, cy, radius, paint);
            }
        }
        if (item.marker) {
            fill(item.marker.color);
            const markerRadius = Math.min(Math.max(item.marker.size / 2, 3), radius);
            canvas.drawCircle(cx, cy, markerRadius, paint);
            if (item.marker.border && item.marker.borderWidth) {
                stroke({ color: item.marker.border, width: item.marker.borderWidth }, 3);
                canvas.drawCircle(cx, cy, markerRadius, paint);
            }
        }
        if (item.glyph) {
            glyphPaint.color = item.glyph.color ?? colorOnSurface;
            glyphPaint.textSize = 11;
            canvas.drawText(item.glyph.char, cx, cy + 11 * 0.35, glyphPaint);
        } else if (item.icon && image(item.icon)) {
            canvas.drawBitmap(image(item.icon), null, new Rect(Math.round(cx - 7), Math.round(cy - 7), Math.round(cx + 7), Math.round(cy + 7)), paint);
        }
    }

    function drawRowSwatch(item: LegendItem, { canvas }: { canvas: Canvas }) {
        drawSwatch(canvas, item, 0, 0);
    }
</script>

<!-- a side panel, not a sheet: the map stays visible beside it to compare -->
<gridlayout backgroundColor={colorSurfaceContainer} borderRadius={12} height={Math.min(HEADER_H + Math.max(height, 40), maxHeight)} rows={`${HEADER_H},*`} width={220} {...$$restProps}>
    <gridlayout columns="*,auto" padding="0 6 0 10">
        <label color={colorOnSurface} fontSize={14} fontWeight="bold" text={lc('legend')} verticalAlignment="middle" />
        <label class="mdi" col={1} color={colorOnSurfaceVariant} fontSize={20} padding={4} text="mdi-close" on:tap={() => showLegend.set(false)} />
    </gridlayout>
    <scrollview row={1}>
        <stacklayout padding="0 0 8 10">
            {#each rows as row (row)}
                {#if row.section}
                    <label color={colorOnSurfaceVariant} fontSize={12} fontWeight="bold" height={SECTION_H} text={text(row.section.label)} verticalTextAlignment="bottom" />
                {:else}
                    <gridlayout columns={`${SWATCH_W},*`} height={ROW_H}>
                        <canvasview height={SWATCH_H} width={SWATCH_W} on:draw={(event) => drawRowSwatch(row.item, event)} />
                        <label col={1} color={colorOnSurface} fontSize={12} lineBreak="end" marginLeft={8} maxLines={1} text={text(row.item.label)} verticalTextAlignment="middle" />
                    </gridlayout>
                {/if}
            {/each}
        </stacklayout>
    </scrollview>
    {#if !legend}
        <label color={colorOnSurfaceVariant} fontSize={12} padding={10} row={1} text={lc('no_legend')} />
    {/if}
</gridlayout>
