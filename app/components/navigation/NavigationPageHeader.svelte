<script lang="ts">
    import { navigationScale } from '~/stores/navigationStore';
    import { colors } from '~/variables';

    $: ({ colorOnSurface, colorOnSurfaceVariant } = $colors);

    // the line every dock page starts with: what it is on the left, what it says of the route on the right
    export let title: string;
    export let detail: string = '';
    export let detailColor: string = null;
</script>

<gridlayout columns="*,auto" height={Math.round(20 * $navigationScale)} {...$$restProps} on:tap>
    <label color={colorOnSurfaceVariant} fontSize={11 * $navigationScale} fontWeight="500" lineBreak="end" maxLines={1} text={title.toLocaleUpperCase()} verticalAlignment="center" />
    <label col={1} color={detailColor ?? colorOnSurface} fontSize={12 * $navigationScale} fontWeight="500" lineBreak="end" marginLeft={8} maxLines={1} text={detail} verticalAlignment="center" />
</gridlayout>
