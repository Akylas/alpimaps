<script lang="ts">
    // a small rounded figure: an icon, a value in bold and its unit after it, in a lighter type, on a light fill. The way a weather
    // reads at a glance: one chip a fact. E-ink: outlined, in black. `color` tints the icon, `tint` the fill, and a warning the whole chip
    import { Color } from '@nativescript/core';
    import { isEInk } from '~/helpers/theme';
    import { colors, fonts } from '~/variables';

    export let icon: string = null;
    /** what the icon is drawn in; the text colour when missing */
    export let iconColor: string = null;
    /** before the value, in the lighter type: a word that says what the value is */
    export let label: string = null;
    /** the bold part. A chip may have a `text` instead, all in bold: a fact in words */
    export let value: string = null;
    export let unit: string = null;
    export let text: string = null;
    /** after the unit, lighter still: what the value is of */
    export let note: string = null;
    /** the value's colour, when it says something (a wind against, rain) */
    export let color: string = null;
    /** the chip's fill: a wash of `color` when it has one, else the neutral fill */
    export let tint: string = null;
    /** 0..1: a thin bar under the value, as oss-weather draws the rain, filled to that share of the chip */
    export let bar: number = null;
    /** the chip is a warning: it takes the error colour */
    export let alert = false;
    export let height = 26;

    let { colorError, colorOnSurface, colorOnSurfaceVariant, colorSurfaceFill } = $colors;
    $: ({ colorError, colorOnSurface, colorOnSurfaceVariant, colorSurfaceFill } = $colors);
    $: wash = tint ?? (color && !alert ? new Color(color).setAlpha(40).hex : colorSurfaceFill);
    $: barPercent = Math.round(Math.max(0, Math.min(1, bar ?? 0)) * 100);
    $: ink = isEInk ? colorOnSurface : alert ? colorError : (color ?? colorOnSurface);
</script>

<gridlayout
    backgroundColor={isEInk ? null : wash}
    borderColor={isEInk ? colorOnSurface : null}
    borderRadius={height / 2}
    borderWidth={isEInk ? 1 : 0}
    columns="auto"
    horizontalAlignment="left"
    {height}
    marginRight={6}
    marginTop={4}
    padding="0 10"
    {...$$restProps}
    on:tap>
    <!-- always the same spans: a formatted string whose children come and go breaks the update -->
    <label color={colorOnSurface} fontSize={12} maxLines={1} verticalAlignment="middle">
        <span color={isEInk ? colorOnSurface : (iconColor ?? ink)} fontFamily={$fonts.mdi} fontSize={15} text={icon ?? ''} />
        <span color={colorOnSurfaceVariant} text={label ? (icon ? ' ' : '') + label : ''} />
        <span color={ink} fontSize={13} fontWeight="bold" text={(icon || label ? ' ' : '') + (value ?? text ?? '')} />
        <span color={colorOnSurfaceVariant} fontSize={11} text={unit ? ' ' + unit : ''} />
        <span color={colorOnSurfaceVariant} fontSize={11} text={note ? ' ' + note : ''} />
    </label>
    <!-- a gradient, not star columns: those would take the room they are given and stretch the chip to its container.
         Always there, collapsed without a bar: a chip in a list template must keep its structure from one item to the next -->
    <gridlayout
        backgroundImage={`linear-gradient(to right, ${ink} ${barPercent}%, transparent ${barPercent}%)`}
        borderColor={isEInk ? ink : null}
        borderRadius={1.25}
        borderWidth={isEInk ? 1 : 0}
        height={2.5}
        margin="0 10 2 10"
        verticalAlignment="bottom"
        visibility={bar !== null && bar !== undefined ? 'visible' : 'collapse'} />
</gridlayout>
