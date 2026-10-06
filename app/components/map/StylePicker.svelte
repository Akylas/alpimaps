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
    import { HorizontalPosition, VerticalPosition } from '@nativescript-community/ui-popover';
    import { showError } from '@shared/utils/showError';
    import { lc } from '~/helpers/locale';
    import { colors, fontScaleMaxed, fonts } from '~/variables';
    import PanelHeader from '../common/PanelHeader.svelte';
    import { MASSIF_ICON_FONTS, MASSIF_RANKINGS, type MassifIconFont, type MassifRanking, isMassifStyle, massifIconFont, massifLook, rankingFor } from '~/utils/massif';
    import { nutiProps } from '~/stores/mapStore';
    import { showPopoverMenu } from '~/utils/ui';
    $: ({ colorOnSurface, colorOnSurfaceVariant, colorOutlineSoft, colorPrimary } = $colors);

    export let families: StyleFamily[] = [];
    export let current: { style: string; variant?: string } = null;
    /** applies the variant on the map; the sheet stays open, it closes on a tap outside */
    export let onSelect: (family: StyleFamily, variant: StyleVariant) => void;
    /** the POI ranking of the current Massif look, a style parameter too */
    export let onRanking: (ranking: MassifRanking) => void = null;
    /** the icon font Massif draws POIs with, on the map and in the app: a new decoder */
    export let onIconFont: (font: MassifIconFont) => void = null;

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

    $: isMassif = isMassifStyle(current?.style);
    $: ranking = isMassif ? rankingFor(massifLook(current.style, current.variant)) : null;
    function selectRanking(value: MassifRanking) {
        ranking = value;
        onRanking?.(value);
    }

    function selectIconFont(value: MassifIconFont) {
        if (value !== $massifIconFont) {
            onIconFont?.(value);
        }
    }

    // Massif's `poiStyle`: unset (the project's own: plain on the OSM look, badges elsewhere), badge or plain
    const POI_STYLES = ['default', 'fill', 'icononly'] as const;
    const poiStyleStore = nutiProps.getStore('poiStyle');
    $: poiStyle = $poiStyleStore === true ? 'icononly' : $poiStyleStore === false ? 'fill' : 'default';
    function selectPoiStyle(value: (typeof POI_STYLES)[number]) {
        nutiProps.poiStyle = value === 'default' ? null : value === 'icononly';
    }

    // the Massif settings over the style list: one chip each showing its value, the values in a menu
    const CHIP_ROW = 40;
    interface ChipMenu {
        label: string;
        icon: string;
        values: readonly string[];
        selected: string;
        text: (value: string) => string;
        select: (value: string) => void;
    }
    let chipMenus: ChipMenu[];
    $: chipMenus = isMassif
        ? ([
              onRanking && { label: lc('poi_ranking'), icon: 'mdi-sort-variant', values: MASSIF_RANKINGS, selected: ranking, text: (v) => lc('ranking_' + v), select: selectRanking },
              { label: lc('poi_icons'), icon: 'mdi-map-marker-outline', values: POI_STYLES, selected: poiStyle, text: (v) => lc('poi_style_' + v), select: selectPoiStyle },
              onIconFont && {
                  label: lc('icon_font'),
                  icon: 'mdi-format-font',
                  values: MASSIF_ICON_FONTS,
                  selected: $massifIconFont,
                  text: (v) => lc('icon_font_' + v),
                  select: selectIconFont
              }
          ].filter(Boolean) as ChipMenu[])
        : [];

    async function showChipMenu(menu: ChipMenu, event) {
        try {
            await showPopoverMenu({
                anchor: event.object,
                vertPos: VerticalPosition.BELOW,
                horizPos: HorizontalPosition.ALIGN_LEFT,
                options: menu.values.map((value) => ({ id: value, name: menu.text(value), icon: value === menu.selected ? 'mdi-radiobox-marked' : 'mdi-radiobox-blank' })),
                // showPopoverMenu sizes for the rows alone: room for the title too
                props: { title: menu.label, autoSizeListItem: true, height: Math.min((menu.values.length * 52 + 60) * Math.sqrt($fontScaleMaxed), 400) },
                onClose: (option) => option && menu.select(option.id)
            });
        } catch (error) {
            showError(error);
        }
    }

    function select(family: StyleFamily, variant: StyleVariant) {
        current = { style: variant.style, variant: variant.variant };
        onSelect?.(family, variant);
    }
</script>

<gesturerootview
    class="bottomsheet"
    height={Math.min(families.length * ROW_HEIGHT * $fontScaleMaxed + 64 + (chipMenus.length ? CHIP_ROW : 0), 520)}
    rows={['auto', ...(chipMenus.length ? [CHIP_ROW] : []), '*'].join(',')}
    {...$$restProps}>
    <PanelHeader icon="mdi-map-outline" subtitle={currentName ? `${currentName.f.name} · ${currentName.v.name}` : null} title={lc('select_style')} />
    {#if chipMenus.length}
        <scrollview orientation="horizontal" row={1} scrollBarIndicatorVisible={false}>
            <stacklayout orientation="horizontal" padding="0 12" verticalAlignment="center">
                {#each chipMenus as menu}
                    <label
                        borderColor={colorOutlineSoft}
                        borderRadius={14}
                        borderWidth={1}
                        color={colorOnSurface}
                        fontSize={12}
                        height={28}
                        marginRight={6}
                        padding="0 8 0 10"
                        verticalTextAlignment="middle"
                        on:tap={(event) => showChipMenu(menu, event)}>
                        <cspan color={colorOnSurfaceVariant} fontFamily={$fonts.mdi} fontSize={15} text={menu.icon} />
                        <cspan text={' ' + menu.text(menu.selected) + ' '} />
                        <cspan color={colorOnSurfaceVariant} fontFamily={$fonts.mdi} fontSize={15} text="mdi-chevron-down" />
                    </label>
                {/each}
            </stacklayout>
        </scrollview>
    {/if}
    <collectionview id="collectionView" items={rows} row={chipMenus.length ? 2 : 1} rowHeight={ROW_HEIGHT * $fontScaleMaxed} ios:contentInsetAdjustmentBehavior={2}>
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
