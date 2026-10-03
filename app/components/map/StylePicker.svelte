<script context="module" lang="ts">
    export interface StyleVariant {
        id: string;
        name: string;
        /** `<package>~<project>`, what setMapStyle takes */
        style: string;
        /** set for a Massif project: the `variant` style parameter, switched without a reload */
        variant?: string;
        icon: string;
        swatch: [string, string];
        iconColor: string;
        /** a rendered square of the style, shown instead of the swatch */
        preview?: string;
        selected?: boolean;
    }
    export interface StyleFamily {
        id: string;
        name: string;
        subtitle: string;
        variants: StyleVariant[];
    }
</script>

<script lang="ts">
    import { Template } from '@nativescript-community/svelte-native/components';
    import { lc } from '~/helpers/locale';
    import { colors, fontScaleMaxed, fonts } from '~/variables';
    import PanelHeader from '../common/PanelHeader.svelte';
    import { MASSIF_RANKINGS, type MassifRanking, isMassifStyle, massifLook, rankingFor } from '~/utils/massif';
    $: ({ colorOnPrimary, colorOnSurface, colorOnSurfaceVariant, colorOutlineSoft, colorPrimary } = $colors);

    export let families: StyleFamily[] = [];
    export let current: { style: string; variant?: string } = null;
    /** applies the variant on the map; the sheet stays open, it closes on a tap outside */
    export let onSelect: (family: StyleFamily, variant: StyleVariant) => void;
    /** the POI ranking of the current Massif look, a style parameter too */
    export let onRanking: (ranking: MassifRanking) => void = null;

    const PREVIEW = 52;
    const CARD_WIDTH = PREVIEW + 10;
    // family name, preview, variant name
    const ROW_HEIGHT = 20 + PREVIEW + 22;

    function isCurrent(variant: StyleVariant, current) {
        return !!current && current.style === variant.style && (!variant.variant || variant.variant === (current.variant || 'streets'));
    }
    $: currentName = families.flatMap((f) => f.variants.map((v) => ({ f, v }))).find(({ v }) => isCurrent(v, current));
    // the selection lives in the items: a template does not re-render when `current` alone changes
    $: rows = families.map((f) => ({ ...f, variants: f.variants.map((v) => ({ ...v, selected: isCurrent(v, current) })) }));

    $: showRanking = !!onRanking && isMassifStyle(current?.style);
    $: ranking = showRanking ? rankingFor(massifLook(current.style, current.variant)) : null;
    const RANKING_ROW = 40;

    function selectRanking(value: MassifRanking) {
        ranking = value;
        onRanking?.(value);
    }

    function select(family: StyleFamily, variant: StyleVariant) {
        current = { style: variant.style, variant: variant.variant };
        onSelect?.(family, variant);
    }
</script>

<gesturerootview
    class="bottomsheet"
    height={Math.min(families.length * ROW_HEIGHT * $fontScaleMaxed + 64 + (showRanking ? RANKING_ROW : 0), 440)}
    rows={`auto,${showRanking ? RANKING_ROW : 0},*`}
    {...$$restProps}>
    <PanelHeader icon="mdi-map-outline" subtitle={currentName ? `${currentName.f.name} · ${currentName.v.name}` : null} title={lc('select_style')} />
    <stacklayout orientation="horizontal" padding="0 12" row={1} verticalAlignment="center" visibility={showRanking ? 'visible' : 'collapse'}>
        <label color={colorOnSurfaceVariant} fontSize={12} marginRight={8} text={lc('poi_ranking')} verticalAlignment="middle" />
        {#each MASSIF_RANKINGS as value}
            <label
                backgroundColor={ranking === value ? colorPrimary : 'transparent'}
                borderColor={ranking === value ? colorPrimary : colorOutlineSoft}
                borderRadius={14}
                borderWidth={1}
                color={ranking === value ? colorOnPrimary : colorOnSurface}
                fontSize={12}
                height={28}
                marginRight={6}
                padding="0 12"
                text={lc('ranking_' + value)}
                verticalTextAlignment="middle"
                on:tap={() => selectRanking(value)} />
        {/each}
    </stacklayout>
    <collectionview id="collectionView" items={rows} row={2} rowHeight={ROW_HEIGHT * $fontScaleMaxed} ios:contentInsetAdjustmentBehavior={2}>
        <Template let:item={family}>
            <gridlayout rows="20,*">
                <stacklayout orientation="horizontal" padding="0 12">
                    <label color={colorOnSurface} fontSize={13} fontWeight="bold" text={family.name} verticalAlignment="bottom" />
                    <label color={colorOnSurfaceVariant} fontSize={11} marginLeft={6} text={family.subtitle} verticalAlignment="bottom" />
                </stacklayout>
                <collectionview colWidth={CARD_WIDTH * $fontScaleMaxed} items={family.variants} orientation="horizontal" paddingLeft={7} paddingRight={7} row={1}>
                    <Template let:item={variant}>
                        <gridlayout padding="4 5 0 5" rows={`${PREVIEW},auto`} on:tap={() => select(family, variant)}>
                            <gridlayout
                                style={`background: linear-gradient(to bottom right, ${variant.swatch[0]}, ${variant.swatch[1]})`}
                                borderColor={variant.selected ? colorPrimary : colorOutlineSoft}
                                borderRadius={12}
                                borderWidth={variant.selected ? 2.5 : 1}
                                height={PREVIEW}
                                width={PREVIEW}>
                                {#if variant.preview}
                                    <image borderRadius={11} src={variant.preview} stretch="aspectFill" />
                                {:else}
                                    <label color={variant.iconColor} fontFamily={$fonts.mdi} fontSize={22} horizontalAlignment="center" text={variant.icon} verticalAlignment="middle" />
                                {/if}
                            </gridlayout>
                            <label
                                color={variant.selected ? colorPrimary : colorOnSurface}
                                fontSize={11}
                                fontWeight={variant.selected ? 'bold' : 'normal'}
                                lineBreak="end"
                                maxLines={1}
                                row={1}
                                text={variant.name}
                                textAlignment="center" />
                        </gridlayout>
                    </Template>
                </collectionview>
            </gridlayout>
        </Template>
    </collectionview>
</gesturerootview>
