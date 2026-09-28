<script lang="ts">
    // the peak finder sky panel header: a primary icon, a bold title, a muted subtitle
    export let icon: string = null;
    export let iconFontFamily: string = null;
    export let title: string = null;
    export let subtitle: string = null;
    export let onClose: () => void = null;
</script>

<gridlayout columns="auto,*,auto,auto" padding="6 8 6 16" {...$$restProps}>
    <label class="panelIcon" text={icon} visibility={icon ? 'visible' : 'collapse'} {...iconFontFamily ? { fontFamily: iconFontFamily } : {}} />
    <stacklayout col={1} paddingLeft={icon ? 12 : 0} verticalAlignment="middle">
        <label class="panelTitle" lineBreak="end" maxLines={1} text={title} />
        <label class="panelSubtitle" lineBreak="end" maxLines={1} text={subtitle} visibility={subtitle ? 'visible' : 'collapse'} />
    </stacklayout>
    <stacklayout col={2} orientation="horizontal" verticalAlignment="middle">
        <slot />
    </stacklayout>
    {#if onClose}
        <mdbutton class="actionBarButton" col={3} text="mdi-chevron-down" variant="text" width={44} on:tap={onClose} />
    {/if}
</gridlayout>
