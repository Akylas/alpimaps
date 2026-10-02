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
    $: ({ colorOnSurface, colorOnSurfaceVariant, colorOutlineSoft, colorPrimary } = $colors);

    export let families: StyleFamily[] = [];
    export let current: { style: string; variant?: string } = null;
    /** applies the variant on the map; the sheet stays open, it closes on a tap outside */
    export let onSelect: (family: StyleFamily, variant: StyleVariant) => void;

    const PREVIEW = 52;
    const CARD_WIDTH = PREVIEW + 10;
    // family name, preview, variant name
    const ROW_HEIGHT = 20 + PREVIEW + 22;

    function isCurrent(variant: StyleVariant, current) {
        return !!current && current.style === variant.style && (!variant.variant || variant.variant === (current.variant || 'streets'));
    }
    $: currentName = families.flatMap((f) => f.variants.map((v) => ({ f, v }))).find(({ v }) => isCurrent(v, current));

    function select(family: StyleFamily, variant: StyleVariant) {
        current = { style: variant.style, variant: variant.variant };
        onSelect?.(family, variant);
    }
</script>

<gesturerootview class="bottomsheet" height={Math.min(families.length * ROW_HEIGHT * $fontScaleMaxed + 64, 400)} rows="auto,*" {...$$restProps}>
    <PanelHeader icon="mdi-map-outline" subtitle={currentName ? `${currentName.f.name} · ${currentName.v.name}` : null} title={lc('select_style')} />
    <collectionview id="collectionView" items={families} row={1} rowHeight={ROW_HEIGHT * $fontScaleMaxed} ios:contentInsetAdjustmentBehavior={2}>
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
                                borderColor={isCurrent(variant, current) ? colorPrimary : colorOutlineSoft}
                                borderRadius={12}
                                borderWidth={isCurrent(variant, current) ? 2.5 : 1}
                                height={PREVIEW}
                                width={PREVIEW}>
                                <label color={variant.iconColor} fontFamily={$fonts.mdi} fontSize={22} horizontalAlignment="center" text={variant.icon} verticalAlignment="middle" />
                            </gridlayout>
                            <label
                                color={isCurrent(variant, current) ? colorPrimary : colorOnSurface}
                                fontSize={11}
                                fontWeight={isCurrent(variant, current) ? 'bold' : 'normal'}
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
