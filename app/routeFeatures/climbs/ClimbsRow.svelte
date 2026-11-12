<script context="module" lang="ts">
    import { Color } from '@nativescript/core';
    import { isEInk } from '~/helpers/theme';
    import { gradeBucketIndex, gradeColor, gradeShades } from '~/utils/grade';

    // the profile's own look: the fill is the grade's colour, as it is under the chart, and a thin line draws the shape
    const GRADE_FILL_ALPHA = 225;
    const colorFills = new Map<number, string>();
    const einkFills = new Map<number, string>();
    // the grade's colour, and on e-ink its shade of black, as under the chart: one per bucket, not one per segment drawn
    function gradeFill(grade: number) {
        const bucket = gradeBucketIndex(grade);
        const fills = isEInk ? einkFills : colorFills;
        let fill = fills.get(bucket);
        if (!fill) {
            fill = isEInk ? new Color('#000000').setAlpha(gradeShades[bucket]).hex : new Color(gradeColor(grade)).setAlpha(GRADE_FILL_ALPHA).hex;
            fills.set(bucket, fill);
        }
        return fill;
    }
</script>

<script lang="ts">
    // one row of the climbs list, in the climbs sheet and on the route page: a climb with its sparkline, the steep
    // sections' header, or a steep section. A tap on a climb or a section asks to focus it
    import { Canvas, Paint, Path, Style } from '@nativescript-community/ui-canvas';
    import { createEventDispatcher } from '@shared/utils/svelte/ui';
    import { convertElevation, formatDistance } from '~/helpers/formatter';
    import { lc } from '~/helpers/locale';
    import type { IItem } from '~/models/Item';
    import { type ClimbsRowData, type SteepScale, categoryLabel, readClimbs, steepTitle } from '~/routeFeatures/climbs/data';
    import { climbsSteepOpen } from '~/routeFeatures/climbs/settings';
    import type { Climb, SteepSection } from '~/routeFeatures/climbs/steep';
    import type { LensSection } from '~/routeFeatures/registry';
    import { colors, fonts } from '~/variables';

    export let item: IItem;
    export let data: ClimbsRowData;

    interface $$Events {
        focus: LensSection;
    }
    const dispatch = createEventDispatcher<$$Events>();

    let { colorBackground, colorOnSurface, colorOnSurfaceVariant, colorOutlineVariant, colorPrimary } = $colors;
    $: ({ colorBackground, colorOnSurface, colorOnSurfaceVariant, colorOutlineVariant, colorPrimary } = $colors);

    const SPARKLINE_POINTS = 40;
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
            fillPaint.color = gradeFill(point.grade);
            canvas.drawPath(quad, fillPaint);
        });
        strokePaint.color = isEInk ? colorOnSurface : colorOnSurfaceVariant;
        canvas.drawPath(line, strokePaint);
    }

    function steepSection(section: SteepSection, id: number): LensSection {
        return { id, i0: section.startIndex, i1: section.endIndex, title: steepTitle(section) };
    }

    const RAMP_WIDTH = 56;
    const BAR_WIDTH = 5;
    const BAR_GAP = 3;
    const rampPath = new Path();
    const outlinePaint = new Paint();
    outlinePaint.setStyle(Style.STROKE);
    outlinePaint.setStrokeWidth(1);
    // the section's ramp, its width the length and its height the gain, on the scale every row shares; then how hard it
    // is, as three bars. Neither needs colour: on e-ink the ramp is solid, grey or outlined by how hard it is
    function drawSteep({ canvas }: { canvas: Canvas }, section: SteepSection, scale: SteepScale) {
        const height = canvas.getHeight();
        const top = 4;
        const bottom = height - 4;
        const rampHeight = Math.max(2, ((bottom - top) * Math.abs(section.gain)) / scale.gain);
        const rampWidth = Math.max(4, (RAMP_WIDTH * section.length) / scale.length);
        const right = RAMP_WIDTH;
        rampPath.reset();
        if (section.direction === 'up') {
            rampPath.moveTo(right - rampWidth, bottom);
            rampPath.lineTo(right, bottom);
            rampPath.lineTo(right, bottom - rampHeight);
        } else {
            rampPath.moveTo(right - rampWidth, bottom - rampHeight);
            rampPath.lineTo(right - rampWidth, bottom);
            rampPath.lineTo(right, bottom);
        }
        rampPath.close();
        if (isEInk) {
            fillPaint.color = new Color('#000000').setAlpha(section.tier === 3 ? 255 : section.tier === 2 ? 110 : 0).hex;
        } else {
            fillPaint.color = gradeColor(section.avgGrade);
        }
        canvas.drawPath(rampPath, fillPaint);
        outlinePaint.color = isEInk ? '#000000' : colorOnSurfaceVariant;
        canvas.drawPath(rampPath, outlinePaint);
        const strong = isEInk ? '#000000' : gradeColor(section.avgGrade);
        for (let bar = 0; bar < 3; bar++) {
            const left = RAMP_WIDTH + 10 + bar * (BAR_WIDTH + BAR_GAP);
            const barTop = bottom - (bottom - top) * ((bar + 1) / 3);
            if (bar < section.tier) {
                fillPaint.color = strong;
                canvas.drawRect(left, barTop, left + BAR_WIDTH, bottom, fillPaint);
            } else {
                outlinePaint.color = isEInk ? '#000000' : colorOutlineVariant;
                canvas.drawRect(left, barTop, left + BAR_WIDTH, bottom, outlinePaint);
            }
        }
    }
    const chevronText = (count: number) => '›'.repeat(count);
    const grade = (value: number) => Math.abs(value).toFixed(1) + ' %';
