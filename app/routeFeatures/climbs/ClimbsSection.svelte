<script lang="ts">
    // the climbs of a route, each with its sparkline, and under them the steep sections, folded away until asked for.
    // A descent is listed like the rest and never warned about. A tap on a row focuses it on the route.
    // One collectionview whatever the rows: its rows are built as they come into view
    import { Template } from '@nativescript-community/svelte-native/components';
    import { closeBottomSheet } from '@nativescript-community/ui-bottomsheet/svelte';
    import { Canvas, Paint, Path, Style } from '@nativescript-community/ui-canvas';
    import { Color } from '@nativescript/core';
    import PanelHeader from '~/components/common/PanelHeader.svelte';
    import { convertElevation, formatDistance } from '~/helpers/formatter';
    import { lc } from '~/helpers/locale';
    import { isEInk } from '~/helpers/theme';
    import type { IItem } from '~/models/Item';
    import { categoryLabel, readClimbs } from '~/routeFeatures/climbs/data';
    import { climbsSteepOpen } from '~/routeFeatures/climbs/settings';
    import type { Climb, SteepSection } from '~/routeFeatures/climbs/steep';
    import { focusKeyOf, focusSection } from '~/routeFeatures/lens/routeFocusStore';
    import { selectLens } from '~/routeFeatures/lens/routeLensStore';
    import type { LensSection } from '~/routeFeatures/registry';
    import { gradeBucketIndex, gradeColor, gradeShades } from '~/utils/grade';
    import { colors, fonts, windowInset } from '~/variables';

    export let item: IItem;

    let { colorBackground, colorError, colorOnSurface, colorOnSurfaceVariant, colorOutlineVariant, colorPrimary, colorSurfaceFill } = $colors;
    $: ({ colorBackground, colorError, colorOnSurface, colorOnSurfaceVariant, colorOutlineVariant, colorPrimary, colorSurfaceFill } = $colors);

    $: read = readClimbs(item);

    type Row = { type: 'climb'; climb: Climb; id: number } | { type: 'header'; count: number } | { type: 'steep'; section: SteepSection; id: number };
    $: rows = [
        ...(read?.climbs ?? []).map((climb, id): Row => ({ type: 'climb', climb, id })),
        ...(read?.steep.length ? [{ type: 'header' as const, count: read.steep.length }] : []),
        ...($climbsSteepOpen ? (read?.steep ?? []).map((section, id): Row => ({ type: 'steep', section, id })) : [])
    ];
    function itemTemplateSelector(row: Row) {
        return row.type;
    }

    const SPARKLINE_POINTS = 40;
    // the profile's own look: the fill is the grade's colour, as it is under the chart, and a thin line draws the shape
    const GRADE_FILL_ALPHA = 225;
    const strokePaint = new Paint();
    strokePaint.setStyle(Style.STROKE);
    strokePaint.setStrokeWidth(1.5);
    const fillPaint = new Paint();
    fillPaint.setStyle(Style.FILL);

    // the climb's own profile, scaled to its own height: its shape is what the row shows
    function drawSparkline({ canvas }: { canvas: Canvas }, climb: Climb) {
        const data = item.profile?.data;
        if (!data) {
            return;
        }
        const width = canvas.getWidth();
        const height = canvas.getHeight();
        const step = Math.max(1, Math.floor((climb.endIndex - climb.startIndex) / SPARKLINE_POINTS));
        const indexes: number[] = [];
        for (let index = climb.startIndex; index < climb.endIndex; index += step) {
            indexes.push(index);
        }
        indexes.push(climb.endIndex);
        const low = data[climb.startIndex].a;
        const high = Math.max(data[climb.endIndex].a, low + 1);
        const points = indexes.map((index) => ({
            x: ((data[index].d - climb.startDistance) / climb.length) * width,
            y: height - 2 - ((data[index].a - low) / (high - low)) * (height - 4),
            grade: data[index].g ?? 0
        }));
        const line = new Path();
        const quad = new Path();
        points.forEach((point, position) => {
            if (position === 0) {
                line.moveTo(point.x, point.y);
                return;
            }
            const previous = points[position - 1];
            line.lineTo(point.x, point.y);
            // a slice under each stretch of the line, in the colour of its grade
            quad.reset();
            quad.moveTo(previous.x, previous.y);
            quad.lineTo(point.x, point.y);
            quad.lineTo(point.x, height);
            quad.lineTo(previous.x, height);
            quad.close();
            // the grade's colour, and on e-ink its shade of black, as under the chart
            fillPaint.color = isEInk ? new Color('#000000').setAlpha(gradeShades[gradeBucketIndex(point.grade)]).hex : new Color(gradeColor(point.grade)).setAlpha(GRADE_FILL_ALPHA).hex;
            canvas.drawPath(quad, fillPaint);
        });
        strokePaint.color = isEInk ? colorOnSurface : colorOnSurfaceVariant;
        canvas.drawPath(line, strokePaint);
    }

    function focus(section: LensSection) {
        selectLens('climbs');
        focusSection(focusKeyOf(item), { ...section, lens: 'climbs' });
        // the map is behind the sheet, and that is where the section is shown
        closeBottomSheet();
    }
    function climbSection(climb: Climb, id: number): LensSection {
        return {
            id,
            i0: climb.startIndex,
            i1: climb.endIndex,
            title: [climb.category && categoryLabel(climb.category), formatDistance(climb.length), climb.avgGrade.toFixed(1) + ' %'].filter(Boolean).join(' · ')
        };
    }
    function steepSection(section: SteepSection, id: number): LensSection {
        const label = section.direction === 'down' ? 'climbs_steep_descent' : section.level === 2 ? 'climbs_very_steep' : 'climbs_steep';
        return { id, i0: section.startIndex, i1: section.endIndex, title: [lc(label, formatDistance(section.length)), Math.abs(section.avgGrade).toFixed(0) + ' %'].join(' · ') };
    }
    const grade = (value: number) => Math.abs(value).toFixed(1) + ' %';
