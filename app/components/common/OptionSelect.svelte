<svelte:options accessors />

<script context="module" lang="ts">
    import { Template } from '@nativescript-community/svelte-native/components';
    import { ObservableArray } from '@nativescript/core';
    import OptionSelect from '@shared/components/OptionSelect.svelte';
    import SettingsSlider from '@shared/components/SettingsSlider.svelte';
    import IconButton from '~/components/common/IconButton.svelte';
    import { ListItem as IListItem } from '~/components/common/ListItem';
    import ListItem from '~/components/common/ListItem.svelte';
    import ListItemAutoSize from '~/components/common/ListItemAutoSize.svelte';
    import PanelHeader from '~/components/common/PanelHeader.svelte';
    import Pill from '~/components/common/Pill.svelte';
    import { lc } from '~/helpers/locale';
    import { colors, fontScaleMaxed, fonts } from '~/variables';
    export interface OptionType extends IListItem {
        subtitle?: string;
        isPick?: boolean;
        boxType?: string;
        type?: string;
        [k: string]: any;
    }
</script>

<script lang="ts">
    // The app's design around the shared OptionSelect: panel look, PanelHeader title, filled search field,
    // thumbnail rows, slider rows and its own list items and toggle pill.
    export let title: string = null;
    /** Toggle pills above the list, each `{ id, icon, label, selected }`; a tap goes to `onToggle`. */
    export let toggles: { id: string; icon: string; label: string; selected: boolean }[] = null;
    export let onToggle: (toggle) => void = null;
    export let titleIcon: string = null;
    export let showFilter = false;
    export let showBorders = false;
    export let backgroundColor = null;
    /** The panel look, following the theme while open (a menu can toggle dark mode). */
    export let panel = false;
    export let borderRadius = 8;
    export let rowHeight = null;
    /** Height of an item of `type: 'separator'`: a hairline between two groups of items. */
    export let separatorHeight = 12;
    /** Heights of the `type: 'tiles'` item (a wrapping grid of icon-over-label buttons) and of the `type: 'footer'` item (one row of small buttons). */
    export let tilesHeight = 128;
    export let footerHeight = 44;
    export let autofocus = false;
    export let estimatedItemSize = true;
    export let autoSize = false;
    export let isScrollEnabled = true;
    export let width: string | number = '*';
    export let containerColumns: string = '*';
    export let autoSizeListItem: boolean = false;
    export let fontWeight = 'normal';
    export let options: OptionType[] | ObservableArray<OptionType>;
    export let onClose = null;
    export let selectedIndex = -1;
    export let height: number | string = null;
    export let fontSize = 16;
    export let iconFontSize = 24;
    export let onlyOneSelected = false;
    export let currentlyCheckedItem = null;
    export let onCheckBox: (item, value, e) => void = null;
    export let onChange: (item, value, e) => void = null;
    export let onRightIconTap: (item, e) => void = null;
    export let onLongPress: (item, e) => void = null;

    export let titleProps: Partial<svelteNative.JSX.LabelAttributes> = {};
    export let titleHolderProps: Partial<svelteNative.JSX.StackLayoutAttributes> = {};
    export let subtitleProps: Partial<svelteNative.JSX.LabelAttributes> = {};
    export let templateProps: Partial<svelteNative.JSX.GridLayoutAttributes> & {
        [k: string]: Partial<svelteNative.JSX.ViewAttributes>;
    } = {};

    export let component = autoSizeListItem ? ListItemAutoSize : ListItem;

    $: ({ colorHairline, colorOnSurface, colorOnSurfaceVariant, colorPanel, colorPrimary, colorSurfaceFill } = $colors);

    // the app's ListItemAutoSize takes a leading icon in column 0
    function getRowProps(item: OptionType, templateType: string) {
        if (autoSizeListItem && item.icon && (templateType === 'checkbox' || templateType === 'switch')) {
            return { icon: item.icon, iconFontFamily: item.iconFontFamily };
        }
        return {};
    }
