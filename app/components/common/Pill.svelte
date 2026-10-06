<script lang="ts">
    // the sky toggle as a reusable pill: outlined, tinted when selected, filled for a view's one main action.
    // A layout rather than an mdbutton: inside the item sheet, the sheet's pan gesture swallows a native
    // button's touches, taps and long presses alike
    import { isEInk } from '~/helpers/theme';
    import { colors, fonts } from '~/variables';

    export let icon: string = null;
    export let iconFontFamily: string = null;
    export let label: string = null;
    export let selected = false;
    export let primary = false;
    export let danger = false;
    /** Overrides the content colour, eg a setting's strength. */
    export let color: string = null;

    let { colorError, colorOnPrimary, colorOnSurface, colorPrimary } = $colors;
    $: ({ colorError, colorOnPrimary, colorOnSurface, colorPrimary } = $colors);

    $: clazz = 'chip' + (primary ? ' primary' : selected ? ' selected' : '') + (danger ? ' danger' : '');
    $: contentColor = color || (primary || (selected && isEInk) ? (isEInk ? 'white' : colorOnPrimary) : danger ? colorError : selected ? colorPrimary : colorOnSurface);
</script>

<gridlayout class={clazz} horizontalAlignment="left" rippleColor={primary ? colorOnPrimary : colorPrimary} {...$$restProps} on:tap on:longPress>
    <stacklayout horizontalAlignment="center" orientation="horizontal" verticalAlignment="middle">
        {#if icon}
            <label color={contentColor} fontFamily={iconFontFamily || $fonts.mdi} fontSize={18} text={icon} verticalAlignment="middle" />
        {/if}
        {#if label}
            <label color={contentColor} fontSize={14} fontWeight={primary || selected ? 'bold' : 'normal'} maxLines={1} paddingLeft={icon ? 6 : 0} text={label} verticalAlignment="middle" />
        {/if}
    </stacklayout>
</gridlayout>
