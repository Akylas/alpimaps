<script lang="ts">
    import { Canvas, CanvasView } from '@nativescript-community/ui-canvas';
    import { createEventDispatcher } from '~/utils/svelte/ui';
    import { colors, fontScale, fonts } from '~/variables';
    let { colorOnSurface, colorOnSurfaceVariant, colorPrimary, colorOutlineVariant } = $colors;
    $: ({ colorOnSurface, colorOnSurfaceVariant, colorPrimary, colorOutlineVariant } = $colors);
    const dispatch = createEventDispatcher();
    // technique for only specific properties to get updated on store change
    export let showBottomLine: boolean = false;
    export let extraPaddingLeft: number = 0;
    export let iconFontSize: number = 24;
    export let fontSize: number = 17;
    export let fontWeight: string = 'bold';
    export let subtitleFontSize: number = 14;
    export let title: string = null;
    // export let titleColor: string = colorOnSurface;
    // export let subtitleColor: string = subtitleColor;
    export let subtitle: string = null;
    export let leftIcon: string = null;
    export let columns: string = '*';
    export let mainCol = 0;
    export let leftIconFonFamily: string = $fonts.mdi;
    export let symbol: string = null;
    export let symbolColor: string = null;
    export let color: string = null;
    export let showSymbol: boolean = false;
    export let onDraw: (event: { canvas: Canvas; object: CanvasView }) => void = null;
</script>

<canvasview {columns} disableCss={true} rippleColor={color || colorOnSurface} on:tap={(event) => dispatch('tap', event)} {...$$restProps} padding="10 16 10 16">
    <symbolshape color={symbolColor} height={34} {symbol} verticalAlignment="middle" visibility={showSymbol ? 'visible' : 'hidden'} width={34} />
    <canvaslabel col={mainCol} on:draw={onDraw}>
        <cgroup paddingBottom={subtitle ? 10 : 0} verticalAlignment="middle">
            <cspan
                color={color || colorOnSurface}
                fontFamily={leftIconFonFamily}
                fontSize={iconFontSize * $fontScale}
                paddingLeft="10"
                text={leftIcon}
                visibility={leftIcon ? 'visible' : 'hidden'}
                width={iconFontSize * 2} />
        </cgroup>
        <cgroup paddingLeft={(leftIcon ? iconFontSize * 2 : 0) + extraPaddingLeft} textAlignment="left" verticalAlignment="middle">
            <cspan color={color || colorOnSurface} fontSize={fontSize * $fontScale} {fontWeight} text={title} />
            <cspan color={colorOnSurfaceVariant} fontSize={subtitleFontSize * $fontScale} text={subtitle ? '\n' + subtitle : ''} visibility={subtitle ? 'visible' : 'hidden'} />
        </cgroup>
    </canvaslabel>
    <slot />
    <line color={colorOutlineVariant} height="1" startX="20" startY="0" stopX="100%" stopY="0" strokeWidth="1" verticalAlignment="bottom" visibility={showBottomLine ? 'visible' : 'hidden'} />
</canvasview>
