<script lang="ts">
    import SharedListItemAutoSize from '@shared/components/ListItemAutoSize.svelte';
    import { colors } from '~/variables';
    import { ListItem } from './ListItem';

    let { colorOnSurface } = $colors;
    $: ({ colorOnSurface } = $colors);

    export let item: ListItem;
    export let fontSize: number = 17;
    export let subtitleFontSize: number = 14;
    /** A leading icon on a primary tint, in column 0: callers shift `columns`/`mainCol` for it. */
    export let icon: string = null;
    export let iconFontFamily: string = null;
    export let symbol: string = null;
    export let showSymbol: boolean = false;
    export let symbolColor: string = null;
    export let onLongPress: (item, e) => void = null;
</script>

<!-- the app's design: smaller text, a leading icon or symbol, a long press that hands over the item, and the row not hidden from accessibility -->
<SharedListItemAutoSize
    accessibilityHidden={false}
    {fontSize}
    {item}
    lineHeightFactor={null}
    longPressWithItem={true}
    {onLongPress}
    rippleColor={item.color || colorOnSurface}
    {subtitleFontSize}
    {...$$restProps}
    on:tap
    on:rightIconTap>
    <svelte:fragment slot="leading">
        {#if showSymbol}
            <symbolshape color={symbolColor} height={34} {symbol} verticalAlignment="middle" width={34} />
        {/if}
        {#if icon}
            <label class="listIcon" text={icon} {...iconFontFamily ? { fontFamily: iconFontFamily } : {}} />
        {/if}
    </svelte:fragment>
    <slot />
</SharedListItemAutoSize>