</script>

<OptionSelect
    autoReloadItemOnLayout={true}
    {autoSize}
    {autoSizeListItem}
    {autofocus}
    backgroundColor={panel ? colorPanel : backgroundColor}
    {borderRadius}
    checkboxProps={{ marginRight: 0 }}
    {component}
    {containerColumns}
    {estimatedItemSize}
    {fontSize}
    {fontWeight}
    {footerHeight}
    {getRowProps}
    hairlineColor={colorHairline}
    {height}
    {iconFontSize}
    {isScrollEnabled}
    {onChange}
    {onCheckBox}
    {onClose}
    {onLongPress}
    {onRightIconTap}
    {onToggle}
    {onlyOneSelected}
    {options}
    {rowHeight}
    rowLongPressWithItem={true}
    {selectedIndex}
    {separatorHeight}
    {showBorders}
    {showFilter}
    {subtitleProps}
    switchProps={{ col: 2, horizontalAlignment: 'right', verticalAlignment: 'center' }}
    {templateProps}
    {tilesHeight}
    {title}
    {titleHolderProps}
    {titleProps}
    togglePill={Pill}
    {toggles}
    {width}
    {...panel ? { borderColor: colorHairline, borderWidth: 1 } : {}}
    {...$$restProps}
    bind:currentlyCheckedItem>
    <PanelHeader slot="header" icon={titleIcon} padding="16 8 4 20" {title} />
    <!-- the design's search field: a filled rounded bar with its icon, no outline -->
    <svelte:fragment slot="filter" let:clearFilter let:filter let:onLoaded let:onReturnPress let:setFilter>
        <gridlayout backgroundColor={colorSurfaceFill} borderRadius={22} columns="auto,*,auto" height={44} margin="4 16 8 16" row={1}>
            <label color={colorOnSurfaceVariant} fontFamily={$fonts.mdi} fontSize={20} padding="0 4 0 14" text="mdi-magnify" verticalAlignment="middle" />
            <textfield
                autocapitalizationType="none"
                backgroundColor="transparent"
                col={1}
                floating={false}
                hint={lc('search')}
                padding="0 4"
                placeholder={lc('search')}
                returnKeyType="search"
                text={filter}
                variant="none"
                verticalTextAlignment="center"
                on:loaded={onLoaded}
                on:returnPress={onReturnPress}
                on:textChange={(event) => setFilter(event['value'])} />

            <IconButton col={2} color={colorOnSurfaceVariant} isVisible={!!filter?.length} size={40} text="mdi-close" verticalAlignment="middle" on:tap={clearFilter} />
        </gridlayout>
    </svelte:fragment>
    <svelte:fragment slot="lefticon" let:item>
        <label
            class="ignoreA11yFontScale"
            color={item.color || colorOnSurface}
            fontFamily={$fonts.mdi}
            fontSize={(item.iconFontSize || iconFontSize) * $fontScaleMaxed}
            paddingLeft="8"
            text={item.icon}
            verticalAlignment="center"
            width={iconFontSize * 2} />
    </svelte:fragment>
    <!-- a fixed thumbnail tile, a map glyph standing in when there is no preview -->
    <svelte:fragment slot="image" let:item>
        <gridlayout backgroundColor={colorSurfaceFill} borderRadius={10} height={48} marginRight={12} verticalAlignment="middle" width={48}>
            <label color={colorPrimary} fontFamily={$fonts.mdi} fontSize={22} text="mdi-map-outline" textAlignment="center" verticalAlignment="middle" />
            <image headers={item.imageHeaders} src={item.image} stretch="aspectFill" visibility={item.image ? 'visible' : 'collapse'} />
        </gridlayout>
    </svelte:fragment>
    <svelte:fragment slot="templates">
        <Template key="slider" let:item>
            <SettingsSlider {fontSize} {...item} onChange={(value, event) => (item.onChange || onChange)?.(item, value, event)} />
        </Template>
    </svelte:fragment>
</OptionSelect>