</script>

{#if data.type === 'climb'}
    {@const climb = data.climb}
    <gridlayout
        borderBottomColor={colorOutlineVariant}
        borderBottomWidth={1}
        columns="60,*,90"
        height={64}
        padding="0 16"
        rippleColor={colorPrimary}
        on:tap={() => dispatch('focus', readClimbs(item)?.sections[data.id])}>
        <!-- the category on a plate, the way the profile's brackets carry it -->
        <label
            backgroundColor={isEInk ? '#000000' : colorOnSurface}
            borderRadius={6}
            color={isEInk ? '#ffffff' : colorBackground}
            fontSize={12}
            fontWeight="bold"
            height={24}
            horizontalAlignment="left"
            padding="0 7"
            text={climb.category ? categoryLabel(climb.category) : '–'}
            verticalAlignment="middle"
            verticalTextAlignment="middle" />
        <label col={1} verticalAlignment="middle">
            <cspan color={colorOnSurface} fontSize={15} fontWeight="bold" text={`${formatDistance(climb.length)} · ${grade(climb.avgGrade)}`} />
            <cspan color={colorOnSurfaceVariant} fontSize={12} text={`\n+${convertElevation(climb.gain)} · ${formatDistance(climb.startDistance)} → ${formatDistance(climb.endDistance)}`} />
        </label>
        <canvasview col={2} height={40} margin="0 0 0 10" verticalAlignment="middle" on:draw={(event) => drawSparkline(event, climb)} />
    </gridlayout>
{:else if data.type === 'header'}
    <gridlayout columns="24,*,auto" height={44} padding="0 16" rippleColor={colorPrimary} on:tap={() => climbsSteepOpen.set(!$climbsSteepOpen)}>
        <label color={colorOnSurfaceVariant} fontFamily={$fonts.mdi} fontSize={20} text={$climbsSteepOpen ? 'mdi-chevron-down' : 'mdi-chevron-right'} verticalAlignment="middle" />
        <label class="sectionHeader" col={1} padding="0" text={lc('climbs_steep_sections')} verticalAlignment="middle" />
        <label col={2} color={colorOnSurfaceVariant} fontSize={13} text={String(data.count)} verticalAlignment="middle" />
    </gridlayout>
{:else}
    {@const section = data.section}
    {@const { id, scale, chevrons } = data}
    {@const solid = !isEInk || chevrons > 1}
    <gridlayout columns="72,*,90" height={56} padding="0 16" rippleColor={colorPrimary} on:tap={() => dispatch('focus', steepSection(section, id))}>
        <!-- the average grade, and how far past steep it is in chevrons -->
        <label
            backgroundColor={isEInk ? (solid ? '#000000' : '#ffffff') : gradeColor(section.avgGrade)}
            borderColor="#000000"
            borderRadius={6}
            borderWidth={isEInk ? 1.5 : 0}
            color={isEInk && !solid ? '#000000' : '#ffffff'}
            fontSize={12}
            fontWeight="bold"
            height={24}
            horizontalAlignment="left"
            padding="0 6"
            text={`${section.direction === 'down' ? '↘ ' : ''}${Math.abs(section.avgGrade).toFixed(0)} % ${chevronText(chevrons)}`}
            verticalAlignment="middle"
            verticalTextAlignment="middle" />
        <label col={1} verticalAlignment="middle">
            <cspan color={colorOnSurface} fontSize={14} fontWeight="bold" text={`${formatDistance(section.length)} · ${section.gain > 0 ? '+' : '−'}${convertElevation(Math.abs(section.gain))}`} />
            <cspan color={colorOnSurfaceVariant} fontSize={12} text={`\n${formatDistance(section.startDistance)} → ${formatDistance(section.endDistance)} · max ${grade(section.maxGrade)}`} />
        </label>
        <canvasview col={2} height={32} verticalAlignment="middle" on:draw={(event) => drawSteep(event, section, scale)} />
    </gridlayout>
{/if}