</script>

<gesturerootview class="bottomsheet" rows="auto,*">
    <PanelHeader icon="mdi-slope-uphill" title={lc('lens_climbs')} />
    <!-- the inset goes on the content: the collectionview scrolls under it -->
    <collectionview id="scrollView" {itemTemplateSelector} items={rows} paddingBottom={10 + (__ANDROID__ ? $windowInset.bottom : 0)} row={1} ios:contentInsetAdjustmentBehavior={2}>
        <Template key="climb" let:item>
            <gridlayout
                borderBottomColor={colorOutlineVariant}
                borderBottomWidth={1}
                columns="60,*,90"
                height={64}
                padding="0 16"
                rippleColor={colorPrimary}
                on:tap={() => focus(climbSection(item.climb, item.id))}>
                <!-- the category on a plate, the way the profile's brackets carry it -->
                <gridlayout backgroundColor={isEInk ? '#000000' : colorOnSurface} borderRadius={6} height={24} horizontalAlignment="left" padding="0 7" verticalAlignment="middle">
                    <label
                        color={isEInk ? '#ffffff' : colorBackground}
                        fontSize={12}
                        fontWeight="bold"
                        text={item.climb.category ? categoryLabel(item.climb.category) : '–'}
                        verticalAlignment="middle" />
                </gridlayout>
                <stacklayout col={1} verticalAlignment="middle">
                    <label color={colorOnSurface} fontSize={15} fontWeight="bold" text={`${formatDistance(item.climb.length)} · ${grade(item.climb.avgGrade)}`} />
                    <label
                        color={colorOnSurfaceVariant}
                        fontSize={12}
                        text={`+${convertElevation(item.climb.gain)} · ${formatDistance(item.climb.startDistance)} → ${formatDistance(item.climb.endDistance)}`} />
                </stacklayout>
                <canvasview col={2} height={40} margin="0 0 0 10" verticalAlignment="middle" on:draw={(event) => drawSparkline(event, item.climb)} />
            </gridlayout>
        </Template>
        <Template key="header" let:item>
            <gridlayout columns="24,*,auto" height={44} padding="0 16" rippleColor={colorPrimary} on:tap={() => climbsSteepOpen.set(!$climbsSteepOpen)}>
                <label color={colorOnSurfaceVariant} fontFamily={$fonts.mdi} fontSize={20} text={$climbsSteepOpen ? 'mdi-chevron-down' : 'mdi-chevron-right'} verticalAlignment="middle" />
                <label class="sectionHeader" col={1} padding="0" text={lc('climbs_steep_sections')} verticalAlignment="middle" />
                <label col={2} color={colorOnSurfaceVariant} fontSize={13} text={String(item.count)} verticalAlignment="middle" />
            </gridlayout>
        </Template>
        <Template key="steep" let:item>
            <gridlayout columns="40,*,auto" height={52} padding="0 16" rippleColor={colorPrimary} on:tap={() => focus(steepSection(item.section, item.id))}>
                <label
                    color={item.section.direction === 'up' && item.section.level === 2 && !isEInk ? colorError : colorOnSurfaceVariant}
                    fontFamily={$fonts.mdi}
                    fontSize={20}
                    text={item.section.direction === 'up' ? 'mdi-arrow-top-right' : 'mdi-arrow-bottom-right'}
                    verticalAlignment="middle" />
                <stacklayout col={1} verticalAlignment="middle">
                    <label color={colorOnSurface} fontSize={14} fontWeight="bold" text={`${formatDistance(item.section.startDistance)} → ${formatDistance(item.section.endDistance)}`} />
                    <label color={colorOnSurfaceVariant} fontSize={12} text={`${formatDistance(item.section.length)} · ${grade(item.section.avgGrade)} · max ${grade(item.section.maxGrade)}`} />
                </stacklayout>
                <label col={2} color={colorOnSurfaceVariant} fontSize={12} text={`${item.section.gain > 0 ? '+' : '−'}${convertElevation(Math.abs(item.section.gain))}`} verticalAlignment="middle" />
            </gridlayout>
        </Template>
    </collectionview>
</gesturerootview>
