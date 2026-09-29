<script lang="ts">
    // the sky toggle as a reusable pill: outlined, tinted when selected, filled for a view's one main action
    import { fonts } from '~/variables';

    export let icon: string = null;
    export let iconFontFamily: string = null;
    export let label: string = null;
    export let selected = false;
    export let primary = false;
    export let danger = false;

    $: clazz = 'chip' + (primary ? ' primary' : selected ? ' selected' : '') + (danger ? ' danger' : '');
</script>

<mdbutton class={clazz} variant="flat" {...$$restProps} on:tap on:longPress>
    {#if icon}
        <cspan fontFamily={iconFontFamily || $fonts.mdi} fontSize={18} text={icon} verticalAlignment="middle" />
    {/if}
    {#if label}
        <cspan text={(icon ? ' ' : '') + label} verticalAlignment="middle" />
    {/if}
</mdbutton>
