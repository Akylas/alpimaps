<script lang="ts">
    import SharedCActionBar from '@shared/components/CActionBar.svelte';
    import { actionBarHeight, fontScale, windowInset } from '~/variables';

    export let height = null;
    export let paddingTop = null;
    export let onClose: Function = null;

    $: ({ top: windowInsetTop } = $windowInset);
</script>

<!-- the app's design: a title spanning the bar, the top inset as padding, a second row for the `bottom` slot and no side padding -->
<SharedCActionBar
    blockTouches={true}
    {onClose}
    paddingLeft={0}
    paddingRight={0}
    paddingTop={paddingTop || windowInsetTop}
    rows={`${height || $actionBarHeight},auto`}
    titleLineBreak={null}
    useInsetMargin={false}
    {...$$restProps}
    titleProps={{
        id: 'actionBarTitle',
        colSpan: 3,
        maxFontSize: 20 * $fontScale,
        minFontSize: 12 * $fontScale,
        paddingLeft: 0,
        ...$$restProps?.titleProps
    }}>
    <slot name="left" slot="left" />
    <slot name="center" slot="center" />
    <slot name="bottom" slot="bottom" />
    <slot />
</SharedCActionBar>
