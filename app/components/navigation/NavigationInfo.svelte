<script lang="ts">
    import { navigationScale } from '~/stores/navigationStore';
    import { colors } from '~/variables';

    $: ({ colorOnSurface, colorOnSurfaceVariant } = $colors);

    // one figure: its width is its cell's, so a changing value never moves its neighbours
    export let label: string = null;
    export let value: string = '-';
    export let unit: string = null;
    export let valueFontSize = 28;
    export let labelFontSize = 12;
</script>

<stacklayout verticalAlignment="center" {...$$restProps}>
    <label color={colorOnSurfaceVariant} fontSize={labelFontSize * $navigationScale} lineBreak="end" maxLines={1} text={label} visibility={label ? 'visible' : 'collapse'} />
    <label lineBreak="end" maxLines={1}>
        <cspan color={colorOnSurface} fontSize={valueFontSize * $navigationScale} fontWeight="bold" text={value} />
        <cspan color={colorOnSurfaceVariant} fontSize={11 * $navigationScale} text={unit ? ' ' + unit : ''} />
    </label>
</stacklayout>
