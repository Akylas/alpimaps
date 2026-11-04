<script lang="ts">
    // one row of the climbs list, in the climbs sheet and on the route page: a climb with its sparkline, the steep
    // sections' header, or a steep section. A tap on a climb or a section asks to focus it
    import { Canvas, Paint, Path, Style } from '@nativescript-community/ui-canvas';
    import { Color } from '@nativescript/core';
    import { createEventDispatcher } from '@shared/utils/svelte/ui';
    import { convertElevation, formatDistance } from '~/helpers/formatter';
    import { lc } from '~/helpers/locale';
    import { isEInk } from '~/helpers/theme';
    import type { IItem } from '~/models/Item';
    import { type ClimbsRowData, categoryLabel, readClimbs } from '~/routeFeatures/climbs/data';
    import { climbsSteepOpen } from '~/routeFeatures/climbs/settings';
    import type { Climb, SteepSection } from '~/routeFeatures/climbs/steep';
    import type { LensSection } from '~/routeFeatures/registry';
    import { gradeBucketIndex, gradeColor, gradeShades } from '~/utils/grade';
    import { colors, fonts } from '~/variables';

    export let item: IItem;
    export let data: ClimbsRowData;

    interface $$Events {
        focus: LensSection;
    }
    const dispatch = createEventDispatcher<$$Events>();

    let { colorBackground, colorError, colorOnSurface, colorOnSurfaceVariant, colorOutlineVariant, colorPrimary } = $colors;
    $: ({ colorBackground, colorError, colorOnSurface, colorOnSurfaceVariant, colorOutlineVariant, colorPrimary } = $colors);

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

    function steepSection(section: SteepSection, id: number): LensSection {
        const label = section.direction === 'down' ? 'climbs_steep_descent' : section.level === 2 ? 'climbs_very_steep' : 'climbs_steep';
        return { id, i0: section.startIndex, i1: section.endIndex, title: [lc(label, formatDistance(section.length)), Math.abs(section.avgGrade).toFixed(0) + ' %'].join(' · ') };
    }
    const grade = (value: number) => Math.abs(value).toFixed(1) + ' %';
</script>

{#if data.type === 'climb'}
    <gridlayout
        borderBottomColor={colorOutlineVariant}
        borderBottomWidth={1}
        columns="60,*,90"
        height={64}
        padding="0 16"
        rippleColor={colorPrimary}
        on:tap={() => dispatch('focus', readClimbs(item)?.sections[data.id])}>
        <!-- the category on a plate, the way the profile's brackets carry it -->
        <gridlayout backgroundColor={isEInk ? '#000000' : colorOnSurface} borderRadius={6} height={24} horizontalAlignment="left" padding="0 7" verticalAlignment="middle">
            <label color={isEInk ? '#ffffff' : colorBackground} fontSize={12} fontWeight="bold" text={data.climb.category ? categoryLabel(data.climb.category) : '–'} verticalAlignment="middle" />
        </gridlayout>
        <stacklayout col={1} verticalAlignment="middle">
            <label color={colorOnSurface} fontSize={15} fontWeight="bold" text={`${formatDistance(data.climb.length)} · ${grade(data.climb.avgGrade)}`} />
            <label
                color={colorOnSurfaceVariant}
                fontSize={12}
                text={`+${convertElevation(data.climb.gain)} · ${formatDistance(data.climb.startDistance)} → ${formatDistance(data.climb.endDistance)}`} />
        </stacklayout>
        <canvasview col={2} height={40} margin="0 0 0 10" verticalAlignment="middle" on:draw={(event) => data.type === 'climb' && drawSparkline(event, data.climb)} />
    </gridlayout>
{:else if data.type === 'header'}
    <gridlayout columns="24,*,auto" height={44} padding="0 16" rippleColor={colorPrimary} on:tap={() => climbsSteepOpen.set(!$climbsSteepOpen)}>
        <label color={colorOnSurfaceVariant} fontFamily={$fonts.mdi} fontSize={20} text={$climbsSteepOpen ? 'mdi-chevron-down' : 'mdi-chevron-right'} verticalAlignment="middle" />
        <label class="sectionHeader" col={1} padding="0" text={lc('climbs_steep_sections')} verticalAlignment="middle" />
        <label col={2} color={colorOnSurfaceVariant} fontSize={13} text={String(data.count)} verticalAlignment="middle" />
    </gridlayout>
{:else}
    <gridlayout columns="40,*,auto" height={52} padding="0 16" rippleColor={colorPrimary} on:tap={() => data.type === 'steep' && dispatch('focus', steepSection(data.section, data.id))}>
        <label
            color={data.section.direction === 'up' && data.section.level === 2 && !isEInk ? colorError : colorOnSurfaceVariant}
            fontFamily={$fonts.mdi}
            fontSize={20}
            text={data.section.direction === 'up' ? 'mdi-arrow-top-right' : 'mdi-arrow-bottom-right'}
            verticalAlignment="middle" />
        <stacklayout col={1} verticalAlignment="middle">
            <label color={colorOnSurface} fontSize={14} fontWeight="bold" text={`${formatDistance(data.section.startDistance)} → ${formatDistance(data.section.endDistance)}`} />
            <label color={colorOnSurfaceVariant} fontSize={12} text={`${formatDistance(data.section.length)} · ${grade(data.section.avgGrade)} · max ${grade(data.section.maxGrade)}`} />
        </stacklayout>
        <label col={2} color={colorOnSurfaceVariant} fontSize={12} text={`${data.section.gain > 0 ? '+' : '−'}${convertElevation(Math.abs(data.section.gain))}`} verticalAlignment="middle" />
    </gridlayout>
{/if}
